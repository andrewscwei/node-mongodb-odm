import assert from 'assert';
import { describe, it } from 'mocha';
import Schema from './Schema';

describe('schema', () => {
  it('foo', () => {
    const SampleSchema: Schema = {
      model: 'Sample',
      collection: 'samples',
      timestamp: true,
      fields: {},
    };
  });
});
