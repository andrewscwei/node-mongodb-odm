import is from '@sindresorhus/is';
import { ObjectID } from 'mongodb';
import { valueIsValidObjectID } from '../types';

export default function mapValuesToObjectID<T extends { [key: string]: any }>(obj: T): T {
  const out: any = {};

  for (const k in obj) {
    if (!obj.hasOwnProperty(k)) continue;

    const val = obj[k];

    if (is.array(val)) {
      out[k] = val.map(v => mapValuesToObjectID(v));
    }
    else if (is.plainObject(val)) {
      out[k] = mapValuesToObjectID(val);
    }
    else if (valueIsValidObjectID(val)) {
      out[k] = new ObjectID(val);
    }
    else {
      out[k] = val;
    }
  }

  return out as T;
}
