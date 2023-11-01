import assert from 'assert'
import Chance from 'chance'
import { describe, it } from 'mocha'
import { ObjectId, type Db } from 'mongodb'
import { configureDb, getDbConnection } from '../..'
import { Bar, Foo } from '../../__mocks__/models'
import { insertMany, insertOne } from './insert'

const chance = new Chance()

describe('core/crud/insert', () => {
  let db: Db | undefined

  function randomBarProps() {
    return {
      aBar: new ObjectId(),
      aString: chance.string({ length: 10 }),
      aDate: chance.date(),
      aNumber: chance.integer(),
    }
  }

  before(async () => {
    configureDb({
      host: process.env.MONGODB_HOST ?? 'localhost:27017',
      name: 'mongodb_odm_test',
      models: { Foo, Bar },
    })

    db = await getDbConnection()?.getDbInstance()
    await db?.dropDatabase()
  })

  it('can insert a new document', async () => {
    const t = randomBarProps()
    const doc = await insertOne(Bar.schema, t)
    assert(doc.aString === t.aString)
  })

  it('can insert multiple documents', async () => {
    const t = [randomBarProps(), randomBarProps(), randomBarProps()]
    const docs = await insertMany(Bar.schema, t)
    assert(docs.length === t.length)
    assert(docs.reduce((prev, curr) => prev && ObjectId.isValid(curr._id), true))
    docs.forEach((doc, i) => assert(doc.aString === t[i].aString))
  })
})
