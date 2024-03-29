import { type AnyFilter, type AnyProps } from '../../types/index.js'
import { prefixed, sanitizeFilter } from '../../utils/index.js'
import { type Schema } from '../Schema.js'

export type MatchStage = {
  $match: Record<string, any>
}

export type MatchStageFactorySpecs<P extends AnyProps> = AnyFilter<P>

export type MatchStageFactoryOptions = {
  /**
   * Prefix to prepend to fields in the `$match` stage specifications.
   */
  toPrefix?: string
}

/**
 * Generates a `$match` stage for a collection to be used in an aggregation
 * pipeline.
 *
 * @param schema The schema of the database collection.
 * @param specs The specifications (a.k.a. filter in this case) for the
 *              `$match` stage. The value can be any supported value for
 *              `sanitizeFilter`.
 * @param options Additional options, see {@link MatchStageFactoryOptions}.
 *
 * @returns An abstract aggregation pipeline containing the generated `$match`
 * stage.
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
    if (!{}.hasOwnProperty.call(sanitized, key)) continue
    filter[prefixed(key, toPrefix)] = sanitized[key]
  }

  return [{ $match: filter }]
}
