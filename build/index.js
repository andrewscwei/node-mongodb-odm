"use strict";
/**
 * @file Database configuration file. This file exports methods to interact with
 *       the MongoClient instance.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const is_1 = __importDefault(require("@sindresorhus/is"));
const assert_1 = __importDefault(require("assert"));
const debug_1 = __importDefault(require("debug"));
const mongodb_1 = require("mongodb");
exports.ObjectID = mongodb_1.ObjectID;
const Model_1 = __importDefault(require("./core/Model"));
exports.Model = Model_1.default;
const log = debug_1.default('mongodb-odm');
/**
 * Global MongoDB client instance.
 */
let client;
/**
 * Global db configuration options.
 */
let config;
/**
 * Collection lookup dictionary.
 */
let collections = {};
// Be sure to disconnect the database if the app terminates.
process.on('SIGINT', () => __awaiter(this, void 0, void 0, function* () {
    if (client) {
        yield disconnectFromDb();
        log('MongoDB client disconnected due to app termination');
    }
    process.exit(0);
}));
/**
 * Establishes a new connection to the database based on the initialized
 * configuration. If there already exists one, this method does nothing.
 */
function connectToDb() {
    return __awaiter(this, void 0, void 0, function* () {
        if (isDbConnected())
            return;
        if (!config)
            throw new Error('You must configure connection options by calling #configureDb()');
        // Resolve the authentication string.
        const authentication = (config.username && config.password) ? `${config.username}:${config.password}` : undefined;
        // Database client URL.
        const url = `mongodb://${authentication ? `${authentication}@` : ''}${config.host}/${config.name}`;
        client = yield mongodb_1.MongoClient.connect(url, {
            useNewUrlParser: true,
        });
        const connection = client.db(config.name);
        log('MongoDB client is open:', url);
        connection.on('authenticated', () => {
            log('MongoDB servers authenticated');
        });
        connection.on('close', (err) => {
            log('MongoDB client closed because:', err);
        });
        connection.on('error', (err) => {
            log('MongoDB client error:', err);
        });
        connection.on('fullsetup', () => {
            log('MongoDB full setup complete');
        });
        connection.on('parseError', (err) => {
            log('MongoDB parse error:', err);
        });
        connection.on('reconnect', () => {
            log('MongoDB reconnected');
        });
        connection.on('timeout', (err) => {
            log('MongoDB client timed out:', err);
        });
    });
}
exports.connectToDb = connectToDb;
/**
 * Disconnects the existing database client.
 */
function disconnectFromDb() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!client)
            return;
        yield client.close();
    });
}
exports.disconnectFromDb = disconnectFromDb;
/**
 * Checks if the database client is established.
 *
 * @return `true` if connected, `false` otherwise.
 */
function isDbConnected() {
    if (!client)
        return false;
    if (!client.isConnected())
        return false;
    return true;
}
exports.isDbConnected = isDbConnected;
/**
 * Configures the ODM.
 *
 * @param options - Configuration options.
 */
function configureDb(options) {
    config = options;
    collections = {};
}
exports.configureDb = configureDb;
/**
 * Gets the database instance from the client.
 *
 * @return The database instance.
 */
function getDbInstance() {
    return __awaiter(this, void 0, void 0, function* () {
        if (client)
            return client.db(config.name);
        log('There is no MongoDB client, establishing one now...');
        yield connectToDb();
        return getDbInstance();
    });
}
exports.getDbInstance = getDbInstance;
/**
 * Gets a model class by its name or collection name.
 *
 * @param modelOrCollectionName - Model or collection name.
 *
 * @return The model class.
 */
function getModel(modelOrCollectionName) {
    const models = config.models;
    assert_1.default(!is_1.default.nullOrUndefined(models), new Error('You must register models using the configureDb() function'));
    if (models.hasOwnProperty(modelOrCollectionName))
        return models[modelOrCollectionName];
    for (const key in models) {
        if (!models.hasOwnProperty(key))
            continue;
        const ModelClass = models[key];
        if (ModelClass.schema.collection === modelOrCollectionName)
            return ModelClass;
    }
    throw new Error('No model found for given model/collection name');
}
exports.getModel = getModel;
/**
 * Gets the MongoDB collection associated with a model or collection name and
 * ensures the indexes defined in its schema.
 *
 * @param modelOrCollectionName - The model or collection name.
 *
 * @return The MongoDB collection.
 *
 * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html}
 */
function getCollection(modelOrCollectionName) {
    return __awaiter(this, void 0, void 0, function* () {
        const models = config.models;
        assert_1.default(!is_1.default.nullOrUndefined(models), new Error('You must register models using the configureDb() function'));
        if (!is_1.default.nullOrUndefined(collections[modelOrCollectionName])) {
            return collections[modelOrCollectionName];
        }
        let ModelClass;
        for (const key in models) {
            if (!models.hasOwnProperty(key))
                continue;
            if ((models[key].schema.model === modelOrCollectionName) || (models[key].schema.collection === modelOrCollectionName)) {
                ModelClass = models[key];
                break;
            }
        }
        assert_1.default(!is_1.default.nullOrUndefined(ModelClass), 'Unable to find collection with given model or collection name, is the model registered?');
        const dbInstance = yield getDbInstance();
        const schema = ModelClass.schema;
        const collection = yield dbInstance.collection(schema.collection);
        // Ensure schema indexes.
        if (schema.indexes) {
            for (const index of schema.indexes) {
                const spec = index.spec || {};
                const options = index.options || {};
                if (!options.hasOwnProperty('background')) {
                    options.background = true;
                }
                yield collection.createIndex(spec, options);
            }
        }
        collections[schema.model] = collection;
        collections[schema.collection] = collection;
        return collection;
    });
}
exports.getCollection = getCollection;
var Aggregation_1 = require("./core/Aggregation");
exports.Aggregation = Aggregation_1.default;
__export(require("./types"));
var sanitizeDocument_1 = require("./utils/sanitizeDocument");
exports.sanitizeDocument = sanitizeDocument_1.default;
var sanitizeQuery_1 = require("./utils/sanitizeQuery");
exports.sanitizeQuery = sanitizeQuery_1.default;
var validateFieldValue_1 = require("./utils/validateFieldValue");
exports.validateFieldValue = validateFieldValue_1.default;
//# sourceMappingURL=index.js.map