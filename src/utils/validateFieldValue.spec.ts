import assert from 'assert';
import { describe, it } from 'mocha';
import { ObjectID } from 'mongodb';
import { FieldSpecs } from '../types';
import validateFieldValue from '../utils/validateFieldValue';

describe('utils/validate', () => {
  it('can validate string length', () => {
    const i = 'Hello, world!';
    assert.doesNotThrow(() => validateFieldValue(i, { type: String, validate: 13 }));
    assert.throws(() => validateFieldValue(i, { type: String, validate: 12 }));
  });

  it('can validate string regex', () => {
    const i = 'Hello, world!';
    assert.doesNotThrow(() => validateFieldValue(i, { type: String, validate: /^Hello.*$/ }));
    assert.throws(() => validateFieldValue(i, { type: String, validate: /^hello.*$/ }));
  });

  it('can validate string from list', () => {
    const i = 'Hello, world!';
    assert.doesNotThrow(() => validateFieldValue(i, { type: String, validate: [i] }));
    assert.throws(() => validateFieldValue(i, { type: String, validate: [] }));
  });

  it('can validate string with custom method', () => {
    const i = 'Hello, world!';
    assert.doesNotThrow(() => validateFieldValue(i, { type: String, validate: (v: string): boolean => (v === i) } as FieldSpecs<any>));
    assert.throws(() => validateFieldValue(i, { type: String, validate: (v: string): boolean => (v !== i) } as FieldSpecs<any>));
  });

  it('can validate numbers with inclusive maximum', () => {
    const i = 6;
    assert.doesNotThrow(() => validateFieldValue(i, { type: Number, validate: 6 }));
    assert.throws(() => validateFieldValue(i, { type: Number, validate: 5 }));
  });

  it('can validate numbers from list', () => {
    const i = 6;
    assert.doesNotThrow(() => validateFieldValue(i, { type: Number, validate: [6] }));
    assert.throws(() => validateFieldValue(i, { type: Number, validate: [] }));
  });

  it('can validate numbers from custom method', () => {
    const i = 6;
    assert.doesNotThrow(() => validateFieldValue(i, { type: Number, validate: (v: number): boolean => (v > 5 && v < 7) } as FieldSpecs<any>));
    assert.throws(() => validateFieldValue(i, { type: Number, validate: (v: number): boolean => (v < 5) } as FieldSpecs<any>));
  });

  it('can validate booleans', () => {
    const i = true;
    assert.doesNotThrow(() => validateFieldValue(i, { type: Boolean }));
  });

  it('can validate dates', () => {
    const i = new Date();
    assert.doesNotThrow(() => validateFieldValue(i, { type: Date }));
  });

  it('can validate arrays', () => {
    assert.doesNotThrow(() => validateFieldValue([0, 1, 2, 3], { type: [Number] }));
    assert.throws(() => validateFieldValue([0, false, 2, 3], { type: [Number] }));
  });

  it('can validate objects', () => {
    assert.doesNotThrow(() => validateFieldValue({ a: 'foo', b: 0 }, { type: { a: { type: String }, b: { type: Number } } }));
    assert.doesNotThrow(() => validateFieldValue({ a: 'foo', b: { c: true, d: [0, 1, 2, 3] } }, { type: { a: { type: String }, b: { type: { c: { type: Boolean }, d: { type: [Number] } } } } }));
  });

  it('can validate ObjectIDs', () => {
    const i = new ObjectID();
    assert.doesNotThrow(() => validateFieldValue(i, { type: ObjectID }));
  });
});
