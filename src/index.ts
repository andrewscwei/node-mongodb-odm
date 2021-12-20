/** @license node-mongodb-odm
 * © Andrew Wei
 * This source code is licensed under the MIT license found in the LICENSE file in the root
 * directory of this source tree.
 */

/**
 * @file Database configuration file. This file exports methods to interact with the MongoClient
 * instance.
 */

import { Collection } from 'mongodb'
import { Connection, ConnectionConfiguration, Model } from './core'
import { AnyDocument } from './types'

const debug = require('debug')('mongodb-odm')

/**
 * Global MongoDB connection.
 */
let globalConnection: Connection | undefined

// Be sure to disconnect the database if the app terminates.
process.on('SIGINT', async () => {
  if (!globalConnection) return
  await globalConnection.disconnect?.()
  debug('Handling SIGINT error...', 'OK', 'MongoDB client disconnected due to app termination')

  process.exit(0)
})

/**
 * Configures the ODM.
 *
 * @param options - Configuration options.
 */
export function configureDb(options: ConnectionConfiguration) {
  debug('Configuring ODM... OK', options)
  globalConnection = new Connection(options)
}

/**
 * Gets the global database connection.
 *
 * @returns The database connection.
 */
export function getDbConnection(): Connection | undefined {
  if (globalConnection) return globalConnection
  debug('No MongoDB connection, did you forget to call `configureDb`?')
  return undefined
}

/**
 * Gets a model class by its name or collection name.
 *
 * @param modelOrCollectionName - Model or collection name.
 *
 * @returns The model class.
 *
 * @throws {Error} There is no active db connection.
 */
export function getModel(modelOrCollectionName: string): ReturnType<typeof Model> {
  if (!globalConnection) throw new Error('There is no active db connection')
  return globalConnection.getModel(modelOrCollectionName)
}

/**
 * Gets the MongoDB collection associated with a model or collection name and ensures the indexes
 * defined in its schema.
 *
 * @param modelOrCollectionName - The model or collection name.
 *
 * @returns The MongoDB collection.
 *
 * @see {@link https://mongodb.github.io/node-mongodb-native/4.2/classes/Collection.html}
 *
 * @throws {Error} There is no active db connection.
 */
export async function getCollection<T extends AnyDocument = AnyDocument>(modelOrCollectionName: string): Promise<Collection<T>> {
  if (!globalConnection) throw new Error('There is no active db connection')
  return globalConnection.getCollection(modelOrCollectionName)
}

export { ObjectId } from 'mongodb'
export * from './core'
export * from './types'
export * from './utils'
