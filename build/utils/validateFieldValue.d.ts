import { FieldSpecs } from '../types';
/**
 * Checks a value against field properties definied in a schema.
 *
 * @param value - The value to check.
 * @param specs - @see FieldSpecs
 *
 * @return `true` if validation passes, `false` otherwise.
 */
export default function validateFieldValue(value: any, specs: FieldSpecs): boolean;
