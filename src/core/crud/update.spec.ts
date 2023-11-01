import assert from 'assert'
import Chance from 'chance'
import _ from 'lodash'
import { describe, it } from 'mocha'
import { ObjectId, type Db } from 'mongodb'
import { configureDb, getDbConnection } from '../..'
import { Bar, Foo, type BarProps } from '../../index.spec'
import { type DocumentFragment } from '../../types'
import { findManyAndUpdate, findOneAndUpdate, updateMany, updateOne } from './update'

const chance = new Chance()

describe('core/crud/update', () => {
  let db: Db | undefined

  before(async () => {
    configureDb({
      host: process.env.MONGODB_HOST ?? 'localhost:27017',
      name: 'mongodb_odm_test',
      models: { Foo, Bar },
    })

    db = await getDbConnection()?.getDbInstance()
    await db?.dropDatabase()
  })

  it('can update an existing doc', async () => {
    const s = chance.string({ length: 10 })
    const t = { aString: chance.string({ length: 10 }) }
    const collection = db?.collection('bars')
    await collection?.insertOne(t)
    const [, newDoc] = await findOneAndUpdate(Bar.schema, t, { $set: { aString: s } })
    assert(newDoc.aString === s)
  })

  it('can update a field of an embedded doc within a doc', async () => {
    const s = chance.string({ length: 10 })
    const t = { aString: s }
    const collection = db?.collection('bars')
    const insertRes = await collection?.insertOne(t)

    assert(insertRes?.acknowledged && insertRes?.insertedId)

    const [, newDoc] = await findOneAndUpdate(Bar.schema, { _id: insertRes.insertedId }, { $set: { 'anObject.aString': 'foo' } })

    assert(newDoc.anObject && newDoc.anObject.aString === 'foo')
  })

  it('can upsert a doc if it does not already exist', async () => {
    const s = chance.string({ length: 10 })
    const t = { aString: s }
    const collection = db?.collection('bars')

    await updateOne(Bar.schema, t, { $set: { aFormattedString: chance.string({ length: 10 }) } }, { upsert: true })

    const res = await collection?.findOne({ aString: s })

    assert(res)
  })

  it('cannot upsert a doc if `allowUpserts` is not enabled in the schema', async () => {
    const s = chance.string({ length: 10 })
    const t = { aString: s }
    let didThrow = true

    try {
      await updateOne(Foo.schema, t, { $set: { aString: chance.string({ length: 10 }) } }, { upsert: true })
      didThrow = false
    }
    catch (err) {}

    assert(didThrow)
  })

  it('can update multiple existing docs', async () => {
    const s = chance.string({ length: 10 })
    const t = chance.string({ length: 10 })
    const q: DocumentFragment<BarProps>[] = [{ aString: s }, { aString: s }, { aString: s }]
    const collection = db?.collection('bars')
    const docs = await collection?.insertMany(q)

    assert(docs?.acknowledged && docs?.insertedIds)
    assert(_.values(docs.insertedIds).reduce((out, _id) => out && ObjectId.isValid(_id), true))

    const [, newDocs] = await findManyAndUpdate(Bar.schema, { aString: s }, { $set: { aString: t } })

    assert(newDocs.length === _.values(docs.insertedIds).length)
    assert(newDocs.reduce((out, doc) => out && doc.aString === t, true))
  })

  it('can upsert a doc in an `updateMany` op', async () => {
    const s = chance.string({ length: 10 })
    const t = chance.string({ length: 10 })
    const collection = db?.collection('bars')
    const res = await updateMany(Bar.schema, { aString: s }, { $set: { aFormattedString: t } }, { upsert: true })

    assert(res === true)
    assert(!_.isNil(await collection?.findOne({ aString: s })))
  })
})
