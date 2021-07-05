/**
 * @file Static utility class with helper functions for MongoDB's aggregation framework.
 */

import _ from 'lodash'
import * as db from '..'
import { AggregationPipeline, AggregationStageDescriptor, FieldSpec, GroupStageFactorySpec, LookupStageFactoryOptions, LookupStageFactorySpec, MatchStageFactoryOptions, MatchStageFactorySpec, PipelineFactoryOperators, PipelineFactoryOptions, ProjectStageFactoryOptions, Schema, SortStageFactorySpec } from '../types'
import sanitizeQuery from '../utils/sanitizeQuery'

export default abstract class Aggregation {
  /**
   * Generates a pipeline to pass into the aggregation framework.
   *
   * @param schema - The collection schema.
   * @param operators - @see PipelineFactoryOperators
   * @param options - @see PipelineFactoryOptions
   *
   * @returns The generated aggregate pipeline.
   *
   * @throws {TypeError} Invalid params or options provided.
   */
  static pipelineFactory<T>(schema: Schema<T>, { $lookup, $match, $prune, $group, $sort }: PipelineFactoryOperators<T> = {}, { prefix = '', pipeline = [] }: PipelineFactoryOptions = {}): AggregationPipeline {
    // If lookup stage is specified, add it to beginning of the pipeline.
    if ($lookup) pipeline = Aggregation.lookupStageFactory(schema, $lookup, { fromPrefix: prefix, toPrefix: prefix }).concat(pipeline)

    // If match stage is specified, add it to the beginning of the pipeline.
    if ($match) pipeline = Aggregation.matchStageFactory(schema, $match, { prefix }).concat(pipeline)

    // If prune stage is specified, add it to the end of the pipeline.
    if ($prune) pipeline = pipeline.concat(Aggregation.matchStageFactory(schema, $prune))

    // If group stage is specified, add it to the end of the pipeline.
    if ($group) pipeline = pipeline.concat(Aggregation.groupStageFactory(schema, $group))

    // If sort stage is specified, add it to the end of the pipeline.
    if ($sort) pipeline = pipeline.concat(Aggregation.sortStageFactory(schema, $sort))

    return pipeline
  }

  /**
   * Generates the $match stage of the aggregation pipeline.
   *
   * @param schema - The schema of the database collection.
   * @param spec - Spec (aka query in this case) that defines the match.
   * @param options - Additional options.
   *
   * @returns The aggregation pipeline that handles the generated $match stage.
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
  static matchStageFactory<T>(schema: Schema<T>, spec: MatchStageFactorySpec<T>, { prefix = '' }: MatchStageFactoryOptions = {}): AggregationPipeline {
    const sanitized = sanitizeQuery<T>(schema, spec, { strict: false })
    const query: { [key: string]: any } = {}

    for (const key in sanitized) {
      if (!sanitized.hasOwnProperty(key)) continue
      query[`${prefix}${key}`] = (sanitized as any)[key as keyof T]
    }

    return [{ $match: query }]
  }

  /**
   * Generates the $lookup stage of the aggregation pipeline.
   *
   * @param schema - The schema of the database collection.
   * @param spec - Spec that defines the $lookup stage, supports looking up nested foreign keys.
   * @param options - Additional options.
   *
   * @returns The aggregation pipeline that handles the generated $lookup stage.
   *
   * @example
   * // Returns [{ "$lookup": { "from": "subModels", "localField": "subModel", "foreignField": "_id", "as": "subModel" } },
   *             { "$unwind": { "path": "$subModel", "preserveNullAndEmptyArrays": true } }]
   * lookupStageFactory(schema, { subModel: true })
   *
   * @example
   * // Returns [{ "$lookup": { "from": "subModels", "localField": "subModel", "foreignField": "_id", "as": "subModel" } },
   *             { "$unwind": { "path": "$subModel", "preserveNullAndEmptyArrays": true } },
   *             { "$lookup": { "from": "subSubModels", "localField": "subModel.subSubModel", "foreignField": "_id", "as": "subModel.subSubModel" } },
   *             { "$unwind": { "path": "$subModel.subSubModel", "preserveNullAndEmptyArrays": true } }]
   * lookupStageFactory(schema, { subModel: { subSubModel: true } })
   *
   * @example
   * // Returns [{ "$lookup": { "from": "subModels", "localField": "foo.subModel", "foreignField": "_id", "as": "bar.subModel"" } },
   *             { "$unwind": { "path": "$bar.subModel", "preserveNullAndEmptyArrays": true } },
   *             { "$lookup": { "from": "subSubModels", "localField": "bar.subModel.subSubModel", "foreignField": "_id", "as": "bar.subModel.subSubModel" } },
   *             { "$unwind": { "path": "$bar.subModel.subSubModel", "preserveNullAndEmptyArrays": true } }]
   * lookupStageFactory(schema, { subModel: { subSubModel: true } }, { fromPrefix: 'foo.', toPrefix: 'bar.' })
   *
   * @see
   * {@link https://docs.mongodb.com/manual/reference/operator/aggregation/lookup/}
   *
   * @throws {TypeError} Invalid params or options provided.
   * @throws {Error} Field to populate doesn't have a `ref` field specified.
   * @throws {Error} Unable to find the schema for the field to populate.
   */
  static lookupStageFactory<T>(schema: Schema<T>, spec: LookupStageFactorySpec, { fromPrefix = '', toPrefix = '' }: LookupStageFactoryOptions = {}): AggregationPipeline {
    const fields: { [fieldName: string]: FieldSpec} = schema.fields

    let pipe: AggregationPipeline = []

    for (const key in spec) {
      if (!spec.hasOwnProperty(key)) continue

      const val = spec[key]
      if (!((val === true) || (typeof val === 'object'))) throw new TypeError(`[lookup(${schema}, ${spec}, ${{ fromPrefix, toPrefix }})] Invalid populate properties.`)

      const ref = fields[key] && fields[key].ref
      if (!ref) throw new Error(`[lookup(${schema}, ${spec}, ${{ fromPrefix, toPrefix }})] The field to populate does not have a reference model specified in the schema.`)

      const schemaRef = db.getModel(ref).schema
      if (!schemaRef) throw new Error(`[lookup(${schema}, ${spec}, ${{ fromPrefix, toPrefix }})] Unable to find the model schema corresponding to the field to populate.`)

      pipe.push({
        $lookup: {
          from: `${schemaRef.collection}`,
          localField: `${fromPrefix}${key}`,
          foreignField: '_id',
          as: `${toPrefix}${key}`,
        },
      })

      pipe.push({
        $unwind: {
          path: `$${toPrefix}${key}`,
          preserveNullAndEmptyArrays: true,
        },
      })

      if (!_.isBoolean(val)) {
        pipe = pipe.concat(Aggregation.lookupStageFactory(schemaRef, val, {
          fromPrefix: `${toPrefix}${key}.`,
          toPrefix: `${toPrefix}${key}.`,
        }))
      }
    }

    return pipe
  }

  /**
   * Generates the $group stage of the aggregation pipeline.
   *
   * @param schema - The schema of the database collection.
   * @param spec - Spec that define the $group stage.
   *
   * @returns The aggregation pipeline that handles the generated $group stage.
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
  static groupStageFactory<T>(schema: Schema<T>, spec: GroupStageFactorySpec): AggregationPipeline {
    const pipe: AggregationPipeline = []

    if (_.isString(spec)) {
      pipe.push({ $group: { _id: `$${spec}` } })
    }
    else {
      pipe.push({ $group: spec })
    }

    return pipe
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
  static sortStageFactory<T>(schema: Schema<T>, spec: SortStageFactorySpec): AggregationPipeline {
    const pipe: AggregationPipeline = []
    pipe.push({ $sort: spec })

    return pipe
  }

  /**
   * Generates the $project stage of the aggregation pipeline.
   *
   * @param schema - The schema of the database collection.
   * @param options - Additional options.
   *
   * @returns The aggregation pipeline that handles the generated $project stage.
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
  static projectStageFactory<T>(schema: Schema<T>, { toPrefix = '', fromPrefix = '', populate = {}, exclude = [] }: ProjectStageFactoryOptions = {}): AggregationPipeline {
    const fields: { [fieldName: string]: FieldSpec} = schema.fields
    const out: { [key: string]: any } = { [`${toPrefix}_id`]: `$${fromPrefix}_id` }

    for (const key in fields) {
      if (!schema.fields.hasOwnProperty(key)) continue
      if (exclude.indexOf(key) > -1) continue

      const populateOpts = populate[key]

      if (populateOpts === false) continue

      const populateRef = fields[key].ref
      const populateSchema = (!_.isNil(populateOpts) && !_.isNil(populateRef)) ? db.getModel(populateRef).schema : undefined

      out[`${toPrefix}${key}`] = _.isNil(populateSchema) ? `$${fromPrefix}${key}` : (Aggregation.projectStageFactory(populateSchema, populateOpts === true ? undefined : populateOpts) as AggregationStageDescriptor[])[0]['$project']
    }

    if (schema.timestamps) {
      if (exclude.indexOf('updatedAt') < 0) out[`${toPrefix}updatedAt`] = `$${fromPrefix}updatedAt`
      if (exclude.indexOf('createdAt') < 0) out[`${toPrefix}createdAt`] = `$${fromPrefix}createdAt`
    }

    return [{ $project: out }]
  }
}
