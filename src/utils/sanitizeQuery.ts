import _ from 'lodash';
import { ObjectID } from 'mongodb';
import { Query, Schema, typeIsValidObjectID, DocumentFragment } from '../types';
import sanitizeDocument from './sanitizeDocument';

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
 *      all extraneous fields from the input. @see sanitizeDocument
 *
 * @param schema - The collection schema.
 * @param query - The query object to sanitize.
 * @param options - @see SanitizeQueryOptions
 *
 * @returns The sanitized query.
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
export default function sanitizeQuery<T = {}>(schema: Schema, query: Query, { strict = true }: SanitizeQueryOptions = {}): { [key: string]: any } {
  if (typeIsValidObjectID(query)) {
    return { _id: query };
  }
  else if (_.isString(query)) {
    return { _id: new ObjectID(query) };
  }
  else if (strict) {
    return sanitizeDocument<T>(schema, query as DocumentFragment<T>, { accountForDotNotation: true });
  }
  else {
    return query;
  }
}
