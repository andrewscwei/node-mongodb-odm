import assert from 'assert';
import Faker from 'faker';
import { describe, it } from 'mocha';
import Model from '../core/Model';
import { Schema } from '../types';
import sanitizeDocument from '../utils/sanitizeDocument';

describe('utils/sanitizeDocument', () => {
  it('can remove extraneous fields from a document fragment', () => {
    const t: any = {
      aString: 'foo',
      extraneous: 'foo',
    };

    const o = sanitizeDocument(Baz.schema, t);

    assert(o.hasOwnProperty('aString'));
    assert(!o.hasOwnProperty('extraneous'));
  });

  it('can remove `undefined` and `null` fields in a document fragment', () => {
    const t: any = {
      aNumber: undefined,
      aBoolean: null,
    };

    const o = sanitizeDocument(Baz.schema, t);

    assert(!o.hasOwnProperty('aNumber'));
    assert(!o.hasOwnProperty('aBoolean'));
  });

  it('can account for fields in dot notation format', () => {
    const t: any = {
      'anObject.a': 'bar',
    };

    const o = sanitizeDocument(Baz.schema, t, { accountForDotNotation: true });

    assert(o.hasOwnProperty('anObject.a'));
  });
});

interface BazProps {
  aString: string;
  aNumber?: number;
  aBoolean?: boolean;
  anObject?: { a?: string; b?: string; };
  aFormattedString?: string;
  anEncryptedString?: string;
}

const BazSchema: Schema<BazProps> = {
  model: 'Baz',
  collection: 'bazs',
  allowUpserts: true,
  fields: {
    aString: { type: String, required: true },
    aNumber: { type: Number },
    aBoolean: { type: Boolean },
    anObject: { type: { a: { type: String }, b: { type: String } } },
    aFormattedString: { type: String },
    anEncryptedString: { type: String, encrypted: true },
  },
  indexes: [{
    spec: { aString: 1 },
  }],
};

class Baz extends Model(BazSchema) {
  static randomProps = {
    aString: () => Faker.random.alphaNumeric(10),
  };

  static defaultProps = {
    aNumber: () => Faker.random.number(),
    aBoolean: true,
  };

  static formatProps = {
    aFormattedString: (v: string) => v.toUpperCase(),
  };
}
