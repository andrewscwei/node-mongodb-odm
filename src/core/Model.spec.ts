import { describe, it } from 'mocha';
import { Schema } from '../types';
import Model from './Model';
import withSchema from './withSchema';
import * as db from '../';

interface Example {
  a: string;
  b: string;
  c: number;
  d: boolean;
}

const ExampleSchema: Schema<Example> = {
  model: 'Example',
  collection: 'examples',
  fields: {
    a: { type: String },
    b: { type: String },
    c: { type: Number },
    d: { type: Boolean },
  },
};

@withSchema(ExampleSchema)
class ExampleModel extends Model {

}

db.configure({
  host: 'localhost:27017',
  name: 'mongodb_odm_test',
});

describe('core/Model', () => {
  before(async () => {
    await (await db.getInstance()).dropDatabase();
  });

  it('can create a new document', async () => {
    const doc = await ExampleModel.insertOne({
      a: 'foo',
      b: 'bar',
    });

    console.log(doc);
  });
});
