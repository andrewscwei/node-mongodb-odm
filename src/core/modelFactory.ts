/**
 * @file This is a static, abstract model that provides ORM for a single MongoDB collection. Every
 *       other model must inherit this class. It sets up the ground work for basic CRUD operations,
 *       event triggers, query validations, etc. All returned documents are native JSON objects.
 */

import bcrypt from 'bcrypt'
import _ from 'lodash'
import { Collection, FilterQuery, ObjectID, PushOperator, SetFields, UpdateQuery } from 'mongodb'
import * as db from '..'
import { AggregationPipeline, Document, DocumentFragment, FieldDefaultValueFunction, FieldDescriptor, FieldFormatFunction, FieldRandomValueFunction, FieldSpec, FieldValidationStrategy, ModelCountOptions, ModelDeleteManyOptions, ModelDeleteOneOptions, ModelFindManyOptions, ModelFindOneOptions, ModelInsertManyOptions, ModelInsertOneOptions, ModelRandomFieldsOptions, ModelReplaceOneOptions, ModelUpdateManyOptions, ModelUpdateOneOptions, ModelValidateDocumentOptions, PipelineFactoryOperators, PipelineFactoryOptions, Query, Schema, typeIsFieldDescriptor, typeIsUpdateQuery, typeIsValidObjectID, Update } from '../types'
import getFieldSpecByKey from '../utils/getFieldSpecByKey'
import sanitizeDocument from '../utils/sanitizeDocument'
import sanitizeQuery from '../utils/sanitizeQuery'
import validateFieldValue from '../utils/validateFieldValue'
import Aggregation from './Aggregation'
import Model from './Model'

/**
 * Creates a static model class with the provided schema.
 *
 * @param schema - The schema of the model to be generated.
 *
 * @returns The generated static model.
 */
export default function modelFactory<T>(schema: Schema<T>): Model<T> {
  const debug = process.env.NODE_ENV === 'development' ? require('debug')(`mongodb-odm:model:${schema.model}`) : () => {}

  return class {

    /** @inheritdoc */
    static readonly schema = schema

    /** @inheritdoc */
    static readonly randomProps: { [K in keyof T]?: FieldRandomValueFunction<NonNullable<T[K]>> } = {}

    /** @inheritdoc */
    static readonly defaultProps: { [K in keyof T]?: NonNullable<T[K]> | FieldDefaultValueFunction<NonNullable<T[K]>> } = {}

    /** @inheritdoc */
    static readonly formatProps: { [K in keyof T]?: FieldFormatFunction<NonNullable<T[K]>> } = {}

    /** @inheritdoc */
    static readonly validateProps: { [K in keyof T]?: FieldValidationStrategy<NonNullable<T[K]>> } = {}

    /** @inheritdoc */
    constructor() {
      throw new Error('This is a static class and is prohibited from being instantiated')
    }

    /** @inheritdoc */
    static async getCollection(): Promise<Collection> {
      if (!this.schema) throw new Error(`[${this.constructor.name}] This model has no schema, you must define this static property in the derived class`)

      return db.getCollection(this.schema.collection)
    }

    /** @inheritdoc */
    static async randomFields(fixedFields: DocumentFragment<T> = {}, { includeOptionals = false }: ModelRandomFieldsOptions = {}): Promise<DocumentFragment<T>> {
      const o: DocumentFragment<T> = {}

      const fields = this.schema.fields

      for (const key in this.randomProps) {
        if (!fields.hasOwnProperty(key)) continue

        // If `includeOptionals` is not set, skip all the optional fields.
        if (!includeOptionals && !fields[key].required) continue

        const func = this.randomProps[key]

        if (!_.isFunction(func)) throw new Error(`[${this.schema.model}] Property "${key}" in randomProps must be a function`)

        // Use provided random function if provided in the schema.
        o[key] = func() as any
      }

      for (const key in fixedFields) {
        if (!fixedFields.hasOwnProperty(key)) continue
        o[key as keyof T] = fixedFields[key as keyof T]
      }

      return o
    }

    /** @inheritdoc */
    static pipeline(queryOrOperators?: Query<T> | PipelineFactoryOperators<T>, options?: PipelineFactoryOptions): AggregationPipeline {
      if (!this.schema) throw new Error(`[${this.constructor.name}] This model has no schema, you must define this static proerty in the derived class`)

      // Check if the argument conforms to aggregation factory operators.
      if (queryOrOperators && Object.keys(queryOrOperators).some(val => val.startsWith('$'))) {
        return Aggregation.pipelineFactory(this.schema, queryOrOperators as PipelineFactoryOperators<T>, options)
      }
      // Otherwise the argument is a query for the $match stage.
      else {
        return Aggregation.pipelineFactory(this.schema, { $match: queryOrOperators as Query<T> }, options)
      }
    }

    /** @inheritdoc */
    static async identifyOneStrict(query: Query<T>): Promise<ObjectID> {
      const result = await this.findOne(query)

      if (!result) throw new Error(`[${this.schema.model}] No results found while identifying this ${this.schema.model} using the query ${JSON.stringify(query, undefined, 0)}`)
      if (!ObjectID.isValid(result._id)) throw new Error(`[${this.schema.model}] ID of ${result} is not a valid ObjectID`)

      return result._id
    }

    /** @inheritdoc */
    static async identifyOne(query: Query<T>): Promise<ObjectID | undefined> {
      try {
        const o = await this.identifyOneStrict(query)
        return o
      }
      catch (err) {
        return undefined
      }
    }

    /** @inheritdoc */
    static async identifyMany(query?: Query<T>): Promise<ObjectID[]> {
      const collection = await this.getCollection()
      const res = await collection.aggregate([
        ...this.pipeline(query),
        {
          $group: {
            _id: undefined,
            ids: { $addToSet: '$_id' },
          },
        },
      ]).toArray()

      if (res.length === 0) return []
      return res[0].ids || []
    }

    /** @inheritdoc */
    static async findOneStrict<R = T>(query?: Query<T>, options?: ModelFindOneOptions): Promise<Document<R>> {
      const opts = options ?? {}

      if (!query) {
        const collection = await this.getCollection()
        const results = await collection.aggregate(this.pipeline().concat([{ $sample: { size: 1 } }])).toArray()

        if (results.length !== 1) throw new Error(`[${this.schema.model}] More or less than 1 random document found even though only 1 was supposed to be found.`)

        return results[0]
      }
      else {
        const results = await this.findMany<R>(query, opts)

        if (results.length === 0) throw new Error(`[${this.schema.model}] No document found with provided query`)

        return results[0]
      }
    }

    /** @inheritdoc */
    static async findOne<R = T>(query?: Query<T>, options?: ModelFindOneOptions): Promise<Document<R> | undefined> {
      const opts = options ?? {}

      try {
        const o = await this.findOneStrict<R>(query, opts)
        return o
      }
      catch (err) {
        return undefined
      }
    }

    /** @inheritdoc */
    static async findMany<R = T>(query?: Query<T>, options?: ModelFindManyOptions): Promise<Document<R>[]> {
      const opts = options ?? {}
      const collection = await this.getCollection()
      const results = await collection.aggregate(this.pipeline(query), opts).toArray()
      return results
    }

    /** @inheritdoc */
    static async insertOneStrict(doc?: DocumentFragment<T>, options?: ModelInsertOneOptions): Promise<Document<T>> {
      if (this.schema.noInserts === true) throw new Error(`[${this.schema.model}] Insertions are disallowed for this model`)

      const opts = options ?? {}

      // Apply before insert handler.
      const t = await this.beforeInsert(doc || (await this.randomFields()), { strict: true, ...opts })

      const collection = await this.getCollection()
      const results = await collection.insertOne(t, opts).catch(error => { throw error })

      debug('Inserting new document...', 'OK', JSON.stringify(t, undefined, 0), JSON.stringify(results, undefined, 0))

      if (results.result.ok !== 1) throw new Error(`[${this.schema.model}] Unable to insert document`)
      if (results.ops.length > 1) throw new Error(`[${this.schema.model}] Somehow insertOne() op inserted more than 1 document`)
      if (results.ops.length < 1) throw new Error(`[${this.schema.model}] Unable to insert document`)

      const o = results.ops[0] as Document<T>

      // Apply after insert handler.
      await this.afterInsert(o)

      return o
    }

    static async insertOne(doc?: DocumentFragment<T>, options?: ModelInsertOneOptions): Promise<Document<T> | undefined> {
      const opts = options ?? {}

      try {
        const o = await this.insertOneStrict(doc, opts)
        return o
      }
      catch (err) {
        return undefined
      }
    }

    /** @inheritdoc */
    static async insertMany(docs: DocumentFragment<T>[], options?: ModelInsertManyOptions): Promise<Document<T>[]> {
      if ((this.schema.noInserts === true) || (this.schema.noInsertMany === true)) throw new Error(`[${this.schema.model}] Multiple insertions are disallowed for this model`)

      const opts = options ?? {}
      const n = docs.length
      const t: typeof docs = new Array(n)

      // Apply before insert handler to each document.
      for (let i = 0; i < n; i++) {
        t[i] = await this.beforeInsert(docs[i])
      }

      const collection = await this.getCollection()
      const results = await collection.insertMany(t, opts)

      debug('Inserting multiple documents...', 'OK', JSON.stringify(t, undefined, 0), JSON.stringify(results, undefined, 0))

      if (results.result.ok !== 1) throw new Error(`[${this.schema.model}] Unable to insert many documents`)

      const o = results.ops as Document<T>[]
      const m = o.length

      for (let i = 0; i < m; i++) {
        await this.afterInsert(o[i])
      }

      return o
    }

    /** @inheritdoc */
    static async updateOneStrict(query: Query<T>, update: Update<T>, options?: ModelUpdateOneOptions<T>): Promise<void | Document<T>> {
      if (this.schema.noUpdates === true) throw new Error(`[${this.schema.model}] Updates are disallowed for this model`)

      const opts = options ?? {}

      const collection = await this.getCollection()
      const [q, u] = (opts.skipHooks === true) ? [query, update] : await this.beforeUpdate(query, update, opts)

      if (opts.returnDoc === true) {
        if (!_.isPlainObject(q)) {
          throw new Error(`[${this.schema.model}] Invalid query, maybe it is not sanitized? This could happen if you enabled skipHooks in the options, in which case you will need to sanitize the query yourself`)
        }

        // Need to keep the original doc for the didUpdateDocument() hook.
        const res = await collection.findOneAndUpdate(q as { [key: string]: any }, u, { ...opts, returnDocument: 'before' })

        debug('Updating an existing document...', 'OK', JSON.stringify(q, undefined, 0), JSON.stringify(u, undefined, 0), JSON.stringify(opts, undefined, 0), JSON.stringify(res, undefined, 0))

        if (res.ok !== 1) throw new Error(`[${this.schema.model}] Update failed`)

        let oldDoc
        let newDoc

        // Handle upserts properly.
        if (!res.lastErrorObject.upserted) {
          oldDoc = res.value

          if (!oldDoc) throw new Error(`[${this.schema.model}] Unable to return the old document before the update`)

          newDoc = await this.findOne<T>(oldDoc._id)
        }
        else {
          newDoc = await this.findOne<T>(res.lastErrorObject.upserted)
        }

        if (!newDoc) {
          throw new Error(`[${this.schema.model}] Unable to find the updated doc`)
        }

        if (opts.skipHooks !== true) {
          await this.afterUpdate(oldDoc, newDoc)
        }

        return newDoc
      }
      else {
        if (!_.isPlainObject(q)) {
          throw new Error(`[${this.schema.model}] Invalid query, maybe it is not sanitized? This could happen if you enabled skipHooks in the options, in which case you will need to sanitize the query yourself`)
        }

        const res = await collection.updateOne(q as { [key: string]: any }, u, opts)

        debug('Updating an existing document...', 'OK', JSON.stringify(q, undefined, 0), JSON.stringify(u, undefined, 0), JSON.stringify(opts, undefined, 0), JSON.stringify(res, undefined, 0))

        if (res.result.ok !== 1) throw new Error(`[${this.schema.model}] Unable to update the document`)
        if (res.result.n <= 0) throw new Error(`[${this.schema.model}] Unable to update the document`)

        if (opts.skipHooks !== true) {
          await this.afterUpdate()
        }
      }
    }

    /** @inheritdoc */
    static async updateOne(query: Query<T>, update: Update<T>, options?: ModelUpdateOneOptions<T>): Promise<boolean | Document<T> | undefined> {
      const opts = options ?? {}

      try {
        const o = await this.updateOneStrict(query, update, opts)

        if (o && opts.returnDoc) return o

        return true
      }
      catch (err) {
        return opts.returnDoc ? undefined : false
      }
    }

    /** @inheritdoc */
    static async updateMany(query: Query<T>, update: Update<T>, options?: ModelUpdateManyOptions<T>): Promise<Document<T>[] | boolean> {
      if ((this.schema.noUpdates === true) || (this.schema.noUpdateMany === true)) throw new Error(`[${this.schema.model}] Multiple updates are disallowed for this model`)

      const opts = options ?? {}
      const [q, u] = await this.beforeUpdate(query, update, opts)
      const collection = await this.getCollection()

      if (opts.returnDocs === true) {
        const docs = await this.findMany<T>(q)
        const n = docs.length
        const results: Document<T>[] = []

        if ((n <= 0) && (opts.upsert === true)) {
          const res = await this.updateOne(q, u, { ...opts, returnDoc: true, skipHooks: true })

          if (_.isBoolean(res) || _.isNil(res)) {
            throw new Error(`[${this.schema.model}] Error upserting document during an updateMany operation`)
          }

          results.push(res)
        }
        else {
          for (let i = 0; i < n; i++) {
            const doc = docs[i]
            const result = await collection.findOneAndUpdate({ _id: doc._id }, u, { returnDocument: 'after', ...opts })

            if (result.ok !== 1) throw new Error(`[${this.schema.model}] Unable to update many documents`)
            if (!result.value) throw new Error(`[${this.schema.model}] Unable to update many documents`)

            results.push(result.value)
          }

          debug('Updating multiple existing documents...', 'OK', JSON.stringify(q, undefined, 0), JSON.stringify(u, undefined, 0), JSON.stringify(opts, undefined, 0), JSON.stringify(results, undefined, 0))
        }

        await this.afterUpdate(undefined, results)

        return results
      }
      else {
        const results = await collection.updateMany(q, u, opts)

        debug('Updating multiple existing documents...', 'OK', JSON.stringify(q, undefined, 0), JSON.stringify(u, undefined, 0), JSON.stringify(opts, undefined, 0), JSON.stringify(results, undefined, 0))

        if (results.result.ok !== 1) throw new Error(`[${this.schema.model}] Unable to update many documents`)

        if (results.result.n <= 0) return false

        await this.afterUpdate()

        return true
      }
    }

    /** @inheritdoc */
    static async deleteOneStrict(query: Query<T>, options?: ModelDeleteOneOptions): Promise<Document<T> | void> {
      if (this.schema.noDeletes === true) throw new Error(`[${this.schema.model}] Deletions are disallowed for this model`)

      const opts = options ?? {}

      const q = await this.beforeDelete(query, opts)

      const collection = await this.getCollection()

      if (opts.returnDoc === true) {
        const results = await collection.findOneAndDelete(q)

        debug('Deleting an existing document...', 'OK', JSON.stringify(query, undefined, 0), JSON.stringify(results, undefined, 0))

        if (results.ok !== 1) throw new Error(`[${this.schema.model}] Unable to delete document`)
        if (!results.value) throw new Error(`[${this.schema.model}] Unable to return deleted document`)

        await this.afterDelete(results.value)

        return results.value
      }
      else {
        const results = await collection.deleteOne(q, opts)

        debug('Deleting an existing document...', 'OK', JSON.stringify(query, undefined, 0), JSON.stringify(results, undefined, 0))

        if (results.result.ok !== 1) throw new Error(`[${this.schema.model}] Unable to delete document`)
        if (!_.isNumber(results.result.n) || (results.result.n <= 0)) throw new Error(`[${this.schema.model}] Unable to delete document`)

        await this.afterDelete()
      }
    }

    /** @inheritdoc */
    static async deleteOne(query: Query<T>, options?: ModelDeleteOneOptions): Promise<Document<T> | boolean | undefined> {
      const opts = options ?? {}

      try {
        const o = await this.deleteOneStrict(query, opts)

        if (opts.returnDoc && o) {
          return o
        }
        else {
          return true
        }
      }
      catch (err) {
        return opts.returnDoc ? undefined : false
      }
    }

    /** @inheritdoc */
    static async deleteMany(query: Query<T>, options?: ModelDeleteManyOptions): Promise<boolean | Document<T>[]> {
      if ((this.schema.noDeletes === true) || (this.schema.noDeleteMany === true)) throw new Error(`[${this.schema.model}] Multiple deletions are disallowed for this model`)

      const opts = options ?? {}

      const q = await this.beforeDelete(query, opts)

      const collection = await this.getCollection()

      if (opts.returnDocs === true) {
        const docs = await this.findMany<T>(q)
        const n = docs.length
        const results: Document<T>[] = []

        for (let i = 0; i < n; i++) {
          const doc = docs[i]
          const result = await collection.findOneAndDelete({ _id: doc._id })

          if (result.ok !== 1) throw new Error(`[${this.schema.model}] Unable to delete documents`)

          if (result.value) {
            results.push(result.value)
          }
        }

        debug('Deleting multiple existing documents...:', 'OK', JSON.stringify(q, undefined, 0), JSON.stringify(results, undefined, 0))

        await this.afterDelete(results)

        return results
      }
      else {
        const results = await collection.deleteMany(q, { ...opts })

        debug('Deleting multiple existing documents...:', 'OK', JSON.stringify(q, undefined, 0), JSON.stringify(results, undefined, 0))

        if (results.result.ok !== 1) throw new Error(`[${this.schema.model}] Unable to delete documents`)

        if (!_.isNumber(results.result.n) || (results.result.n <= 0)) return false

        await this.afterDelete()

        return true
      }
    }

    /** @inheritdoc */
    static async findAndReplaceOneStrict(query: Query<T>, replacement?: DocumentFragment<T>, options?: ModelReplaceOneOptions<T>): Promise<Document<T>> {
      const opts = options ?? {}
      const q = await this.beforeDelete(query, opts)
      const r = await this.beforeInsert(replacement || (await this.randomFields()), opts)

      const collection = await this.getCollection()
      const results = await collection.findOneAndReplace(q, r, { ...opts, returnDocument: 'before' })

      debug('Replacing an existing document...', 'OK', JSON.stringify(q, undefined, 0), JSON.stringify(r, undefined, 0), JSON.stringify(results, undefined, 0))

      if (results.ok !== 1) throw new Error(`[${this.schema.model}] Unable to find and replace document`)

      const oldDoc = results.value

      if (!oldDoc) throw new Error(`[${this.schema.model}] Unable to return the old document`)

      const newDoc = await this.findOne<T>(r)

      if (!newDoc) {
        throw new Error(`[${this.schema.model}] Document is replaced but unable to find the new document in the database`)
      }

      await this.afterDelete(results.value)
      await this.afterInsert(newDoc)

      return (opts.returnDocument === 'before') ? oldDoc : newDoc
    }

    /** @inheritdoc */
    static async findAndReplaceOne(query: Query<T>, replacement?: DocumentFragment<T>, options?: ModelReplaceOneOptions<T>): Promise<Document<T> | undefined> {
      const opts = options ?? {}

      try {
        const o = await this.findAndReplaceOneStrict(query, replacement, opts)
        return o
      }
      catch (err) {
        return undefined
      }
    }

    /** @inheritdoc */
    static async exists(query: Query<T>): Promise<boolean> {
      const id = await this.identifyOne(query)

      return id ? true : false
    }

    /** @inheritdoc */
    static async count(query: Query<T>, options: ModelCountOptions = {}): Promise<number> {
      const results = await this.findMany(query, options)

      return results.length
    }

    /** @inheritdoc */
    static async formatDocument(doc: DocumentFragment<T>): Promise<DocumentFragment<T>> {
      const formattedDoc = _.cloneDeep(doc)
      const fields = this.schema.fields

      for (const key in this.schema.fields) {
        if (!formattedDoc.hasOwnProperty(key)) continue

        const fieldSpec = fields[key]
        const formatter = this.formatProps[key]

        if (!fieldSpec) throw new Error(`[${this.schema.model}] Field ${key} not found in schema`)

        // If the schema has a certain formatting function defined for this field, apply it.
        if (_.isFunction(formatter)) {
          const formattedValue = await formatter(formattedDoc[key] as any)
          formattedDoc[key] = formattedValue as any
        }

        // If the schema indicates that this field is encrypted, encrypt it.
        if (fieldSpec.encrypted === true) {
          formattedDoc[key] = await bcrypt.hash(`${formattedDoc[key]}`, 10) as any
        }
      }

      return formattedDoc
    }

    /** @inheritdoc */
    static async validateDocument(doc: DocumentFragment<T>, options: ModelValidateDocumentOptions = {}) {
      if (_.isEmpty(doc)) throw new Error(`[${this.schema.model}] Empty objects are not permitted`)

      for (const key in doc) {
        if (!doc.hasOwnProperty(key)) continue

        // Skip validation for fields `_id`, `updatedAt` and `createdAt` since they are
        // automatically generated, but only if validating top-level fields.
        if (key === '_id') continue
        if (this.schema.timestamps && (key === 'updatedAt')) continue
        if (this.schema.timestamps && (key === 'createdAt')) continue

        // #1 Check if field is defined in the schema.
        const fieldSpec = options.accountForDotNotation ? getFieldSpecByKey(this.schema.fields, key) : schema.fields[key as keyof T]
        if (!fieldSpec) throw new Error(`[${this.schema.model}] The field '${key}' is not defined in the ${JSON.stringify(this.schema.fields, undefined, 0)}`)

        // #2 Check if field value conforms to its defined spec. Note that the key can be in dot
        // notation because this method may also be used when applying doc updates.
        const val = _.get(doc, key, undefined)
        const validationStrategy = _.get(this.validateProps, key, undefined)

        try {
          validateFieldValue(val, fieldSpec, validationStrategy)
        }
        catch (err) {
          debug(`Validating value ${JSON.stringify(val)} for field "${key}"...`, 'ERR', err)
          throw err
        }
      }

      // #3 Check for unique fields only if `ignoreUniqueIndex` is not `true`.
      if ((options.ignoreUniqueIndex !== true) && this.schema.indexes) {
        const n = this.schema.indexes.length

        for (let i = 0; i < n; i++) {
          const index = this.schema.indexes[i]

          if (!index.options) continue
          if (!index.options.unique) continue
          if (!index.spec) continue
          if (!Object.keys(index.spec).every(v => Object.keys(doc).indexOf(v) > -1)) continue

          const uniqueQuery = _.pick(doc, Object.keys(index.spec))

          if (await this.findOne(uniqueQuery)) throw new Error(`[${this.schema.model}] Another document already exists with ${JSON.stringify(uniqueQuery, undefined, 0)}`)
        }
      }

      // #4 Check for required fields if `strict` is `true`.
      if (options.strict === true) {
        this.validateDocumentRequiredFields(doc)
      }
    }

    /**
     * Handler called before an attempt to insert document into the database. This is a good place
     * to apply any custom pre-processing to the document before it is inserted into the document.
     * This method must return the document to be inserted.
     *
     * @param doc - The document to be inserted.
     * @param options - Additional options.
     *
     * @returns The document to be inserted.
     */
    protected static async willInsertDocument(doc: DocumentFragment<T>): Promise<DocumentFragment<T>> {
      return doc
    }

    /**
     * Handler called after the document is successfully inserted.
     *
     * @param doc - The inserted document.
     */
    protected static async didInsertDocument(doc: Document<T>): Promise<void> {}

    /**
     * Handler called before an attempted update operation. This method must return the query and
     * update descriptor for the update operation.
     *
     * @param query - The query for document(s) to update.
     * @param update - The update descriptor.
     *
     * @returns A tuple of the query and the update descriptor.
     */
    protected static async willUpdateDocument(query: Query<T>, update: Update<T>): Promise<[Query<T>, Update<T>]> {
      return [query, update]
    }

    /**
     * Handler called after a document or a set of documents have been successfully updated.
     *
     * @param prevDoc - The document before it is updated. This is only available if `returnDoc` was
     *                  enabled, and only for updateOne().
     * @param newDocs - The updated document(s). This is only available if `returnDoc` or
     *                  `returnDocs` was enabled.
     */
    protected static async didUpdateDocument(prevDoc?: Document<T>, newDocs?: Document<T> | Document<T>[]): Promise<void> {}

    /**
     * Handler called before an attempt to delete a document.
     *
     * @param query - The query for the document to be deleted.
     *
     * @returns The document to be deleted.
     */
    protected static async willDeleteDocument(query: Query<T>): Promise<Query<T>> {
      return query
    }

    /**
     * Handler called after a document or a set of documents are successfully deleted.
     *
     * @param docs - The deleted document(s) if available.
     */
    protected static async didDeleteDocument(docs?: Document<T> | Document<T>[]): Promise<void> {}

    /**
     * Processes a document before it is inserted. This is also used during an upsert operation.
     *
     * @param doc - The document to be inserted/upserted.
     * @param options - See `ModelBeforeInsertOptions`.
     *
     * @returns Document to be inserted/upserted to the database.
     */
    private static async beforeInsert(doc: DocumentFragment<T>, options: ModelInsertOneOptions | ModelInsertManyOptions = {}): Promise<DocumentFragment<T>> {
      // Call event hook first.
      const d = await this.willInsertDocument(doc)

      let o = sanitizeDocument<T>(this.schema, d)

      // Unless specified, always renew the `createdAt` and `updatedAt` fields.
      if ((this.schema.timestamps === true) && (options.ignoreTimestamps !== true)) {
        if (!_.isDate(o.createdAt)) o.createdAt = new Date() as any
        if (!_.isDate(o.updatedAt)) o.updatedAt = new Date() as any
      }

      // Before inserting this document, go through each field and make sure that it has default
      // values and that they are formatted correctly.
      for (const key in this.schema.fields) {
        if (!this.schema.fields.hasOwnProperty(key)) continue
        if (o.hasOwnProperty(key)) continue

        const defaultValue = this.defaultProps[key]

        // Check if the field has a default value defined in the schema. If so, apply it.
        if (_.isUndefined(defaultValue)) continue

        o[key as keyof T] = (_.isFunction(defaultValue)) ? defaultValue() as any : defaultValue as any
      }

      // Apply format function defined in the schema if applicable.
      o = await this.formatDocument(o)

      // Finally, validate the document as a final sanity check. Ignore unique indexes in this step.
      // Let the db throw an error if the inserted doc voilates those indexes.
      await this.validateDocument(o, { ignoreUniqueIndex: true, strict: true, accountForDotNotation: false, ...options })

      return o
    }

    /**
     * Handler invoked right after a document insertion.
     *
     * @param doc - The inserted document.
     */
    private static async afterInsert(doc: Document<T>): Promise<void> {
      await this.didInsertDocument(doc)
    }

    /**
     * Handler invoked right before an update. This is NOT invoked on an insertion.
     *
     * @param query - Query for document to update.
     * @param update - The update to apply.
     * @param options - See `ModelUpdateOneOptions` and `ModelUpdateManyOptions`.
     *
     * @returns The modified update to apply.
     *
     * @throws {Error} Attempting to upsert even though upserts are disabled in the schema.
     *
     * @todo Handle remaining update operators.
     */
    private static async beforeUpdate(query: Query<T>, update: Update<T>, options: ModelUpdateOneOptions<T> | ModelUpdateManyOptions<T> = {}): Promise<[DocumentFragment<T>, UpdateQuery<DocumentFragment<T>>]> {
      if ((options.upsert === true) && (this.schema.allowUpserts !== true)) throw new Error(`[${this.schema.model}] Attempting to upsert a document while upserting is disallowed in the schema`)

      const [q, u] = await this.willUpdateDocument(query, update)

      // First sanitize the inputs. We want to be able to make sure the query is valid and that the
      // update object is a proper update query.
      const sanitizedQuery = sanitizeQuery<T>(this.schema, q) as DocumentFragment<T>
      const sanitizedUpdate = (typeIsUpdateQuery<T>(u) ? { ...u } : { $set: u }) as UpdateQuery<DocumentFragment<T>>

      // Sanitize all update queries. Remap `null` or `undefined` values to `$unset`.
      if (sanitizedUpdate.$set) {
        // Remember which keys are `null` or `undefined` because when the object is sanitized in the
        // next step, all
        // fields whose values are `null` or `undefined` will be dropped.
        const obj: { [key: string]: any } = sanitizedUpdate.$set
        const unsetFields = Object.keys(obj).filter(v => ((obj[v] === null) || (obj[v] === undefined)))
        const n = unsetFields.length

        // Now sanitize the update object.
        sanitizedUpdate.$set = sanitizeDocument<T>(this.schema, sanitizedUpdate.$set, { accountForDotNotation: true })

        // Remap the previously remembered `null` or `undefined` values to an `$unset` atomic
        // operator.
        if (n > 0) {
          sanitizedUpdate.$unset = {}

          for (let i = 0; i < n; i++) {
            (sanitizedUpdate.$unset as any)[unsetFields[i]] = ''
          }
        }
      }

      // Determine if there are values to set upon upsert. If so, sanitize them.
      if (sanitizedUpdate.$setOnInsert) {
        sanitizedUpdate.$setOnInsert = sanitizeDocument<T>(this.schema, sanitizedUpdate.$setOnInsert, { accountForDotNotation: true })
      }

      // Determine if there are new values to add to array fields of the doc (minding duplicates).
      // If so, sanitize them.
      if (sanitizedUpdate.$addToSet) {
        sanitizedUpdate.$addToSet = sanitizeDocument<T>(this.schema, sanitizedUpdate.$addToSet as DocumentFragment<T>, { accountForDotNotation: true }) as SetFields<DocumentFragment<T>>
      }

      // Determine if there are new values to add to array fields of the doc (without minding
      // duplicates). If so, sanitize them.
      if (sanitizedUpdate.$push) {
        sanitizedUpdate.$push = sanitizeDocument<T>(this.schema, sanitizedUpdate.$push as DocumentFragment<T>, { accountForDotNotation: true }) as PushOperator<DocumentFragment<T>>
      }

      // Format all fields in the update query.
      if (sanitizedUpdate.$set) {
        sanitizedUpdate.$set = await this.formatDocument(sanitizedUpdate.$set as Document<T>)
      }

      // Add updated timestamps if applicable.
      if ((this.schema.timestamps === true) && (options.ignoreTimestamps !== true)) {
        if (!sanitizedUpdate.$set) sanitizedUpdate.$set = {}
        if (!_.isDate(sanitizedUpdate.$set.updatedAt)) sanitizedUpdate.$set = { ...sanitizedUpdate.$set, updatedAt: new Date() }
      }

      // In the case of an upsert, we need to preprocess the query as if this was an insertion. We
      // also need to tell the database to save all fields in the query to the database as well,
      // unless they are already in the update query.
      if (options.upsert === true) {
        // Make a copy of the query in case it is manipulated by the hooks.
        const beforeInsert = await this.beforeInsert(_.cloneDeep(sanitizedQuery), { ...options, strict: false })
        const setOnInsert = _.omit({
          ...sanitizedUpdate.$setOnInsert || {},
          ...beforeInsert,
        }, [
          ...Object.keys(sanitizedUpdate.$set || {}),
          ...Object.keys(sanitizedUpdate.$unset || {}),
        ]) as DocumentFragment<T>

        if (!_.isEmpty(setOnInsert)) {
          sanitizedUpdate.$setOnInsert = setOnInsert
        }
      }

      // Validate all fields in the update query. Account for dot notations to facilitate updating fields in embedded
      // docs.
      if (sanitizedUpdate.$set && !_.isEmpty(sanitizedUpdate.$set)) {
        await this.validateDocument(sanitizedUpdate.$set as DocumentFragment<T>, { ignoreUniqueIndex: true, accountForDotNotation: true, ...options })
      }

      // Strip empty objects.
      const { $set, $setOnInsert, $addToSet, $push, ...rest } = sanitizedUpdate
      const finalizedUpdate = {
        ...rest,
        ..._.isEmpty($set) ? {} : { $set },
        ..._.isEmpty($setOnInsert) ? {} : { $setOnInsert },
        ..._.isEmpty($addToSet) ? {} : { $addToSet },
        ..._.isEmpty($push) ? {} : { $push },
      }

      return [sanitizedQuery, finalizedUpdate]
    }

    /**
     * Handler invoked right after an update. This does not account for insertions.
     *
     * @param oldDoc - The original document.
     * @param newDoc - The updated document.
     */
    private static async afterUpdate(oldDoc?: Document<T>, newDocs?: Document<T> | Document<T>[]) {
      await this.didUpdateDocument(oldDoc, newDocs)
    }

    /**
     * Handler invoked right before a deletion.
     *
     * @param query - Query for document to delete.
     * @param options - See `ModelDeleteOneOptions` and `ModelDeleteManyOptions`.
     *
     * @returns The processed query for deletion.
     */
    private static async beforeDelete(query: Query<T>, options: ModelDeleteOneOptions | ModelDeleteManyOptions): Promise<FilterQuery<T>> {
      const q = await this.willDeleteDocument(query)

      return sanitizeQuery<T>(this.schema, q) as FilterQuery<T>
    }

    /**
     * Handler invoked right after a deletion.
     *
     * @param doc - The deleted doc, if available.
     *
     * @todo Cascade deletion only works for first-level foreign keys so far.
     */
    private static async afterDelete(docs?: Document<T> | Document<T>[]) {
      if (_.isArray(docs)) {
        for (const doc of docs) {
          if (!typeIsValidObjectID(doc._id)) continue
          await this.cascadeDelete(doc._id)
        }
      }
      else if (docs && typeIsValidObjectID(docs._id)) {
        await this.cascadeDelete(docs._id)
      }

      await this.didDeleteDocument(docs)
    }

    /**
     * Deletes documents from other collections that have a foreign key to this collection, as
     * specified in the schema.
     *
     * @param docId - The ID of the document in this collection in which other collections are
     * pointing to.
     *
     * @throws {Error} Cascade deletion is incorrectly defined in the schema.
     * @throws {Error} Cascade deletion failed because a model cannot be found.
     */
    private static async cascadeDelete(docId: ObjectID) {
      const cascadeModelNames = this.schema.cascade

      if (!cascadeModelNames) return

      for (const modelName of cascadeModelNames) {
        const ModelClass = db.getModel(modelName)
        const fields: { [fieldName: string]: FieldSpec } = ModelClass.schema.fields

        if (!ModelClass) throw new Error(`[${this.schema.model}] Trying to cascade delete from model ${modelName} but model is not found`)

        for (const key in ModelClass.schema.fields) {
          if (!ModelClass.schema.fields.hasOwnProperty(key)) continue

          const field = fields[key]

          if (field.ref === this.schema.model) {
            await ModelClass.deleteMany({ [`${key}`]: docId })

            debug(`Cascade deleting all ${modelName} documents whose <${key}> field is <${docId}>... OK`)
          }
        }
      }
    }

    /**
     * Validates a doc of this model to see if the required fields are in place. This process
     * handles spec defined for embedded docs as well.
     *
     * @param doc - The doc to validate.
     * @param fieldDescriptor - The field descriptor to validate against.
     * @param fieldName - The parent field name, for references only.
     *
     * @throws {TypeError} Missing field.
     */
    private static validateDocumentRequiredFields(doc: { [key: string]: any }, fieldDescriptor: FieldDescriptor = this.schema.fields, fieldName?: string) {
      for (const field in fieldDescriptor) {
        if (!fieldDescriptor.hasOwnProperty(field)) continue

        const fieldSpec = fieldDescriptor[field]

        // If field is not marked as required, skip.
        if (!fieldSpec.required) continue

        // If model has default props defined for this field, skip.
        if (this.defaultProps.hasOwnProperty(field)) continue

        // At this point we certain that the field needs to be present in the doc, so go ahead and check if it exists.
        if (!doc.hasOwnProperty(field)) throw new TypeError(`[${this.schema.model}] Missing required field "${fieldName ? `${fieldName}.` : ''}${field}"`)

        // Recursively check for embedded docs, if applicable.
        if (typeIsFieldDescriptor(fieldSpec.type)) {
          this.validateDocumentRequiredFields(doc[field], fieldSpec.type, field)
        }
      }
    }
  }
}
