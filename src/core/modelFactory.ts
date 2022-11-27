/**
 * @file This is the factory of abstract, static model classes that provide one-to-one
 *       object-relational mapping to MongoDB collections. Each model registered in this ODM library
 *       must inherit the generated model class to leverage its ORM features, such as eventful CRUD
 *       operations, default fields, field validations, etc. All MongoDB documents returned by the
 *       model are native JSON objects.
 *
 * @see {@link Model}
 */

import bcrypt from 'bcrypt'
import _ from 'lodash'
import { Collection, DeleteOptions, Filter, FindOneAndDeleteOptions, FindOneAndReplaceOptions, FindOneAndUpdateOptions, ObjectId, ReplaceOptions, UpdateFilter, UpdateOptions } from 'mongodb'
import * as db from '..'
import { AnyDocument, AnyFilter, AnyProps, AnyUpdate, Document, DocumentFragment, InsertableDocument } from '../types'
import { getFieldSpecByKey, sanitizeDocument, sanitizeFilter, sanitizeUpdate, typeIsAnyDocument, typeIsValidObjectId, validateFieldValue } from '../utils'
import * as Aggregation from './aggregation'
import * as CRUD from './crud'
import Model, { FieldValidationStrategy, ModelDefaultPropertyProvider, ModelDeleteManyOptions, ModelDeleteOneOptions, ModelFindManyOptions, ModelFindOneOptions, ModelInsertManyOptions, ModelInsertOneOptions, ModelPropertyFormattingProvider, ModelPropertyValidationProvider, ModelRandomFieldsOptions, ModelRandomPropertyProvider, ModelReplaceOneOptions, ModelUpdateManyOptions, ModelUpdateOneOptions, ModelValidateDocumentOptions } from './Model'
import Schema, { FieldDescriptor, MultiFieldDescriptor, typeIsFieldDescriptor } from './Schema'

/**
 * Generates an abstract, static model class with the provided schema.
 *
 * @param schema - The schema of the model to be generated.
 *
 * @returns The generated model class.
 *
 * @see {@link Model}
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
        const res = await this.identifyOneStrict(filter)
        return res
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
    static async findOneStrict<R extends AnyProps = P>(filter?: AnyFilter<P> | Aggregation.Pipeline, options: ModelFindOneOptions = {}): Promise<Document<R>> {
      if (filter) {
        return CRUD.findOne(this.schema, filter, options)
      }
      else {
        return CRUD.findOneRandom(this.schema)
      }
    }

    /** @see {@link Model.findOne} */
    static async findOne<R extends AnyProps = P>(filter?: AnyFilter<P> | Aggregation.Pipeline, options: ModelFindOneOptions = {}): Promise<Document<R> | undefined> {
      try {
        const res = await this.findOneStrict<R>(filter, options)
        return res
      }
      catch (err) {
        return undefined
      }
    }

    /** @see {@link Model.findMany} */
    static async findMany<R extends AnyProps = P>(filter?: AnyFilter<P> | Aggregation.Pipeline, options: ModelFindManyOptions = {}): Promise<Document<R>[]> {
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

      const docToInsert = await this.beforeInsertOne(doc ?? await this.randomFields(), { strict: true, ...options })
      const insertedDoc = await CRUD.insertOne(this.schema, docToInsert, options)

      await this.afterInsertOne(insertedDoc)

      return insertedDoc
    }

    /** @see {@link Model.insertOne} */
    static async insertOne(doc?: DocumentFragment<P>, options: ModelInsertOneOptions = {}): Promise<Document<P> | undefined> {
      try {
        const res = await this.insertOneStrict(doc, options)
        return res
      }
      catch (err) {
        return undefined
      }
    }

    /** @see {@link Model.insertMany} */
    static async insertMany(docs: DocumentFragment<P>[], options: ModelInsertManyOptions = {}): Promise<Document<P>[]> {
      if ((this.schema.noInserts === true) || (this.schema.noInsertMany === true)) throw new Error(`[${this.schema.model}] Multiple insertions are disallowed for this model`)

      const docsToInsert = await this.beforeInsertMany(docs, { strict: true, ...options })
      const insertedDocs = await CRUD.insertMany(this.schema, docsToInsert, options)

      debug('Inserting multiple documents...', 'OK', docsToInsert, insertedDocs)

      await this.afterInsertMany(insertedDocs)

      return insertedDocs
    }

    /** @see {@link Model.updateOneStrict} */
    static async updateOneStrict(filter: AnyFilter<P>, update: AnyUpdate<P>, options: ModelUpdateOneOptions = {}): Promise<boolean | Document<P> | undefined> {
      if (this.schema.noUpdates === true) throw new Error(`[${this.schema.model}] Updates are disallowed for this model`)

      const filterToApply = sanitizeFilter(this.schema, filter)
      const updateToApply = await this.beforeUpdateOne(filterToApply, update, options)

      if (options.returnDocument) {
        const [oldDoc, newDoc] = await CRUD.findOneAndUpdate(this.schema, filterToApply, updateToApply, options as Exclude<ModelUpdateOneOptions, UpdateOptions>)
        debug('Updating an existing document...', 'OK', filterToApply, updateToApply, options, oldDoc, newDoc)
        await this.afterUpdateOne(oldDoc, newDoc)
        return options.returnDocument === 'after' ? newDoc : oldDoc
      }
      else {
        const result = await CRUD.updateOne(this.schema, filterToApply, updateToApply, options as Exclude<ModelUpdateOneOptions, FindOneAndUpdateOptions>)
        debug('Updating an existing document...', 'OK', filterToApply, updateToApply, options)
        await this.afterUpdateOne()
        return result
      }
    }

    /** @see {@link Model.updateOne} */
    static async updateOne(filter: AnyFilter<P>, update: AnyUpdate<P>, options: ModelUpdateOneOptions = {}): Promise<boolean | Document<P> | undefined> {
      try {
        const res = await this.updateOneStrict(filter, update, options)
        return res
      }
      catch (err) {
        return options.returnDocument ? undefined : false
      }
    }

    /** @see {@link Model.updateMany} */
    static async updateMany(filter: AnyFilter<P>, update: AnyUpdate<P>, options: ModelUpdateManyOptions = {}): Promise<boolean | Document<P>[]> {
      if ((this.schema.noUpdates === true) || (this.schema.noUpdateMany === true)) throw new Error(`[${this.schema.model}] Multiple updates are disallowed for this model`)

      const filterToApply = sanitizeFilter(this.schema, filter)
      const updateToApply = await this.beforeUpdateMany(filterToApply, update, options)

      if (options.returnDocument) {
        const [, newDocs] = await CRUD.findManyAndUpdate(this.schema, filterToApply, updateToApply, options as Exclude<ModelUpdateManyOptions, UpdateOptions>)
        debug('Updating multiple existing documents...', 'OK', filterToApply, updateToApply, options, newDocs)
        await this.afterUpdateMany(undefined, newDocs)
        return options.returnDocument === 'after' ? newDocs : []
      }
      else {
        const result = await CRUD.updateMany(this.schema, filterToApply, updateToApply, options as Exclude<ModelUpdateManyOptions, FindOneAndUpdateOptions>)
        debug('Updating multiple existing documents...', 'OK', filterToApply, updateToApply, options, result)
        await this.afterUpdateMany()
        return result
      }
    }

    /** @see {@link Model.deleteOneStrict} */
    static async deleteOneStrict(filter: AnyFilter<P>, options: ModelDeleteOneOptions = {}): Promise<boolean | Document<P>> {
      if (this.schema.noDeletes === true) throw new Error(`[${this.schema.model}] Deletions are disallowed for this model`)

      const filterToApply = sanitizeFilter(this.schema, filter)
      await this.beforeDeleteOne(filterToApply, options)

      if (options.returnDocument === true) {
        const deletedDoc = await CRUD.findAndDeleteOne(this.schema, filterToApply, options as Exclude<ModelDeleteOneOptions, DeleteOptions>)
        debug('Deleting an existing document...', 'OK', filter, deletedDoc)
        await this.afterDeleteOne(deletedDoc)
        return deletedDoc
      }
      else {
        const result = await CRUD.deleteOne(this.schema, filterToApply, options as Exclude<ModelDeleteOneOptions, FindOneAndDeleteOptions>)
        debug('Deleting an existing document...', 'OK', filter)
        await this.afterDeleteOne()
        return result
      }
    }

    /** @see {@link Model.deleteOne} */
    static async deleteOne(filter: AnyFilter<P>, options: ModelDeleteOneOptions = {}): Promise<boolean | Document<P> | undefined> {
      try {
        const res = await this.deleteOneStrict(filter, options)
        return res
      }
      catch (err) {
        return options.returnDocument === true ? undefined : false
      }
    }

    /** @see {@link Model.deleteMany} */
    static async deleteMany(filter: AnyFilter<P>, options: ModelDeleteManyOptions = {}): Promise<boolean | Document<P>[]> {
      if ((this.schema.noDeletes === true) || (this.schema.noDeleteMany === true)) throw new Error(`[${this.schema.model}] Multiple deletions are disallowed for this model`)

      const filterToApply = sanitizeFilter(this.schema, filter)
      await this.beforeDeleteMany(filterToApply, options)

      if (options.returnDocument === true) {
        const deletedDocs = await CRUD.findManyAndDelete(this.schema, filterToApply, options as Exclude<ModelDeleteManyOptions, DeleteOptions>)
        debug('Deleting multiple existing documents...:', 'OK', filterToApply, deletedDocs)
        await this.afterDeleteMany(deletedDocs)
        return deletedDocs
      }
      else {
        await CRUD.deleteMany(this.schema, filterToApply, options as Exclude<ModelDeleteManyOptions, FindOneAndDeleteOptions>)
        debug('Deleting multiple existing documents...:', 'OK', filterToApply)
        await this.afterDeleteMany()
        return true
      }
    }

    /** @see {@link Model.replaceOneStrict} */
    static async replaceOneStrict(filter: AnyFilter<P>, replacement?: DocumentFragment<P>, options: ModelReplaceOneOptions = {}): Promise<boolean | Document<P>> {
      if (options.upsert === true) throw new Error('Replacement upserts are not supported at this point')

      const filterToApply = sanitizeFilter(this.schema, filter)
      const replacementToApply = await this.beforeReplaceOne(filterToApply, replacement ?? await this.randomFields(), options)

      if (options.returnDocument) {
        const [oldDoc, newDoc] = await CRUD.findOneAndReplace(this.schema, filterToApply, replacementToApply, options as Exclude<ModelReplaceOneOptions, ReplaceOptions>)
        debug('Replacing an existing document...', 'OK', filterToApply, replacementToApply, oldDoc, newDoc)
        await this.afterReplaceOne(oldDoc, newDoc)
        return options.returnDocument === 'before' ? oldDoc : newDoc
      }
      else {
        const result = await CRUD.replaceOne(this.schema, filterToApply, replacementToApply, options as Exclude<ModelReplaceOneOptions, FindOneAndReplaceOptions>)
        debug('Replacing an existing document...', 'OK', filterToApply, replacementToApply)
        await this.afterReplaceOne()
        return result
      }
    }

    /** @see {@link Model.replaceOne} */
    static async replaceOne(filter: AnyFilter<P>, replacement?: DocumentFragment<P>, options: ModelReplaceOneOptions = {}): Promise<boolean | Document<P> | undefined> {
      try {
        const res = await this.replaceOneStrict(filter, replacement, options)
        return res
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
    static async count(filter: AnyFilter<P>): Promise<number> {
      const result = await this.identifyMany(filter)
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
     * Handler invoked at the beginning of {@link insertOne} to apply any custom pre-processing to
     * the document prior to inserting. Throwing an error within this handler will terminate
     * {@link insertOne} immediately.
     *
     * @param doc - The document to be inserted.
     * @param options - Additional options.
     *
     * @returns The document to be inserted.
     */
    protected static async willInsertOne(doc: DocumentFragment<P>): Promise<DocumentFragment<P>> {
      return doc
    }

    /**
     * Hanlder invoked after a successful {@link insertOne} operation. Throwing an error within this
     * handler can prohib {@link insertOne} from returning.
     *
     * @param doc - The inserted document.
     */
    protected static async didInsertOne(doc: Readonly<Document<P>>): Promise<void> {}

    /**
     * Handler invoked at the beginning of {@link insertMany} to apply any custom pre-processing to
     * the documents prior to inserting. Throwing an error within this handler will terminate
     * {@link insertMany} immediately.
     *
     * @param docs - The documents to be inserted.
     *
     * @returns The modified documents to be inserted.
     */
    protected static async willInsertMany(docs: DocumentFragment<P>[]): Promise<DocumentFragment<P>[]> {
      return docs
    }

    /**
     * Handler invoked after a successful {@link insertMany} operation. Throwing an error within
     * this hanlder can prohibit {@link insertMany} from returning.
     *
     * @param docs - The inserted documents.
     */
    protected static async didInsertMany(docs: Readonly<Document<P>[]>): Promise<void> {}

    /**
     * Handler invoked at the beginning of {@link updateOne} to apply any custom pre-processing to
     * the update filter prior to updating. Throwing an error within this handler will terminate
     * {@link updateOne} immediately.
     *
     * @param filter - The filter for the document to update.
     * @param update - The update to be applied.
     *
     * @returns The modified update to be applied.
     */
    protected static async willUpdateOne(filter: Readonly<Filter<Document<P>>>, update: UpdateFilter<Document<P>>): Promise<AnyUpdate<P>> {
      return update
    }

    /**
     * Handler invoked after a successful {@link updateOne} operation. Throwing an error within this
     * handler can prohibit {@link updateOne} from returning.
     *
     * @param oldDoc - The document before the update. This is only available if `returnDocument`
     *                 was set during {@link updateOne}.
     * @param newDoc - The document after the update. This is only available if `returnDocument` was
     *                 set during {@link updateOne}.
     */
    protected static async didUpdateOne(oldDoc?: Readonly<Document<P>>, newDoc?: Readonly<Document<P>>): Promise<void> {}

    /**
     * Handler invoked at the beginning of {@link updateMany} to apply any custom pre-processing to
     * the update filter prior to updating. Throwing an error within this handler will terminate
     * {@link updateMany} immediately.
     *
     * @param filter - The filter for the documents to update.
     * @param update - The update to be applied.
     *
     * @returns The modified update to be applied.
     */
    protected static async willUpdateMany(filter: Readonly<Filter<Document<P>>>, update: UpdateFilter<Document<P>>): Promise<AnyUpdate<P>> {
      return update
    }

    /**
     * Handler invoked after a successful {@link updateMany} operation. Throwing an error within
     * this handler can prohibit {@link updateMany} from returning.
     *
     * @param oldDocs - The documents before the update. They are only available if `returnDocument`
     *                  was set during {@link updateMany}.
     * @param newDocs - The documents after the update (array order consistency with `oldDocs` not
     *                  guaranteed). They are only available if `returnDocument` was set during
     *                  {@link updateMany}.
     */
    protected static async didUpdateMany(oldDocs?: Readonly<Document<P>[]>, newDocs?: Readonly<Document<P>[]>): Promise<void> {}

    /**
     * Handler invoked at the beginning of {@link deleteOne}. Throwing an error within this handler
     * will terminate {@link deleteOne} immediately.
     *
     * @param filter - The filter for the document to be deleted.
     */
    protected static async willDeleteOne(filter: Readonly<Filter<Document<P>>>): Promise<void> {}

    /**
     * Handler invoked after a successful {@link deleteOne} operation. Throwing an error within this
     * handler can prohibit {@link deleteOne} from returning.
     *
     * @param doc - The deleted document.
     */
    protected static async didDeleteOne(doc?: Readonly<Document<P>>): Promise<void> {}

    /**
     * Handler invoked at the beginning of {@link deleteMany}. Throwing an error within this handler
     * will terminate {@link deleteMany} immediately.
     *
     * @param filter - The filter for the documents to be deleted.
     */
    protected static async willDeleteMany(filter: Readonly<Filter<Document<P>>>): Promise<void> {}

    /**
     * Handler invoked after a successful {@link deleteMany} operation. Throwing an error within
     * this handler can prohibit {@link deleteMany} from returning.
     *
     * @param docs - The deleted documents.
     */
    protected static async didDeleteMany(docs?: Readonly<Document<P>[]>): Promise<void> {}

    /**
     * Handler invoked at the beginning of {@link replaceOne} to apply any custom pre-processing to
     * the new document prior to replacement. Throwing an error within this handler will terminate
     * {@link replaceOne} immediately.
     *
     * @param filter - The filter for the document to be replaced.
     * @param replacement - The replacement document.
     *
     * @returns The modified replacement document.
     */
    protected static async willReplaceOne(filter: Readonly<Filter<Document<P>>>, replacement: DocumentFragment<P>): Promise<DocumentFragment<P>> {
      return replacement
    }

    /**
     * Handler invoked after a successful {@link replaceOne} operation. Throwing an error within
     * this handler can prohibit {@link replaceOne} from returning.
     *
     * @param oldDoc - The document that was replaced. This is only available if `returnDocument`
     *                 was set during {@link replaceOne}.
     * @param newDoc - The new document. This is only available if `returnDocument` was set during
     *                 {@link replaceOne}.
     */
    protected static async didReplaceOne(oldDoc?: Readonly<Document<P>>, newDoc?: Readonly<Document<P>>): Promise<void> {}

    private static async beforeInsertOne(doc: DocumentFragment<P>, options: ModelInsertOneOptions = {}): Promise<InsertableDocument<P>> {
      const modifiedDoc = await this.willInsertOne(doc)
      const res = await this.processDocumentBeforeInsert(modifiedDoc, options)
      return res
    }

    private static async afterInsertOne(doc: Document<P>): Promise<void> {
      await this.didInsertOne(doc)
    }

    private static async beforeInsertMany(docs: DocumentFragment<P>[], options: ModelInsertManyOptions = {}): Promise<InsertableDocument<P>[]> {
      const modifiedDocs = await this.willInsertMany(docs)
      const docsToInsert: InsertableDocument<P>[] = []

      for (let i = 0, n = modifiedDocs.length; i < n; i++) {
        const doc = modifiedDocs[i]
        const docToInsert = await this.processDocumentBeforeInsert(doc, options)
        docsToInsert.push(docToInsert)
      }

      return docsToInsert
    }

    private static async afterInsertMany(docs: Document<P>[]): Promise<void> {
      await this.didInsertMany(docs)
    }

    private static async beforeUpdateOne(filter: Filter<Document<P>>, update: UpdateFilter<Document<P>>, options: ModelUpdateOneOptions = {}): Promise<UpdateFilter<Document<P>>> {
      const res = await this.processUpdateBeforeUpdate(filter, update, options)
      return res
    }

    private static async afterUpdateOne(oldDoc?: Document<P>, newDoc?: Document<P>): Promise<void> {
      await this.didUpdateOne(oldDoc, newDoc)
    }

    private static async beforeUpdateMany(filter: Filter<Document<P>>, update: UpdateFilter<Document<P>>, options: ModelUpdateManyOptions = {}): Promise<UpdateFilter<Document<P>>> {
      const res = await this.processUpdateBeforeUpdate(filter, update, options)
      return res
    }

    private static async afterUpdateMany(oldDocs?: Document<P>[], newDocs?: Document<P>[]): Promise<void> {
      await this.didUpdateMany(oldDocs, newDocs)
    }

    private static async beforeDeleteOne(filter: Filter<Document<P>>, options: ModelDeleteOneOptions): Promise<void> {
      await this.willDeleteOne(filter)
    }

    private static async afterDeleteOne(doc?: Document<P>): Promise<void> {
      if (doc) {
        if (typeIsValidObjectId(doc._id)) {
          await this.cascadeDelete(doc._id)
        }
      }

      await this.didDeleteOne(doc)
    }

    private static async beforeDeleteMany(filter: Filter<Document<P>>, options: ModelDeleteManyOptions): Promise<void> {
      this.willDeleteMany(filter)
    }

    private static async afterDeleteMany(docs?: Document<P>[]): Promise<void> {
      if (docs) {
        for (const doc of docs) {
          if (!typeIsValidObjectId(doc._id)) continue
          await this.cascadeDelete(doc._id)
        }
      }

      await this.didDeleteMany(docs)
    }

    private static async beforeReplaceOne(filter: Filter<Document<P>>, doc: DocumentFragment<P>, options: ModelReplaceOneOptions = {}): Promise<InsertableDocument<P>> {
      const modifiedDoc = await this.willReplaceOne(filter, doc)
      const res = await this.processDocumentBeforeInsert(modifiedDoc, options)
      return res
    }

    private static async afterReplaceOne(oldDoc?: Document<P>, newDoc?: Document<P>): Promise<void> {
      if (oldDoc) {
        await this.cascadeDelete(oldDoc._id)
      }

      await this.didReplaceOne(oldDoc, newDoc)
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

    private static async processDocumentBeforeInsert(doc: DocumentFragment<P>, { ignoreTimestamps, ...opts }: ModelInsertOneOptions | ModelInsertManyOptions = {}): Promise<InsertableDocument<P>> {
      let docToInsert = sanitizeDocument(this.schema, doc)

      // Unless specified, always renew the `createdAt` and `updatedAt` fields.
      if ((this.schema.timestamps === true) && (ignoreTimestamps !== true)) {
        if (!_.isDate(docToInsert.createdAt)) docToInsert.createdAt = new Date() as any
        if (!_.isDate(docToInsert.updatedAt)) docToInsert.updatedAt = new Date() as any
      }

      // Before inserting this document, go through each field and make sure that it has default
      // values and that they are formatted correctly.
      for (const key in this.schema.fields) {
        if (!this.schema.fields.hasOwnProperty(key)) continue
        if (docToInsert.hasOwnProperty(key)) continue

        const defaultValue = this.defaultProps[key]

        // Check if the field has a default value defined in the schema. If so, apply it.
        if (_.isUndefined(defaultValue)) continue

        docToInsert[key] = (_.isFunction(defaultValue)) ? defaultValue() : defaultValue
      }

      // Apply format function defined in the schema if applicable.
      docToInsert = await this.formatDocument(docToInsert)

      // Finally, validate the document. Ignore unique indexes in this step. Let the db throw an
      // error if the inserted doc violates those indexes.
      await this.validateDocument(docToInsert, { ignoreUniqueIndex: true, strict: true, accountForDotNotation: false, ...opts })

      return docToInsert as InsertableDocument<P>
    }

    /**
     * @todo Handle remaining update operators.
     */
    private static async processUpdateBeforeUpdate(filter: Filter<Document<P>>, update: UpdateFilter<Document<P>>, options: ModelUpdateOneOptions | ModelUpdateManyOptions = {}): Promise<UpdateFilter<Document<P>>> {
      if ((options.upsert === true) && (this.schema.allowUpserts !== true)) throw new Error(`[${this.schema.model}] Attempting to upsert a document while upserting is disallowed in the schema`)

      const updateToApply = sanitizeUpdate(this.schema, update, options)

      // Format all fields in the update filter.
      if (updateToApply.$set) {
        updateToApply.$set = await this.formatDocument(updateToApply.$set as Document<P>) as any
      }

      // In the case of an upsert, we need to preprocess the filter as if this was an insertion. We
      // also need to tell the database to save all fields in the filter as well, unless they are
      // already in the update query.
      if (options.upsert === true && typeIsAnyDocument(filter)) {
        // Make a copy of the filter in case it is manipulated by the hooks.
        const docIfUpsert = await this.processDocumentBeforeInsert(filter as DocumentFragment<P>, { ...options, strict: false })
        const setOnInsert = _.omit({
          ...updateToApply.$setOnInsert ?? {},
          ...docIfUpsert,
        }, [
          ...Object.keys(updateToApply.$set ?? {}),
          ...Object.keys(updateToApply.$unset ?? {}),
        ]) as DocumentFragment<P>

        if (!_.isEmpty(setOnInsert)) {
          updateToApply.$setOnInsert = setOnInsert as any
        }
      }

      // Validate all fields in the update. Account for dot notations to facilitate updating fields
      // in nested fields.
      if (updateToApply.$set && !_.isEmpty(updateToApply.$set)) {
        await this.validateDocument(updateToApply.$set as DocumentFragment<P>, { ...options, ignoreUniqueIndex: true, accountForDotNotation: true })
      }

      return updateToApply
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
