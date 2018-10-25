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
import { Collection, CollectionAggregationOptions, CollectionInsertManyOptions, CollectionInsertOneOptions, CommonOptions, FindOneAndReplaceOption, ObjectID, ReplaceOneOptions } from 'mongodb';
import { getCollection, getModel } from '..';
import { Document, FieldSpecs, Query, Schema, typeIsUpdate, Update } from '../types';
import sanitizeDocument from '../utils/sanitizeDocument';
import sanitizeQuery from '../utils/sanitizeQuery';
import validateFieldValue from '../utils/validateFieldValue';
import Aggregation, { AggregationPipeline, PipelineFactoryOptions, PipelineFactorySpecs } from './Aggregation';

const log = debug('mongodb-odm:model');

/**
 * Options for Model.randomFields.
 */
interface ModelRandomFieldsOptions {
  /**
   * Specifies whether optional fields will be generated as well.
   */
  includeOptionals?: boolean;
}

/**
 * Options for Model.validateDocument.
 */
interface ModelValidateDocumentOptions {
  /**
   * Tells the validation process to account for required fields. That is, if
   * this is `true` and some required fields are missing in the document to be
   * validated, validation fails.
   */
  strict?: boolean;

  /**
   * Tells the validation process to account for unique indexes. That is, if
   * this is `false` and one or more field values are not unique when it
   * supposedly has a unique index, validation fails.
   */
  ignoreUniqueIndex?: boolean;
}

interface ModelFindOneOptions extends CollectionAggregationOptions {}

interface ModelFindManyOptions extends CollectionAggregationOptions {}

interface ModelInsertOneOptions extends ModelValidateDocumentOptions, CollectionInsertOneOptions {
  /**
   * Specifies whether timestamp fields (i.e. `createdAt` and `updatedAt`) are
   * automatically generated before insertion.
   */
  ignoreTimestamps?: boolean;
}

interface ModelInsertManyOptions extends ModelValidateDocumentOptions, CollectionInsertManyOptions {
  /**
   * Specifies whether timestamp fields (i.e. `createdAt` and `updatedAt`) are
   * automatically generated before insertion.
   */
  ignoreTimestamps?: boolean;
}

interface ModelUpdateOneOptions extends ModelInsertOneOptions, FindOneAndReplaceOption, ReplaceOneOptions {
  /**
   * Specifies whether updated doc is returned when update completes.
   */
  returnDoc?: boolean;

  /**
   * Specifies whether timestamp fields (i.e. `createdAt` and `updatedAt`) are
   * automatically generated before insertion.
   */
  ignoreTimestamps?: boolean;
}

interface ModelUpdateManyOptions extends CommonOptions, FindOneAndReplaceOption {
  /**
   * Specifies whether updated docs are returned when update completes.
   */
  returnDocs?: boolean;

  /**
   * Specifies whether timestamp fields (i.e. `createdAt` and `updatedAt`) are
   * automatically generated before insertion.
   */
  ignoreTimestamps?: boolean;
}

interface ModelDeleteOneOptions extends CommonOptions {
  /**
   * Specifies whether deleted doc is returned when deletion completes.
   */
  returnDoc?: boolean;
}

interface ModelDeleteManyOptions extends CommonOptions {
  /**
   * Specifies whether deleted docs are returned when deletion completes.
   */
  returnDocs?: boolean;
}

interface ModelReplaceOneOptions extends FindOneAndReplaceOption, ModelDeleteOneOptions, ModelInsertOneOptions {}

interface ModelCountOptions extends ModelFindManyOptions {}

abstract class Model {
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
   * @return A collection of fields whose values are randomly generated.
   */
  static randomFields<U = {}>(fixedFields: Document<U> = {}, { includeOptionals = false }: ModelRandomFieldsOptions = {}): Document<U> {
    const o: Document<U> = {};
    const fields: { [fieldName: string]: FieldSpecs } = this.schema.fields;

    for (const key in fields) {
      if (!fields.hasOwnProperty(key)) continue;

      // If key is already present in the fixed fields, omit.
      if (o.hasOwnProperty(key)) continue;

      const fieldSpecs: FieldSpecs = fields[key];

      // If `includeOptionals` is not set, skip all the optional fields.
      if (!includeOptionals && !fieldSpecs.required) continue;

      // Use provided random function if provided in the schema.
      if (fieldSpecs.random) o[key] = fieldSpecs.random();
    }

    for (const key in fixedFields) {
      if (!fixedFields.hasOwnProperty(key)) continue;
      o[key] = fixedFields[key];
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
   * @return Aggregation pipeline.
   */
  static pipeline<U = {}>(queryOrSpecs?: Query<U> | PipelineFactorySpecs, options?: PipelineFactoryOptions): AggregationPipeline {
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
   * @return The matching ObjectID.
   */
  static async identifyOne<U = {}>(query: Query<U>): Promise<ObjectID> {
    const result = await this.findOne<U>(query);

    if (is.nullOrUndefined(result)) {
      throw new Error(`No results found while identifying this ${this.schema.model} using the query ${JSON.stringify(query)}`);
    }
    else if (is.nullOrUndefined(result._id)) {
      throw new Error(`Cannot identify this ${this.schema.model} using the query ${JSON.stringify(query)}`);
    }
    else {
      return result._id!;
    }
  }

  /**
   * Finds one document of this collection using the aggregation framework. If
   * no query is specified, a random document will be fetched.
   *
   * @param query - Query used for the $match stage of the aggregation pipeline.
   * @param options - @see module:mongodb.Collection#aggregate
   *
   * @return The matching document as the fulfillment value.
   */
  static async findOne<U = {}>(query?: Query<U>, options?: ModelFindOneOptions): Promise<null | Document<U>> {
    if (is.nullOrUndefined(query)) {
      const collection = await this.getCollection();
      const results = await collection.aggregate(this.pipeline<U>(query).concat([{ $sample: { size: 1 } }])).toArray();

      assert(results.length <= 1, new Error('More than 1 random document found even though only 1 was supposed to be found.'));

      if (results.length === 1) return results[0];

      return null;
    }
    else {
      const results = await this.findMany<U>(query, options);

      if (results.length === 0) return null;

      return results[0];
    }
  }

  /**
   * Finds multiple documents of this collection using the aggregation
   * framework. If no query is specified, all documents are fetched.
   *
   * @param query - Query used for the $match stage of the aggregation pipeline.
   * @param options - @see module:mongodb.Collection#aggregate
   *
   * @return The matching documents as the fulfillment value.
   */
  static async findMany<U = {}>(query?: Query<U>, options?: ModelFindManyOptions): Promise<Document<U>[]> {
    const collection = await this.getCollection();
    const results = await collection.aggregate(this.pipeline<U>(query), options).toArray();
    return results;
  }

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
  static async insertOne<U = {}>(doc?: Document<U>, options?: ModelInsertOneOptions): Promise<null | Document<U>> {
    // Apply before insert handler.
    const t = await this.beforeInsert<U>(doc || this.randomFields<U>(), { strict: true, ...options });

    log(`${this.schema.model}.insertOne:`, JSON.stringify(t, null, 2));

    const collection = await this.getCollection();
    const results = await collection.insertOne(t, options).catch(error => { throw error; });

    log(`${this.schema.model}.insertOne results:`, JSON.stringify(results, null, 2));

    assert(results.result.ok === 1);
    assert(results.ops.length <= 1, new Error('Somehow insertOne() op inserted more than 1 document'));

    if (results.ops.length < 1) return null;

    const o = results.ops[0];

    // Apply after insert handler.
    await this.afterInsert<U>(o);

    return o;
  }

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
  static async insertMany<U = {}>(docs: Document<U>[], options: ModelInsertManyOptions = {}): Promise<Document<U>[]> {
    const n = docs.length;
    const t: typeof docs = new Array(n);

    // Apply before insert handler to each document.
    for (let i = 0; i < n; i++) {
      t[i] = await this.beforeInsert<U>(docs[i]);
    }

    log(`${this.schema.model}.insertMany:`, JSON.stringify(t, null, 2));

    const collection = await this.getCollection();
    const results = await collection.insertMany(t, options);

    log(`${this.schema.model}.insertMany results:`, JSON.stringify(results, null, 2));

    assert(results.result.ok === 1);

    const o = results.ops as Document<U>[];
    const m = o.length;

    for (let i = 0; i < m; i++) {
      await this.afterInsert<U>(o[i]);
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
   * @return The updated doc if `returnDoc` is set to `true`, else `true` or
   *         `false` depending on whether or not the operation was successful.
   *
   * @see {@link https://docs.mongodb.com/manual/reference/operator/update-field/}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#updateOne}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndUpdate}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~updateWriteOpResult}
   */
  static async updateOne<U = {}>(query: Query<U>, update: Document<U> | Update<U>, options: ModelUpdateOneOptions = {}): Promise<null | boolean | Document<U>> {
    const collection = await this.getCollection();
    const [q, u] = await this.beforeUpdate<U>(query, update, options);

    log(`${this.schema.model}.updateOne:`, JSON.stringify(q), JSON.stringify(u));

    if (options.returnDoc === true) {
      const res = await collection.findOneAndUpdate(q, u, { returnOriginal: false, ...options });

      log(`${this.schema.model}.updateOne results:`, JSON.stringify(res));

      assert(res.ok === 1);

      if (!res.value) return null;

      await this.afterUpdate<U>(query, u, res.value);

      return res.value as Document<U>;
    }
    else {
      const res = await collection.updateOne(q, u, options);

      log(`${this.schema.model}.updateOne results:`, JSON.stringify(res));

      assert(res.result.ok === 1);

      if (res.result.n <= 0) return false;

      await this.afterUpdate<U>(query, u);

      return true;
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
   * @return The updated docs if `returnDocs` is set to `true`, else `true` or
   *         `false` depending on whether or not the operation was successful.
   *
   * @see {@link https://docs.mongodb.com/manual/reference/operator/update-field/}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#updateMany}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndUpdate}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~updateWriteOpResult}
   */
  static async updateMany<U = {}>(query: Query<U>, update: Document<U> | Update<U>, options: ModelUpdateManyOptions = {}): Promise<Document<U>[] | boolean> {
    const [q, u] = await this.beforeUpdate<U>(query, update, options);

    log(`${this.schema.model}.updateMany:`, JSON.stringify(q), JSON.stringify(u));

    const collection = await this.getCollection();

    if (options.returnDocs === true) {
      const docs = await this.findMany<U>(q);
      const n = docs.length;
      const results: Document<U>[] = [];

      if (n <= 0) {
        if (options.upsert === true) {
          const res = await this.updateOne(query, update, { ...options, returnDoc: true });

          if (is.boolean(res) || is.null_(res)) {
            throw new Error('Error upserting document during an updateMany operation');
          }

          results.push(res);
        }

        return results;
      }
      else {
        for (let i = 0; i < n; i++) {
          const doc = docs[i];
          const result = await collection.findOneAndUpdate({ _id: doc._id }, u, { returnOriginal: false, ...options });

          assert(result.ok === 1);
          assert(result.value);

          results.push(result.value);
        }

        log(`${this.schema.model}.updateMany results:`, JSON.stringify(results));

        for (let i = 0; i < n; i++) {
          await this.afterUpdate<U>(q, u, results[i]);
        }

        return results;
      }
    }
    else {
      const results = await collection.updateMany(q, u, options);

      log(`${this.schema.model}.updateMany results:`, JSON.stringify(results));

      assert(results.result.ok === 1);

      if (results.result.n <= 0) return false;

      await this.afterUpdate(q, u);

      return true;
    }
  }

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
  static async deleteOne<U = {}>(query: Query<U>, options: ModelDeleteOneOptions = {}): Promise<Document<U> | boolean | null> {
    const q = await this.beforeDelete<U>(query, options);

    log(`${this.schema.model}.deleteOne:`, JSON.stringify(query));

    const collection = await this.getCollection();

    if (options.returnDoc === true) {
      const results = await collection.findOneAndDelete(q);

      log(`${this.schema.model}.deleteOne results:`, JSON.stringify(results));

      assert(results.ok === 1);

      if (!results.value) {
        return null;
      }

      await this.afterDelete<U>(results.value);

      return results.value;
    }
    else {
      const results = await collection.deleteOne(q, options);

      log(`${this.schema.model}.deleteOne results:`, JSON.stringify(results));

      assert(results.result.ok === 1);

      if (!is.number(results.result.n) || (results.result.n <= 0)) {
        return false;
      }

      await this.afterDelete<U>();

      return true;
    }
  }

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
  static async deleteMany<U = {}>(query: Query<U>, options: ModelDeleteManyOptions = {}): Promise<boolean | Document<U>[]> {
    const q = await this.beforeDelete(query, options);

    log(`${this.schema.model}.deleteMany:`, JSON.stringify(q));

    const collection = await this.getCollection();

    if (options.returnDocs === true) {
      const docs = await this.findMany(q);
      const n = docs.length;
      const results: Document<U>[] = [];

      for (let i = 0; i < n; i++) {
        const doc = docs[i];
        const result = await collection.findOneAndDelete({ _id: doc._id });

        assert(result.ok === 1);

        if (result.value) {
          results.push(result.value);
        }
      }

      log(`${this.schema.model}.deleteMany results:`, JSON.stringify(results));

      const m = results.length;

      for (let i = 0; i < m; i++) {
        await this.afterDelete<U>(results[i]);
      }

      return results;
    }
    else {
      const results = await collection.deleteMany(q, { ...options });

      log(`${this.schema.model}.deleteMany results:`, JSON.stringify(results));

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
   * @return The replaced document (by default) or the new document (depending
   *         on the `returnOriginal` option) if available, `null` otherwise.
   *
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndReplace}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~findAndModifyWriteOpResult}
   */
  static async findAndReplaceOne<U = {}>(query: Query<U>, replacement: Document<U> = this.randomFields<U>(), options: ModelReplaceOneOptions = {}): Promise<null | Document<U>> {
    const q = await this.beforeDelete<U>(query, options);
    const r = await this.beforeInsert<U>(replacement, options);

    log(`${this.schema.model}.replaceOne:`, JSON.stringify(q), JSON.stringify(r));

    const collection = await this.getCollection();
    const results = await collection.findOneAndReplace(q, r, { ...options, returnOriginal: true });

    log(`${this.schema.model}.replaceOne results:`, JSON.stringify(results));

    assert(results.ok === 1);

    const oldDoc = results.value;

    if (is.nullOrUndefined(oldDoc)) return null;

    const newDoc = await this.findOne<U>(r);

    if (is.null_(newDoc)) {
      throw new Error('Document is replaced but unable to find the new document in the database');
    }

    await this.afterDelete<U>(results.value);
    await this.afterInsert<U>(newDoc);

    return (options.returnOriginal === true) ? oldDoc : newDoc;
  }

  /**
   * Counts the documents that match the provided query.
   *
   * @param query - Query used for the $match stage of the aggregation pipeline.
   *
   * @return The total number of documents found.
   */
  static async count<U = {}>(query: Query<U>, options: ModelCountOptions = {}): Promise<number> {
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
   * @return The formatted document as the fulfillment value.
   */
  static async formatDocument<U = {}>(doc: Document<U>): Promise<Document<U>> {
    const formattedDoc = _.cloneDeep(doc);
    const fields: { [fieldName: string]: FieldSpecs } = this.schema.fields;

    for (const key in this.schema.fields) {
      if (!formattedDoc.hasOwnProperty(key)) continue;

      const fieldSpecs = fields[key];

      assert(fieldSpecs, new Error(`Field ${key} not found in schema`));

      // If the schema has a certain formatting function defined for this field,
      // apply it.
      if (is.function_(fieldSpecs.format)) {
        const formattedValue = await fieldSpecs.format(formattedDoc[key]);
        formattedDoc[key] = formattedValue;
      }

      // If the schema indicates that this field is encrypted, encrypt it.
      if (fieldSpecs.encrypted === true) {
        formattedDoc[key] = await bcrypt.hash(`${formattedDoc[key]}`, 10);
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
   * @return `true` will be fulfilled if all tests have passed.
   */
  static async validateDocument<U = {}>(doc: Document<U>, options: ModelValidateDocumentOptions = {}): Promise<boolean> {
    const fields: { [fieldName: string]: FieldSpecs } = this.schema.fields;

    for (const key in doc) {
      // Skip validation for fields `_id`, `updatedAt` and `createdAt` since
      // they are automatically generated.
      if (key === '_id') continue;
      if (this.schema.timestamps && (key === 'updatedAt')) continue;
      if (this.schema.timestamps && (key === 'createdAt')) continue;

      const val = doc[key];

      // #1 Check if field is defined in the schema.
      if (!this.schema.fields.hasOwnProperty(key)) {
        throw new Error(`The field '${key}' is not defined in the schema`);
      }

      // #2 Check if field value conforms to its defined specs.
      const fieldSpecs = fields[key];

      if (!validateFieldValue(val, fieldSpecs)) {
        throw new Error(`Error validating field '${key}' with value [${val}] of type [${typeof val}], constraints: ${JSON.stringify(fieldSpecs, undefined, 2)}, doc: ${JSON.stringify(doc, undefined, 2)}`);
      }
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
        if (await this.findOne(uniqueQuery)) throw new Error(`Another document already exists with ${JSON.stringify(uniqueQuery)}`);
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
   * Processes a document before it is inserted. This is also used during an
   * upsert operation.
   *
   * @param doc - The document to be inserted/upserted.
   * @param options - @see ModelBeforeInsertOptions
   *
   * @return Document to be inserted/upserted to the database.
   */
  private static async beforeInsert<U = {}>(doc: Document<U>, options: ModelInsertOneOptions | ModelInsertManyOptions = {}): Promise<Document<U>> {
    const fields: { [fieldName: string]: FieldSpecs } = this.schema.fields;

    let o = sanitizeDocument<U>(this.schema, doc);

    // Unless specified, always renew the `createdAt` and `updatedAt` fields.
    if ((this.schema.timestamps === true) && (options.ignoreTimestamps !== true)) {
      o.createdAt = new Date();
      o.updatedAt = new Date();
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

      o[key] = (is.function_(fieldSpecs.default)) ? fieldSpecs.default() : fieldSpecs.default;
    }

    // Apply format function defined in the schema if applicable.
    o = await this.formatDocument<U>(o);

    // Finally, validate the document as a final sanity check.
    await this.validateDocument<U>(o, { ignoreUniqueIndex: true, ...options });

    return o;
  }

  /**
   * Handler invoked right after a document insertion.
   *
   * @param doc - The inserted document.
   */
  private static async afterInsert<U = {}>(doc: Document<U>): Promise<void> {

  }

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
  private static async beforeUpdate<U = {}>(query: Query<U>, update: Document<U> | Update<U>, options: ModelUpdateOneOptions | ModelUpdateManyOptions = {}): Promise<[Document<U>, Update<U>]> {
    // First sanitize the inputs. We want to be able to make sure the query is
    // valid and that the update object is a proper update query.
    let q = sanitizeQuery<U>(this.schema, query);
    let u: Update<U>;

    if (typeIsUpdate<U>(update)) {
      u = {
        ...update,
      };

      if (u.$set) u.$set = sanitizeDocument<U>(this.schema, u.$set);
      if (u.$setOnInsert) u.$setOnInsert = sanitizeDocument<U>(this.schema, u.$setOnInsert);
      if (u.$addToSet) u.$addToSet = sanitizeDocument<U>(this.schema, u.$addToSet);
      if (u.$push) u.$push = sanitizeDocument<U>(this.schema, u.$push);
    }
    else {
      u = {
        $set: sanitizeDocument<U>(this.schema, update),
      };
    }

    // In the case of an upsert, we need to preprocess the query as if this was
    // an insertion. We also need to tell the database to save all fields in the
    // query to the database as well, unless they are already in the update
    // query.
    if (options.upsert === true) {
      q = await this.beforeInsert<U>(q, options);

      u.$setOnInsert = _.omit(q, [
        'updatedAt',
        ...Object.keys(u),
      ]);
    }

    // Create $set operator if it doesn't exist.
    if (!u.$set) u.$set = {};

    // Add updated timestamps if applicable.
    if ((this.schema.timestamps === true) && (options.ignoreTimestamps !== true)) {
      u.$set.updatedAt = new Date();
    }

    // Format all fields in the update query.
    u.$set = await this.formatDocument<U>(u.$set as Document<U>);

    // Validate all fields in the update query.
    await this.validateDocument<U>(u.$set as Document<U>, { ignoreUniqueIndex: true, ...options });

    return [q, u];
  }

  /**
   * Handler invoked right after an update. This does not account for
   * insertions.
   *
   * @param query - The original query for the document to update.
   * @param update - The update descriptor applied.
   * @param doc - The updated doc if available.
   */
  private static async afterUpdate<U = {}>(query: Query<U>, update: Update<U>, doc?: Document<U>) {

  }

  /**
   * Handler invoked right before a deletion.
   *
   * @param query - Query for document to delete.
   * @param options - @see ModelDeleteOneOptions, @see ModelDeleteManyOptions
   */
  private static async beforeDelete<U = {}>(query: Query<U>, options: ModelDeleteOneOptions | ModelDeleteManyOptions): Promise<Document<U>> {
    const q = sanitizeQuery<U>(this.schema, query);

    return q;
  }

  /**
   * Handler invoked right after a deletion.
   *
   * @param doc - The deleted doc, if available.
   *
   * @todo Cascade deletion only works for first-level foreign keys so far.
   */
  private static async afterDelete<U = {}>(doc?: Document<U>) {
    // If `cascade` property is specified, iterate in the order of the array and
    // remove documents where the foreign field equals the `_id` of this doc.
    if (doc && doc._id && this.schema.cascade) {
      const n = this.schema.cascade.length;

      for (let i = 0; i < n; i++) {
        const cascadeRef = this.schema.cascade[i];
        const ModelClass = getModel(cascadeRef);
        const fields: { [fieldName: string]: FieldSpecs } = ModelClass.schema.fields;

        assert(ModelClass, `Trying to cascade delete from model ${cascadeRef} but model is not found`);

        for (const key in ModelClass.schema.fields) {
          if (!ModelClass.schema.fields.hasOwnProperty(key)) continue;

          const field = fields[key];

          if (field.ref === this.schema.model) {
            log(`Cascade deleting all ${cascadeRef} documents whose "${key}" field is ${doc._id}`);

            await ModelClass.deleteMany({ [`${key}`]: new ObjectID(doc._id) });
          }
        }
      }
    }
  }
}

export default Model;
