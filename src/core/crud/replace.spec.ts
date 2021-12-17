import assert from 'assert'
import Faker from 'faker'
import _ from 'lodash'
import { describe, it } from 'mocha'
import { Db, ObjectId } from 'mongodb'
import { configureDb, getDbConnection } from '../..'
import { Bar } from '../../index.spec'
import { findOneAndReplace } from './replace'

describe('core/crud/replace', () => {
  let db: Db | undefined

  function randomBarProps() {
    return {
      aBar: new ObjectId(),
      aString: Faker.random.alphaNumeric(10),
      aDate: Faker.date.recent(),
      aNumber: Faker.datatype.number(),
    }
  }

  before(async () => {
    configureDb({
      host: process.env.MONGODB_HOST ?? 'localhost:27017',
      name: 'mongodb_odm_test',
      models: { Bar },
    })

    db = await getDbConnection()?.getDbInstance()
    await db?.dropDatabase()
  })

  it('can replace an existing doc and return the old doc', async () => {
    const s = Faker.random.alphaNumeric(10)
    const collection = db?.collection('bars')

    await collection?.insertOne({ aString: s })

    const [oldDoc] = await findOneAndReplace(Bar.schema, { aString: s }, randomBarProps())

    assert(!_.isNil(oldDoc))
    assert(oldDoc.aString === s)
  })

  it('can replace an existing doc and return the new doc', async () => {
    const s = Faker.random.alphaNumeric(10)
    const t = Faker.random.alphaNumeric(10)
    const collection = db?.collection('bars')

    await collection?.insertOne({ aString: s })

    const [oldDoc, newDoc] = await findOneAndReplace(Bar.schema, { aString: s }, { ...randomBarProps(), aString: t })

    assert(!_.isNil(newDoc))
    assert(newDoc.aString === t)
  })
})
