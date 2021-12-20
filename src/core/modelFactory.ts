/**
 * @file This is a static, abstract model that provides ORM for a single MongoDB collection. Every
 *       other model must inherit this class. It sets up the ground work for basic CRUD operations,
 *       event triggers, filter validations, etc. All returned documents are native JSON objects.
 */

import bcrypt from 'bcrypt'
import _ from 'lodash'
import { Collection, Filter, ObjectId, UpdateFilter } from 'mongodb'
import * as db from '..'
import { AnyDocument, AnyFilter, AnyProps, AnyUpdate, Document, DocumentFragment, OptionallyIdentifiableDocument } from '../types'
import { getFieldSpecByKey, sanitizeDocument, sanitizeFilter, sanitizeUpdate, typeIsAnyDocument, typeIsValidObjectId, validateFieldValue } from '../utils'
import * as Aggregation from './aggregation'
import * as CRUD from './crud'
import Model, { FieldValidationStrategy, ModelCountOptions, ModelDefaultPropertyProvider, ModelDeleteManyOptions, ModelDeleteOneOptions, ModelFindManyOptions, ModelFindOneOptions, ModelInsertManyOptions, ModelInsertOneOptions, ModelPropertyFormattingProvider, ModelPropertyValidationProvider, ModelRandomFieldsOptions, ModelRandomPropertyProvider, ModelReplaceOneOptions, ModelUpdateManyOptions, ModelUpdateOneOptions, ModelValidateDocumentOptions } from './Model'
import Schema, { FieldDescriptor, MultiFieldDescriptor, typeIsFieldDescriptor } from './Schema'

/**
 * Creates a static model class with the provided schema.
 *
 * @param schema - The schema of the model to be generated.
 *
 * @returns The generated static model.
 */
export default function modelFactory<P extends AnyProps = AnyProps>(schema: Schema<P>): Model<P> {
  const debug = require('debug')(`mongodb-odm:model:${schema.model}`)

  return class {

    /** @see {@link Model.schema} */
    static readonly schema = schema

    /** @see {@link Model.randomProps} */
    static readonly randomProps: ModelRandomPropertyProvider<P> = {}

    /** @see {@link Model.defaultProps} */
    static readonly defaultProps: ModelDefaultPropertyProvider<P> = {}

    /** @see {@link Model.formatProps} */
    static readonly formatProps: ModelPropertyFormattingProvider<P> = {}

    /** @see {@link Model.validateProps} */
    static readonly validateProps: ModelPropertyValidationProvider<P> = {}

    constructor() {
      throw new Error('This is a static class and is prohibited from being instantiated')
    }

    /** @see {@link Model.getCollection} */
    static async getCollection(): Promise<Collection> {
      return db.getCollection(this.schema.collection)
    }

    /** @see {@link Model.randomFields} */
    static async randomFields(fixedFields: DocumentFragment<P> = {}, { includeOptionals = false }: ModelRandomFieldsOptions = {}): Promise<DocumentFragment<P>> {
      const o: DocumentFragment<P> = {}

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
        o[key as keyof P] = fixedFields[key as keyof P]
      }

      return o
    }

    /** @see {@link Model.identifyOneStrict} */
    static async identifyOneStrict(filter: AnyFilter<P>): Promise<ObjectId> {
      return CRUD.identifyOne(this.schema, filter)
    }

    /** @see {@link Model.identifyOne} */
    static async identifyOne(filter: AnyFilter<P>): Promise<ObjectId | undefined> {
      try {
        return await this.identifyOneStrict(filter)
      }
      catch (err) {
        return undefined
      }
    }

    /** @see {@link Model.identifyMany} */
    static async identifyMany(filter?: AnyFilter<P>): Promise<ObjectId[]> {
      return filter ? CRUD.identifyMany(this.schema, filter) : CRUD.identifyAll(this.schema)
    }

    /** @see {@link Model.findOneStrict} */
    static async findOneStrict<R = P>(filter?: AnyFilter<P> | Aggregation.Pipeline, options: ModelFindOneOptions = {}): Promise<Document<R>> {
      if (filter) {
        return CRUD.findOne(this.schema, filter, options)
      }
      else {
        return CRUD.findOneRandom(this.schema)
      }
    }

    /** @see {@link Model.findOne} */
    static async findOne<R = P>(filter?: AnyFilter<P> | Aggregation.Pipeline, options: ModelFindOneOptions = {}): Promise<Document<R> | undefined> {
      try {
        return await this.findOneStrict<R>(filter, options)
      }
      catch (err) {
        return undefined
      }
    }

    /** @see {@link Model.findMany} */
    static async findMany<R = P>(filter?: AnyFilter<P> | Aggregation.Pipeline, options: ModelFindManyOptions = {}): Promise<Document<R>[]> {
      if (filter) {
        return CRUD.findMany(this.schema, filter, options)
      }
      else {
        return CRUD.findAll(this.schema)
      }
    }

    /** @see {@link Model.insertOneStrict} */
    static async insertOneStrict(doc?: DocumentFragment<P>, options: ModelInsertOneOptions = {}): Promise<Document<P>> {
      if (schema.noInserts === true) throw new Error(`[${this.schema.model}] Insertions are disallowed for this model`)

      const docToInsert = await this.beforeInsert(doc ?? (await this.randomFields()), { strict: true, ...options })
      const result = await CRUD.insertOne(this.schema, docToInsert, options)
      await this.afterInsert(result)
      return result
    }

    /** @see {@link Model.insertOne} */
    static async insertOne(doc?: DocumentFragment<P>, options: ModelInsertOneOptions = {}): Promise<Document<P> | undefined> {
      try {
        return await this.insertOneStrict(doc, options)
      }
      catch (err) {
        return undefined
      }
    }

    /** @see {@link Model.insertMany} */
    static async insertMany(docs: DocumentFragment<P>[], options: ModelInsertManyOptions = {}): Promise<Document<P>[]> {
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

    /** @see {@link Model.updateOneStrict} */
    static async updateOneStrict(filter: AnyFilter<P>, update: AnyUpdate<P>, options: ModelUpdateOneOptions = {}): Promise<boolean | Document<P>> {
      if (this.schema.noUpdates === true) throw new Error(`[${this.schema.model}] Updates are disallowed for this model`)

      const f = sanitizeFilter(this.schema, filter)
      const u = await this.beforeUpdate(f, sanitizeUpdate(this.schema, update, options), options)

      if (options.returnDoc === true) {
        const [oldDoc, newDoc] = await CRUD.findOneAndUpdate(this.schema, f, u, options)

        debug('Updating an existing document...', 'OK', f, u, options, oldDoc, newDoc)

        await this.afterUpdate(oldDoc, newDoc)

        return newDoc
      }
      else {
        const result = await CRUD.updateOne(this.schema, f, u, options)

        debug('Updating an existing document...', 'OK', f, u, options)

        await this.afterUpdate()

        return result
      }
    }

    /** @see {@link Model.updateOne} */
    static async updateOne(filter: AnyFilter<P>, update: AnyUpdate<P>, options: ModelUpdateOneOptions = {}): Promise<boolean | Document<P> | undefined> {
      try {
        const result = await this.updateOneStrict(filter, update, options)

        if (!_.isBoolean(result) && options.returnDoc === true) {
          return result
        }
        else {
          return result
        }
      }
      catch (err) {
        return options.returnDoc === true ? undefined : false
      }
    }

    /** @see {@link Model.updateMany} */
    static async updateMany(filter: AnyFilter<P>, update: AnyUpdate<P>, options: ModelUpdateManyOptions = {}): Promise<Document<P>[] | boolean> {
      if ((this.schema.noUpdates === true) || (this.schema.noUpdateMany === true)) throw new Error(`[${this.schema.model}] Multiple updates are disallowed for this model`)

      const f = sanitizeFilter(this.schema, filter)
      const u = await this.beforeUpdate(f, sanitizeUpdate(this.schema, update, options), options)

      if (options.returnDocs === true) {
        const [oldDocs, newDocs] = await CRUD.findManyAndUpdate(this.schema, f, u, options)

        debug('Updating multiple existing documents...', 'OK', f, u, options, newDocs)

        await this.afterUpdate(oldDocs, newDocs)

        return newDocs
      }
      else {
        const result = await CRUD.updateMany(this.schema, f, u, options)

        debug('Updating multiple existing documents...', 'OK', f, u, options, result)

        await this.afterUpdate()

        return result
      }
    }

    /** @see {@link Model.deleteOneStrict} */
    static async deleteOneStrict(filter: AnyFilter<P>, options: ModelDeleteOneOptions = {}): Promise<Document<P> | boolean> {
      if (this.schema.noDeletes === true) throw new Error(`[${this.schema.model}] Deletions are disallowed for this model`)

      const f = sanitizeFilter(this.schema, filter)
      await this.beforeDelete(f, options)

      if (options.returnDoc === true) {
        const deletedDoc = await CRUD.findAndDeleteOne(this.schema, f, options)

        debug('Deleting an existing document...', 'OK', filter, deletedDoc)

        await this.afterDelete(deletedDoc)

        return deletedDoc
      }
      else {
        const result = await CRUD.deleteOne(this.schema, f, options)

        debug('Deleting an existing document...', 'OK', filter)

        await this.afterDelete()

        return result
      }
    }

    /** @see {@link Model.deleteOne} */
    static async deleteOne(filter: AnyFilter<P>, options: ModelDeleteOneOptions = {}): Promise<Document<P> | boolean | undefined> {
      try {
        const result = await this.deleteOneStrict(filter, options)

        if (!_.isBoolean(result) && options.returnDoc === true) {
          return result
        }
        else {
          return result
        }
      }
      catch (err) {
        return options.returnDoc === true ? undefined : false
      }
    }

    /** @see {@link Model.deleteMany} */
    static async deleteMany(filter: AnyFilter<P>, options: ModelDeleteManyOptions = {}): Promise<boolean | Document<P>[]> {
      if ((this.schema.noDeletes === true) || (this.schema.noDeleteMany === true)) throw new Error(`[${this.schema.model}] Multiple deletions are disallowed for this model`)

      const f = sanitizeFilter(this.schema, filter)

      await this.beforeDelete(f, options)

      if (options.returnDocs === true) {
        const deletedDocs = await CRUD.findManyAndDelete(this.schema, f, options)

        debug('Deleting multiple existing documents...:', 'OK', f, deletedDocs)

        await this.afterDelete(deletedDocs)

        return deletedDocs
      }
      else {
        await CRUD.deleteMany(this.schema, f, options)

        debug('Deleting multiple existing documents...:', 'OK', f)

        await this.afterDelete()

        return true
      }
    }

    /** @see {@link Model.findAndReplaceOneStrict} */
    static async findAndReplaceOneStrict(filter: AnyFilter<P>, replacement?: DocumentFragment<P>, options: ModelReplaceOneOptions = {}): Promise<Document<P>> {
      const f = sanitizeFilter(this.schema, filter)
      const r = await this.beforeInsert(replacement ?? (await this.randomFields()), options)

      const [oldDoc, newDoc] = await CRUD.findOneAndReplace(this.schema, f, r, options)

      debug('Replacing an existing document...', 'OK', f, r, oldDoc, newDoc)

      await this.afterDelete(oldDoc)
      await this.afterInsert(newDoc)

      return options.returnDocument === 'before' ? oldDoc : newDoc
    }

    /** @see {@link Model.findAndReplaceOne} */
    static async findAndReplaceOne(filter: AnyFilter<P>, replacement?: DocumentFragment<P>, options: ModelReplaceOneOptions = {}): Promise<Document<P> | undefined> {
      try {
        return await this.findAndReplaceOneStrict(filter, replacement, options)
      }
      catch (err) {
        return undefined
      }
    }

    /** @see {@link Model.exists} */
    static async exists(filter: AnyFilter<P>): Promise<boolean> {
      const id = await this.identifyOne(filter)

      return id ? true : false
    }

    /** @see {@link Model.count} */
    static async count(filter: AnyFilter<P>, options: ModelCountOptions = {}): Promise<number> {
      const result = await this.findMany(filter, options)

      return result.length
    }

    /** @see {@link Model.formatDocument} */
    static async formatDocument(doc: DocumentFragment<P>): Promise<DocumentFragment<P>> {
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

    /** @see {@link Model.validateDocument} */
    static async validateDocument(doc: DocumentFragment<P>, options: ModelValidateDocumentOptions = {}) {
      if (_.isEmpty(doc)) throw new Error(`[${this.schema.model}] Empty objects are not permitted`)

      for (const key in doc) {
        if (!doc.hasOwnProperty(key)) continue

        // Skip validation for fields `_id`, `updatedAt` and `createdAt` since they are
        // automatically generated, but only if validating top-level fields.
        if (key === '_id') continue
        if (this.schema.timestamps && (key === 'updatedAt')) continue
        if (this.schema.timestamps && (key === 'createdAt')) continue

        // #1 Check if field is defined in the schema.
        const fieldSpec = options.accountForDotNotation ? getFieldSpecByKey(this.schema.fields, key) : schema.fields[key as keyof P]
        if (!fieldSpec) throw new Error(`[${this.schema.model}] The field '${key}' is not defined in the ${JSON.stringify(this.schema.fields, undefined, 0)}`)

        // #2 Check if field value conforms to its defined spec. Note that the key can be in dot
        // notation because this method may also be used when applying doc updates.
        const val = _.get(doc, key, undefined)
        const validationStrategy: FieldValidationStrategy<any> | undefined = _.get(this.validateProps, key, undefined)

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

          const filter = _.pick(doc, Object.keys(index.spec)) as Filter<Document<P>>

          if (await this.findOne(filter)) throw new Error(`[${this.schema.model}] Another document already exists with ${JSON.stringify(filter, undefined, 0)}`)
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
    protected static async willInsertDocument(doc: DocumentFragment<P>): Promise<DocumentFragment<P>> {
      return doc
    }

    /**
     * Handler called after the document is successfully inserted.
     *
     * @param doc - The inserted document.
     */
    protected static async didInsertDocument(doc: Readonly<Document<P>>): Promise<void> {}

    /**
     * Handler called before an attempted update operation. This method must return the filter and
     * update descriptor for the update operation.
     *
     * @param filter - The filter for document(s) to update.
     * @param update - The update descriptor.
     *
     * @returns A tuple of the filter and the update descriptor.
     */
    protected static async willUpdateDocument(filter: Readonly<Filter<Document<P>>>, update: UpdateFilter<Document<P>>): Promise<AnyUpdate<P>> {
      return update
    }

    /**
     * Handler called after a document or a set of documents have been successfully updated.
     *
     * @param prevDoc - The document before it is updated. This is only available if `returnDoc` was
     *                  enabled, and only for updateOne().
     * @param newDocs - The updated document(s). This is only available if `returnDoc` or
     *                  `returnDocs` was enabled.
     */
    protected static async didUpdateDocument(prevDoc?: Readonly<Document<P>>, newDocs?: Readonly<Document<P>> | Readonly<Document<P>[]>): Promise<void> {}

    /**
     * Handler called before an attempt to delete a document.
     *
     * @param filter - The filter for the document to be deleted.
     *
     * @returns The document to be deleted.
     */
    protected static async willDeleteDocument(filter: Readonly<Filter<Document<P>>>): Promise<void> {}

    /**
     * Handler called after a document or a set of documents are successfully deleted.
     *
     * @param docs - The deleted document(s) if available.
     */
    protected static async didDeleteDocument(docs?: Readonly<Document<P>> | Readonly<Document<P>[]>): Promise<void> {}

    /**
     * Processes a document before it is inserted. This is also used during an upsert operation.
     *
     * @param doc - The document to be inserted/upserted.
     * @param options - See {@link ModelInsertOneOptions} and {@link ModelInsertManyOptions}.
     *
     * @returns Document to be inserted/upserted to the database.
     */
    private static async beforeInsert(doc: DocumentFragment<P>, options: ModelInsertOneOptions | ModelInsertManyOptions = {}): Promise<OptionallyIdentifiableDocument<P>> {
      // Call event hook first.
      const modifiedDoc = await this.willInsertDocument(doc)

      let sanitizedDoc = sanitizeDocument(this.schema, modifiedDoc)

      // Unless specified, always renew the `createdAt` and `updatedAt` fields.
      if ((this.schema.timestamps === true) && (options.ignoreTimestamps !== true)) {
        if (!_.isDate(sanitizedDoc.createdAt)) sanitizedDoc.createdAt = new Date() as any
        if (!_.isDate(sanitizedDoc.updatedAt)) sanitizedDoc.updatedAt = new Date() as any
      }

      // Before inserting this document, go through each field and make sure that it has default
      // values and that they are formatted correctly.
      for (const key in this.schema.fields) {
        if (!this.schema.fields.hasOwnProperty(key)) continue
        if (sanitizedDoc.hasOwnProperty(key)) continue

        const defaultValue = this.defaultProps[key]

        // Check if the field has a default value defined in the schema. If so, apply it.
        if (_.isUndefined(defaultValue)) continue

        sanitizedDoc[key] = (_.isFunction(defaultValue)) ? defaultValue() : defaultValue
      }

      // Apply format function defined in the schema if applicable.
      sanitizedDoc = await this.formatDocument(sanitizedDoc)

      // Finally, validate the document. Ignore unique indexes in this step. Let the db throw an
      // error if the inserted doc violates those indexes.
      await this.validateDocument(sanitizedDoc, { ignoreUniqueIndex: true, strict: true, accountForDotNotation: false, ...options })

      return sanitizedDoc as OptionallyIdentifiableDocument<P>
    }

    /**
     * Handler invoked right after a document insertion.
     *
     * @param doc - The inserted document.
     */
    private static async afterInsert(doc: Document<P>): Promise<void> {
      await this.didInsertDocument(doc)
    }

    /**
     * Handler invoked right before an update. This is NOT invoked on an insertion.
     *
     * @param filter - Filter for document to update.
     * @param update - The update to apply.
     * @param options - See {@link ModelUpdateOneOptions} and {@link ModelUpdateManyOptions}.
     *
     * @returns The modified update to apply.
     *
     * @throws {Error} Attempting to upsert even though upserts are disabled in the schema.
     *
     * @todo Handle remaining update operators.
     */
    private static async beforeUpdate(filter: Filter<Document<P>>, update: UpdateFilter<Document<P>>, options: ModelUpdateOneOptions | ModelUpdateManyOptions = {}): Promise<UpdateFilter<Document<P>>> {
      if ((options.upsert === true) && (this.schema.allowUpserts !== true)) throw new Error(`[${this.schema.model}] Attempting to upsert a document while upserting is disallowed in the schema`)

      const u = await this.willUpdateDocument(filter, update)

      // Format all fields in the update filter.
      if (u.$set) {
        u.$set = await this.formatDocument(u.$set as Document<P>)
      }

      // In the case of an upsert, we need to preprocess the filter as if this was an insertion. We
      // also need to tell the database to save all fields in the filter as well, unless they are
      // already in the update query.
      if (options.upsert === true && typeIsAnyDocument(filter)) {
        // Make a copy of the filter in case it is manipulated by the hooks.
        const docIfUpsert = await this.beforeInsert(filter as DocumentFragment<P>, { ...options, strict: false })
        const setOnInsert = _.omit({
          ...u.$setOnInsert ?? {},
          ...docIfUpsert,
        }, [
          ...Object.keys(u.$set ?? {}),
          ...Object.keys(u.$unset ?? {}),
        ]) as DocumentFragment<P>

        if (!_.isEmpty(setOnInsert)) {
          u.$setOnInsert = setOnInsert
        }
      }

      // Validate all fields in the update. Account for dot notations to facilitate updating fields
      // in nested fields.
      if (u.$set && !_.isEmpty(u.$set)) {
        await this.validateDocument(u.$set as DocumentFragment<P>, { ...options, ignoreUniqueIndex: true, accountForDotNotation: true })
      }

      return u
    }

    /**
     * Handler invoked right after an update. This does not account for insertions.
     *
     * @param oldDoc - The original document.
     * @param newDocOrNewDocs - The updated document(s).
     */
    private static async afterUpdate(oldDoc?: Document<P>, newDocOrNewDocs?: Document<P> | Document<P>[]) {
      await this.didUpdateDocument(oldDoc, newDocOrNewDocs)
    }

    /**
     * Handler invoked before a deletion.
     *
     * @param filter - Filter for document to delete.
     * @param options - See {@link ModelDeleteOneOptions} and {@link ModelDeleteManyOptions}.
     *
     * @returns The processed filter for deletion.
     */
    private static async beforeDelete(filter: Filter<Document<P>>, options: ModelDeleteOneOptions | ModelDeleteManyOptions): Promise<void> {
      await this.willDeleteDocument(filter)
    }

    /**
     * Handler invoked after a deletion.
     *
     * @param docOrDocs - The deleted doc(s), if available.
     *
     * @todo Cascade deletion only works for first-level foreign keys so far.
     */
    private static async afterDelete(docOrDocs?: Document<P> | Document<P>[]) {
      if (docOrDocs) {
        if (_.isArray(docOrDocs)) {
          const docs = docOrDocs

          for (const doc of docs) {
            if (!typeIsValidObjectId(doc._id)) continue
            await this.cascadeDelete(doc._id)
          }
        }
        else {
          const doc = docOrDocs

          if (typeIsValidObjectId(doc._id)) {
            await this.cascadeDelete(doc._id)
          }
        }
      }

      await this.didDeleteDocument(docOrDocs)
    }

    /**
     * Looks for documents **in all other registered collections** that have a foreign key to this
     * collection with the field value matching the provided `docId`, then deletes them from the
     * database.
     *
     * @param docId - The ID of the document in this collection in which other collections are
     *                pointing to.
     *
     * @throws {Error} Cascade deletion is incorrectly defined in the schema.
     * @throws {Error} Cascade deletion failed because a model cannot be found.
     */
    private static async cascadeDelete(docId: ObjectId) {
      const cascadeModelNames = this.schema.cascade

      if (!cascadeModelNames) return

      for (const modelName of cascadeModelNames) {
        const ModelClass = db.getModel(modelName)
        const fields: { [fieldName: string]: FieldDescriptor } = ModelClass.schema.fields

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
     * Validates a document of this model to see if the required fields (including nested fields)
     * are in place.
     *
     * @param doc - The doc to validate.
     * @param fieldDescriptor - The field descriptor to validate against.
     * @param fieldName - The parent field name, for references only.
     *
     * @throws {TypeError} Missing field.
     */
    private static validateDocumentRequiredFields(doc: AnyDocument, fieldDescriptor: MultiFieldDescriptor = this.schema.fields, fieldName?: string) {
      for (const field in fieldDescriptor) {
        if (!fieldDescriptor.hasOwnProperty(field)) continue

        const fieldSpec = fieldDescriptor[field]

        // If field is not marked as required, skip.
        if (!fieldSpec.required) continue

        // If model has default props defined for this field, skip.
        if (this.defaultProps.hasOwnProperty(field)) continue

        // At this point we are certain that this field needs to be present in the doc, so go ahead
        // and check if it exists.
        if (!doc.hasOwnProperty(field)) {
          throw new TypeError(`[${this.schema.model}] Missing required field "${fieldName ? `${fieldName}.` : ''}${field}"`)
        }

        // Recursively validate nested fields if applicable.
        if (typeIsFieldDescriptor(fieldSpec.type)) {
          this.validateDocumentRequiredFields(doc[field], fieldSpec.type, field)
        }
      }
    }
  }
}
