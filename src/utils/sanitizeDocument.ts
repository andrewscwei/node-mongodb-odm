import { type Schema } from '../core/index.js'
import { type AnyDocumentFragment, type AnyProps, type DocumentFragment } from '../types/index.js'
import { getFieldSpecByKey } from './getFieldSpecByKey.js'

export type SanitizeDocumentOptions = {
  /**
   * If set to `true`, fields in the form of a dot delimited string will be
   * treated as nested fields.
   */
  accountForDotNotation?: boolean
}

/**
 * Removes all extraneous fields from a document fragment according to the
 * provided schema.
 *
 * @param schema The collection schema.
 * @param doc The partial document to sanitize.
 * @param options @see {@link SanitizeDocumentOptions}
 *
 * @returns The sanitized partial document.
 *
 * @example
 * // Returns { a: 'b', b: 'c' }
 * sanitizeDocument(schema, { a: 'b', b: 'c', garbage: 'garbage' })
 */
export function sanitizeDocument<P extends AnyProps = AnyProps>(schema: Schema<P>, doc: AnyDocumentFragment, { accountForDotNotation = false }: SanitizeDocumentOptions = {}): DocumentFragment<P> {
  const o: DocumentFragment<P> = {}

  for (const key in doc) {
    // Ignore timestamp fields if timestamps aren't enabled in the schema.
    if (schema.timestamps !== true && key === 'createdAt') continue
    if (schema.timestamps !== true && key === 'updatedAt') continue

    // Ignore fields that don't exist in the schema with/without dot notation enabled.
    if (key !== '_id' && !(schema.timestamps === true && (key === 'createdAt' || key === 'updatedAt')) && !accountForDotNotation && !{}.hasOwnProperty.call(schema.fields, key)) continue
    if (key !== '_id' && !(schema.timestamps === true && (key === 'createdAt' || key === 'updatedAt')) && accountForDotNotation && !getFieldSpecByKey(schema.fields, key)) continue

    // Ignore fields with `undefined` or `null` values.
    if (doc[key] === undefined || doc[key] === null) continue

    o[key as keyof P] = doc[key]
  }

  return o
}
