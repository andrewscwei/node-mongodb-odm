"use strict";
/**
 * @file This is a static, abstract model that provides ORM for a single MongoDB
 *       collection. Every other model must inherit this class. It sets up the
 *       ground work for basic CRUD operations, event triggers, query
 *       validations, etc. All returned documents are native JSON objects.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const is_1 = __importDefault(require("@sindresorhus/is"));
const assert_1 = __importDefault(require("assert"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const debug_1 = __importDefault(require("debug"));
const lodash_1 = __importDefault(require("lodash"));
const mongodb_1 = require("mongodb");
const __1 = require("..");
const types_1 = require("../types");
const sanitizeDocument_1 = __importDefault(require("../utils/sanitizeDocument"));
const sanitizeQuery_1 = __importDefault(require("../utils/sanitizeQuery"));
const validateFieldValue_1 = __importDefault(require("../utils/validateFieldValue"));
const Aggregation_1 = __importDefault(require("./Aggregation"));
const log = debug_1.default('mongodb-odm:model');
class Model {
    /**
     * Gets the MongoDB collection associated with this model.
     *
     * @return The MongoDB collection.
     *
     * @see getCollection()
     */
    static getCollection() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.schema)
                throw new Error('This model has no schema, you must define this static proerty in the derived class');
            return __1.getCollection(this.schema.collection);
        });
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
    static randomFields(fixedFields = {}, { includeOptionals = false } = {}) {
        const o = {};
        const fields = this.schema.fields;
        for (const key in fields) {
            if (!fields.hasOwnProperty(key))
                continue;
            // If key is already present in the fixed fields, omit.
            if (o.hasOwnProperty(key))
                continue;
            const fieldSpecs = fields[key];
            // If `includeOptionals` is not set, skip all the optional fields.
            if (!includeOptionals && !fieldSpecs.required)
                continue;
            // Use provided random function if provided in the schema.
            if (fieldSpecs.random)
                o[key] = fieldSpecs.random();
        }
        for (const key in fixedFields) {
            if (!fixedFields.hasOwnProperty(key))
                continue;
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
    static pipeline(queryOrSpecs, options) {
        if (!this.schema)
            throw new Error('This model has no schema, you must define this static proerty in the derived class');
        // Check if the argument conforms to aggregation factory specs.
        if (queryOrSpecs && Object.keys(queryOrSpecs).some(val => val.startsWith('$'))) {
            return Aggregation_1.default.pipelineFactory(this.schema, queryOrSpecs, options);
        }
        // Otherwise the argument is a query for the $match stage.
        else {
            return Aggregation_1.default.pipelineFactory(this.schema, { $match: queryOrSpecs }, options);
        }
    }
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
    static identifyOne(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.findOne(query);
            if (is_1.default.nullOrUndefined(result)) {
                throw new Error(`No results found while identifying this ${this.schema.model} using the query ${JSON.stringify(query, null, 0)}`);
            }
            else if (is_1.default.nullOrUndefined(result._id)) {
                throw new Error(`Cannot identify this ${this.schema.model} using the query ${JSON.stringify(query, null, 0)}`);
            }
            else {
                return result._id;
            }
        });
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
    static findOne(query, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (is_1.default.nullOrUndefined(query)) {
                const collection = yield this.getCollection();
                const results = yield collection.aggregate(this.pipeline(query).concat([{ $sample: { size: 1 } }])).toArray();
                assert_1.default(results.length <= 1, new Error('More than 1 random document found even though only 1 was supposed to be found.'));
                if (results.length === 1)
                    return results[0];
                return null;
            }
            else {
                const results = yield this.findMany(query, options);
                if (results.length === 0)
                    return null;
                return results[0];
            }
        });
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
    static findMany(query, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const collection = yield this.getCollection();
            const results = yield collection.aggregate(this.pipeline(query), options).toArray();
            return results;
        });
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
    static insertOne(doc, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.schema.noInserts === true)
                throw new Error('Insertions are disallowed for this model');
            // Apply before insert handler.
            const t = yield this.beforeInsert(doc || this.randomFields(), Object.assign({ strict: true }, options));
            log(`${this.schema.model}.insertOne:`, JSON.stringify(t, null, 0));
            const collection = yield this.getCollection();
            const results = yield collection.insertOne(t, options).catch(error => { throw error; });
            log(`${this.schema.model}.insertOne results:`, JSON.stringify(results, null, 0));
            assert_1.default(results.result.ok === 1);
            assert_1.default(results.ops.length <= 1, new Error('Somehow insertOne() op inserted more than 1 document'));
            if (results.ops.length < 1)
                return null;
            const o = results.ops[0];
            // Apply after insert handler.
            yield this.afterInsert(o);
            return o;
        });
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
    static insertMany(docs, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            if ((this.schema.noInserts === true) || (this.schema.noInsertMany === true))
                throw new Error('Multiple insertions are disallowed for this model');
            const n = docs.length;
            const t = new Array(n);
            // Apply before insert handler to each document.
            for (let i = 0; i < n; i++) {
                t[i] = yield this.beforeInsert(docs[i]);
            }
            log(`${this.schema.model}.insertMany:`, JSON.stringify(t, null, 0));
            const collection = yield this.getCollection();
            const results = yield collection.insertMany(t, options);
            log(`${this.schema.model}.insertMany results:`, JSON.stringify(results, null, 0));
            assert_1.default(results.result.ok === 1);
            const o = results.ops;
            const m = o.length;
            for (let i = 0; i < m; i++) {
                yield this.afterInsert(o[i]);
            }
            return o;
        });
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
    static updateOne(query, update, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.schema.noUpdates === true)
                throw new Error('Updates are disallowed for this model');
            const collection = yield this.getCollection();
            const [q, u] = (options.skipHooks === true) ? [query, update] : yield this.beforeUpdate(query, update, options);
            log(`${this.schema.model}.updateOne:`, JSON.stringify(q, null, 0), JSON.stringify(u, null, 0), JSON.stringify(options, null, 0));
            if (options.returnDoc === true) {
                if (!is_1.default.object(q)) {
                    throw new Error('Invalid query, maybe it is not sanitized? This could happen if you enabled skipHooks in the options, in which case you will need to sanitize the query yourself');
                }
                // Need to keep the original doc for the didUpdateDocument() hook.
                const res = yield collection.findOneAndUpdate(q, u, Object.assign({}, options, { returnOriginal: true }));
                log(`${this.schema.model}.updateOne results:`, JSON.stringify(res, null, 0), JSON.stringify(options, null, 0));
                assert_1.default(res.ok === 1, new Error('Update failed'));
                let oldDoc;
                let newDoc;
                // Handle upserts properly.
                if (is_1.default.nullOrUndefined(res.lastErrorObject.upserted)) {
                    oldDoc = res.value;
                    if (is_1.default.nullOrUndefined(oldDoc))
                        return null;
                    newDoc = yield this.findOne(oldDoc._id);
                }
                else {
                    newDoc = yield this.findOne(res.lastErrorObject.upserted);
                }
                if (is_1.default.nullOrUndefined(newDoc)) {
                    throw new Error('Unable to find the updated doc');
                }
                if (options.skipHooks !== true) {
                    yield this.afterUpdate(oldDoc, newDoc);
                }
                return newDoc;
            }
            else {
                if (!is_1.default.object(q)) {
                    throw new Error('Invalid query, maybe it is not sanitized? This could happen if you enabled skipHooks in the options, in which case you will need to sanitize the query yourself');
                }
                const res = yield collection.updateOne(q, u, options);
                log(`${this.schema.model}.updateOne results:`, JSON.stringify(res, null, 0));
                assert_1.default(res.result.ok === 1);
                if (res.result.n <= 0)
                    return false;
                if (options.skipHooks !== true) {
                    yield this.afterUpdate();
                }
                return true;
            }
        });
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
    static updateMany(query, update, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            if ((this.schema.noUpdates === true) || (this.schema.noUpdateMany === true))
                throw new Error('Multiple updates are disallowed for this model');
            const [q, u] = yield this.beforeUpdate(query, update, options);
            const collection = yield this.getCollection();
            log(`${this.schema.model}.updateMany:`, JSON.stringify(q, null, 0), JSON.stringify(u, null, 0), JSON.stringify(options, null, 0));
            if (options.returnDocs === true) {
                const docs = yield this.findMany(q);
                const n = docs.length;
                const results = [];
                if ((n <= 0) && (options.upsert === true)) {
                    const res = yield this.updateOne(q, u, Object.assign({}, options, { returnDoc: true, skipHooks: true }));
                    if (is_1.default.boolean(res) || is_1.default.null_(res)) {
                        throw new Error('Error upserting document during an updateMany operation');
                    }
                    results.push(res);
                }
                else {
                    for (let i = 0; i < n; i++) {
                        const doc = docs[i];
                        const result = yield collection.findOneAndUpdate({ _id: doc._id }, u, Object.assign({ returnOriginal: false }, options));
                        assert_1.default(result.ok === 1);
                        assert_1.default(result.value);
                        results.push(result.value);
                    }
                    log(`${this.schema.model}.updateMany results:`, JSON.stringify(results, null, 0));
                }
                yield this.afterUpdate(undefined, results);
                return results;
            }
            else {
                const results = yield collection.updateMany(q, u, options);
                log(`${this.schema.model}.updateMany results:`, JSON.stringify(results, null, 0));
                assert_1.default(results.result.ok === 1);
                if (results.result.n <= 0)
                    return false;
                yield this.afterUpdate();
                return true;
            }
        });
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
    static deleteOne(query, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.schema.noDeletes === true)
                throw new Error('Deletions are disallowed for this model');
            const q = yield this.beforeDelete(query, options);
            log(`${this.schema.model}.deleteOne:`, JSON.stringify(query, null, 0));
            const collection = yield this.getCollection();
            if (options.returnDoc === true) {
                const results = yield collection.findOneAndDelete(q);
                log(`${this.schema.model}.deleteOne results:`, JSON.stringify(results, null, 0));
                assert_1.default(results.ok === 1);
                if (!results.value) {
                    return null;
                }
                yield this.afterDelete(results.value);
                return results.value;
            }
            else {
                const results = yield collection.deleteOne(q, options);
                log(`${this.schema.model}.deleteOne results:`, JSON.stringify(results, null, 0));
                assert_1.default(results.result.ok === 1);
                if (!is_1.default.number(results.result.n) || (results.result.n <= 0)) {
                    return false;
                }
                yield this.afterDelete();
                return true;
            }
        });
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
    static deleteMany(query, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            if ((this.schema.noDeletes === true) || (this.schema.noDeleteMany === true))
                throw new Error('Multiple deletions are disallowed for this model');
            const q = yield this.beforeDelete(query, options);
            log(`${this.schema.model}.deleteMany:`, JSON.stringify(q, null, 0));
            const collection = yield this.getCollection();
            if (options.returnDocs === true) {
                const docs = yield this.findMany(q);
                const n = docs.length;
                const results = [];
                for (let i = 0; i < n; i++) {
                    const doc = docs[i];
                    const result = yield collection.findOneAndDelete({ _id: doc._id });
                    assert_1.default(result.ok === 1);
                    if (result.value) {
                        results.push(result.value);
                    }
                }
                log(`${this.schema.model}.deleteMany results:`, JSON.stringify(results, null, 0));
                const m = results.length;
                yield this.afterDelete(results);
                return results;
            }
            else {
                const results = yield collection.deleteMany(q, Object.assign({}, options));
                log(`${this.schema.model}.deleteMany results:`, JSON.stringify(results, null, 0));
                assert_1.default(results.result.ok === 1);
                if (!is_1.default.number(results.result.n) || (results.result.n <= 0))
                    return false;
                yield this.afterDelete();
                return true;
            }
        });
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
    static findAndReplaceOne(query, replacement = this.randomFields(), options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const q = yield this.beforeDelete(query, options);
            const r = yield this.beforeInsert(replacement, options);
            log(`${this.schema.model}.replaceOne:`, JSON.stringify(q, null, 0), JSON.stringify(r, null, 0));
            const collection = yield this.getCollection();
            const results = yield collection.findOneAndReplace(q, r, Object.assign({}, options, { returnOriginal: true }));
            log(`${this.schema.model}.replaceOne results:`, JSON.stringify(results, null, 0));
            assert_1.default(results.ok === 1);
            const oldDoc = results.value;
            if (is_1.default.nullOrUndefined(oldDoc))
                return null;
            const newDoc = yield this.findOne(r);
            if (is_1.default.null_(newDoc)) {
                throw new Error('Document is replaced but unable to find the new document in the database');
            }
            yield this.afterDelete(results.value);
            yield this.afterInsert(newDoc);
            return (options.returnOriginal === true) ? oldDoc : newDoc;
        });
    }
    /**
     * Counts the documents that match the provided query.
     *
     * @param query - Query used for the $match stage of the aggregation pipeline.
     *
     * @return The total number of documents found.
     */
    static count(query, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield this.findMany(query, options);
            return results.length;
        });
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
    static formatDocument(doc) {
        return __awaiter(this, void 0, void 0, function* () {
            const formattedDoc = lodash_1.default.cloneDeep(doc);
            const fields = this.schema.fields;
            for (const key in this.schema.fields) {
                if (!formattedDoc.hasOwnProperty(key))
                    continue;
                const fieldSpecs = fields[key];
                assert_1.default(fieldSpecs, new Error(`Field ${key} not found in schema`));
                // If the schema has a certain formatting function defined for this field,
                // apply it.
                if (is_1.default.function_(fieldSpecs.format)) {
                    const formattedValue = yield fieldSpecs.format(formattedDoc[key]);
                    formattedDoc[key] = formattedValue;
                }
                // If the schema indicates that this field is encrypted, encrypt it.
                if (fieldSpecs.encrypted === true) {
                    formattedDoc[key] = yield bcrypt_1.default.hash(`${formattedDoc[key]}`, 10);
                }
            }
            return formattedDoc;
        });
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
    static validateDocument(doc, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!is_1.default.plainObject(doc))
                throw new Error('Invalid document provided');
            if (is_1.default.emptyObject(doc))
                throw new Error('Empty objects are not permitted');
            const fields = this.schema.fields;
            for (const key in doc) {
                // Skip validation for fields `_id`, `updatedAt` and `createdAt` since
                // they are automatically generated.
                if (key === '_id')
                    continue;
                if (this.schema.timestamps && (key === 'updatedAt'))
                    continue;
                if (this.schema.timestamps && (key === 'createdAt'))
                    continue;
                const val = doc[key];
                // #1 Check if field is defined in the schema.
                if (!this.schema.fields.hasOwnProperty(key)) {
                    throw new Error(`The field '${key}' is not defined in the schema`);
                }
                // #2 Check if field value conforms to its defined specs.
                const fieldSpecs = fields[key];
                if (!validateFieldValue_1.default(val, fieldSpecs)) {
                    throw new Error(`Error validating field '${key}' with value [${val}] of type [${typeof val}], constraints: ${JSON.stringify(fieldSpecs, null, 0)}, doc: ${JSON.stringify(doc, null, 0)}`);
                }
            }
            // #3 Check for unique fields only if `ignoreUniqueIndex` is not `true`.
            if ((options.ignoreUniqueIndex !== true) && this.schema.indexes) {
                const n = this.schema.indexes.length;
                for (let i = 0; i < n; i++) {
                    const index = this.schema.indexes[i];
                    if (!index.options)
                        continue;
                    if (!index.options.unique)
                        continue;
                    if (!index.spec)
                        continue;
                    if (!Object.keys(index.spec).every(v => Object.keys(doc).indexOf(v) > -1))
                        continue;
                    const uniqueQuery = lodash_1.default.pick(doc, Object.keys(index.spec));
                    if (yield this.findOne(uniqueQuery))
                        throw new Error(`Another document already exists with ${JSON.stringify(uniqueQuery, null, 0)}`);
                }
            }
            // #4 Check for required fields if `strict` is `true`.
            if (options.strict === true) {
                for (const key in this.schema.fields) {
                    if (!this.schema.fields.hasOwnProperty(key))
                        continue;
                    const field = fields[key];
                    if (!field.required || field.default)
                        continue;
                    if (!doc.hasOwnProperty(key))
                        throw new Error(`Missing required field '${key}'`);
                }
            }
            return true;
        });
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
     * @return The document to be inserted.
     */
    static willInsertDocument(doc) {
        return __awaiter(this, void 0, void 0, function* () {
            return doc;
        });
    }
    /**
     * Handler called after the document is successfully inserted.
     *
     * @param doc - The inserted document.
     */
    static didInsertDocument(doc) {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    /**
     * Handler called before an attempted update operation. This method must
     * return the query and update descriptor for the update operation.
     *
     * @param query - The query for document(s) to update.
     * @param update - The update descriptor.
     *
     * @return A tuple of the query and the update descriptor.
     */
    static willUpdateDocument(query, update) {
        return __awaiter(this, void 0, void 0, function* () {
            return [query, update];
        });
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
    static didUpdateDocument(prevDoc, newDocs) {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    /**
     * Handler called before an attempt to delete a document.
     *
     * @param query - The query for the document to be deleted.
     *
     * @return The document to be deleted.
     */
    static willDeleteDocument(query) {
        return __awaiter(this, void 0, void 0, function* () {
            return query;
        });
    }
    /**
     * Handler called after a document or a set of documents are successfully
     * deleted.
     *
     * @param docs - The deleted document(s) if available.
     */
    static didDeleteDocument(docs) {
        return __awaiter(this, void 0, void 0, function* () { });
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
    static beforeInsert(doc, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const fields = this.schema.fields;
            // Call event hook first.
            const d = yield this.willInsertDocument(doc);
            let o = sanitizeDocument_1.default(this.schema, d);
            // Unless specified, always renew the `createdAt` and `updatedAt` fields.
            if ((this.schema.timestamps === true) && (options.ignoreTimestamps !== true)) {
                if (!is_1.default.date(o.createdAt))
                    o.createdAt = new Date();
                if (!is_1.default.date(o.updatedAt))
                    o.updatedAt = new Date();
            }
            // Before inserting this document, go through each field and make sure that
            // it has default values and that they are formatted correctly.
            for (const key in this.schema.fields) {
                if (!this.schema.fields.hasOwnProperty(key))
                    continue;
                if (o.hasOwnProperty(key))
                    continue;
                const fieldSpecs = fields[key];
                // Check if the field has a default value defined in the schema. If so,
                // apply it.
                if (is_1.default.undefined(fieldSpecs.default))
                    continue;
                o[key] = (is_1.default.function_(fieldSpecs.default)) ? fieldSpecs.default() : fieldSpecs.default;
            }
            // Apply format function defined in the schema if applicable.
            o = yield this.formatDocument(o);
            // Finally, validate the document as a final sanity check.
            yield this.validateDocument(o, Object.assign({ ignoreUniqueIndex: true, strict: true }, options));
            return o;
        });
    }
    /**
     * Handler invoked right after a document insertion.
     *
     * @param doc - The inserted document.
     */
    static afterInsert(doc) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.didInsertDocument(doc);
        });
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
    static beforeUpdate(query, update, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            if ((options.upsert === true) && (this.schema.allowUpserts !== true))
                throw new Error('Attempting to upsert a document while upserting is disallowed in the schema');
            const [q, u] = yield this.willUpdateDocument(query, update);
            // First sanitize the inputs. We want to be able to make sure the query is
            // valid and that the update object is a proper update query.
            const qq = sanitizeQuery_1.default(this.schema, q);
            let uu;
            if (types_1.typeIsUpdate(u)) {
                uu = Object.assign({}, u);
                if (uu.$set)
                    uu.$set = sanitizeDocument_1.default(this.schema, uu.$set);
                if (uu.$setOnInsert)
                    uu.$setOnInsert = sanitizeDocument_1.default(this.schema, uu.$setOnInsert);
                if (uu.$addToSet)
                    uu.$addToSet = sanitizeDocument_1.default(this.schema, uu.$addToSet);
                if (uu.$push)
                    uu.$push = sanitizeDocument_1.default(this.schema, uu.$push);
            }
            else {
                uu = {
                    $set: sanitizeDocument_1.default(this.schema, u),
                };
            }
            // Add updated timestamps if applicable.
            if ((this.schema.timestamps === true) && (options.ignoreTimestamps !== true)) {
                if (!uu.$set)
                    uu.$set = {};
                if (!is_1.default.date(uu.$set.updatedAt))
                    uu.$set.updatedAt = new Date();
            }
            // Format all fields in the update query.
            if (uu.$set) {
                uu.$set = yield this.formatDocument(uu.$set);
            }
            // In the case of an upsert, we need to preprocess the query as if this was
            // an insertion. We also need to tell the database to save all fields in the
            // query to the database as well, unless they are already in the update
            // query.
            if (options.upsert === true) {
                // Make a copy of the query in case it is manipulated by the hooks.
                const beforeInsert = yield this.beforeInsert(lodash_1.default.cloneDeep(qq), Object.assign({}, options, { strict: false }));
                const setOnInsert = lodash_1.default.omit(Object.assign({}, uu.$setOnInsert || {}, beforeInsert), Object.keys(uu.$set || {}));
                if (!is_1.default.emptyObject(setOnInsert)) {
                    uu.$setOnInsert = setOnInsert;
                }
            }
            // Validate all fields in the update query.
            yield this.validateDocument(uu.$set, Object.assign({ ignoreUniqueIndex: true }, options));
            return [qq, uu];
        });
    }
    /**
     * Handler invoked right after an update. This does not account for
     * insertions.
     *
     * @param oldDoc - The original document.
     * @param newDoc - The updated document.
     */
    static afterUpdate(oldDoc, newDocs) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.didUpdateDocument(oldDoc, newDocs);
        });
    }
    /**
     * Handler invoked right before a deletion.
     *
     * @param query - Query for document to delete.
     * @param options - @see ModelDeleteOneOptions, @see ModelDeleteManyOptions
     */
    static beforeDelete(query, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const q = yield this.willDeleteDocument(query);
            return sanitizeQuery_1.default(this.schema, q);
        });
    }
    /**
     * Handler invoked right after a deletion.
     *
     * @param doc - The deleted doc, if available.
     *
     * @todo Cascade deletion only works for first-level foreign keys so far.
     */
    static afterDelete(docs) {
        return __awaiter(this, void 0, void 0, function* () {
            if (is_1.default.array(docs)) {
                for (const doc of docs) {
                    if (!is_1.default.directInstanceOf(doc._id, mongodb_1.ObjectID))
                        continue;
                    yield this.cascadeDelete(doc._id);
                }
            }
            else if (!is_1.default.nullOrUndefined(docs) && is_1.default.directInstanceOf(docs._id, mongodb_1.ObjectID)) {
                yield this.cascadeDelete(docs._id);
            }
            yield this.didDeleteDocument(docs);
        });
    }
    /**
     * Deletes documents from other collections that have a foreign key to this
     * collection, as specified in the schema.
     *
     * @param docId - The ID of the document in this collection in which other
     *                collections are pointing to.
     */
    static cascadeDelete(docId) {
        return __awaiter(this, void 0, void 0, function* () {
            const cascadeModelNames = this.schema.cascade;
            if (is_1.default.nullOrUndefined(cascadeModelNames))
                return;
            if (!is_1.default.array(cascadeModelNames))
                throw new Error('Invalid definition of cascade in schema');
            for (const modelName of cascadeModelNames) {
                const ModelClass = __1.getModel(modelName);
                const fields = ModelClass.schema.fields;
                assert_1.default(ModelClass, `Trying to cascade delete from model ${modelName} but model is not found`);
                for (const key in ModelClass.schema.fields) {
                    if (!ModelClass.schema.fields.hasOwnProperty(key))
                        continue;
                    const field = fields[key];
                    if (field.ref === this.schema.model) {
                        log(`Cascade deleting all ${modelName} documents whose "${key}" field is ${docId}`);
                        yield ModelClass.deleteMany({ [`${key}`]: docId });
                    }
                }
            }
        });
    }
    /**
     * Prevent instantiation of this class or any of its sub-classes because this
     * is intended to be a static class.
     */
    constructor() {
        throw new Error('This is a static class and is prohibited from instantiated');
    }
}
exports.default = Model;
//# sourceMappingURL=Model.js.map