import { AggregationPipeline, GroupStageFactorySpecs, LookupStageFactoryOptions, LookupStageFactorySpecs, MatchStageFactoryOptions, MatchStageFactorySpecs, PipelineFactoryOptions, PipelineFactorySpecs, ProjectStageFactoryOptions, Schema, SortStageFactorySpecs } from '../types';
export default abstract class Aggregation {
    static pipelineFactory(schema: Schema, { $lookup, $match, $prune, $group, $sort }?: PipelineFactorySpecs, { prefix, pipeline }?: PipelineFactoryOptions): AggregationPipeline;
    static matchStageFactory<T = {}>(schema: Schema, specs: MatchStageFactorySpecs, { prefix }?: MatchStageFactoryOptions): AggregationPipeline;
    static lookupStageFactory(schema: Schema, specs: LookupStageFactorySpecs, { fromPrefix, toPrefix }?: LookupStageFactoryOptions): AggregationPipeline;
    static groupStageFactory(schema: Schema, specs: GroupStageFactorySpecs): AggregationPipeline;
    static sortStageFactory(schema: Schema, specs: SortStageFactorySpecs): AggregationPipeline;
    static projectStageFactory(schema: Schema, { toPrefix, fromPrefix, populate, exclude }?: ProjectStageFactoryOptions): AggregationPipeline;
}
