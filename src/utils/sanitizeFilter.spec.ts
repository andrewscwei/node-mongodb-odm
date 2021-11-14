/* eslint-disable @typescript-eslint/no-non-null-assertion */

import assert from 'assert'
import Faker from 'faker'
import { describe, it } from 'mocha'
import { ObjectId } from 'mongodb'
import Model from '../core/modelFactory'
import Schema from '../core/Schema'
import { DocumentFragment } from '../types'
import sanitizeFilter from './sanitizeFilter'

describe('utils/sanitizeFilter', () => {
  it('can generate valid queries based on an Object ID string', () => {
    const objectId = new ObjectId()

    const actual = sanitizeFilter<BazProps>(Baz.schema, objectId.toHexString())
    const expected = { _id: objectId }

    assert.deepStrictEqual(Object.keys(actual), Object.keys(expected))
    assert(expected._id.equals(actual._id! as ObjectId))
  })

  it('can generate valid queries based on an Object ID', () => {
    const objectId = new ObjectId()

    const actual = sanitizeFilter<BazProps>(Baz.schema, objectId)
    const expected = { _id: objectId }

    assert.deepStrictEqual(Object.keys(actual), Object.keys(expected))
    assert(expected._id.equals(actual._id! as ObjectId))
  })

  it('can generate valid queries removing extraneous fields', () => {
    const objectId = new ObjectId()

    const expected: DocumentFragment<BazProps> = {
      _id: objectId,
      aString: 'baz',
    }

    const actual = sanitizeFilter<BazProps>(Baz.schema, {
      ...expected,
      anExtraneousField: 'baz',
    })

    assert.deepStrictEqual(Object.keys(actual), Object.keys(expected))
  })

  it('can generate valid queries while keeping extraneous fields', () => {
    const objectId = new ObjectId()

    const expected: DocumentFragment<BazProps> = {
      _id: objectId,
      aString: 'baz',
    }

    const actual = sanitizeFilter<BazProps>(Baz.schema, {
      ...expected,
      anExtraneousField: 'baz',
    }, {
      strict: false,
    })

    assert(actual.anExtraneousField === 'baz')
  })
})

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
}
