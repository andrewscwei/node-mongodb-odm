/**
 * @file Database configuration file. This file exports methods to interact with
 *       the MongoClient instance.
 */
import { Collection, Db, ObjectID } from 'mongodb';
import Model from './core/Model';
export interface Configuration {
    host: string;
    name: string;
    username?: string;
    password?: string;
    models?: {
        [modelName: string]: typeof Model;
    };
}
/**
 * Establishes a new connection to the database based on the initialized
 * configuration. If there already exists one, this method does nothing.
 */
export declare function connectToDb(): Promise<void>;
/**
 * Disconnects the existing database client.
 */
export declare function disconnectFromDb(): Promise<void>;
/**
 * Checks if the database client is established.
 *
 * @return `true` if connected, `false` otherwise.
 */
export declare function isDbConnected(): boolean;
/**
 * Configures the ODM.
 *
 * @param options - Configuration options.
 */
export declare function configureDb(options: Configuration): void;
/**
 * Gets the database instance from the client.
 *
 * @return The database instance.
 */
export declare function getDbInstance(): Promise<Db>;
/**
 * Gets a model class by its name or collection name.
 *
 * @param modelOrCollectionName - Model or collection name.
 *
 * @return The model class.
 */
export declare function getModel(modelOrCollectionName: string): typeof Model;
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
export declare function getCollection(modelOrCollectionName: string): Promise<Collection>;
export { default as Aggregation } from './core/Aggregation';
export * from './types';
export { default as sanitizeDocument } from './utils/sanitizeDocument';
export { default as sanitizeQuery } from './utils/sanitizeQuery';
export { default as validateFieldValue } from './utils/validateFieldValue';
export { Model };
export { ObjectID };
