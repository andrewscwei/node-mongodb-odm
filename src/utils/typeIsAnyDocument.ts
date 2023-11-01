import _ from 'lodash'
import { type AnyDocument } from '../types'

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
