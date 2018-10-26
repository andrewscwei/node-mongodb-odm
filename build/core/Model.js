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
Object.defineProperty(exports, "__esModule", { value: true });
const is_1 = __importDefault(require("@sindresorhus/is"));
const assert_1 = __importDefault(require("assert"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const debug_1 = __importDefault(require("debug"));
const lodash_1 = __importDefault(require("lodash"));
const mongodb_1 = require("mongodb");
const __1 = require("..");
const types_1 = require("../types");
const sanitizeDocument_1 = __importDefault(require("../utils/sanitizeDocument"));
const sanitizeQuery_1 = __importDefault(require("../utils/sanitizeQuery"));
const validateFieldValue_1 = __importDefault(require("../utils/validateFieldValue"));
const Aggregation_1 = __importDefault(require("./Aggregation"));
const log = debug_1.default('mongodb-odm:model');
class Model {
    static getCollection() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.schema)
                throw new Error('This model has no schema, you must define this static proerty in the derived class');
            return __1.getCollection(this.schema.collection);
        });
    }
    static randomFields(fixedFields = {}, { includeOptionals = false } = {}) {
        const o = {};
        const fields = this.schema.fields;
        for (const key in fields) {
            if (!fields.hasOwnProperty(key))
                continue;
            if (o.hasOwnProperty(key))
                continue;
            const fieldSpecs = fields[key];
            if (!includeOptionals && !fieldSpecs.required)
                continue;
            if (fieldSpecs.random)
                o[key] = fieldSpecs.random();
        }
        for (const key in fixedFields) {
            if (!fixedFields.hasOwnProperty(key))
                continue;
            o[key] = fixedFields[key];
        }
        return o;
    }
    static pipeline(queryOrSpecs, options) {
        if (!this.schema)
            throw new Error('This model has no schema, you must define this static proerty in the derived class');
        if (queryOrSpecs && Object.keys(queryOrSpecs).some(val => val.startsWith('$'))) {
            return Aggregation_1.default.pipelineFactory(this.schema, queryOrSpecs, options);
        }
        else {
            return Aggregation_1.default.pipelineFactory(this.schema, { $match: queryOrSpecs }, options);
        }
    }
    static identifyOne(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.findOne(query);
            if (is_1.default.nullOrUndefined(result)) {
                throw new Error(`No results found while identifying this ${this.schema.model} using the query ${JSON.stringify(query, null, 0)}`);
            }
            else if (is_1.default.nullOrUndefined(result._id)) {
                throw new Error(`Cannot identify this ${this.schema.model} using the query ${JSON.stringify(query, null, 0)}`);
            }
            else {
                return result._id;
            }
        });
    }
    static findOne(query, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (is_1.default.nullOrUndefined(query)) {
                const collection = yield this.getCollection();
                const results = yield collection.aggregate(this.pipeline(query).concat([{ $sample: { size: 1 } }])).toArray();
                assert_1.default(results.length <= 1, new Error('More than 1 random document found even though only 1 was supposed to be found.'));
                if (results.length === 1)
                    return results[0];
                return null;
            }
            else {
                const results = yield this.findMany(query, options);
                if (results.length === 0)
                    return null;
                return results[0];
            }
        });
    }
    static findMany(query, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const collection = yield this.getCollection();
            const results = yield collection.aggregate(this.pipeline(query), options).toArray();
            return results;
        });
    }
    static insertOne(doc, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const t = yield this.beforeInsert(doc || this.randomFields(), Object.assign({ strict: true }, options));
            log(`${this.schema.model}.insertOne:`, JSON.stringify(t, null, 0));
            const collection = yield this.getCollection();
            const results = yield collection.insertOne(t, options).catch(error => { throw error; });
            log(`${this.schema.model}.insertOne results:`, JSON.stringify(results, null, 0));
            assert_1.default(results.result.ok === 1);
            assert_1.default(results.ops.length <= 1, new Error('Somehow insertOne() op inserted more than 1 document'));
            if (results.ops.length < 1)
                return null;
            const o = results.ops[0];
            yield this.afterInsert(o);
            return o;
        });
    }
    static insertMany(docs, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const n = docs.length;
            const t = new Array(n);
            for (let i = 0; i < n; i++) {
                t[i] = yield this.beforeInsert(docs[i]);
            }
            log(`${this.schema.model}.insertMany:`, JSON.stringify(t, null, 0));
            const collection = yield this.getCollection();
            const results = yield collection.insertMany(t, options);
            log(`${this.schema.model}.insertMany results:`, JSON.stringify(results, null, 0));
            assert_1.default(results.result.ok === 1);
            const o = results.ops;
            const m = o.length;
            for (let i = 0; i < m; i++) {
                yield this.afterInsert(o[i]);
            }
            return o;
        });
    }
    static updateOne(query, update, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const collection = yield this.getCollection();
            const [q, u] = (options.skipHooks === true) ? [query, update] : yield this.beforeUpdate(query, update, options);
            log(`${this.schema.model}.updateOne:`, JSON.stringify(q, null, 0), JSON.stringify(u, null, 0), JSON.stringify(options, null, 0));
            if (options.returnDoc === true) {
                if (!is_1.default.object(q)) {
                    throw new Error('Invalid query, maybe it is not sanitized? This could happen if you enabled skipHooks in the options, in which case you will need to sanitize the query yourself');
                }
                const res = yield collection.findOneAndUpdate(q, u, Object.assign({}, options, { returnOriginal: true }));
                log(`${this.schema.model}.updateOne results:`, JSON.stringify(res, null, 0), JSON.stringify(options, null, 0));
                assert_1.default(res.ok === 1, new Error('Update failed'));
                let oldDoc;
                let newDoc;
                if (is_1.default.nullOrUndefined(res.lastErrorObject.upserted)) {
                    oldDoc = res.value;
                    if (is_1.default.nullOrUndefined(oldDoc))
                        return null;
                    newDoc = yield this.findOne(oldDoc._id);
                }
                else {
                    newDoc = yield this.findOne(res.lastErrorObject.upserted);
                }
                if (is_1.default.nullOrUndefined(newDoc)) {
                    throw new Error('Unable to find the updated doc');
                }
                if (options.skipHooks !== true) {
                    yield this.afterUpdate(oldDoc, newDoc);
                }
                return newDoc;
            }
            else {
                if (!is_1.default.object(q)) {
                    throw new Error('Invalid query, maybe it is not sanitized? This could happen if you enabled skipHooks in the options, in which case you will need to sanitize the query yourself');
                }
                const res = yield collection.updateOne(q, u, options);
                log(`${this.schema.model}.updateOne results:`, JSON.stringify(res, null, 0));
                assert_1.default(res.result.ok === 1);
                if (res.result.n <= 0)
                    return false;
                if (options.skipHooks !== true) {
                    yield this.afterUpdate();
                }
                return true;
            }
        });
    }
    static updateMany(query, update, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const [q, u] = yield this.beforeUpdate(query, update, options);
            const collection = yield this.getCollection();
            log(`${this.schema.model}.updateMany:`, JSON.stringify(q, null, 0), JSON.stringify(u, null, 0), JSON.stringify(options, null, 0));
            if (options.returnDocs === true) {
                const docs = yield this.findMany(q);
                const n = docs.length;
                const results = [];
                if ((n <= 0) && (options.upsert === true)) {
                    const res = yield this.updateOne(q, u, Object.assign({}, options, { returnDoc: true, skipHooks: true }));
                    if (is_1.default.boolean(res) || is_1.default.null_(res)) {
                        throw new Error('Error upserting document during an updateMany operation');
                    }
                    results.push(res);
                }
                else {
                    for (let i = 0; i < n; i++) {
                        const doc = docs[i];
                        const result = yield collection.findOneAndUpdate({ _id: doc._id }, u, Object.assign({ returnOriginal: false }, options));
                        assert_1.default(result.ok === 1);
                        assert_1.default(result.value);
                        results.push(result.value);
                    }
                    log(`${this.schema.model}.updateMany results:`, JSON.stringify(results, null, 0));
                }
                yield this.afterUpdate(undefined, results);
                return results;
            }
            else {
                const results = yield collection.updateMany(q, u, options);
                log(`${this.schema.model}.updateMany results:`, JSON.stringify(results, null, 0));
                assert_1.default(results.result.ok === 1);
                if (results.result.n <= 0)
                    return false;
                yield this.afterUpdate();
                return true;
            }
        });
    }
    static deleteOne(query, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const q = yield this.beforeDelete(query, options);
            log(`${this.schema.model}.deleteOne:`, JSON.stringify(query, null, 0));
            const collection = yield this.getCollection();
            if (options.returnDoc === true) {
                const results = yield collection.findOneAndDelete(q);
                log(`${this.schema.model}.deleteOne results:`, JSON.stringify(results, null, 0));
                assert_1.default(results.ok === 1);
                if (!results.value) {
                    return null;
                }
                yield this.afterDelete(results.value);
                return results.value;
            }
            else {
                const results = yield collection.deleteOne(q, options);
                log(`${this.schema.model}.deleteOne results:`, JSON.stringify(results, null, 0));
                assert_1.default(results.result.ok === 1);
                if (!is_1.default.number(results.result.n) || (results.result.n <= 0)) {
                    return false;
                }
                yield this.afterDelete();
                return true;
            }
        });
    }
    static deleteMany(query, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const q = yield this.beforeDelete(query, options);
            log(`${this.schema.model}.deleteMany:`, JSON.stringify(q, null, 0));
            const collection = yield this.getCollection();
            if (options.returnDocs === true) {
                const docs = yield this.findMany(q);
                const n = docs.length;
                const results = [];
                for (let i = 0; i < n; i++) {
                    const doc = docs[i];
                    const result = yield collection.findOneAndDelete({ _id: doc._id });
                    assert_1.default(result.ok === 1);
                    if (result.value) {
                        results.push(result.value);
                    }
                }
                log(`${this.schema.model}.deleteMany results:`, JSON.stringify(results, null, 0));
                const m = results.length;
                yield this.afterDelete(results);
                return results;
            }
            else {
                const results = yield collection.deleteMany(q, Object.assign({}, options));
                log(`${this.schema.model}.deleteMany results:`, JSON.stringify(results, null, 0));
                assert_1.default(results.result.ok === 1);
                if (!is_1.default.number(results.result.n) || (results.result.n <= 0))
                    return false;
                yield this.afterDelete();
                return true;
            }
        });
    }
    static findAndReplaceOne(query, replacement = this.randomFields(), options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const q = yield this.beforeDelete(query, options);
            const r = yield this.beforeInsert(replacement, options);
            log(`${this.schema.model}.replaceOne:`, JSON.stringify(q, null, 0), JSON.stringify(r, null, 0));
            const collection = yield this.getCollection();
            const results = yield collection.findOneAndReplace(q, r, Object.assign({}, options, { returnOriginal: true }));
            log(`${this.schema.model}.replaceOne results:`, JSON.stringify(results, null, 0));
            assert_1.default(results.ok === 1);
            const oldDoc = results.value;
            if (is_1.default.nullOrUndefined(oldDoc))
                return null;
            const newDoc = yield this.findOne(r);
            if (is_1.default.null_(newDoc)) {
                throw new Error('Document is replaced but unable to find the new document in the database');
            }
            yield this.afterDelete(results.value);
            yield this.afterInsert(newDoc);
            return (options.returnOriginal === true) ? oldDoc : newDoc;
        });
    }
    static count(query, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield this.findMany(query, options);
            return results.length;
        });
    }
    static formatDocument(doc) {
        return __awaiter(this, void 0, void 0, function* () {
            const formattedDoc = lodash_1.default.cloneDeep(doc);
            const fields = this.schema.fields;
            for (const key in this.schema.fields) {
                if (!formattedDoc.hasOwnProperty(key))
                    continue;
                const fieldSpecs = fields[key];
                assert_1.default(fieldSpecs, new Error(`Field ${key} not found in schema`));
                if (is_1.default.function_(fieldSpecs.format)) {
                    const formattedValue = yield fieldSpecs.format(formattedDoc[key]);
                    formattedDoc[key] = formattedValue;
                }
                if (fieldSpecs.encrypted === true) {
                    formattedDoc[key] = yield bcrypt_1.default.hash(`${formattedDoc[key]}`, 10);
                }
            }
            return formattedDoc;
        });
    }
    static validateDocument(doc, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const fields = this.schema.fields;
            for (const key in doc) {
                if (key === '_id')
                    continue;
                if (this.schema.timestamps && (key === 'updatedAt'))
                    continue;
                if (this.schema.timestamps && (key === 'createdAt'))
                    continue;
                const val = doc[key];
                if (!this.schema.fields.hasOwnProperty(key)) {
                    throw new Error(`The field '${key}' is not defined in the schema`);
                }
                const fieldSpecs = fields[key];
                if (!validateFieldValue_1.default(val, fieldSpecs)) {
                    throw new Error(`Error validating field '${key}' with value [${val}] of type [${typeof val}], constraints: ${JSON.stringify(fieldSpecs, null, 0)}, doc: ${JSON.stringify(doc, null, 0)}`);
                }
            }
            if ((options.ignoreUniqueIndex !== true) && this.schema.indexes) {
                const n = this.schema.indexes.length;
                for (let i = 0; i < n; i++) {
                    const index = this.schema.indexes[i];
                    if (!index.options)
                        continue;
                    if (!index.options.unique)
                        continue;
                    if (!index.spec)
                        continue;
                    if (!Object.keys(index.spec).every(v => Object.keys(doc).indexOf(v) > -1))
                        continue;
                    const uniqueQuery = lodash_1.default.pick(doc, Object.keys(index.spec));
                    if (yield this.findOne(uniqueQuery))
                        throw new Error(`Another document already exists with ${JSON.stringify(uniqueQuery, null, 0)}`);
                }
            }
            if (options.strict === true) {
                for (const key in this.schema.fields) {
                    if (!this.schema.fields.hasOwnProperty(key))
                        continue;
                    const field = fields[key];
                    if (!field.required || field.default)
                        continue;
                    if (!doc.hasOwnProperty(key))
                        throw new Error(`Missing required field '${key}'`);
                }
            }
            return true;
        });
    }
    static willInsertDocument(doc) {
        return __awaiter(this, void 0, void 0, function* () {
            return doc;
        });
    }
    static didInsertDocument(doc) {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    static willUpdateDocument(query, update) {
        return __awaiter(this, void 0, void 0, function* () {
            return [query, update];
        });
    }
    static didUpdateDocument(prevDoc, newDocs) {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    static willDeleteDocument(query) {
        return __awaiter(this, void 0, void 0, function* () {
            return query;
        });
    }
    static didDeleteDocument(docs) {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    static beforeInsert(doc, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const fields = this.schema.fields;
            const d = yield this.willInsertDocument(doc);
            let o = sanitizeDocument_1.default(this.schema, d);
            if ((this.schema.timestamps === true) && (options.ignoreTimestamps !== true)) {
                if (!is_1.default.date(o.createdAt))
                    o.createdAt = new Date();
                if (!is_1.default.date(o.updatedAt))
                    o.updatedAt = new Date();
            }
            for (const key in this.schema.fields) {
                if (!this.schema.fields.hasOwnProperty(key))
                    continue;
                if (o.hasOwnProperty(key))
                    continue;
                const fieldSpecs = fields[key];
                if (is_1.default.undefined(fieldSpecs.default))
                    continue;
                o[key] = (is_1.default.function_(fieldSpecs.default)) ? fieldSpecs.default() : fieldSpecs.default;
            }
            o = yield this.formatDocument(o);
            yield this.validateDocument(o, Object.assign({ ignoreUniqueIndex: true, strict: true }, options));
            return o;
        });
    }
    static afterInsert(doc) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.didInsertDocument(doc);
        });
    }
    static beforeUpdate(query, update, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const [q, u] = yield this.willUpdateDocument(query, update);
            const qq = sanitizeQuery_1.default(this.schema, q);
            let uu;
            if (types_1.typeIsUpdate(u)) {
                uu = Object.assign({}, u);
                if (uu.$set)
                    uu.$set = sanitizeDocument_1.default(this.schema, uu.$set);
                if (uu.$setOnInsert)
                    uu.$setOnInsert = sanitizeDocument_1.default(this.schema, uu.$setOnInsert);
                if (uu.$addToSet)
                    uu.$addToSet = sanitizeDocument_1.default(this.schema, uu.$addToSet);
                if (uu.$push)
                    uu.$push = sanitizeDocument_1.default(this.schema, uu.$push);
            }
            else {
                uu = {
                    $set: sanitizeDocument_1.default(this.schema, u),
                };
            }
            if ((this.schema.timestamps === true) && (options.ignoreTimestamps !== true)) {
                if (!uu.$set)
                    uu.$set = {};
                if (!is_1.default.date(uu.$set.updatedAt))
                    uu.$set.updatedAt = new Date();
            }
            if (uu.$set) {
                uu.$set = yield this.formatDocument(uu.$set);
            }
            if (options.upsert === true) {
                const beforeInsert = yield this.beforeInsert(qq, Object.assign({}, options, { strict: false }));
                const setOnInsert = lodash_1.default.omit(Object.assign({}, uu.$setOnInsert || {}, beforeInsert), Object.keys(uu.$set || {}));
                if (!is_1.default.emptyObject(setOnInsert)) {
                    uu.$setOnInsert = setOnInsert;
                }
            }
            yield this.validateDocument(uu.$set, Object.assign({ ignoreUniqueIndex: true }, options));
            return [qq, uu];
        });
    }
    static afterUpdate(oldDoc, newDocs) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.didUpdateDocument(oldDoc, newDocs);
        });
    }
    static beforeDelete(query, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const q = yield this.willDeleteDocument(query);
            return sanitizeQuery_1.default(this.schema, q);
        });
    }
    static afterDelete(docs) {
        return __awaiter(this, void 0, void 0, function* () {
            if (is_1.default.array(docs)) {
                for (const doc of docs) {
                    if (!is_1.default.directInstanceOf(doc._id, mongodb_1.ObjectID))
                        continue;
                    yield this.cascadeDelete(doc._id);
                }
            }
            else if (!is_1.default.nullOrUndefined(docs) && is_1.default.directInstanceOf(docs._id, mongodb_1.ObjectID)) {
                yield this.cascadeDelete(docs._id);
            }
            yield this.didDeleteDocument(docs);
        });
    }
    static cascadeDelete(docId) {
        return __awaiter(this, void 0, void 0, function* () {
            const cascadeModelNames = this.schema.cascade;
            if (is_1.default.nullOrUndefined(cascadeModelNames))
                return;
            if (!is_1.default.array(cascadeModelNames))
                throw new Error('Invalid definition of cascade in schema');
            for (const modelName of cascadeModelNames) {
                const ModelClass = __1.getModel(modelName);
                const fields = ModelClass.schema.fields;
                assert_1.default(ModelClass, `Trying to cascade delete from model ${modelName} but model is not found`);
                for (const key in ModelClass.schema.fields) {
                    if (!ModelClass.schema.fields.hasOwnProperty(key))
                        continue;
                    const field = fields[key];
                    if (field.ref === this.schema.model) {
                        log(`Cascade deleting all ${modelName} documents whose "${key}" field is ${docId}`);
                        yield ModelClass.deleteMany({ [`${key}`]: docId });
                    }
                }
            }
        });
    }
}
exports.default = Model;
//# sourceMappingURL=Model.js.map