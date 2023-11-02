import assert from 'assert'
import Chance from 'chance'
import _ from 'lodash'
import { describe, it } from 'mocha'
import { ObjectId, type Db } from 'mongodb'
import { Bar } from '../../__mocks__/models.js'
import { configureDb, getDbConnection } from '../../index.js'
import { findOneAndReplace } from './replace.js'

const chance = new Chance()

describe('core/crud/replace', () => {
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
      models: { Bar },
    })

    db = await getDbConnection()?.getDbInstance()
    await db?.dropDatabase()
  })

  it('can replace an existing doc and return the old doc', async () => {
    const s = chance.string({ length: 10 })
    const collection = db?.collection('bars')

    await collection?.insertOne({ aString: s })

    const [oldDoc] = await findOneAndReplace(Bar.schema, { aString: s }, randomBarProps())

    assert(!_.isNil(oldDoc))
    assert(oldDoc.aString === s)
  })

  it('can replace an existing doc and return the new doc', async () => {
    const s = chance.string({ length: 10 })
    const t = chance.string({ length: 10 })
    const collection = db?.collection('bars')

    await collection?.insertOne({ aString: s })

    const [, newDoc] = await findOneAndReplace(Bar.schema, { aString: s }, { ...randomBarProps(), aString: t })

    assert(!_.isNil(newDoc))
    assert(newDoc.aString === t)
  })
})
