import _ from 'lodash'
import { ObjectID } from 'mongodb'
import * as db from '../..'
import { AnyFilter } from '../../types'
import { AggregationPipeline, groupStageFactory, pipelineFactory } from '../aggregation'
import Schema from '../Schema'
import { findOne } from './find'

export async function identifyOne<T>(schema: Schema<T>, filter: AnyFilter<T>): Promise<ObjectID> {
  const doc = await findOne(schema, filter).catch(err => { throw new Error(`[${schema.model}] No results found while identifying this ${schema.model} using the filter ${filter}`) })

  if (!ObjectID.isValid(doc._id)) throw new Error(`[${schema.model}] ID of ${doc} is not a valid ObjectID`)

  return doc._id
}

export async function identifyMany<T>(schema: Schema<T>, filter: AnyFilter<T>): Promise<ObjectID[]> {
  const collection = await db.getCollection(schema.collection)

  let pipeline: AggregationPipeline

  if (_.isArray(filter)) {
    pipeline = filter
  }
  else {
    pipeline = pipelineFactory(schema, { $match: filter })
  }

  const docs = await collection.aggregate([
    ...pipeline,
    ...groupStageFactory(schema, {
      _id: undefined,
      ids: { $addToSet: '$_id' },
    }),
  ]).toArray()

  if (docs.length === 0) return []

  return docs[0].ids || []
}

export async function identifyAll<T>(schema: Schema<T>): Promise<ObjectID[]> {
  const collection = await db.getCollection(schema.collection)
  const pipeline = [...pipelineFactory(schema), ...groupStageFactory(schema, {
    _id: undefined,
    ids: { $addToSet: '$_id' },
  })]

  const docs = await collection.aggregate(pipeline).toArray()

  if (docs.length === 0) return []

  return docs[0].ids || []
}
