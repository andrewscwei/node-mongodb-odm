import { ObjectId } from 'mongodb'
import { type FieldDescriptor, type FieldType, type FieldValidationStrategy, type FieldValue } from '../core'
import { isPlainObject } from '../helpers'
import { typeIsValidObjectId } from './typeIsValidObjectId'

/**
 * Checks a value against field properties definied in a schema.
 *
 * @param value The value to check.
 * @param spec See {@link FieldDescriptor}.
 * @param strategy See {@link FieldValidationStrategy}.
 *
 * @throws {TypeError} Value is marked as required in the spec but it is null or
 *                     undefined.
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
 * @throws {TypeError} Value is supposed to be an ObjectId but it is not.
 * @throws {TypeError} ObjectId value should not have a RegExp validator (only
 *                     if validator is a RegExp).
 * @throws {TypeError} ObjectId value should not have a number validator (only
 *                     if validator is a number).
 * @throws {TypeError} ObjectId value should not have an array validator (only
 *                     if validator is an array).
 * @throws {TypeError} Incorrect definition of a typed array type in the spec.
 * @throws {TypeError} Value is supposed to be a typed array but it is not even
 *                     an array.
 * @throws {TypeError} One or more values in the typed array is not of the
 *                     correct type.
 * @throws {TypeError} Value is supposed to be an object but it is not.
 * @throws {TypeError} Object value should not have a RegExp validator (only if
 *                     validator is a RegExp).
 * @throws {TypeError} Object value should not have a number validator (only if
 *                     validator is a number).
 * @throws {TypeError} Object value should not have an array validator (only if
 *                     validator is an array).
 * @throws {TypeError} One or more sub-fields of an object value is not valid.
 * @throws {TypeError} Value fails custom validation function (only if validator
 *                     is a function).
 */
export function validateFieldValue<V = FieldValue>(value: V, spec: FieldDescriptor, strategy?: FieldValidationStrategy<V>) {
  // Check if value is `undefined` or `null`, then respond accordingly depending
  // on whether or not it is a required value.
  if (value === undefined || value === null) {
    if (spec.required) {
      throw new TypeError('The value is marked as required but it is null or undefined')
    }
    else {
      return true
    }
  }

  switch (spec.type) {
    case String:
      if (typeof value !== 'string') throw new TypeError(`The value "${value}" is expected to be a string but instead it is a(n) ${typeof value}`)

      if (strategy instanceof RegExp) {
        if (!strategy.test(value)) throw new TypeError(`The string value does not conform to the RegEx validator: ${strategy}`)
      }
      else if (typeof strategy === 'number') {
        if (value.length > strategy) throw new TypeError(`The length of the string value "${value}" must be less than or equal to ${strategy}`)
      }
      else if (strategy instanceof Array) {
        if (strategy.indexOf(value) <= -1) throw new TypeError(`The string value "${value}" is not an element of ${strategy}`)
      }

      break
    case Number:
      if (typeof value !== 'number') throw new TypeError(`The value "${value}" is expected to be a number but instead it is a(n) ${typeof value}`)

      if (strategy instanceof RegExp) {
        throw new TypeError('The RegExp validation method is not supported for number values')
      }
      else if (typeof strategy === 'number') {
        if (value > strategy) throw new TypeError(`The number value "${value}" must be less than or equal to ${strategy}`)
      }
      else if (strategy instanceof Array) {
        if (strategy.indexOf(value) <= -1) throw new TypeError(`The number value "${value}" is not an element of ${strategy}`)
      }

      break
    case Boolean:
      if (typeof value !== 'boolean') throw new TypeError(`The value "${value}" is expected to be a boolean but instead it is a(n) ${typeof value}`)

      if (strategy instanceof RegExp) {
        throw new TypeError('The RegExp validation method is not supported for boolean values')
      }
      else if (typeof strategy === 'number') {
        throw new TypeError('The number validation method is not supported for boolean vlaues')
      }
      else if (strategy instanceof Array) {
        if (strategy.indexOf(value) <= -1) throw new TypeError(`The boolean value "${value}" is not an element of ${strategy}`)
      }

      break
    case Date:
      if (!(value instanceof Date)) throw new TypeError(`The value "${value}" is expected to be a date but instead it is a(n) ${typeof value}`)

      if (strategy instanceof RegExp) {
        throw new TypeError('The RegExp validation method is not supported for date values')
      }
      else if (typeof strategy === 'number') {
        throw new TypeError('The number validation method is not supported for date values')
      }
      else if (strategy instanceof Array) {
        throw new TypeError('The array validation method is not supported for date values')
      }

      break
    case Array:
      if (!(value instanceof Array)) throw new TypeError(`The value "${value}" is expected to be an array but instead it is a(n) ${typeof value}`)

      if (strategy instanceof RegExp) {
        throw new TypeError('The RegExp validation method is not supported for array values')
      }
      else if (typeof strategy === 'number') {
        throw new TypeError('The number validation method is not supported for array values')
      }
      else if (strategy instanceof Array) {
        throw new TypeError('The array validation method is not supported for array values')
      }

      break
    case ObjectId:
      if (!typeIsValidObjectId(value)) throw new TypeError(`The value "${value}" is expected to be an ObjectId but instead it is a(n) ${typeof value}`)

      if (strategy instanceof RegExp) {
        throw new TypeError('The RegExp validation method is not supported for ObjectId values')
      }
      else if (typeof strategy === 'number') {
        throw new TypeError('The number validation method is not supported for ObjectId values')
      }
      else if (strategy instanceof Array) {
        throw new TypeError('The array validation method is not supported for ObjectId values')
      }

      break
    default:
    // If type is an array of a type, i.e. [Number].
      if (spec.type instanceof Array) {
        if (spec.type.length !== 1) throw new TypeError(`Incorrect definition of a typed array type ${spec.type}: when specifying a type as an array of another type, wrap the type with [], hence a one-element array`)
        if (!(value instanceof Array)) throw new TypeError(`The value "${value}" is expected to be a typed array but instead it is a(n) ${typeof value}`)

        // Ensure that every element within the array conforms to the specified
        // type and passes the validation test.
        for (const item of value) {
          validateFieldValue(item, {
            ...spec,
            type: (spec.type as FieldType[])[0],
          })
        }
      }
      // If type is an object.
      else if (isPlainObject(spec.type)) {
        if (!isPlainObject(value)) throw new TypeError(`The value "${value}" is expected to be an object but instead it is a(n) ${typeof value}`)

        if (strategy instanceof RegExp) {
          throw new TypeError('The RegExp validation method is not supported for object values')
        }
        else if (typeof strategy === 'number') {
          throw new TypeError('The number validation method is not supported for object values')
        }
        else if (strategy instanceof Array) {
          throw new TypeError('The array validation method is not supported for object values')
        }

        // Validate each field.
        for (const subFieldName in spec.type) {
          if (!{}.hasOwnProperty.call(spec.type, subFieldName)) continue
          validateFieldValue((value as any)[subFieldName], (spec.type as Record<string, FieldDescriptor>)[subFieldName])
        }
      }
  }

  if (typeof strategy === 'function') {
    if (!strategy(value)) throw new TypeError(`The value "${value}" failed to pass custom validation function`)
  }
}
