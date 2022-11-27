import _ from 'lodash'
import { ObjectId } from 'mongodb'
import valueIsObjectIdConvertible from './valueIsObjectIdConvertible'

/**
 * Maps a single value or a collection of values to Object IDs. If a value cannot be converted to an
 * Object ID, it will be skipped (but remains in the collection or returned if a single value is
 * passed).
 *
 * @param val - A single value or a collection of values to map.
 *
 * @returns The mapped value(s).
 */
export default function mapValuesToObjectIds(val: any): any {
  if (_.isArray(val)) {
    return val.map(v => mapValuesToObjectIds(v))
  }
  else if (_.isPlainObject(val)) {
    const out: any = {}

    for (const k in val) {
      if (!{}.hasOwnProperty.call(val, k)) continue
      out[k] = mapValuesToObjectIds(val[k])
    }

    return out
  }
  else if (valueIsObjectIdConvertible(val)) {
    return new ObjectId(val)
  }
  else {
    return val
  }
}
