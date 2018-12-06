import is from '@sindresorhus/is';
import assert from 'assert';
import { before, describe, it } from 'mocha';
import { configureDb, connectToDb, disconnectFromDb, getDbInstance, isDbConnected } from '.';

describe('can connect to a database', () => {
  before(async () => {
    configureDb({
      host: 'localhost:27017',
      name: 'mongodb_odm_test',
    });
  });

  it('can connect to db', async () => {
    await connectToDb();
    assert(isDbConnected() === true);
  });

  it('can disconnect', async () => {
    await disconnectFromDb();
    assert(isDbConnected() === false);
  });

  it('can fetch db instance', async () => {
    const db = await getDbInstance();
    assert(is.nullOrUndefined(db) === false);
  });
});
