import assert from 'assert'
import { describe } from 'mocha'
import { configureDb } from '../..'
import { Bar, Baz, Foo } from '../../index.spec'
import { sortStageFactory } from './sort'

describe('core/aggregation/sort', () => {
  before(async () => {
    configureDb({
      host: process.env.MONGODB_HOST ?? 'localhost:27017',
      name: 'mongodb_odm_test',
      models: { Foo, Bar, Baz },
    })
  })

  it('can generate $sort stage', () => {
    assert.deepStrictEqual(sortStageFactory(Foo.schema, {
      a: 1,
      b: -1,
    }), [{
      $sort: {
        a: 1,
        b: -1,
      },
    }])
  })
})
