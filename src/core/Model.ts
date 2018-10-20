/**
 * @file This is a static, abstract model that provides ORM for a single MongoDB
 *       collection. Every other model must inherit this class. It sets up the
 *       ground work for basic CRUD operations, event triggers, query
 *       validations, etc. All returned documents are native JSON objects.
 */

import debug from 'debug';
import Schema from './Schema';

const log = debug('mongodb-odm:model');

abstract class Model {
  static schema: Schema;
}

export default Model;
