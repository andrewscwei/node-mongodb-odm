import { Document, Schema } from '../types';

/**
 * Remove all extraneous fields from a document.
 *
 * @param schema - The collection schema.
 * @param doc - The document to sanitize.
 *
 * @return The sanitized document.
 *
 * @example
 * // Returns { a: 'b', b: 'c' }
 * sanitizeDocument(schema, { a: 'b', b: 'c', garbage: 'garbage' })
 */
export default function sanitizeDocument<T extends Document = Document>(schema: Schema, doc: Partial<T> | { [key: string]: any }): Partial<T> {
  const o: Partial<T> = {};

  for (const key in doc) {
    if (!schema.timestamps && (key === 'createdAt')) continue;
    if (!schema.timestamps && (key === 'updatedAt')) continue;

    if ((key !== '_id') && !schema.fields.hasOwnProperty(key)) continue;

    o[key] = doc[key];
  }

  return o;
}