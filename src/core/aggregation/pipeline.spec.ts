/* eslint-disable max-classes-per-file */

import assert from 'assert'
import _ from 'lodash'
import { describe } from 'mocha'
import { ObjectId } from 'mongodb'
import { configureDb } from '../..'
import { Bar, Baz, Foo } from '../../index.spec'
import { matchStageFactory } from './match'
import { autoPipelineFactory, PipelineStage } from './pipeline'

describe('core/aggregation/pipeline', () => {
  before(async () => {
    configureDb({
      host: process.env.MONGODB_HOST ?? 'localhost:27017',
      name: 'mongodb_odm_test',
      models: { Foo, Bar, Baz },
    })
  })

  it('can generate a full aggregation pipeline', () => {
    const objectId = new ObjectId()

    assert.deepStrictEqual(autoPipelineFactory(Foo.schema), [])

    const actual = autoPipelineFactory(Foo.schema, {
      $match: objectId,
    })

    const expected = [
      ...matchStageFactory(Foo.schema, objectId),
    ]

    assert(actual.length === expected.length)
    assert(_.isPlainObject(actual[0]))
    assert((actual[0] as PipelineStage).hasOwnProperty('$match'))
    assert(objectId.equals((expected[0] as PipelineStage).$match._id))
  })
})
