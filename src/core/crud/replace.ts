import { type Filter, type FindOneAndReplaceOptions, type ReplaceOptions } from 'mongodb'
import * as db from '../..'
import { type AnyProps, type Document, type InsertableDocument } from '../../types'
import { type Schema } from '../Schema'
import { findOne } from './find'

export async function replaceOne<P extends AnyProps = AnyProps>(schema: Schema<P>, filter: Filter<Document<P>>, replacement: InsertableDocument<P>, options: ReplaceOptions = {}): Promise<boolean> {
  const collection = await db.getCollection<Document<P>>(schema.collection)
  const result = await collection.replaceOne(filter, replacement, { ...options })

  if (!result.acknowledged) throw new Error(`[${schema.model}] Unable to find and replace document`)
  if (options.upsert === true && result.upsertedCount > 0) return true
  if (result.modifiedCount > 0) return true

  return false
}

export async function findOneAndReplace<P extends AnyProps = AnyProps>(schema: Schema<P>, filter: Filter<Document<P>>, replacement: InsertableDocument<P>, options: FindOneAndReplaceOptions = {}): Promise<[Document<P>, Document<P>]> {
  const collection = await db.getCollection<Document<P>>(schema.collection)
  const result = await collection.findOneAndReplace(filter, replacement, { ...options, returnDocument: 'before', includeResultMetadata: true })

  if (result.ok !== 1) throw new Error(`[${schema.model}] Unable to find and replace document`)

  const oldDoc = result.value as Document<P> | null

  if (!oldDoc) throw new Error(`[${schema.model}] Unable to return the old document`)

  const newDoc = await findOne(schema, replacement)

  if (!newDoc) throw new Error(`[${schema.model}] Document is replaced but unable to find the new document in the database`)

  return [oldDoc, newDoc]
}
