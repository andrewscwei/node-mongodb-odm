import { AggregationPipeline } from '.'
import Schema from '../Schema'

export interface SortStageFactorySpec {
  [key: string]: any
}

/**
 * Generates the $sort stage of the aggregation pipeline.
 *
 * @param schema - The schema of the database collection.
 * @param spec - Spec that define the $sort stage.
 *
 * @returns The aggregation pipeline that handles the generated $sort stage.
 *
 * @example
 * // Returns [{ "$sort": { "a": 1, "b": -1 } }]
 * sort(schema, { a: 1, b: -1 })
 *
 * @see {@link https://docs.mongodb.com/manual/reference/operator/aggregation/sort/}
 */
export function sortStageFactory<T>(schema: Schema<T>, spec: SortStageFactorySpec): AggregationPipeline {
  const pipe: AggregationPipeline = []
  pipe.push({ $sort: spec })

  return pipe
}
