import { DeleteOptions, Filter, FindOneAndDeleteOptions } from 'mongodb'
import * as db from '../..'
import { AnyProps, Document } from '../../types'
import Schema from '../Schema'
import { findMany } from './find'

export async function deleteOne<T extends AnyProps = AnyProps>(schema: Schema<T>, filter: Filter<Document<T>>, options: DeleteOptions = {}): Promise<boolean> {
  if (schema.noDeletes === true) throw new Error(`[${schema.model}] Deletions are disallowed for this model`)

  const collection = await db.getCollection<Document<T>>(schema.collection)
  const result = await collection.deleteOne(filter, options)

  if (!result.acknowledged) throw new Error(`[${schema.model}] Unable to delete document`)
  if (result.deletedCount > 0) return true
  return false
}

export async function findAndDeleteOne<T extends AnyProps = AnyProps>(schema: Schema<T>, filter: Filter<Document<T>>, options: FindOneAndDeleteOptions = {}): Promise<Document<T>> {
  if (schema.noDeletes === true) throw new Error(`[${schema.model}] Deletions are disallowed for this model`)

  const collection = await db.getCollection<Document<T>>(schema.collection)
  const result = await collection.findOneAndDelete(filter)

  if (result.ok !== 1) throw new Error(`[${schema.model}] Unable to delete document`)
  if (!result.value) throw new Error(`[${schema.model}] Unable to return deleted document`)

  return result.value
}

export async function deleteMany<T extends AnyProps = AnyProps>(schema: Schema<T>, filter: Filter<Document<T>>, options: DeleteOptions = {}): Promise<boolean> {
  if ((schema.noDeletes === true) || (schema.noDeleteMany === true)) throw new Error(`[${schema.model}] Multiple deletions are disallowed for this model`)

  const collection = await db.getCollection<Document<T>>(schema.collection)
  const result = await collection.deleteMany(filter, options)

  if (!result.acknowledged) throw new Error(`[${schema.model}] Unable to delete documents`)
  if (result.deletedCount > 0) return true

  return false
}

export async function findManyAndDelete<T extends AnyProps = AnyProps>(schema: Schema<T>, filter: Filter<Document<T>>, options: FindOneAndDeleteOptions = {}): Promise<Document<T>[]> {
  if ((schema.noDeletes === true) || (schema.noDeleteMany === true)) throw new Error(`[${schema.model}] Multiple deletions are disallowed for this model`)

  const collection = await db.getCollection<Document<T>>(schema.collection)
  const docs = await findMany(schema, filter)
  const n = docs.length
  const results: Document<T>[] = []

  for (let i = 0; i < n; i++) {
    const doc = docs[i]
    const result = await collection.findOneAndDelete({ _id: doc._id })

    if (result.ok !== 1) throw new Error(`[${schema.model}] Unable to delete documents`)

    if (result.value) {
      results.push(result.value)
    }
  }

  return results
}
