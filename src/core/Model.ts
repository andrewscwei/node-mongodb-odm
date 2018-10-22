/**
 * @file This is a static, abstract model that provides ORM for a single MongoDB
 *       collection. Every other model must inherit this class. It sets up the
 *       ground work for basic CRUD operations, event triggers, query
 *       validations, etc. All returned documents are native JSON objects.
 */

import debug from 'debug';
import { Collection } from 'mongodb';
import * as db from '../';
import { Schema } from '../types';

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
}

export default Model;
