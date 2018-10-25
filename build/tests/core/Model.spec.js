"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const is_1 = __importDefault(require("@sindresorhus/is"));
const assert_1 = __importDefault(require("assert"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const faker_1 = __importDefault(require("faker"));
const mocha_1 = require("mocha");
const mongodb_1 = require("mongodb");
const db = __importStar(require("../.."));
const Baz_1 = __importDefault(require("../models/Baz"));
const Foo_1 = __importDefault(require("../models/Foo"));
db.configure({
    host: 'localhost:27017',
    name: 'mongodb_odm_test',
});
mocha_1.describe('core/Model', () => {
    before(() => __awaiter(this, void 0, void 0, function* () {
        yield (yield db.getInstance()).dropDatabase();
    }));
    mocha_1.it('throws an error if the model has no schema defined', () => __awaiter(this, void 0, void 0, function* () {
        assert_1.default(Foo_1.default.schema);
    }));
    mocha_1.it('can find a document', () => __awaiter(this, void 0, void 0, function* () {
        const t = { aString: faker_1.default.random.alphaNumeric(10) };
        const res = yield Baz_1.default.insertOne(t);
        assert_1.default(res);
        const doc = yield Baz_1.default.findOne(res._id);
        assert_1.default(doc);
        assert_1.default(doc._id.equals(res._id));
    }));
    mocha_1.it('can find multiple documents', () => __awaiter(this, void 0, void 0, function* () {
        const s = faker_1.default.random.alphaNumeric(10);
        yield Baz_1.default.insertOne({ aString: s });
        yield Baz_1.default.insertOne({ aString: s });
        yield Baz_1.default.insertOne({ aString: s });
        const docs = yield Baz_1.default.findMany({ aString: s });
        assert_1.default(docs.length === 3);
    }));
    mocha_1.it('can find a random document', () => __awaiter(this, void 0, void 0, function* () {
        const doc = yield Baz_1.default.findOne();
        assert_1.default(doc);
    }));
    mocha_1.it('can count the total number of documents in the collection', () => __awaiter(this, void 0, void 0, function* () {
        const s = faker_1.default.random.alphaNumeric(10);
        yield Baz_1.default.insertOne({ aString: s });
        yield Baz_1.default.insertOne({ aString: s });
        yield Baz_1.default.insertOne({ aString: s });
        const count = yield Baz_1.default.count({ aString: s });
        assert_1.default(count === 3);
    }));
    mocha_1.it('can generate random required fields', () => __awaiter(this, void 0, void 0, function* () {
        const res = yield Baz_1.default.randomFields();
        assert_1.default(is_1.default.string(res.aString));
    }));
    mocha_1.it('can insert a new document', () => __awaiter(this, void 0, void 0, function* () {
        const t = { aString: faker_1.default.random.alphaNumeric(10) };
        const doc = yield Baz_1.default.insertOne(t);
        assert_1.default(doc);
        assert_1.default(mongodb_1.ObjectID.isValid(doc._id));
        assert_1.default(doc.aString === t.aString);
    }));
    mocha_1.it('can insert multiple documents', () => __awaiter(this, void 0, void 0, function* () {
        const t = [{ aString: faker_1.default.random.alphaNumeric(10) }, { aString: faker_1.default.random.alphaNumeric(10) }, { aString: faker_1.default.random.alphaNumeric(10) }];
        const docs = yield Baz_1.default.insertMany(t);
        assert_1.default(docs);
        assert_1.default(docs.reduce((prev, curr) => prev && mongodb_1.ObjectID.isValid(curr._id), true));
        docs.forEach((doc, i) => assert_1.default(doc.aString === t[i].aString));
    }));
    mocha_1.it('should throw if required fields are missing during insertion', () => __awaiter(this, void 0, void 0, function* () {
        let didThrow = true;
        try {
            yield Baz_1.default.insertOne({ aNumber: 6 }).catch(err => { throw err; });
            didThrow = false;
        }
        catch (err) { }
        assert_1.default(didThrow);
    }));
    mocha_1.it('can format documents according to the schema', () => __awaiter(this, void 0, void 0, function* () {
        const t = { aFormattedString: faker_1.default.random.alphaNumeric(10) };
        const res = yield Baz_1.default.formatDocument(t);
        assert_1.default(Baz_1.default.schema.fields.aFormattedString.format(t.aFormattedString) === res.aFormattedString);
    }));
    mocha_1.it('can encrypt document fields according to the schema', () => __awaiter(this, void 0, void 0, function* () {
        const s = faker_1.default.random.alphaNumeric(10);
        const t = { anEncryptedString: s };
        const res = yield Baz_1.default.formatDocument(t);
        assert_1.default(yield bcrypt_1.default.compare(s, res.anEncryptedString));
    }));
    mocha_1.it('should automatically generate default values on insert', () => __awaiter(this, void 0, void 0, function* () {
        const t = { aString: faker_1.default.random.alphaNumeric(10) };
        const res = yield Baz_1.default.insertOne(t);
        assert_1.default(res.aBoolean === Baz_1.default.schema.fields.aBoolean.default);
    }));
    mocha_1.it('should automatically format values on insert according to the schema', () => __awaiter(this, void 0, void 0, function* () {
        const t = { aString: faker_1.default.random.alphaNumeric(10), aFormattedString: faker_1.default.random.alphaNumeric(10) };
        const res = yield Baz_1.default.insertOne(t);
        assert_1.default(Baz_1.default.schema.fields.aFormattedString.format(t.aFormattedString) === res.aFormattedString);
    }));
    mocha_1.it('can update an existing doc', () => __awaiter(this, void 0, void 0, function* () {
        const s = faker_1.default.random.alphaNumeric(10);
        const t = { aString: faker_1.default.random.alphaNumeric(10) };
        yield Baz_1.default.insertOne(t);
        const updated = yield Baz_1.default.updateOne(t, { aString: s }, { returnDoc: true });
        assert_1.default(updated.aString === s);
    }));
    mocha_1.it('can upsert a doc if it does not already exist', () => __awaiter(this, void 0, void 0, function* () {
        const s = faker_1.default.random.alphaNumeric(10);
        const t = { aString: s };
        yield Baz_1.default.updateOne(t, { aFormattedString: faker_1.default.random.alphaNumeric(10) }, { upsert: true });
        const doc = yield Baz_1.default.findOne({ aString: s });
        assert_1.default(doc);
    }));
    mocha_1.it('should return false if update fails and returnDoc is false', () => __awaiter(this, void 0, void 0, function* () {
        const res = yield Baz_1.default.updateOne(new mongodb_1.ObjectID(), { aString: faker_1.default.random.alphaNumeric(10) });
        assert_1.default(res === false);
    }));
    mocha_1.it('should return null if update fails and returnDoc is true', () => __awaiter(this, void 0, void 0, function* () {
        const res = yield Baz_1.default.updateOne(new mongodb_1.ObjectID(), { aString: faker_1.default.random.alphaNumeric(10) }, { returnDoc: true });
        assert_1.default(is_1.default.null_(res));
    }));
    mocha_1.it('should automatically format values on update according to the schema', () => __awaiter(this, void 0, void 0, function* () {
        const s = faker_1.default.random.alphaNumeric(10);
        const t = faker_1.default.random.alphaNumeric(10);
        yield Baz_1.default.insertOne({ aString: s });
        const res = yield Baz_1.default.updateOne({ aString: s }, { aFormattedString: t }, { returnDoc: true });
        assert_1.default(!is_1.default.nullOrUndefined(res));
        assert_1.default(res.aFormattedString !== t);
        assert_1.default(res.aFormattedString === Baz_1.default.schema.fields.aFormattedString.format(t));
    }));
    mocha_1.it('should automatically format values on upsert according to the schema', () => __awaiter(this, void 0, void 0, function* () {
        const s = faker_1.default.random.alphaNumeric(10);
        const res = yield Baz_1.default.updateOne({ aString: faker_1.default.random.alphaNumeric(10) }, { aFormattedString: s }, { upsert: true, returnDoc: true });
        assert_1.default(!is_1.default.nullOrUndefined(res));
        assert_1.default(res.aFormattedString !== s);
        assert_1.default(res.aFormattedString === Baz_1.default.schema.fields.aFormattedString.format(s));
    }));
    mocha_1.it('can update multiple existing docs', () => __awaiter(this, void 0, void 0, function* () {
        const s = faker_1.default.random.alphaNumeric(10);
        const t = faker_1.default.random.alphaNumeric(10);
        const q = [{ aString: s }, { aString: s }, { aString: s }];
        const docs = yield Baz_1.default.insertMany(q);
        assert_1.default(docs);
        assert_1.default(docs.reduce((prev, curr) => prev && mongodb_1.ObjectID.isValid(curr._id), true));
        const res = yield Baz_1.default.updateMany({ aString: s }, { aString: t }, { returnDocs: true });
        assert_1.default(res.length === docs.length);
        assert_1.default(res.reduce((o, v) => o && (v.aString === t), true));
    }));
    mocha_1.it('can upsert a doc in an updateMany op while `returnDocs` is true', () => __awaiter(this, void 0, void 0, function* () {
        const s = faker_1.default.random.alphaNumeric(10);
        const t = faker_1.default.random.alphaNumeric(10);
        const res = yield Baz_1.default.updateMany({ aString: s }, { aFormattedString: t }, { returnDocs: true, upsert: true });
        assert_1.default(res.length === 1);
        assert_1.default(!is_1.default.nullOrUndefined(yield Baz_1.default.findOne({ aString: s })));
    }));
    mocha_1.it('can upsert a doc in an updateMany op while `returnDocs` is false', () => __awaiter(this, void 0, void 0, function* () {
        const s = faker_1.default.random.alphaNumeric(10);
        const t = faker_1.default.random.alphaNumeric(10);
        const res = yield Baz_1.default.updateMany({ aString: s }, { aFormattedString: t }, { upsert: true });
        assert_1.default(res === true);
        assert_1.default(!is_1.default.nullOrUndefined(yield Baz_1.default.findOne({ aString: s })));
    }));
    mocha_1.it('can delete a doc', () => __awaiter(this, void 0, void 0, function* () {
        const s = faker_1.default.random.alphaNumeric(10);
        const doc = yield Baz_1.default.insertOne({ aString: s });
        assert_1.default(!is_1.default.null_(yield Baz_1.default.findOne({ aString: s })));
        const res = yield Baz_1.default.deleteOne({ aString: s });
        assert_1.default(res === true);
        assert_1.default(is_1.default.null_(yield Baz_1.default.findOne({ aString: s })));
    }));
    mocha_1.it('can delete a doc and return the deleted doc', () => __awaiter(this, void 0, void 0, function* () {
        const s = faker_1.default.random.alphaNumeric(10);
        const doc = yield Baz_1.default.insertOne({ aString: s });
        assert_1.default(!is_1.default.null_(yield Baz_1.default.findOne({ aString: s })));
        const objectId = doc._id;
        const res = yield Baz_1.default.deleteOne({ aString: s }, { returnDoc: true });
        assert_1.default(!is_1.default.null_(res));
        assert_1.default(res._id.equals(objectId));
        assert_1.default(is_1.default.null_(yield Baz_1.default.findOne({ aString: s })));
    }));
    mocha_1.it('can delete multiple docs', () => __awaiter(this, void 0, void 0, function* () {
        const s = faker_1.default.random.alphaNumeric(10);
        yield Baz_1.default.insertMany([{ aString: s }, { aString: s }, { aString: s }]);
        assert_1.default((yield Baz_1.default.count({ aString: s })) === 3);
        yield Baz_1.default.deleteMany({ aString: s });
        assert_1.default((yield Baz_1.default.count({ aString: s })) === 0);
    }));
    mocha_1.it('can delete multiple docs and return the deleted docs', () => __awaiter(this, void 0, void 0, function* () {
        const s = faker_1.default.random.alphaNumeric(10);
        yield Baz_1.default.insertMany([{ aString: s }, { aString: s }, { aString: s }]);
        assert_1.default((yield Baz_1.default.count({ aString: s })) === 3);
        const res = yield Baz_1.default.deleteMany({ aString: s }, { returnDocs: true });
        assert_1.default(is_1.default.array(res));
        assert_1.default(res.length === 3);
    }));
    mocha_1.it('can replace an existing doc and return the old doc', () => __awaiter(this, void 0, void 0, function* () {
        const s = faker_1.default.random.alphaNumeric(10);
        const t = faker_1.default.random.alphaNumeric(10);
        yield Baz_1.default.insertOne({ aString: s });
        const doc = yield Baz_1.default.findAndReplaceOne({ aString: s }, { aString: t }, { returnOriginal: true });
        assert_1.default(!is_1.default.nullOrUndefined(doc));
        assert_1.default(doc.aString === s);
    }));
    mocha_1.it('can replace an existing doc and return the new doc', () => __awaiter(this, void 0, void 0, function* () {
        const s = faker_1.default.random.alphaNumeric(10);
        const t = faker_1.default.random.alphaNumeric(10);
        yield Baz_1.default.insertOne({ aString: s });
        const doc = yield Baz_1.default.findAndReplaceOne({ aString: s }, { aString: t }, { returnOriginal: false });
        assert_1.default(!is_1.default.nullOrUndefined(doc));
        assert_1.default(doc.aString === t);
    }));
});
//# sourceMappingURL=Model.spec.js.map