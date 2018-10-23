import assert from 'assert';
import { describe, it } from 'mocha';
import { ObjectID } from 'mongodb';
import { Schema } from '../types';
import sanitizeQuery from './sanitizeQuery';

const ExampleSchema: Schema = {
  model: 'Example',
  collection: 'examples',
  timestamps: false,
  fields: {
    foo: {
      type: String,
    },
  },
};

describe('utils/sanitizeQuery', () => {
  it('can generate valid queries based on an Object ID string', () => {
    const objectId = new ObjectID().toHexString();

    assert.deepStrictEqual(sanitizeQuery(ExampleSchema, objectId), { _id: objectId });
  });

  it('can generate valid queries based on an Object ID', () => {
    const objectId = new ObjectID().toHexString();

    assert.deepStrictEqual(sanitizeQuery(ExampleSchema, objectId), { _id: objectId });
  });

  it('can generate valid queries removing extraneous fields', () => {
    const objectId = new ObjectID().toHexString();

    const expected = {
      _id: objectId,
      foo: 'foo',
    };

    const actual = sanitizeQuery(ExampleSchema, {
      ...expected,
      bar: 'bar',
    });

    assert.deepStrictEqual(actual, expected);
  });

  it('can generate valid queries while keeping extraneous fields', () => {
    const objectId = new ObjectID();

    const expected = {
      _id: objectId,
      foo: 'foo',
    };

    const actual = sanitizeQuery(ExampleSchema, {
      ...expected,
    }, {
      strict: false,
    });

    assert.deepStrictEqual(actual, expected);
  });
});
