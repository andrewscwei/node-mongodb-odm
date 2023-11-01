import _ from 'lodash'
import { type AnyProps } from '../../types'
import { type Schema } from '../Schema'

export type GroupStage = {
  $group: Record<string, any>
}

/**
 * Specs that define the `$group` stage. If this is a string, a simple `$group`
 * stage will be generated with `_id` set to the string.
 */
export type GroupStageFactorySpecs = string | Record<string, any>

/**
 * Generates a `$group` stage for a collection to be used in an aggregation
 * pipeline.
 *
 * @param schema - The schema of the database collection.
 * @param specs - Spec that define the `$group` stage.
 *
 * @returns An abstract aggregation pipeline containing the generated `$group`
 * stage.
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
export function groupStageFactory<P extends AnyProps = AnyProps>(
  schema: Schema<P>,
  specs: GroupStageFactorySpecs,
): [GroupStage] {
  if (_.isString(specs)) {
    return [{ $group: { _id: `$${specs}` } }]
  }
  else {
    return [{ $group: specs }]
  }
}
