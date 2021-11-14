import { AggregateOptions, BulkWriteOptions, Collection, DeleteOptions, FindOneAndDeleteOptions, FindOneAndReplaceOptions, FindOneAndUpdateOptions, InsertOneOptions, ObjectId, ReplaceOptions, UpdateOptions } from 'mongodb'
import { AnyFilter, AnyProps, AnyUpdate, Document, DocumentFragment } from '../types'
import { SanitizeUpdateOptions } from '../utils/sanitizeUpdate'
import { AggregationPipeline, AggregationPipelineFactoryOperators, AggregationPipelineFactoryOptions } from './aggregation'
import Schema, { FieldValue } from './Schema'

type LocalModel = {

}

export type ModelRandomPropertyProvider<P extends AnyProps = AnyProps> = { [K in keyof P]?: FieldRandomValueFunction<NonNullable<P[K]>> }

/**
 * Function for generating a random value for the associated field.
 */
export type FieldRandomValueFunction<V = FieldValue> = () => V

export type ModelDefaultPropertyProvider<P extends AnyProps = AnyProps> = { [K in keyof P]?: NonNullable<P[K]> | FieldDefaultValueFunction<NonNullable<P[K]>> }

/**
 * Function for generating a default value for the associated field.
 */
export type FieldDefaultValueFunction<V = FieldValue> = () => V

export type ModelPropertyFormattingProvider<P extends AnyProps = AnyProps> = { [K in keyof P]?: FieldFormatFunction<NonNullable<P[K]>> }

/**
 * Function for formatting field values, in which the value to be formatted will be passed into this
 * function as its only paramenter.
 */
export type FieldFormatFunction<V = FieldValue> = (value: V) => V

export type ModelPropertyValidationProvider<P extends AnyProps = AnyProps> = { [K in keyof P]?: FieldValidationStrategy<NonNullable<P[K]>> }

/**
 * The validation strategy can be one of several types. The behavior per type is as follows:
 *   1. RegExp: The value to be validated must pass for RegExp.test().
 *   2. number: The value to be validated must be <= this number. If the value is a string, its
 *              length must be <= this number.
 *   3. any[]: The value to be validated must be one of the elements of this array.
 *   4. Function: The value to be validated will be passed into this function and it must return
 *      `true`.
 */
export type FieldValidationStrategy<V = FieldValue> = RegExp | number | V[] | FieldValidationFunction<V>

/**
  * Function for validating field values, in which the value to be validated is passed into the
  * function as its only argument.
  */
export type FieldValidationFunction<V = FieldValue> = (value: V) => boolean

export type ModelRandomFieldsOptions = {
  /**
   * Specifies whether optional fields will be generated as well.
   */
  includeOptionals?: boolean
}

export type ModelFindOneOptions = AggregateOptions & {

}

export type ModelFindManyOptions = AggregateOptions & {

}

export type ModelInsertOneOptions = ModelValidateDocumentOptions & InsertOneOptions & {
  /**
   * Specifies whether timestamp fields (i.e. `createdAt` and `updatedAt`) are automatically
   * generated before insertion.
   */
  ignoreTimestamps?: boolean
}

export type ModelInsertManyOptions = ModelValidateDocumentOptions & BulkWriteOptions & {
  /**
   * Specifies whether timestamp fields (i.e. `createdAt` and `updatedAt`) are automatically
   * generated before insertion.
   */
  ignoreTimestamps?: boolean
}

export type ModelUpdateOneOptions = ModelValidateDocumentOptions & SanitizeUpdateOptions & UpdateOptions & FindOneAndUpdateOptions & {
  /**
   * Specifies whether updated doc is returned when update completes.
   */
  returnDoc?: boolean

  /**
   * Specifies whether timestamp fields (i.e. `createdAt` and `updatedAt`) are automatically
   * generated before insertion.
   */
  ignoreTimestamps?: boolean
}

export type ModelUpdateManyOptions = ModelValidateDocumentOptions & SanitizeUpdateOptions & UpdateOptions & FindOneAndUpdateOptions & {
  /**
   * Specifies whether updated docs are returned when update completes.
   */
  returnDocs?: boolean

  /**
   * Specifies whether timestamp fields (i.e. `createdAt` and `updatedAt`) are automatically
   * generated before insertion.
   */
  ignoreTimestamps?: boolean
}

export type ModelDeleteOneOptions = DeleteOptions & FindOneAndDeleteOptions & {
  /**
   * Specifies whether deleted doc is returned when deletion completes.
   */
  returnDoc?: boolean
}

export type ModelDeleteManyOptions = DeleteOptions & FindOneAndReplaceOptions & {
  /**
   * Specifies whether deleted docs are returned when deletion completes.
   */
  returnDocs?: boolean
}

export type ModelReplaceOneOptions = ReplaceOptions & FindOneAndReplaceOptions & ModelInsertOneOptions & {

}

export type ModelCountOptions = ModelFindManyOptions & {

}

export interface ModelValidateDocumentOptions {
  /**
   * Tells the validation process to account for required fields. That is, if this is `true` and
   * some required fields are missing in the document to be validated, validation fails.
   */
  strict?: boolean

  /**
   * Tells the validation process to account for unique indexes. That is, if this is `false` and one
   * or more field values are not unique when it supposedly has a unique index, validation fails.
   */
  ignoreUniqueIndex?: boolean

  /**
   * Tells the validation process that the document contains dot notations to in its keys. Dot
   * notations are usually used by udate queries to update fields in an embedded doc as opposed to a
   * top-level field.
   */
  accountForDotNotation?: boolean
}

/**
 * Generic interface of a model.
 */
export default interface Model<T> {

  /**
   * Schema of this model.
   */
  schema: Schema<T>

  /**
   * Dictionary of random value generators for this model's props.
   */
  randomProps: ModelRandomPropertyProvider<T>

  /**
   * Dictionary of default value generators for this model's props.
   */
  defaultProps: ModelDefaultPropertyProvider<T>

  /**
   * Dictionary of value formatters for this model's props.
   */
  formatProps: ModelPropertyFormattingProvider<T>

  /**
   * Dictionary of value validators for this model's props.
   */
  validateProps: ModelPropertyValidationProvider<T>

  /**
   * This is meant to be used as a static class so instantiation is strictly prohibited.
   *
   * @throws {Error} Attempting to instantiate this model even though it is meant to be a static
   *                 class.
   */
  new(): LocalModel

  /**
   * Gets the MongoDB collection associated with this model.
   *
   * @returns The MongoDB collection.
   *
   * @see getCollection()
   *
   * @throws {Error} Model class has no static property `schema` defined.
   */
  getCollection(): Promise<Collection>

  /**
   * Generates random fields for this model. By default, only fields that are marked as required and
   * has a random() function defined will have random values generated. Specify `includeOptionals`
   * to generate unrequired fields as well.
   *
   * @param fixedFields - A collection of fields that must be present in the output.
   * @param options - See `ModelRandomFieldsOptions`.
   *
   * @returns A collection of fields whose values are randomly generated.
   *
   * @throws {Error} Invalid function provided for a random field.
   */
  randomFields(fixedFields?: DocumentFragment<T>, options?: ModelRandomFieldsOptions): Promise<DocumentFragment<T>>

  /**
   * Generates an aggregation pipeline specifically for the schema associated with this schema.
   *
   * @param queryOrOperators - This is either a query for the $match stage or operators for the
   *                           aggregation factory function.
   * @param options - See `AggregationPipelineFactoryOptions`.
   *
   * @returns Aggregation pipeline.
   *
   * @throws {Error} Model class has no static property `schema` defined.
   */
  pipeline(queryOrOperators?: AnyFilter<T> | AggregationPipelineFactoryOperators<T>, options?: AggregationPipelineFactoryOptions): AggregationPipeline

  /**
   * Identifies the ObjectId of exactly one document matching the given filter. Error is thrown if
   * the document cannot be identified.
   *
   * @param filter - Filter used for the `$match` stage of the aggregation pipeline.
   *
   * @returns The matching ObjectId.
   *
   * @throws {Error} No document is found with the given filter.
   * @throws {Error} ID of the found document is not a valid ObjectId.
   */
  identifyOneStrict(filter: AnyFilter<T>): Promise<ObjectId>

  /**
   * Same as the strict identify one operation but this method drops all errors and returns
   * `undefined` if the document canot be identified.
   *
   * @param filter - Filter used for the `$match` stage of the aggregation pipeline.
   *
   * @returns The matching ObjectId.
   *
   * @see Model.identifyOneStrict
   */
  identifyOne(filter: AnyFilter<T>): Promise<ObjectId | undefined>

  /**
   * Returns an array of document IDs that match the filter.
   *
   * @param filter - AnyFilter for this model.
   *
   * @returns Array of matching IDs.
   */
  identifyMany(filter?: AnyFilter<T>): Promise<ObjectId[]>

  /**
   * Finds one document from this collection using the aggregation framework. If no filter is
   * specified, a random document will be fetched.
   *
   * @param filter - Filter used for the `$match` stage of the aggregation pipeline.
   * @param options - See `module:mongodb.Collection#aggregate`.
   *
   * @returns The matching document as the fulfillment value.
   *
   * @throws {Error} More or less than 1 document found.
   * @throws {Error} No document found.
   */
  findOneStrict<R = T>(filter?: AnyFilter<T> | AggregationPipeline, options?: ModelFindOneOptions): Promise<Document<R>>

  /**
   * Same as the strict find one operation but this method drops all errors and returns `undefined`
   * when no document is found.
   *
   * @param filter - Filter used for the `$match` stage of the aggregation pipeline.
   * @param options - See `module:mongodb.Collection#aggregate`.
   *
   * @returns The matching document as the fulfillment value.
   *
   * @see Model.findOneStrict
   */
  findOne<R = T>(filter?: AnyFilter<T> | AggregationPipeline, options?: ModelFindOneOptions): Promise<Document<R> | undefined>

  /**
   * Finds multiple documents of this collection using the aggregation framework. If no query is
   * specified, all documents are fetched.
   *
   * @param filter - Filter used for the `$match` stage of the aggregation pipeline.
   * @param options - See `module:mongodb.Collection#aggregate`.
   *
   * @returns The matching documents as the fulfillment value.
   */
  findMany<R = T>(filter?: AnyFilter<T> | AggregationPipeline, options?: ModelFindManyOptions): Promise<Document<R>[]>

  /**
   * Inserts one document into this model's collection. If `doc` is not specified, random fields
   * will be generated.
   *
   * @param doc - Document to be inserted. See `module:mongodb.Collection#insertOne`.
   * @param options - See `ModelInsertOneOptions`.
   *
   * @returns The inserted document.
   *
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#insertOne}
   * @see
   * {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~insertWriteOpResult}
   *
   * @throws {Error} This method is called even though insertions are disabled in the schema.
   * @throws {MongoError} collection#insertOne failed.
   */
  insertOneStrict(doc?: DocumentFragment<T>, options?: ModelInsertOneOptions): Promise<Document<T>>

  /**
   * Same as the strict insert one operation except this method swallows all errors and returns
   * `undefined` if the document cannot be inserted.
   *
   * @param doc - Document to be inserted. See `module:mongodb.Collection#insertOne`.
   * @param options - See `ModelInsertOneOptions`.
   *
   * @returns The inserted document.
   *
   * @see Model.insertOneStrict
   */
  insertOne(doc?: DocumentFragment<T>, options?: ModelInsertOneOptions): Promise<Document<T> | undefined>

  /**
   * Inserts multiple documents into this model's collection.
   *
   * @param docs - Array of documents to insert. See `module:mongodb.Collection#insertMany`.
   * @param options - See `module:mongodb.Collection#insertMany`.
   *
   * @returns The inserted documents.
   *
   * @todo This method iterates through every document to apply the
   *       `beforeInsert` hook. Consider a more cost-efficient approach?
   *
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#insertMany}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~insertWriteOpResult}
   *
   * @throws {Error} This method is called even though insertions or multiple
   *                 insertions are disabled in the schema.
   */
  insertMany(docs: DocumentFragment<T>[], options?: ModelInsertManyOptions): Promise<Document<T>[]>

  /**
   * Updates one document matched by `filter` with `update` object. Note that if upserting, all
   * *required* fields must be in the `filter` param instead of the `update` param.
   *
   * @param filter - Filter for the document to update.
   * @param update - Either an object whose key/value pair represent the fields belonging to this
   *                 model to update to, or an update query.
   * @param options - See `ModelUpdateOneOptions`.
   *
   * @returns The updated doc if `returnDoc` is set to `true`, or a boolean indicating whether a
   *          doc was updated or upserted.
   *
   * @see {@link https://docs.mongodb.com/manual/reference/operator/update-field/}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#updateOne}
   * @see
   * {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndUpdate}
   * @see
   * {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~updateWriteOpResult}
   *
   * @throws {Error} This method is called even though updates are disabled in the schema.
   * @throws {Error} Filter is invalid.
   * @throws {Error} A doc is updated but it cannot be found.
   */
  updateOneStrict(query: AnyFilter<T>, update: AnyUpdate<T>, options?: ModelUpdateOneOptions): Promise<boolean | Document<T>>

  /**
   * Same as the strict update one operation except this method drops all errors and returns
   * `undefined` if no document was updated (and that `returnDoc` is `true`) or `true`/`false` (if
   * `returnDoc` is `false`).
   *
   * @param filter - Filter for the document to update.
   * @param update - Either an object whose key/value pair represent the fields belonging to this
   *                 model to update to, or an update query.
   * @param options - See `ModelUpdateOneOptions`.
   *
   * @returns The updated doc if `returnDoc` is set to `true`, else either `true` or `false`
   *          depending on whether the operation was successful.
   *
   * @see Model.updateOneStrict
   */
  updateOne(filter: AnyFilter<T>, update: AnyUpdate<T>, options?: ModelUpdateOneOptions): Promise<boolean | Document<T> | undefined>

  /**
   * Updates multiple documents matched by `filter` with `update` object.
   *
   * @param filter - Filter for document to update.
   * @param update - Either an object whose key/value pair represent the fields belonging to this
   *                 model to update to, or an update query.
   * @param options - See `ModelUpdateManyOptions`.
   *
   * @returns The updated docs if `returnDocs` is set to `true`, else `true` or `false` depending on
   *          whether or not the operation was successful.
   *
   * @see {@link https://docs.mongodb.com/manual/reference/operator/update-field/}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#updateMany}
   * @see
   * {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndUpdate}
   * @see
   * {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~updateWriteOpResult}
   *
   * @throws {Error} This method is called even though updates or multiple updates are disabled in
   *                 the schema.
   * @throws {Error} One of the updated docs are not returned.
   */
  updateMany(filter: AnyFilter<T>, update: AnyUpdate<T>, options?: ModelUpdateManyOptions): Promise<Document<T>[] | boolean>

  /**
   * Deletes one document matched by `filter`.
   *
   * @param filter - Filter for document to delete.
   * @param options - See `ModelDeleteOneOptions`.
   *
   * @returns The deleted doc if `returnDoc` is set to `true`, or a boolean indicating whether the
   *          doc is deleted.
   *
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#deleteOne}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndDelete}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~deleteWriteOpResult}
   *
   * @throws {Error} This method is called even though deletions are disabled in the schema.
   * @throws {Error} Unable to return the deleted document when `returnDoc` is `true`.
   * @throws {Error} Unable to delete document.
   */
  deleteOneStrict(filter: AnyFilter<T>, options?: ModelDeleteOneOptions): Promise<Document<T> | boolean>

  /**
   * Same as the strict delete one operation except this method drops all errors.
   *
   * @param filter - Filter for document to delete.
   * @param options - See `ModelDeleteOneOptions`.
   *
   * @returns The deleted doc if `returnDoc` is set to `true`, else `true` or `false` depending on
   *          whether or not the operation was successful.
   *
   * @see Model.deleteOneStrict
   */
  deleteOne(filter: AnyFilter<T>, options?: ModelDeleteOneOptions): Promise<Document<T> | boolean | undefined>

  /**
   * Deletes multiple documents matched by `filter`.
   *
   * @param filter - AnyFilter to match documents for deletion.
   * @param options - See `ModelDeleteManyOptions`.
   *
   * @returns The deleted docs if `returnDocs` is set to `true`, else `true` or `false` depending on
   *          whether or not the operation was successful.
   *
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#deleteMany}
   * @see
   * {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndDelete}
   * @see
   * {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~deleteWriteOpResult}
   *
   * @throws {Error} This method is called even though deletions or multiple deletions are disabled
   *                 in the schema.
   */
  deleteMany(filter: AnyFilter<T>, options?: ModelDeleteManyOptions): Promise<boolean | Document<T>[]>

  /**
   * Replaces one document with another. If `replacement` is not specified, one with random info
   * will be generated.
   *
   * @param filter - Filter for document to replace.
   * @param replacement - The replacement document.
   * @param options - See `ModelReplaceOneOptions`.
   *
   * @returns The replaced document (by default) or the new document (depending on the
   *          `returnDocument` option).
   *
   * @see
   * {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndReplace}
   * @see
   * {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~findAndModifyWriteOpResult}
   *
   * @throws {Error} The old document cannot be returned.
   * @throws {Error} The doc is replaced but it cannot be fetched.
   */
  findAndReplaceOneStrict(filter: AnyFilter<T>, replacement?: DocumentFragment<T>, options?: ModelReplaceOneOptions): Promise<Document<T>>

  /**
   * Same as the strict find and replace one operation except this method drops all errors.
   *
   * @param filter - Filter for document to replace.
   * @param replacement - The replacement document.
   * @param options - See `ModelReplaceOneOptions`.
   *
   * @returns The replaced document (by default) or the new document (depending on the
   *          `returnDocument` option) if available, `undefined` otherwise.
   *
   * @see Model.findAndReplaceOneStrict
   */
  findAndReplaceOne(filter: AnyFilter<T>, replacement?: DocumentFragment<T>, options?: ModelReplaceOneOptions): Promise<Document<T> | undefined>

  /**
   * Checks if a document exists.
   *
   * @param filter - Filter for document to check.
   *
   * @returns `true` if document exists, `false` otherwise.
   */
  exists(filter: AnyFilter<T>): Promise<boolean>

  /**
   * Counts the documents that match the provided `filter`.
   *
   * @param filter - Filter used for the `$match` stage of the aggregation pipeline.
   *
   * @returns The total number of documents found. The minimum is 0.
   */
  count(filter: AnyFilter<T>, options?: ModelCountOptions): Promise<number>

  /**
   * Returns a document whose values are formatted according to the format functions defined in the
   * schema. If the field is marked as encrypted in the schema, this process takes care of that too.
   *
   * @param doc - Document to format.
   *
   * @returns The formatted document as the fulfillment value.
   *
   * @throws {Error} A field in the document to format is not defined in the schema.
   */
  formatDocument(doc: DocumentFragment<T>): Promise<DocumentFragment<T>>

  /**
   * Validates a document of this collection and throws an error if validation fails. This method
   * does not modify the document in any way. It checks for the following in order:
   *   1. Each field is defined in the schema.
   *   2. Each field value conforms to the defined field spec.
   *   3. Unique indexes are enforced (only if `ignoreUniqueIndex` is disabled).
   *   4. No required fields are missing (only if `strict` is enabled).
   *
   * @param doc - The doc to validate.
   * @param options - See `ModelValidateDocumentOptions`.
   *
   * @throws {Error} Document is not an object.
   * @throws {Error} Document is empty.
   * @throws {Error} One of the fields in the document is not defined in the schema.
   * @throws {Error} One of the fields in the document does not pass the validation test.
   * @throws {Error} One of the fields has a duplicated value as another document in the collection
   *                 (only if unique indexes are defined in the schema).
   * @throws {Error} Some required fields in the document are missing.
   */
  validateDocument(doc: DocumentFragment<T>, options: ModelValidateDocumentOptions): Promise<void>
}
