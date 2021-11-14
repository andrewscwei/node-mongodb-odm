import _ from 'lodash'
import { Filter, ObjectId } from 'mongodb'
import Schema from '../core/Schema'
import { AnyFilter, AnyProps, Document, DocumentFragment } from '../types'
import sanitizeDocument from './sanitizeDocument'
import typeIsValidObjectId from './typeIsValidObjectId'

export type SanitizeFilterOptions = {
  /**
   * If set to `true`, fields that are not specified in the schema will be deleted as part of the
   * sanitizing process.
   */
  strict?: boolean
}

/**
 * Magically transforms any supported value into a valid input for filtering db collections. Note
 * that this process does not perform any data validations. The transformation process includes the
 * following:
 *   1. Wraps an `ObjectId` instance or string representing an `ObjectId` into a proper filter.
 *   2. If strict mode is enabled, the provided schema will be used to strip out all extraneous
 *      fields from the input. @see sanitizeDocument
 *
 * @param schema - The collection schema.
 * @param filter - The filter to sanitize.
 * @param options - @see SanitizeFilterOptions
 *
 * @returns The sanitized filter.
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
export default function sanitizeFilter<P extends AnyProps = AnyProps>(schema: Schema<P>, filter: AnyFilter<P>, { strict = true }: SanitizeFilterOptions = {}): Filter<Document<P>> {
  if (typeIsValidObjectId(filter)) {
    return { _id: filter }
  }
  else if (_.isString(filter)) {
    return { _id: new ObjectId(filter) }
  }
  else if (strict) {
    return sanitizeDocument<P>(schema, filter as DocumentFragment<P>, { accountForDotNotation: true })
  }
  else {
    return filter
  }
}
