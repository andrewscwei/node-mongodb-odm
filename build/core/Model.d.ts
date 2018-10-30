/**
 * @file This is a static, abstract model that provides ORM for a single MongoDB
 *       collection. Every other model must inherit this class. It sets up the
 *       ground work for basic CRUD operations, event triggers, query
 *       validations, etc. All returned documents are native JSON objects.
 */
import { Collection, ObjectID } from 'mongodb';
import { AggregationPipeline, Document, DocumentFragment, ModelCountOptions, ModelDeleteManyOptions, ModelDeleteOneOptions, ModelFindManyOptions, ModelFindOneOptions, ModelInsertManyOptions, ModelInsertOneOptions, ModelRandomFieldsOptions, ModelReplaceOneOptions, ModelUpdateManyOptions, ModelUpdateOneOptions, ModelValidateDocumentOptions, PipelineFactoryOptions, PipelineFactorySpecs, Query, Schema, Update } from '../types';
declare abstract class Model {
    /**
     * Schema of this model. This property must be overridden in the derived
     * class.
     */
    static schema: Schema;
    /**
     * Gets the MongoDB collection associated with this model.
     *
     * @return The MongoDB collection.
     *
     * @see getCollection()
     */
    static getCollection(): Promise<Collection>;
    /**
     * Generates random fields for this model. By default, only fields that are
     * marked as required and has a random() function defined will have random
     * values generated. Specify `includeOptionals` to generate unrequired fields
     * as well.
     *
     * @param fixedFields - A collection of fields that must be present in the
     *                      output.
     * @param options - @see ModelRandomFieldsOptions
     *
     * @return A collection of fields whose values are randomly generated.
     */
    static randomFields<T = {}>(fixedFields?: DocumentFragment<T>, { includeOptionals }?: ModelRandomFieldsOptions): DocumentFragment<T>;
    /**
     * Generates an aggregation pipeline specifically for the schema associated
     * with this schema.
     *
     * @param queryOrSpecs - This is either a query for the $match stage or specs
     *                       for the aggregation factory function.
     * @param options - @see PipelineFactoryOptions
     *
     * @return Aggregation pipeline.
     */
    static pipeline<T = {}>(queryOrSpecs?: Query<T> | PipelineFactorySpecs, options?: PipelineFactoryOptions): AggregationPipeline;
    /**
     * Identifies the ObjectID of exactly one document matching the given query.
     * Error is thrown if the document cannot be identified.
     *
     * @param query - Query used for the $match stage of the aggregation pipeline.
     *
     * @return The matching ObjectID.
     *
     * @throws When no document is found with the given query or when the ID of
     *         the found document is invalid.
     */
    static identifyOne(query: Query): Promise<ObjectID>;
    /**
     * Finds one document of this collection using the aggregation framework. If
     * no query is specified, a random document will be fetched.
     *
     * @param query - Query used for the $match stage of the aggregation pipeline.
     * @param options - @see module:mongodb.Collection#aggregate
     *
     * @return The matching document as the fulfillment value.
     */
    static findOne<T = {}, R = T>(query?: Query<T>, options?: ModelFindOneOptions): Promise<null | Document<R>>;
    /**
     * Finds multiple documents of this collection using the aggregation
     * framework. If no query is specified, all documents are fetched.
     *
     * @param query - Query used for the $match stage of the aggregation pipeline.
     * @param options - @see module:mongodb.Collection#aggregate
     *
     * @return The matching documents as the fulfillment value.
     */
    static findMany<T = {}, R = T>(query?: Query<T>, options?: ModelFindManyOptions): Promise<Document<R>[]>;
    /**
     * Inserts one document into this model's collection. If `doc` is not
     * specified, random fields will be generated.
     *
     * @param doc - Document to be inserted. @see module:mongodb.Collection#insertOne
     * @param options - @see ModelInsertOneOptions
     *
     * @return The inserted document.
     *
     * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#insertOne}
     * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~insertWriteOpResult}
     */
    static insertOne<T>(doc?: DocumentFragment<T>, options?: ModelInsertOneOptions): Promise<null | Document<T>>;
    /**
     * Inserts multiple documents into this model's collection.
     *
     * @param docs - Array of documents to insert. @see module:mongodb.Collection#insertMany
     * @param options - @see module:mongodb.Collection#insertMany
     *
     * @return The inserted documents.
     *
     * @todo This method iterates through every document to apply the beforeInsert
     *       hook. Consider a more cost-efficient approach?
     *
     * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#insertMany}
     * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~insertWriteOpResult}
     */
    static insertMany<T = {}>(docs: DocumentFragment<T>[], options?: ModelInsertManyOptions): Promise<Document<T>[]>;
    /**
     * Updates one document matched by `query` with `update` object. Note that if
     * upserting, all *required* fields must be in the `query` param instead of
     * the `update` param.
     *
     * @param query - Query for the document to update.
     * @param update - Either an object whose key/value pair represent the fields
     *                 belonging to this model to update to, or an update query.
     * @param options - @see ModelUpdateOneOptions
     *
     * @return The updated doc if `returnDoc` is set to `true`, else `true` or
     *         `false` depending on whether or not the operation was successful.
     *
     * @see {@link https://docs.mongodb.com/manual/reference/operator/update-field/}
     * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#updateOne}
     * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndUpdate}
     * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~updateWriteOpResult}
     */
    static updateOne<T = {}>(query: Query<T>, update: DocumentFragment<T> | Update<T>, options?: ModelUpdateOneOptions): Promise<null | boolean | Document<T>>;
    /**
     * Updates multiple documents matched by `query` with `update` object.
     *
     * @param query - Query for document to update.
     * @param update - Either an object whose key/value pair represent the fields
     *                 belonging to this model to update to, or an update query.
     * @param options - @see ModelUpdateManyOptions
     *
     * @return The updated docs if `returnDocs` is set to `true`, else `true` or
     *         `false` depending on whether or not the operation was successful.
     *
     * @see {@link https://docs.mongodb.com/manual/reference/operator/update-field/}
     * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#updateMany}
     * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndUpdate}
     * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~updateWriteOpResult}
     */
    static updateMany<T = {}>(query: Query<T>, update: DocumentFragment<T> | Update<T>, options?: ModelUpdateManyOptions): Promise<Document<T>[] | boolean>;
    /**
     * Deletes one document matched by `query`.
     *
     * @param query - Query for document to delete.
     * @param options @see ModelDeleteOneOptions
     *
     * @return The deleted doc if `returnDoc` is set to `true`, else `true` or
     *         `false` depending on whether or not the operation was successful.
     *
     * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#deleteOne}
     * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndDelete}
     * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~deleteWriteOpResult}
     */
    static deleteOne<T = {}>(query: Query<T>, options?: ModelDeleteOneOptions): Promise<Document<T> | boolean | null>;
    /**
     * Deletes multiple documents matched by `query`.
     *
     * @param query - Query to match documents for deletion.
     * @param options - @see ModelDeleteManyOptions
     *
     * @return The deleted docs if `returnDocs` is set to `true`, else `true` or
     *         `false` depending on whether or not the operation was successful.
     *
     * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#deleteMany}
     * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndDelete}
     * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~deleteWriteOpResult}
     */
    static deleteMany<T = {}>(query: Query<T>, options?: ModelDeleteManyOptions): Promise<boolean | Document<T>[]>;
    /**
     * Replaces one document with another. If `replacement` is not specified,
     * one with random info will be generated.
     *
     * @param query - Query for document to replace.
     * @param replacement - The replacement document.
     * @param options - @see ModelReplaceOneOptions
     *
     * @return The replaced document (by default) or the new document (depending
     *         on the `returnOriginal` option) if available, `null` otherwise.
     *
     * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndReplace}
     * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~findAndModifyWriteOpResult}
     */
    static findAndReplaceOne<T = {}>(query: Query<T>, replacement?: DocumentFragment<T>, options?: ModelReplaceOneOptions): Promise<null | Document<T>>;
    /**
     * Counts the documents that match the provided query.
     *
     * @param query - Query used for the $match stage of the aggregation pipeline.
     *
     * @return The total number of documents found.
     */
    static count(query: Query, options?: ModelCountOptions): Promise<number>;
    /**
     * Returns a document whose values are formatted according to the format
     * function sdefined in the schema. If the field is marked as encrypted in the
     * schema, this process takes care of that too.
     *
     * @param doc - Document to format.
     *
     * @return The formatted document as the fulfillment value.
     */
    static formatDocument<T = {}>(doc: DocumentFragment<T>): Promise<DocumentFragment<T>>;
    /**
     * Validates a document for this collection. It checks for the following in
     * order:
     *   1. Each field is defined in the schema.
     *   2. Each field value conforms to the defined field specs.
     *   3. Unique indexes are enforced (only if `ignoreUniqueIndex` is enabled).
     *   4. No required fields are missing (only if `strict` is enabled).
     *
     * @param doc - The doc to validate.
     * @param options - @see ModelValidateDocumentOptions
     *
     * @return `true` will be fulfilled if all tests have passed.
     */
    static validateDocument<T = {}>(doc: DocumentFragment<T>, options?: ModelValidateDocumentOptions): Promise<boolean>;
    /**
     * Handler called before an attempt to insert document into the database. This
     * is a good place to apply any custom pre-processing to the document before
     * it is inserted into the document. This method must return the document to
     * be inserted.
     *
     * @param doc - The document to be inserted.
     * @param options - Additional options.
     *
     * @return The document to be inserted.
     */
    static willInsertDocument<T>(doc: DocumentFragment<T>): Promise<DocumentFragment<T>>;
    /**
     * Handler called after the document is successfully inserted.
     *
     * @param doc - The inserted document.
     */
    static didInsertDocument<T>(doc: Document<T>): Promise<void>;
    /**
     * Handler called before an attempted update operation. This method must
     * return the query and update descriptor for the update operation.
     *
     * @param query - The query for document(s) to update.
     * @param update - The update descriptor.
     *
     * @return A tuple of the query and the update descriptor.
     */
    static willUpdateDocument<T>(query: Query<T>, update: DocumentFragment<T> | Update<T>): Promise<[Query, DocumentFragment<T> | Update<T>]>;
    /**
     * Handler called after a document or a set of documents have been
     * successfully updated.
     *
     * @param prevDoc - The document before it is updated. This is only available
     *                  if `returnDoc` was enabled, and only for updateOne().
     * @param newDocs - The updated document(s). This is only available if
     *                  `returnDoc` or `returnDocs` was enabled.
     */
    static didUpdateDocument<T>(prevDoc?: Document<T>, newDocs?: Document<T> | Document<T>[]): Promise<void>;
    /**
     * Handler called before an attempt to delete a document.
     *
     * @param query - The query for the document to be deleted.
     *
     * @return The document to be deleted.
     */
    static willDeleteDocument<T>(query: Query<T>): Promise<Query<T>>;
    /**
     * Handler called after a document or a set of documents are successfully
     * deleted.
     *
     * @param docs - The deleted document(s) if available.
     */
    static didDeleteDocument<T>(docs?: Document<T> | Document<T>[]): Promise<void>;
    /**
     * Processes a document before it is inserted. This is also used during an
     * upsert operation.
     *
     * @param doc - The document to be inserted/upserted.
     * @param options - @see ModelBeforeInsertOptions
     *
     * @return Document to be inserted/upserted to the database.
     */
    private static beforeInsert;
    /**
     * Handler invoked right after a document insertion.
     *
     * @param doc - The inserted document.
     */
    private static afterInsert;
    /**
     * Handler invoked right before an update. This is NOT invoked on an
     * insertion.
     *
     * @param query - Query for document to update.
     * @param update - The update to apply.
     * @param options - @see ModelUpdateOneOptions, @see ModelUpdateManyOptions
     *
     * @return The modified update to apply.
     */
    private static beforeUpdate;
    /**
     * Handler invoked right after an update. This does not account for
     * insertions.
     *
     * @param oldDoc - The original document.
     * @param newDoc - The updated document.
     */
    private static afterUpdate;
    /**
     * Handler invoked right before a deletion.
     *
     * @param query - Query for document to delete.
     * @param options - @see ModelDeleteOneOptions, @see ModelDeleteManyOptions
     */
    private static beforeDelete;
    /**
     * Handler invoked right after a deletion.
     *
     * @param doc - The deleted doc, if available.
     *
     * @todo Cascade deletion only works for first-level foreign keys so far.
     */
    private static afterDelete;
    /**
     * Deletes documents from other collections that have a foreign key to this
     * collection, as specified in the schema.
     *
     * @param docId - The ID of the document in this collection in which other
     *                collections are pointing to.
     */
    private static cascadeDelete;
    /**
     * Prevent instantiation of this class or any of its sub-classes because this
     * is intended to be a static class.
     */
    constructor();
}
export default Model;
