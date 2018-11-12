import assert from 'assert';
import { describe, it } from 'mocha';
import { DocumentFragment } from '../../types';
import sanitizeDocument from '../../utils/sanitizeDocument';
import Baz, { BazProps } from '../models/Baz';

describe('utils/sanitizeDocument', () => {
  it('can remove extraneous fields from a document fragment', () => {
    const t: any = {
      aString: 'foo',
      extraneous: 'foo',
    };

    const o = sanitizeDocument<BazProps>(Baz.schema, t);

    assert(!o.hasOwnProperty('extraneous'));
  });

  it('can remove undefined fields in a document fragment', () => {
    const t: DocumentFragment<BazProps> = {
      aString: 'foo',
      aNumber: undefined,
    };

    const o = sanitizeDocument<BazProps>(Baz.schema, t);

    assert(!o.aNumber);
  });
});
