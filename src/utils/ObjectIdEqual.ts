import ObjectIdGet from './ObjectIdGet'

/**
 * Checks to see if 2 values are equal `ObjectId`s.
 *
 * @param value1 - First value to compare.
 * @param value2 - Second value to compare.
 *
 * @returns `true` if they are equal `ObjectId`s, `false` otherwise.
 */
export default function ObjectIdEqual(value1: any, value2: any): boolean {
  const objectId1 = ObjectIdGet(value1)
  const objectId2 = ObjectIdGet(value2)

  if (!objectId1) return false
  if (!objectId2) return false

  return objectId1.equals(objectId2)
}
