import assert from 'assert'
import { describe, it } from 'mocha'
import { Baz } from '../__mocks__/models'
import { sanitizeDocument } from './sanitizeDocument'

describe('utils/sanitizeDocument', () => {
  it('can remove extraneous fields from a document fragment', () => {
    const t: any = {
      aString: 'foo',
      extraneous: 'foo',
    }

    const o = sanitizeDocument(Baz.schema, t)

    assert({}.hasOwnProperty.call(o, 'aString'))
    assert(!{}.hasOwnProperty.call(o, 'extraneous'))
  })

  it('can remove `undefined` and `null` fields in a document fragment', () => {
    const t: any = {
      aNumber: undefined,
      aBoolean: null,
    }

    const o = sanitizeDocument(Baz.schema, t)

    assert(!{}.hasOwnProperty.call(o, 'aNumber'))
    assert(!{}.hasOwnProperty.call(o, 'aBoolean'))
  })

  it('can account for fields in dot notation format', () => {
    const t: any = {
      'anObject.a': 'bar',
    }

    const o = sanitizeDocument(Baz.schema, t, { accountForDotNotation: true })

    assert({}.hasOwnProperty.call(o, 'anObject.a'))
  })
})
