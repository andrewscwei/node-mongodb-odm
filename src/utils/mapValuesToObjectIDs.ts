import _ from 'lodash';
import { ObjectID } from 'mongodb';
import { valueIsCompatibleObjectID } from '../types';

export default function mapValuesToObjectIDs(val: any): any {
  if (_.isArray(val)) {
    return val.map(v => mapValuesToObjectIDs(v));
  }
  else if (_.isPlainObject(val)) {
    const out: any = {};

    for (const k in val) {
      if (!val.hasOwnProperty(k)) continue;
      out[k] = mapValuesToObjectIDs(val[k]);
    }

    return out;
  }
  else if (valueIsCompatibleObjectID(val)) {
    return new ObjectID(val);
  }
  else {
    return val;
  }
}
