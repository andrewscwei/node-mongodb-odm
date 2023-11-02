import { ObjectId } from 'mongodb'
import { valueIsObjectIdConvertible } from './valueIsObjectIdConvertible.js'

/**
 * Makes an `ObjectId` from a value.
 *
 * @param value Value to make the `ObjectId` from.
 *
 * @returns If successful, a new `ObjectId` instance will be returned. If not,
 *          `undefined` will be returned.
 */
export function ObjectIdMake(value: any): ObjectId | undefined {
  if (!valueIsObjectIdConvertible(value)) return undefined

  return new ObjectId(value)
}
