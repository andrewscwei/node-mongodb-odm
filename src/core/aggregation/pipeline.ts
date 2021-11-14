import _ from 'lodash'
import { AnyProps } from '../../types'
import Schema from '../Schema'
import { groupStageFactory, GroupStageFactorySpec } from './group'
import { lookupStageFactory, LookupStageFactorySpec } from './lookup'
import { matchStageFactory, MatchStageFactorySpec } from './match'
import { sortStageFactory, SortStageFactorySpec } from './sort'

export type AggregationStageDescriptor = {
  [stageName: string]: {
    [key: string]: any
  }
}

export type AggregationPipeline = AggregationStageDescriptor[]

export type AggregationPipelineFactoryOptions = {
  // Prefix for document attributes.
  prefix?: string

  // Pipeline to work with.
  pipeline?: AggregationPipeline
}

export type AggregationPipelineFactoryOperators<P extends AnyProps = AnyProps> = {
  /**
  * Lookup stage spec.
  */
  $lookup?: LookupStageFactorySpec

  /**
  * Match stage spec at the beginning of the pipeline.
  */
  $match?: MatchStageFactorySpec<P>

  /**
  * Match stage spec appended to end of the pipeline.
  */
  $prune?: MatchStageFactorySpec<P>

  /**
  * Group stage spec.
  */
  $group?: GroupStageFactorySpec

  /**
  * Sort stage spec appended to the end of the pipeline.
  */
  $sort?: SortStageFactorySpec
}

/**
 * Generates a pipeline to pass into the aggregation framework.
 *
 * @param schema - The collection schema.
 * @param operators - @see AggregationPipelineFactoryOperators
 * @param options - @see AggregationPipelineFactoryOptions
 *
 * @returns The generated aggregate pipeline.
 *
 * @throws {TypeError} Invalid params or options provided.
 */
export function pipelineFactory<P extends AnyProps = AnyProps>(schema: Schema<P>, { $lookup, $match, $prune, $group, $sort }: AggregationPipelineFactoryOperators<P> = {}, { prefix = '', pipeline = [] }: AggregationPipelineFactoryOptions = {}): AggregationPipeline {
  // If lookup stage is specified, add it to beginning of the pipeline.
  if ($lookup) pipeline = lookupStageFactory(schema, $lookup, { fromPrefix: prefix, toPrefix: prefix }).concat(pipeline)

  // If match stage is specified, add it to the beginning of the pipeline.
  if ($match) pipeline = matchStageFactory(schema, $match, { prefix }).concat(pipeline)

  // If prune stage is specified, add it to the end of the pipeline.
  if ($prune) pipeline = pipeline.concat(matchStageFactory(schema, $prune))

  // If group stage is specified, add it to the end of the pipeline.
  if ($group) pipeline = pipeline.concat(groupStageFactory(schema, $group))

  // If sort stage is specified, add it to the end of the pipeline.
  if ($sort) pipeline = pipeline.concat(sortStageFactory(schema, $sort))

  return pipeline
}

export function typeIsAggregationPipeline(value: any): value is AggregationPipeline {
  if (_.isArray(value)) return true
  return false
}
