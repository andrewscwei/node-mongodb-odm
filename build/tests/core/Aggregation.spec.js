"use strict";
/* tslint:disable max-classes-per-file */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const is_1 = __importDefault(require("@sindresorhus/is"));
const assert_1 = __importDefault(require("assert"));
const lodash_1 = __importDefault(require("lodash"));
const mocha_1 = require("mocha");
const mongodb_1 = require("mongodb");
const db = __importStar(require("../../"));
const Aggregation_1 = __importDefault(require("../../core/Aggregation"));
const Bar_1 = __importStar(require("../models/Bar"));
const Baz_1 = __importDefault(require("../models/Baz"));
const Foo_1 = __importStar(require("../models/Foo"));
mocha_1.describe('core/Aggregation', () => {
    before(() => __awaiter(this, void 0, void 0, function* () {
        db.configureDb({
            host: 'localhost:27017',
            name: 'mongodb_odm_test',
            models: { Foo: Foo_1.default, Bar: Bar_1.default, Baz: Baz_1.default },
        });
    }));
    it('can generate $match stage', () => {
        const objectId = new mongodb_1.ObjectID();
        const actual = Aggregation_1.default.matchStageFactory(Bar_1.BarSchema, { _id: objectId });
        const expected = [{
                $match: { _id: objectId },
            }];
        assert_1.default.deepStrictEqual(Object.keys(actual[0]), ['$match']);
        assert_1.default(is_1.default.directInstanceOf(actual[0].$match._id, mongodb_1.ObjectID));
        assert_1.default(expected[0].$match._id.equals(actual[0].$match._id));
    });
    it('can generate $lookup stage', () => {
        assert_1.default.deepStrictEqual(Aggregation_1.default.lookupStageFactory(Foo_1.FooSchema, { aBar: true }), [{
                $lookup: { from: 'bars', localField: 'aBar', foreignField: '_id', as: 'aBar' },
            }, {
                $unwind: { path: '$aBar', preserveNullAndEmptyArrays: true },
            }]);
        assert_1.default.deepStrictEqual(Aggregation_1.default.lookupStageFactory(Foo_1.FooSchema, { aBar: { aBar: true } }), [{
                $lookup: { from: 'bars', localField: 'aBar', foreignField: '_id', as: 'aBar' },
            }, {
                $unwind: { path: '$aBar', preserveNullAndEmptyArrays: true },
            }, {
                $lookup: { from: 'bars', localField: 'aBar.aBar', foreignField: '_id', as: 'aBar.aBar' },
            }, {
                $unwind: { path: '$aBar.aBar', preserveNullAndEmptyArrays: true },
            }]);
        assert_1.default.deepStrictEqual(Aggregation_1.default.lookupStageFactory(Foo_1.FooSchema, { aBar: { aBar: true }, aFoo: true }), [{
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
        assert_1.default.deepStrictEqual(Aggregation_1.default.lookupStageFactory(Foo_1.FooSchema, { aBar: { aBar: true }, aFoo: true }, { fromPrefix: 'foo.', toPrefix: 'bar.' }), [{
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
        assert_1.default.deepStrictEqual(Aggregation_1.default.groupStageFactory(Foo_1.FooSchema, 'foo'), [{
                $group: { _id: '$foo' },
            }]);
        assert_1.default.deepStrictEqual(Aggregation_1.default.groupStageFactory(Foo_1.FooSchema, {
            _id: '$foo',
            bar: '$bar',
        }), [{
                $group: {
                    _id: '$foo',
                    bar: '$bar',
                },
            }]);
    });
    it('can generate $sort stage', () => {
        assert_1.default.deepStrictEqual(Aggregation_1.default.sortStageFactory(Foo_1.FooSchema, {
            a: 1,
            b: -1,
        }), [{
                $sort: {
                    a: 1,
                    b: -1,
                },
            }]);
    });
    it('can generate $project stage for an entire schema', () => {
        assert_1.default.deepStrictEqual(Aggregation_1.default.projectStageFactory(Foo_1.FooSchema), [{
                $project: Object.assign({}, lodash_1.default.mapValues(Foo_1.FooSchema.fields, (value, key) => `$${key}`), { _id: '$_id', createdAt: '$createdAt', updatedAt: '$updatedAt' }),
            }]);
    });
    it('can generate $project stage with prefixes for an entire schema and its foreign keys', () => {
        assert_1.default.deepStrictEqual(Aggregation_1.default.projectStageFactory(Foo_1.FooSchema, { populate: { aBar: true }, fromPrefix: 'foo.', toPrefix: 'bar.' }), [{
                $project: Object.assign({}, lodash_1.default(Foo_1.FooSchema.fields).mapValues((v, k) => `$foo.${k}`).mapKeys((v, k) => `bar.${k}`).value(), { ['bar._id']: '$foo._id', ['bar.createdAt']: '$foo.createdAt', ['bar.updatedAt']: '$foo.updatedAt', ['bar.aBar']: Object.assign({}, lodash_1.default(Bar_1.BarSchema.fields).mapValues((v, k) => `$${k}`).value(), { ['_id']: '$_id' }) }),
            }]);
    });
    it('can generate $project stage with exclusions for a schema', () => {
        assert_1.default.deepStrictEqual(Aggregation_1.default.projectStageFactory(Foo_1.FooSchema, {
            exclude: ['createdAt', 'updatedAt'],
        }), [{
                $project: Object.assign({ ['_id']: '$_id' }, lodash_1.default(Foo_1.FooSchema.fields).mapValues((v, k) => `$${k}`).value()),
            }]);
    });
    it('can generate a full aggregation pipeline', () => {
        const objectId = new mongodb_1.ObjectID();
        assert_1.default.deepStrictEqual(Aggregation_1.default.pipelineFactory(Foo_1.FooSchema), []);
        const actual = Aggregation_1.default.pipelineFactory(Foo_1.FooSchema, {
            $match: objectId,
        });
        const expected = [
            ...Aggregation_1.default.matchStageFactory(Foo_1.FooSchema, objectId),
        ];
        assert_1.default(actual.length === expected.length);
        assert_1.default(is_1.default.object(actual[0]));
        assert_1.default(actual[0].hasOwnProperty('$match'));
        assert_1.default(objectId.equals(expected[0].$match._id));
    });
});
//# sourceMappingURL=Aggregation.spec.js.map