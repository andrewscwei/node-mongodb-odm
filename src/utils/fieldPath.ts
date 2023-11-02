import { prefixed } from './prefixed.js'

/**
 * Returns the field path of a schema field with an option to prepend a prefix.
 *
 * @param field The schema field.
 * @param prefix The prefix to prepend.
 *
 * @returns Dot notated field path with the prepended prefix.
 */
export function fieldPath(field: string, prefix = '') {
  let out = prefixed(field, prefix)

  while (out.startsWith('$')) {
    out = out.substring(1)
  }

  return `$${out}`
}
