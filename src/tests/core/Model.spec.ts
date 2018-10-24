import assert from 'assert';
import bcrypt from 'bcrypt';
import { describe, it } from 'mocha';
import { ObjectID } from 'mongodb';
import * as db from '../..';
import Baz, { BazDocument } from '../models/Baz';
import Foo from '../models/Foo';

db.configure({
  host: 'localhost:27017',
  name: 'mongodb_odm_test',
});

describe('core/Model', () => {
  before(async () => {
    await (await db.getInstance()).dropDatabase();
  });

  it('throws an error if the model has no schema defined', async () => {
    assert(Foo.schema);
  });

  it('can find a document', async () => {
    const t: Partial<BazDocument> = { aString: '0' };
    const res = await Baz.insertOne(t);

    assert(res);

    const doc = await Baz.findOne(res!._id);

    assert(doc);
    assert(doc!._id!.equals(res!._id!));
  });

  it('can find multiple documents', async () => {
    await Baz.insertOne({ aString: 'Hello, world!'});
    await Baz.insertOne({ aString: 'Hello, world!'});
    await Baz.insertOne({ aString: 'Hello, world!'});

    const docs = await Baz.findMany({ aString: 'Hello, world!' });

    assert(docs.length === 3);
  });

  it('can find a random document', async () => {
    const doc = await Baz.findOne();
    assert(doc);
  });

  it('can count the total number of documents in the collection', async () => {
    await Baz.insertOne({ aString: 'Hello, world, again!'});
    await Baz.insertOne({ aString: 'Hello, world, again!'});
    await Baz.insertOne({ aString: 'Hello, world, again!'});

    const count = await Baz.count({ aString: 'Hello, world, again!' });

    assert(count === 3);
  });

  it('can generate random required fields', async () => {
    const res = await Baz.randomFields();
    assert(Object.keys(res).indexOf('aString') > -1);
  });

  it('can insert a new document', async () => {
    const t: Partial<BazDocument> = { aString: 'foo' };
    const doc = await Baz.insertOne<BazDocument>(t);

    assert(doc);
    assert(ObjectID.isValid(doc!._id!));
    assert(doc!.aString === t.aString);
  });

  it('can insert multiple documents', async () => {
    const t: Partial<BazDocument>[] = [{ aString: 'a' }, { aString: 'b' }, { aString: 'c' }];
    const docs = await Baz.insertMany<BazDocument>(t);

    assert(docs);
    assert(docs!.reduce((prev, curr) => prev && ObjectID.isValid(curr._id!), true));

    docs!.forEach((doc, i) => assert(doc.aString === t[i].aString));
  });

  it('should throw if required fields are missing during insertion', async () => {
    let didThrow = true;

    try {
      await Baz.insertOne({ aNumber: 6 }).catch(err => { throw err; });
      didThrow = false;
    }
    catch (err) {}

    assert(didThrow);
  });

  it('can format documents according to the schema', async () => {
    const t: Partial<BazDocument> = { aFormattedString: 'foo' };
    const res = await Baz.formatDocument(t);
    assert(Baz.schema.fields.aFormattedString.format!(t.aFormattedString) === res.aFormattedString);
  });

  it('can encrypt document fields according to the schema', async () => {
    const t: Partial<BazDocument> = { anEncryptedString: 'foo' };
    const res = await Baz.formatDocument(t);
    assert(await bcrypt.compare('foo', res.anEncryptedString!));
  });

  it('should automatically generate default values on insert', async () => {
    const t: Partial<BazDocument> = { aString: 'foo' };
    const res = await Baz.insertOne(t);
    assert(res!.aBoolean === Baz.schema.fields.aBoolean.default);
  });

  it('should automatically format values on insert according to the schema', async () => {
    const t: Partial<BazDocument> = { aString: 'foo', aFormattedString: 'foo' };
    const res = await Baz.insertOne(t);
    assert(Baz.schema.fields.aFormattedString.format!(t.aFormattedString) === res!.aFormattedString);
  });

  it('can update an existing doc', async () => {
    const t: Partial<BazDocument> = { aString: 'foo' };
    const original = await Baz.insertOne(t);
    const updated = await Baz.updateOne(t, { aString: 'bar' }, { returnDoc: true });

    assert((updated! as Partial<BazDocument>).aString === 'bar');
  });

  // it('can upate multiple existing docs', async () => {
  //   const t: Partial<BazDocument>[] = [{ aString: 'baz' }, { aString: 'baz' }, { aString: 'baz' }];
  //   const docs = await Baz.insertMany<BazDocument>(t);

  //   assert(docs);
  //   assert(docs!.reduce((prev, curr) => prev && ObjectID.isValid(curr._id!), true));

  //   const res = await Baz.updateMany())
  //   docs!.forEach((doc, i) => assert(doc.aString === t[i].aString));
  // });

  it('should automatically format values on update according to the schema', async () => {

  });

  it('should automatically format values on upsert according to the schema', async () => {

  });
});
