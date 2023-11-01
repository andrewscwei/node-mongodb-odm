import { ObjectId, type Filter } from 'mongodb'
import { type Schema } from '../core'
import { type AnyFilter, type AnyProps, type Document } from '../types'
import { sanitizeDocument } from './sanitizeDocument'
import { typeIsValidObjectId } from './typeIsValidObjectId'

export type SanitizeFilterOptions = {
  /**
   * If set to `true`, fields that are not specified in the schema will be
   * deleted as part of the sanitizing process.
   */
  strict?: boolean
}

/**
 * Magically transforms any supported value into a valid input for filtering db
 * collections. Note that this process does not perform any data validations.
 * The transformation process includes the following:
 *   1. Wraps an `ObjectId` instance or string representing an `ObjectId` into a
 *      proper filter.
 *   2. If strict mode is enabled, the provided schema will be used to strip out
 *      all extraneous fields from the input. See {@link sanitizeDocument}.
 *
 * @param schema The collection schema.
 * @param filter The filter to sanitize.
 * @param options See {@link SanitizeFilterOptions}
 *
 * @returns The sanitized {@link Filter}.
 *
 * @example
 * // Returns { "_id": 5927f337c5178b9665b56b1e }
 * sanitizeFilter(schema, 5927f337c5178b9665b56b1e)
 * sanitizeFilter(schema, '5927f337c5178b9665b56b1e')
 * sanitizeFilter(schema, { _id: '5927f337c5178b9665b56b1e' })
 *
 * @example
 * // Returns { a: 'b', b: 'c', garbage: 'garbage' }
 * sanitizeFilter(schema, { a: 'b', b: 'c', garbage: 'garbage' }, { strict: false })
 *
 * @example
 * // Returns { a: 'b', b: 'c' }
 * sanitizeFilter(schema, { a: 'b', b: 'c', garbage: 'garbage' })
 * sanitizeFilter(schema, { a: 'b', b: 'c', garbage: 'garbage' }, { strict: true })
 */
export function sanitizeFilter<P extends AnyProps = AnyProps>(schema: Schema<P>, filter: AnyFilter<P>, { strict = true }: SanitizeFilterOptions = {}): Filter<Document<P>> {
  if (typeIsValidObjectId(filter)) {
    return { _id: filter } as Filter<Document<P>>
  }
  else if (typeof filter === 'string') {
    return { _id: new ObjectId(filter) } as Filter<Document<P>>
  }
  else if (strict) {
    return sanitizeDocument(schema, filter, { accountForDotNotation: true }) as Filter<Document<P>>
  }
  else {
    return filter
  }
}
