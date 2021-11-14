import _ from 'lodash'
import { Filter, ObjectId, UpdateFilter } from 'mongodb'

export type AnyProps = { [key: string]: any }

export type AnyDocument = { [key: string]: any }

export type AnyDocumentFragment = Partial<AnyDocument>

/**
 * Full structure of a document.
 */
export type Document<T> = T & {
  _id: ObjectId
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
export type AnyFilter<P extends AnyProps = AnyProps> = Filter<Document<P>> | ObjectId | string

/**
 * Supported update descriptor types.
 */
export type AnyUpdate<P extends AnyProps = AnyProps> = UpdateFilter<Document<P>> | Partial<{ [K in keyof Document<P>]: Document<P>[K] | undefined }>

/**
 * Checks if a value is an `UpdateFilter`.
 *
 * @param value - Value to check.
 *
 * @returns `true` if value is an `UpdateFilter`, `false` otherwise.
 */
export function typeIsUpdateFilter<T>(value: any): value is UpdateFilter<Document<T>> {
  if (!_.isPlainObject(value)) return false
  return Object.keys(value).some(val => val.startsWith('$'))
}

/**
 * Checks if a value is a document of any kind.
 *
 * @param value - Value to check.
 *
 * @returns `true` if value is a document of any kind, `false` otherwise.
 */
export function typeIsAnyDocument(value: any): value is AnyDocument {
  if (_.isNil(value)) return false
  if (!_.isPlainObject(value)) return false
  if (Object.keys(value).some(val => val.startsWith('$'))) return false
  return true
}

/**
 * Checks if a value is an identifiable document.
 *
 * @param value - Value to check.
 *
 * @returns `true` if value is an identifiable document, `false` otherwise.
 */
export function typeIsIdentifiableDocument(value: any): value is { _id: ObjectId } & AnyProps {
  if (_.isNil(value)) return false
  if (!_.isPlainObject(value)) return false
  if (!typeIsValidObjectID(value._id)) return false
  return true
}

/**
 * Checks if a value is a valid `ObjectId`.
 *
 * @param value - Value to check.
 *
 * @returns `true` if valie is an `ObjectId`, `false` otherwise.
 */
export function typeIsValidObjectID(value: any): value is ObjectId {
  if (_.isNil(value)) return false
  if (!(value instanceof ObjectId)) return false
  if (!ObjectId.isValid(value)) return false

  return true
}

/**
 * Makes an `ObjectId` from a value.
 *
 * @param value - Value to make the `ObjectId` from.
 *
 * @returns If successful, a new `ObjectId` instance will be returned. If not, `undefined` will be
 *          returned.
 */
export function ObjectIdMake(value: any): ObjectId | undefined {
  if (!valueIsObjectIdConvertible(value)) return undefined
  return new ObjectId(value)
}

/**
 * Checks to see if a value is a valid `ObjectId` and returns it if it is. If not, this method will
 * check if the value is an identifiable document, and if it is it will return the `_id` of the
 * document.
 *
 * @param value - Value to check.
 *
 * @returns `ObjectId` or `undefined` if none are found.
 */
export function ObjectIdGet(value: any): ObjectId | undefined {
  if (valueIsObjectIdConvertible(value)) return value
  if (typeIsIdentifiableDocument(value)) return value._id
  return undefined
}

/**
 * Chec ks to see if 2 values are equal `ObjectId`'s.
 *
 * @param value1 - First value to compare.
 * @param value2 - Second value to compare.
 *
 * @returns `true` if they are equal `ObjectId`'s, `false` otherwise.
 */
export function ObjectIdEqual(value1: any, value2: any): boolean {
  const objectId1 = ObjectIdGet(value1)
  const objectId2 = ObjectIdGet(value2)

  if (!objectId1) return false
  if (!objectId2) return false

  return objectId1.equals(objectId2)
}

/**
 * Checks if a value can be converted to a valid `ObjectId`.
 *
 * @param value - The value to check.
 *
 * @returns `true` or `false`.
 */
export function valueIsObjectIdConvertible(value: any): boolean {
  if (_.isNil(value)) return false
  if (!ObjectId.isValid(value)) return false
  if (value instanceof ObjectId) return true

  try {
    const objectId = new ObjectId(value)
    if (objectId.toHexString() !== String(value)) return false
  }
  catch (err) {
    return false
  }

  return true
}
