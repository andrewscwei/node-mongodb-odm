import { ObjectId } from 'mongodb'

/**
 * Checks if a value is a valid `ObjectId`.
 *
 * @param value Value to check.
 *
 * @returns `true` if valie is an `ObjectId`, `false` otherwise.
 */
export function typeIsValidObjectId(value: any): value is ObjectId {
  if (value === undefined || value === null) return false
  if (!(value instanceof ObjectId)) return false
  if (!ObjectId.isValid(value)) return false

  return true
}
