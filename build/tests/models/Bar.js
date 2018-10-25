"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("mongodb");
const Model_1 = __importDefault(require("../../core/Model"));
exports.BarSchema = {
    model: 'Bar',
    collection: 'bars',
    cascade: ['Foo'],
    fields: {
        aBar: {
            type: mongodb_1.ObjectID,
            ref: 'Bar',
            required: true,
        },
        aString: {
            type: String,
            required: true,
            validate: 100,
        },
        aDate: {
            type: Date,
            required: true,
            default: () => (new Date()),
        },
        anObject: {
            type: {
                aString: { type: String },
                aNumber: { type: Number },
                aBoolean: { type: Boolean },
            },
        },
        aNumber: {
            type: Number,
            required: true,
            default: 100,
            validate: (value) => ((value >= 0 && value <= 1000)),
            random: () => (Math.floor(Math.random() * 1000) + 0),
        },
        aBoolean: {
            type: Boolean,
            default: false,
        },
    },
    indexes: [{ spec: { source: 1 } }, { spec: { geo: '2dsphere' } }],
};
class Bar extends Model_1.default {
}
Bar.schema = exports.BarSchema;
exports.default = Bar;
//# sourceMappingURL=Bar.js.map