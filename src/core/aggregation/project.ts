import _ from 'lodash'
import { AggregationPipeline, AggregationStageDescriptor } from '.'
import * as db from '../..'
import { AnyProps } from '../../types'
import Schema, { FieldDescriptor } from '../Schema'

export interface ProjectStageFactoryOptions {
  /**
   * Prefix for current attributes.
   */
  toPrefix?: string

  /**
   * Prefix for target attributes after project.
   */
  fromPrefix?: string

  /**
   * An object containing key/value pairs representing a field belonging to this model that is a
   * reference (aka foreign key) pointing to another model. The keys equate the name of the field
   * while the values equate the `options` parameter for the reference models `project()` method.
   * The values can also just be `true` to omit passing an `options` parameter.
   */
  populate?: ProjectStageFactoryOptionsPopulate

  /**
   * Schema fields to exclude.
   */
  exclude?: string[]
}

export interface ProjectStageFactoryOptionsPopulate {
  [modelName: string]: boolean | ProjectStageFactoryOptionsPopulate
}

/**
 * Generates the `$project` stage of the aggregation pipeline.
 *
 * @param schema - The schema of the database collection.
 * @param options - Additional options.
 *
 * @returns The aggregation pipeline that handles the generated `$project` stage.
 *
 * @example
 * // Returns [{ "$project": { "_id": "_id", "a": "a", "b": "b", "c": "c", "model": "model" } }]
 * project(schema)
 *
 * @example
 * // Returns [{ "$project": { "foo._id": "bar._id", "foo.a": "bar.a", "foo.b": "bar.b", "foo.c": "bar.c", "foo.model": model.project()[0]["$project"] } }]
 * project(schema, { populate: { 'model': true }, fromPrefix: 'foo.', toPrefix: 'bar.' })
 *
 * @example
 * // Returns [{ "$project": { "_id": "_id", "a": "a", "b": "b", "c": "c", "model": model.project({ "x": "x", "y": "y" })[0]["$project"] } }]
 * project(schema, { populate: { 'model': { 'x': 'x', 'y': 'y' } } })
 *
 * @example
 * // Returns [{ "$project": { "_id": "_id", "b": "b", "c": "c" } }]
 * project(schema, { exclude: ['a', 'model'] })
 *
 * @see {@link https://docs.mongodb.com/manual/reference/operator/aggregation/project/}
 */
export function projectStageFactory<P extends AnyProps = AnyProps>(schema: Schema<P>, { toPrefix = '', fromPrefix = '', populate = {}, exclude = [] }: ProjectStageFactoryOptions = {}): AggregationPipeline {
  const fields: { [fieldName: string]: FieldDescriptor} = schema.fields
  const out: { [key: string]: any } = { [`${toPrefix}_id`]: `$${fromPrefix}_id` }
  for (const key in fields) {
    if (!schema.fields.hasOwnProperty(key)) continue
    if (exclude.indexOf(key) > -1) continue
    const populateOpts = populate[key]
    if (populateOpts === false) continue
    const populateRef = fields[key].ref
    const populateSchema = (!_.isNil(populateOpts) && !_.isNil(populateRef)) ? db.getModel(populateRef).schema : undefined
    out[`${toPrefix}${key}`] = _.isNil(populateSchema) ? `$${fromPrefix}${key}` : (projectStageFactory(populateSchema, populateOpts === true ? undefined : populateOpts) as AggregationStageDescriptor[])[0]['$project']
  }
  if (schema.timestamps) {
    if (exclude.indexOf('updatedAt') < 0) out[`${toPrefix}updatedAt`] = `$${fromPrefix}updatedAt`
    if (exclude.indexOf('createdAt') < 0) out[`${toPrefix}createdAt`] = `$${fromPrefix}createdAt`
  }
  return [{ $project: out }]
}
