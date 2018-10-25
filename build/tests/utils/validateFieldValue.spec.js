"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const mongodb_1 = require("mongodb");
const validateFieldValue_1 = __importDefault(require("../../utils/validateFieldValue"));
mocha_1.describe('utils/validate', () => {
    mocha_1.it('can validate string length', () => {
        const i = 'Hello, world!';
        assert_1.default(validateFieldValue_1.default(i, { type: String, validate: 13 }) === true);
        assert_1.default(validateFieldValue_1.default(i, { type: String, validate: 12 }) === false);
    });
    mocha_1.it('can validate string regex', () => {
        const i = 'Hello, world!';
        assert_1.default(validateFieldValue_1.default(i, { type: String, validate: /^Hello.*$/ }) === true);
        assert_1.default(validateFieldValue_1.default(i, { type: String, validate: /^hello.*$/ }) === false);
    });
    mocha_1.it('can validate string from list', () => {
        const i = 'Hello, world!';
        assert_1.default(validateFieldValue_1.default(i, { type: String, validate: [i] }) === true);
        assert_1.default(validateFieldValue_1.default(i, { type: String, validate: [] }) === false);
    });
    mocha_1.it('can validate string with custom method', () => {
        const i = 'Hello, world!';
        assert_1.default(validateFieldValue_1.default(i, { type: String, validate: (v) => (v === i) }) === true);
        assert_1.default(validateFieldValue_1.default(i, { type: String, validate: (v) => (v !== i) }) === false);
    });
    mocha_1.it('can validate numbers with inclusive maximum', () => {
        const i = 6;
        assert_1.default(validateFieldValue_1.default(i, { type: Number, validate: 6 }) === true);
        assert_1.default(validateFieldValue_1.default(i, { type: Number, validate: 5 }) === false);
    });
    mocha_1.it('can validate numbers from list', () => {
        const i = 6;
        assert_1.default(validateFieldValue_1.default(i, { type: Number, validate: [6] }) === true);
        assert_1.default(validateFieldValue_1.default(i, { type: Number, validate: [] }) === false);
    });
    mocha_1.it('can validate numbers from custom method', () => {
        const i = 6;
        assert_1.default(validateFieldValue_1.default(i, { type: Number, validate: (v) => (v > 5 && v < 7) }) === true);
        assert_1.default(validateFieldValue_1.default(i, { type: Number, validate: (v) => (v < 5) }) === false);
    });
    mocha_1.it('can validate booleans', () => {
        const i = true;
        assert_1.default(validateFieldValue_1.default(i, { type: Boolean }) === true);
    });
    mocha_1.it('can validate dates', () => {
        const i = new Date();
        assert_1.default(validateFieldValue_1.default(i, { type: Date }) === true);
    });
    mocha_1.it('can validate arrays', () => {
        assert_1.default(validateFieldValue_1.default([0, 1, 2, 3], { type: [Number] }) === true);
        assert_1.default(validateFieldValue_1.default([0, false, 2, 3], { type: [Number] }) === false);
    });
    mocha_1.it('can validate objects', () => {
        assert_1.default(validateFieldValue_1.default({ a: 'foo', b: 0 }, { type: { a: { type: String }, b: { type: Number } } }) === true);
        assert_1.default(validateFieldValue_1.default({ a: 'foo', b: { c: true, d: [0, 1, 2, 3] } }, { type: { a: { type: String }, b: { type: { c: { type: Boolean }, d: { type: [Number] } } } } }) === true);
    });
    mocha_1.it('can validate ObjectIDs', () => {
        const i = new mongodb_1.ObjectID();
        assert_1.default(validateFieldValue_1.default(i, { type: mongodb_1.ObjectID }) === true);
    });
});
//# sourceMappingURL=validateFieldValue.spec.js.map