import is from '@sindresorhus/is';
import { DocumentFragment, Schema } from '../types';
import getFieldSpecByKey from './getFieldSpecByKey';

interface SanitizeDocumentOptions {
  /**
   * If set to `true`, fields in dot notated format will be further investigated
   * to account for fields in embedded docs.
   */
  accountForDotNotation?: boolean;
}

/**
 * Sanitizes a partial document by removing all extraneous fields from it
 * according to the provided schema.
 *
 * @param schema - The collection schema.
 * @param doc - The partial document to sanitize.
 * @param options - @see SanitizeDocumentOptions
 *
 * @returns The sanitized partial document.
 *
 * @example
 * // Returns { a: 'b', b: 'c' }
 * sanitizeDocument(schema, { a: 'b', b: 'c', garbage: 'garbage' })
 */
export default function sanitizeDocument<T = {}>(schema: Schema, doc: DocumentFragment, { accountForDotNotation = false }: SanitizeDocumentOptions = {}): DocumentFragment<T> {
  const o: DocumentFragment<T> = {};

  for (const key in doc) {
    // Ignore timestamp fields if timestamps aren't enabled in the schema.
    if ((schema.timestamps !== true) && (key === 'createdAt')) continue;
    if ((schema.timestamps !== true) && (key === 'updatedAt')) continue;

    // Ignore fields that don't exist in the schema with/without dot notation
    // enabled.
    if ((key !== '_id') && !accountForDotNotation && !schema.fields.hasOwnProperty(key)) continue;
    if ((key !== '_id') && accountForDotNotation && !getFieldSpecByKey(schema.fields, key)) continue;

    // Ignore fields with `undefined` or `null` values.
    if (is.nullOrUndefined((doc as any)[key])) continue;

    o[key as keyof T] = (doc as any)[key];
  }

  return o;
}
