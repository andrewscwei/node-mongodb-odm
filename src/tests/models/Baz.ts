import faker from 'faker';
import Model from '../../core/Model';
import { Document, Schema } from '../../types';

export interface BazDocument extends Document {
  aString: string;
  aNumber: number;
  aBoolean: boolean;
  aFormattedString: string;
  anEncryptedString: string;
}

export const BazSchema: Schema<BazDocument> = {
  model: 'Baz',
  collection: 'bazs',
  fields: {
    aString: { type: String, required: true, random: () => faker.name.firstName() },
    aNumber: { type: Number, default: () => Math.random() },
    aBoolean: { type: Boolean, default: true },
    aFormattedString: { type: String, format: (v: string) => v.toUpperCase() },
    anEncryptedString: { type: String, encrypted: true },
  },
};

export default class Baz extends Model {
  static schema = BazSchema;
}
