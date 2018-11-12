/**
 * @file This is a static, abstract model that provides ORM for a single MongoDB
 *       collection. Every other model must inherit this class. It sets up the
 *       ground work for basic CRUD operations, event triggers, query
 *       validations, etc. All returned documents are native JSON objects.
 */

import is from '@sindresorhus/is';
import assert from 'assert';
import bcrypt from 'bcrypt';
import debug from 'debug';
import _ from 'lodash';
import { Collection, FilterQuery, ObjectID, UpdateQuery } from 'mongodb';
import { getCollection, getModel } from '..';
import { AggregationPipeline, Document, DocumentFragment, FieldSpecs, ModelCountOptions, ModelDeleteManyOptions, ModelDeleteOneOptions, ModelFindManyOptions, ModelFindOneOptions, ModelInsertManyOptions, ModelInsertOneOptions, ModelRandomFieldsOptions, ModelReplaceOneOptions, ModelUpdateManyOptions, ModelUpdateOneOptions, ModelValidateDocumentOptions, PipelineFactoryOptions, PipelineFactorySpecs, Query, Schema, typeIsUpdateQuery, typeIsValidObjectID, Update } from '../types';
import sanitizeDocument from '../utils/sanitizeDocument';
import sanitizeQuery from '../utils/sanitizeQuery';
import validateFieldValue from '../utils/validateFieldValue';
import Aggregation from './Aggregation';

const log = debug('mongodb-odm:model');

abstract class Model {
  /**
   * Schema of this model. This property must be overridden in the derived
   * class.
   */
  static schema: Schema;

  /**
   * Gets the MongoDB collection associated with this model.
   *
   * @returns The MongoDB collection.
   *
   * @see getCollection()
   *
   * @throws {Error} Model class has no static property `schema` defined.
   */
  static async getCollection(): Promise<Collection> {
    if (!this.schema) throw new Error('This model has no schema, you must define this static proerty in the derived class');

    return getCollection(this.schema.collection);
  }

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
   * @returns A collection of fields whose values are randomly generated.
   */
  static async randomFields<T = {}>(fixedFields: DocumentFragment<T> = {}, { includeOptionals = false }: ModelRandomFieldsOptions = {}): Promise<DocumentFragment<T>> {
    const o: DocumentFragment<T> = {};
    const fields: { [fieldName: string]: FieldSpecs } = this.schema.fields;

    for (const key in fields) {
      if (!fields.hasOwnProperty(key)) continue;

      // If key is already present in the fixed fields, omit.
      if (o.hasOwnProperty(key)) continue;

      const fieldSpecs: FieldSpecs = fields[key];

      // If `includeOptionals` is not set, skip all the optional fields.
      if (!includeOptionals && !fieldSpecs.required) continue;

      // Use provided random function if provided in the schema.
      if (fieldSpecs.random) o[key as keyof T] = fieldSpecs.random();
    }

    for (const key in fixedFields) {
      if (!fixedFields.hasOwnProperty(key)) continue;
      o[key as keyof T] = fixedFields[key as keyof T];
    }

    return o;
  }

  /**
   * Generates an aggregation pipeline specifically for the schema associated
   * with this schema.
   *
   * @param queryOrSpecs - This is either a query for the $match stage or specs
   *                       for the aggregation factory function.
   * @param options - @see PipelineFactoryOptions
   *
   * @returns Aggregation pipeline.
   *
   * @throws {Error} Model class has no static property `schema` defined.
   */
  static pipeline<T = {}>(queryOrSpecs?: Query<T> | PipelineFactorySpecs, options?: PipelineFactoryOptions): AggregationPipeline {
    if (!this.schema) throw new Error('This model has no schema, you must define this static proerty in the derived class');

    // Check if the argument conforms to aggregation factory specs.
    if (queryOrSpecs && Object.keys(queryOrSpecs).some(val => val.startsWith('$'))) {
      return Aggregation.pipelineFactory(this.schema, queryOrSpecs as PipelineFactorySpecs, options);
    }
    // Otherwise the argument is a query for the $match stage.
    else {
      return Aggregation.pipelineFactory(this.schema, { $match: queryOrSpecs as Query }, options);
    }
  }

  /**
   * Identifies the ObjectID of exactly one document matching the given query.
   * Error is thrown if the document cannot be identified.
   *
   * @param query - Query used for the $match stage of the aggregation pipeline.
   *
   * @returns The matching ObjectID.
   *
   * @throws {Error} No document is found with the given query.
   * @throws {Error} ID of the found document is not a valid ObjectID.
   */
  static async identifyOneStrict(query: Query): Promise<ObjectID> {
    const result = await this.findOne(query);

    if (is.nullOrUndefined(result)) throw new Error(`No results found while identifying this ${this.schema.model} using the query ${JSON.stringify(query, null, 0)}`);
    if (!ObjectID.isValid(result._id)) throw new Error(`ID of ${result} is not a valid ObjectID`);

    return result._id;
  }

  /**
   * Same as the strict identify one operation but this method swallows all
   * errors and returns `null` if document canot be identified.
   *
   * @param query - Query used for the $match stage of the aggregation pipeline.
   *
   * @returns The matching ObjectID.
   *
   * @see Model.identifyOneStrict
   */
  static async identifyOne(query: Query): Promise<null | ObjectID> {
    try {
      const o = await this.identifyOneStrict(query);
      return o;
    }
    catch (err) {
      return null;
    }
  }

  /**
   * Returns an array of document IDs that match the query.
   *
   * @param query - Query for this model.
   *
   * @returns Array of matching IDs.
   */
  static async identifyMany(query?: Query): Promise<ObjectID[]> {
    const collection = await this.getCollection();
    const res = await collection.aggregate([
      ...this.pipeline(query),
      {
        $group: {
          _id: null,
          ids: { $addToSet: '$_id' },
        },
      },
    ]).toArray();

    if (res.length === 0) return [];
    return res[0].ids || [];
  }

  /**
   * Finds one document from this collection using the aggregation framework. If
   * no query is specified, a random document will be fetched.
   *
   * @param query - Query used for the $match stage of the aggregation pipeline.
   * @param options - @see module:mongodb.Collection#aggregate
   *
   * @returns The matching document as the fulfillment value.
   *
   * @throws {Error} No document found.
   */
  static async findOneStrict<T = {}, R = T>(query?: Query<T>, options?: ModelFindOneOptions): Promise<Document<R>> {
    if (is.nullOrUndefined(query)) {
      const collection = await this.getCollection();
      const results = await collection.aggregate(this.pipeline(query).concat([{ $sample: { size: 1 } }])).toArray();

      if (results.length !== 1) throw new Error('More or less than 1 random document found even though only 1 was supposed to be found.');

      return results[0];
    }
    else {
      const results = await this.findMany<T, R>(query, options);

      if (results.length === 0) throw new Error('No document found with provided query');

      return results[0];
    }
  }

  /**
   * Same as the strict find one operation but this method swallows all errors
   * and returns `null` when no document is found.
   *
   * @param query - Query used for the $match stage of the aggregation pipeline.
   * @param options - @see module:mongodb.Collection#aggregate
   *
   * @returns The matching document as the fulfillment value.
   *
   * @see Model.findOneStrict
   */
  static async findOne<T = {}, R = T>(query?: Query<T>, options?: ModelFindOneOptions): Promise<null | Document<R>> {
    try {
      const o = await this.findOneStrict<T, R>(query, options);
      return o;
    }
    catch (err) {
      return null;
    }
  }

  /**
   * Finds multiple documents of this collection using the aggregation
   * framework. If no query is specified, all documents are fetched.
   *
   * @param query - Query used for the $match stage of the aggregation pipeline.
   * @param options - @see module:mongodb.Collection#aggregate
   *
   * @returns The matching documents as the fulfillment value.
   */
  static async findMany<T = {}, R = T>(query?: Query<T>, options?: ModelFindManyOptions): Promise<Document<R>[]> {
    const collection = await this.getCollection();
    const results = await collection.aggregate(this.pipeline(query), options).toArray();
    return results;
  }

  /**
   * Inserts one document into this model's collection. If `doc` is not
   * specified, random fields will be generated.
   *
   * @param doc - Document to be inserted. @see module:mongodb.Collection#insertOne
   * @param options - @see ModelInsertOneOptions
   *
   * @returns The inserted document.
   *
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#insertOne}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~insertWriteOpResult}
   *
   * @throws {Error} This method is called even though insertions are disabled
   *                 in the schema.
   * @throws {MongoError} collection#insertOne failed.
   */
  static async insertOneStrict<T>(doc?: DocumentFragment<T>, options?: ModelInsertOneOptions): Promise<Document<T>> {
    if (this.schema.noInserts === true) throw new Error('Insertions are disallowed for this model');

    // Apply before insert handler.
    const t = await this.beforeInsert<T>(doc || (await this.randomFields<T>()), { strict: true, ...options });

    log(`${this.schema.model}.insertOne:`, JSON.stringify(t, null, 0));

    const collection = await this.getCollection();
    const results = await collection.insertOne(t, options).catch(error => { throw error; });

    log(`${this.schema.model}.insertOne results:`, JSON.stringify(results, null, 0));

    assert(results.result.ok === 1);
    assert(results.ops.length <= 1, new Error('Somehow insertOne() op inserted more than 1 document'));

    if (results.ops.length < 1) throw new Error('Unable to insert document');

    const o = results.ops[0];

    // Apply after insert handler.
    await this.afterInsert<T>(o);

    return o;
  }

  /**
   * Same as the strict insert one operation except this method swallows all
   * errors and returns null if the document cannot be inserted.
   *
   * @param doc - Document to be inserted. @see module:mongodb.Collection#insertOne
   * @param options - @see ModelInsertOneOptions
   *
   * @returns The inserted document.
   *
   * @see Model.insertOneStrict
   */
  static async insertOne<T>(doc?: DocumentFragment<T>, options?: ModelInsertOneOptions): Promise<null | Document<T>> {
    try {
      const o = await this.insertOneStrict<T>(doc, options);
      return o;
    }
    catch (err) {
      return null;
    }
  }

  /**
   * Inserts multiple documents into this model's collection.
   *
   * @param docs - Array of documents to insert. @see module:mongodb.Collection#insertMany
   * @param options - @see module:mongodb.Collection#insertMany
   *
   * @returns The inserted documents.
   *
   * @todo This method iterates through every document to apply the beforeInsert
   *       hook. Consider a more cost-efficient approach?
   *
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#insertMany}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~insertWriteOpResult}
   *
   * @throws {Error} This method is called even though insertions or multiple
   *                 insertions are disabled in the schema.
   */
  static async insertMany<T = {}>(docs: DocumentFragment<T>[], options: ModelInsertManyOptions = {}): Promise<Document<T>[]> {
    if ((this.schema.noInserts === true) || (this.schema.noInsertMany === true)) throw new Error('Multiple insertions are disallowed for this model');

    const n = docs.length;
    const t: typeof docs = new Array(n);

    // Apply before insert handler to each document.
    for (let i = 0; i < n; i++) {
      t[i] = await this.beforeInsert<T>(docs[i]);
    }

    log(`${this.schema.model}.insertMany:`, JSON.stringify(t, null, 0));

    const collection = await this.getCollection();
    const results = await collection.insertMany(t, options);

    log(`${this.schema.model}.insertMany results:`, JSON.stringify(results, null, 0));

    assert(results.result.ok === 1);

    const o = results.ops as Document<T>[];
    const m = o.length;

    for (let i = 0; i < m; i++) {
      await this.afterInsert<T>(o[i]);
    }

    return o;
  }

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
   * @returns The updated doc if `returnDoc` is set to `true`, else there is no
   *          fulfillment value.
   *
   * @see {@link https://docs.mongodb.com/manual/reference/operator/update-field/}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#updateOne}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndUpdate}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~updateWriteOpResult}
   *
   * @throws {Error} This method is called even though updates are disabled in
   *                 the schema.
   * @throws {Error} Query is invalid probably because it is not santized due to
   *                 hooks being skipped.
   * @throws {Error} A doc is updated but it cannot be found.
   */
  static async updateOneStrict<T = {}>(query: Query<T>, update: Update<T>, options: ModelUpdateOneOptions = {}): Promise<void | Document<T>> {
    if (this.schema.noUpdates === true) throw new Error('Updates are disallowed for this model');

    const collection = await this.getCollection();
    const [q, u] = (options.skipHooks === true) ? [query, update] : await this.beforeUpdate<T>(query, update, options);

    log(`${this.schema.model}.updateOne:`, JSON.stringify(q, null, 0), JSON.stringify(u, null, 0), JSON.stringify(options, null, 0));

    if (options.returnDoc === true) {
      if (!is.plainObject(q)) {
        throw new Error('Invalid query, maybe it is not sanitized? This could happen if you enabled skipHooks in the options, in which case you will need to sanitize the query yourself');
      }

      // Need to keep the original doc for the didUpdateDocument() hook.
      const res = await collection.findOneAndUpdate(q as { [key: string]: any }, u, { ...options, returnOriginal: true });

      log(`${this.schema.model}.updateOne results:`, JSON.stringify(res, null, 0), JSON.stringify(options, null, 0));

      assert(res.ok === 1, new Error('Update failed'));

      let oldDoc;
      let newDoc;

      // Handle upserts properly.
      if (is.nullOrUndefined(res.lastErrorObject.upserted)) {
        oldDoc = res.value;

        if (is.nullOrUndefined(oldDoc)) throw new Error('Unable to return the old document before the update');

        newDoc = await this.findOne<T>(oldDoc._id);
      }
      else {
        newDoc = await this.findOne<T>(res.lastErrorObject.upserted);
      }

      if (is.nullOrUndefined(newDoc)) {
        throw new Error('Unable to find the updated doc');
      }

      if (options.skipHooks !== true) {
        await this.afterUpdate<T>(oldDoc, newDoc);
      }

      return newDoc;
    }
    else {
      if (!is.plainObject(q)) {
        throw new Error('Invalid query, maybe it is not sanitized? This could happen if you enabled skipHooks in the options, in which case you will need to sanitize the query yourself');
      }

      const res = await collection.updateOne(q as { [key: string]: any }, u, options);

      log(`${this.schema.model}.updateOne results:`, JSON.stringify(res, null, 0));

      assert(res.result.ok === 1);

      if (res.result.n <= 0) throw new Error('Unable to update the document');

      if (options.skipHooks !== true) {
        await this.afterUpdate<T>();
      }
    }
  }

  /**
   * Same as the strict update one operation except this method swallows all
   * errors and returns `null` if no document was updated (and that `returnDoc`
   * is `true`) or `true`/`false` (if `returnDoc` is `false`).
   *
   * @param query - Query for the document to update.
   * @param update - Either an object whose key/value pair represent the fields
   *                 belonging to this model to update to, or an update query.
   * @param options - @see ModelUpdateOneOptions
   *
   * @returns The updated doc if `returnDoc` is set to `true`, else either
   *          `true` or `false` depending on whether the operation was
   *          successful.
   *
   * @see Model.updateOneStrict
   */
  static async updateOne<T = {}>(query: Query<T>, update: Update<T>, options: ModelUpdateOneOptions = {}): Promise<boolean | null | Document<T>> {
    try {
      const o = await this.updateOneStrict<T>(query, update, options);

      if (o && options.returnDoc) return o;

      return true;
    }
    catch (err) {
      return options.returnDoc ? null : false;
    }
  }

  /**
   * Updates multiple documents matched by `query` with `update` object.
   *
   * @param query - Query for document to update.
   * @param update - Either an object whose key/value pair represent the fields
   *                 belonging to this model to update to, or an update query.
   * @param options - @see ModelUpdateManyOptions
   *
   * @returns The updated docs if `returnDocs` is set to `true`, else `true` or
   *         `false` depending on whether or not the operation was successful.
   *
   * @see {@link https://docs.mongodb.com/manual/reference/operator/update-field/}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#updateMany}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndUpdate}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~updateWriteOpResult}
   *
   * @throws {Error} This method is called even though updates or multiple
   *                 updates are disabled in the schema.
   * @throws {Error} One of the updated docs are not returned.
   */
  static async updateMany<T = {}>(query: Query<T>, update: Update<T>, options: ModelUpdateManyOptions = {}): Promise<Document<T>[] | boolean> {
    if ((this.schema.noUpdates === true) || (this.schema.noUpdateMany === true)) throw new Error('Multiple updates are disallowed for this model');

    const [q, u] = await this.beforeUpdate<T>(query, update, options);
    const collection = await this.getCollection();

    log(`${this.schema.model}.updateMany:`, JSON.stringify(q, null, 0), JSON.stringify(u, null, 0), JSON.stringify(options, null, 0));

    if (options.returnDocs === true) {
      const docs = await this.findMany<T>(q);
      const n = docs.length;
      const results: Document<T>[] = [];

      if ((n <= 0) && (options.upsert === true)) {
        const res = await this.updateOne<T>(q, u, { ...options, returnDoc: true, skipHooks: true });

        if (is.boolean(res) || is.nullOrUndefined(res)) {
          throw new Error('Error upserting document during an updateMany operation');
        }

        results.push(res);
      }
      else {
        for (let i = 0; i < n; i++) {
          const doc = docs[i];
          const result = await collection.findOneAndUpdate({ _id: doc._id }, u, { returnOriginal: false, ...options });

          assert(result.ok === 1);
          assert(result.value);

          results.push(result.value);
        }

        log(`${this.schema.model}.updateMany results:`, JSON.stringify(results, null, 0));
      }

      await this.afterUpdate<T>(undefined, results);

      return results;
    }
    else {
      const results = await collection.updateMany(q, u, options);

      log(`${this.schema.model}.updateMany results:`, JSON.stringify(results, null, 0));

      assert(results.result.ok === 1);

      if (results.result.n <= 0) return false;

      await this.afterUpdate<T>();

      return true;
    }
  }

  /**
   * Deletes one document matched by `query`.
   *
   * @param query - Query for document to delete.
   * @param options @see ModelDeleteOneOptions
   *
   * @returns The deleted doc if `returnDoc` is set to `true`.
   *
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#deleteOne}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndDelete}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~deleteWriteOpResult}
   *
   * @throws {Error} This method is called even though deletions are disabled in
   *                 the schema.
   * @throws {Error} Unable to return the deleted document when `returnDoc` is
   *                 `true`.
   * @throws {Error} Unable to delete document.
   */
  static async deleteOneStrict<T = {}>(query: Query<T>, options: ModelDeleteOneOptions = {}): Promise<Document<T> | void> {
    if (this.schema.noDeletes === true) throw new Error('Deletions are disallowed for this model');

    const q = await this.beforeDelete<T>(query, options);

    log(`${this.schema.model}.deleteOne:`, JSON.stringify(query, null, 0));

    const collection = await this.getCollection();

    if (options.returnDoc === true) {
      const results = await collection.findOneAndDelete(q);

      log(`${this.schema.model}.deleteOne results:`, JSON.stringify(results, null, 0));

      assert(results.ok === 1);

      if (!results.value) throw new Error('Unable to return deleted document');

      await this.afterDelete<T>(results.value);

      return results.value;
    }
    else {
      const results = await collection.deleteOne(q, options);

      log(`${this.schema.model}.deleteOne results:`, JSON.stringify(results, null, 0));

      assert(results.result.ok === 1, new Error('Unable to delete document'));

      if (!is.number(results.result.n) || (results.result.n <= 0)) throw new Error('Unable to delete document');

      await this.afterDelete<T>();
    }
  }

  /**
   * Same as the strict delete one operation except this method swallows all
   * errors.
   *
   * @param query - Query for document to delete.
   * @param options @see ModelDeleteOneOptions
   *
   * @returns The deleted doc if `returnDoc` is set to `true`, else `true` or
   *         `false` depending on whether or not the operation was successful.
   *
   * @see Model.deleteOneStrict
   */
  static async deleteOne<T = {}>(query: Query<T>, options: ModelDeleteOneOptions = {}): Promise<Document<T> | null | boolean> {
    try {
      const o = await this.deleteOneStrict<T>(query, options);

      if (options.returnDoc && o) {
        return o;
      }
      else {
        return true;
      }
    }
    catch (err) {
      return options.returnDoc ? null : false;
    }
  }

  /**
   * Deletes multiple documents matched by `query`.
   *
   * @param query - Query to match documents for deletion.
   * @param options - @see ModelDeleteManyOptions
   *
   * @returns The deleted docs if `returnDocs` is set to `true`, else `true` or
   *         `false` depending on whether or not the operation was successful.
   *
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#deleteMany}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndDelete}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~deleteWriteOpResult}
   *
   * @throws {Error} This method is called even though deletions or multiple
   *                 deletions are disabled in the schema.
   */
  static async deleteMany<T = {}>(query: Query<T>, options: ModelDeleteManyOptions = {}): Promise<boolean | Document<T>[]> {
    if ((this.schema.noDeletes === true) || (this.schema.noDeleteMany === true)) throw new Error('Multiple deletions are disallowed for this model');

    const q = await this.beforeDelete(query, options);

    log(`${this.schema.model}.deleteMany:`, JSON.stringify(q, null, 0));

    const collection = await this.getCollection();

    if (options.returnDocs === true) {
      const docs = await this.findMany<T>(q);
      const n = docs.length;
      const results: Document<T>[] = [];

      for (let i = 0; i < n; i++) {
        const doc = docs[i];
        const result = await collection.findOneAndDelete({ _id: doc._id });

        assert(result.ok === 1);

        if (result.value) {
          results.push(result.value);
        }
      }

      log(`${this.schema.model}.deleteMany results:`, JSON.stringify(results, null, 0));

      const m = results.length;

      await this.afterDelete<T>(results);

      return results;
    }
    else {
      const results = await collection.deleteMany(q, { ...options });

      log(`${this.schema.model}.deleteMany results:`, JSON.stringify(results, null, 0));

      assert(results.result.ok === 1);

      if (!is.number(results.result.n) || (results.result.n <= 0)) return false;

      await this.afterDelete();

      return true;
    }
  }

  /**
   * Replaces one document with another. If `replacement` is not specified,
   * one with random info will be generated.
   *
   * @param query - Query for document to replace.
   * @param replacement - The replacement document.
   * @param options - @see ModelReplaceOneOptions
   *
   * @returns The replaced document (by default) or the new document (depending
   *         on the `returnOriginal` option).
   *
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndReplace}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~findAndModifyWriteOpResult}
   *
   * @throws {Error} The old document cannot be returned.
   * @throws {Error} The doc is replaced but it cannot be fetched.
   */
  static async findAndReplaceOneStrict<T = {}>(query: Query<T>, replacement?: DocumentFragment<T>, options: ModelReplaceOneOptions = {}): Promise<Document<T>> {
    const q = await this.beforeDelete<T>(query, options);
    const r = await this.beforeInsert<T>(replacement || (await this.randomFields<T>()), options);

    log(`${this.schema.model}.replaceOne:`, JSON.stringify(q, null, 0), JSON.stringify(r, null, 0));

    const collection = await this.getCollection();
    const results = await collection.findOneAndReplace(q, r, { ...options, returnOriginal: true });

    log(`${this.schema.model}.replaceOne results:`, JSON.stringify(results, null, 0));

    assert(results.ok === 1);

    const oldDoc = results.value;

    if (is.nullOrUndefined(oldDoc)) throw new Error('Unable to return the old document');

    const newDoc = await this.findOne<T>(r);

    if (is.null_(newDoc)) {
      throw new Error('Document is replaced but unable to find the new document in the database');
    }

    await this.afterDelete<T>(results.value);
    await this.afterInsert<T>(newDoc);

    return (options.returnOriginal === true) ? oldDoc : newDoc;
  }

  /**
   * Same as the strict find and replace one operation except this method
   * swallows all errors.
   *
   * @param query - Query for document to replace.
   * @param replacement - The replacement document.
   * @param options - @see ModelReplaceOneOptions
   *
   * @returns The replaced document (by default) or the new document (depending
   *          on the `returnOriginal` option) if available, `null` otherwise.
   *
   * @see Model.findAndReplaceOneStrict
   */
  static async findAndReplaceOne<T = {}>(query: Query<T>, replacement?: DocumentFragment<T>, options: ModelReplaceOneOptions = {}): Promise<null | Document<T>> {
    try {
      const o = await this.findAndReplaceOneStrict<T>(query, replacement, options);
      return o;
    }
    catch (err) {
      return null;
    }
  }

  /**
   * Checks if a document exists.
   *
   * @param query - Query for document to check.
   *
   * @returns `true` if document exists, `false` otherwise.
   */
  static async exists(query: Query): Promise<boolean> {
    const id = await this.identifyOne(query);

    return id ? true : false;
  }

  /**
   * Counts the documents that match the provided query.
   *
   * @param query - Query used for the $match stage of the aggregation pipeline.
   *
   * @returns The total number of documents found. The minimum is 0.
   */
  static async count(query: Query, options: ModelCountOptions = {}): Promise<number> {
    const results = await this.findMany(query, options);

    return results.length;
  }

  /**
   * Returns a document whose values are formatted according to the format
   * function sdefined in the schema. If the field is marked as encrypted in the
   * schema, this process takes care of that too.
   *
   * @param doc - Document to format.
   *
   * @returns The formatted document as the fulfillment value.
   */
  static async formatDocument<T = {}>(doc: DocumentFragment<T>): Promise<DocumentFragment<T>> {
    const formattedDoc = _.cloneDeep(doc);
    const fields: { [fieldName: string]: FieldSpecs } = this.schema.fields;

    for (const key in this.schema.fields) {
      if (!formattedDoc.hasOwnProperty(key)) continue;

      const fieldSpecs = fields[key];

      assert(fieldSpecs, new Error(`Field ${key} not found in schema`));

      // If the schema has a certain formatting function defined for this field,
      // apply it.
      if (is.function_(fieldSpecs.format)) {
        const formattedValue = await fieldSpecs.format(formattedDoc[key as keyof T]);
        formattedDoc[key as keyof T] = formattedValue;
      }

      // If the schema indicates that this field is encrypted, encrypt it.
      if (fieldSpecs.encrypted === true) {
        formattedDoc[key as keyof T] = await bcrypt.hash(`${formattedDoc[key as keyof T]}`, 10);
      }
    }

    return formattedDoc;
  }

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
   * @returns `true` will be fulfilled if all tests have passed.
   *
   * @throws {Error} Document is not an object.
   * @throws {Error} Document is empty.
   * @throws {Error} One of the fields in the document is not defined in the
   *                 schema.
   * @throws {Error} One of the fields in the document does not pass the
   *                 validation test.
   * @throws {Error} One of the fields has a duplicated value as another
   *                 document in the collection (only if unique indexes are
   *                 defined in the schema).
   * @throws {Error} Some required fields in the document are missing.
   */
  static async validateDocument<T = {}>(doc: DocumentFragment<T>, options: ModelValidateDocumentOptions = {}): Promise<boolean> {
    if (!is.plainObject(doc)) throw new Error('Invalid document provided');
    if (is.emptyObject(doc)) throw new Error('Empty objects are not permitted');

    const fields: { [fieldName: string]: FieldSpecs } = this.schema.fields;

    for (const key in doc) {
      // Skip validation for fields `_id`, `updatedAt` and `createdAt` since
      // they are automatically generated.
      if (key === '_id') continue;
      if (this.schema.timestamps && (key === 'updatedAt')) continue;
      if (this.schema.timestamps && (key === 'createdAt')) continue;

      const val = doc[key as keyof T];

      // #1 Check if field is defined in the schema.
      if (!this.schema.fields.hasOwnProperty(key)) {
        throw new Error(`The field '${key}' is not defined in the schema`);
      }

      // #2 Check if field value conforms to its defined specs.
      const fieldSpecs = fields[key];

      validateFieldValue(val, fieldSpecs);
    }

    // #3 Check for unique fields only if `ignoreUniqueIndex` is not `true`.
    if ((options.ignoreUniqueIndex !== true) && this.schema.indexes) {
      const n = this.schema.indexes.length;

      for (let i = 0; i < n; i++) {
        const index = this.schema.indexes[i];

        if (!index.options) continue;
        if (!index.options.unique) continue;
        if (!index.spec) continue;
        if (!Object.keys(index.spec).every(v => Object.keys(doc).indexOf(v) > -1)) continue;

        const uniqueQuery = _.pick(doc, Object.keys(index.spec));

        if (await this.findOne(uniqueQuery)) throw new Error(`Another document already exists with ${JSON.stringify(uniqueQuery, null, 0)}`);
      }
    }

    // #4 Check for required fields if `strict` is `true`.
    if (options.strict === true) {
      for (const key in this.schema.fields) {
        if (!this.schema.fields.hasOwnProperty(key)) continue;

        const field = fields[key];

        if (!field.required || field.default) continue;
        if (!doc.hasOwnProperty(key)) throw new Error(`Missing required field '${key}'`);
      }
    }

    return true;
  }

  /**
   * Handler called before an attempt to insert document into the database. This
   * is a good place to apply any custom pre-processing to the document before
   * it is inserted into the document. This method must return the document to
   * be inserted.
   *
   * @param doc - The document to be inserted.
   * @param options - Additional options.
   *
   * @returns The document to be inserted.
   */
  static async willInsertDocument<T>(doc: DocumentFragment<T>): Promise<DocumentFragment<T>> {
    return doc;
  }

  /**
   * Handler called after the document is successfully inserted.
   *
   * @param doc - The inserted document.
   */
  static async didInsertDocument<T>(doc: Document<T>): Promise<void> {}

  /**
   * Handler called before an attempted update operation. This method must
   * return the query and update descriptor for the update operation.
   *
   * @param query - The query for document(s) to update.
   * @param update - The update descriptor.
   *
   * @returns A tuple of the query and the update descriptor.
   */
  static async willUpdateDocument<T>(query: Query<T>, update: Update<T>): Promise<[Query, Update<T>]> {
    return [query, update];
  }

  /**
   * Handler called after a document or a set of documents have been
   * successfully updated.
   *
   * @param prevDoc - The document before it is updated. This is only available
   *                  if `returnDoc` was enabled, and only for updateOne().
   * @param newDocs - The updated document(s). This is only available if
   *                  `returnDoc` or `returnDocs` was enabled.
   */
  static async didUpdateDocument<T>(prevDoc?: Document<T>, newDocs?: Document<T> | Document<T>[]): Promise<void> {}

  /**
   * Handler called before an attempt to delete a document.
   *
   * @param query - The query for the document to be deleted.
   *
   * @returns The document to be deleted.
   */
  static async willDeleteDocument<T>(query: Query<T>): Promise<Query<T>> {
    return query;
  }

  /**
   * Handler called after a document or a set of documents are successfully
   * deleted.
   *
   * @param docs - The deleted document(s) if available.
   */
  static async didDeleteDocument<T>(docs?: Document<T> | Document<T>[]): Promise<void> {}

  /**
   * Processes a document before it is inserted. This is also used during an
   * upsert operation.
   *
   * @param doc - The document to be inserted/upserted.
   * @param options - @see ModelBeforeInsertOptions
   *
   * @returns Document to be inserted/upserted to the database.
   */
  private static async beforeInsert<T>(doc: DocumentFragment<T>, options: ModelInsertOneOptions | ModelInsertManyOptions = {}): Promise<DocumentFragment<T>> {
    const fields: { [fieldName: string]: FieldSpecs } = this.schema.fields;

    // Call event hook first.
    const d = await this.willInsertDocument<T>(doc);

    let o = sanitizeDocument<T>(this.schema, d);

    // Unless specified, always renew the `createdAt` and `updatedAt` fields.
    if ((this.schema.timestamps === true) && (options.ignoreTimestamps !== true)) {
      if (!is.date(o.createdAt)) o.createdAt = new Date();
      if (!is.date(o.updatedAt)) o.updatedAt = new Date();
    }

    // Before inserting this document, go through each field and make sure that
    // it has default values and that they are formatted correctly.
    for (const key in this.schema.fields) {
      if (!this.schema.fields.hasOwnProperty(key)) continue;
      if (o.hasOwnProperty(key)) continue;

      const fieldSpecs = fields[key];

      // Check if the field has a default value defined in the schema. If so,
      // apply it.
      if (is.undefined(fieldSpecs.default)) continue;

      o[key as keyof T] = (is.function_(fieldSpecs.default)) ? fieldSpecs.default() : fieldSpecs.default;
    }

    // Apply format function defined in the schema if applicable.
    o = await this.formatDocument<T>(o);

    // Finally, validate the document as a final sanity check.
    await this.validateDocument<T>(o, { ignoreUniqueIndex: true, strict: true, ...options });

    return o;
  }

  /**
   * Handler invoked right after a document insertion.
   *
   * @param doc - The inserted document.
   */
  private static async afterInsert<R>(doc: Document<R>): Promise<void> {
    await this.didInsertDocument<R>(doc);
  }

  /**
   * Handler invoked right before an update. This is NOT invoked on an
   * insertion.
   *
   * @param query - Query for document to update.
   * @param update - The update to apply.
   * @param options - @see ModelUpdateOneOptions, @see ModelUpdateManyOptions
   *
   * @returns The modified update to apply.
   *
   * @throws {Error} Attempting to upsert even though upserts are disabled in
   *                 the schema.
   */
  private static async beforeUpdate<T>(query: Query<T>, update: Update<T>, options: ModelUpdateOneOptions | ModelUpdateManyOptions = {}): Promise<[DocumentFragment<T>, UpdateQuery<DocumentFragment<T>>]> {
    if ((options.upsert === true) && (this.schema.allowUpserts !== true)) throw new Error('Attempting to upsert a document while upserting is disallowed in the schema');

    const [q, u] = await this.willUpdateDocument<T>(query, update);

    // First sanitize the inputs. We want to be able to make sure the query is
    // valid and that the update object is a proper update query.
    const sanitizedQuery = sanitizeQuery<T>(this.schema, q) as DocumentFragment<T>;
    const sanitizedUpdate: UpdateQuery<DocumentFragment<T>> = typeIsUpdateQuery<T>(u) ? { ...u } : { $set: u };

    // Sanitize all update queries. Remap `null` values to `$unset`.
    if (sanitizedUpdate.$set) {
      const obj = sanitizedUpdate.$set;
      const nulls = Object.keys(obj).filter(v => (obj[v] === null));
      const n = nulls.length;

      sanitizedUpdate.$set = sanitizeDocument<T>(this.schema, sanitizedUpdate.$set);

      if (n > 0) {
        sanitizedUpdate.$unset = {};

        for (let i = 0; i < n; i++) {
          sanitizedUpdate.$unset[nulls[i]] = '';
        }
      }
    }

    if (sanitizedUpdate.$setOnInsert) sanitizedUpdate.$setOnInsert = sanitizeDocument<T>(this.schema, sanitizedUpdate.$setOnInsert);
    if (sanitizedUpdate.$addToSet) sanitizedUpdate.$addToSet = sanitizeDocument<T>(this.schema, sanitizedUpdate.$addToSet);
    if (sanitizedUpdate.$push) sanitizedUpdate.$push = sanitizeDocument<T>(this.schema, sanitizedUpdate.$push);

    // Add updated timestamps if applicable.
    if ((this.schema.timestamps === true) && (options.ignoreTimestamps !== true)) {
      if (!sanitizedUpdate.$set) sanitizedUpdate.$set = {};
      if (!is.date(sanitizedUpdate.$set.updatedAt)) sanitizedUpdate.$set.updatedAt = new Date();
    }

    // Format all fields in the update query.
    if (sanitizedUpdate.$set) {
      sanitizedUpdate.$set = await this.formatDocument<T>(sanitizedUpdate.$set as Document<T>);
    }

    // In the case of an upsert, we need to preprocess the query as if this was
    // an insertion. We also need to tell the database to save all fields in the
    // query to the database as well, unless they are already in the update
    // query.
    if (options.upsert === true) {
      // Make a copy of the query in case it is manipulated by the hooks.
      const beforeInsert = await this.beforeInsert<T>(_.cloneDeep(sanitizedQuery), { ...options, strict: false });
      const setOnInsert = _.omit({
        ...sanitizedUpdate.$setOnInsert || {},
        ...beforeInsert as object,
      }, [
        ...Object.keys(sanitizedUpdate.$set || {}),
        ...Object.keys(sanitizedUpdate.$unset || {}),
      ]);

      if (!is.emptyObject(setOnInsert)) {
        sanitizedUpdate.$setOnInsert = setOnInsert;
      }
    }

    // Validate all fields in the update query.
    if (sanitizedUpdate.$set && !is.emptyObject(sanitizedUpdate.$set)) {
      await this.validateDocument<T>(sanitizedUpdate.$set as DocumentFragment<T>, { ignoreUniqueIndex: true, ...options });
    }

    // Strip empty objects.
    const { $set, $setOnInsert, $addToSet, $push, ...rest } = sanitizedUpdate;
    const finalizedUpdate = {
      ...rest,
      ...(is.nullOrUndefined($set) || is.emptyObject($set)) ? {} : { $set },
      ...(is.nullOrUndefined($setOnInsert) || is.emptyObject($setOnInsert)) ? {} : { $setOnInsert },
      ...(is.nullOrUndefined($addToSet) || is.emptyObject($addToSet)) ? {} : { $addToSet },
      ...(is.nullOrUndefined($push) || is.emptyObject($push)) ? {} : { $push },
    };

    return [sanitizedQuery, finalizedUpdate];
  }

  /**
   * Handler invoked right after an update. This does not account for
   * insertions.
   *
   * @param oldDoc - The original document.
   * @param newDoc - The updated document.
   */
  private static async afterUpdate<T>(oldDoc?: Document<T>, newDocs?: Document<T> | Document<T>[]) {
    await this.didUpdateDocument<T>(oldDoc, newDocs);
  }

  /**
   * Handler invoked right before a deletion.
   *
   * @param query - Query for document to delete.
   * @param options - @see ModelDeleteOneOptions, @see ModelDeleteManyOptions
   */
  private static async beforeDelete<T>(query: Query<T>, options: ModelDeleteOneOptions | ModelDeleteManyOptions): Promise<FilterQuery<T>> {
    const q = await this.willDeleteDocument<T>(query);

    return sanitizeQuery<T>(this.schema, q);
  }

  /**
   * Handler invoked right after a deletion.
   *
   * @param doc - The deleted doc, if available.
   *
   * @todo Cascade deletion only works for first-level foreign keys so far.
   */
  private static async afterDelete<T>(docs?: Document<T> | Document<T>[]) {
    if (is.array(docs)) {
      for (const doc of docs) {
        if (!typeIsValidObjectID(doc._id)) continue;
        await this.cascadeDelete(doc._id);
      }
    }
    else if (!is.nullOrUndefined(docs) && typeIsValidObjectID(docs._id)) {
      await this.cascadeDelete(docs._id);
    }

    await this.didDeleteDocument(docs);
  }

  /**
   * Deletes documents from other collections that have a foreign key to this
   * collection, as specified in the schema.
   *
   * @param docId - The ID of the document in this collection in which other
   *                collections are pointing to.
   *
   * @throws {Error} Cascade deletion is incorrectly defined in the schema.
   */
  private static async cascadeDelete(docId: ObjectID) {
    const cascadeModelNames = this.schema.cascade;

    if (is.nullOrUndefined(cascadeModelNames)) return;

    if (!is.array(cascadeModelNames)) throw new Error('Invalid definition of cascade in schema');

    for (const modelName of cascadeModelNames) {
      const ModelClass = getModel(modelName);
      const fields: { [fieldName: string]: FieldSpecs } = ModelClass.schema.fields;

      assert(ModelClass, `Trying to cascade delete from model ${modelName} but model is not found`);

      for (const key in ModelClass.schema.fields) {
        if (!ModelClass.schema.fields.hasOwnProperty(key)) continue;

        const field = fields[key];

        if (field.ref === this.schema.model) {
          log(`Cascade deleting all ${modelName} documents whose "${key}" field is ${docId}`);

          await ModelClass.deleteMany({ [`${key}`]: docId });
        }
      }
    }
  }

  /**
   * Prevent instantiation of this class or any of its sub-classes because this
   * is intended to be a static class.
   *
   * @throws {Error} Attempting to instantiate this model even though it is
   *                 meant to be a static class.
   */
  constructor() {
    throw new Error('This is a static class and is prohibited from instantiated');
  }
}

export default Model;
