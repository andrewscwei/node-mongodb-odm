import { compact } from '../helpers/index.js'

/**
 * Prepends a prefix to a schema field.
 *
 * @param field The schema field.
 * @param prefix The prefix to prepend.
 *
 * @returns Dot notated field with the prepended prefix.
 */
export function prefixed(field: string, prefix = ''): string {
  const parts = compact(`${prefix}.${field}`.split('.'))

  return parts.join('.')
}
