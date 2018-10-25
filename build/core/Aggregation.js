"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const is_1 = __importDefault(require("@sindresorhus/is"));
const assert_1 = __importDefault(require("assert"));
const util_1 = require("util");
const db = __importStar(require("../"));
const sanitizeQuery_1 = __importDefault(require("../utils/sanitizeQuery"));
class Aggregation {
    static pipelineFactory(schema, { $lookup, $match, $prune, $group, $sort } = {}, { prefix = '', pipeline = [] } = {}) {
        assert_1.default(is_1.default.undefined($match) || is_1.default.object($match) || is_1.default.string($match));
        assert_1.default(is_1.default.undefined($lookup) || is_1.default.object($lookup));
        assert_1.default(is_1.default.undefined($prune) || is_1.default.object($prune) || is_1.default.string($prune));
        assert_1.default(is_1.default.undefined($group) || is_1.default.object($group) || is_1.default.string($group));
        assert_1.default(is_1.default.undefined($sort) || is_1.default.object($sort));
        assert_1.default(is_1.default.string(prefix));
        assert_1.default(is_1.default.array(pipeline));
        if ($lookup)
            pipeline = Aggregation.lookupStageFactory(schema, $lookup, { fromPrefix: prefix, toPrefix: prefix }).concat(pipeline);
        if ($match)
            pipeline = Aggregation.matchStageFactory(schema, $match, { prefix }).concat(pipeline);
        if ($prune)
            pipeline = pipeline.concat(Aggregation.matchStageFactory(schema, $prune));
        if ($group)
            pipeline = pipeline.concat(Aggregation.groupStageFactory(schema, $group));
        if ($sort)
            pipeline = pipeline.concat(Aggregation.sortStageFactory(schema, $sort));
        return pipeline;
    }
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
            const schemaRef = db.getModel(ref).schema;
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
    static sortStageFactory(schema, specs) {
        const pipe = [];
        pipe.push({ $sort: specs });
        return pipe;
    }
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
            const populateSchema = (!is_1.default.nullOrUndefined(populateOpts) && !util_1.isNullOrUndefined(populateRef)) ? db.getModel(populateRef).schema : undefined;
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