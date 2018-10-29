import Faker from 'faker';
import Model from '../../core/Model';
import { Schema } from '../../types';

export interface BazProps {
  aString: string;
  aNumber: number;
  aBoolean: boolean;
  aFormattedString?: string;
  anEncryptedString?: string;
}

export const BazSchema: Schema<BazProps> = {
  model: 'Baz',
  collection: 'bazs',
  allowUpsert: true,
  fields: {
    aString: { type: String, required: true, random: () => Faker.random.alphaNumeric(10) },
    aNumber: { type: Number, default: () => Faker.random.number() },
    aBoolean: { type: Boolean, default: true },
    aFormattedString: { type: String, format: (v: string) => v.toUpperCase() },
    anEncryptedString: { type: String, encrypted: true },
  },
  indexes: [{
    spec: { aString: 1 },
  }],
};

export default class Baz extends Model {
  static schema = BazSchema;
}
