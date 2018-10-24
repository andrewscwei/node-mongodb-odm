import is from '@sindresorhus/is';
import assert from 'assert';
import bcrypt from 'bcrypt';
import Faker from 'faker';
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
    const t: Partial<BazDocument> = { aString: Faker.random.alphaNumeric(10) };
    const res = await Baz.insertOne(t);

    assert(res);

    const doc = await Baz.findOne(res!._id);

    assert(doc);
    assert(doc!._id!.equals(res!._id!));
  });

  it('can find multiple documents', async () => {
    const s = Faker.random.alphaNumeric(10);

    await Baz.insertOne({ aString: s });
    await Baz.insertOne({ aString: s });
    await Baz.insertOne({ aString: s });

    const docs = await Baz.findMany({ aString: s });

    assert(docs.length === 3);
  });

  it('can find a random document', async () => {
    const doc = await Baz.findOne();
    assert(doc);
  });

  it('can count the total number of documents in the collection', async () => {
    const s = Faker.random.alphaNumeric(10);

    await Baz.insertOne({ aString: s });
    await Baz.insertOne({ aString: s });
    await Baz.insertOne({ aString: s });

    const count = await Baz.count({ aString: s });

    assert(count === 3);
  });

  it('can generate random required fields', async () => {
    const res = await Baz.randomFields<BazDocument>();
    assert(is.string(res.aString));
  });

  it('can insert a new document', async () => {
    const t: Partial<BazDocument> = { aString: Faker.random.alphaNumeric(10) };
    const doc = await Baz.insertOne<BazDocument>(t);

    assert(doc);
    assert(ObjectID.isValid(doc!._id!));
    assert(doc!.aString === t.aString);
  });

  it('can insert multiple documents', async () => {
    const t: Partial<BazDocument>[] = [{ aString: Faker.random.alphaNumeric(10) }, { aString: Faker.random.alphaNumeric(10) }, { aString: Faker.random.alphaNumeric(10) }];
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
    const t: Partial<BazDocument> = { aFormattedString: Faker.random.alphaNumeric(10) };
    const res = await Baz.formatDocument(t);
    assert(Baz.schema.fields.aFormattedString.format!(t.aFormattedString) === res.aFormattedString);
  });

  it('can encrypt document fields according to the schema', async () => {
    const s = Faker.random.alphaNumeric(10);
    const t: Partial<BazDocument> = { anEncryptedString: s };
    const res = await Baz.formatDocument(t);
    assert(await bcrypt.compare(s, res.anEncryptedString!));
  });

  it('should automatically generate default values on insert', async () => {
    const t: Partial<BazDocument> = { aString: Faker.random.alphaNumeric(10) };
    const res = await Baz.insertOne(t);
    assert(res!.aBoolean === Baz.schema.fields.aBoolean.default);
  });

  it('should automatically format values on insert according to the schema', async () => {
    const t: Partial<BazDocument> = { aString: Faker.random.alphaNumeric(10), aFormattedString: Faker.random.alphaNumeric(10) };
    const res = await Baz.insertOne(t);
    assert(Baz.schema.fields.aFormattedString.format!(t.aFormattedString) === res!.aFormattedString);
  });

  it('can update an existing doc', async () => {
    const s = Faker.random.alphaNumeric(10);
    const t: Partial<BazDocument> = { aString: Faker.random.alphaNumeric(10) };

    await Baz.insertOne(t);

    const updated = await Baz.updateOne(t, { aString: s }, { returnDoc: true });

    assert((updated! as Partial<BazDocument>).aString === s);
  });

  it('can upsert a doc if it does not already exist', async () => {
    const s = Faker.random.alphaNumeric(10);
    const t: Partial<BazDocument> = { aString: s };

    await Baz.updateOne(t, { aFormattedString: Faker.random.alphaNumeric(10) }, { upsert: true });

    const doc = await Baz.findOne<BazDocument>({ aString: s });

    assert(doc);
  });

  it('should return false if update fails and returnDoc is false', async () => {
    const res = await Baz.updateOne<BazDocument>(new ObjectID(), { aString: Faker.random.alphaNumeric(10) });
    assert(res === false);
  });

  it('should return null if update fails and returnDoc is true', async () => {
    const res = await Baz.updateOne<BazDocument>(new ObjectID(), { aString: Faker.random.alphaNumeric(10) }, { returnDoc: true });
    assert(is.null_(res));
  });

  it('should automatically format values on update according to the schema', async () => {
    const s = Faker.random.alphaNumeric(10);
    const t = Faker.random.alphaNumeric(10);

    await Baz.insertOne<BazDocument>({ aString: s });
    const res = await Baz.updateOne<BazDocument>({ aString: s }, { aFormattedString: t }, { returnDoc: true });

    assert(!is.nullOrUndefined(res));
    assert((res as Partial<BazDocument>).aFormattedString !== t);
    assert((res as Partial<BazDocument>).aFormattedString === Baz.schema.fields.aFormattedString.format!(t));
  });

  it('should automatically format values on upsert according to the schema', async () => {
    const s = Faker.random.alphaNumeric(10);
    const res = await Baz.updateOne<BazDocument>({ aString: Faker.random.alphaNumeric(10) }, { aFormattedString: s }, { upsert: true, returnDoc: true });

    assert(!is.nullOrUndefined(res));
    assert((res as Partial<BazDocument>).aFormattedString !== s);
    assert((res as Partial<BazDocument>).aFormattedString === Baz.schema.fields.aFormattedString.format!(s));
  });

  it('can update multiple existing docs', async () => {
    const s = Faker.random.alphaNumeric(10);
    const t = Faker.random.alphaNumeric(10);
    const q: Partial<BazDocument>[] = [{ aString: s }, { aString: s }, { aString: s }];
    const docs = await Baz.insertMany<BazDocument>(q);

    assert(docs);
    assert(docs!.reduce((prev, curr) => prev && ObjectID.isValid(curr._id!), true));

    const res = await Baz.updateMany<BazDocument>({ aString: s }, { aString: t }, { returnDocs: true }) as Partial<BazDocument>[];

    assert(res.length === docs.length);
    assert(res.reduce((o, v) => o && (v.aString === t), true));
  });

  it('can upsert a doc in an updateMany op while `returnDocs` is true', async () => {
    const s = Faker.random.alphaNumeric(10);
    const t = Faker.random.alphaNumeric(10);

    const res = await Baz.updateMany<BazDocument>({ aString: s }, { aFormattedString: t }, { returnDocs: true, upsert: true }) as Partial<BazDocument>[];

    assert(res.length === 1);
    assert(!is.nullOrUndefined(await Baz.findOne<BazDocument>({ aString: s })));
  });

  it('can upsert a doc in an updateMany op while `returnDocs` is false', async () => {
    const s = Faker.random.alphaNumeric(10);
    const t = Faker.random.alphaNumeric(10);

    const res = await Baz.updateMany<BazDocument>({ aString: s }, { aFormattedString: t }, { upsert: true }) as boolean;

    assert(res === true);
    assert(!is.nullOrUndefined(await Baz.findOne<BazDocument>({ aString: s })));
  });

  it('can delete a doc', async () => {
    const s = Faker.random.alphaNumeric(10);
    const doc = await Baz.insertOne<BazDocument>({ aString: s });

    assert(!is.null_(await Baz.findOne<BazDocument>({ aString: s })));

    const res = await Baz.deleteOne<BazDocument>({ aString: s });

    assert(res === true);
    assert(is.null_(await Baz.findOne<BazDocument>({ aString: s })));
  });

  it('can delete a doc and return the deleted doc', async () => {
    const s = Faker.random.alphaNumeric(10);
    const doc = await Baz.insertOne<BazDocument>({ aString: s });

    assert(!is.null_(await Baz.findOne<BazDocument>({ aString: s })));

    const objectId = doc!._id!;

    const res = await Baz.deleteOne<BazDocument>({ aString: s }, { returnDoc: true });

    assert(!is.null_(res));
    assert((res as Partial<BazDocument>)._id!.equals(objectId));
    assert(is.null_(await Baz.findOne<BazDocument>({ aString: s })));
  });

  it('can delete multiple docs', async () => {
    const s = Faker.random.alphaNumeric(10);

    await Baz.insertMany<BazDocument>([{ aString: s }, { aString: s }, { aString: s }]);

    assert((await Baz.count<BazDocument>({ aString: s })) === 3);

    await Baz.deleteMany<BazDocument>({ aString: s });

    assert((await Baz.count<BazDocument>({ aString: s })) === 0);
  });

  it('can delete multiple docs and return the deleted docs', async () => {
    const s = Faker.random.alphaNumeric(10);

    await Baz.insertMany<BazDocument>([{ aString: s }, { aString: s }, { aString: s }]);

    assert((await Baz.count<BazDocument>({ aString: s })) === 3);

    const res = await Baz.deleteMany<BazDocument>({ aString: s }, { returnDocs: true });

    assert(is.array(res));
    assert((res as Partial<BazDocument>[]).length === 3);
  });
});
