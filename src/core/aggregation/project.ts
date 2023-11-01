import * as db from '../..'
import { type AnyProps } from '../../types'
import { fieldPath, prefixed } from '../../utils'
import { type Schema } from '../Schema'

export type ProjectStageFactorySpecs = Record<string, any>

export type ProjectStage = {
  $project: Record<string, any>
}

/**
 * Options for {@link projectStageFactory}. Note that these options are only
 * used if auto projecting all fields, i.e. `specs` parameter is `undefined`.
 */
export type ProjectStageFactoryOptions = {
  /**
   * Prefix for current field paths.
   */
  fromPrefix?: string

  /**
   * Prefix for new field paths as a result of the `$project` stage.
   */
  toPrefix?: string

  /**
   * An object specifying how reference fields in this collection pointing to
   * other collections are populated. Each key represents a reference field
   * (i.e. a field with a `ref` property) while each corresponding value
   * represents the {@link ProjectStageFactoryPopulateOptions} to be used in the
   * {@link projectStageFactory} method of the target field, or a boolean where:
   * if `true`, the target field will not be further projected (i.e. `options`
   * param will be omitted when generating its `$project` stage via
   * {@link projectStageFactory} method), and if `false`, the reference field
   * will simply be ignored.
   */
  populate?: ProjectStageFactoryPopulateOptions

  /**
   * Fields to exclude.
   */
  exclude?: string[]
}

type ProjectStageFactoryPopulateOptions = {
  [modelName: string]: boolean | ProjectStageFactoryPopulateOptions
}

/**
 * Generates a `$project` stage for a collection to be used in an aggregation
 * pipeline.
 *
 * @param schema The schema of the collection.
 * @param specs The specifications for the `$project` stage. Set as
 *              `undefined` to project all fields defined in the schema.
 * @param options Additional options, {@link ProjectStageFactoryOptions}.
 *
 * @returns An abstract aggregation pipeline containing the generated `$project`
 * stage.
 *
 * @example
 * // Returns [{ "$project": { "_id": "_id", "a": "a", "b": "b", "c": "c", "model": "model" } }]
 * project(schema)
 *
 * @example
 * // Returns [{ "$project": { "foo._id": "bar._id", "foo.a": "bar.a", "foo.b": "bar.b", "foo.c": "bar.c", "foo.model": model.project()[0]["$project"] } }]
 * project(schema, undefined, { populate: { 'model': true }, fromPrefix: 'foo.', toPrefix: 'bar.' })
 *
 * @example
 * // Returns [{ "$project": { "_id": "_id", "a": "a", "b": "b", "c": "c", "model": model.project({ "x": "x", "y": "y" })[0]["$project"] } }]
 * project(schema, undefined, { populate: { 'model': { 'x': 'x', 'y': 'y' } } })
 *
 * @example
 * // Returns [{ "$project": { "_id": "_id", "b": "b", "c": "c" } }]
 * project(schema, undefined, { exclude: ['a', 'model'] })
 *
 * @see {@link https://docs.mongodb.com/manual/reference/operator/aggregation/project/}
 */
export function projectStageFactory<P extends AnyProps = AnyProps>(
  schema: Schema<P>,
  specs?: ProjectStageFactorySpecs,
  {
    exclude = [],
    fromPrefix = '',
    populate = {},
    toPrefix = '',
  }: ProjectStageFactoryOptions = {},
): [ProjectStage] {
  if (specs !== undefined) {
    return [{ $project: specs }]
  }
  else {
    const fields = schema.fields
    const out: Record<string, any> = {}

    // Project `_id` unless explicitly excluded.
    if (exclude.indexOf('_id') < 0) {
      out[prefixed('_id', toPrefix)] = fieldPath('_id', fromPrefix)
    }

    // Project each field defined in the schema as required by options.
    for (const key in fields) {
      if (!{}.hasOwnProperty.call(schema.fields, key)) continue
      if (exclude.indexOf(key) > -1) continue

      // Project reference fields (a.k.a. foreign keys) if applicable.
      const populateOpts = populate[key]
      if (populateOpts === false) continue

      const targetModel = fields[key].ref
      const targetSchema = (populateOpts !== undefined && populateOpts !== null) && (targetModel !== undefined && targetModel !== null) ? db.getModel(targetModel).schema : undefined

      if (targetSchema === undefined || targetSchema === null) {
        out[prefixed(key, toPrefix)] = fieldPath(key, fromPrefix)
      }
      else {
        const targetProjectStage = projectStageFactory(targetSchema, undefined, populateOpts === true ? undefined : populateOpts)
        out[prefixed(key, toPrefix)] = targetProjectStage[0].$project
      }
    }

    // Project timestamps if applicable.
    if (schema.timestamps) {
      if (exclude.indexOf('updatedAt') < 0) out[prefixed('updatedAt', toPrefix)] = fieldPath('updatedAt', fromPrefix)
      if (exclude.indexOf('createdAt') < 0) out[prefixed('createdAt', toPrefix)] = fieldPath('createdAt', fromPrefix)
    }

    return [{ $project: out }]
  }
}
