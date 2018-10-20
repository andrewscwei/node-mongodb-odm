import Model from './Model';
import Schema from './Schema';

/**
 * Class decorator intended for ODM models that injects a `schema` static
 * property into the class.
 *
 * @param schema - The schema.
 */
export default function withSchema(schema: Schema) {
  return <T extends (new (...args: any[]) => Model)>(constructor: T) => {
    return class extends constructor {
      static schema = schema;
    };
  };
}
