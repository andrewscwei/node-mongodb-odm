import { ObjectId } from 'mongodb'

/**
 * Checks if a value can be converted to a valid `ObjectId`.
 *
 * @param value The value to check.
 *
 * @returns `true` or `false`.
 */
export function valueIsObjectIdConvertible(value: any): boolean {
  if (value === undefined || value === null) return false
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
