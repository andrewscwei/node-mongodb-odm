import assert from 'assert'
import Faker from 'faker'
import { describe, it } from 'mocha'
import { Db } from 'mongodb'
import { configureDb, getDbConnection } from '../..'
import { Bar } from '../../index.spec'
import { findAll, findMany, findOne, findOneRandom } from './find'

describe('core/crud/find', () => {
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

  it('can find a document', async () => {
    const t = { aString: Faker.random.alphaNumeric(10) }
    const collection = db?.collection('bars')
    const res = await collection?.insertOne(t)

    assert(res && res.insertedId && res.insertedId)

    const doc = await findOne(Bar.schema, res.insertedId)

    assert(doc._id.equals(res.insertedId))
  })

  it('can find multiple documents', async () => {
    const s = Faker.random.alphaNumeric(10)
    const collection = db?.collection('bars')

    await collection?.insertOne({ aString: s })
    await collection?.insertOne({ aString: s })
    await collection?.insertOne({ aString: s })

    const docs = await findMany(Bar.schema, { aString: s })

    assert(docs.length === 3)
  })

  it('can find all documents', async () => {
    const docs = await findAll(Bar.schema)

    assert(docs.length === 4)
  })

  it('can find a random document', async () => {
    await findOneRandom(Bar.schema)
  })
})
