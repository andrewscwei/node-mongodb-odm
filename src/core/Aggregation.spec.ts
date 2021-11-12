/* eslint-disable max-classes-per-file */

import assert from 'assert'
import Faker from 'faker'
import _ from 'lodash'
import { describe } from 'mocha'
import { ObjectID } from 'mongodb'
import { configureDb } from '..'
import Aggregation from '../core/Aggregation'
import { AggregationStageDescriptor, Document, ModelDeleteManyOptions, AnyFilter, Schema, typeIsValidObjectID } from '../types'
import Model from './modelFactory'

describe('core/Aggregation', () => {
  before(async () => {
    configureDb({
      host: process.env.MONGODB_HOST ?? 'localhost:27017',
      name: 'mongodb_odm_test',
      models: { Foo, Bar, Baz },
    })
  })

  it('can generate $match stage', () => {
    const objectId = new ObjectID()
    const actual = Aggregation.matchStageFactory(BarSchema, { _id: objectId })
    const expected = [{
      $match: { _id: objectId },
    }]

    assert.deepStrictEqual(Object.keys(actual[0]), ['$match'])
    assert(typeIsValidObjectID((actual[0] as AggregationStageDescriptor).$match._id))
    assert(expected[0].$match._id.equals((actual[0] as AggregationStageDescriptor).$match._id))
  })

  it('can generate $lookup stage', () => {
    assert.deepStrictEqual(Aggregation.lookupStageFactory(FooSchema, { aBar: true }), [{
      $lookup: { from: 'bars', localField: 'aBar', foreignField: '_id', as: 'aBar' },
    }, {
      $unwind: { path: '$aBar', preserveNullAndEmptyArrays: true },
    }])

    assert.deepStrictEqual(Aggregation.lookupStageFactory(FooSchema, { aBar: { aBar: true } }), [{
      $lookup: { from: 'bars', localField: 'aBar', foreignField: '_id', as: 'aBar' },
    }, {
      $unwind: { path: '$aBar', preserveNullAndEmptyArrays: true },
    }, {
      $lookup: { from: 'bars', localField: 'aBar.aBar', foreignField: '_id', as: 'aBar.aBar' },
    }, {
      $unwind: { path: '$aBar.aBar', preserveNullAndEmptyArrays: true },
    }])

    assert.deepStrictEqual(Aggregation.lookupStageFactory(FooSchema, { aBar: { aBar: true }, aFoo: true }), [{
      $lookup: { from: 'bars', localField: 'aBar', foreignField: '_id', as: 'aBar' },
    }, {
      $unwind: { path: '$aBar', preserveNullAndEmptyArrays: true },
    }, {
      $lookup: { from: 'bars', localField: 'aBar.aBar', foreignField: '_id', as: 'aBar.aBar' },
    }, {
      $unwind: { path: '$aBar.aBar', preserveNullAndEmptyArrays: true },
    }, {
      $lookup: { from: 'foos', localField: 'aFoo', foreignField: '_id', as: 'aFoo' },
    }, {
      $unwind: { path: '$aFoo', preserveNullAndEmptyArrays: true },
    }])

    assert.deepStrictEqual(Aggregation.lookupStageFactory(FooSchema, { aBar: { aBar: true }, aFoo: true }, { fromPrefix: 'foo.', toPrefix: 'bar.' }), [{
      $lookup: { from: 'bars', localField: 'foo.aBar', foreignField: '_id', as: 'bar.aBar' },
    }, {
      $unwind: { path: '$bar.aBar', preserveNullAndEmptyArrays: true },
    }, {
      $lookup: { from: 'bars', localField: 'bar.aBar.aBar', foreignField: '_id', as: 'bar.aBar.aBar' },
    }, {
      $unwind: { path: '$bar.aBar.aBar', preserveNullAndEmptyArrays: true },
    }, {
      $lookup: { from: 'foos', localField: 'foo.aFoo', foreignField: '_id', as: 'bar.aFoo' },
    }, {
      $unwind: { path: '$bar.aFoo', preserveNullAndEmptyArrays: true },
    }])
  })

  it('can generate $group stage', () => {
    assert.deepStrictEqual(Aggregation.groupStageFactory(FooSchema, 'foo'), [{
      $group: { _id: '$foo' },
    }])

    assert.deepStrictEqual(Aggregation.groupStageFactory(FooSchema, {
      _id: '$foo',
      bar: '$bar',
    }), [{
      $group: {
        _id: '$foo',
        bar: '$bar',
      },
    }])
  })

  it('can generate $sort stage', () => {
    assert.deepStrictEqual(Aggregation.sortStageFactory(FooSchema, {
      a: 1,
      b: -1,
    }), [{
      $sort: {
        a: 1,
        b: -1,
      },
    }])
  })

  it('can generate $project stage for an entire schema', () => {
    assert.deepStrictEqual(Aggregation.projectStageFactory(FooSchema), [{
      $project: {
        ..._.mapValues(FooSchema.fields, (value: any, key: string) => `$${key}`),
        _id: '$_id',
        createdAt: '$createdAt',
        updatedAt: '$updatedAt',
      },
    }])
  })

  it('can generate $project stage with prefixes for an entire schema and its foreign keys', () => {
    assert.deepStrictEqual(Aggregation.projectStageFactory(FooSchema, { populate: { aBar: true }, fromPrefix: 'foo.', toPrefix: 'bar.' }), [{
      $project: {
        ..._(FooSchema.fields).mapValues((v, k) => `$foo.${k}`).mapKeys((v, k) => `bar.${k}`).value(),
        ['bar._id']: '$foo._id',
        ['bar.createdAt']: '$foo.createdAt',
        ['bar.updatedAt']: '$foo.updatedAt',
        ['bar.aBar']: {
          ..._(BarSchema.fields).mapValues((v, k) => `$${k}`).value(),
          ['_id']: '$_id',
        },
      },
    }])
  })

  it('can generate $project stage with exclusions for a schema', () => {
    assert.deepStrictEqual(Aggregation.projectStageFactory(FooSchema, {
      exclude: ['createdAt', 'updatedAt'],
    }), [{
      $project: {
        ['_id']: '$_id',
        ..._(FooSchema.fields).mapValues((v, k) => `$${k}`).value(),
      },
    }])
  })

  it('can generate a full aggregation pipeline', () => {
    const objectId = new ObjectID()

    assert.deepStrictEqual(Aggregation.pipelineFactory(FooSchema), [])

    const actual = Aggregation.pipelineFactory(FooSchema, {
      $match: objectId,
    })

    const expected = [
      ...Aggregation.matchStageFactory(FooSchema, objectId),
    ]

    assert(actual.length === expected.length)
    assert(_.isPlainObject(actual[0]))
    assert((actual[0] as AggregationStageDescriptor).hasOwnProperty('$match'))
    assert(objectId.equals((expected[0] as AggregationStageDescriptor).$match._id))
  })
})

interface FooProps {
  aString: string
  aNumber: number
  aBar: ObjectID
  aFoo?: ObjectID
}

const FooSchema: Schema<FooProps> = {
  model: 'Foo',
  collection: 'foos',
  timestamps: true,
  fields: {
    aString: { type: String, required: true },
    aNumber: { type: Number, required: true },
    aBar: { type: ObjectID, ref: 'Bar', required: true },
    aFoo: { type: ObjectID, ref: 'Foo' },
  },
  indexes: [{
    spec: { aString: 1 }, options: { unique: true },
  }],
}

class Foo extends Model(FooSchema) {
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

interface BarProps {
  aBar: ObjectID
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
    aBar: { type: ObjectID, ref: 'Bar', required: true },
    aString: { type: String, required: true },
    aDate: { type: Date, required: true },
    anObject: {
      type: {
        anObjectIdArray: { type: [ObjectID] },
        aString: { type: String },
        aNumber: { type: Number },
        aBoolean: { type: Boolean },
      },
    },
    aNumber: { type: Number, required: true },
    aBoolean: { type: Boolean },
  },
}

class Bar extends Model(BarSchema) {
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

interface BazProps {
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


class Baz extends Model(BazSchema) {

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
