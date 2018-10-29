import { DocumentFragment, FieldValue, Schema } from '../types';

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
export default function sanitizeDocument<T = {}>(schema: Schema, doc: { [field: string]: FieldValue }): DocumentFragment<T> {
  const o: DocumentFragment<T> = {};

  for (const key in doc) {
    if ((schema.timestamps !== true) && (key === 'createdAt')) continue;
    if ((schema.timestamps !== true) && (key === 'updatedAt')) continue;
    if ((key !== '_id') && !schema.fields.hasOwnProperty(key)) continue;

    o[key as keyof T] = doc[key];
  }

  return o;
}
