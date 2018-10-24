import Model from '../../core/Model';
import { Document, Schema } from '../../types';

export interface BazDocument extends Document {
  aString: string;
  aNumber?: number;
  aBoolean?: boolean;
  aFormattedString?: string;
}

export const BazSchema: Schema<BazDocument> = {
  model: 'Baz',
  collection: 'bazs',
  fields: {
    aString: { type: String, required: true },
    aNumber: { type: Number, default: () => Math.random() },
    aBoolean: { type: Boolean, default: true },
    aFormattedString: { type: String, format: (v: string) => v.toUpperCase() },
  },
};

export default class Baz extends Model {
  static schema = BazSchema;
}
