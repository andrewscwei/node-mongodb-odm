import { ObjectID } from 'mongodb';
import Model from '../../core/Model';
import { Document, Schema } from '../../types';

export interface FooDocument extends Document {
  aString: string;
  aNumber: number;
  aBar: ObjectID;
  aFoo: ObjectID;
}

export const FooSchema: Schema<FooDocument> = {
  model: 'Foo',
  collection: 'foos',
  timestamps: true,
  fields: {
    aString: {
      type: String,
      required: true,
      format: (value: string): string => (value.trim()),
    },
    aNumber: {
      type: Number,
      required: true,
      default: 100,
      validate: (value: number) => ((value >= 0 && value <= 1000)),
      random: () => (Math.floor(Math.random() * 1000) + 0),
    },
    aBar: {
      type: ObjectID,
      ref: 'Bar',
      required: true,
    },
    aFoo: {
      type: ObjectID,
      ref: 'Foo',
    },
  },
  indexes: [{
    spec: { label: 1 }, options: { unique: true },
  }],
};

export default class Foo extends Model {
  static schema = FooSchema;
}
