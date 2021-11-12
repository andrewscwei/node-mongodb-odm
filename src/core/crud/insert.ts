import { CollectionInsertManyOptions, CollectionInsertOneOptions } from 'mongodb'
import * as db from '../..'
import { Document, DocumentFragment, Schema } from '../../types'

export async function insertOne<T>(schema: Schema<T>, doc: DocumentFragment<T>, options: CollectionInsertOneOptions = {}): Promise<Document<T>> {
  if (schema.noInserts === true) throw new Error(`[${schema.model}] Insertions are disallowed for this model`)

  const collection = await db.getCollection(schema.collection)
  const result = await collection.insertOne(doc, options).catch(error => { throw error })

  if (result.result.ok !== 1) throw new Error(`[${schema.model}] Unable to insert document`)
  if (result.ops.length > 1) throw new Error(`[${schema.model}] Somehow insertOne() op inserted more than 1 document`)
  if (result.ops.length < 1) throw new Error(`[${schema.model}] Unable to insert document`)

  const insertedDoc = result.ops[0] as Document<T>

  return insertedDoc
}

export async function insertMany<T>(schema: Schema<T>, docs: DocumentFragment<T>[], options: CollectionInsertManyOptions = {}): Promise<Document<T>[]> {
  if ((schema.noInserts === true) || (schema.noInsertMany === true)) throw new Error(`[${schema.model}] Multiple insertions are disallowed for this model`)

  const collection = await db.getCollection(schema.collection)
  const results = await collection.insertMany(docs, options)

  if (results.result.ok !== 1) throw new Error(`[${schema.model}] Unable to insert many documents`)

  const insertedDocs = results.ops as Document<T>[]

  return insertedDocs
}
