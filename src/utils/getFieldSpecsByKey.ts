import is from '@sindresorhus/is';
import { FieldSpecs, Schema } from '../types';

/**
 * Finds and returns the specs of a field in the provided schema by its key.
 * This key can be in dot notation to seek fields in embedded docs.
 *
 * @returns `true` if the field key exists, `false` otherwise.
 */
export default function getFieldSpecsByKey(schema: Schema, key: string): FieldSpecs | undefined {
  const keys = key.split('.');
  let fields = schema.fields;
  let fieldSpecs;

  while (keys.length > 0) {
    const k = keys.shift();

    if (is.nullOrUndefined(k)) return undefined;
    if (is.nullOrUndefined(fields[k])) return undefined;
    fieldSpecs = fields[k];
    fields = fieldSpecs.type as any;
  }

  return fieldSpecs;
}
