/**
 * @file Static utility class with helper functions for MongoDB's aggregation
 *       framework.
 */

import is from '@sindresorhus/is';
import assert from 'assert';
import { isNullOrUndefined } from 'util';
import * as db from '../';
import { Query, Schema } from '../types';
import querify from '../utils/querify';

export type AggregationPipeline = (MatchStageDescriptor | LookupStageDescriptor | UnwindStageDescriptor | GroupStageDescriptor | SortStageDescriptor | ProjectStageDescriptor)[];

interface PipelineFactoryOptions {
  // Prefix for document attributes.
  prefix?: string;

  // Pipeline to work with.
  pipeline?: AggregationPipeline;
}

interface PipelineFactorySpecs {
  /**
   * Lookup stage spec.
   */
  $lookup?: LookupStageFactorySpecs;

  /**
   * Match stage spec at the beginning of the pipeline.
   */
  $match?: MatchStageFactorySpecs;

  /**
   * Match stage spec appended to end of the pipeline.
   */
  $prune?: MatchStageFactorySpecs;

  /**
   * Group stage spec.
   */
  $group?: GroupStageFactorySpecs;

  /**
   * Sort stage spec appended to the end of the pipeline.
   */
  $sort?: SortStageFactorySpecs;
}

export interface AggregationGroupSpecs {

}

type MatchStageFactorySpecs = Query;

interface MatchStageFactoryOptions {
  prefix?: string;
}

interface MatchStageDescriptor {
  $match: { [key: string]: any };
}

/**
 * Defines fields to perform lookup on used by #lookupStageFactory(). These
 * fields must be references (i.e. model name as foreign keys) to another model.
 * The fields are represented by the keys in this object. The accepted values of
 * the keys are `true` or another object for recursive lookup of the reference
 * model's foreign keys. If the value is simply `true`, lookup will only be
 * performed on the immediate foreign key, all of its subsequent foreign keys
 * will be ignored. Specs can be nested objects. `$unwind` is immediately
 * followed after the generated  `$lookup`.
 */
interface LookupStageFactorySpecs {
  [modelName: string]: boolean | LookupStageFactorySpecs;
}

interface LookupStageFactoryOptions {
  /**
   * Prefix for current attributes to look up.
   */
  fromPrefix?: string;

  /**
   * Prefix for looked up attributes to save to.
   */
  toPrefix?: string;
}

interface LookupStageDescriptor {
  $lookup: { [key: string]: any };
}

interface UnwindStageDescriptor {
  $unwind: { [key: string]: any };
}

/**
 * Specs that define the $group stage. If this is a string, a simple $group
 * stage will be generated with `_id` equal this string.
 */
type GroupStageFactorySpecs = string | { [key: string]: any };

interface GroupStageDescriptor {
  $group: { [key: string]: any };
}

interface SortStageFactorySpecs {
  [key: string]: any;
}

interface SortStageDescriptor {
  $sort: { [key: string]: any };
}

interface ProjectStageFactoryOptions {
  /**
   * Prefix for current attributes.
   */
  toPrefix?: string;

  /**
   * Prefix for target attributes after project.
   */
  fromPrefix?: string;

  /**
   * An object containing key/value pairs representing a field belonging to this
   * model that is a reference (aka foreign key) pointing to another model. The
   * keys equate the name of the field while the values equate the `options`
   * parameter for the reference models `project()` method. The values can also
   * just be `true` to omit passing an `options` parameter.
   */
  populate?: ProjectStageFactoryOptionsPopulate;

  /**
   * Schema fields  to exclude.
   */
  exclude?: any[];
}

interface ProjectStageFactoryOptionsPopulate {
  [modelName: string]: boolean | ProjectStageFactoryOptionsPopulate;
}

interface ProjectStageDescriptor {
  $project: { [key: string]: any };
}

abstract class Aggregation {
  /**
   * Generates a pipeline to pass into the aggregation framework.
   *
   * @param {Schema} schema - The collection schema.
   * @param specs - Specs for customizing the pipeline.
   * @param {Object|string} [specs.$group] - Group stage spec appended to end of
   *                                         the pipeline.
   * @param options - Additional options.
   *
   * @return The generated aggregate pipeline.
   */
  static pipelineFactory(schema: Schema, { $lookup, $match, $prune, $group, $sort }: PipelineFactorySpecs = {}, { prefix = '', pipeline = [] }: PipelineFactoryOptions = {}): AggregationPipeline {
    assert(is.undefined($match) || is.object($match) || is.string($match));
    assert(is.undefined($lookup) || is.object($lookup));
    assert(is.undefined($prune) || is.object($prune) || is.string($prune));
    assert(is.undefined($group) || is.object($group) || is.string($group));
    assert(is.undefined($sort) || is.object($sort));
    assert(is.string(prefix));
    assert(is.array(pipeline));

    // If lookup stage is specified, add it to beginning of the pipeline.
    if ($lookup) pipeline = Aggregation.lookupStageFactory(schema, $lookup, { fromPrefix: prefix, toPrefix: prefix }).concat(pipeline);

    // If match stage is specified, add it to the beginning of the pipeline.
    if ($match) pipeline = Aggregation.matchStageFactory(schema, $match, { prefix }).concat(pipeline);

    // If prune stage is specified, add it to the end of the pipeline.
    if ($prune) pipeline = pipeline.concat(Aggregation.matchStageFactory(schema, $prune));

    // If group stage is specified, add it to the end of the pipeline.
    if ($group) pipeline = pipeline.concat(Aggregation.groupStageFactory(schema, $group));

    // If sort stage is specified, add it to the end of the pipeline.
    if ($sort) pipeline = pipeline.concat(Aggregation.sortStageFactory(schema, $sort));

    return pipeline;
  }

  /**
   * Generates the $match stage of the aggregation pipeline.
   *
   * @param schema - The schema of the database collection.
   * @param specs - Specs (aka query in this case) that defines the match.
   * @param options - Additional options.
   *
   * @return The aggregation pipeline that handles the generated $match stage.
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
  static matchStageFactory(schema: Schema, specs: MatchStageFactorySpecs, { prefix = '' }: MatchStageFactoryOptions = {}): AggregationPipeline {
    const querifiedSpecs = querify(schema, specs, { strict: false });
    const query: { [key: string]: any } = {};

    for (const key in querifiedSpecs) {
      if (!querifiedSpecs.hasOwnProperty(key)) continue;
      query[`${prefix}${key}`] = querifiedSpecs[key];
    }

    return [{ $match: query }];
  }

  /**
   * Generates the $lookup stage of the aggregation pipeline.
   *
   * @param schema - The schema of the database collection.
   * @param specs - Specs that defines the $lookup stage, supports looking up
   *                nested foreign keys.
   * @param options - Additional options.
   *
   * @return The aggregation pipeline that handles the generated $lookup stage.
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
   * @see {@link https://docs.mongodb.com/manual/reference/operator/aggregation/lookup/}
   */
  static lookupStageFactory(schema: Schema, specs: LookupStageFactorySpecs, { fromPrefix = '', toPrefix = '' }: LookupStageFactoryOptions = {}): AggregationPipeline {
    let pipe: AggregationPipeline = [];

    for (const key in specs) {
      if (!specs.hasOwnProperty(key)) continue;

      const val = specs[key];
      assert((val === true) || (typeof val === 'object'), new Error(`[lookup(${schema}, ${specs}, ${{ fromPrefix, toPrefix }})] Invalid populate properties.`));

      const ref = schema.fields[key] && schema.fields[key].ref;
      assert(ref, new Error(`[lookup(${schema}, ${specs}, ${{ fromPrefix, toPrefix }})] The field to populate does not have a reference model specified in the schema.`));

      const schemaRef = db.getModel(ref!).schema;
      assert(schemaRef, new Error(`[lookup(${schema}, ${specs}, ${{ fromPrefix, toPrefix }})] Unable to find the model schema corresponding to the field to populate.`));

      pipe.push({
        $lookup: {
          from: `${schemaRef.collection}`,
          localField: `${fromPrefix}${key}`,
          foreignField: '_id',
          as: `${toPrefix}${key}`,
        },
      });

      pipe.push({
        $unwind: {
          path: `$${toPrefix}${key}`,
          preserveNullAndEmptyArrays: true,
        },
      });

      if (is.object(val)) {
        pipe = pipe.concat(Aggregation.lookupStageFactory(schemaRef, val, {
          fromPrefix: `${toPrefix}${key}.`,
          toPrefix: `${toPrefix}${key}.`,
        }));
      }
    }

    return pipe;
  }

  /**
   * Generates the $group stage of the aggregation pipeline.
   *
   * @param schema - The schema of the database collection.
   * @param specs - Specs that define the $group stage.
   *
   * @return The aggregation pipeline that handles the generated $group stage.
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
  static groupStageFactory(schema: Schema, specs: GroupStageFactorySpecs): AggregationPipeline {
    const pipe: AggregationPipeline = [];

    if (is.string(specs)) {
      pipe.push({ $group: { _id: `$${specs}` } });
    }
    else {
      pipe.push({ $group: specs });
    }

    return pipe;
  }

  /**
   * Generates the $sort stage of the aggregation pipeline.
   *
   * @param schema - The schema of the database collection.
   * @param specs - Specs that define the $sort stage.
   *
   * @return The aggregation pipeline that handles the generated $sort stage.
   *
   * @example
   * // Returns [{ "$sort": { "a": 1, "b": -1 } }]
   * sort(schema, { a: 1, b: -1 })
   *
   * @see {@link https://docs.mongodb.com/manual/reference/operator/aggregation/sort/}
   */
  static sortStageFactory(schema: Schema, specs: SortStageFactorySpecs): AggregationPipeline {
    const pipe: AggregationPipeline = [];
    pipe.push({ $sort: specs });

    return pipe;
  }

  /**
   * Generates the $project stage of the aggregation pipeline.
   *
   * @param schema - The schema of the database collection.
   * @param options - Additional options.
   *
   * @return The aggregation pipeline that handles the generated $project stage.
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
  static projectStageFactory(schema: Schema, { toPrefix = '', fromPrefix = '', populate = {}, exclude = [] }: ProjectStageFactoryOptions = {}): AggregationPipeline {
    const out: { [key: string]: any } = { [`${toPrefix}_id`]: `$${fromPrefix}_id` };

    for (const key in schema.fields) {
      if (!schema.fields.hasOwnProperty(key)) continue;
      if (exclude.indexOf(key) > -1) continue;

      const populateOpts = populate[key];

      if (populateOpts === false) continue;

      const populateRef = schema.fields[key].ref;
      const populateSchema = (!is.nullOrUndefined(populateOpts) && !isNullOrUndefined(populateRef)) ? db.getModel(populateRef).schema : undefined;

      out[`${toPrefix}${key}`] = is.nullOrUndefined(populateSchema) ? `$${fromPrefix}${key}` : (Aggregation.projectStageFactory(populateSchema, populateOpts === true ? undefined : populateOpts) as ProjectStageDescriptor[])[0]['$project'];
    }

    if (schema.timestamps) {
      if (exclude.indexOf('updatedAt') < 0) out[`${toPrefix}updatedAt`] = `$${fromPrefix}updatedAt`;
      if (exclude.indexOf('createdAt') < 0) out[`${toPrefix}createdAt`] = `$${fromPrefix}createdAt`;
    }

    return [{ $project: out }];
  }
}

export default Aggregation;
