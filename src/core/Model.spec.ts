/* eslint-disable max-classes-per-file, @typescript-eslint/no-non-null-assertion */

import assert from 'assert'
import bcrypt from 'bcrypt'
import Faker from 'faker'
import _ from 'lodash'
import { describe, it } from 'mocha'
import { ObjectID } from 'mongodb'
import { configureDb, getDbInstance } from '..'
import { Document, DocumentFragment } from '../types'
import Model from './modelFactory'
import Schema from './Schema'

describe('core/Model', () => {
  before(async () => {
    configureDb({
      host: process.env.MONGODB_HOST ?? 'localhost:27017',
      name: 'mongodb_odm_test',
      models: { Foo, Bar },
    })

    const db = await getDbInstance()
    await db.dropDatabase()
  })

  it('cannot be instantiated', async () => {
    assert.throws(() => (new Bar()))
  })

  it('throws an error if the model has no schema defined', async () => {
    assert(Foo.schema)
  })

  it('can find a document', async () => {
    const t: DocumentFragment<BarProps> = { aString: Faker.random.alphaNumeric(10) }
    const res = await Bar.insertOneStrict(t)

    assert(res)

    const doc = await Bar.findOneStrict(res._id)

    assert(doc._id.equals(res._id))
  })

  it('can find multiple documents', async () => {
    const s = Faker.random.alphaNumeric(10)

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
    const s = Faker.random.alphaNumeric(10)

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
    const t: DocumentFragment<BarProps> = { aString: Faker.random.alphaNumeric(10) }
    const doc = await Bar.insertOneStrict(t)
    assert(doc.aString === t.aString)
  })

  it('can insert multiple documents', async () => {
    const t: DocumentFragment<BarProps>[] = [{ aString: Faker.random.alphaNumeric(10) }, { aString: Faker.random.alphaNumeric(10) }, { aString: Faker.random.alphaNumeric(10) }]
    const docs = await Bar.insertMany(t)
    assert(docs.length === t.length)
    assert(docs!.reduce((prev, curr) => prev && ObjectID.isValid(curr._id), true))
    docs.forEach((doc, i) => assert(doc.aString === t[i].aString))
  })

  it('can identify a single document', async () => {
    const t: DocumentFragment<BarProps> = { aString: 'foo' }
    await Bar.insertOneStrict(t)
    const id = await Bar.identifyOne({ aString: 'foo' })
    assert(id)
  })

  it('can identify multiple documents', async () => {
    const t: DocumentFragment<BarProps>[] = [{ aString: 'bar' }, { aString: 'bar' }, { aString: 'bar' }]
    await Bar.insertMany(t)
    const ids = await Bar.identifyMany({ aString: 'bar' })
    assert(ids.length === t.length)
  })

  it('should throw if required fields are missing during insertion', async () => {
    let didThrow = true

    try {
      await Bar.insertOneStrict({ aNumber: 6 }).catch(err => { throw err })
      didThrow = false
    }
    catch (err) {}

    assert(didThrow)
  })

  it('can format documents according to the schema', async () => {
    const t: DocumentFragment<BarProps> = { aFormattedString: Faker.random.alphaNumeric(10) }
    const res = await Bar.formatDocument(t)
    assert(Bar.formatProps.aFormattedString(t.aFormattedString!) === res.aFormattedString)
  })

  it('can encrypt document fields according to the schema', async () => {
    const s = Faker.random.alphaNumeric(10)
    const t: DocumentFragment<BarProps> = { anEncryptedString: s }
    const res = await Bar.formatDocument(t)
    assert(await bcrypt.compare(s, res.anEncryptedString!))
  })

  it('should automatically generate default values on insert', async () => {
    const t: DocumentFragment<BarProps> = { aString: Faker.random.alphaNumeric(10) }
    const res = await Bar.insertOneStrict(t)
    assert(res.aBoolean === Bar.defaultProps.aBoolean)
  })

  it('should automatically format values on insert according to the schema', async () => {
    const t: DocumentFragment<BarProps> = { aString: Faker.random.alphaNumeric(10), aFormattedString: Faker.random.alphaNumeric(10) }
    const res = await Bar.insertOneStrict(t)
    assert(Bar.formatProps.aFormattedString(t.aFormattedString!) === res.aFormattedString)
  })

  it('can update an existing doc', async () => {
    const s = Faker.random.alphaNumeric(10)
    const t: DocumentFragment<BarProps> = { aString: Faker.random.alphaNumeric(10) }
    await Bar.insertOneStrict(t)
    const updated = await Bar.updateOneStrict(t, { aString: s }, { returnDoc: true })
    assert((updated as Document<BarProps>).aString === s)
  })

  it('can update a field of an embedded doc within a doc', async () => {
    const s = Faker.random.alphaNumeric(10)
    const t = { aString: s }
    let bar = await Bar.insertOneStrict(t)
    bar = await Bar.updateOneStrict(bar._id, { 'anObject.aString': 'foo' } as any, { returnDoc: true }) as Document<BarProps>
    assert(bar.anObject && bar.anObject.aString === 'foo')
  })

  it('can upsert a doc if it does not already exist', async () => {
    const s = Faker.random.alphaNumeric(10)
    const t: DocumentFragment<BarProps> = { aString: s }
    await Bar.updateOneStrict(t, { aFormattedString: Faker.random.alphaNumeric(10) }, { upsert: true })
    await Bar.findOneStrict({ aString: s })
  })

  it('cannot upsert a doc if `allowUpserts` is not enabled in the schema', async () => {
    const s = Faker.random.alphaNumeric(10)
    const t: DocumentFragment<FooProps> = { aString: s }
    let didThrow = true

    try {
      await Foo.updateOneStrict(t, { aString: Faker.random.alphaNumeric(10) }, { upsert: true })
      didThrow = false
    }
    catch (err) {}

    assert(didThrow)
  })

  it('should return `false` if update fails and `returnDoc` is `false`', async () => {
    const res = await Bar.updateOne(new ObjectID(), { aString: Faker.random.alphaNumeric(10) })
    assert(res === false)
  })

  it('should return `undefined` if update fails and `returnDoc` is `true`', async () => {
    const res = await Bar.updateOne(new ObjectID(), { aString: Faker.random.alphaNumeric(10) }, { returnDoc: true })
    assert(_.isUndefined(res))
  })

  it('should automatically format values on update according to the schema', async () => {
    const s = Faker.random.alphaNumeric(10)
    const t = Faker.random.alphaNumeric(10)

    await Bar.insertOne({ aString: s })
    const res = await Bar.updateOne({ aString: s }, { aFormattedString: t }, { returnDoc: true })

    assert(!_.isNil(res))
    assert((res as Document<BarProps>).aFormattedString !== t)
    assert((res as Document<BarProps>).aFormattedString === Bar.formatProps.aFormattedString(t))
  })

  it('should automatically format values on upsert according to the schema', async () => {
    const s = Faker.random.alphaNumeric(10)
    const res = await Bar.updateOne({ aString: Faker.random.alphaNumeric(10) }, { aFormattedString: s }, { upsert: true, returnDoc: true })

    assert(!_.isNil(res))
    assert(!_.isBoolean(res))
    assert((res as Document<BarProps>).aFormattedString !== s)
    assert((res as Document<BarProps>).aFormattedString === Bar.formatProps.aFormattedString(s))
  })

  it('can update multiple existing docs', async () => {
    const s = Faker.random.alphaNumeric(10)
    const t = Faker.random.alphaNumeric(10)
    const q: DocumentFragment<BarProps>[] = [{ aString: s }, { aString: s }, { aString: s }]
    const docs = await Bar.insertMany(q)

    assert(docs)
    assert(docs!.reduce((prev, curr) => prev && ObjectID.isValid(curr._id), true))

    const res = await Bar.updateMany({ aString: s }, { aString: t }, { returnDocs: true }) as Document<BarProps>[]

    assert(res.length === docs.length)
    assert(res.reduce((o, v) => o && (v.aString === t), true))
  })

  it('can upsert a doc in an `updateMany` op while `returnDocs` is `true`', async () => {
    const s = Faker.random.alphaNumeric(10)
    const t = Faker.random.alphaNumeric(10)

    const res = await Bar.updateMany({ aString: s }, { aFormattedString: t }, { returnDocs: true, upsert: true }) as Document<BarProps>[]

    assert(res.length === 1)
    assert(!_.isNil(await Bar.findOne({ aString: s })))
  })

  it('can upsert a doc in an `updateMany` op while `returnDocs` is fa`lse', async () => {
    const s = Faker.random.alphaNumeric(10)
    const t = Faker.random.alphaNumeric(10)

    const res = await Bar.updateMany({ aString: s }, { aFormattedString: t }, { upsert: true }) as boolean

    assert(res === true)
    assert(!_.isNil(await Bar.findOne({ aString: s })))
  })

  it('can delete a doc', async () => {
    const s = Faker.random.alphaNumeric(10)

    await Bar.insertOne({ aString: s })

    assert((await Bar.findOne({ aString: s })) !== undefined)

    const res = await Bar.deleteOne({ aString: s })

    assert(res === true)
    assert(_.isUndefined(await Bar.findOne({ aString: s })))
  })

  it('can delete a doc and return the deleted doc', async () => {
    const s = Faker.random.alphaNumeric(10)
    const doc = await Bar.insertOneStrict({ aString: s })

    assert((await Bar.findOne({ aString: s })) !== undefined)

    const objectId = doc._id

    const res = await Bar.deleteOne({ aString: s }, { returnDoc: true })

    assert(res !== undefined)
    assert((res as Document<BarProps>)._id.equals(objectId))
    assert(_.isUndefined(await Bar.findOne({ aString: s })))
  })

  it('can delete multiple docs', async () => {
    const s = Faker.random.alphaNumeric(10)

    await Bar.insertMany([{ aString: s }, { aString: s }, { aString: s }])

    assert((await Bar.count({ aString: s })) === 3)

    await Bar.deleteMany({ aString: s })

    assert((await Bar.count({ aString: s })) === 0)
  })

  it('can delete multiple docs and return the deleted docs', async () => {
    const s = Faker.random.alphaNumeric(10)

    await Bar.insertMany([{ aString: s }, { aString: s }, { aString: s }])

    assert((await Bar.count({ aString: s })) === 3)

    const res = await Bar.deleteMany({ aString: s }, { returnDocs: true })

    assert(_.isArray(res))
    assert((res as Document<BarProps>[]).length === 3)
  })

  it('can replace an existing doc and return the old doc', async () => {
    const s = Faker.random.alphaNumeric(10)
    const t = Faker.random.alphaNumeric(10)

    await Bar.insertOne({ aString: s })

    const doc = await Bar.findAndReplaceOneStrict({ aString: s }, { aString: t }, { returnDocument: 'before' })

    assert(!_.isNil(doc))
    assert(doc.aString === s)
  })

  it('can replace an existing doc and return the new doc', async () => {
    const s = Faker.random.alphaNumeric(10)
    const t = Faker.random.alphaNumeric(10)

    await Bar.insertOne({ aString: s })

    const doc = await Bar.findAndReplaceOneStrict({ aString: s }, { aString: t }, { returnDocument: 'after' })

    assert(!_.isNil(doc))
    assert(doc.aString === t)
  })

  it('can remove a property of a doc by updating it to `undefined`', async () => {
    const baz = await Bar.insertOneStrict()
    assert(baz.aNumber)
    await Bar.updateOneStrict(baz._id, { aNumber: undefined })
    const res = await Bar.findOneStrict(baz._id)
    assert(_.isUndefined(res.aNumber))
  })

  it('can upsert a document while setting an update field to `undefined`', async () => {
    const t = Faker.random.alphaNumeric(10)
    const exists = await Bar.exists({ aString: t })
    assert(!exists)
    const baz = await Bar.updateOneStrict({ aString: t }, { aNumber: undefined }, { upsert: true, returnDoc: true })
    assert(baz)
    assert(_.isUndefined((baz as Document<BarProps>).aNumber))
  })
})

interface FooObject {
  foo: {
    aString: string
    aNumber?: number
  }
  bar?: {
    aString: string
    aNumber?: number
  }
}

interface FooProps {
  aString: string
  aNumber: number
  aBar: ObjectID
  aFoo?: ObjectID
  anObject?: FooObject
}

const FooSchema: Schema<FooProps> = {
  model: 'Foo',
  collection: 'foos',
  timestamps: true,
  fields: {
    aString: { type: String, required: true },
    aNumber: { type: Number, required: true },
    aBar: { type: ObjectID, ref: 'Bar', required: true },
    aFoo: { type: ObjectID, ref: 'Foo' },
    anObject: {
      type: {
        foo: {
          type: {
            aString: { type: String },
            aNumber: { type: Number },
          },
        },
        bar: {
          type: {
            aString: { type: String },
            aNumber: { type: Number },
          },
        },
      },
    },
  },
  indexes: [{
    spec: { aString: 1 }, options: { unique: true },
  }],
}

class Foo extends Model(FooSchema) {
  static randomProps = {
    aNumber: () => (Math.floor(Math.random() * 1000) + 0),
  }

  static formatProps = {
    aString: (value: string): string => (value.trim()),
  }

  static validateProps = {
    aNumber: (value: number) => ((value >= 0 && value <= 1000)),
  }

  static defaultProps = {
    aNumber: 100,
  }
}

interface BarProps {
  aBar: ObjectID
  aString: string
  aDate: Date
  anObject?: {
    aString: string
    aNumber: number
    aBoolean: boolean
  }
  aNumber: number
  aBoolean?: boolean
  aFormattedString?: string
  anEncryptedString?: string
}

const BarSchema: Schema<BarProps> = {
  model: 'Bar',
  collection: 'bars',
  cascade: ['Foo'],
  allowUpserts: true,
  fields: {
    aBar: { type: ObjectID, ref: 'Bar' },
    aString: { type: String, required: true },
    aDate: { type: Date, required: true },
    anObject: {
      type: {
        anObjectIdArray: { type: [ObjectID] },
        aString: { type: String },
        aNumber: { type: Number },
        aBoolean: { type: Boolean },
      },
    },
    aNumber: { type: Number, required: true },
    aBoolean: { type: Boolean },
    aFormattedString: { type: String },
    anEncryptedString: { type: String, encrypted: true },
  },
  indexes: [{
    spec: { aString: 1 },
  }],
}

class Bar extends Model(BarSchema) {
  static randomProps = {
    aString: () => (Faker.random.alphaNumeric(10)),
    aNumber: () => (Math.floor(Math.random() * 1000) + 0),
  }

  static defaultProps = {
    aDate: () => new Date(),
    aNumber: 100,
    aBoolean: false,
  }

  static validateProps = {
    aString: 100,
    aNumber: (value: number) => ((value >= 0 && value <= 1000)),
  }

  static formatProps = {
    aFormattedString: (v: string) => v.toUpperCase(),
  }
}
