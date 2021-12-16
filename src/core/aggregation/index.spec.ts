/* eslint-disable max-classes-per-file */

import Faker from 'faker'
import { ObjectId } from 'mongodb'
import { AnyFilter, Document } from '../../types'
import { ModelDeleteManyOptions } from '../Model'
import Model from '../modelFactory'
import Schema from '../Schema'

type FooProps = {
  aString: string
  aNumber: number
  aBar: ObjectId
  aFoo?: ObjectId
}

const FooSchema: Schema<FooProps> = {
  model: 'Foo',
  collection: 'foos',
  timestamps: true,
  fields: {
    aString: { type: String, required: true },
    aNumber: { type: Number, required: true },
    aBar: { type: ObjectId, ref: 'Bar', required: true },
    aFoo: { type: ObjectId, ref: 'Foo' },
  },
  indexes: [{
    spec: { aString: 1 }, options: { unique: true },
  }],
}

export class Foo extends Model(FooSchema) {
  static randomProps = {
    aNumber: () => (Math.floor(Math.random() * 1000) + 0),
  }

  static formatProps = {
    aString: (value: string): string => (value.trim()),
  }

  static validateProps = {
    aNumber: (value: number) => ((value >= 0 && value <= 1000)),
  }

  static defaultProps = {
    aNumber: 100,
  }
}

type BarProps = {
  aBar: ObjectId
  aString: string
  aDate: Date
  anObject?: {
    aString: string
    aNumber: number
    aBoolean: boolean
  }
  aNumber: number
  aBoolean?: boolean
}

const BarSchema: Schema<BarProps> = {
  model: 'Bar',
  collection: 'bars',
  cascade: ['Foo'],
  fields: {
    aBar: { type: ObjectId, ref: 'Bar', required: true },
    aString: { type: String, required: true },
    aDate: { type: Date, required: true },
    anObject: {
      type: {
        anObjectIdArray: { type: [ObjectId] },
        aString: { type: String },
        aNumber: { type: Number },
        aBoolean: { type: Boolean },
      },
    },
    aNumber: { type: Number, required: true },
    aBoolean: { type: Boolean },
  },
}

export class Bar extends Model(BarSchema) {
  static randomProps = {
    aNumber: () => (Math.floor(Math.random() * 1000) + 0),
  }

  static defaultProps = {
    aDate: () => new Date(),
    aNumber: 100,
    aBoolean: false,
  }

  static validateProps = {
    aString: 100,
    aNumber: (value: number) => ((value >= 0 && value <= 1000)),
  }
}

type BazProps = {
  aString: string
  aNumber?: number
  aBoolean?: boolean
  aFormattedString?: string
  anEncryptedString?: string
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
}

export class Baz extends Model(BazSchema) {

  static randomProps = {
    aString: () => Faker.random.alphaNumeric(10),
  }

  static defaultProps = {
    aNumber: () => Faker.datatype.number(),
    aBoolean: true,
  }

  static formatProps = {
    aFormattedString: (v: string) => v.toUpperCase(),
  }

  /** @inheritdoc */
  static async deleteMany(query: AnyFilter<BazProps>, options?: ModelDeleteManyOptions): Promise<boolean | Document<BazProps>[]> {

    return true
  }
}
