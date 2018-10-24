import is from '@sindresorhus/is';
import { IndexOptions, ObjectID } from 'mongodb';

/**
 * Query for finding documents in the MongoDB database.
 */
export type Query<T extends Document = Document> = string | ObjectID | Partial<T>;

/**
 * MongoDB document structure.
 */
export interface Document {
  _id?: ObjectID;
  createdAt?: Date;
  updatedAt?: Date;
  [field: string]: FieldValue;
}

/**
 * Document update descriptor.
 */
export interface Update {
  [updateOperator: string]: Document;
}

/**
 * Data type for acceptable field types.
 */
export type FieldType = typeof ObjectID | typeof String | typeof Number | typeof Boolean | typeof Date | typeof Array | (typeof Number)[] | { [key: string]: FieldSpecs };

/**
 * Data type for acceptable field values.
 */
export type FieldValue = undefined | ObjectID | string | number | boolean | Date | any[] | { [key: string]: FieldValue };

/**
 * Function for formatting field values, in which the value to be formatted will
 * be passed into this function as its only paramenter.
 */
export type FieldFormatFunction = (value: any) => FieldValue;

/**
 * The validation strategy can be one of several types. The behavior per type is
 * as follows:
 *   1. RegExp: The value to be validated must pass for RegExp.test().
 *   2. number: The value to be validated must be <= this number. If the value
 *              is a string, its length must be <= this number.
 *   3. any[]: The value to be validated must be one of the elements of this
 *             array.
 *   4. Function: The value to be validated will be passed into this function
 *                and it must return `true`.
 */
export type FieldValidationStrategy = RegExp | number | any[] | FieldValidationFunction;

/**
 * Function for validating field values, in which the value to be validated
 * is passed into the function as its only argument.
 */
export type FieldValidationFunction = (value: any) => boolean;

/**
 * Function for generating a random value for the associated field.
 */
export type FieldRandomValueFunction = () => FieldValue;

/**
 * Function for generating a default value for the associated field.
 */
export type FieldDefaultValueFunction = () => FieldValue;

/**
 * Specification for defining a field in the MongoDB collection.
 */
export interface FieldSpecs {
  /**
   * @see FieldType
   */
  type: FieldType;

  /**
   * When the type is an ObjectID, that means th is field is a foreign key to
   * another collection. This `ref` value indicates the name of model in which
   * the foreign key belongs to.
   */
  ref?: string;

  /**
   * Specifies if this field is required (will be checked during validation
   * process).
   */
  required?: boolean;

  /**
   * Specifies if this field should be encrypted.
   */
  encrypted?: boolean;

  /**
   * Default value of the field.
   */
  default?: FieldValue | FieldDefaultValueFunction;

  /**
   * @see FieldFormatFunction
   */
  format?: FieldFormatFunction;

  /**
   * @see FieldValidationStrategy
   */
  validate?: FieldValidationStrategy;

  /**
   * @see FieldRandomValueFunction
   */
  random?: FieldRandomValueFunction;
}

export interface Schema<T extends Document = Document> {
  /**
   * Name of the model. Should be in upper cammel-case, i.e. `Model`.
   */
  model: string;

  /**
   * Name of the collection in the MongoDB. Should be in lower camel-case and
   * pluralized, i.e. `models`.
   */
  collection: string;

  /**
   * Specifies whether timestamp fields will be automatically generated and
   * tracked per CRUD operation. The genrated fields are `updatedAt` and
   * `createdAt`, which are both `Date` values.
   */
  timestamps?: boolean;

  /**
   * Indicates whether cascade deletion should occur if a document of this
   * collection is deleted. This array should contain a list of model names
   * indicating that once a document in this collection is deleted, other
   * documents in the models listed in this array should also be deleted if
   * it has a foreign key to the deleted document.
   */
  cascade?: string[];

  /**
   * Defines document fields.
   *
   * @see FieldSpecs
   */
  fields: {
    readonly [F in keyof T]: FieldSpecs;
  };

  /**
   * Defines the indexes of this collection.
   *
   * @see SchemaIndex
   */
  indexes?: SchemaIndex[];
}

/**
 * Describes the indexes to be created in the associated collection.
 */
export interface SchemaIndex {
  /**
   * Spec to be passed to Collection#createIndex.
   *
   * @see {@link https://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#createIndex}
   */
  spec: { [key: string]: any };

  /**
   * Options to be passed to Collection#createIndex.
   *
   * @see {@link https://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#createIndex}
   */
  options?: IndexOptions;
}

export function typeIsUpdate(value: any): value is Update {
  if (!is.object(value)) return false;
  return Object.keys(value).some(val => val.startsWith('$'));
}
