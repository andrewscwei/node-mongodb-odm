import { ObjectID } from 'bson';

export type SchemaFieldType = ObjectID | string | number | boolean | any[];

export interface SchemaIndex {
  spec: { [key: string]: any };
  options?: { [key: string]: any };
}

export interface SchemaField {
  type: SchemaFieldType;
  ref?: string;
  required?: boolean;
  format?(val: SchemaFieldType): SchemaFieldType;
}

export default interface Schema {
  model: string;
  collection: string;
  timestamp: boolean;
  cascade?: string[];
  fields: {
    [fieldName: string]: SchemaField;
  };
  indexes?: SchemaIndex[];
}
