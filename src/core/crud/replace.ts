import { FindOneAndReplaceOption, ReplaceOneOptions } from 'mongodb'
import * as db from '../..'
import { Document, DocumentFragment, AnyFilter, Schema } from '../../types'
import { findOne } from './find'

export async function replaceOne<T>(schema: Schema<T>, query: AnyFilter<T>, replacement: DocumentFragment<T>, options: ReplaceOneOptions = {}): Promise<void> {
  const collection = await db.getCollection(schema.collection)
  const result = await collection.replaceOne(query as any, replacement, { ...options })

  if (result.result.ok !== 1) throw new Error(`[${schema.model}] Unable to find and replace document`)
}

export async function findOneAndReplace<T>(schema: Schema<T>, query: AnyFilter<T>, replacement: DocumentFragment<T>, options: FindOneAndReplaceOption<T> = {}): Promise<[Document<T>, Document<T>]> {
  const collection = await db.getCollection(schema.collection)
  const results = await collection.findOneAndReplace(query as any, replacement, { ...options, returnDocument: 'before' })

  if (results.ok !== 1) throw new Error(`[${schema.model}] Unable to find and replace document`)

  const oldDoc = results.value

  if (!oldDoc) throw new Error(`[${schema.model}] Unable to return the old document`)

  const newDoc = await findOne(schema, replacement)

  if (!newDoc) throw new Error(`[${schema.model}] Document is replaced but unable to find the new document in the database`)

  return [oldDoc, newDoc]
}
