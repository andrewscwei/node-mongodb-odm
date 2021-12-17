import _ from 'lodash'
import prefixed from './prefixed'

/**
 * Returns the field path of a schema field with an option to prepend a prefix.
 *
 * @param field - The schema field.
 * @param prefix - The prefix to prepend.
 *
 * @returns Dot notated field path with the prepended prefix.
 */
export default function fieldPath(field: string, prefix = '') {
  let out = prefixed(field, prefix)

  while (_.startsWith(out, '$')) {
    out = out.substring(1)
  }

  return `$${out}`
}
