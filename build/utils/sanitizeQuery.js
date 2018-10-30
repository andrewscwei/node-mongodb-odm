"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const is_1 = __importDefault(require("@sindresorhus/is"));
const mongodb_1 = require("mongodb");
const sanitizeDocument_1 = __importDefault(require("./sanitizeDocument"));
/**
 * Magically transforms any supported value into a valid input for querying db
 * collections. Note that this process does not perform any data validation. The
 * transformation process includes the following:
 *   1. Wraps an ObjectID instance or string representing an ObjectID into a
 *      proper query.
 *   2. If strict mode is enabled, the provided schema will be used to strip out
 *      all extraneous fields from the input. @see sanitizeDocument
 *
 * @param schema - The collection schema.
 * @param query - The query object to sanitize.
 * @param options - @see SanitizeQueryOptions
 *
 * @return The sanitized query.
 *
 * @example
 * // Returns { "_id": 5927f337c5178b9665b56b1e }
 * sanitizeQuery(schema, 5927f337c5178b9665b56b1e)
 * sanitizeQuery(schema, '5927f337c5178b9665b56b1e')
 * sanitizeQuery(schema, { _id: '5927f337c5178b9665b56b1e' })
 *
 * @example
 * // Returns { a: 'b', b: 'c', garbage: 'garbage' }
 * sanitizeQuery(schema, { a: 'b', b: 'c', garbage: 'garbage' }, { strict: false })
 *
 * @example
 * // Returns { a: 'b', b: 'c' }
 * sanitizeQuery(schema, { a: 'b', b: 'c', garbage: 'garbage' })
 * sanitizeQuery(schema, { a: 'b', b: 'c', garbage: 'garbage' }, { strict: true })
 */
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