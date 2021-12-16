import assert from 'assert'
import { describe, it } from 'mocha'
import { Baz } from '../index.spec'
import sanitizeDocument from '../utils/sanitizeDocument'

describe('utils/sanitizeDocument', () => {
  it('can remove extraneous fields from a document fragment', () => {
    const t: any = {
      aString: 'foo',
      extraneous: 'foo',
    }

    const o = sanitizeDocument(Baz.schema, t)

    assert(o.hasOwnProperty('aString'))
    assert(!o.hasOwnProperty('extraneous'))
  })

  it('can remove `undefined` and `null` fields in a document fragment', () => {
    const t: any = {
      aNumber: undefined,
      aBoolean: null,
    }

    const o = sanitizeDocument(Baz.schema, t)

    assert(!o.hasOwnProperty('aNumber'))
    assert(!o.hasOwnProperty('aBoolean'))
  })

  it('can account for fields in dot notation format', () => {
    const t: any = {
      'anObject.a': 'bar',
    }

    const o = sanitizeDocument(Baz.schema, t, { accountForDotNotation: true })

    assert(o.hasOwnProperty('anObject.a'))
  })
})
