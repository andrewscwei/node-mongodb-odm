import { isPlainObject } from '../helpers'
import { type AnyDocument } from '../types'

/**
 * Checks if a value is a document of any kind.
 *
 * @param value Value to check.
 *
 * @returns `true` if value is a document of any kind, `false` otherwise.
 */
export function typeIsAnyDocument(value: any): value is AnyDocument {
  if (value === undefined || value === null) return false
  if (!isPlainObject(value)) return false
  if (Object.keys(value).some(val => val.startsWith('$'))) return false

  return true
}
