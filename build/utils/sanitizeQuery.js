"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const is_1 = __importDefault(require("@sindresorhus/is"));
const mongodb_1 = require("mongodb");
const sanitizeDocument_1 = __importDefault(require("./sanitizeDocument"));
function sanitizeQuery(schema, query, { strict = true } = {}) {
    if (is_1.default.directInstanceOf(query, mongodb_1.ObjectID)) {
        return { _id: query };
    }
    else if (is_1.default.string(query)) {
        return { _id: new mongodb_1.ObjectID(query) };
    }
    else if (strict) {
        return sanitizeDocument_1.default(schema, query);
    }
    else {
        return query;
    }
}
exports.default = sanitizeQuery;
//# sourceMappingURL=sanitizeQuery.js.map