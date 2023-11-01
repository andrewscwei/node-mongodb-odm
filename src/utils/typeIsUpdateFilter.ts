import _ from 'lodash'
import { type UpdateFilter } from 'mongodb'
import { type AnyProps, type Document } from '../types'

/**
 * Checks if a value is an {@link UpdateFilter}.
 *
 * @param value - Value to check.
 *
 * @returns `true` if value is an {@link UpdateFilter}, `false` otherwise.
 */
export default function typeIsUpdateFilter<P extends AnyProps = AnyProps>(value: any): value is UpdateFilter<Document<P>> {
  if (!_.isPlainObject(value)) return false

  return Object.keys(value).some(val => val.startsWith('$'))
}
