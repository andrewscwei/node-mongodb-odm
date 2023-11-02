/* eslint-disable @typescript-eslint/no-non-null-assertion */

import assert from 'assert'
import _ from 'lodash'
import { describe, it } from 'mocha'
import { ObjectId } from 'mongodb'
import { Baz } from '../__mocks__/models.js'
import { sanitizeFilter } from './sanitizeFilter.js'

describe('utils/sanitizeFilter', () => {
  it('can generate valid queries based on an Object ID string', () => {
    const objectId = new ObjectId()

    const actual = sanitizeFilter(Baz.schema, objectId.toHexString())
    const expected = { _id: objectId }

    assert.deepStrictEqual(Object.keys(actual), Object.keys(expected))
    assert(expected._id.equals(actual._id! as ObjectId))
  })

  it('can generate valid queries based on an Object ID', () => {
    const objectId = new ObjectId()

    const actual = sanitizeFilter(Baz.schema, objectId)
    const expected = { _id: objectId }

    assert.deepStrictEqual(Object.keys(actual), Object.keys(expected))
    assert(expected._id.equals(actual._id! as ObjectId))
  })

  it('can generate valid queries removing extraneous fields', () => {
    const objectId = new ObjectId()

    const expected = {
      _id: objectId,
      aString: 'baz',
    }

    const actual = sanitizeFilter(Baz.schema, {
      ...expected,
      anExtraneousField: 'baz',
    })

    assert.deepStrictEqual(Object.keys(actual), Object.keys(expected))
  })

  it('can generate valid queries while keeping extraneous fields', () => {
    const objectId = new ObjectId()

    const expected = {
      _id: objectId,
      aString: 'baz',
    }

    const actual = sanitizeFilter(Baz.schema, {
      ...expected,
      anExtraneousField: 'baz',
    }, {
      strict: false,
    })

    assert(_.get(actual, 'anExtraneousField') === 'baz')
  })
})
