"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Sanitizes a partial document by removing all extraneous fields from it
 * according to the provided schema.
 *
 * @param schema - The collection schema.
 * @param doc - The partial document to sanitize.
 *
 * @return The sanitized partial document.
 *
 * @example
 * // Returns { a: 'b', b: 'c' }
 * sanitizeDocument(schema, { a: 'b', b: 'c', garbage: 'garbage' })
 */
function sanitizeDocument(schema, doc) {
    const o = {};
    for (const key in doc) {
        if ((schema.timestamps !== true) && (key === 'createdAt'))
            continue;
        if ((schema.timestamps !== true) && (key === 'updatedAt'))
            continue;
        if ((key !== '_id') && !schema.fields.hasOwnProperty(key))
            continue;
        o[key] = doc[key];
    }
    return o;
}
exports.default = sanitizeDocument;
//# sourceMappingURL=sanitizeDocument.js.map