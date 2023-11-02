import { type ObjectId } from 'mongodb'
import { typeIsIdentifiableDocument } from './typeIsIdentifiableDocument.js'
import { valueIsObjectIdConvertible } from './valueIsObjectIdConvertible.js'

/**
 * Checks to see if a value is a valid `ObjectId` and returns it if it is. If
 * not, this method will check if the value is an identifiable document, and if
 * it is it will return the `_id` of the document.
 *
 * @param value Value to check.
 *
 * @returns `ObjectId` or `undefined` if none are found.
 */
export function ObjectIdGet(value: any): ObjectId | undefined {
  if (valueIsObjectIdConvertible(value)) return value
  if (typeIsIdentifiableDocument(value)) return value._id

  return undefined
}
