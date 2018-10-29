import assert from 'assert';
import { describe, it } from 'mocha';
import { ObjectID } from 'mongodb';
import { FieldSpecs } from '../../types';
import validateFieldValue from '../../utils/validateFieldValue';

describe('utils/validate', () => {
  it('can validate string length', () => {
    const i = 'Hello, world!';
    assert(validateFieldValue(i, { type: String, validate: 13 }) === true);
    assert(validateFieldValue(i, { type: String, validate: 12 }) === false);
  });

  it('can validate string regex', () => {
    const i = 'Hello, world!';
    assert(validateFieldValue(i, { type: String, validate: /^Hello.*$/ }) === true);
    assert(validateFieldValue(i, { type: String, validate: /^hello.*$/ }) === false);
  });

  it('can validate string from list', () => {
    const i = 'Hello, world!';
    assert(validateFieldValue(i, { type: String, validate: [i] }) === true);
    assert(validateFieldValue(i, { type: String, validate: [] }) === false);
  });

  it('can validate string with custom method', () => {
    const i = 'Hello, world!';
    assert(validateFieldValue(i, { type: String, validate: (v: string): boolean => (v === i) } as FieldSpecs<any>) === true);
    assert(validateFieldValue(i, { type: String, validate: (v: string): boolean => (v !== i) } as FieldSpecs<any>) === false);
  });

  it('can validate numbers with inclusive maximum', () => {
    const i = 6;
    assert(validateFieldValue(i, { type: Number, validate: 6 }) === true);
    assert(validateFieldValue(i, { type: Number, validate: 5 }) === false);
  });

  it('can validate numbers from list', () => {
    const i = 6;
    assert(validateFieldValue(i, { type: Number, validate: [6] }) === true);
    assert(validateFieldValue(i, { type: Number, validate: [] }) === false);
  });

  it('can validate numbers from custom method', () => {
    const i = 6;
    assert(validateFieldValue(i, { type: Number, validate: (v: number): boolean => (v > 5 && v < 7) } as FieldSpecs<any>) === true);
    assert(validateFieldValue(i, { type: Number, validate: (v: number): boolean => (v < 5) } as FieldSpecs<any>) === false);
  });

  it('can validate booleans', () => {
    const i = true;
    assert(validateFieldValue(i, { type: Boolean }) === true);
  });

  it('can validate dates', () => {
    const i = new Date();
    assert(validateFieldValue(i, { type: Date }) === true);
  });

  it('can validate arrays', () => {
    assert(validateFieldValue([0, 1, 2, 3], { type: [Number] }) === true);
    assert(validateFieldValue([0, false, 2, 3], { type: [Number] }) === false);
  });

  it('can validate objects', () => {
    assert(validateFieldValue({ a: 'foo', b: 0 }, { type: { a: { type: String }, b: { type: Number } } }) === true);
    assert(validateFieldValue({ a: 'foo', b: { c: true, d: [0, 1, 2, 3] } }, { type: { a: { type: String }, b: { type: { c: { type: Boolean }, d: { type: [Number] } } } } }) === true);
  });

  it('can validate ObjectIDs', () => {
    const i = new ObjectID();
    assert(validateFieldValue(i, { type: ObjectID }) === true);
  });
});
