import { Collection, ObjectID } from 'mongodb'
import { AggregationPipeline, Document, DocumentFragment, FieldDefaultValueFunction, FieldFormatFunction, FieldRandomValueFunction, FieldValidationStrategy, ModelCountOptions, ModelDeleteManyOptions, ModelDeleteOneOptions, ModelFindManyOptions, ModelFindOneOptions, ModelInsertManyOptions, ModelInsertOneOptions, ModelRandomFieldsOptions, ModelReplaceOneOptions, ModelUpdateManyOptions, ModelUpdateOneOptions, ModelValidateDocumentOptions, PipelineFactoryOperators, PipelineFactoryOptions, Query, Schema, Update } from '../types'

type ModelImpl = {}

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
  randomProps: { [K in keyof T]?: FieldRandomValueFunction<NonNullable<T[K]>> }

  /**
   * Dictionary of default value generators for this model's props.
   */
  defaultProps: { [K in keyof T]?: NonNullable<T[K]> | FieldDefaultValueFunction<NonNullable<T[K]>> }

  /**
   * Dictionary of value formatters for this model's props.
   */
  formatProps: { [K in keyof T]?: FieldFormatFunction<NonNullable<T[K]>> }

  /**
   * Dictionary of value validators for this model's props.
   */
  validateProps: { [K in keyof T]?: FieldValidationStrategy<NonNullable<T[K]>> }

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
   * @param queryOrOperators - This is either a query for the $match stage or operators for the aggregation factory
   *                           function.
   * @param options - See `PipelineFactoryOptions`.
   *
   * @returns Aggregation pipeline.
   *
   * @throws {Error} Model class has no static property `schema` defined.
   */
  pipeline(queryOrOperators?: Query<T> | PipelineFactoryOperators<T>, options?: PipelineFactoryOptions): AggregationPipeline

  /**
   * Identifies the ObjectID of exactly one document matching the given query. Error is thrown if the document cannot
   * be identified.
   *
   * @param query - Query used for the $match stage of the aggregation pipeline.
   *
   * @returns The matching ObjectID.
   *
   * @throws {Error} No document is found with the given query.
   * @throws {Error} ID of the found document is not a valid ObjectID.
   */
  identifyOneStrict(query: Query<T>): Promise<ObjectID>

  /**
   * Same as the strict identify one operation but this method swallows all errors and returns `undefined` if document
   * canot be identified.
   *
   * @param query - Query used for the $match stage of the aggregation pipeline.
   *
   * @returns The matching ObjectID.
   *
   * @see Model.identifyOneStrict
   */
  identifyOne(query: Query<T>): Promise<ObjectID | undefined>

  /**
   * Returns an array of document IDs that match the query.
   *
   * @param query - Query for this model.
   *
   * @returns Array of matching IDs.
   */
  identifyMany(query?: Query<T>): Promise<ObjectID[]>

  /**
   * Finds one document from this collection using the aggregation framework. If no query is specified, a random
   * document will be fetched.
   *
   * @param query - Query used for the $match stage of the aggregation pipeline.
   * @param options - See `module:mongodb.Collection#aggregate`.
   *
   * @returns The matching document as the fulfillment value.
   *
   * @throws {Error} More or less than 1 document found.
   * @throws {Error} No document found.
   */
  findOneStrict<R = T>(query?: Query<T>, options?: ModelFindOneOptions): Promise<Document<R>>

  /**
   * Same as the strict find one operation but this method swallows all errors and returns `undefined` when no
   * document is found.
   *
   * @param query - Query used for the $match stage of the aggregation pipeline.
   * @param options - See `module:mongodb.Collection#aggregate`.
   *
   * @returns The matching document as the fulfillment value.
   *
   * @see Model.findOneStrict
   */
  findOne<R = T>(query?: Query<T>, options?: ModelFindOneOptions): Promise<Document<R> | undefined>

  /**
   * Finds multiple documents of this collection using the aggregation framework. If no query is specified, all
   * documents are fetched.
   *
   * @param query - Query used for the $match stage of the aggregation pipeline.
   * @param options - See `module:mongodb.Collection#aggregate`.
   *
   * @returns The matching documents as the fulfillment value.
   */
  findMany<R = T>(query?: Query<T>, options?: ModelFindManyOptions): Promise<Document<R>[]>

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
   * Same as the strict insert one operation except this method swallows all errors and returns `undefined` if the
   * document cannot be inserted.
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
   * Updates one document matched by `query` with `update` object. Note that if upserting, all *required* fields must
   * be in the `query` param instead of the `update` param.
   *
   * @param query - Query for the document to update.
   * @param update - Either an object whose key/value pair represent the fields belonging to this model to update to,
   *                 or an update query.
   * @param options - See `ModelUpdateOneOptions`.
   *
   * @returns The updated doc if `returnDoc` is set to `true`, else there is no fulfillment value.
   *
   * @see {@link https://docs.mongodb.com/manual/reference/operator/update-field/}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#updateOne}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndUpdate}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~updateWriteOpResult}
   *
   * @throws {Error} This method is called even though updates are disabled in the schema.
   * @throws {Error} Query is invalid probably because it is not santized due to hooks being skipped.
   * @throws {Error} A doc is updated but it cannot be found.
   */
  updateOneStrict(query: Query<T>, update: Update<T>, options?: ModelUpdateOneOptions<T>): Promise<void | Document<T>>

  /**
   * Same as the strict update one operation except this method swallows all errors and returns `undefined` if no
   * document was updated (and that `returnDoc` is `true`) or `true`/`false` (if `returnDoc` is `false`).
   *
   * @param query - Query for the document to update.
   * @param update - Either an object whose key/value pair represent the fields belonging to this model to update to,
   *                 or an update query.
   * @param options - See `ModelUpdateOneOptions`.
   *
   * @returns The updated doc if `returnDoc` is set to `true`, else either `true` or `false` depending on whether the
   *          operation was successful.
   *
   * @see Model.updateOneStrict
   */
  updateOne(query: Query<T>, update: Update<T>, options?: ModelUpdateOneOptions<T>): Promise<boolean | Document<T> | undefined>

  /**
   * Updates multiple documents matched by `query` with `update` object.
   *
   * @param query - Query for document to update.
   * @param update - Either an object whose key/value pair represent the fields belonging to this model to update to,
   *                 or an update query.
   * @param options - See `ModelUpdateManyOptions`.
   *
   * @returns The updated docs if `returnDocs` is set to `true`, else `true` or `false` depending on whether or not
   *         the operation was successful.
   *
   * @see {@link https://docs.mongodb.com/manual/reference/operator/update-field/}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#updateMany}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndUpdate}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~updateWriteOpResult}
   *
   * @throws {Error} This method is called even though updates or multiple updates are disabled in the schema.
   * @throws {Error} One of the updated docs are not returned.
   */
  updateMany(query: Query<T>, update: Update<T>, options?: ModelUpdateManyOptions<T>): Promise<Document<T>[] | boolean>

  /**
   * Deletes one document matched by `query`.
   *
   * @param query - Query for document to delete.
   * @param options - See `ModelDeleteOneOptions`.
   *
   * @returns The deleted doc if `returnDoc` is set to `true`.
   *
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#deleteOne}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndDelete}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~deleteWriteOpResult}
   *
   * @throws {Error} This method is called even though deletions are disabled in the schema.
   * @throws {Error} Unable to return the deleted document when `returnDoc` is `true`.
   * @throws {Error} Unable to delete document.
   */
  deleteOneStrict(query: Query<T>, options?: ModelDeleteOneOptions): Promise<Document<T> | void>

  /**
   * Same as the strict delete one operation except this method swallows all errors.
   *
   * @param query - Query for document to delete.
   * @param options - See `ModelDeleteOneOptions`.
   *
   * @returns The deleted doc if `returnDoc` is set to `true`, else `true` or `false` depending on whether or not the
   *         operation was successful.
   *
   * @see Model.deleteOneStrict
   */
  deleteOne(query: Query<T>, options?: ModelDeleteOneOptions): Promise<Document<T> | boolean | undefined>

  /**
   * Deletes multiple documents matched by `query`.
   *
   * @param query - Query to match documents for deletion.
   * @param options - See `ModelDeleteManyOptions`.
   *
   * @returns The deleted docs if `returnDocs` is set to `true`, else `true` or `false` depending on whether or not
   *         the operation was successful.
   *
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#deleteMany}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndDelete}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~deleteWriteOpResult}
   *
   * @throws {Error} This method is called even though deletions or multiple deletions are disabled in the schema.
   */
  deleteMany(query: Query<T>, options?: ModelDeleteManyOptions): Promise<boolean | Document<T>[]>

  /**
   * Replaces one document with another. If `replacement` is not specified, one with random info will be generated.
   *
   * @param query - Query for document to replace.
   * @param replacement - The replacement document.
   * @param options - See `ModelReplaceOneOptions`.
   *
   * @returns The replaced document (by default) or the new document (depending on the `returnOriginal` option).
   *
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndReplace}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~findAndModifyWriteOpResult}
   *
   * @throws {Error} The old document cannot be returned.
   * @throws {Error} The doc is replaced but it cannot be fetched.
   */
  findAndReplaceOneStrict(query: Query<T>, replacement?: DocumentFragment<T>, options?: ModelReplaceOneOptions<T>): Promise<Document<T>>

  /**
   * Same as the strict find and replace one operation except this method swallows all errors.
   *
   * @param query - Query for document to replace.
   * @param replacement - The replacement document.
   * @param options - See `ModelReplaceOneOptions`.
   *
   * @returns The replaced document (by default) or the new document (depending on the `returnOriginal` option) if
   *          available, `undefined` otherwise.
   *
   * @see Model.findAndReplaceOneStrict
   */
  findAndReplaceOne(query: Query<T>, replacement?: DocumentFragment<T>, options?: ModelReplaceOneOptions<T>): Promise<Document<T> | undefined>

  /**
   * Checks if a document exists.
   *
   * @param query - Query for document to check.
   *
   * @returns `true` if document exists, `false` otherwise.
   */
  exists(query: Query<T>): Promise<boolean>

  /**
   * Counts the documents that match the provided query.
   *
   * @param query - Query used for the $match stage of the aggregation pipeline.
   *
   * @returns The total number of documents found. The minimum is 0.
   */
  count(query: Query<T>, options?: ModelCountOptions): Promise<number>

  /**
   * Returns a document whose values are formatted according to the format functions defined in the schema. If the
   * field is marked as encrypted in the schema, this process takes care of that too.
   *
   * @param doc - Document to format.
   *
   * @returns The formatted document as the fulfillment value.
   *
   * @throws {Error} A field in the document to format is not defined in the schema.
   */
  formatDocument(doc: DocumentFragment<T>): Promise<DocumentFragment<T>>

  /**
   * Validates a document of this collection and throws an error if validation fails. This method does not modify the
   * document in any way. It checks for the following in order:
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
   * @throws {Error} One of the fields has a duplicated value as another document in the collection (only if unique
   *                 indexes are defined in the schema).
   * @throws {Error} Some required fields in the document are missing.
   */
  validateDocument(doc: DocumentFragment<T>, options: ModelValidateDocumentOptions): Promise<void>

  /**
   * This is meant to be used as a static class so instantiation is strictly prohibited.
   *
   * @throws {Error} Attempting to instantiate this model even though it is meant to be a static
   *                 class.
   */
  new(): ModelImpl
}
