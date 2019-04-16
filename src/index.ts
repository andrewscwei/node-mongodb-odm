/**
 * @file Database configuration file. This file exports methods to interact with
 *       the MongoClient instance.
 */

import is from '@sindresorhus/is';
import { Collection, Db, MongoClient, MongoError, ObjectID } from 'mongodb';
import Model from './core/Model';

const debug = require('debug')('mongodb-odm');

export interface Configuration {
  host: string;
  name: string;
  replicaSet?: string;
  username?: string;
  password?: string;
  models?: { [modelName: string]: any };
}

/**
 * Global MongoDB client instance.
 */
let client: MongoClient;

/**
 * Global db configuration options.
 */
let config: Configuration;

/**
 * Collection lookup dictionary.
 */
let collections: { [collectionName: string]: Collection } = {};

// Be sure to disconnect the database if the app terminates.
process.on('SIGINT', async () => {
  if (client) {
    await disconnectFromDb();
    debug('Handling SIGINT error...', 'OK', 'MongoDB client disconnected due to app termination');
  }

  process.exit(0);
});

/**
 * Establishes a new connection to the database based on the initialized
 * configuration. If there already exists one, this method does nothing.
 *
 * @throws {Error} ODM is not configured.
 */
export async function connectToDb(): Promise<void> {
  if (isDbConnected()) return;

  if (!config) throw new Error('You must configure connection options by calling #configureDb()');

  // Resolve the authentication string.
  const authentication = (config.username && config.password) ? `${config.username}:${config.password}` : undefined;

  // Database client URL.
  const url = `mongodb://${authentication ? `${authentication}@` : ''}${config.host}/${config.name}${config.replicaSet ? `?replicaSet=${config.replicaSet}` : ''}`;

  client = await MongoClient.connect(url, {
    useNewUrlParser: true,
  });

  const connection = client.db(config.name);

  debug('Establishing MongoDB client connection...', 'OK', url);

  connection.on('authenticated', () => {
    debug('Authenticating MongoDB servers...', 'OK');
  });

  connection.on('close', (err: MongoError) => {
    debug('Terminating MongoDB client...', 'OK', err);
  });

  connection.on('error', (err: MongoError) => {
    debug('Handling client error...', 'OK', err);
  });

  connection.on('fullsetup', () => {
    debug('Completing full setup of connection...', 'OK');
  });

  connection.on('parseError', (err: MongoError) => {
    debug('Handling parse error...', 'OK', err);
  });

  connection.on('reconnect', () => {
    debug('Reconnecting to MongoDB client...', 'OK');
  });

  connection.on('timeout', (err: MongoError) => {
    debug('Receiving MongoDB client timeout...', 'OK', err);
  });
}

/**
 * Disconnects the existing database client.
 */
export async function disconnectFromDb(): Promise<void> {
  if (!client) return;
  await client.close();
}

/**
 * Checks if the database client is established.
 *
 * @returns `true` if connected, `false` otherwise.
 */
export function isDbConnected(): boolean {
  if (!client) return false;
  if (!client.isConnected()) return false;
  return true;
}

/**
 * Configures the ODM.
 *
 * @param options - Configuration options.
 */
export function configureDb(options: Configuration) {
  config = options;
  collections = {};
}

/**
 * Gets the database instance from the client.
 *
 * @returns The database instance.
 */
export async function getDbInstance(): Promise<Db> {
  if (client) return client.db(config.name);

  debug('No MongoDB client, reinitiating connection...', 'OK');

  await connectToDb();

  return getDbInstance();
}

/**
 * Gets a model class by its name or collection name.
 *
 * @param modelOrCollectionName - Model or collection name.
 *
 * @returns The model class.
 *
 * @throws {Error} There are no models registered with the ODM.
 * @throws {Error} No model found with the provided name.
 */
export function getModel(modelOrCollectionName: string): ReturnType<typeof Model> {
  const models = config.models;

  if (is.nullOrUndefined(models)) throw new Error('You must register models using the configureDb() function');

  if (models.hasOwnProperty(modelOrCollectionName)) return models[modelOrCollectionName];

  for (const key in models) {
    if (!models.hasOwnProperty(key)) continue;

    const ModelClass = models[key];

    if (ModelClass.schema.collection === modelOrCollectionName) return ModelClass;
  }

  throw new Error('No model found for given model/collection name');
}

/**
 * Gets the MongoDB collection associated with a model or collection name and
 * ensures the indexes defined in its schema.
 *
 * @param modelOrCollectionName - The model or collection name.
 *
 * @returns The MongoDB collection.
 *
 * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html}
 */
export async function getCollection(modelOrCollectionName: string): Promise<Collection> {
  const models = config.models!;

  if (is.nullOrUndefined(models)) throw new Error('You must register models using the configureDb() function');

  // TODO: Indexes are lost somehow, comment this out temporarily.
  // if (!is.nullOrUndefined(collections[modelOrCollectionName])) {
  //   return collections[modelOrCollectionName];
  // }

  let ModelClass: ReturnType<typeof Model> | undefined;

  for (const key in models) {
    if (!models.hasOwnProperty(key)) continue;

    if ((models[key].schema.model === modelOrCollectionName) || (models[key].schema.collection === modelOrCollectionName)) {
      ModelClass = models[key];
      break;
    }
  }

  if (is.nullOrUndefined(ModelClass)) throw new Error('Unable to find collection with given model or collection name, is the model registered?');

  const dbInstance = await getDbInstance();
  const schema = ModelClass!.schema;
  const collection = await dbInstance.collection(schema.collection);

  // Ensure schema indexes.
  if (schema.indexes) {
    for (const index of schema.indexes) {
      const spec = index.spec || {};
      const options = index.options || {};

      if (!options.hasOwnProperty('background')) {
        options.background = true;
      }

      await collection.createIndex(spec, options);
    }
  }

  collections[schema.model] = collection;
  collections[schema.collection] = collection;

  return collection;
}

export { default as Aggregation } from './core/Aggregation';
export * from './types';
export { default as getFieldSpecsByKey } from './utils/getFieldSpecsByKey';
export { default as mapValuesToObjectIDs } from './utils/mapValuesToObjectIDs';
export { default as sanitizeDocument } from './utils/sanitizeDocument';
export { default as sanitizeQuery } from './utils/sanitizeQuery';
export { default as validateFieldValue } from './utils/validateFieldValue';
export { Model };
export { ObjectID };
