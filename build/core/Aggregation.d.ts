/**
 * @file Static utility class with helper functions for MongoDB's aggregation
 *       framework.
 */
import { AggregationPipeline, GroupStageFactorySpecs, LookupStageFactoryOptions, LookupStageFactorySpecs, MatchStageFactoryOptions, MatchStageFactorySpecs, PipelineFactoryOptions, PipelineFactorySpecs, ProjectStageFactoryOptions, Schema, SortStageFactorySpecs } from '../types';
export default abstract class Aggregation {
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
    static pipelineFactory(schema: Schema, { $lookup, $match, $prune, $group, $sort }?: PipelineFactorySpecs, { prefix, pipeline }?: PipelineFactoryOptions): AggregationPipeline;
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
    static matchStageFactory<T = {}>(schema: Schema, specs: MatchStageFactorySpecs, { prefix }?: MatchStageFactoryOptions): AggregationPipeline;
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
    static lookupStageFactory(schema: Schema, specs: LookupStageFactorySpecs, { fromPrefix, toPrefix }?: LookupStageFactoryOptions): AggregationPipeline;
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
    static groupStageFactory(schema: Schema, specs: GroupStageFactorySpecs): AggregationPipeline;
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
    static sortStageFactory(schema: Schema, specs: SortStageFactorySpecs): AggregationPipeline;
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
    static projectStageFactory(schema: Schema, { toPrefix, fromPrefix, populate, exclude }?: ProjectStageFactoryOptions): AggregationPipeline;
}
