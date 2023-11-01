import { type Filter, type FindOneAndUpdateOptions, type UpdateFilter, type UpdateOptions } from 'mongodb'
import * as db from '../..'
import { type AnyProps, type Document } from '../../types'
import { type Schema } from '../Schema'
import { findMany, findOne } from './find'

export async function updateOne<P extends AnyProps = AnyProps>(schema: Schema<P>, filter: Filter<Document<P>>, update: UpdateFilter<Document<P>>, options: UpdateOptions = {}): Promise<boolean> {
  if (schema.noUpdates === true) throw new Error(`[${schema.model}] Updates are disallowed for this model`)
  if (options.upsert === true && schema.allowUpserts !== true) throw new Error(`[${schema.model}] Attempting to upsert a document while upserting is disallowed in the schema`)

  const collection = await db.getCollection<Document<P>>(schema.collection)
  const result = await collection.updateOne(filter, update, options)

  if (!result.acknowledged) throw new Error(`[${schema.model}] Unable to update the document`)

  if (options.upsert === true && result.upsertedCount > 0) return true
  if (result.modifiedCount > 0) return true

  return false
}

export async function findOneAndUpdate<P extends AnyProps = AnyProps>(schema: Schema<P>, filter: Filter<Document<P>>, update: UpdateFilter<Document<P>>, options: FindOneAndUpdateOptions = {}): Promise<[Document<P> | undefined, Document<P>]> {
  if (schema.noUpdates === true) throw new Error(`[${schema.model}] Updates are disallowed for this model`)
  if (options.upsert === true && schema.allowUpserts !== true) throw new Error(`[${schema.model}] Attempting to upsert a document while upserting is disallowed in the schema`)

  const collection = await db.getCollection<Document<P>>(schema.collection)
  const result = await collection.findOneAndUpdate(filter, update, { ...options, returnDocument: 'before' })

  if (result.ok !== 1) throw new Error(`[${schema.model}] Update failed`)

  let oldDoc: Document<P> | undefined
  let newDoc: Document<P>

  // Handle upserts properly. If upsertion happened, there is no old doc.
  if (result.lastErrorObject?.upserted) {
    newDoc = await findOne(schema, result.lastErrorObject.upserted)
  }
  else if (result.value) {
    oldDoc = result.value as Document<P>
    newDoc = await findOne(schema, oldDoc._id)
  }
  else {
    throw new Error(`[${schema.model}] Unable to return the old document before the update`)
  }

  if (!newDoc) throw new Error(`[${schema.model}] Unable to find the updated doc`)

  return [oldDoc, newDoc]
}

export async function updateMany<P extends AnyProps = AnyProps>(schema: Schema<P>, filter: Filter<Document<P>>, update: UpdateFilter<Document<P>>, options: UpdateOptions = {}): Promise<Document<P>[] | boolean> {
  if (schema.noUpdates === true || schema.noUpdateMany === true) throw new Error(`[${schema.model}] Multiple updates are disallowed for this model`)
  if (options.upsert === true && schema.allowUpserts !== true) throw new Error(`[${schema.model}] Attempting to upsert a document while upserting is disallowed in the schema`)

  const collection = await db.getCollection<Document<P>>(schema.collection)
  const result = await collection.updateMany(filter, update, options)

  if (!result.acknowledged) throw new Error(`[${schema.model}] Unable to update many documents`)

  if (options.upsert === true && result.upsertedCount > 0) return true
  if (result.modifiedCount > 0) return true

  return false
}

export async function findManyAndUpdate<P extends AnyProps = AnyProps>(schema: Schema<P>, filter: Filter<Document<P>>, update: UpdateFilter<Document<P>>, options: FindOneAndUpdateOptions = {}): Promise<[undefined, Document<P>[]]> {
  if (schema.noUpdates === true || schema.noUpdateMany === true) throw new Error(`[${schema.model}] Multiple updates are disallowed for this model`)
  if (options.upsert === true && schema.allowUpserts !== true) throw new Error(`[${schema.model}] Attempting to upsert a document while upserting is disallowed in the schema`)

  const collection = await db.getCollection<Document<P>>(schema.collection)

  const docs = await findMany(schema, filter)
  const n = docs.length
  const newDocs: Document<P>[] = []

  if (n <= 0 && options.upsert === true) {
    const [, newDoc] = await findOneAndUpdate(schema, filter, update, options)
    newDocs.push(newDoc)
  }
  else {
    for (let i = 0; i < n; i++) {
      const doc = docs[i]
      const result = await collection.findOneAndUpdate({ _id: doc._id } as Filter<Document<P>>, update, { ...options, returnDocument: 'after' })

      if (result.ok !== 1) throw new Error(`[${schema.model}] Unable to update many documents`)
      if (!result.value) throw new Error(`[${schema.model}] Unable to update many documents`)

      newDocs.push(result.value as Document<P>)
    }
  }

  return [undefined, newDocs]
}
