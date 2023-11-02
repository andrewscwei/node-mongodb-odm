import assert from 'assert'
import { describe } from 'mocha'
import { Bar, Foo } from '../../__mocks__/models.js'
import { configureDb } from '../../index.js'
import { lookupStageFactory } from './lookup.js'

describe('core/aggregation/lookup', () => {
  before(async () => {
    configureDb({
      host: process.env.MONGODB_HOST ?? 'localhost:27017',
      name: 'mongodb_odm_test',
      models: { Foo, Bar },
    })
  })

  it('can generate $lookup stage', () => {
    assert.deepStrictEqual(lookupStageFactory(Foo.schema, { aBar: true }), [{
      $lookup: { from: 'bars', localField: 'aBar', foreignField: '_id', as: 'aBar' },
    }, {
      $unwind: { path: '$aBar', preserveNullAndEmptyArrays: true },
    }])

    assert.deepStrictEqual(lookupStageFactory(Foo.schema, { aBar: { lookup: { aBar: true } } }), [{
      $lookup: { from: 'bars', localField: 'aBar', foreignField: '_id', as: 'aBar' },
    }, {
      $unwind: { path: '$aBar', preserveNullAndEmptyArrays: true },
    }, {
      $lookup: { from: 'bars', localField: 'aBar.aBar', foreignField: '_id', as: 'aBar.aBar' },
    }, {
      $unwind: { path: '$aBar.aBar', preserveNullAndEmptyArrays: true },
    }])

    assert.deepStrictEqual(lookupStageFactory(Foo.schema, { aBar: { lookup: { aBar: true } }, aFoo: true }), [{
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

    assert.deepStrictEqual(lookupStageFactory(Foo.schema, { aBar: { lookup: { aBar: true } }, aFoo: true }, { fromPrefix: 'foo', toPrefix: 'bar' }), [{
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
})
