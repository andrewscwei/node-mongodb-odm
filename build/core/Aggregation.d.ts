import { Query, Schema } from '../types';
export declare type AggregationPipeline = (MatchStageDescriptor | LookupStageDescriptor | UnwindStageDescriptor | GroupStageDescriptor | SortStageDescriptor | ProjectStageDescriptor | SampleStageDescriptor)[];
export interface PipelineFactoryOptions {
    prefix?: string;
    pipeline?: AggregationPipeline;
}
export interface PipelineFactorySpecs {
    $lookup?: LookupStageFactorySpecs;
    $match?: MatchStageFactorySpecs;
    $prune?: MatchStageFactorySpecs;
    $group?: GroupStageFactorySpecs;
    $sort?: SortStageFactorySpecs;
}
export declare type MatchStageFactorySpecs = Query;
export interface MatchStageFactoryOptions {
    prefix?: string;
}
export interface MatchStageDescriptor {
    $match: {
        [key: string]: any;
    };
}
export interface LookupStageFactorySpecs {
    [modelName: string]: boolean | LookupStageFactorySpecs;
}
export interface LookupStageFactoryOptions {
    fromPrefix?: string;
    toPrefix?: string;
}
export interface LookupStageDescriptor {
    $lookup: {
        [key: string]: any;
    };
}
export interface UnwindStageDescriptor {
    $unwind: {
        [key: string]: any;
    };
}
export declare type GroupStageFactorySpecs = string | {
    [key: string]: any;
};
export interface GroupStageDescriptor {
    $group: {
        [key: string]: any;
    };
}
export interface SortStageFactorySpecs {
    [key: string]: any;
}
export interface SortStageDescriptor {
    $sort: {
        [key: string]: any;
    };
}
export interface SampleStageDescriptor {
    $sample: {
        [key: string]: any;
    };
}
export interface ProjectStageFactoryOptions {
    toPrefix?: string;
    fromPrefix?: string;
    populate?: ProjectStageFactoryOptionsPopulate;
    exclude?: any[];
}
export interface ProjectStageFactoryOptionsPopulate {
    [modelName: string]: boolean | ProjectStageFactoryOptionsPopulate;
}
export interface ProjectStageDescriptor {
    $project: {
        [key: string]: any;
    };
}
export default abstract class Aggregation {
    static pipelineFactory(schema: Schema, { $lookup, $match, $prune, $group, $sort }?: PipelineFactorySpecs, { prefix, pipeline }?: PipelineFactoryOptions): AggregationPipeline;
    static matchStageFactory(schema: Schema, specs: MatchStageFactorySpecs, { prefix }?: MatchStageFactoryOptions): AggregationPipeline;
    static lookupStageFactory(schema: Schema, specs: LookupStageFactorySpecs, { fromPrefix, toPrefix }?: LookupStageFactoryOptions): AggregationPipeline;
    static groupStageFactory(schema: Schema, specs: GroupStageFactorySpecs): AggregationPipeline;
    static sortStageFactory(schema: Schema, specs: SortStageFactorySpecs): AggregationPipeline;
    static projectStageFactory(schema: Schema, { toPrefix, fromPrefix, populate, exclude }?: ProjectStageFactoryOptions): AggregationPipeline;
}
