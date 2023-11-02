import useDebug from 'debug'
import { MongoClient, type Collection, type Db } from 'mongodb'
import { type AnyDocument } from '../types/index.js'
import { type modelFactory } from './modelFactory.js'

const debug = useDebug('mongodb-odm:connection')

export type ConnectionConfiguration = {
  host: string
  name: string
  replicaSet?: string
  username?: string
  password?: string
  models?: Record<string, any>
}

export class Connection {
  /**
   * Local database connection configuration options.
   */
  config: ConnectionConfiguration

  /**
   * Local MongoDB client instance.
   */
  client?: MongoClient

  /**
   * Collection lookup dictionary.
   */
  collections: Record<string, Collection<any>>

  /**
   * Creates a new {@link Connection} instance with the provided configuration
   * options.
   *
   * @param config The configuration options.
   */
  constructor(config: ConnectionConfiguration) {
    this.config = config
    this.collections = {}
  }

  /**
   * Gets the database instance from the client.
   *
   * @returns The database instance.
   */
  async getDbInstance(): Promise<Db> {
    if (this.client) return this.client.db(this.config.name)

    debug('No MongoDB client, begin establishing connection')

    await this.connect()

    return this.getDbInstance()
  }

  /**
   * Checks if a client connection to the database is established.
   *
   * @returns `true` if connected, `false` otherwise.
   */
  isConnected(): boolean {
    if (!this.client) return false

    return true
  }

  /**
   * Establishes a new connection to the database based on the initialized
   * configuration. If there already exists one, this method does nothing.
   *
   * @throws {Error} When unable to establish MongoDB connection.
   */
  async connect(): Promise<void> {
    if (this.isConnected()) return

    // Resolve the authentication string.
    const authentication = this.config.username && this.config.password ? `${this.config.username}:${this.config.password}` : undefined

    // Database client URL.
    const url = `mongodb://${authentication ? `${authentication}@` : ''}${this.config.host}/${this.config.name}${this.config.replicaSet ? `?replicaSet=${this.config.replicaSet}` : ''}`

    try {
      this.client = await MongoClient.connect(url, {

      })

      debug('Establishing MongoDB client connection...', 'OK', url)
    }
    catch (err) {
      debug('Establishing MongoDB client connection...', 'ERR', err)

      throw err
    }
  }

  /**
   * Disconnects the existing database client.
   */
  async disconnect(): Promise<void> {
    if (!this.client) return

    await this.client.close()

    this.client = undefined

    debug('Closing MongoDB client connection...', 'OK')
  }

  /**
   * Gets the MongoDB collection associated with a model or collection name and
   * ensures the indexes defined in its schema.
   *
   * @param modelOrCollectionName The model or collection name.
   *
   * @returns The MongoDB collection.
   *
   * @see
   * {@link https://mongodb.github.io/node-mongodb-native/4.2/classes/Collection.html}
   *
   * @throws {Error} There are no models registered.
   * @throws {Error} Unable to find the model associated with the model or
   *                 collection name.
   */
  async getCollection<T extends AnyDocument = AnyDocument>(modelOrCollectionName: string): Promise<Collection<T>> {
    if (this.collections[modelOrCollectionName]) return this.collections[modelOrCollectionName]

    const ModelClass = this.getModel(modelOrCollectionName)
    const schema = ModelClass.schema
    const dbInstance = await this.getDbInstance()
    const collection = dbInstance.collection<T>(schema.collection)

    // Ensure schema indexes.
    if (schema.indexes) {
      for (const index of schema.indexes) {
        const spec = index.spec || {}
        const options = index.options || {}

        if (!{}.hasOwnProperty.call(options, 'background')) {
          options.background = true
        }

        await collection.createIndex(spec, options)
      }
    }

    this.collections[schema.model] = collection
    this.collections[schema.collection] = collection

    return collection
  }

  /**
   * Gets a model class by its name or collection name.
   *
   * @param modelOrCollectionName Model or collection name.
   *
   * @returns The model class.
   *
   * @throws {Error} There are no models registered with the ODM.
   * @throws {Error} No model found with the provided name.
   */
  getModel(modelOrCollectionName: string): ReturnType<typeof modelFactory> {
    const models = this.config.models

    if (!models) throw new Error('There are no models registered in the ODM registry')

    if ({}.hasOwnProperty.call(models, modelOrCollectionName)) return models[modelOrCollectionName]

    for (const key in models) {
      if (!{}.hasOwnProperty.call(models, key)) continue

      const ModelClass = models[key]

      if (ModelClass.schema.collection === modelOrCollectionName) return ModelClass
    }

    throw new Error(`No model found in the ODM registry for model/collection name "${modelOrCollectionName}"`)
  }
}
