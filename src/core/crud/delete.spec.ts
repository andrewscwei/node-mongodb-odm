import assert from 'assert'
import Chance from 'chance'
import _ from 'lodash'
import { describe, it } from 'mocha'
import { type Db } from 'mongodb'
import { configureDb, getDbConnection } from '../..'
import { Bar } from '../../__mocks__/models'
import { deleteMany, deleteOne } from './delete'

const chance = new Chance()

describe('core/crud/delete', () => {
  let db: Db | undefined

  before(async () => {
    configureDb({
      host: process.env.MONGODB_HOST ?? 'localhost:27017',
      name: 'mongodb_odm_test',
      models: { Bar },
    })

    db = await getDbConnection()?.getDbInstance()
    await db?.dropDatabase()
  })

  it('can delete a doc', async () => {
    const s = chance.string({ length: 10 })
    const collection = db?.collection('bars')

    await collection?.insertOne({ aString: s })

    const res = await deleteOne(Bar.schema, { aString: s })

    assert(res === true)
    assert(_.isUndefined(await Bar.findOne({ aString: s })))
  })

  it('can delete multiple docs', async () => {
    const s = chance.string({ length: 10 })
    const collection = db?.collection('bars')
    const insertRes = await collection?.insertMany([{ aString: s }, { aString: s }, { aString: s }])

    assert(insertRes?.acknowledged && insertRes?.insertedCount === 3)

    await deleteMany(Bar.schema, { aString: s })

    assert(await collection?.count({ aString: s }) === 0)
  })
})
