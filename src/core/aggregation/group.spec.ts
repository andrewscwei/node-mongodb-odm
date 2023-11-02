import assert from 'assert'
import { describe } from 'mocha'
import { Foo } from '../../__mocks__/models.js'
import { configureDb } from '../../index.js'
import { groupStageFactory } from './group.js'

describe('core/aggregation/group', () => {
  before(async () => {
    configureDb({
      host: process.env.MONGODB_HOST ?? 'localhost:27017',
      name: 'mongodb_odm_test',
      models: { Foo },
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
