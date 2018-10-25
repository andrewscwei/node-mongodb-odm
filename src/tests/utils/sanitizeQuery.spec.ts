import assert from 'assert';
import { describe, it } from 'mocha';
import { ObjectID } from 'mongodb';
import { Document } from '../../types';
import sanitizeQuery from '../../utils/sanitizeQuery';
import Baz, { BazProps } from '../models/Baz';

describe('utils/sanitizeQuery', () => {
  it('can generate valid queries based on an Object ID string', () => {
    const objectId = new ObjectID();

    const actual = sanitizeQuery<BazProps>(Baz.schema, objectId.toHexString());
    const expected = { _id: objectId };

    assert.deepStrictEqual(Object.keys(actual), Object.keys(expected));
    assert(expected._id.equals(actual._id!));
  });

  it('can generate valid queries based on an Object ID', () => {
    const objectId = new ObjectID();

    const actual = sanitizeQuery<BazProps>(Baz.schema, objectId);
    const expected = { _id: objectId };

    assert.deepStrictEqual(Object.keys(actual), Object.keys(expected));
    assert(expected._id.equals(actual._id!));
  });

  it('can generate valid queries removing extraneous fields', () => {
    const objectId = new ObjectID();

    const expected: Document<BazProps> = {
      _id: objectId,
      aString: 'baz',
    };

    const actual = sanitizeQuery<BazProps>(Baz.schema, {
      ...expected,
      anExtraneousField: 'baz',
    });

    assert.deepStrictEqual(Object.keys(actual), Object.keys(expected));
  });

  it('can generate valid queries while keeping extraneous fields', () => {
    const objectId = new ObjectID();

    const expected: Document<BazProps> = {
      _id: objectId,
      aString: 'baz',
    };

    const actual = sanitizeQuery<BazProps>(Baz.schema, {
      ...expected,
      anExtraneousField: 'baz',
    }, {
      strict: false,
    });

    assert(actual.anExtraneousField === 'baz');
  });
});
