import _ from 'lodash';
import { ObjectID } from 'mongodb';
import { FieldSpec, FieldType, FieldValidationStrategy, FieldValue, typeIsValidObjectID } from '../types';

/**
 * Checks a value against field properties definied in a schema.
 *
 * @param value - The value to check.
 * @param spec - @see FieldSpec
 * @param strategy - @see FieldValidationStrategy
 *
 * @throws {TypeError} Value is marked as required in the spec but it is null
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
 * @throws {TypeError} Incorrect definition of a typed array type in the spec.
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
export default function validateFieldValue<T = FieldValue>(value: T, spec: FieldSpec, strategy?: FieldValidationStrategy<T>) {
  // Check if value is `undefined` or `null`, then respond accordingly depending
  // on whether or not it is a required value.
  if (_.isNil(value)) {
    if (spec.required) {
      throw new TypeError('The value is marked as required but it is null or undefined');
    }
    else {
      return true;
    }
  }

  switch (spec.type) {
  case String:
    if (!_.isString(value)) throw new TypeError(`The value "${value}" is expected to be a string but instead it is a(n) ${typeof value}`);

    if (_.isRegExp(strategy)) {
      if (!strategy.test(value)) throw new TypeError(`The string value does not conform to the RegEx validator: ${strategy}`);
    }
    else if (_.isNumber(strategy)) {
      if (value.length > strategy) throw new TypeError(`The length of the string value "${value}" must be less than or equal to ${strategy}`);
    }
    else if (_.isArray(strategy)) {
      if (strategy.indexOf(value) <= -1) throw new TypeError(`The string value "${value}" is not an element of ${strategy}`);
    }

    break;
  case Number:
    if (!_.isNumber(value)) throw new TypeError(`The value "${value}" is expected to be a number but instead it is a(n) ${typeof value}`);

    if (_.isRegExp(strategy)) {
      throw new TypeError('The RegExp validation method is not supported for number values');
    }
    else if (_.isNumber(strategy)) {
      if (value > strategy) throw new TypeError(`The number value "${value}" must be less than or equal to ${strategy}`);
    }
    else if (_.isArray(strategy)) {
      if (strategy.indexOf(value) <= -1) throw new TypeError(`The number value "${value}" is not an element of ${strategy}`);
    }

    break;
  case Boolean:
    if (!_.isBoolean(value)) throw new TypeError(`The value "${value}" is expected to be a boolean but instead it is a(n) ${typeof value}`);

    if (_.isRegExp(strategy)) {
      throw new TypeError('The RegExp validation method is not supported for boolean values');
    }
    else if (_.isNumber(strategy)) {
      throw new TypeError('The number validation method is not supported for boolean vlaues');
    }
    else if (_.isArray(strategy)) {
      if (strategy.indexOf(value) <= -1) throw new TypeError(`The boolean value "${value}" is not an element of ${strategy}`);
    }

    break;
  case Date:
    if (!_.isDate(value)) throw new TypeError(`The value "${value}" is expected to be a date but instead it is a(n) ${typeof value}`);

    if (_.isRegExp(strategy)) {
      throw new TypeError('The RegExp validation method is not supported for date values');
    }
    else if (_.isNumber(strategy)) {
      throw new TypeError('The number validation method is not supported for date values');
    }
    else if (_.isArray(strategy)) {
      throw new TypeError('The array validation method is not supported for date values');
    }

    break;
  case Array:
    if (!_.isArray(value)) throw new TypeError(`The value "${value}" is expected to be an array but instead it is a(n) ${typeof value}`);

    if (_.isRegExp(strategy)) {
      throw new TypeError('The RegExp validation method is not supported for array values');
    }
    else if (_.isNumber(strategy)) {
      throw new TypeError('The number validation method is not supported for array values');
    }
    else if (_.isArray(strategy)) {
      throw new TypeError('The array validation method is not supported for array values');
    }

    break;
  case ObjectID:
    if (!typeIsValidObjectID(value)) throw new TypeError(`The value "${value}" is expected to be an ObjectID but instead it is a(n) ${typeof value}`);

    if (_.isRegExp(strategy)) {
      throw new TypeError('The RegExp validation method is not supported for ObjectID values');
    }
    else if (_.isNumber(strategy)) {
      throw new TypeError('The number validation method is not supported for ObjectID values');
    }
    else if (_.isArray(strategy)) {
      throw new TypeError('The array validation method is not supported for ObjectID values');
    }

    break;
  default:
    // If type is an array of a type, i.e. [Number].
    if (_.isArray(spec.type)) {
      if (spec.type.length !== 1) throw new TypeError(`Incorrect definition of a typed array type ${spec.type}: when specifying a type as an array of another type, wrap the type with [], hence a one-element array`);
      if (!_.isArray(value)) throw new TypeError(`The value "${value}" is expected to be a typed array but instead it is a(n) ${typeof value}`);

      // Ensure that every element within the array conforms to the specified
      // type and passes the validation test.
      for (const item of value) {
        validateFieldValue(item, {
          ...spec,
          type: (spec.type as FieldType[])[0],
        });
      }
    }
    // If type is an object.
    else if (_.isPlainObject(spec.type)) {
      if (!_.isPlainObject(value)) throw new TypeError(`The value "${value}" is expected to be an object but instead it is a(n) ${typeof value}`);

      if (_.isRegExp(strategy)) {
        throw new TypeError('The RegExp validation method is not supported for object values');
      }
      else if (_.isNumber(strategy)) {
        throw new TypeError('The number validation method is not supported for object values');
      }
      else if (_.isArray(strategy)) {
        throw new TypeError('The array validation method is not supported for object values');
      }

      // Validate each field.
      for (const subFieldName in spec.type) {
        if (!spec.type.hasOwnProperty(subFieldName)) continue;
        validateFieldValue((value as any)[subFieldName], (spec.type as { [key: string]: FieldSpec })[subFieldName]);
      }
    }
  }

  if (_.isFunction(strategy)) {
    if (!strategy(value)) throw new TypeError(`The value "${value}" failed to pass custom validation function`);
  }
}
