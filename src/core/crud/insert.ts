import { type BulkWriteOptions, type InsertOneOptions } from 'mongodb'
import * as db from '../../index.js'
import { type AnyProps, type Document, type InsertableDocument } from '../../types/index.js'
import { type Schema } from '../Schema.js'
import { matchStageFactory } from '../aggregation/index.js'
import { findMany, findOne } from './find.js'

export async function insertOne<P extends AnyProps = AnyProps>(schema: Schema<P>, doc: InsertableDocument<P>, options: InsertOneOptions = {}): Promise<Document<P>> {
  if (schema.noInserts === true) throw new Error(`[${schema.model}] Insertions are disallowed for this model`)

  const collection = await db.getCollection(schema.collection)
  const result = await collection.insertOne(doc, options)

  if (!result.acknowledged) throw new Error(`[${schema.model}] Unable to insert document`)
  if (!result.insertedId) throw new Error(`[${schema.model}] Unable to insert document`)

  const insertedDoc = await findOne(schema, result.insertedId)

  return insertedDoc
}

export async function insertMany<P extends AnyProps = AnyProps>(schema: Schema<P>, docs: InsertableDocument<P>[], options: BulkWriteOptions = {}): Promise<Document<P>[]> {
  if (schema.noInserts === true || schema.noInsertMany === true) throw new Error(`[${schema.model}] Multiple insertions are disallowed for this model`)

  const collection = await db.getCollection(schema.collection)
  const result = await collection.insertMany(docs, options)

  if (!result.acknowledged) throw new Error(`[${schema.model}] Unable to insert many documents`)
  if (result.insertedCount <= 0) return []

  const insertedDocs = await findMany(schema, matchStageFactory(schema, { _id: { $in: Object.values(result.insertedIds) as any } }))

  return insertedDocs
}
