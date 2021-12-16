import assert from 'assert'
import { describe } from 'mocha'
import { configureDb } from '../..'
import { groupStageFactory } from './group'
import { Bar, Baz, Foo } from './index.spec'

describe('core/aggregation/group', () => {
  before(async () => {
    configureDb({
      host: process.env.MONGODB_HOST ?? 'localhost:27017',
      name: 'mongodb_odm_test',
      models: { Foo, Bar, Baz },
    })
  })

  it('can generate $group stage', () => {
    assert.deepStrictEqual(groupStageFactory(Foo.schema, 'foo'), [{
      $group: { _id: '$foo' },
    }])

    assert.deepStrictEqual(groupStageFactory(Foo.schema, {
      _id: '$foo',
      bar: '$bar',
    }), [{
      $group: {
        _id: '$foo',
        bar: '$bar',
      },
    }])
  })
})
