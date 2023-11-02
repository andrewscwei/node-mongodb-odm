import assert from 'assert'
import { describe, it } from 'mocha'
import { prefixed } from './prefixed.js'

describe('utils/prefixed', () => {
  it('can properly append prefixes with a starting dot', () => {
    assert(prefixed('foo', '.a.b.c.d') === 'a.b.c.d.foo')
  })

  it('can properly append prefixes without a starting dot', () => {
    assert(prefixed('foo', 'a.b.c.d') === 'a.b.c.d.foo')
  })

  it('can properly append prefixes with an ending dot', () => {
    assert(prefixed('foo', 'a.b.c.d.') === 'a.b.c.d.foo')
  })

  it('can properly append prefixes without an ending dot', () => {
    assert(prefixed('foo', 'a.b.c.d') === 'a.b.c.d.foo')
  })

  it('can properly append fields with an ending dot', () => {
    assert(prefixed('foo.', 'a.b.c.d') === 'a.b.c.d.foo')
  })

  it('can properly append fields without an ending dot', () => {
    assert(prefixed('foo', 'a.b.c.d') === 'a.b.c.d.foo')
  })

  it('can properly append fields with a starting dot', () => {
    assert(prefixed('.foo', 'a.b.c.d') === 'a.b.c.d.foo')
  })

  it('can properly append fields without a starting dot', () => {
    assert(prefixed('foo', 'a.b.c.d') === 'a.b.c.d.foo')
  })

  it('can properly append prefixes with an arbitrary combination of dots', () => {
    assert(prefixed('foo', 'a.b.c.d...') === 'a.b.c.d.foo')
    assert(prefixed('foo', 'a.b...c.d...') === 'a.b.c.d.foo')
    assert(prefixed('foo', '...a.b..c.d.') === 'a.b.c.d.foo')
    assert(prefixed('foo..', '..a.b..c.d.') === 'a.b.c.d.foo')
    assert(prefixed('....foo..', '..a.b..c.d.') === 'a.b.c.d.foo')
  })
})
