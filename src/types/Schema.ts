import { ObjectID } from 'bson';
import { IndexOptions } from 'mongodb';

export type SchemaFieldType = typeof ObjectID | typeof String | typeof Number | typeof Boolean | typeof Date | typeof Array | (typeof Number)[] | { [key: string]: SchemaField };

/**
 * The validate method can be one of several types. The behavior per type is as
 * follows:
 *   1. RegExp: The value to be validated must pass for RegExp.test().
 *   2. number: The value to be validated must be <= this number. If the value
 *              is a string, its length must be <= this number.
 *   3. any[]: The value to be validated must be one of the elements of this
 *             array.
 *   4. Function: The value to be validated will be passed into this function
 *                and it must return `true`.
 */
export type SchemaValidateFieldType = RegExp | number | any[] | SchemaValidateFieldFunction;

export type SchemaValidateFieldFunction = (value: any) => any;

export type SchemaFormatFieldFunction = (value: any) => any;

export interface SchemaIndex {
  spec: { [key: string]: any };
  options?: IndexOptions;
}

export interface SchemaField {
  // The data type of the value of this field.
  type: SchemaFieldType;

  ref?: string;

  // Specifies if this field is required (will be checked during validation
  // process).
  required?: boolean;

  // The function for formatting the value of this field prior to entering it
  // into the database.
  format?: SchemaFormatFieldFunction;

  // Defines how the value fo this field should be validated (if needed).
  validate?: SchemaValidateFieldType;
}

export default interface Schema {
  model: string;
  collection: string;
  timestamps: boolean;
  cascade?: string[];
  fields: {
    [fieldName: string]: SchemaField;
  };
  indexes?: SchemaIndex[];
}
