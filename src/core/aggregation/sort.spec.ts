import assert from 'assert'
import { describe } from 'mocha'
import { configureDb } from '../..'
import { Foo } from '../../__mocks__/models'
import { sortStageFactory } from './sort'

describe('core/aggregation/sort', () => {
  before(async () => {
    configureDb({
      host: process.env.MONGODB_HOST ?? 'localhost:27017',
      name: 'mongodb_odm_test',
      models: { Foo },
    })
  })

  it('can generate $sort stage', () => {
    assert.deepStrictEqual(sortStageFactory(Foo.schema, {
      aString: 1,
      aFoo: -1,
    }), [{
      $sort: {
        aString: 1,
        aFoo: -1,
      },
    }])
  })
})
