import _ from 'lodash'
import { ObjectID } from 'mongodb'
import * as db from '../..'
import { AggregationPipeline, AnyFilter, Schema } from '../../types'
import Aggregation from '../Aggregation'
import { findOne } from './find'

export async function identifyOne<T>(schema: Schema<T>, query: AnyFilter<T>): Promise<ObjectID> {
  const doc = await findOne(schema, query).catch(err => { throw new Error(`[${schema.model}] No results found while identifying this ${schema.model} using the query ${JSON.stringify(query, undefined, 0)}`) })

  if (!ObjectID.isValid(doc._id)) throw new Error(`[${schema.model}] ID of ${doc} is not a valid ObjectID`)

  return doc._id
}

export async function identifyMany<T>(schema: Schema<T>, queryOrPipeline: AnyFilter<T> | AggregationPipeline): Promise<ObjectID[]> {
  const collection = await db.getCollection(schema.collection)

  let pipeline: AggregationPipeline

  if (_.isArray(queryOrPipeline)) {
    pipeline = queryOrPipeline
  }
  else {
    const query = queryOrPipeline
    pipeline = Aggregation.pipelineFactory(schema, { $match: query })
  }

  const results = await collection.aggregate([
    ...pipeline,
    {
      $group: {
        _id: undefined,
        ids: { $addToSet: '$_id' },
      },
    },
  ]).toArray()

  if (results.length === 0) return []

  return results[0].ids || []
}

export async function identifyAll<T>(schema: Schema<T>): Promise<ObjectID[]> {
  const collection = await db.getCollection(schema.collection)
  const pipeline = [...Aggregation.pipelineFactory(schema), {
    $group: {
      _id: undefined,
      ids: { $addToSet: '$_id' },
    },
  }]

  const results = await collection.aggregate(pipeline).toArray()

  if (results.length === 0) return []

  return results[0].ids || []
}
