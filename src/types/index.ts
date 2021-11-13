import _ from 'lodash'
import { FilterQuery, ObjectID, UpdateQuery } from 'mongodb'
import { FieldValue, MultiFieldDescriptor } from '../core/Schema'

/**
 * Full structure of a document.
 */
export type Document<T> = T & {
  _id: ObjectID
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Structure that represents parts of a document.
 */
export type DocumentFragment<T> = Partial<Document<T>>

/**
 * Supported filter types for finding documents in the MongoDB database.
 */
export type AnyFilter<T> = FilterQuery<string | ObjectID | T> | ObjectID | string

/**
 * Supported update descriptor types.
 */
export type AnyUpdate<T> = UpdateQuery<DocumentFragment<T>> | Partial<{ [K in keyof Document<T>]: Document<T>[K] | undefined }>

/**
 * Checks if a value is an UpdateQuery.
 *
 * @param value - Value to check.
 *
 * @returns `true` if value is an AnyUpdate, `false` otherwise.
 */
export function typeIsUpdateQuery<T>(value: any): value is UpdateQuery<DocumentFragment<T>> {
  if (!_.isPlainObject(value)) return false
  return Object.keys(value).some(val => val.startsWith('$'))
}

/**
 * Checks if a value is an identifiable document.
 *
 * @param value - Value to check.
 *
 * @returns `true` if value is an identifiable document, `false` otherwise.
 */
export function typeIsIdentifiableDocument(value: any): value is { _id: ObjectID } & { [field: string]: FieldValue } {
  if (_.isNil(value)) return false
  if (!_.isPlainObject(value)) return false
  if (!typeIsValidObjectID(value._id)) return false
  return true
}

/**
 * Checks if a value is a valid ObjectID.
 *
 * @param value - Value to check.
 *
 * @returns `true` if valie is an ObjectID, `false` otherwise.
 */
export function typeIsValidObjectID(value: any): value is ObjectID {
  if (_.isNil(value)) return false
  if (!(value instanceof ObjectID)) return false
  if (!ObjectID.isValid(value)) return false

  return true
}

/**
 * Makes an ObjectID from a value.
 *
 * @param value - Value to make the ObjectID from.
 *
 * @returns If successful, a new ObjectID instance will be returned. If not, `undefined` will be
 *          returned.
 */
export function ObjectIDMake(value: any): ObjectID | undefined {
  if (!valueIsCompatibleObjectID(value)) return undefined
  return new ObjectID(value)
}

/**
 * Checks to see if a value is a valid ObjectID and returns it if it is. If not, this method will
 * check if the value is an identifiable document, and if it is it will return the `_id` of the
 * document.
 *
 * @param value - Value to check.
 *
 * @returns ObjectID or `undefined` if none are found.
 */
export function ObjectIDGet(value: any): ObjectID | undefined {
  if (valueIsCompatibleObjectID(value)) return value
  if (typeIsIdentifiableDocument(value)) return value._id
  return undefined
}

/**
 * Chec ks to see if 2 values are equal ObjectID's.
 *
 * @param value1 - First value to compare.
 * @param value2 - Second value to compare.
 *
 * @returns `true` if they are equal ObjectID's, `false` otherwise.
 */
export function ObjectIDEqual(value1: any, value2: any): boolean {
  const objectId1 = ObjectIDGet(value1)
  const objectId2 = ObjectIDGet(value2)

  if (!objectId1) return false
  if (!objectId2) return false

  return objectId1.equals(objectId2)
}

/**
 * Checks if a value can be used to create a valid ObjectID.
 *
 * @param value - The value to check.
 *
 * @returns `true` or `false`.
 */
export function valueIsCompatibleObjectID(value: any): boolean {
  if (_.isNil(value)) return false
  if (!ObjectID.isValid(value)) return false
  if (value instanceof ObjectID) return true

  try {
    const objectId = new ObjectID(value)
    if (objectId.toHexString() !== String(value)) return false
  }
  catch (err) {
    return false
  }

  return true
}

