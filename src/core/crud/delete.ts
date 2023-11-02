import { type DeleteOptions, type Filter, type FindOneAndDeleteOptions } from 'mongodb'
import * as db from '../../index.js'
import { type AnyProps, type Document } from '../../types/index.js'
import { type Schema } from '../Schema.js'
import { findMany } from './find.js'

export async function deleteOne<P extends AnyProps = AnyProps>(schema: Schema<P>, filter: Filter<Document<P>>, options: DeleteOptions = {}): Promise<boolean> {
  if (schema.noDeletes === true) throw new Error(`[${schema.model}] Deletions are disallowed for this model`)

  const collection = await db.getCollection<Document<P>>(schema.collection)
  const result = await collection.deleteOne(filter, options)

  if (!result.acknowledged) throw new Error(`[${schema.model}] Unable to delete document`)
  if (result.deletedCount > 0) return true

  return false
}

export async function findAndDeleteOne<P extends AnyProps = AnyProps>(schema: Schema<P>, filter: Filter<Document<P>>, options: FindOneAndDeleteOptions = {}): Promise<Document<P>> {
  if (schema.noDeletes === true) throw new Error(`[${schema.model}] Deletions are disallowed for this model`)

  const collection = await db.getCollection<Document<P>>(schema.collection)
  const result = await collection.findOneAndDelete(filter, { includeResultMetadata: true })

  if (result.ok !== 1) throw new Error(`[${schema.model}] Unable to delete document`)
  if (!result.value) throw new Error(`[${schema.model}] Unable to return deleted document`)

  return result.value as Document<P>
}

export async function deleteMany<P extends AnyProps = AnyProps>(schema: Schema<P>, filter: Filter<Document<P>>, options: DeleteOptions = {}): Promise<boolean> {
  if (schema.noDeletes === true || schema.noDeleteMany === true) throw new Error(`[${schema.model}] Multiple deletions are disallowed for this model`)

  const collection = await db.getCollection<Document<P>>(schema.collection)
  const result = await collection.deleteMany(filter, options)

  if (!result.acknowledged) throw new Error(`[${schema.model}] Unable to delete documents`)
  if (result.deletedCount > 0) return true

  return false
}

export async function findManyAndDelete<P extends AnyProps = AnyProps>(schema: Schema<P>, filter: Filter<Document<P>>, options: FindOneAndDeleteOptions = {}): Promise<Document<P>[]> {
  if (schema.noDeletes === true || schema.noDeleteMany === true) throw new Error(`[${schema.model}] Multiple deletions are disallowed for this model`)

  const collection = await db.getCollection<Document<P>>(schema.collection)
  const docs = await findMany(schema, filter)
  const n = docs.length
  const deletedDocs: Document<P>[] = []

  for (let i = 0; i < n; i++) {
    const doc = docs[i]
    const result = await collection.findOneAndDelete({ _id: doc._id } as Filter<Document<P>>, { includeResultMetadata: true })

    if (result.ok !== 1) throw new Error(`[${schema.model}] Unable to delete documents`)

    if (result.value) {
      deletedDocs.push(result.value as Document<P>)
    }
  }

  return deletedDocs
}
