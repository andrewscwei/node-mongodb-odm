/**
 * @file This is a static, abstract model that provides ORM for a single MongoDB collection. Every
 *       other model must inherit this class. It sets up the ground work for basic CRUD operations,
 *       event triggers, query validations, etc. All returned documents are native JSON objects.
 */

import bcrypt from 'bcrypt'
import _ from 'lodash'
import { Collection, FilterQuery, ObjectID, UpdateQuery } from 'mongodb'
import * as db from '..'
import { AggregationPipeline, Document, DocumentFragment, FieldDefaultValueFunction, FieldDescriptor, FieldFormatFunction, FieldRandomValueFunction, FieldSpec, FieldValidationStrategy, ModelCountOptions, ModelDeleteManyOptions, ModelDeleteOneOptions, ModelFindManyOptions, ModelFindOneOptions, ModelInsertManyOptions, ModelInsertOneOptions, ModelRandomFieldsOptions, ModelReplaceOneOptions, ModelUpdateManyOptions, ModelUpdateOneOptions, ModelValidateDocumentOptions, PipelineFactoryOperators, PipelineFactoryOptions, AnyFilter, Schema, typeIsFieldDescriptor, typeIsValidObjectID, AnyUpdate } from '../types'
import getFieldSpecByKey from '../utils/getFieldSpecByKey'
import sanitizeDocument from '../utils/sanitizeDocument'
import sanitizeFilter from '../utils/sanitizeFilter'
import sanitizeUpdate from '../utils/sanitizeUpdate'
import validateFieldValue from '../utils/validateFieldValue'
import Aggregation from './Aggregation'
import * as CRUD from './crud'
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
      return db.getCollection(this.schema.collection)
    }

    /** @inheritdoc */
    static async randomFields(fixedFields: DocumentFragment<T> = {}, { includeOptionals = false }: ModelRandomFieldsOptions = {}): Promise<DocumentFragment<T>> {
      const o: DocumentFragment<T> = {}

      const fields = this.schema.fields

      for (const key in this.randomProps) {
        if (!fields.hasOwnProperty(key)) continue

        if (!includeOptionals && !fields[key].required) continue

        const fn = this.randomProps[key]

        if (!_.isFunction(fn)) throw new Error(`[${this.schema.model}] Property "${key}" in randomProps must be a function`)

        // Use provided random function if provided in the schema.
        o[key] = fn() as any
      }

      for (const key in fixedFields) {
        if (!fixedFields.hasOwnProperty(key)) continue
        o[key as keyof T] = fixedFields[key as keyof T]
      }

      return o
    }

    /** @inheritdoc */
    static pipeline(queryOrOperators?: AnyFilter<T> | PipelineFactoryOperators<T>, options?: PipelineFactoryOptions): AggregationPipeline {
      if (!this.schema) throw new Error(`[${this.constructor.name}] This model has no schema, you must define this static proerty in the derived class`)

      // Check if the argument conforms to aggregation factory operators.
      if (queryOrOperators && Object.keys(queryOrOperators).some(val => val.startsWith('$'))) {
        return Aggregation.pipelineFactory(this.schema, queryOrOperators as PipelineFactoryOperators<T>, options)
      }
      // Otherwise the argument is a query for the $match stage.
      else {
        return Aggregation.pipelineFactory(this.schema, { $match: queryOrOperators as AnyFilter<T> }, options)
      }
    }

    /** @inheritdoc */
    static async identifyOneStrict(query: AnyFilter<T>): Promise<ObjectID> {
      return CRUD.identifyOne(this.schema, query)
    }

    /** @inheritdoc */
    static async identifyOne(query: AnyFilter<T>): Promise<ObjectID | undefined> {
      try {
        return await this.identifyOneStrict(query)
      }
      catch (err) {
        return undefined
      }
    }

    /** @inheritdoc */
    static async identifyMany(query?: AnyFilter<T>): Promise<ObjectID[]> {
      return query ? CRUD.identifyMany(this.schema, query) : CRUD.identifyAll(this.schema)
    }

    /** @inheritdoc */
    static async findOneStrict<R = T>(query?: AnyFilter<T>, options: ModelFindOneOptions = {}): Promise<Document<R>> {
      return query ? CRUD.findOne(this.schema, query, options) : CRUD.findOneRandom(this.schema)
    }

    /** @inheritdoc */
    static async findOne<R = T>(query?: AnyFilter<T>, options: ModelFindOneOptions = {}): Promise<Document<R> | undefined> {
      try {
        return await this.findOneStrict<R>(query, options)
      }
      catch (err) {
        return undefined
      }
    }

    /** @inheritdoc */
    static async findMany<R = T>(query?: AnyFilter<T>, options: ModelFindManyOptions = {}): Promise<Document<R>[]> {
      return query ? CRUD.findMany(this.schema, this.pipeline(query), options) : CRUD.findAll(this.schema)
    }

    /** @inheritdoc */
    static async insertOneStrict(doc?: DocumentFragment<T>, options: ModelInsertOneOptions = {}): Promise<Document<T>> {
      if (schema.noInserts === true) throw new Error(`[${this.schema.model}] Insertions are disallowed for this model`)

      const docToInsert = await this.beforeInsert(doc ?? (await this.randomFields()), { strict: true, ...options })
      const result = await CRUD.insertOne(this.schema, docToInsert, options)
      await this.afterInsert(result)
      return result
    }

    /** @inheritdoc */
    static async insertOne(doc?: DocumentFragment<T>, options: ModelInsertOneOptions = {}): Promise<Document<T> | undefined> {
      try {
        return await this.insertOneStrict(doc, options)
      }
      catch (err) {
        return undefined
      }
    }

    /** @inheritdoc */
    static async insertMany(docs: DocumentFragment<T>[], options: ModelInsertManyOptions = {}): Promise<Document<T>[]> {
      if ((this.schema.noInserts === true) || (this.schema.noInsertMany === true)) throw new Error(`[${this.schema.model}] Multiple insertions are disallowed for this model`)

      const docsToInsert = await Promise.all(docs.map(doc => this.beforeInsert(doc)))
      const insertedDocs = await CRUD.insertMany(this.schema, docsToInsert, options)

      debug('Inserting multiple documents...', 'OK', docsToInsert, insertedDocs)

      const n = insertedDocs.length

      for (let i = 0; i < n; i++) {
        await this.afterInsert(insertedDocs[i])
      }

      return insertedDocs
    }

    /** @inheritdoc */
    static async updateOneStrict(query: AnyFilter<T>, update: AnyUpdate<T>, options: ModelUpdateOneOptions<T> = {}): Promise<void | Document<T>> {
      if (this.schema.noUpdates === true) throw new Error(`[${this.schema.model}] Updates are disallowed for this model`)

      const [q, u] = (options.skipHooks === true) ? [query, update] : await this.beforeUpdate(query, update, options)

      if (options.returnDoc === true) {
        const [oldDoc, newDoc] = await CRUD.findOneAndUpdate(this.schema, q, u, options)

        debug('Updating an existing document...', 'OK', q, u, options, oldDoc, newDoc)

        if (options.skipHooks !== true) await this.afterUpdate(oldDoc, newDoc)

        return newDoc
      }
      else {
        await CRUD.updateOne(this.schema, q, u, options)

        debug('Updating an existing document...', 'OK', q, u, options)

        if (options.skipHooks !== true) await this.afterUpdate()
      }
    }

    /** @inheritdoc */
    static async updateOne(query: AnyFilter<T>, update: AnyUpdate<T>, options: ModelUpdateOneOptions<T> = {}): Promise<boolean | Document<T> | undefined> {
      try {
        const docOrUndefined = await this.updateOneStrict(query, update, options)

        if (docOrUndefined !== undefined && options.returnDoc === true) {
          return docOrUndefined
        }
        else {
          return true
        }
      }
      catch (err) {
        return options.returnDoc === true ? undefined : false
      }
    }

    /** @inheritdoc */
    static async updateMany(query: AnyFilter<T>, update: AnyUpdate<T>, options: ModelUpdateManyOptions<T> = {}): Promise<Document<T>[] | boolean> {
      if ((this.schema.noUpdates === true) || (this.schema.noUpdateMany === true)) throw new Error(`[${this.schema.model}] Multiple updates are disallowed for this model`)

      const [q, u] = await this.beforeUpdate(query, update, options)

      if (options.returnDocs === true) {
        const [oldDocs, newDocs] = await CRUD.findManyAndUpdate(this.schema, q, u, options)

        debug('Updating multiple existing documents...', 'OK', q, u, options, newDocs)

        await this.afterUpdate(oldDocs, newDocs)

        return newDocs
      }
      else {
        const results = await CRUD.updateMany(this.schema, q, u, options)

        debug('Updating multiple existing documents...', 'OK', q, u, options, results)

        await this.afterUpdate()

        return true
      }
    }

    /** @inheritdoc */
    static async deleteOneStrict(query: AnyFilter<T>, options: ModelDeleteOneOptions = {}): Promise<Document<T> | void> {
      if (this.schema.noDeletes === true) throw new Error(`[${this.schema.model}] Deletions are disallowed for this model`)

      const q = await this.beforeDelete(query, options)

      if (options.returnDoc === true) {
        const deletedDoc = await CRUD.findAndDeleteOne(this.schema, q, options)

        debug('Deleting an existing document...', 'OK', query, deletedDoc)

        await this.afterDelete(deletedDoc)

        return deletedDoc
      }
      else {
        await CRUD.deleteOne(this.schema, q, options)

        debug('Deleting an existing document...', 'OK', query)

        await this.afterDelete()
      }
    }

    /** @inheritdoc */
    static async deleteOne(query: AnyFilter<T>, options: ModelDeleteOneOptions = {}): Promise<Document<T> | boolean | undefined> {
      try {
        const docOrUndefined = await this.deleteOneStrict(query, options)

        if (docOrUndefined !== undefined && options.returnDoc === true) {
          return docOrUndefined
        }
        else {
          return true
        }
      }
      catch (err) {
        return options.returnDoc === true ? undefined : false
      }
    }

    /** @inheritdoc */
    static async deleteMany(query: AnyFilter<T>, options: ModelDeleteManyOptions = {}): Promise<boolean | Document<T>[]> {
      if ((this.schema.noDeletes === true) || (this.schema.noDeleteMany === true)) throw new Error(`[${this.schema.model}] Multiple deletions are disallowed for this model`)

      const q = await this.beforeDelete(query, options)

      if (options.returnDocs === true) {
        const deletedDocs = await CRUD.findManyAndDelete(this.schema, q, options)

        debug('Deleting multiple existing documents...:', 'OK', q, deletedDocs)

        await this.afterDelete(deletedDocs)

        return deletedDocs
      }
      else {
        await CRUD.deleteMany(this.schema, q, options)

        debug('Deleting multiple existing documents...:', 'OK', q)

        await this.afterDelete()

        return true
      }
    }

    /** @inheritdoc */
    static async findAndReplaceOneStrict(query: AnyFilter<T>, replacement?: DocumentFragment<T>, options: ModelReplaceOneOptions<T> = {}): Promise<Document<T>> {
      const q = await this.beforeDelete(query, options)
      const r = await this.beforeInsert(replacement || (await this.randomFields()), options)

      const [oldDoc, newDoc] = await CRUD.findOneAndReplace(this.schema, q, r, options)

      debug('Replacing an existing document...', 'OK', q, r, oldDoc, newDoc)

      await this.afterDelete(oldDoc)
      await this.afterInsert(newDoc)

      return options.returnDocument === 'before' ? oldDoc : newDoc
    }

    /** @inheritdoc */
    static async findAndReplaceOne(query: AnyFilter<T>, replacement?: DocumentFragment<T>, options: ModelReplaceOneOptions<T> = {}): Promise<Document<T> | undefined> {
      try {
        return await this.findAndReplaceOneStrict(query, replacement, options)
      }
      catch (err) {
        return undefined
      }
    }

    /** @inheritdoc */
    static async exists(query: AnyFilter<T>): Promise<boolean> {
      const id = await this.identifyOne(query)

      return id ? true : false
    }

    /** @inheritdoc */
    static async count(query: AnyFilter<T>, options: ModelCountOptions = {}): Promise<number> {
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
    protected static async willUpdateDocument(query: AnyFilter<T>, update: AnyUpdate<T>): Promise<[AnyFilter<T>, AnyUpdate<T>]> {
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
    protected static async willDeleteDocument(query: AnyFilter<T>): Promise<AnyFilter<T>> {
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
     * @param query - AnyFilter for document to update.
     * @param update - The update to apply.
     * @param options - See `ModelUpdateOneOptions` and `ModelUpdateManyOptions`.
     *
     * @returns The modified update to apply.
     *
     * @throws {Error} Attempting to upsert even though upserts are disabled in the schema.
     *
     * @todo Handle remaining update operators.
     */
    private static async beforeUpdate(query: AnyFilter<T>, update: AnyUpdate<T>, options: ModelUpdateOneOptions<T> | ModelUpdateManyOptions<T> = {}): Promise<[DocumentFragment<T>, UpdateQuery<DocumentFragment<T>>]> {
      if ((options.upsert === true) && (this.schema.allowUpserts !== true)) throw new Error(`[${this.schema.model}] Attempting to upsert a document while upserting is disallowed in the schema`)

      const [q, u] = await this.willUpdateDocument(query, update)

      // First sanitize the inputs. We want to be able to make sure the query is valid and that the
      // update object is a proper update query.
      const sanitizedQuery = sanitizeFilter<T>(this.schema, q) as DocumentFragment<T>
      const sanitizedUpdate = sanitizeUpdate(this.schema, u, options)

      // Format all fields in the update query.
      if (sanitizedUpdate.$set) {
        sanitizedUpdate.$set = await this.formatDocument(sanitizedUpdate.$set as Document<T>)
      }

      // In the case of an upsert, we need to preprocess the query as if this was an insertion. We
      // also need to tell the database to save all fields in the query as well, unless they are
      // already in the update query.
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

      return [sanitizedQuery, sanitizedUpdate]
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
     * @param query - AnyFilter for document to delete.
     * @param options - See `ModelDeleteOneOptions` and `ModelDeleteManyOptions`.
     *
     * @returns The processed query for deletion.
     */
    private static async beforeDelete(query: AnyFilter<T>, options: ModelDeleteOneOptions | ModelDeleteManyOptions): Promise<FilterQuery<T>> {
      const q = await this.willDeleteDocument(query)

      return sanitizeFilter<T>(this.schema, q) as FilterQuery<T>
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
