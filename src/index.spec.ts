/* eslint-disable max-classes-per-file */

import assert from 'assert'
import Faker from 'faker'
import _ from 'lodash'
import { before, describe, it } from 'mocha'
import { ObjectId } from 'mongodb'
import { configureDb, getDbConnection } from '.'
import Model from './core/modelFactory'
import Schema from './core/Schema'

describe('can connect to a database', () => {
  before(async () => {
    configureDb({
      host: process.env.MONGODB_HOST ?? 'localhost:27017',
      name: 'mongodb_odm_test',
    })
  })

  it('can connect to db', async () => {
    const connection = getDbConnection()
    assert(connection)
    await connection.connect()
    assert(connection.isConnected() === true)
  })

  it('can disconnect', async () => {
    const connection = getDbConnection()
    assert(connection)
    await connection.disconnect()
    assert(connection.isConnected() === false)
  })

  it('can fetch db instance', async () => {
    const connection = getDbConnection()
    assert(connection)
    const db = await connection.getDbInstance()
    assert(_.isNil(db) === false)
  })
})

type FooObject = {
  foo: {
    aString: string
    aNumber?: number
  }
  bar?: {
    aString: string
    aNumber?: number
  }
}

export type FooProps = {
  aString: string
  aNumber: number
  aBar: ObjectId
  aFoo?: ObjectId
  anObject?: FooObject
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
    anObject: {
      type: {
        foo: {
          type: {
            aString: { type: String },
            aNumber: { type: Number },
          },
        },
        bar: {
          type: {
            aString: { type: String },
            aNumber: { type: Number },
          },
        },
      },
    },
  },
  indexes: [{
    spec: { aString: 1 }, options: { unique: true },
  }],
}

export class Foo extends Model(FooSchema) {
  static randomProps = {
    aNumber: () => Math.floor(Math.random() * 1000) + 0,
  }

  static formatProps = {
    aString: (value: string): string => value.trim(),
  }

  static validateProps = {
    aNumber: (value: number) => value >= 0 && value <= 1000,
  }

  static defaultProps = {
    aNumber: 100,
  }
}

export type BarProps = {
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
  aFormattedString?: string
  anEncryptedString?: string
}

const BarSchema: Schema<BarProps> = {
  model: 'Bar',
  collection: 'bars',
  cascade: ['Foo'],
  allowUpserts: true,
  fields: {
    aBar: { type: ObjectId, ref: 'Bar' },
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
    aFormattedString: { type: String },
    anEncryptedString: { type: String, encrypted: true },
  },
  indexes: [{
    spec: { aString: 1 },
  }],
}

export class Bar extends Model(BarSchema) {
  static randomProps = {
    aString: () => Faker.random.alphaNumeric(10),
    aNumber: () => Math.floor(Math.random() * 1000) + 0,
  }

  static defaultProps = {
    aDate: () => new Date(),
    aNumber: 100,
    aBoolean: false,
  }

  static validateProps = {
    aString: 100,
    aNumber: (value: number) => value >= 0 && value <= 1000,
  }

  static formatProps = {
    aFormattedString: (v: string) => v.toUpperCase(),
  }
}

export type BazProps = {
  aString: string
  aNumber?: number
  aBoolean?: boolean
  anObject?: { a?: string; b?: string }
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
    anObject: { type: { a: { type: String }, b: { type: String } } },
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
}
