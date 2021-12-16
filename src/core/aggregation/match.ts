import { AnyFilter, AnyProps } from '../../types'
import { sanitizeFilter } from '../../utils'
import prefixed from '../../utils/prefixed'
import Schema from '../Schema'

export type MatchStage = {
  $match: Record<string, any>
}

export type MatchStageFactorySpecs<P> = AnyFilter<P>

export type MatchStageFactoryOptions = {
  /**
   * Prefix to prepend to fields in the `$match` stage specifications.
   */
  toPrefix?: string
}

/**
 * Generates a `$match` stage for a collection to be used in an aggregation pipeline.
 *
 * @param schema - The schema of the database collection.
 * @param specs - The specifications (a.k.a. filter in this case) for the `$match` stage. The value
 *                can be any supported value for `sanitizeFilter`.
 * @param options - Additional options.
 *
 * @returns An abstract aggregation pipeline containing the generated `$match` stage.
 *
 * @example
 * // Returns [{ "$match": { "_id": 5927f337c5178b9665b56b1e } }]
 * matchStageFactory(schema, '5927f337c5178b9665b56b1e')
 *
 * @example
 * // Returns [{ "$match": { "foo._id": 5927f337c5178b9665b56b1e } }]
 * matchStageFactory(schema, '5927f337c5178b9665b56b1e', { toPrefix: 'foo.' })
 *
 * @example
 * // Returns [{ "$match": { "foo._id": 5927f337c5178b9665b56b1e, "foo.bar": 34 } }]
 * matchStageFactory(schema, { _id: 5927f337c5178b9665b56b1e, bar: 34 }, { toPrefix: 'foo.' })
 *
 * @see {@link https://docs.mongodb.com/manual/reference/operator/aggregation/match/}
 */
export function matchStageFactory<P extends AnyProps = AnyProps>(
  schema: Schema<P>,
  specs: MatchStageFactorySpecs<P>, {
    toPrefix = '',
  }: MatchStageFactoryOptions = {},
): [MatchStage] {
  const sanitized = sanitizeFilter(schema, specs, { strict: false })
  const filter: Record<string, any> = {}

  for (const key in sanitized) {
    if (!sanitized.hasOwnProperty(key)) continue
    filter[prefixed(key, toPrefix)] = sanitized[key]
  }

  return [{ $match: filter }]
}
