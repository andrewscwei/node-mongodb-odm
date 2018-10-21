import is from '@sindresorhus/is';
import assert from 'assert';
import { ObjectID } from 'mongodb';
import { Query } from '../types/Query';
import Schema from '../types/Schema';

/**
 * Options for querify().
 */
export interface QuerifyOptions {
  // If set to `true`, fields that are not specified in the schema will be
  // deleted as part of the querifying process.
  strict: boolean;
}

export interface QuerifyOutput {
  [key: string]: any;
}

/**
 * Magically transforms any supported value into a valid input for querying db
 * collections. Note that this only handles generating a valid query. It does
 * not apply validation. The transformation process includes the following:
 *   1. Wraps an Object ID into a proper query.
 *   2. If strict mode is enabled, the provided schema will be used to strip out
 *      all extraneous fields from the input
 *   3. Performs a deep JSON parse of the value to undo any stringification,
 *      i.e. `'6'` becomes `6`.
 *
 * @param schema - The collection schema.
 * @param query - The input query to normalize.
 * @param options - Additional options.
 *
 * @return The normalized query.
 *
 * @example
 * // Returns { "_id": 5927f337c5178b9665b56b1e }
 * querify(schema, 5927f337c5178b9665b56b1e)
 * querify(schema, '5927f337c5178b9665b56b1e')
 * querify(schema, { _id: '5927f337c5178b9665b56b1e' })
 *
 * @example
 * // Returns { a: 'b', b: 'c', garbage: 'garbage' }
 * querify(schema, { a: 'b', b: 'c', garbage: 'garbage' }, { strict: false })
 *
 * @example
 * // Returns { a: 'b', b: 'c' }
 * querify(schema, { a: 'b', b: 'c', garbage: 'garbage' })
 * querify(schema, { a: 'b', b: 'c', garbage: 'garbage' }, { strict: true })
 */
export default function querify(schema: Schema, query: Query, options: QuerifyOptions = { strict: true }): QuerifyOutput {
  // If argument is an ObjectID, wrap it in a proper query.
  if (ObjectID.isValid(query as any)) return { _id: (new ObjectID(query as any)).toHexString() };

  assert(is.object(query), new TypeError('`query` is expected to be an object'));

  const output = query as { [key: string]: any };

  // In strict mode, delete keys that are not in the schema. Ignore `_id`,
  // `createdAt`, and `updatedAt` fields because they are automatically
  // generated.
  if (options.strict) {
    for (const key in output) {
      if (key === '_id') continue;
      if (schema.timestamps && (key === 'createdAt')) continue;
      if (schema.timestamps && (key === 'updatedAt')) continue;
      if (schema.fields.hasOwnProperty(key)) continue;

      delete output[key];
    }
  }

  return output;
}
