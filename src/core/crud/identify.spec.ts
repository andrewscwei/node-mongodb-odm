import assert from 'assert'
import { describe, it } from 'mocha'
import { type Db } from 'mongodb'
import { configureDb, getDbConnection } from '../..'
import { Bar } from '../../__mocks__/models'
import { identifyMany, identifyOne } from './identify'

describe('core/crud/identify', () => {
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

  it('can identify a single document', async () => {
    const t = { aString: 'foo' }
    const collection = db?.collection('bars')
    await collection?.insertOne(t)
    const id = await identifyOne(Bar.schema, { aString: 'foo' })
    assert(id)
  })

  it('can identify multiple documents', async () => {
    const t = [{ aString: 'bar' }, { aString: 'bar' }, { aString: 'bar' }]
    const collection = db?.collection('bars')
    await collection?.insertMany(t)
    const ids = await identifyMany(Bar.schema, { aString: 'bar' })
    assert(ids.length === t.length)
  })

  it('can identify a single document by its ID', async () => {
    const t = { aString: 'foo' }
    const collection = db?.collection('bars')
    const doc = await collection?.insertOne(t)
    assert(doc?.insertedId !== undefined)
    const id = await identifyOne(Bar.schema, doc?.insertedId.toString())
    assert(id.equals(doc.insertedId))
  })
})
