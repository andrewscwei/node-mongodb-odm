"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function sanitizeDocument(schema, doc) {
    const o = {};
    for (const key in doc) {
        if (!schema.timestamps && (key === 'createdAt'))
            continue;
        if (!schema.timestamps && (key === 'updatedAt'))
            continue;
        if ((key !== '_id') && !schema.fields.hasOwnProperty(key))
            continue;
        o[key] = doc[key];
    }
    return o;
}
exports.default = sanitizeDocument;
//# sourceMappingURL=sanitizeDocument.js.map