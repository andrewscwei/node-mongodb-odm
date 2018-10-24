import { ObjectID } from 'mongodb';
import Model from '../../core/Model';
import { Document, Schema } from '../../types';

export interface BarDocument extends Document {
  aBar: ObjectID;
  aString: string;
  aDate: Date;
  anObject: {
    aString: string;
    aNumber: number;
    aBoolean: boolean;
  };
  aNumber: number;
  aBoolean: boolean;
}

export const BarSchema: Schema<BarDocument> = {
  model: 'Bar',
  collection: 'bars',
  cascade: ['Foo'],
  fields: {
    aBar: {
      type: ObjectID,
      ref: 'Bar',
      required: true,
    },
    aString: {
      type: String,
      required: true,
      validate: 100,
    },
    aDate: {
      type: Date,
      required: true,
      default: () => (new Date()),
    },
    anObject: {
      type: {
        aString: { type: String },
        aNumber: { type: Number },
        aBoolean: { type: Boolean },
      },
    },
    aNumber: {
      type: Number,
      required: true,
      default: 100,
      validate: (value: number) => ((value >= 0 && value <= 1000)),
      random: () => (Math.floor(Math.random() * 1000) + 0),
    },
    aBoolean: {
      type: Boolean,
      default: false,
    },
  },
  indexes: [{ spec: { source: 1 } }, { spec: { geo: '2dsphere' } }],
};

export default class Bar extends Model {
  static schema = BarSchema;
}
