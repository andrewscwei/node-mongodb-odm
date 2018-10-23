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
import { Collection, CollectionAggregationOptions, CollectionInsertManyOptions, CollectionInsertOneOptions, FindOneAndReplaceOption, ObjectID, ReplaceOneOptions } from 'mongodb';
import * as db from '../';
import { Document, DocumentUpdate, FieldCollection, FieldSpecs, isDocumentUpdate, Query, Schema } from '../types';
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
 * Options for Model.validateOne.
 */
interface ModelValidateOneOptions {
  /**
   * Tells the validation process to account for required fields. That is, if
   * this is `true` and some required fields are missing in the document to be
   * validated, validation fails.
   */
  strict?: boolean;

  /**
   * Tells the validation process to account for unique indexes. That is, if
   * this is `true` and one or more field values are not unique when it
   * supposedly has a u nique index, validation fails.
   */
  checkUniqueIndex?: boolean;
}

/**
 * Options for Model.findOne.
 */
interface ModelFindOneOptions extends CollectionAggregationOptions {}

/**
 * Options for Model.findMany.
 */
interface ModelFindManyOptions extends CollectionAggregationOptions {}

/**
 * Options for Model.insertOne.
 */
interface ModelInsertOneOptions extends ModelValidateOneOptions, CollectionInsertOneOptions {
  /**
   * Specifies whether timestamp fields (i.e. `createdAt` and `updatedAt`) are
   * automatically generated before insertion.
   */
  ignoreTimestamps?: boolean;
}

/**
 * Options for Model.insertMany.
 */
interface ModelInsertManyOptions extends ModelValidateOneOptions, CollectionInsertManyOptions {
  /**
   * Specifies whether timestamp fields (i.e. `createdAt` and `updatedAt`) are
   * automatically generated before insertion.
   */
  ignoreTimestamps?: boolean;
}

/**
 * Options for Model.updateOne.
 */
interface ModelUpdateOneOptions extends ModelInsertOneOptions, FindOneAndReplaceOption, ReplaceOneOptions {
  /**
   * Specifies whether upserting is enabled.
   */
  upsert?: boolean;

  /**
   * Specifies whether updated docs are returned when update completes.
   */
  returnDocs?: boolean;
}

abstract class Model {
  /**
   * Schema of this model. This property must be overridden in the derived
   * class.
   *
   * @see withSchema()
   */
  static schema: Schema;

  /**
   * Gets the MongoDB collection associated with this model and ensures the
   * indexes defined in its schema.
   *
   * @return The MongoDB collection.
   *
   * @todo Move this to root.
   *
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html}
   */
  static async getCollection(): Promise<Collection> {
    if (!this.schema) throw new Error('This model has no schema, see the `withSchema` decorator');

    const dbInstance = await db.getInstance();
    const collection = await dbInstance.collection(this.schema.collection);

    if (this.schema.indexes) {
      for (const index of this.schema.indexes) {
        const spec = index.spec || {};
        const options = index.options || {};

        if (!options.hasOwnProperty('background')) {
          options.background = true;
        }

        await collection.createIndex(spec, options);
      }
    }

    return collection;
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
  static randomFields(fixedFields: FieldCollection = {}, { includeOptionals = false }: ModelRandomFieldsOptions = {}): FieldCollection {
    const o = {
      ...fixedFields,
    };

    for (const key in this.schema.fields) {
      if (!this.schema.fields.hasOwnProperty(key)) continue;

      // If key is already present in the fixed fields, omit.
      if (o.hasOwnProperty(key)) continue;

      const fieldSpecs: FieldSpecs = this.schema.fields[key];

      // If `includeOptionals` is not set, skip all the optional fields.
      if (!includeOptionals && !fieldSpecs.required) continue;

      // Use provided random function if provided in the schema.
      if (fieldSpecs.random) o[key] = fieldSpecs.random();
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
  static pipeline(queryOrSpecs?: Query | PipelineFactorySpecs, options?: PipelineFactoryOptions): AggregationPipeline {
    if (!this.schema) throw new Error('This model has no schema, see the `withSchema` decorator');

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
   * Returns a document whose values are formatted according to the format
   * function sdefined in the schema. If the field is marked as encrypted in the
   * schema, this process takes care of that too.
   *
   * @param doc - Document to format.
   *
   * @return The formatted document as the fulfillment value.
   */
  static async formatDocumentPerSchema(doc: Document): Promise<Document> {
    const formattedDoc = _.cloneDeep(doc);

    for (const key in this.schema.fields) {
      if (!formattedDoc.hasOwnProperty(key)) continue;

      const fieldSpecs = this.schema.fields[key];

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
   * Handler invoked right before a document is inserted or upserted. This is a
   * good place to apply custom formatting to the document before it is saved to
   * the database.
   *
   * @param doc - The document to be inserted.
   * @param options - Combined options for both Model.insertOne and Model.insertMany.
   *
   * @return Document to be inserted/upserted to the database.
   */
  static async beforeInsert(doc: Document, { ignoreTimestamps = false, strict = true, checkUniqueIndex = false, ...insertOneOptions }: ModelInsertOneOptions | ModelInsertManyOptions = {}): Promise<Document> {
    let o = _.cloneDeep(doc);

    // Unless specified, always renew the `createdAt` and `updatedAt` fields.
    if (this.schema.timestamps && !ignoreTimestamps) {
      o.createdAt = new Date();
      o.updatedAt = new Date();
    }

    // Before inserting this document, go through each field and make sure that
    // it has default values and that they are formatted correctly.
    for (const key in this.schema.fields) {
      if (!this.schema.fields.hasOwnProperty(key)) continue;
      if (o.hasOwnProperty(key)) continue;

      const fieldSpecs = this.schema.fields[key];

      // Check if the field has a default value defined in the schema. If so,
      // apply it.
      if (is.undefined(fieldSpecs.default)) continue;

      o[key] = (is.function_(fieldSpecs.default)) ? fieldSpecs.default() : fieldSpecs.default;
    }

    // Apply format function defined in the schema if applicable.
    o = await this.formatDocumentPerSchema(o);

    // Finally, validate the document as a final sanity check.
    await this.validateOne(o, { strict, checkUniqueIndex });

    return o;
  }

  /**
   * Handler invoked right after a document insertion.
   *
   * @param doc - The inserted document.
   */
  static async afterInsert(doc: Document, options?: ModelInsertOneOptions | ModelInsertManyOptions): Promise<void> {

  }

  /**
   * Handler invoked right before an update. This is NOT invoked on an
   * insertion.
   *
   * @param query - Query for document to update.
   * @param update - The update to apply.
   * @param options - @see ModelUpdateOneOptions
   *
   * @return The modified update to apply.
   */
  static async beforeUpdate(query: Query, update: Document | DocumentUpdate, { upsert = false, ignoreTimestamps = false, ...options }: ModelUpdateOneOptions = {}): Promise<DocumentUpdate> {
    query = _.cloneDeep(query);
    update = _.cloneDeep(update);

    const out = isDocumentUpdate(update) ? update : { $set: update };

    if (out.$set) {
      await this.validateOne(out.$set, { checkUniqueIndex: false });
      if (!upsert) out.$set = await this.formatDocumentPerSchema(out.$set);
    }

    if (upsert) {
      const beforeInsert = await this.beforeInsert(query as Document, { strict: false, ...options });
      const setOnInsert = _.omit(beforeInsert, Object.keys(update).concat(['updatedAt']));
      if (Object.keys(setOnInsert).length > 0) out.$setOnInsert = setOnInsert;
    }

    if (this.schema.timestamps === true) {
      if (!out.$set) out.$set = {};

      if (!ignoreTimestamps) {
        out.$set.updatedAt = new Date();
      }
    }

    return out;
  }

  /**
   * Handler invoked right after an update. This does not account for
   * insertions.
   *
   * @param query - The original query for the document to update.
   * @param update - The update applied.
   * @param doc - The updated doc if `returnDocs` was used along with the update
   *              operation.
   */
  static async afterUpdate(query: Query, update: Document | DocumentUpdate, doc?: Document) {

  }

  // /**
  //  * Handler invoked right before a deletion.
  //  *
  //  * @param {Object|string|ObjectID} query - @see Model.delete
  //  * @param {Object} [options] - @see Model.delete
  //  */
  // static async beforeDelete(query, options) {

  // }

  // /**
  //  * Handler invoked right after a deletion.
  //  *
  //  * @param {Object} doc - The deleted doc if Model.deleteOne was
  //  *                       used. Otherwise it is `undefined`.
  //  * @param {Object} results - The results of the delete operation if
  //  *                           Model#deleteOne was used. Otherwise it is
  //  *                           `undefined`.
  //  */
  // static async afterDelete(doc, results) {
  //   // If `cascade` property is specified, iterate in the order of the array and
  //   // remove documents where the foreign field equals the `_id` of this
  //   // document.
  //   // NOTE: This only works for first-level foreign keys.
  //   if (doc && doc._id && this.schema.cascade) {
  //     const n = this.schema.cascade.length;

  //     for (let i = 0; i < n; i++) {
  //       const cascadeRef = this.schema.cascade[i];
  //       const cascadeModel = db.getModel(cascadeRef);

  //       assert.range(cascadeModel, `Trying to cascade delete from model ${cascadeRef} but model is not found`);

  //       for (const key in cascadeModel.schema.fields) {
  //         const field = cascadeModel.schema.fields[key];
  //         if (field.ref === this.schema.model) {
  //           log.debug(`Cascade deleting all ${cascadeRef} documents whose "${key}" field is ${doc._id}`);
  //           await cascadeModel.deleteMany({ [`${key}`]: ObjectID(doc._id) });
  //         }
  //       }
  //     }
  //   }
  // }

  /**
   * Counts the documents that match the provided query.
   *
   * @param query - Query used for the $match stage of the aggregation pipeline.
   *
   * @return The total number of documents found.
   */
  static async count(query: Query, options?: CollectionAggregationOptions): Promise<number> {
    const results = await this.findMany(query, options);

    return results.length;
  }

  /**
   * Identifies the ObjectID of exactly one document matching the given query.
   * Error is thrown if the document cannot be identified.
   *
   * @param query - Query used for the $match stage of the aggregation pipeline.
   *
   * @return The matching ObjectID.
   */
  static async identifyOne(query: Query): Promise<ObjectID> {
    const result = await this.findOne(query);

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
   * Validates a document for this collection. It checks for the following in
   * order:
   *   1. Each field is defined in the schema
   *   2. Each field value conforms to the defined field specs
   *   3. Unique indexes are enforced (only if `checkUniqueIndex` is enabled)
   *   4. No required fields are missing (only if `strict` is enabled)
   *
   * @param doc - The doc to validate.
   * @param options - @see ModelValidateOneOptions
   *
   * @return `true` will be fulfilled if all tests have passed.
   */
  static async validateOne(doc: Document, { strict = false, checkUniqueIndex = true }: ModelValidateOneOptions = {}): Promise<boolean> {
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
      const fieldSpecs = this.schema.fields[key];

      if (!validateFieldValue(val, fieldSpecs)) {
        throw new Error(`Error validating field '${key}' with value [${val}] of type [${typeof val}], constraints: ${JSON.stringify(fieldSpecs, undefined, 2)}, doc: ${JSON.stringify(doc, undefined, 2)}`);
      }
    }

    // #3 Check for unique fields only if `checkUniqueIndex` is `true`.
    if (checkUniqueIndex && this.schema.indexes) {
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
    if (strict) {
      for (const key in this.schema.fields) {
        if (!this.schema.fields.hasOwnProperty(key)) continue;

        const field = this.schema.fields[key];

        if (!field.required || field.default) continue;
        if (!doc.hasOwnProperty(key)) throw new Error(`Missing required field '${key}'`);
      }
    }

    return true;
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
  static async findOne(query?: Query, options?: ModelFindOneOptions): Promise<null | Document> {
    if (is.nullOrUndefined(query)) {
      const collection = await this.getCollection();
      const results = await collection.aggregate(this.pipeline(query).concat([{ $sample: { size: 1 } }])).toArray();

      assert(results.length <= 1, new Error('More than 1 random document found even though only 1 was supposed to be found.'));

      if (results.length === 1) return results[0];

      return null;
    }
    else {
      const results = await this.findMany(query, options);
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
  static async findMany(query?: Query, options?: ModelFindManyOptions): Promise<Document[]> {
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
   * @return The inserted document.
   *
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#insertOne}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~insertWriteOpResult}
   */
  static async insertOne(doc?: Document, options?: ModelInsertOneOptions): Promise<null | Document> {
    let t = doc ? sanitizeQuery(this.schema, doc) : this.randomFields();

    // Apply before insert handler.
    t = await this.beforeInsert(t, options);

    log(`${this.schema.model}.insertOne:`, JSON.stringify(doc, null, 2));

    const collection = await this.getCollection();
    const results = await collection.insertOne(doc, options).catch(error => { throw error; });

    log(`${this.schema.model}.insertOne results:`, JSON.stringify(results, null, 2));

    assert(results.result.ok === 1);
    assert(results.ops.length <= 1, new Error('Somehow insertOne() op inserted more than 1 document'));

    if (results.ops.length < 1) return null;

    const o = results.ops[0];

    // Apply after insert handler.
    await this.afterInsert(o, options);

    return o;
  }

  /**
   * Inserts multiple documents into this model's collection.
   *
   * @param docs - Array of documents to insert. @see module:mongodb.Collection#insertMany
   * @param options - @see ModelInsertManyOptions
   *
   * @return The inserted documents.
   *
   * @todo This method iterates through every document to apply the beforeInsert
   *       hook. Consider a more cost-efficient approach?
   *
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#insertMany}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~insertWriteOpResult}
   */
  static async insertMany(docs: Document[], options?: ModelInsertManyOptions): Promise<Document[]> {
    const n = docs.length;
    const t: typeof docs = new Array(n);

    // Apply before insert handler to each document.
    for (let i = 0; i < n; i++) {
      t[i] = await this.beforeInsert(sanitizeQuery(this.schema, docs[i]), options);
    }

    log(`${this.schema.model}.insertMany:`, JSON.stringify(t, null, 2));

    const collection = await this.getCollection();
    const results = await collection.insertMany(t, options);

    log(`${this.schema.model}.insertMany results:`, JSON.stringify(results, null, 2));

    assert(results.result.ok === 1);

    const o = results.ops as Document[];
    const m = o.length;

    for (let i = 0; i < m; i++) {
      await this.afterInsert(o[i], options);
    }

    return o;
  }

  // /**
  //  * Replaces one document with another. If `replacement` is not specified,
  //  * one with random info will be generated.
  //  *
  //  * @param query - @see module:mongodb.Collection#findOneAndReplace
  //  * @param replacement - @see module:mongodb.Collection#findOneAndReplace
  //  * @param {Object} [options] - @see module:mongodb.Collection#findOneAndReplace
  //  *
  //  * @return {Promise<Model>} The replaced document as the fulfillment value.
  //  *                           `null` if no document was replaced.
  //  *
  //  * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndReplace}
  //  * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~findAndModifyWriteOpResult}
  //  */
  // static async replaceOne(query: Query, replacement: Document = this.randomFields(), options?: FindOneAndReplaceOption) {
  //   query = sanitizeQuery(this.schema, query);
  //   replacement = await this.beforeInsert(sanitizeQuery(this.schema, replacement), options);

  //   await this.beforeDelete(query, options);

  //   if (!options) options = {};
  //   options.returnOriginal = true;

  //   log(`${this.schema.model}.replaceOne:`, JSON.stringify(query, null, 2), JSON.stringify(replacement, null, 2));

  //   const collection = await this.getCollection();
  //   const results = await collection.findOneAndReplace(query, replacement, options);

  //   log(`${this.schema.model}.replaceOne results:`, JSON.stringify(results, null, 2));

  //   assert(results.ok === 1);

  //   if (!results.value) return null;

  //   await this.afterDelete(results.value, undefined);
  //   await this.afterInsert(await this.findOne(replacement));

  //   return results.value;
  // }

  /**
   * Updates one document matched by `query` with `update` object. Note that if
   * upserting, all *required* fields must be in the `query` param instead of
   * the `update` param.
   *
   * @param {Object|string|ObjectID} query - @see module:mongodb.Collection#updateOne
   * @param {Object} update - @see module:mongodb.Collection#updateOne
   * @param {Object} [options] - @see module:mongodb.Collection#findOneAndUpdate
   *                             @see module:mongodb.Collection#updateOne
   * @param {boolean} [options.returnDocs] - If `true`, `options` will refer to
   *                                         module:mongodb.Collection#findOneAndUpdate,
   *                                         otherwise `options` refer to
   *                                         module:mongodb.Collection#updateOne.
   *
   * @return {Promise<boolean|?Object>} If `returnDocs` is specified, the
   *                                    updated doc will be the fulfillment
   *                                    value. If not, then `true` if update was
   *                                    successful, `false` otherwise.
   *
   * @see {@link https://docs.mongodb.com/manual/reference/operator/update-field/}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#updateOne}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndUpdate}
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~updateWriteOpResult}
   */
  static async updateOne(query: Query, update: Document | DocumentUpdate, { returnDocs = false, ...options }: ModelUpdateOneOptions = {}): Promise<null | boolean | Document> {
    const q = sanitizeQuery(this.schema, query);

    let u = _.cloneDeep(update);

    // Check if the update object has special MongoDB update operators before
    // sanitizing the query.
    if (isDocumentUpdate(u)) {
      for (const key in u) {
        if (!u.hasOwnProperty(key)) continue;
        u[key] = sanitizeQuery(this.schema, u[key]);
      }
    }
    else {
      u = sanitizeQuery(this.schema, u);
    }

    const uu = await this.beforeUpdate(q, u, { returnDocs, ...options });

    log(`${this.schema.model}.updateOne:`, JSON.stringify(q, null, 2), JSON.stringify(uu, null, 2));

    const collection = await this.getCollection();

    if (returnDocs) {
      const results = await collection.findOneAndUpdate(q, uu, { ...options, returnOriginal: !returnDocs });

      log(`${this.schema.model}.updateOne results:`, JSON.stringify(results, null, 2));

      assert(results.ok === 1);

      if (!results.value) return null;

      await this.afterUpdate(q, uu.$set, results.value);

      return results.value as Document;
    }
    else {
      const results = await collection.updateOne(q, uu, { ...options });

      log(`${this.schema.model}.updateOne results:`, JSON.stringify(results, null, 2));

      assert(results.result.ok === 1);

      if (results.result.n <= 0) {
        return false;
      }

      await this.afterUpdate(q, uu.$set);

      return true;
    }
  }

  // /**
  //  * Updates multiple documents matched by `query` with `update` object.
  //  *
  //  * @param {Object|string|ObjectID} query - @see module:mongodb.Collection#updateMany
  //  * @param {Object} update - @see module:mongodb.Collection#updateMany
  //  * @param {Object} [options] - Additional options, conditions apply based on
  //  *                             the `options.returnDocs` flag.
  //  * @param {boolean} [options.returnDocs] - If `true`, `options` will refer to
  //  *                                         module:mongodb.Collection#findOneAndUpdate,
  //  *                                         otherwise `options` refer to
  //  *                                         module:mongodb.Collection#updateMany.
  //  *
  //  * @return {Promise<boolean|Object[]>} If `returnDocs` is `true`, the
  //  *                                     fulfillment value will be an array of
  //  *                                     updated docs. If not, then `true` if
  //  *                                     updates were successful, `false`
  //  *                                     otherwise.
  //  *
  //  * @see {@link https://docs.mongodb.com/manual/reference/operator/update-field/}
  //  * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#updateMany}
  //  * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndUpdate}
  //  * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~updateWriteOpResult}
  //  */
  // static async updateMany(query, update, { returnDocs = false, upsert = false, ...options } = {}) {
  //   assert.type(query, [Object, String, ObjectID]);
  //   assert.type(update, Object);
  //   assert.type(returnDocs, Boolean);

  //   query = sanitizeQuery(this.schema, query);
  //   update = sanitizeQuery(this.schema, update);
  //   update = await this.beforeUpdate(query, update, { ...options });

  //   log.debug(`${this.schema.model}.updateMany:`, JSON.stringify(query, null, 2), JSON.stringify(update, null, 2));

  //   const collection = await this.getCollection();

  //   if (returnDocs) {
  //     const docs = await this.findMany(query);
  //     const results = [];

  //     for (let i = 0; i < docs.length; i++) {
  //       const doc = docs[i];
  //       const result = await collection.findOneAndUpdate({ _id: doc._id }, update, { returnOriginal: !returnDocs, ...options });
  //       assert(result.ok === 1);
  //       assert(result.value);
  //       results.push(result.value);
  //     }

  //     log.debug(`${this.schema.model}.updateMany results:`, JSON.stringify(results, null, 2));

  //     for (let i = 0; i < results.length; i++) {
  //       await this.afterUpdate(results[i], update, undefined);
  //     }

  //     return results;
  //   }
  //   else {
  //     const results = await collection.updateMany(query, update, { ...options });

  //     log.debug(`${this.schema.model}.updateMany results:`, JSON.stringify(results, null, 2));

  //     assert(results.result.ok === 1);
  //     if (results.result.n <= 0) return false;
  //     await this.afterUpdate(undefined, update, results);
  //     return true;
  //   }
  // }

  // /**
  //  * Deletes one document matched by `query`.
  //  *
  //  * @param {Object} query - @see module:mongodb.Collection#deleteMany
  //  * @param {Object} [options] - @see module:mongodb.Collection#findOneAndDelete
  //  *                             @see module:mongodb.Collection#deleteOne
  //  * @param {boolean} [options.returnDocs] - If `true`, `options` will refer to
  //  *                                         module:mongodb.Collection#findOneAndDelete,
  //  *                                         otherwise `options` refer to
  //  *                                         module:mongodb.Collection#deleteOne.
  //  *
  //  * @return {Promise<boolean|?Object>} If `returnDocs` is specified, the
  //  *                                    deleted doc will be the fulfillment
  //  *                                    value. If not, then `true` if delete was
  //  *                                    successful, `false` otherwise.
  //  *
  //  * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#deleteOne}
  //  * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndDelete}
  //  * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~deleteWriteOpResult}
  //  */
  // static async deleteOne(query, { returnDocs = false, ...options } = {}) {
  //   assert.type(query, [Object, String, ObjectID]);
  //   assert.type(returnDocs, Boolean);

  //   query = sanitizeQuery(this.schema, query);
  //   await this.beforeDelete(query, { ...options });

  //   log.debug(`${this.schema.model}.deleteOne:`, JSON.stringify(query, null, 2));

  //   const collection = await this.getCollection();
  //   const results = returnDocs ? await collection.findOneAndDelete(query, { returnOriginal: !returnDocs, ...options }) : await collection.deleteOne(query, { ...options });

  //   log.debug(`${this.schema.model}.deleteOne results:`, JSON.stringify(results, null, 2));

  //   assert(returnDocs ? results.ok === 1 : results.result.ok === 1);

  //   if (returnDocs && !results.value) {
  //     return null;
  //   }
  //   else if (!returnDocs && results.result.n <= 0) {
  //     return false;
  //   }

  //   await this.afterDelete(returnDocs ? results.value : undefined, returnDocs ? undefined : results);

  //   return returnDocs ? results.value : true;
  // }

  // /**
  //  * Deletes multiple documents matched by `query`.
  //  *
  //  * @param {Object} query - @see module:mongodb.Collection#deleteMany
  //  * @param {Object} [options] - @see module:mongodb.Collection#findOneAndDelete
  //  *                             @see module:mongodb.Collection#deleteOne
  //  * @param {boolean} [options.returnDocs] - If `true`, `options` will refer to
  //  *                                         module:mongodb.Collection#findOneAndDelete,
  //  *                                         otherwise `options` refer to
  //  *                                         module:mongodb.Collection#deleteMany.
  //  *
  //  * @return {Promise<boolean|Object[]>} If `returnDocs` is `true`, the
  //  *                                     fulfillment value will be an array of
  //  *                                     deleted docs. If not, then `true` if
  //  *                                     deletions were successful, `false`
  //  *                                     otherwise.
  //  *
  //  * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#deleteMany}
  //  * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndDelete}
  //  * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~deleteWriteOpResult}
  //  */
  // static async deleteMany(query, { returnDocs = false, ...options } = {}) {
  //   assert.type(query, [Object, String, ObjectID]);
  //   assert.type(options, Object, true);
  //   assert.key(options, 'returnDocs', Boolean, true);

  //   query = sanitizeQuery(this.schema, query);
  //   await this.beforeDelete(query, { ...options });

  //   log.debug(`${this.schema.model}.deleteMany:`, JSON.stringify(query, null, 2));

  //   const collection = await this.getCollection();

  //   if (returnDocs) {
  //     const docs = await this.findMany(query);
  //     const results = [];

  //     for (let i = 0; i < docs.length; i++) {
  //       const doc = docs[i];
  //       const result = await collection.findOneAndDelete({ _id: doc._id }, { returnOriginal: !returnDocs, ...options });
  //       assert(result.ok === 1);

  //       if (result.value) {
  //         results.push(result.value);
  //       }
  //     }

  //     log.debug(`${this.schema.model}.deleteMany results:`, JSON.stringify(results, null, 2));

  //     for (let i = 0; i < results.length; i++) {
  //       await this.afterDelete(results[i], undefined);
  //     }

  //     return results;
  //   }
  //   else {
  //     const results = await collection.deleteMany(query, { ...options });

  //     log.debug(`${this.schema.model}.deleteMany results:`, JSON.stringify(results, null, 2));

  //     assert(results.result.ok === 1);
  //     if (results.result.n <= 0) return false;
  //     await this.afterDelete(undefined, results);
  //     return true;
  //   }
  // }
}

export default Model;
