import _ from 'lodash'
import { CommonOptions, FilterQuery, FindOneAndReplaceOption, ReplaceOneOptions, UpdateManyOptions, UpdateOneOptions } from 'mongodb'
import * as db from '../..'
import { Document, AnyFilter, Schema, AnyUpdate } from '../../types'
import { findMany, findOne } from './find'

export async function findOneAndUpdate<T>(schema: Schema<T>, query: AnyFilter<T>, update: AnyUpdate<T>, options: FindOneAndReplaceOption<T> & ReplaceOneOptions = {}): Promise<[Document<T> | undefined, Document<T>]> {
  if (schema.noUpdates === true) throw new Error(`[${schema.model}] Updates are disallowed for this model`)

  const collection = await db.getCollection(schema.collection)

  if (!_.isPlainObject(query)) throw new Error(`[${schema.model}] Invalid query, maybe it is not sanitized?`)

  const results = await collection.findOneAndUpdate(query as { [key: string]: any }, update, { ...options, returnDocument: 'before' })

  if (results.ok !== 1) throw new Error(`[${schema.model}] AnyUpdate failed`)

  let oldDoc: Document<T> | undefined
  let newDoc: Document<T>

  // Handle upserts properly. If upsertion happened, there is no old doc.
  if (!results.lastErrorObject.upserted) {
    oldDoc = results.value

    if (!oldDoc) throw new Error(`[${schema.model}] Unable to return the old document before the update`)

    newDoc = await findOne<T>(schema, oldDoc._id)
  }
  else {
    newDoc = await findOne<T>(schema, results.lastErrorObject.upserted)
  }

  if (!newDoc) throw new Error(`[${schema.model}] Unable to find the updated doc`)

  return [oldDoc, newDoc]
}

export async function updateOne<T>(schema: Schema<T>, query: AnyFilter<T>, update: AnyUpdate<T>, options: UpdateOneOptions = {}): Promise<void> {
  if (schema.noUpdates === true) throw new Error(`[${schema.model}] Updates are disallowed for this model`)

  const collection = await db.getCollection(schema.collection)

  if (!_.isPlainObject(query)) throw new Error(`[${schema.model}] Invalid query, maybe it is not sanitized?`)

  const results = await collection.updateOne(query as { [key: string]: any }, update, options)

  if (results.result.ok !== 1) throw new Error(`[${schema.model}] Unable to update the document`)
  if (results.result.n <= 0) throw new Error(`[${schema.model}] Unable to update the document`)
}

export async function findManyAndUpdate<T>(schema: Schema<T>, query: AnyFilter<T>, update: AnyUpdate<T>, options: FindOneAndReplaceOption<T> & CommonOptions = {}): Promise<[undefined, Document<T>[]]> {
  if ((schema.noUpdates === true) || (schema.noUpdateMany === true)) throw new Error(`[${schema.model}] Multiple updates are disallowed for this model`)

  const collection = await db.getCollection(schema.collection)

  const docs = await findMany<T>(schema, query)
  const n = docs.length
  const newDocs: Document<T>[] = []

  if ((n <= 0) && (options.upsert === true)) {
    const [_, newDoc] = await findOneAndUpdate(schema, query, update, options)
    newDocs.push(newDoc)
  }
  else {
    for (let i = 0; i < n; i++) {
      const doc = docs[i]
      const results = await collection.findOneAndUpdate({ _id: doc._id }, update, { ...options, returnDocument: 'after' })

      if (results.ok !== 1) throw new Error(`[${schema.model}] Unable to update many documents`)
      if (!results.value) throw new Error(`[${schema.model}] Unable to update many documents`)

      newDocs.push(results.value)
    }
  }

  return [undefined, newDocs]
}

export async function updateMany<T>(schema: Schema<T>, query: FilterQuery<T>, update: AnyUpdate<T>, options: UpdateManyOptions = {}): Promise<Document<T>[] | boolean> {
  if ((schema.noUpdates === true) || (schema.noUpdateMany === true)) throw new Error(`[${schema.model}] Multiple updates are disallowed for this model`)

  const collection = await db.getCollection(schema.collection)
  const results = await collection.updateMany(query, update, options)

  if (results.result.ok !== 1) throw new Error(`[${schema.model}] Unable to update many documents`)
  if (results.result.n <= 0) return false

  return true
}
