import { type ObjectId } from 'mongodb'
import { isPlainObject } from '../helpers/index.js'
import { type AnyProps } from '../types/index.js'
import { typeIsValidObjectId } from './typeIsValidObjectId.js'

/**
 * Checks if a value is an identifiable document.
 *
 * @param value Value to check.
 *
 * @returns `true` if value is an identifiable document, `false` otherwise.
 */
export function typeIsIdentifiableDocument(value: any): value is { _id: ObjectId } & AnyProps {
  if (value === undefined || value === null) return false
  if (!isPlainObject(value)) return false
  if (!typeIsValidObjectId(value._id)) return false

  return true
}
