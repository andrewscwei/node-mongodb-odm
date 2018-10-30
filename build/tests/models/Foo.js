"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("mongodb");
const Model_1 = __importDefault(require("../../core/Model"));
exports.FooSchema = {
    model: 'Foo',
    collection: 'foos',
    timestamps: true,
    fields: {
        aString: {
            type: String,
            required: true,
            format: (value) => (value.trim()),
        },
        aNumber: {
            type: Number,
            required: true,
            default: 100,
            validate: (value) => ((value >= 0 && value <= 1000)),
            random: () => (Math.floor(Math.random() * 1000) + 0),
        },
        aBar: {
            type: mongodb_1.ObjectID,
            ref: 'Bar',
            required: true,
        },
        aFoo: {
            type: mongodb_1.ObjectID,
            ref: 'Foo',
        },
    },
    indexes: [{
            spec: { aString: 1 }, options: { unique: true },
        }],
};
class Foo extends Model_1.default {
}
Foo.schema = exports.FooSchema;
exports.default = Foo;
//# sourceMappingURL=Foo.js.map