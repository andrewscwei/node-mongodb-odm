/* tslint:disable max-classes-per-file */

import assert from 'assert';
import _ from 'lodash';
import { describe, it } from 'mocha';
import { ObjectID } from 'mongodb';
import * as db from '../';
import { Schema } from '../types';
import Aggregation from './Aggregation';
import Model from './Model';
import withSchema from './withSchema';

const FooSchema: Schema = {
  model: 'Foo',
  collection: 'foos',
  timestamps: true,
  fields: {
    aString: {
      type: String,
      required: true,
      format: (value: string): string => (value.trim()),
    },
    aNumber: {
      type: Number,
      required: true,
      default: 100,
      validate: (value: number) => ((value >= 0 && value <= 1000)),
      random: () => (Math.floor(Math.random() * 1000) + 0),
    },
    aBar: {
      type: ObjectID,
      ref: 'Bar',
      required: true,
    },
    aFoo: {
      type: ObjectID,
      ref: 'Foo',
    },
  },
  indexes: [{
    spec: { label: 1 }, options: { unique: true },
  }],
};

const BarSchema = {
  model: 'Bar',
  collection: 'bars',
  cascade: ['Foo'],
  fields: {
    aBar: {
      type: ObjectID,
      ref: 'Bar',
      required: true,
    },
    aString: {
      type: String,
      required: true,
      validate: 100,
    },
    aDate: {
      type: Date,
      required: true,
      default: () => (new Date()),
    },
    anObject: {
      type: {
        aString: { type: String },
        aNumber: { type: Number },
        aBoolean: { type: Boolean },
      },
    },
    aNumber: {
      type: Number,
      required: true,
      default: 100,
      validate: (value: number) => ((value >= 0 && value <= 1000)),
      random: () => (Math.floor(Math.random() * 1000) + 0),
    },
    aBoolean: {
      type: Boolean,
      default: false,
    },
  },
  indexes: [{ spec: { source: 1 } }, { spec: { geo: '2dsphere' } }],
};

@withSchema(FooSchema)
class Foo extends Model {}

@withSchema(BarSchema)
class Bar extends Model {}

describe('core/Aggregation', () => {
  before(async() => {
    db.configure({
      host: 'localhost:27017',
      name: 'mongodb_odm_test',
      models: {
        Foo,
        Bar,
      },
    });
  });

  it('can generate $match stage', () => {
    const objectId = (new ObjectID()).toHexString();

    assert.deepStrictEqual(Aggregation.matchStageFactory(BarSchema, { _id: objectId }), [{
      $match: { _id: objectId },
    }]);

    assert.deepStrictEqual(Aggregation.matchStageFactory(BarSchema, objectId), [{
      $match: { _id: objectId },
    }]);
  });

  it('can generate $lookup stage', () => {
    assert.deepStrictEqual(Aggregation.lookupStageFactory(FooSchema, { aBar: true }), [{
      $lookup: { from: 'bars', localField: 'aBar', foreignField: '_id', as: 'aBar' },
    }, {
      $unwind: { path: '$aBar', preserveNullAndEmptyArrays: true },
    }]);

    assert.deepStrictEqual(Aggregation.lookupStageFactory(FooSchema, { aBar: { aBar: true } }), [{
      $lookup: { from: 'bars', localField: 'aBar', foreignField: '_id', as: 'aBar' },
    }, {
      $unwind: { path: '$aBar', preserveNullAndEmptyArrays: true },
    }, {
      $lookup: { from: 'bars', localField: 'aBar.aBar', foreignField: '_id', as: 'aBar.aBar' },
    }, {
      $unwind: { path: '$aBar.aBar', preserveNullAndEmptyArrays: true },
    }]);

    assert.deepStrictEqual(Aggregation.lookupStageFactory(FooSchema, { aBar: { aBar: true }, aFoo: true }), [{
      $lookup: { from: 'bars', localField: 'aBar', foreignField: '_id', as: 'aBar' },
    }, {
      $unwind: { path: '$aBar', preserveNullAndEmptyArrays: true },
    }, {
      $lookup: { from: 'bars', localField: 'aBar.aBar', foreignField: '_id', as: 'aBar.aBar' },
    }, {
      $unwind: { path: '$aBar.aBar', preserveNullAndEmptyArrays: true },
    }, {
      $lookup: { from: 'foos', localField: 'aFoo', foreignField: '_id', as: 'aFoo' },
    }, {
      $unwind: { path: '$aFoo', preserveNullAndEmptyArrays: true },
    }]);

    assert.deepStrictEqual(Aggregation.lookupStageFactory(FooSchema, { aBar: { aBar: true }, aFoo: true }, { fromPrefix: 'foo.', toPrefix: 'bar.' }), [{
      $lookup: { from: 'bars', localField: 'foo.aBar', foreignField: '_id', as: 'bar.aBar' },
    }, {
      $unwind: { path: '$bar.aBar', preserveNullAndEmptyArrays: true },
    }, {
      $lookup: { from: 'bars', localField: 'bar.aBar.aBar', foreignField: '_id', as: 'bar.aBar.aBar' },
    }, {
      $unwind: { path: '$bar.aBar.aBar', preserveNullAndEmptyArrays: true },
    }, {
      $lookup: { from: 'foos', localField: 'foo.aFoo', foreignField: '_id', as: 'bar.aFoo' },
    }, {
      $unwind: { path: '$bar.aFoo', preserveNullAndEmptyArrays: true },
    }]);
  });

  it('can generate $group stage', () => {
    assert.deepStrictEqual(Aggregation.groupStageFactory(FooSchema, 'foo'), [{
      $group: { _id: '$foo' }
    }]);

    assert.deepStrictEqual(Aggregation.groupStageFactory(FooSchema, {
      _id: '$foo',
      bar: '$bar',
    }), [{
      $group: {
        _id: '$foo',
        bar: '$bar',
      }
    }]);
  });

  it('can generate $sort stage', () => {
    assert.deepStrictEqual(Aggregation.sortStageFactory(FooSchema, {
      a: 1,
      b: -1,
    }), [{
      $sort: {
        a: 1,
        b: -1,
      }
    }]);
  });

  it('can generate $project stage for an entire schema', () => {
    assert.deepStrictEqual(Aggregation.projectStageFactory(FooSchema), [{
      $project: {
        ..._.mapValues(FooSchema.fields, (value: any, key: string) => `$${key}`),
        _id: '$_id',
        createdAt: '$createdAt',
        updatedAt: '$updatedAt',
      },
    }]);
  });

  it('can generate $project stage with prefixes for an entire schema and its foreign keys', () => {
    assert.deepStrictEqual(Aggregation.projectStageFactory(FooSchema, { populate: { aBar: true }, fromPrefix: 'foo.', toPrefix: 'bar.' }), [{
      $project: {
        ..._(FooSchema.fields).mapValues((v, k) => `$foo.${k}`).mapKeys((v, k) => `bar.${k}`).value(),
        ['bar._id']: '$foo._id',
        ['bar.createdAt']: '$foo.createdAt',
        ['bar.updatedAt']: '$foo.updatedAt',
        ['bar.aBar']: {
          ..._(BarSchema.fields).mapValues((v, k) => `$${k}`).value(),
          ['_id']: '$_id',
        },
      },
    }]);
  });

  it('can generate $project stage with exclusions for a schema', () => {
    assert.deepStrictEqual(Aggregation.projectStageFactory(FooSchema, {
      exclude: ['createdAt', 'updatedAt'],
    }), [{
      $project: {
        ['_id']: '$_id',
        ..._(FooSchema.fields).mapValues((v, k) => `$${k}`).value(),
      },
    }]);
  });

  it('can generate a full aggregation pipeline', () => {
    const objectId = (new ObjectID()).toHexString();

    assert.deepStrictEqual(Aggregation.pipelineFactory(FooSchema), []);

    assert.deepStrictEqual(Aggregation.pipelineFactory(FooSchema, {
      $match: objectId,
    }), [
      ...Aggregation.matchStageFactory(FooSchema, objectId),
    ]);

    assert.deepStrictEqual(Aggregation.pipelineFactory(FooSchema, {
      $match: objectId,
      $lookup: { aBar: true },
    }), [
      ...Aggregation.matchStageFactory(FooSchema, objectId),
      ...Aggregation.lookupStageFactory(FooSchema, { aBar: true }),
    ]);
  });
});
