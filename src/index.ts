/**
 * @file Database configuration file. This file exports methods to interact with
 *       the MongoClient instance.
 */

import is from '@sindresorhus/is';
import assert from 'assert';
import debug from 'debug';
import { Collection, Db, MongoClient, MongoError } from 'mongodb';
import Model from './core/Model';

const log = debug('mongodb-odm');

export interface Configuration {
  host: string;
  name: string;
  username?: string;
  password?: string;
  models?: { [modelName: string]: typeof Model};
}

/**
 * Global MongoDB client instance.
 */
let client: MongoClient;

/**
 * Global db configuration options.
 */
let options: Configuration;

/**
 * Collection lookup dictionary.
 */
const collections: { [collectionName: string]: Collection } = {};

// Be sure to disconnect the database if the app terminates.
process.on('SIGINT', async () => {
  if (client) {
    await disconnectFromDb();
    log('MongoDB client disconnected due to app termination');
  }

  process.exit(0);
});

/**
 * Establishes a new connection to the database based on the initialized
 * configuration. If there already exists one, this method does nothing.
 */
async function connectToDb(): Promise<void> {
  if (isDbConnected()) return;

  if (!options) throw new Error('You must configure connection options by calling #configureDb()');

  // Resolve the authentication string.
  const authentication = (options.username && options.password) ? `${options.username}:${options.password}` : undefined;

  // Database client URL.
  const url = `mongodb://${authentication ? `${authentication}@` : ''}${options.host}/${options.name}`;

  client = await MongoClient.connect(url, {
    useNewUrlParser: true,
  });

  const connection = client.db(options.name);

  log('MongoDB client is open:', url);

  connection.on('authenticated', () => {
    log('MongoDB servers authenticated');
  });

  connection.on('close', (err: MongoError) => {
    log('MongoDB client closed because:', err);
  });

  connection.on('error', (err: MongoError) => {
    log('MongoDB client error:', err);
  });

  connection.on('fullsetup', () => {
    log('MongoDB full setup complete');
  });

  connection.on('parseError', (err: MongoError) => {
    log('MongoDB parse error:', err);
  });

  connection.on('reconnect', () => {
    log('MongoDB reconnected');
  });

  connection.on('timeout', (err: MongoError) => {
    log('MongoDB client timed out:', err);
  });
}

/**
 * Disconnects the existing database client.
 */
async function disconnectFromDb(): Promise<void> {
  if (!client) return;
  await client.close();
}

/**
 * Checks if the database client is established.
 *
 * @return `true` if connected, `false` otherwise.
 */
function isDbConnected(): boolean {
  if (!client) return false;
  if (!client.isConnected) return false;
  return true;
}

/**
 * Configures the ODM.
 *
 * @param descriptor - Configuration descriptor.
 */
export function configureDb(descriptor: Configuration) {
  options = descriptor;
}

/**
 * Gets the database instance from the client.
 *
 * @return The database instance.
 */
export async function getDbInstance(): Promise<Db> {
  if (client) return client.db(options.name);

  log('There is no MongoDB client, establishing one now...');

  await connectToDb();

  return getDbInstance();
}

/**
 * Gets a model class by its name or collection name.
 *
 * @param modelOrCollectionName - Model or collection name.
 *
 * @return The model class.
 */
export function getModel(modelOrCollectionName: string): typeof Model {
  const models = options.models!;

  assert(!is.nullOrUndefined(models), new Error('You must register models using the configureDb() function'));

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
 * @return The MongoDB collection.
 *
 * @see {@link http://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html}
 */
export async function getCollection(modelOrCollectionName: string): Promise<Collection> {
  const models = options.models!;

  assert(!is.nullOrUndefined(models), new Error('You must register models using the configureDb() function'));

  if (!is.nullOrUndefined(collections[modelOrCollectionName])) {
    return collections[modelOrCollectionName];
  }

  let ModelClass: typeof Model | undefined;

  for (const key in models) {
    if (!models.hasOwnProperty(key)) continue;

    if ((models[key].schema.model === modelOrCollectionName) || (models[key].schema.collection === modelOrCollectionName)) {
      ModelClass = models[key];
      break;
    }
  }

  assert(!is.nullOrUndefined(ModelClass), 'Unable to find collection with given model or collection name, is the model registered?');

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

export { default as sanitizeDocument } from './utils/sanitizeDocument';
export { default as sanitizeQuery } from './utils/sanitizeQuery';
export { default as validateFieldValue } from './utils/validateFieldValue';
export { Model };
