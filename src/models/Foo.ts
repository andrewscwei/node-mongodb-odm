import { ObjectID } from 'mongodb';
import Model from '../core/Model';
import { Schema } from '../types';

export interface FooProps {
  aString: string;
  aNumber: number;
  aBar: ObjectID;
  aFoo?: ObjectID;
}

export const FooSchema: Schema<FooProps> = {
  model: 'Foo',
  collection: 'foos',
  timestamps: true,
  fields: {
    aString: {
      type: String,
      required: true,
    },
    aNumber: {
      type: Number,
      required: true,
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
    spec: { aString: 1 }, options: { unique: true },
  }],
};

export default class Foo extends Model(FooSchema) {
  static randomProps = {
    aNumber: () => (Math.floor(Math.random() * 1000) + 0),
  };

  static formatProps = {
    aString: (value: string): string => (value.trim()),
  };

  static validateProps = {
    aNumber: (value: number) => ((value >= 0 && value <= 1000)),
  };

  static defaultProps = {
    aNumber: 100,
  };
}
