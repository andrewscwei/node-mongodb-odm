import _ from 'lodash'
import { AnyProps } from '../../types'
import Schema from '../Schema'
import { groupStageFactory, GroupStageFactorySpecs } from './group'
import { lookupStageFactory, LookupStageFactorySpecs } from './lookup'
import { matchStageFactory, MatchStageFactorySpecs } from './match'
import { sortStageFactory, SortStageFactorySpecs } from './sort'

export type PipelineStage = {
  [stageName: string]: {
    [key: string]: any
  }
}

export type Pipeline = PipelineStage[]

export type PipelineFactoryOptions = {
  // Prefix for document attributes.
  toPrefix?: string

  // Pipeline to work with.
  pipeline?: Pipeline
}

export type PipelineFactoryStages<P extends AnyProps = AnyProps> = {
  /**
  * Lookup stage spec.
  */
  $lookup?: LookupStageFactorySpecs

  /**
  * Match stage spec at the beginning of the pipeline.
  */
  $match?: MatchStageFactorySpecs<P>

  /**
  * Match stage spec appended to end of the pipeline.
  */
  $prune?: MatchStageFactorySpecs<P>

  /**
  * Group stage spec.
  */
  $group?: GroupStageFactorySpecs

  /**
  * Sort stage spec appended to the end of the pipeline.
  */
  $sort?: SortStageFactorySpecs
}

/**
 * Generates a pipeline to pass into the aggregation framework.
 *
 * @param schema - The collection schema.
 * @param operators - @see PipelineFactoryStages
 * @param options - @see PipelineFactoryOptions
 *
 * @returns The generated aggregate pipeline.
 *
 * @throws {TypeError} Invalid params or options provided.
 */
export function autoPipelineFactory<P extends AnyProps = AnyProps>(
  schema: Schema<P>, {
    $lookup,
    $match,
    $prune,
    $group,
    $sort,
  }: PipelineFactoryStages<P> = {}, {
    toPrefix = '',
    pipeline = [],
  }: PipelineFactoryOptions = {},
): Pipeline {
  // If `$lookup` stage is specified, add it to beginning of the pipeline.
  if ($lookup) pipeline = (lookupStageFactory(schema, $lookup, { fromPrefix: toPrefix, toPrefix: toPrefix }) as Pipeline).concat(pipeline)

  // If `$match` stage is specified, add it to the beginning of the pipeline.
  if ($match) pipeline = (matchStageFactory(schema, $match, { toPrefix }) as Pipeline).concat(pipeline)

  // If `$prune` stage is specified, add it to the end of the pipeline.
  if ($prune) pipeline = pipeline.concat(matchStageFactory(schema, $prune))

  // If `$group` stage is specified, add it to the end of the pipeline.
  if ($group) pipeline = pipeline.concat(groupStageFactory(schema, $group))

  // If `$sort` stage is specified, add it to the end of the pipeline.
  if ($sort) pipeline = pipeline.concat(sortStageFactory(schema, $sort))

  return pipeline
}

export function typeIsAggregationPipeline(value: any): value is Pipeline {
  if (_.isArray(value)) return true
  return false
}
