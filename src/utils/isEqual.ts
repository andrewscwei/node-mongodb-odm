import is from '@sindresorhus/is';
import _ from 'lodash';
import { ObjectID } from 'mongodb';

/**
 * Performs deep comparison between two values. The only thing special about
 * this function is that it accounts for ObjectID's.
 *
 * @param value1 - First value to compare.
 * @param value2 - Second value to compare.
 *
 * @return `true` if both values are equal, `false` otherwise.
 */
export default function isEqual(value1: any, value2: any): boolean {
  if (is.directInstanceOf(value1, ObjectID)) {
    return value1.equals(value2);
  }
  else if (is.directInstanceOf(value2, ObjectID)) {
    return value2.equals(value1);
  }
  else {
    return _.isEqual(value1, value2);
  }
}
