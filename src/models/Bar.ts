import { ObjectID } from 'mongodb';
import Model from '../core/Model';
import { Schema } from '../types';

export interface BarProps {
  aBar: ObjectID;
  aString: string;
  aDate: Date;
  anObject?: {
    aString: string;
    aNumber: number;
    aBoolean: boolean;
  };
  aNumber: number;
  aBoolean?: boolean;
}

export const BarSchema: Schema<BarProps> = {
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
    },
    aDate: {
      type: Date,
      required: true,
    },
    anObject: {
      type: {
        anObjectIdArray: { type: [ObjectID] },
        aString: { type: String },
        aNumber: { type: Number },
        aBoolean: { type: Boolean },
      },
    },
    aNumber: {
      type: Number,
      required: true,
    },
    aBoolean: {
      type: Boolean,
    },
  },
};

export default class Bar extends Model(BarSchema) {
  static randomProps = {
    aNumber: () => (Math.floor(Math.random() * 1000) + 0),
  };

  static defaultProps = {
    aDate: () => new Date(),
    aNumber: 100,
    aBoolean: false,
  };

  static validateProps = {
    aString: 100,
    aNumber: (value: number) => ((value >= 0 && value <= 1000)),
  };
}
