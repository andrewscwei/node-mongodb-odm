import _ from 'lodash'
import { type ObjectId } from 'mongodb'
import { type AnyProps } from '../types'
import { typeIsValidObjectId } from './typeIsValidObjectId'

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
  if (!typeIsValidObjectId(value._id)) return false

  return true
}
