"use strict";
/**
 * @file Static utility class with helper functions for MongoDB's aggregation
 *       framework.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const is_1 = __importDefault(require("@sindresorhus/is"));
const assert_1 = __importDefault(require("assert"));
const util_1 = require("util");
const __1 = require("..");
const sanitizeQuery_1 = __importDefault(require("../utils/sanitizeQuery"));
class Aggregation {
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
    static pipelineFactory(schema, { $lookup, $match, $prune, $group, $sort } = {}, { prefix = '', pipeline = [] } = {}) {
        assert_1.default(is_1.default.undefined($match) || is_1.default.object($match) || is_1.default.string($match));
        assert_1.default(is_1.default.undefined($lookup) || is_1.default.object($lookup));
        assert_1.default(is_1.default.undefined($prune) || is_1.default.object($prune) || is_1.default.string($prune));
        assert_1.default(is_1.default.undefined($group) || is_1.default.object($group) || is_1.default.string($group));
        assert_1.default(is_1.default.undefined($sort) || is_1.default.object($sort));
        assert_1.default(is_1.default.string(prefix));
        assert_1.default(is_1.default.array(pipeline));
        // If lookup stage is specified, add it to beginning of the pipeline.
        if ($lookup)
            pipeline = Aggregation.lookupStageFactory(schema, $lookup, { fromPrefix: prefix, toPrefix: prefix }).concat(pipeline);
        // If match stage is specified, add it to the beginning of the pipeline.
        if ($match)
            pipeline = Aggregation.matchStageFactory(schema, $match, { prefix }).concat(pipeline);
        // If prune stage is specified, add it to the end of the pipeline.
        if ($prune)
            pipeline = pipeline.concat(Aggregation.matchStageFactory(schema, $prune));
        // If group stage is specified, add it to the end of the pipeline.
        if ($group)
            pipeline = pipeline.concat(Aggregation.groupStageFactory(schema, $group));
        // If sort stage is specified, add it to the end of the pipeline.
        if ($sort)
            pipeline = pipeline.concat(Aggregation.sortStageFactory(schema, $sort));
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
    static matchStageFactory(schema, specs, { prefix = '' } = {}) {
        const sanitized = sanitizeQuery_1.default(schema, specs, { strict: false });
        const query = {};
        for (const key in sanitized) {
            if (!sanitized.hasOwnProperty(key))
                continue;
            query[`${prefix}${key}`] = sanitized[key];
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
    static lookupStageFactory(schema, specs, { fromPrefix = '', toPrefix = '' } = {}) {
        const fields = schema.fields;
        let pipe = [];
        for (const key in specs) {
            if (!specs.hasOwnProperty(key))
                continue;
            const val = specs[key];
            assert_1.default((val === true) || (typeof val === 'object'), new Error(`[lookup(${schema}, ${specs}, ${{ fromPrefix, toPrefix }})] Invalid populate properties.`));
            const ref = fields[key] && fields[key].ref;
            assert_1.default(ref, new Error(`[lookup(${schema}, ${specs}, ${{ fromPrefix, toPrefix }})] The field to populate does not have a reference model specified in the schema.`));
            const schemaRef = __1.getModel(ref).schema;
            assert_1.default(schemaRef, new Error(`[lookup(${schema}, ${specs}, ${{ fromPrefix, toPrefix }})] Unable to find the model schema corresponding to the field to populate.`));
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
            if (is_1.default.object(val)) {
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
    static groupStageFactory(schema, specs) {
        const pipe = [];
        if (is_1.default.string(specs)) {
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
    static sortStageFactory(schema, specs) {
        const pipe = [];
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
    static projectStageFactory(schema, { toPrefix = '', fromPrefix = '', populate = {}, exclude = [] } = {}) {
        const fields = schema.fields;
        const out = { [`${toPrefix}_id`]: `$${fromPrefix}_id` };
        for (const key in fields) {
            if (!schema.fields.hasOwnProperty(key))
                continue;
            if (exclude.indexOf(key) > -1)
                continue;
            const populateOpts = populate[key];
            if (populateOpts === false)
                continue;
            const populateRef = fields[key].ref;
            const populateSchema = (!is_1.default.nullOrUndefined(populateOpts) && !util_1.isNullOrUndefined(populateRef)) ? __1.getModel(populateRef).schema : undefined;
            out[`${toPrefix}${key}`] = is_1.default.nullOrUndefined(populateSchema) ? `$${fromPrefix}${key}` : Aggregation.projectStageFactory(populateSchema, populateOpts === true ? undefined : populateOpts)[0]['$project'];
        }
        if (schema.timestamps) {
            if (exclude.indexOf('updatedAt') < 0)
                out[`${toPrefix}updatedAt`] = `$${fromPrefix}updatedAt`;
            if (exclude.indexOf('createdAt') < 0)
                out[`${toPrefix}createdAt`] = `$${fromPrefix}createdAt`;
        }
        return [{ $project: out }];
    }
}
exports.default = Aggregation;
//# sourceMappingURL=Aggregation.js.map