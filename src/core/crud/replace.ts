import { Filter, FindOneAndReplaceOptions, ReplaceOptions } from 'mongodb'
import * as db from '../..'
import { AnyProps, Document, OptionallyIdentifiableDocument } from '../../types'
import Schema from '../Schema'
import { findOne } from './find'

export async function replaceOne<P extends AnyProps = AnyProps>(schema: Schema<P>, filter: Filter<Document<P>>, replacement: OptionallyIdentifiableDocument<P>, options: ReplaceOptions = {}): Promise<void> {
  const collection = await db.getCollection<Document<P>>(schema.collection)
  const result = await collection.replaceOne(filter, replacement, { ...options })

  if (!result.acknowledged) throw new Error(`[${schema.model}] Unable to find and replace document`)
  if (result.matchedCount <= 0) throw new Error(`[${schema.model}] Unable to find and replace document`)
}

export async function findOneAndReplace<P extends AnyProps = AnyProps>(schema: Schema<P>, filter: Filter<Document<P>>, replacement: OptionallyIdentifiableDocument<P>, options: FindOneAndReplaceOptions = {}): Promise<[Document<P>, Document<P>]> {
  const collection = await db.getCollection<Document<P>>(schema.collection)
  const result = await collection.findOneAndReplace(filter, replacement, { ...options, returnDocument: 'before' })

  if (result.ok !== 1) throw new Error(`[${schema.model}] Unable to find and replace document`)

  const oldDoc = result.value

  if (!oldDoc) throw new Error(`[${schema.model}] Unable to return the old document`)

  const newDoc = await findOne(schema, replacement)

  if (!newDoc) throw new Error(`[${schema.model}] Document is replaced but unable to find the new document in the database`)

  return [oldDoc, newDoc]
}
