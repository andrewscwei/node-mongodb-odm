import Faker from 'faker';
import Model from '../core/Model';
import { Schema } from '../types';

export interface BazProps {
  aString: string;
  aNumber?: number;
  aBoolean?: boolean;
  aFormattedString?: string;
  anEncryptedString?: string;
}

export const BazSchema: Schema<BazProps> = {
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

export default class Baz extends Model(BazSchema) {
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
