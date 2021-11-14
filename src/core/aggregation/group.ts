import _ from 'lodash'
import { AggregationPipeline } from '.'
import { AnyProps } from '../../types'
import Schema from '../Schema'

/**
 * Spec that define the `$group` stage. If this is a string, a simple `$group` stage will be
 * generated with `_id` equal this string.
 */
export type GroupStageFactorySpec = string | { [key: string]: any }

/**
 * Generates the `$group` stage of the aggregation pipeline.
 *
 * @param schema - The schema of the database collection.
 * @param spec - Spec that define the `$group` stage.
 *
 * @returns The aggregation pipeline that handles the generated `$group` stage.
 *
 * @example
 * // Returns [{ "$group": { "_id": "$foo" } }]
 * groupStageFactory(schema, 'foo')
 *
 * @example
 * // Returns [{ "$group": { "_id": "$subModel", "bar": "$bar" } }]
 * groupStageFactory(schema, { "_id": "$subModel", "bar": "$bar" })
 *
 * @see {@link https://docs.mongodb.com/manual/reference/operator/aggregation/group/}
 */
export function groupStageFactory<P extends AnyProps = AnyProps>(schema: Schema<P>, spec: GroupStageFactorySpec): AggregationPipeline {
  const pipe: AggregationPipeline = []

  if (_.isString(spec)) {
    pipe.push({ $group: { _id: `$${spec}` } })
  }
  else {
    pipe.push({ $group: spec })
  }

  return pipe
}
