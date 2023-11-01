import { type UpdateFilter } from 'mongodb'
import { type Schema } from '../core'
import { cloneDeep, isEmpty } from '../helpers'
import { type AnyProps, type AnyUpdate, type Document } from '../types'
import { sanitizeDocument } from './sanitizeDocument'
import { typeIsUpdateFilter } from './typeIsUpdateFilter'

export type SanitizeUpdateOptions = {
  ignoreTimestamps?: boolean
}

/**
 * Transforms the generic update descriptor specific to this library to an
 * {@link UpdateFilter} object that is readable by the MongoDB driver.
 *
 * @param update The update object to sanitize.
 *
 * @returns The {@link UpdateFilter} object that can be passed to the MongoDB
 *          driver to perform updates.
 *
 * @throws
 */
export function sanitizeUpdate<P extends AnyProps = AnyProps>(schema: Schema<P>, update: Readonly<AnyUpdate<P>>, { ignoreTimestamps = false }: SanitizeUpdateOptions = {}): UpdateFilter<Document<P>> {
  let out: UpdateFilter<Document<P>>

  if (typeIsUpdateFilter<P>(update)) {
    out = cloneDeep(update)
  }
  else {
    out = {
      $set: cloneDeep(update as any),
    }
  }

  // Sanitize the `$set` operator, but first remember which keys are `null` or
  // `undefined` because when the operator is sanitized by `sanitizeDocument` in
  // the subsequent step, those keys will be dropped.
  const setOperator: Record<string, any> = out.$set ?? {}
  const unsetFields = Object.keys(setOperator).filter(key => setOperator[key] === null || setOperator[key] === undefined)

  // Add updated timestamps if applicable.
  if (schema.timestamps === true && ignoreTimestamps !== true && !(setOperator.updatedAt instanceof Date)) {
    setOperator.updatedAt = new Date()
  }

  // Now sanitize the `$set` operator.
  out.$set = sanitizeDocument<P>(schema, setOperator, { accountForDotNotation: true }) as typeof out.$set

  // Relocate the previously remembered `null` or `undefined` values to the
  // `$unset` operator.
  const unsetOperator: Record<string, any> = out.$unset ?? {}

  for (const key of unsetFields) {
    unsetOperator[key] = ''
  }

  out.$unset = unsetOperator as typeof out.$unset

  // Sanitize all fields in the `$setOnInsert` operator, if any.
  if (out.$setOnInsert) {
    out.$setOnInsert = sanitizeDocument<P>(schema, out.$setOnInsert, { accountForDotNotation: true }) as typeof out.$setOnInsert
  }

  // Sanitize all fields in the `$addToSet` operator, if any. The `$addToSet`
  // operator automatically ignores duplicates.
  if (out.$addToSet) {
    out.$addToSet = sanitizeDocument<P>(schema, out.$addToSet, { accountForDotNotation: true }) as typeof out.$addToSet
  }

  // Sanitize all fields in the `$push` operator, if any. The `$push` operator
  // does not mind duplicates.
  if (out.$push) {
    out.$push = sanitizeDocument<P>(schema, out.$push, { accountForDotNotation: true }) as typeof out.$push
  }

  // Strip empty operators.
  let key: keyof typeof out

  for (key in out) {
    if (!isEmpty(out[key])) continue
    delete out[key]
  }

  return out
}
