import assert from 'assert'
import bcrypt from 'bcrypt'
import Chance from 'chance'
import _ from 'lodash'
import { describe, it } from 'mocha'
import { ObjectId } from 'mongodb'
import { Bar, Foo, type BarProps } from '../__mocks__/models.js'
import { configureDb, getDbConnection, typeIsIdentifiableDocument } from '../index.js'
import { type DocumentFragment } from '../types/index.js'

const chance = new Chance()

describe('core/Model', () => {
  before(async () => {
    configureDb({
      host: process.env.MONGODB_HOST ?? 'localhost:27017',
      name: 'mongodb_odm_test',
      models: { Foo, Bar },
    })

    const db = await getDbConnection()?.getDbInstance()
    await db?.dropDatabase()
  })

  it('cannot be instantiated', async () => {
    assert.throws(() => new Bar())
  })

  it('throws an error if the model has no schema defined', async () => {
    assert(Foo.schema)
  })

  it('can find a document', async () => {
    const t = { aString: chance.string({ length: 10 }) }
    const res = await Bar.insertOneStrict(t)

    assert(res)

    const doc = await Bar.findOneStrict(res._id)

    assert(doc._id.equals(res._id))
  })

  it('can find multiple documents', async () => {
    const s = chance.string({ length: 10 })

    await Bar.insertOne({ aString: s })
    await Bar.insertOne({ aString: s })
    await Bar.insertOne({ aString: s })

    const docs = await Bar.findMany({ aString: s })

    assert(docs.length === 3)
  })

  it('can find a random document', async () => {
    await Bar.findOneStrict()
  })

  it('can count the total number of documents in the collection', async () => {
    const s = chance.string({ length: 10 })

    await Bar.insertOne({ aString: s })
    await Bar.insertOne({ aString: s })
    await Bar.insertOne({ aString: s })

    const count = await Bar.count({ aString: s })

    assert(count === 3)
  })

  it('can generate random required fields', async () => {
    const res = await Bar.randomFields()
    assert(_.isString(res.aString))
  })

  it('can insert a new document', async () => {
    const t = { aString: chance.string({ length: 10 }) }
    const doc = await Bar.insertOneStrict(t)
    assert(doc.aString === t.aString)
  })

  it('can insert multiple documents', async () => {
    const t = [{ aString: chance.string({ length: 10 }) }, { aString: chance.string({ length: 10 }) }, { aString: chance.string({ length: 10 }) }]
    const docs = await Bar.insertMany(t)
    assert(docs.length === t.length)
    assert(docs.reduce((prev, curr) => prev && ObjectId.isValid(curr._id), true))
    docs.forEach((doc, i) => assert(doc.aString === t[i].aString))
  })

  it('can identify a single document', async () => {
    const t = { aString: 'foo' }
    await Bar.insertOneStrict(t)
    const id = await Bar.identifyOne({ aString: 'foo' })
    assert(id)
  })

  it('can identify multiple documents', async () => {
    const t = [{ aString: 'bar' }, { aString: 'bar' }, { aString: 'bar' }]
    await Bar.insertMany(t)
    const ids = await Bar.identifyMany({ aString: 'bar' })
    assert(ids.length === t.length)
  })

  it('should throw if required fields are missing during insertion', async () => {
    let didThrow = true

    try {
      await Bar.insertOneStrict({ aNumber: 6 })

      didThrow = false
    }
    catch (err) {}

    assert(didThrow)
  })

  it('can format documents according to the schema', async () => {
    const t = { aFormattedString: chance.string({ length: 10 }) }
    const res = await Bar.formatDocument(t)
    assert(Bar.formatProps.aFormattedString(t.aFormattedString) === res.aFormattedString)
  })

  it('can encrypt document fields according to the schema', async () => {
    const s = chance.string({ length: 10 })
    const t = { anEncryptedString: s }
    const res = await Bar.formatDocument(t)
    assert(res.anEncryptedString)
    assert(await bcrypt.compare(s, res.anEncryptedString))
  })

  it('should automatically generate default values on insert', async () => {
    const t = { aString: chance.string({ length: 10 }) }
    const res = await Bar.insertOneStrict(t)
    assert(res.aBoolean === Bar.defaultProps.aBoolean)
  })

  it('should automatically format values on insert according to the schema', async () => {
    const t = { aString: chance.string({ length: 10 }), aFormattedString: chance.string({ length: 10 }) }
    const res = await Bar.insertOneStrict(t)
    assert(Bar.formatProps.aFormattedString(t.aFormattedString) === res.aFormattedString)
  })

  it('can update an existing doc', async () => {
    const s = chance.string({ length: 10 })
    const t = { aString: chance.string({ length: 10 }) }
    await Bar.insertOneStrict(t)
    const updated = await Bar.updateOneStrict(t, { aString: s }, { returnDocument: 'after' })
    assert(!_.isBoolean(updated))
    assert(typeIsIdentifiableDocument(updated))
    assert(updated.aString === s)
  })

  it('can update a field of an embedded doc within a doc', async () => {
    const s = chance.string({ length: 10 })
    const t = { aString: s }
    const bar = await Bar.insertOneStrict(t)
    const newBar = await Bar.updateOneStrict(bar._id, { 'anObject.aString': 'foo' }, { returnDocument: 'after' })
    assert(!_.isBoolean(newBar))
    assert(typeIsIdentifiableDocument(newBar))
    assert(newBar.anObject && newBar.anObject.aString === 'foo')
  })

  it('can upsert a doc if it does not already exist', async () => {
    const s = chance.string({ length: 10 })
    const t = { aString: s }
    await Bar.updateOneStrict(t, { aFormattedString: chance.string({ length: 10 }) }, { upsert: true })
    await Bar.findOneStrict({ aString: s })
  })

  it('cannot upsert a doc if `allowUpserts` is not enabled in the schema', async () => {
    const s = chance.string({ length: 10 })
    const t = { aString: s }
    let didThrow = true

    try {
      await Foo.updateOneStrict(t, { aString: chance.string({ length: 10 }) }, { upsert: true })
      didThrow = false
    }
    catch (err) {}

    assert(didThrow)
  })

  it('should return `false` if update fails and `returnDocument` is unspecified', async () => {
    const res = await Bar.updateOne(new ObjectId(), { aString: chance.string({ length: 10 }) })
    assert(res === false)
  })

  it('should return `undefined` if update fails and `returnDocument` is `after`', async () => {
    const res = await Bar.updateOne(new ObjectId(), { aString: chance.string({ length: 10 }) }, { returnDocument: 'after' })
    assert(_.isUndefined(res))
  })

  it('should automatically format values on update according to the schema', async () => {
    const s = chance.string({ length: 10 })
    const t = chance.string({ length: 10 })

    await Bar.insertOne({ aString: s })
    const res = await Bar.updateOne({ aString: s }, { aFormattedString: t }, { returnDocument: 'after' })

    assert(!_.isNil(res))
    assert(!_.isBoolean(res))
    assert(res.aFormattedString !== t)
    assert(res.aFormattedString === Bar.formatProps.aFormattedString(t))
  })

  it('should automatically format values on upsert according to the schema', async () => {
    const s = chance.string({ length: 10 })
    const res = await Bar.updateOne({ aString: chance.string({ length: 10 }) }, { aFormattedString: s }, { upsert: true, returnDocument: 'after' })

    assert(!_.isNil(res))
    assert(!_.isBoolean(res))
    assert(res.aFormattedString !== s)
    assert(res.aFormattedString === Bar.formatProps.aFormattedString(s))
  })

  it('can update multiple existing docs', async () => {
    const s = chance.string({ length: 10 })
    const t = chance.string({ length: 10 })
    const q: DocumentFragment<BarProps>[] = [{ aString: s }, { aString: s }, { aString: s }]
    const docs = await Bar.insertMany(q)

    assert(docs)
    assert(docs.reduce((prev, curr) => prev && ObjectId.isValid(curr._id), true))

    const res = await Bar.updateMany({ aString: s }, { aString: t }, { returnDocument: 'after' })

    assert(!_.isBoolean(res))
    assert(res.length === docs.length)
    assert(res.reduce((o, v) => o && v.aString === t, true))
  })

  it('can upsert a doc in an `updateMany` op while `returnDocument` is `after`', async () => {
    const s = chance.string({ length: 10 })
    const t = chance.string({ length: 10 })

    const res = await Bar.updateMany({ aString: s }, { aFormattedString: t }, { returnDocument: 'after', upsert: true })

    assert(!_.isBoolean(res))
    assert(res.length === 1)
    assert(!_.isNil(await Bar.findOne({ aString: s })))
  })

  it('can upsert a doc in an `updateMany` op while `returnDocument` is unspecified', async () => {
    const s = chance.string({ length: 10 })
    const t = chance.string({ length: 10 })

    const res = await Bar.updateMany({ aString: s }, { aFormattedString: t }, { upsert: true })

    assert(res === true)
    assert(!_.isNil(await Bar.findOne({ aString: s })))
  })

  it('can delete a doc', async () => {
    const s = chance.string({ length: 10 })

    await Bar.insertOne({ aString: s })

    assert(await Bar.findOne({ aString: s }) !== undefined)

    const res = await Bar.deleteOne({ aString: s })

    assert(res === true)
    assert(_.isUndefined(await Bar.findOne({ aString: s })))
  })

  it('can delete a doc and return the deleted doc', async () => {
    const s = chance.string({ length: 10 })
    const doc = await Bar.insertOneStrict({ aString: s })

    assert(await Bar.findOne({ aString: s }) !== undefined)

    const objectId = doc._id

    const res = await Bar.deleteOne({ aString: s }, { returnDocument: true })

    assert(res !== undefined)
    assert(!_.isBoolean(res))
    assert(res._id.equals(objectId))
    assert(_.isUndefined(await Bar.findOne({ aString: s })))
  })

  it('can delete multiple docs', async () => {
    const s = chance.string({ length: 10 })

    await Bar.insertMany([{ aString: s }, { aString: s }, { aString: s }])

    assert(await Bar.count({ aString: s }) === 3)

    await Bar.deleteMany({ aString: s })

    assert(await Bar.count({ aString: s }) === 0)
  })

  it('can delete multiple docs and return the deleted docs', async () => {
    const s = chance.string({ length: 10 })

    await Bar.insertMany([{ aString: s }, { aString: s }, { aString: s }])

    assert(await Bar.count({ aString: s }) === 3)

    const res = await Bar.deleteMany({ aString: s }, { returnDocument: true })

    assert(_.isArray(res))
    assert(res.length === 3)
  })

  it('can replace an existing doc and return the old doc', async () => {
    const s = chance.string({ length: 10 })
    const t = chance.string({ length: 10 })

    await Bar.insertOne({ aString: s })

    const doc = await Bar.replaceOneStrict({ aString: s }, { aString: t }, { returnDocument: 'before' })

    assert(!_.isNil(doc))
    assert(typeIsIdentifiableDocument(doc))
    assert(doc.aString === s)
  })

  it('can replace an existing doc and return the new doc', async () => {
    const s = chance.string({ length: 10 })
    const t = chance.string({ length: 10 })

    await Bar.insertOne({ aString: s })

    const doc = await Bar.replaceOneStrict({ aString: s }, { aString: t }, { returnDocument: 'after' })

    assert(!_.isNil(doc))
    assert(typeIsIdentifiableDocument(doc))
    assert(doc.aString === t)
  })

  it('can remove a property of a doc by updating it to `undefined`', async () => {
    const baz = await Bar.insertOneStrict()
    assert(_.isNumber(baz.aNumber))
    await Bar.updateOneStrict(baz._id, { aNumber: undefined })
    const res = await Bar.findOneStrict(baz._id)
    assert(_.isUndefined(res.aNumber))
  })

  it('can upsert a document while setting an update field to `undefined`', async () => {
    const t = chance.string({ length: 10 })
    const exists = await Bar.exists({ aString: t })
    assert(!exists)
    const baz = await Bar.updateOneStrict({ aString: t }, { aNumber: undefined }, { upsert: true, returnDocument: 'after' })
    assert(baz)
    assert(!_.isBoolean(baz))
    assert(_.isUndefined(baz.aNumber))
  })
})
