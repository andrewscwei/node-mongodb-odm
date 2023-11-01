import _ from 'lodash'
import { ObjectId } from 'mongodb'
import * as db from '../..'
import { type AnyFilter, type AnyProps } from '../../types'
import type Schema from '../Schema'
import * as Aggregation from '../aggregation'
import { findOne } from './find'

export async function identifyOne<P extends AnyProps = AnyProps>(schema: Schema<P>, filter: AnyFilter<P>): Promise<ObjectId> {
  const doc = await findOne(schema, filter).catch(err => { throw new Error(`[${schema.model}] No results found while identifying this ${schema.model} using the filter ${filter}`) })

  if (!ObjectId.isValid(doc._id)) throw new Error(`[${schema.model}] ID of ${doc} is not a valid ObjectId`)

  return doc._id
}

export async function identifyMany<P extends AnyProps = AnyProps>(schema: Schema<P>, filter: AnyFilter<P>): Promise<ObjectId[]> {
  const collection = await db.getCollection(schema.collection)

  let pipeline: Aggregation.Pipeline

  if (_.isArray(filter)) {
    pipeline = filter
  }
  else {
    pipeline = Aggregation.matchStageFactory(schema, filter)
  }

  const docs = await collection.aggregate([
    ...pipeline,
    ...Aggregation.groupStageFactory(schema, {
      _id: undefined,
      ids: { $addToSet: '$_id' },
    }),
  ]).toArray()

  if (docs.length === 0) return []

  return docs[0].ids || []
}

export async function identifyAll<P extends AnyProps = AnyProps>(schema: Schema<P>): Promise<ObjectId[]> {
  const collection = await db.getCollection(schema.collection)
  const pipeline = Aggregation.groupStageFactory(schema, {
    _id: undefined,
    ids: { $addToSet: '$_id' },
  })

  const docs = await collection.aggregate(pipeline).toArray()

  if (docs.length === 0) return []

  return docs[0].ids || []
}
