import assert from 'assert';
import Faker from 'faker';
import { describe, it } from 'mocha';
import Model from '../core/Model';
import { DocumentFragment, Schema } from '../types';
import sanitizeDocument from '../utils/sanitizeDocument';

describe('utils/sanitizeDocument', () => {
  it('can remove extraneous fields from a document fragment', () => {
    const t: any = {
      aString: 'foo',
      extraneous: 'foo',
    };

    const o = sanitizeDocument<BazProps>(Baz.schema, t);

    assert(!o.hasOwnProperty('extraneous'));
  });

  it('can remove undefined fields in a document fragment', () => {
    const t: DocumentFragment<BazProps> = {
      aString: 'foo',
      aNumber: undefined,
    };

    const o = sanitizeDocument<BazProps>(Baz.schema, t);

    assert(!o.aNumber);
  });
});

interface BazProps {
  aString: string;
  aNumber?: number;
  aBoolean?: boolean;
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
