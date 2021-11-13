import _ from 'lodash'
import { CommonOptions, FilterQuery } from 'mongodb'
import * as db from '../..'
import { AnyFilter, Document } from '../../types'
import Schema from '../Schema'
import { findMany } from './find'

export async function deleteOne<T>(schema: Schema<T>, query: FilterQuery<T>, options: CommonOptions = {}): Promise<void> {
  if (schema.noDeletes === true) throw new Error(`[${schema.model}] Deletions are disallowed for this model`)

  const collection = await db.getCollection(schema.collection)
  const result = await collection.deleteOne(query, options)

  if (result.result.ok !== 1) throw new Error(`[${schema.model}] Unable to delete document`)
  if (!_.isNumber(result.result.n) || (result.result.n <= 0)) throw new Error(`[${schema.model}] Unable to delete document`)
}

export async function findAndDeleteOne<T>(schema: Schema<T>, query: AnyFilter<T>, options: CommonOptions = {}): Promise<Document<T>> {
  if (schema.noDeletes === true) throw new Error(`[${schema.model}] Deletions are disallowed for this model`)

  const collection = await db.getCollection(schema.collection)
  const result = await collection.findOneAndDelete(query as any)

  if (result.ok !== 1) throw new Error(`[${schema.model}] Unable to delete document`)
  if (!result.value) throw new Error(`[${schema.model}] Unable to return deleted document`)

  return result.value
}

export async function deleteMany<T>(schema: Schema<T>, query: AnyFilter<T>, options: CommonOptions = {}): Promise<boolean> {
  if ((schema.noDeletes === true) || (schema.noDeleteMany === true)) throw new Error(`[${schema.model}] Multiple deletions are disallowed for this model`)

  const collection = await db.getCollection(schema.collection)
  const result = await collection.deleteMany(query as any, options)

  if (result.result.ok !== 1) throw new Error(`[${schema.model}] Unable to delete documents`)

  if (!_.isNumber(result.result.n) || (result.result.n <= 0)) return false

  return true
}

export async function findManyAndDelete<T>(schema: Schema<T>, query: AnyFilter<T>, options: CommonOptions = {}): Promise<Document<T>[]> {
  if ((schema.noDeletes === true) || (schema.noDeleteMany === true)) throw new Error(`[${schema.model}] Multiple deletions are disallowed for this model`)

  const collection = await db.getCollection(schema.collection)
  const docs = await findMany(schema, query)
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
