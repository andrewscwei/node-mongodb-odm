import assert from 'assert';
import { describe, it } from 'mocha';
import { ObjectID } from 'mongodb';
import validate from './validate';

describe('utils/validate', () => {
  it('can validate string length', () => {
    const i = 'Hello, world!';
    assert(validate(i, { type: String, validate: 13 }) === true);
    assert(validate(i, { type: String, validate: 12 }) === false);
  });

  it('can validate string regex', () => {
    const i = 'Hello, world!';
    assert(validate(i, { type: String, validate: /^Hello.*$/ }) === true);
    assert(validate(i, { type: String, validate: /^hello.*$/ }) === false);
  });

  it('can validate string from list', () => {
    const i = 'Hello, world!';
    assert(validate(i, { type: String, validate: [i] }) === true);
    assert(validate(i, { type: String, validate: [] }) === false);
  });

  it('can validate string with custom method', () => {
    const i = 'Hello, world!';
    assert(validate(i, { type: String, validate: (v) => (v === i) }) === true);
    assert(validate(i, { type: String, validate: (v) => (v !== i) }) === false);
  });

  it('can validate numbers with inclusive maximum', () => {
    const i = 6;
    assert(validate(i, { type: Number, validate: 6 }) === true);
    assert(validate(i, { type: Number, validate: 5 }) === false);
  });

  it('can validate numbers from list', () => {
    const i = 6;
    assert(validate(i, { type: Number, validate: [6] }) === true);
    assert(validate(i, { type: Number, validate: [] }) === false);
  });

  it('can validate numbers from custom method', () => {
    const i = 6;
    assert(validate(i, { type: Number, validate: (v) => (v > 5 && v < 7) }) === true);
    assert(validate(i, { type: Number, validate: (v) => (v < 5) }) === false);
  });

  it('can validate booleans', () => {
    const i = true;
    assert(validate(i, { type: Boolean }) === true);
  });

  it('can validate dates', () => {
    const i = new Date();
    assert(validate(i, { type: Date }) === true);
  });

  it('can validate arrays', () => {
    assert(validate([0, 1, 2, 3], { type: [Number] }) === true);
    assert(validate([0, false, 2, 3], { type: [Number] }) === false);
  });

  it('can validate objects', () => {
    assert(validate({ a: 'foo', b: 0 }, { type: { a: { type: String }, b: { type: Number } } }) === true);
    assert(validate({ a: 'foo', b: { c: true, d: [0, 1, 2, 3] } }, { type: { a: { type: String }, b: { type: { c: { type: Boolean }, d: { type: [Number] } } } } }) === true);
  });

  it('can validate ObjectIDs', () => {
    const i = new ObjectID();
    assert(validate(i, { type: ObjectID }) === true);
  });
});
