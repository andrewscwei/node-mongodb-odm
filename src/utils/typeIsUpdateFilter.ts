import _ from 'lodash'
import { UpdateFilter } from 'mongodb'
import { AnyProps, Document } from '../types'

/**
 * Checks if a value is an `UpdateFilter`.
 *
 * @param value - Value to check.
 *
 * @returns `true` if value is an `UpdateFilter`, `false` otherwise.
 */
export default function typeIsUpdateFilter<P extends AnyProps = AnyProps>(value: any): value is UpdateFilter<Document<P>> {
  if (!_.isPlainObject(value)) return false
  return Object.keys(value).some(val => val.startsWith('$'))
}
