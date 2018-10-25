"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const mongodb_1 = require("mongodb");
const sanitizeQuery_1 = __importDefault(require("../../utils/sanitizeQuery"));
const Baz_1 = __importDefault(require("../models/Baz"));
mocha_1.describe('utils/sanitizeQuery', () => {
    mocha_1.it('can generate valid queries based on an Object ID string', () => {
        const objectId = new mongodb_1.ObjectID();
        const actual = sanitizeQuery_1.default(Baz_1.default.schema, objectId.toHexString());
        const expected = { _id: objectId };
        assert_1.default.deepStrictEqual(Object.keys(actual), Object.keys(expected));
        assert_1.default(expected._id.equals(actual._id));
    });
    mocha_1.it('can generate valid queries based on an Object ID', () => {
        const objectId = new mongodb_1.ObjectID();
        const actual = sanitizeQuery_1.default(Baz_1.default.schema, objectId);
        const expected = { _id: objectId };
        assert_1.default.deepStrictEqual(Object.keys(actual), Object.keys(expected));
        assert_1.default(expected._id.equals(actual._id));
    });
    mocha_1.it('can generate valid queries removing extraneous fields', () => {
        const objectId = new mongodb_1.ObjectID();
        const expected = {
            _id: objectId,
            aString: 'baz',
        };
        const actual = sanitizeQuery_1.default(Baz_1.default.schema, Object.assign({}, expected, { anExtraneousField: 'baz' }));
        assert_1.default.deepStrictEqual(Object.keys(actual), Object.keys(expected));
    });
    mocha_1.it('can generate valid queries while keeping extraneous fields', () => {
        const objectId = new mongodb_1.ObjectID();
        const expected = {
            _id: objectId,
            aString: 'baz',
        };
        const actual = sanitizeQuery_1.default(Baz_1.default.schema, Object.assign({}, expected, { anExtraneousField: 'baz' }), {
            strict: false,
        });
        assert_1.default(actual.anExtraneousField === 'baz');
    });
});
//# sourceMappingURL=sanitizeQuery.spec.js.map