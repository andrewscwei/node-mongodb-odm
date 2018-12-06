/**
 * @file Database configuration file. This file exports methods to interact with
 *       the MongoClient instance.
 */
import { Collection, Db, ObjectID } from 'mongodb';
import Model from './build/core/Model';
export interface Configuration {
    host: string;
    name: string;
    replicaSet?: string;
    username?: string;
    password?: string;
    models?: {
        [modelName: string]: any;
    };
}
/**
 * Establishes a new connection to the database based on the initialized
 * configuration. If there already exists one, this method does nothing.
 *
 * @throws {Error} ODM is not configured.
 */
export declare function connectToDb(): Promise<void>;
/**
 * Disconnects the existing database client.
 */
export declare function disconnectFromDb(): Promise<void>;
/**
 * Checks if the database client is established.
 *
 * @returns `true` if connected, `false` otherwise.
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
 * @returns The database instance.
 */
export declare function getDbInstance(): Promise<Db>;
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
export declare function getModel(modelOrCollectionName: string): ReturnType<typeof Model>;
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
export declare function getCollection(modelOrCollectionName: string): Promise<Collection>;
export { default as Aggregation } from './build/core/Aggregation';
export * from './build/types';
export { default as sanitizeDocument } from './build/utils/sanitizeDocument';
export { default as sanitizeQuery } from './build/utils/sanitizeQuery';
export { default as validateFieldValue } from './build/utils/validateFieldValue';
export { Model };
export { ObjectID };