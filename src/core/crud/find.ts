import _ from 'lodash'
import { type AggregateOptions } from 'mongodb'
import * as db from '../..'
import { type AnyFilter, type AnyProps, type Document } from '../../types'
import type Schema from '../Schema'
import * as Aggregation from '../aggregation'

export async function findOne<P extends AnyProps = AnyProps, R extends AnyProps = P>(schema: Schema<P>, filter: AnyFilter<P> | Aggregation.Pipeline, options: AggregateOptions = {}): Promise<Document<R>> {
  const docs = await findMany<P, R>(schema, filter, options)

  if (docs.length === 0) throw new Error(`[${schema.model}] No document found with provided query`)

  return docs[0]
}

export async function findOneRandom<P extends AnyProps = AnyProps, R extends AnyProps = P>(schema: Schema<P>): Promise<Document<R>> {
  const pipeline = [{ $sample: { size: 1 } }]
  const docs = await findMany<P, R>(schema, pipeline)

  if (docs.length !== 1) throw new Error(`[${schema.model}] More or less than 1 random document found even though only 1 was supposed to be found.`)

  return docs[0]
}

export async function findMany<P extends AnyProps = AnyProps, R extends AnyProps = P>(schema: Schema<P>, filter: AnyFilter<P> | Aggregation.Pipeline, options: AggregateOptions = {}): Promise<Document<R>[]> {
  const collection = await db.getCollection<Document<P>>(schema.collection)

  let pipeline: Aggregation.Pipeline

  if (_.isArray(filter)) {
    pipeline = filter
  }
  else {
    pipeline = Aggregation.matchStageFactory(schema, filter)
  }

  const docs = await collection.aggregate<Document<R>>(pipeline, options).toArray()

  return docs
}

export async function findAll<P extends AnyProps, R extends AnyProps = P>(schema: Schema<P>): Promise<Document<R>[]> {
  const collection = await db.getCollection<Document<P>>(schema.collection)
  const docs = await collection.aggregate<Document<R>>().toArray()

  return docs
}
