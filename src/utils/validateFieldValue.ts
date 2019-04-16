import is from '@sindresorhus/is';
import { ObjectID } from 'mongodb';
import { FieldSpec, FieldType, FieldValidationStrategy, FieldValue, typeIsValidObjectID } from '../types';

/**
 * Checks a value against field properties definied in a schema.
 *
 * @param value - The value to check.
 * @param specs - @see FieldSpec
 * @param strategy - @see FieldValidationStrategy
 *
 * @throws {TypeError} Value is marked as required in the specs but it is null
 *                     or undefined.
 * @throws {TypeError} Value is supposed to be a string but it is not.
 * @throws {TypeError} String value does not conform to the RegExp validator
 *                     (only if validator is a RegExp).
 * @throws {TypeError} Length of string value exceeds the limit (only if
 *                     validator is a number).
 * @throws {TypeError} String value is not an element of a set of strings (only
 *                     if validator is an array).
 * @throws {TypeError} Value is supposed to be a number but it is not.
 * @throws {TypeError} Number value should not have a RegExp validator (only if
 *                     validator is a RegExp).
 * @throws {TypeError} Number value exceeds the maximum (only if validator is a
 *                     number).
 * @throws {TypeError} Number value is not an element of a set of numbers (only
 *                     if validator is an array).
 * @throws {TypeError} Value is supposed to be a boolean but it is not.
 * @throws {TypeError} Boolean value should not have a RegExp validator (only if
 *                     validator is a RegExp).
 * @throws {TypeError} Boolean value should not have a number validator (only if
 *                     validator is a number).
 * @throws {TypeError} Boolean value is not an element of a set of booleans
 *                     (only if validator is an array).
 * @throws {TypeError} Value is supposed to be a date but it is not.
 * @throws {TypeError} Date value should not have a RegExp validator (only if
 *                     validator is a RegExp).
 * @throws {TypeError} Date value should not have a number validator (only if
 *                     validator is a number).
 * @throws {TypeError} Date value should not have an array validator (only if
 *                     validator is an array).
 * @throws {TypeError} Value is supposed to be an array but it is not.
 * @throws {TypeError} Array value should not have a RegExp validator (only if
 *                     validator is a RegExp).
 * @throws {TypeError} Array value should not have a number validator (only if
 *                     validator is a number).
 * @throws {TypeError} Array value should not have an array validator (only if
 *                     validator is an array).
 * @throws {TypeError} Value is supposed to be an ObjectID but it is not.
 * @throws {TypeError} ObjectID value should not have a RegExp validator (only
 *                     if validator is a RegExp).
 * @throws {TypeError} ObjectID value should not have a number validator (only
 *                     if validator is a number).
 * @throws {TypeError} ObjectID value should not have an array validator (only
 *                     if validator is an array).
 * @throws {TypeError} Incorrect definition of a typed array type in the specs.
 * @throws {TypeError} Value is supposed to be a typed array but it is not even
 *                     an array.
 * @throws {TypeError} One or more values in the typed array is not of the
 *                     correct type.
 * @throws {TypeError} Value is supposed to be an object but it is not.
 * @throws {TypeError} Object value should not have a RegExp validator (only
 *                     if validator is a RegExp).
 * @throws {TypeError} Object value should not have a number validator (only
 *                     if validator is a number).
 * @throws {TypeError} Object value should not have an array validator (only
 *                     if validator is an array).
 * @throws {TypeError} One or more sub-fields of an object value is not valid.
 * @throws {TypeError} Value fails custom validation function (only if validator
 *                     is a function).
 */
export default function validateFieldValue<T = FieldValue>(value: any, specs: FieldSpec, strategy?: FieldValidationStrategy<T>) {
  // Check if value is undefined or null, then respond accordingly depending on
  // whether or not it is a required value.
  if (is.nullOrUndefined(value)) {
    if (specs.required) {
      throw new TypeError('The value is marked as required but it is null or undefined');
    }
    else {
      return true;
    }
  }

  switch (specs.type) {
  case String:
    if (!is.string(value)) throw new TypeError(`The value "${value}" is expected to be a string but instead it is a(n) ${is(value)}`);

    if (is.regExp(strategy)) {
      if (!strategy.test(value)) throw new TypeError(`The string value does not conform to the RegEx validator: ${strategy}`);
    }
    else if (is.number(strategy)) {
      if (value.length > strategy) throw new TypeError(`The length of the string value "${value}" must be less than or equal to ${strategy}`);
    }
    else if (is.array(strategy)) {
      if (strategy.indexOf(value) <= -1) throw new TypeError(`The string value "${value}" is not an element of ${strategy}`);
    }

    break;
  case Number:
    if (!is.number(value)) throw new TypeError(`The value "${value}" is expected to be a number but instead it is a(n) ${is(value)}`);

    if (is.regExp(strategy)) {
      throw new TypeError('The RegExp validation method is not supported for number values');
    }
    else if (is.number(strategy)) {
      if (value > strategy) throw new TypeError(`The number value "${value}" must be less than or equal to ${strategy}`);
    }
    else if (is.array(strategy)) {
      if (strategy.indexOf(value) <= -1) throw new TypeError(`The number value "${value}" is not an element of ${strategy}`);
    }

    break;
  case Boolean:
    if (!is.boolean(value)) throw new TypeError(`The value "${value}" is expected to be a boolean but instead it is a(n) ${is(value)}`);

    if (is.regExp(strategy)) {
      throw new TypeError('The RegExp validation method is not supported for boolean values');
    }
    else if (is.number(strategy)) {
      throw new TypeError('The number validation method is not supported for boolean vlaues');
    }
    else if (is.array(strategy)) {
      if (strategy.indexOf(value) <= -1) throw new TypeError(`The boolean value "${value}" is not an element of ${strategy}`);
    }

    break;
  case Date:
    if (!is.date(value)) throw new TypeError(`The value "${value}" is expected to be a date but instead it is a(n) ${is(value)}`);

    if (is.regExp(strategy)) {
      throw new TypeError('The RegExp validation method is not supported for date values');
    }
    else if (is.number(strategy)) {
      throw new TypeError('The number validation method is not supported for date values');
    }
    else if (is.array(strategy)) {
      throw new TypeError('The array validation method is not supported for date values');
    }

    break;
  case Array:
    if (!is.array(value)) throw new TypeError(`The value "${value}" is expected to be an array but instead it is a(n) ${is(value)}`);

    if (is.regExp(strategy)) {
      throw new TypeError('The RegExp validation method is not supported for array values');
    }
    else if (is.number(strategy)) {
      throw new TypeError('The number validation method is not supported for array values');
    }
    else if (is.array(strategy)) {
      throw new TypeError('The array validation method is not supported for array values');
    }

    break;
  case ObjectID:
    if (!typeIsValidObjectID(value)) throw new TypeError(`The value "${value}" is expected to be an ObjectID but instead it is a(n) ${is(value)}`);

    if (is.regExp(strategy)) {
      throw new TypeError('The RegExp validation method is not supported for ObjectID values');
    }
    else if (is.number(strategy)) {
      throw new TypeError('The number validation method is not supported for ObjectID values');
    }
    else if (is.array(strategy)) {
      throw new TypeError('The array validation method is not supported for ObjectID values');
    }

    break;
  default:
    // If type is an array of a type, i.e. [Number].
    if (is.array(specs.type)) {
      if (specs.type.length !== 1) throw new TypeError(`Incorrect definition of a typed array type ${specs.type}: when specifying a type as an array of another type, wrap the type with [], hence a one-element array`);
      if (!is.array(value)) throw new TypeError(`The value "${value}" is expected to be a typed array but instead it is a(n) ${is(value)}`);

      // Ensure that every element within the array conforms to the specified
      // type and passes the validation test.
      for (const item of value) {
        validateFieldValue(item, {
          ...specs,
          type: (specs.type as FieldType[])[0],
        });
      }
    }
    // If type is an object.
    else if (is.plainObject(specs.type)) {
      if (!is.plainObject(value)) throw new TypeError(`The value "${value}" is expected to be an object but instead it is a(n) ${is(value)}`);

      if (is.regExp(strategy)) {
        throw new TypeError('The RegExp validation method is not supported for object values');
      }
      else if (is.number(strategy)) {
        throw new TypeError('The number validation method is not supported for object values');
      }
      else if (is.array(strategy)) {
        throw new TypeError('The array validation method is not supported for object values');
      }

      // Validate each field.
      for (const subFieldName in specs.type) {
        if (!specs.type.hasOwnProperty(subFieldName)) continue;
        validateFieldValue(value[subFieldName], (specs.type as { [key: string]: FieldSpec })[subFieldName]);
      }
    }
  }

  if (is.function_(strategy)) {
    if (!strategy(value)) throw new TypeError(`The value "${value}" failed to pass custom validation function`);
  }
}
