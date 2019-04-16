import is from '@sindresorhus/is';
import { FieldSpecs, Schema } from '../types';

/**
 * Finds and returns the specs of a field in the provided schema by its key.
 * This key can be in dot notation to seek fields in embedded docs.
 *
 * @returns The field specs.
 */
export default function getFieldSpecsByKey(fieldDescriptors: { [key: string]: FieldSpecs }, key: string): FieldSpecs | undefined {
  const keys = key.split('.');
  const k = keys.shift();

  if (is.nullOrUndefined(k)) return undefined;
  if (!fieldDescriptors.hasOwnProperty(k)) return undefined;

  const o = fieldDescriptors[k];

  if (keys.length === 0) {
    return o;
  }
  else {
    if (is.plainObject(o.type)) return undefined;
    return getFieldSpecsByKey(o.type, keys.join('.'));
  }
}
