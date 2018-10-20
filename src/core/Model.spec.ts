import assert from 'assert';
import { describe, it } from 'mocha';
import Model from './Model';
import Schema from './Schema';
import withSchema from './withSchema';

describe('model', () => {
  it('can extend the base model class with a schema', () => {
    const ExampleSchema: Schema = {
      model: 'Example',
      collection: 'examples',
      timestamp: true,
      fields: {},
    };

    @withSchema(ExampleSchema)
    class Example extends Model {

    }

    assert(Example.schema === ExampleSchema);
  });
});
