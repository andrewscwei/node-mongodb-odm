import is from '@sindresorhus/is';
import { FieldSpec, typeIsFieldDescriptor } from '../types';

/**
 * Finds and returns the spec of a field in the provided schema by its key.
 * This key can be in dot notation to seek fields in embedded docs.
 *
 * @returns The field spec.
 */
export default function getFieldSpecByKey(fieldDescriptor: { [key: string]: FieldSpec }, key: string): FieldSpec | undefined {
  const keys = key.split('.');
  const k = keys.shift();

  if (is.nullOrUndefined(k)) return undefined;
  if (!fieldDescriptor.hasOwnProperty(k)) return undefined;

  const o = fieldDescriptor[k];

  if (keys.length === 0) {
    return o;
  }
  else {
    if (!typeIsFieldDescriptor(o.type)) return undefined;
    return getFieldSpecByKey(o.type, keys.join('.'));
  }
}
