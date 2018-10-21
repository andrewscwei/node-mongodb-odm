import { ObjectID } from 'bson';

export type Query = string | number | ObjectID | { [key: string]: any };
