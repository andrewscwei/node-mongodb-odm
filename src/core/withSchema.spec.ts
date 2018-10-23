import assert from 'assert';
import { describe, it } from 'mocha';
import { Schema } from '../types';
import Model from './Model';
import withSchema from './withSchema';

describe('core/withSchema', () => {
  it('can inject a schema into a model class', () => {
    const ExampleSchema: Schema = {
      model: 'Example',
      collection: 'examples',
      timestamps: true,
      fields: {},
    };

    @withSchema(ExampleSchema)
    class Example extends Model {

    }

    assert(Example.schema === ExampleSchema);
  });
});
