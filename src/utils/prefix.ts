import _ from 'lodash'

/**
 * Prepends a prefix to a schema field.
 *
 * @param field - The schema field.
 * @param prefix - The prefix to prepend.
 *
 * @returns Dot notated field with the prepended prefix.
 */
export default function prefix(field: string, prefix: string = ''): string {
  const parts = _.compact(`${prefix}.${field}`.split('.'))
  return parts.join('.')
}
