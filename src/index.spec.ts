import assert from 'assert'
import _ from 'lodash'
import { before, describe, it } from 'mocha'
import { configureDb, getDbConnection } from '.'

describe('can connect to a database', () => {
  before(async () => {
    configureDb({
      host: process.env.MONGODB_HOST ?? 'localhost:27017',
      name: 'mongodb_odm_test',
    })
  })

  it('can connect to db', async () => {
    const connection = getDbConnection()
    await connection.connect()
    assert(connection.isConnected() === true)
  })

  it('can disconnect', async () => {
    const connection = getDbConnection()
    await connection.disconnect()
    assert(connection.isConnected() === false)
  })

  it('can fetch db instance', async () => {
    const db = await getDbConnection().getDbInstance()
    assert(_.isNil(db) === false)
  })
})
