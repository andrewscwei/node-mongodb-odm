import is from '@sindresorhus/is';
import { ObjectID } from 'mongodb';
import { Document, Query, Schema } from '../types';
import sanitizeDocument from './sanitizeDocument';

/**
 * Options for sanitizeQuery().
 */
interface SanitizeQueryOptions {
  /**
   * If set to `true`, fields that are not specified in the schema will be
   * deleted as part of the sanitizing process.
   */
  strict?: boolean;
}

/**
 * Magically transforms any supported value into a valid input for querying db
 * collections. Note that this process does not perform any data validation. The
 * transformation process includes the following:
 *   1. Wraps an ObjectID instance or string representing an ObjectID into a
 *      proper query.
 *   2. If strict mode is enabled, the provided schema will be used to strip out
 *      all extraneous fields from the input.
 *
 * @param schema - The collection schema.
 * @param query - The input query to sanitize.
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
export default function sanitizeQuery<T extends Document = Document>(schema: Schema, query: Query<T>, { strict = true }: SanitizeQueryOptions = {}): Partial<T> {
  if (is.directInstanceOf(query, ObjectID)) {
    return { _id: query } as Partial<T>;
  }
  else if (is.string(query)) {
    return { _id: new ObjectID(query) } as Partial<T>;
  }
  else if (strict) {
    return sanitizeDocument<T>(schema, query);
  }
  else {
    return query as Partial<T>;
  }
}
