import { AggregationPipeline } from '.'
import { AnyFilter, AnyProps } from '../../types'
import { sanitizeFilter } from '../../utils'
import Schema from '../Schema'

export type MatchStageFactorySpec<P> = AnyFilter<P>

export type MatchStageFactoryOptions = {
  prefix?: string
}

/**
 * Generates the `$match` stage of the aggregation pipeline.
 *
 * @param schema - The schema of the database collection.
 * @param spec - Spec (aka filter in this case) that defines the match.
 * @param options - Additional options.
 *
 * @returns The aggregation pipeline that handles the generated `$match` stage.
 *
 * @example
 * // Returns [{ "$match": { "_id": 5927f337c5178b9665b56b1e } }]
 * matchStageFactory(schema, '5927f337c5178b9665b56b1e')
 *
 * @example
 * // Returns [{ "$match": { "foo._id": 5927f337c5178b9665b56b1e } }]
 * matchStageFactory(schema, '5927f337c5178b9665b56b1e', { prefix: 'foo.' })
 *
 * @example
 * // Returns [{ "$match": { "foo._id": 5927f337c5178b9665b56b1e, "foo.bar": 34 } }]
 * matchStageFactory(schema, { _id: 5927f337c5178b9665b56b1e, bar: 34 }, { prefix: 'foo.' })
 *
 * @see {@link https://docs.mongodb.com/manual/reference/operator/aggregation/match/}
 */
export function matchStageFactory<P extends AnyProps = AnyProps>(schema: Schema<P>, spec: MatchStageFactorySpec<P>, { prefix = '' }: MatchStageFactoryOptions = {}): AggregationPipeline {
  const sanitized = sanitizeFilter(schema, spec, { strict: false })
  const filter: { [key: string]: any } = {}

  for (const key in sanitized) {
    if (!sanitized.hasOwnProperty(key)) continue
    filter[`${prefix}${key}`] = (sanitized as any)[key as keyof P]
  }

  return [{ $match: filter }]
}
