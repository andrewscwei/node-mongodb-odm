import _ from 'lodash'
import { CollectionAggregationOptions } from 'mongodb'
import * as db from '../..'
import { AggregationPipeline, Document, AnyFilter, Schema } from '../../types'
import Aggregation from '../Aggregation'

export async function findOne<T, R = T>(schema: Schema<T>, query: AnyFilter<T>, options: CollectionAggregationOptions = {}): Promise<Document<R>> {
  const docs = await findMany<T, R>(schema, query, options)

  if (docs.length === 0) throw new Error(`[${schema.model}] No document found with provided query`)

  return docs[0]
}

export async function findOneRandom<T, R = T>(schema: Schema<T>): Promise<Document<R>> {
  const pipeline = Aggregation.pipelineFactory(schema).concat([{ $sample: { size: 1 } }])
  const docs = await findMany<T, R>(schema, pipeline)

  if (docs.length !== 1) throw new Error(`[${schema.model}] More or less than 1 random document found even though only 1 was supposed to be found.`)

  return docs[0]
}

export async function findMany<T, R = T>(schema: Schema<T>, queryOrPipeline: AnyFilter<T> | AggregationPipeline, options: CollectionAggregationOptions = {}): Promise<Document<R>[]> {
  const collection = await db.getCollection(schema.collection)

  let pipeline: AggregationPipeline

  if (_.isArray(queryOrPipeline)) {
    pipeline = queryOrPipeline
  }
  else {
    const query = queryOrPipeline
    pipeline = Aggregation.pipelineFactory(schema, { $match: query })
  }

  const docs = await collection.aggregate(pipeline, options).toArray()

  return docs
}

export async function findAll<T, R = T>(schema: Schema<T>): Promise<Document<R>[]> {
  const collection = await db.getCollection(schema.collection)
  const docs = await collection.aggregate(Aggregation.pipelineFactory(schema)).toArray()

  return docs
}
