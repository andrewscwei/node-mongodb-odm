import assert from 'assert'
import { describe } from 'mocha'
import { ObjectId } from 'mongodb'
import { Bar } from '../../__mocks__/models.js'
import { configureDb } from '../../index.js'
import { typeIsValidObjectId } from '../../utils/index.js'
import { matchStageFactory } from './match.js'

describe('core/aggregation/match', () => {
  before(async () => {
    configureDb({
      host: process.env.MONGODB_HOST ?? 'localhost:27017',
      name: 'mongodb_odm_test',
      models: { Bar },
    })
  })

  it('can generate $match stage', () => {
    const objectId = new ObjectId()
    const actual = matchStageFactory(Bar.schema, { _id: objectId })
    const expected = [{
      $match: { _id: objectId },
    }]

    assert.deepStrictEqual(Object.keys(actual[0]), ['$match'])
    assert(typeIsValidObjectId(actual[0].$match._id))
    assert(expected[0].$match._id.equals(actual[0].$match._id))
  })
})
