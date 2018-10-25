"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const faker_1 = __importDefault(require("faker"));
const Model_1 = __importDefault(require("../../core/Model"));
exports.BazSchema = {
    model: 'Baz',
    collection: 'bazs',
    fields: {
        aString: { type: String, required: true, random: () => faker_1.default.random.alphaNumeric(10) },
        aNumber: { type: Number, default: () => faker_1.default.random.number() },
        aBoolean: { type: Boolean, default: true },
        aFormattedString: { type: String, format: (v) => v.toUpperCase() },
        anEncryptedString: { type: String, encrypted: true },
    },
    indexes: [{
            spec: { aString: 1 },
        }],
};
class Baz extends Model_1.default {
}
Baz.schema = exports.BazSchema;
exports.default = Baz;
//# sourceMappingURL=Baz.js.map