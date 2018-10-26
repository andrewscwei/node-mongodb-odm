import is from '@sindresorhus/is';
import { IndexOptions, ObjectID, UpdateQuery } from 'mongodb';

/**
 * Data type for basic field types.
 */
type FieldBaseType = typeof String | typeof Number | typeof Boolean | typeof Date | typeof ObjectID | typeof Array;

/**
 * MongoDB document structure.
 */
export type Document<T = {}> = Partial<T> & { _id?: ObjectID; createdAt?: Date; updatedAt?: Date; [field: string]: FieldValue; };

/**
 * Query for finding documents in the MongoDB database.
 */
export type Query<T = {}> = string | ObjectID | Document<T> | { [key: string]: any };

/**
 * Document update descriptor.
 */
export type Update<T = {}> = UpdateQuery<Document<T>>;

/**
 * Data type for all field types.
 */
export type FieldType = FieldBaseType | FieldBaseType[] | { [key: string]: FieldSpecs };

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

export interface Schema<T = {}> {
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
    [K in keyof T]: FieldSpecs;
  };

  /**
   * Defines the indexes of this collection.
   *
   * @see SchemaIndex
   */
  indexes?: SchemaIndex[];
}

export function typeIsUpdate<T = {}>(value: any): value is Update<T> {
  if (!is.object(value)) return false;
  return Object.keys(value).some(val => val.startsWith('$'));
}

export type AggregationPipeline = (MatchStageDescriptor | LookupStageDescriptor | UnwindStageDescriptor | GroupStageDescriptor | SortStageDescriptor | ProjectStageDescriptor | SampleStageDescriptor)[];

export interface PipelineFactoryOptions {
  // Prefix for document attributes.
  prefix?: string;

  // Pipeline to work with.
  pipeline?: AggregationPipeline;
}

export interface PipelineFactorySpecs {
  /**
   * Lookup stage spec.
   */
  $lookup?: LookupStageFactorySpecs;

  /**
   * Match stage spec at the beginning of the pipeline.
   */
  $match?: MatchStageFactorySpecs;

  /**
   * Match stage spec appended to end of the pipeline.
   */
  $prune?: MatchStageFactorySpecs;

  /**
   * Group stage spec.
   */
  $group?: GroupStageFactorySpecs;

  /**
   * Sort stage spec appended to the end of the pipeline.
   */
  $sort?: SortStageFactorySpecs;
}

export type MatchStageFactorySpecs = Query;

export interface MatchStageFactoryOptions {
  prefix?: string;
}

export interface MatchStageDescriptor {
  $match: { [key: string]: any };
}

/**
 * Defines fields to perform lookup on used by #lookupStageFactory(). These
 * fields must be references (i.e. model name as foreign keys) to another model.
 * The fields are represented by the keys in this object. The accepted values of
 * the keys are `true` or another object for recursive lookup of the reference
 * model's foreign keys. If the value is simply `true`, lookup will only be
 * performed on the immediate foreign key, all of its subsequent foreign keys
 * will be ignored. Specs can be nested objects. `$unwind` is immediately
 * followed after the generated  `$lookup`.
 */
export interface LookupStageFactorySpecs {
  [modelName: string]: boolean | LookupStageFactorySpecs;
}

export interface LookupStageFactoryOptions {
  /**
   * Prefix for current attributes to look up.
   */
  fromPrefix?: string;

  /**
   * Prefix for looked up attributes to save to.
   */
  toPrefix?: string;
}

export interface LookupStageDescriptor {
  $lookup: { [key: string]: any };
}

export interface UnwindStageDescriptor {
  $unwind: { [key: string]: any };
}

/**
 * Specs that define the $group stage. If this is a string, a simple $group
 * stage will be generated with `_id` equal this string.
 */
export type GroupStageFactorySpecs = string | { [key: string]: any };

export interface GroupStageDescriptor {
  $group: { [key: string]: any };
}

export interface SortStageFactorySpecs {
  [key: string]: any;
}

export interface SortStageDescriptor {
  $sort: { [key: string]: any };
}

export interface SampleStageDescriptor {
  $sample: { [key: string]: any };
}

export interface ProjectStageFactoryOptions {
  /**
   * Prefix for current attributes.
   */
  toPrefix?: string;

  /**
   * Prefix for target attributes after project.
   */
  fromPrefix?: string;

  /**
   * An object containing key/value pairs representing a field belonging to this
   * model that is a reference (aka foreign key) pointing to another model. The
   * keys equate the name of the field while the values equate the `options`
   * parameter for the reference models `project()` method. The values can also
   * just be `true` to omit passing an `options` parameter.
   */
  populate?: ProjectStageFactoryOptionsPopulate;

  /**
   * Schema fields  to exclude.
   */
  exclude?: any[];
}

export interface ProjectStageFactoryOptionsPopulate {
  [modelName: string]: boolean | ProjectStageFactoryOptionsPopulate;
}

export interface ProjectStageDescriptor {
  $project: { [key: string]: any };
}

/**
 * Data type for acceptable field values.
 */
type FieldValue = undefined | ObjectID | string | number | boolean | Date | any[] | { [key: string]: FieldValue };

/**
 * Function for formatting field values, in which the value to be formatted will
 * be passed into this function as its only paramenter.
 */
type FieldFormatFunction = (value: any) => FieldValue;

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
type FieldValidationStrategy = RegExp | number | any[] | FieldValidationFunction;

/**
 * Function for validating field values, in which the value to be validated
 * is passed into the function as its only argument.
 */
type FieldValidationFunction = (value: any) => boolean;

/**
 * Function for generating a random value for the associated field.
 */
type FieldRandomValueFunction = () => FieldValue;

/**
 * Function for generating a default value for the associated field.
 */
type FieldDefaultValueFunction = () => FieldValue;

/**
 * Describes the indexes to be created in the associated collection.
 */
interface SchemaIndex {
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
