import assert from 'assert'
import _ from 'lodash'
import { describe } from 'mocha'
import { Bar, Foo } from '../../__mocks__/models.js'
import { configureDb } from '../../index.js'
import { projectStageFactory } from './project.js'

describe('core/aggregation/project', () => {
  before(async () => {
    configureDb({
      host: process.env.MONGODB_HOST ?? 'localhost:27017',
      name: 'mongodb_odm_test',
      models: { Foo, Bar },
    })
  })

  it('can generate $project stage for an entire schema', () => {
    assert.deepStrictEqual(projectStageFactory(Foo.schema), [{
      $project: {
        ..._.mapValues(Foo.schema.fields, (value: any, key: string) => `$${key}`),
        _id: '$_id',
        createdAt: '$createdAt',
        updatedAt: '$updatedAt',
      },
    }])
  })

  it('can generate $project stage with prefixes for an entire schema and its foreign keys', () => {
    assert.deepStrictEqual(projectStageFactory(Foo.schema, undefined, { populate: { aBar: true }, fromPrefix: 'foo', toPrefix: 'bar' }), [{
      $project: {
        ..._(Foo.schema.fields).mapValues((v, k) => `$foo.${k}`).mapKeys((v, k) => `bar.${k}`).value(),
        ['bar._id']: '$foo._id',
        ['bar.createdAt']: '$foo.createdAt',
        ['bar.updatedAt']: '$foo.updatedAt',
        ['bar.aBar']: {
          ..._(Bar.schema.fields).mapValues((v, k) => `$${k}`).value(),
          ['_id']: '$_id',
        },
      },
    }])
  })

  it('can generate $project stage with exclusions for a schema', () => {
    assert.deepStrictEqual(projectStageFactory(Foo.schema, undefined, {
      exclude: ['createdAt', 'updatedAt'],
    }), [{
      $project: {
        ['_id']: '$_id',
        ..._(Foo.schema.fields).mapValues((v, k) => `$${k}`).value(),
      },
    }])
  })
})
