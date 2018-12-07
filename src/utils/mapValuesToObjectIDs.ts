import is from '@sindresorhus/is';
import { ObjectID } from 'mongodb';
import { valueIsValidObjectID } from '../types';

export default function mapValuesToObjectIDs(val: any): any {
  if (is.array(val)) {
    return val.map(v => mapValuesToObjectIDs(v));
  }
  else if (is.plainObject(val)) {
    const out: any = {};

    for (const k in val) {
      if (!val.hasOwnProperty(k)) continue;
      out[k] = mapValuesToObjectIDs(val[k]);
    }

    return out;
  }
  else if (valueIsValidObjectID(val)) {
    return new ObjectID(val);
  }
  else {
    return val;
  }
}
