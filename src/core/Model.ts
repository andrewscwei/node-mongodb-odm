/**
 * @file This is a static, abstract model that provides ORM for a single MongoDB
 *       collection. Every other model must inherit this class. It sets up the
 *       ground work for basic CRUD operations, event triggers, query
 *       validations, etc. All returned documents are native JSON objects.
 */

import is from '@sindresorhus/is';
import assert from 'assert';
import debug from 'debug';
import { Collection, ObjectID } from 'mongodb';
import * as db from '../';
import { Document, FieldCollection, FieldSpecs, Query, Schema } from '../types';
import Aggregation, { AggregationPipeline, PipelineFactoryOptions, PipelineFactorySpecs } from './Aggregation';
import validateFieldValue from '../utils/validateFieldValue';

const log = debug('mongodb-odm:model');

abstract class Model {
  /**
   * Schema of this model. This needs to be
   */
  static schema: Schema;

  /**
   * Gets the MongoDB collection associated with this model and ensures the
   * indexes defined in its schema.
   *
   * @return The MongoDB collection.
   *
   * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html}
   */
  static async collection(): Promise<Collection> {
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
   * Generates random fields for this model. Only fields that are defined in the
   * schema marked as required and has a random function will be generated.
   * Specify `includeOptionals` to generate unrequired fields. Fields whose type
   * is an ObjectID or have default values are ignored.
   *
   * @param fixedFields - Fields that must be present in the output.
   * @param options.includeOptionals - Specifies whether optional fields will be
   *                                   generated as well.
   *
   * @return An object of randomly generated properties that can be used to
   *         create a new document of this model.
   */
  static randomFields(fixedFields: FieldCollection = {}, { includeOptionals = false }: { includeOptionals?: boolean } = {}): FieldCollection {
    assert(is.undefined(fixedFields) || is.object(fixedFields));

    const out = {
      ...fixedFields,
    };

    for (const key in this.schema.fields) {
      if (!this.schema.fields.hasOwnProperty(key)) continue;

      // If key is already present in the fixed fields, omit.
      if (out.hasOwnProperty(key)) continue;

      const fieldSpecs: FieldSpecs = this.schema.fields[key];

      // No need to generate random info for ObjectIDs.
      if (fieldSpecs.type === ObjectID) continue;

      // If `includeOptionals` is not set, skip all the optional fields.
      if (!includeOptionals && (fieldSpecs.default || !fieldSpecs.required)) continue;

      // Use provided random function if provided in the schema.
      if (fieldSpecs.random) out[key] = fieldSpecs.random();
    }

    return out;
  }

  /**
   * Generates an aggregation pipeline.
   *
   * @param queryOrSpecs - This is either a query or aggregation factory specs.
   * @param options - Options for aggregation pipeline factory.
   *
   * @return Aggregation pipeline.
   */
  static pipeline(queryOrSpecs: Query | PipelineFactorySpecs, options: PipelineFactoryOptions): AggregationPipeline {
    assert(!is.nullOrUndefined(queryOrSpecs));

    // Check if this is a spec.
    if (Object.keys(queryOrSpecs).some(val => val.startsWith('$'))) {
      return Aggregation.pipelineFactory(this.schema, queryOrSpecs as PipelineFactorySpecs, options);
    }
    // Otherwise this is a query.
    else {
      return Aggregation.pipelineFactory(this.schema, { $match: queryOrSpecs as Query }, options);
    }
  }

  /**
   * Validates a doc for this collection. It checks the following:
   *   1. Whether each field is of the correct type as defined by the schema
   *   2. Whether each field conforms to the defined constraints
   *   3. Whether each field is defined in the schema
   *   4. Whether required fields are specified (only if `strict` is enabled)
   *   5. Whehter unique indexes are enforced (only if `)
   *
   * @param doc - The doc to validate.
   * @param options.strict - If this is set to `true`, validation fails if
   *                         required fields are not present.
   * @param options.checkUniqueIndex - Specifies whether to skip db index
   *                                   validations (hence deferring this
   *                                   validation to when the db writes the
   *                                   document). If set to `false`, unique
   *                                   fields will not be enforced.
   *
   * @return `true` will be fulfilled if all tests have passed.
   */
  static async validate(doc: Partial<Document>, { strict = false, checkUniqueIndex = true }: { strict?: boolean, checkUniqueIndex?: boolean } = {}): Promise<boolean> {
    assert(is.object(doc));

    if (Object.keys(doc).length <= 0) throw new Error('Blank \'doc\' detected');

    for (const key in doc) {
      // Skip validation for fields `_id`, `updatedAt` and `createdAt` since
      // they are automatically generated.
      if (key === '_id') continue;
      if (this.schema.timestamps && (key === 'updatedAt')) continue;
      if (this.schema.timestamps && (key === 'createdAt')) continue;

      const val = doc[key];

      // Check if field is defined in the schema.
      if (!this.schema.fields.hasOwnProperty(key)) throw new Error(`The field '${key}' is not defined in the schema`);

      // Check if field value conforms to its defined specs.
      const fieldSpecs = this.schema.fields[key];

      if (!validateFieldValue(val, fieldSpecs)) {
        throw new Error(`Error validating field '${key}' with value [${val}] of type [${typeof val}], constraints: ${JSON.stringify(fieldSpecs, undefined, 2)}, doc: ${JSON.stringify(doc, undefined, 2)}`);
      }
    }

    // Check for unique fields only if `checkUniqueIndex` is `true`.
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

    // Check for required fields if `strict` is `true`.
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

  // /**
  //  * Finds one document of this collection using the aggregation framework.
  //  *
  //  * @param {Object|string|ObjectID} [query] - @see Model.pipeline
  //  * @param {Object} [options] - @see module:mongodb.Collection#aggregate
  //  *
  //  * @return {Promise<?Object>} The matching document as the fulfillment value.
  //  */
  // static async findOne(query, options) {
  //   assert.type(query, [Object, String, ObjectID], true);
  //   assert.type(options, Object, true);
  //   const results = await this.findMany(query, options);
  //   if (results.length === 0) return null;
  //   return results[0];
  // }

  // /**
  //  * Finds multiple documents of this collection using the aggregation
  //  * framework.
  //  *
  //  * @param {Object|string|ObjectID} [query] - @see Model.pipeline
  //  * @param {Object} [options] - @see module:mongodb.Collection#aggregate
  //  *
  //  * @return {Promise<Object[]>} The matching documents as the fulfillment
  //  *                             value.
  //  */
  // static async findMany(query, options) {
  //   assert.type(query, [Object, String, ObjectID], true);
  //   assert.type(options, Object, true);
  //   const collection = await this.collection();
  //   const results = await collection.aggregate(this.pipeline(query), options).toArray();
  //   return results;
  // }

  // /**
  //  * Finds one random document from this collection.
  //  *
  //  * @param {Object|string|ObjectID} [query] - @see Model.pipeline
  //  *
  //  * @return {Promise<Object|null>} - The random document as the fulfillment
  //  *                                  value, `null` if none are found (happens
  //  *                                  when the collection is empty).
  //  */
  // static async random(query) {
  //   assert.type(query, [Object, String, ObjectID], true);
  //   const collection = await this.collection();
  //   const results = await collection.aggregate(this.pipeline(query).concat([{ $sample: { size: 1 } }])).toArray();
  //   assert.range(results.length <= 1, 'More than 1 random document found even though only 1 was supposed to be found.');
  //   if (results.length === 1) return results[0];
  //   return null;
  // }

  // /**
  //  * Counts the documents that match the provided query.
  //  *
  //  * @param {Object|string|ObjectID} query - @see Model.findMany
  //  *
  //  * @return {Promise<number>} - The total number of documents found.
  //  */
  // static async count(query, options) {
  //   const results = await this.findMany(query, options);
  //   return results.length;
  // }

  // /**
  //  * Identifies the ObjectID of exactly one document matching the given query.
  //  * Error is thrown if the document cannot be identified.
  //  *
  //  * @param {Object|string|ObjectID} query - @see Model.findOne
  //  *
  //  * @return {Promise<ObjectID>} The matching ObjectID.
  //  */
  // static async identifyOne(query) {
  //   const result = await this.findOne(query);
  //   assert.range(result, `Cannot identify this ${this.schema.model} using the query ${JSON.stringify(query)}`);
  //   return result._id;
  // }

  // /**
  //  * Inserts one document into this model's collection. If `doc` is not
  //  * specified, random fields will be generated.
  //  *
  //  * @param {Object} [doc] - @see module:mongodb.Collection#insertOne
  //  * @param {Object} [options] - @see module:mongodb.Collection#insertOne
  //  *
  //  * @return {Promise<?Object>} The inserted document as the fulfillment value.
  //  *
  //  * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#insertOne}
  //  * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~insertWriteOpResult}
  //  */
  // static async insertOne(doc, options) {
  //   assert.type(doc, Object, true);
  //   assert.type(options, Object, true);

  //   doc = querify(this.schema, doc);
  //   doc = await this.beforeInsert(doc || this.randomFields(), options);

  //   log.debug(`${this.schema.model}.insertOne:`, JSON.stringify(doc, null, 2));

  //   const collection = await this.collection();
  //   const results = await collection.insertOne(doc, options).catch(e => { throw new RangeError(e.message); });

  //   log.debug(`${this.schema.model}.insertOne results:`, JSON.stringify(results, null, 2));

  //   assert(results.result.ok === 1);
  //   assert(results.ops.length <= 1, 'Somehow insertOne() op inserted more than 1 document');

  //   if (results.ops.length < 1) return null;

  //   return await this.afterInsert(results.ops[0]);
  // }

  // /**
  //  * Inserts multiple documents into this model's collection.
  //  *
  //  * @param {Object[]} docs - @see module:mongodb.Collection#insertMany
  //  * @param {Object} [options] - @see module:mongodb.Collection#insertMany
  //  *
  //  * @return {Promise<Object[]>} The inserted documents as the fulfillment
  //  *                             value.
  //  *
  //  * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#insertMany}
  //  * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~insertWriteOpResult}
  //  */
  // static async insertMany(docs, options) {
  //   assert.type(docs, Array);
  //   assert.type(options, Object, true);

  //   for (let i = 0; i < docs.length; i++) {
  //     const doc = querify(this.schema, doc[i]);
  //     docs[i] = await this.beforeInsert(doc, options);
  //   }

  //   log.debug(`${this.schema.model}.insertMany:`, JSON.stringify(docs, null, 2));

  //   const collection = await this.collection();
  //   const results = await collection.insertMany(docs, options);

  //   log.debug(`${this.schema.model}.insertMany results:`, JSON.stringify(results, null, 2));

  //   docs = results.ops;

  //   assert(results.result.ok === 1);

  //   for (let i = 0; i < docs.length; i++) {
  //     docs[i] = await this.afterInsert(docs[i]);
  //   }

  //   return docs;
  // }

  // /**
  //  * Replaces one document with another. If `replacement` is not specified,
  //  * one with random info will be generated.
  //  *
  //  * @param {Object} query - @see module:mongodb.Collection#findOneAndReplace
  //  * @param {Object} [replacement] - @see module:mongodb.Collection#findOneAndReplace
  //  * @param {Object} [options] - @see module:mongodb.Collection#findOneAndReplace
  //  *
  //  * @return {Promise<Model>} The replaced document as the fulfillment value.
  //  *                           `null` if no document was replaced.
  //  *
  //  * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndReplace}
  //  * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~findAndModifyWriteOpResult}
  //  */
  // static async replaceOne(query, replacement = this.randomFields(), options) {
  //   assert.type(query, [Object, String, ObjectID]);
  //   assert.type(replacement, Object);
  //   assert.type(options, Object, true);

  //   query = querify(this.schema, query);
  //   replacement = querify(this.schema, replacement);
  //   replacement = await this.beforeInsert(replacement, options);

  //   await this.beforeDelete(query, options);

  //   if (!options) options = {};
  //   options.returnOriginal = true;

  //   log.debug(`${this.schema.model}.replaceOne:`, JSON.stringify(query, null, 2), JSON.stringify(replacement, null, 2));

  //   const collection = await this.collection();
  //   const results = await collection.findOneAndReplace(query, replacement, options);

  //   log.debug(`${this.schema.model}.replaceOne results:`, JSON.stringify(results, null, 2));

  //   assert(results.result.ok === 1);

  //   if (!results.result.value) return null;

  //   await this.afterDelete(results.result.value, undefined);
  //   await this.afterInsert(await this.findOne(replacement));


  //   return results.result.value;
  // }

  // /**
  //  * Updates one document matched by `query` with `update` object. Note that if
  //  * upserting, all *required* fields must be in the `query` param instead of
  //  * the `update` param.
  //  *
  //  * @param {Object|string|ObjectID} query - @see module:mongodb.Collection#updateOne
  //  * @param {Object} update - @see module:mongodb.Collection#updateOne
  //  * @param {Object} [options] - @see module:mongodb.Collection#findOneAndUpdate
  //  *                             @see module:mongodb.Collection#updateOne
  //  * @param {boolean} [options.returnDocs] - If `true`, `options` will refer to
  //  *                                         module:mongodb.Collection#findOneAndUpdate,
  //  *                                         otherwise `options` refer to
  //  *                                         module:mongodb.Collection#updateOne.
  //  *
  //  * @return {Promise<boolean|?Object>} If `returnDocs` is specified, the
  //  *                                    updated doc will be the fulfillment
  //  *                                    value. If not, then `true` if update was
  //  *                                    successful, `false` otherwise.
  //  *
  //  * @see {@link https://docs.mongodb.com/manual/reference/operator/update-field/}
  //  * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#updateOne}
  //  * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#findOneAndUpdate}
  //  * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#~updateWriteOpResult}
  //  */
  // static async updateOne(query, update, { returnDocs = false, ...options } = {}) {
  //   assert.type(query, [Object, String, ObjectID]);
  //   assert.type(update, Object);
  //   assert.type(returnDocs, Boolean);

  //   query = querify(this.schema, query);

  //   // Check if the update object has special MongoDB update operators before
  //   // normalizing the query.
  //   if (Object.keys(update).some(val => val.startsWith('$'))) {
  //     Object.keys(update).map(key => {
  //       update[key] = querify(this.schema, update[key]);
  //     });
  //   }
  //   else {
  //     update = querify(this.schema, update);
  //   }

  //   update = await this.beforeUpdate(query, update, { ...options });

  //   log.silly(`${this.schema.model}.updateOne:`, JSON.stringify(query, null, 2), JSON.stringify(update, null, 2));

  //   const collection = await this.collection();
  //   const results = returnDocs ? await collection.findOneAndUpdate(query, update, { ...options, returnOriginal: !returnDocs }) : await collection.updateOne(query, update, { ...options });

  //   log.silly(`${this.schema.model}.updateOne results:`, JSON.stringify(results, null, 2));

  //   assert(returnDocs ? results.ok === 1 : results.result.ok === 1);

  //   if (returnDocs && !results.value) {
  //     return null;
  //   }
  //   else if (!returnDocs && results.result.n <= 0) {
  //     return false;
  //   }

  //   await this.afterUpdate(returnDocs ? results.value : undefined, update.$set, returnDocs ? undefined : results);

  //   return returnDocs ? results.value : true;
  // }

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

  //   query = querify(this.schema, query);
  //   update = querify(this.schema, update);
  //   update = await this.beforeUpdate(query, update, { ...options });

  //   log.debug(`${this.schema.model}.updateMany:`, JSON.stringify(query, null, 2), JSON.stringify(update, null, 2));

  //   const collection = await this.collection();

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

  //   query = querify(this.schema, query);
  //   await this.beforeDelete(query, { ...options });

  //   log.debug(`${this.schema.model}.deleteOne:`, JSON.stringify(query, null, 2));

  //   const collection = await this.collection();
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

  //   query = querify(this.schema, query);
  //   await this.beforeDelete(query, { ...options });

  //   log.debug(`${this.schema.model}.deleteMany:`, JSON.stringify(query, null, 2));

  //   const collection = await this.collection();

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

  // /**
  //  * Preformats docs based on the schema definition.
  //  *
  //  * @param {Object} doc
  //  */
  // static async preformat(doc) {
  //   let formattedDoc = _.cloneDeep(doc);

  //   for (const key in this.schema.fields) {
  //     if (!formattedDoc.hasOwnProperty(key)) continue;

  //     const field = this.schema.fields[key];

  //     assert.range(field, `Field ${key} not found in schema`);

  //     // If the schema has a certain formatting function defined for this field,
  //     // apply it.
  //     if (typeof field.format === 'function') {
  //       formattedDoc[key] = await field.format(formattedDoc[key]);
  //     }

  //     // If the schema indicates that this field is encrypted, encrypt it.
  //     if (field.encrypted === true) {
  //       formattedDoc[key] = await bcrypt.hash(`${formattedDoc[key]}`, 10);
  //     }
  //   }

  //   return formattedDoc;
  // }

  // /**
  //  * Handler invoked right before a document insertion.
  //  *
  //  * @param {Object} doc - The document to be inserted.
  //  * @param {Object} [options] - Options passed into Model.insertOne.
  //  * @param {boolean} [options.strict=true] - Custom option. If true, strict
  //  *                                          mode is used during validation.
  //  *                                          @see Model.validate
  //  *
  //  * @return {Promise<Model>} The fulfillment value is the doc that was passed
  //  *                           into this handler.
  //  */
  // static async beforeInsert(doc, { strict = true, ...options } = {}) {
  //   let output = _.cloneDeep(doc);

  //   if (this.schema.timestamps === true) {
  //     // When in production, always renew the `createdAt` field.
  //     if (config.env === 'production' || !output.createdAt) {
  //       output.createdAt = new Date();
  //     }

  //     // When in production, always renew the `updatedAt` field.
  //     if (config.env === 'production' || !output.updatedAt) {
  //       output.updatedAt = new Date();
  //     }
  //   }

  //   // Before inserting this document, go through each field and make sure that
  //   // it has default values and is formatted correctly.
  //   for (const key in this.schema.fields) {
  //     const field = this.schema.fields[key];
  //     const fieldIsInDoc = output.hasOwnProperty(key);

  //     if (fieldIsInDoc) continue;

  //     const fieldHasDefaultValue = field.hasOwnProperty('default');

  //     // If this field is not in the inserting doc but the schema has a default
  //     // value defined for it, set it as per the default value. If this field is
  //     // a required field and there is no default value defined in the schema,
  //     // throw an error.
  //     if (fieldHasDefaultValue) {
  //       output[key] = (typeof field.default === 'function') ? field.default() : field.default;
  //     }
  //   }

  //   // Format first.
  //   output = await this.preformat(output);

  //   // Then validate.
  //   await this.validate(output, { strict: strict, checkUniqueIndex: false });

  //   return output;
  // }

  // /**
  //  * Handler invoked right after a document insertion.
  //  *
  //  * @param {Object} doc - The inserted document.
  //  *
  //  * @return {Promise<Model>} The inserted doc.
  //  */
  // static async afterInsert(doc) {
  //   return doc;
  // }

  // /**
  //  * Handler invoked right before an update. This does not account for
  //  * insertions. However, DO BE CAREFUL IF YOU ARE UPSERTING.
  //  *
  //  * @param {Object|string|ObjectID} query - @see Model.updateOne
  //  * @param {Object} update - @see Model.updateOne
  //  * @param {Object} options - @see Model.updateOne
  //  *
  //  * @return {Promise<Object>} The update object as fulfillment value.
  //  */
  // static async beforeUpdate(query, update, { upsert = false, ...options } = {}) {
  //   query = _.cloneDeep(query);
  //   update = _.cloneDeep(update);

  //   const hasUpdateOperators = Object.keys(update).some(val => val.startsWith('$'));
  //   const out = hasUpdateOperators ? update : { $set: update };

  //   if (out.$set) {
  //     await this.validate(out.$set, { checkUniqueIndex: false });
  //     if (!upsert) out.$set = await this.preformat(out.$set);
  //   }

  //   if (upsert) {
  //     const beforeInsert = await this.beforeInsert(query, { strict: false, ...options });
  //     const setOnInsert = _.omit(beforeInsert, Object.keys(update).concat(['updatedAt']));
  //     if (Object.keys(setOnInsert).length > 0) out.$setOnInsert = setOnInsert;
  //   }

  //   if (this.schema.timestamps === true) {
  //     if (!out.$set) out.$set = {};

  //     // When in production, always renew the `updatedAt` field.
  //     if (config.env === 'production' || !out.$set.updatedAt) {
  //       out.$set.updatedAt = new Date();
  //     }
  //   }

  //   return out;
  // }

  // /**
  //  * Handler invoked right after an update. This does not account for
  //  * insertions.
  //  *
  //  * @param {Object} doc - The updated doc if `returnDocs` was used along with
  //  *                       the update operation. Otherwise this is `undefined`.
  //  * @param {Object} update - The update applied.
  //  * @param {Object} results - The results of the update operation if
  //  *                           Model#updateOne was used. Otherwise it is
  //  *                           `undefined`.
  //  */
  // static async afterUpdate(doc, update, results) {

  // }

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
}

export default Model;
