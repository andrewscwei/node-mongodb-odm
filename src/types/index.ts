import _ from 'lodash';
import { CollectionAggregationOptions, CollectionInsertManyOptions, CollectionInsertOneOptions, CommonOptions, FilterQuery, FindOneAndReplaceOption, IndexOptions, ObjectID, ReplaceOneOptions, UpdateQuery } from 'mongodb';

/**
 * Full structure of a document.
 */
export type Document<T = {}> = T & { _id: ObjectID; createdAt?: Date; updatedAt?: Date; };

/**
 * Structure that represents parts of a document.
 */
export type DocumentFragment<T = {}> = Partial<Document<T>>;

/**
 * Query for finding documents in the MongoDB database.
 */
export type Query<T = {}> = string | ObjectID | FilterQuery<T>;

/**
 * Update document descriptor.
 */
export type Update<T = {}> = UpdateQuery<T> | Partial<{ [K in keyof Document<T>]: Document<T>[K] | undefined }>;

/**
 * Data type for all field types.
 */
export type FieldType = FieldBasicType | FieldBasicType[];

/**
 * Data type for acceptable field values.
 */
export type FieldValue = undefined | FieldBasicValue | FieldBasicValue[] | { [subfield: string]: FieldValue };

/**
 * Data type for field descriptors.
 */
export type FieldDescriptor<T = { [key: string]: any }> = { [K in keyof T]: FieldSpec };

/**
 * Specification for defining a field in the MongoDB collection.
 */
export interface FieldSpec {
  /**
   * @see FieldType
   */
  type: FieldType | FieldDescriptor;

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
}

export interface Schema<T = any> {
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
   * Specifies whether upserting is allowed.
   */
  allowUpserts?: boolean;

  /**
   * Specifies whether any form of insertion is disabled.
   */
  noInserts?: boolean;

  /**
   * Specifies whether multiple simultaneous insertions are disabled.
   */
  noInsertMany?: boolean;

  /**
   * Specifies whether any form of updates is disabled.
   */
  noUpdates?: boolean;

  /**
   * Specifies whether multiple simultaneous updates are disabled.
   */
  noUpdateMany?: boolean;

  /**
   * Specifies whether any form of deletions is disabled.
   */
  noDeletes?: boolean;

  /**
   * Specifies whether multiple simultaneous deletions are disabled.
   */
  noDeleteMany?: boolean;

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
   * @see FieldSpec
   */
  fields: FieldDescriptor<Required<T>>;

  /**
   * Defines the indexes of this collection.
   *
   * @see SchemaIndex
   */
  indexes?: SchemaIndex[];
}

/**
 * Options for Model.randomFields.
 */
export interface ModelRandomFieldsOptions {
  /**
   * Specifies whether optional fields will be generated as well.
   */
  includeOptionals?: boolean;
}

/**
 * Options for Model.validateDocument.
 */
export interface ModelValidateDocumentOptions {
  /**
   * Tells the validation process to account for required fields. That is, if
   * this is `true` and some required fields are missing in the document to be
   * validated, validation fails.
   */
  strict?: boolean;

  /**
   * Tells the validation process to account for unique indexes. That is, if
   * this is `false` and one or more field values are not unique when it
   * supposedly has a unique index, validation fails.
   */
  ignoreUniqueIndex?: boolean;

  /**
   * Tells the validation process that the document contains dot notations to
   * in its keys. Dot notations are usually used by udate queries to update
   * fields in an embedded doc as opposed to a top-level field.
   */
  accountForDotNotation?: boolean;
}

export interface ModelFindOneOptions extends CollectionAggregationOptions {}

export interface ModelFindManyOptions extends CollectionAggregationOptions {}

export interface ModelInsertOneOptions extends ModelValidateDocumentOptions, CollectionInsertOneOptions {
  /**
   * Specifies whether timestamp fields (i.e. `createdAt` and `updatedAt`) are
   * automatically generated before insertion.
   */
  ignoreTimestamps?: boolean;
}

export interface ModelInsertManyOptions extends ModelValidateDocumentOptions, CollectionInsertManyOptions {
  /**
   * Specifies whether timestamp fields (i.e. `createdAt` and `updatedAt`) are
   * automatically generated before insertion.
   */
  ignoreTimestamps?: boolean;
}

export interface ModelUpdateOneOptions extends ModelInsertOneOptions, FindOneAndReplaceOption, ReplaceOneOptions {
  /**
   * Specifies whether updated doc is returned when update completes.
   */
  returnDoc?: boolean;

  /**
   * Specifies whether timestamp fields (i.e. `createdAt` and `updatedAt`) are
   * automatically generated before insertion.
   */
  ignoreTimestamps?: boolean;

  /**
   * Specifies whether beforeUpdate() and afterUpdate() hooks are skipped.
   */
  skipHooks?: boolean;
}

export interface ModelUpdateManyOptions extends CommonOptions, FindOneAndReplaceOption {
  /**
   * Specifies whether updated docs are returned when update completes.
   */
  returnDocs?: boolean;

  /**
   * Specifies whether timestamp fields (i.e. `createdAt` and `updatedAt`) are
   * automatically generated before insertion.
   */
  ignoreTimestamps?: boolean;
}

export interface ModelDeleteOneOptions extends CommonOptions {
  /**
   * Specifies whether deleted doc is returned when deletion completes.
   */
  returnDoc?: boolean;
}

export interface ModelDeleteManyOptions extends CommonOptions {
  /**
   * Specifies whether deleted docs are returned when deletion completes.
   */
  returnDocs?: boolean;
}

export interface ModelReplaceOneOptions extends FindOneAndReplaceOption, ModelDeleteOneOptions, ModelInsertOneOptions {}

export interface ModelCountOptions extends ModelFindManyOptions {}

export interface AggregationStageDescriptor {
  [stageName: string]: {
    [key: string]: any;
  };
}

export type AggregationPipeline = AggregationStageDescriptor[];

export interface PipelineFactoryOptions {
  // Prefix for document attributes.
  prefix?: string;

  // Pipeline to work with.
  pipeline?: AggregationPipeline;
}

export interface PipelineFactoryOperators {
  /**
   * Lookup stage spec.
   */
  $lookup?: LookupStageFactorySpec;

  /**
   * Match stage spec at the beginning of the pipeline.
   */
  $match?: MatchStageFactorySpec;

  /**
   * Match stage spec appended to end of the pipeline.
   */
  $prune?: MatchStageFactorySpec;

  /**
   * Group stage spec.
   */
  $group?: GroupStageFactorySpec;

  /**
   * Sort stage spec appended to the end of the pipeline.
   */
  $sort?: SortStageFactorySpec;
}

export type MatchStageFactorySpec = Query;

export interface MatchStageFactoryOptions {
  prefix?: string;
}

/**
 * Defines fields to perform lookup on used by #lookupStageFactory(). These
 * fields must be references (i.e. model name as foreign keys) to another model.
 * The fields are represented by the keys in this object. The accepted values of
 * the keys are `true` or another object for recursive lookup of the reference
 * model's foreign keys. If the value is simply `true`, lookup will only be
 * performed on the immediate foreign key, all of its subsequent foreign keys
 * will be ignored. Spec can be nested objects. `$unwind` is immediately
 * followed after the generated  `$lookup`.
 */
export interface LookupStageFactorySpec {
  [modelName: string]: boolean | LookupStageFactorySpec;
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

/**
 * Spec that define the $group stage. If this is a string, a simple $group
 * stage will be generated with `_id` equal this string.
 */
export type GroupStageFactorySpec = string | { [key: string]: any };

export interface SortStageFactorySpec {
  [key: string]: any;
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
   * Schema fields to exclude.
   */
  exclude?: string[];
}

export interface ProjectStageFactoryOptionsPopulate {
  [modelName: string]: boolean | ProjectStageFactoryOptionsPopulate;
}

/**
 * Data type for basic field types.
 */
export type FieldBasicType = typeof String | typeof Number | typeof Boolean | typeof Date | typeof ObjectID | typeof Array;

/**
 * Data type for basic field value.
 */
export type FieldBasicValue = ObjectID | string | number | boolean | Date;

/**
 * Function for formatting field values, in which the value to be formatted will
 * be passed into this function as its only paramenter.
 */
export type FieldFormatFunction<T = FieldValue> = (value: T) => T;

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
export type FieldValidationStrategy<T = FieldValue> = RegExp | number | T[] | FieldValidationFunction<T>;

/**
 * Function for validating field values, in which the value to be validated
 * is passed into the function as its only argument.
 */
export type FieldValidationFunction<T = FieldValue> = (value: T) => boolean;

/**
 * Function for generating a random value for the associated field.
 */
export type FieldRandomValueFunction<T = FieldValue> = () => T;

/**
 * Function for generating a default value for the associated field.
 */
export type FieldDefaultValueFunction<T = FieldValue> = () => T;

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

/**
 * Checks if a value is an UpdateQuery.
 *
 * @param value - Value to check.
 *
 * @returns `true` if value is an Update, `false` otherwise.
 */
export function typeIsUpdateQuery<T = {}>(value: any): value is UpdateQuery<DocumentFragment<T>> {
  if (!_.isPlainObject(value)) return false;
  return Object.keys(value).some(val => val.startsWith('$'));
}

/**
 * Checks if a value is an identifiable document.
 *
 * @param value - Value to check.
 *
 * @returns `true` if value is an identifiable document, `false` otherwise.
 */
export function typeIsIdentifiableDocument(value: any): value is { _id: ObjectID } & { [field: string]: FieldValue; } {
  if (_.isNil(value)) return false;
  if (!_.isPlainObject(value)) return false;
  if (!typeIsValidObjectID(value._id)) return false;
  return true;
}

/**
 * Checks if a value is a valid ObjectID.
 *
 * @param value - Value to check.
 *
 * @returns `true` if valie is an ObjectID, `false` otherwise.
 */
export function typeIsValidObjectID(value: any): value is ObjectID {
  if (_.isNil(value)) return false;
  if (!(value instanceof ObjectID)) return false;
  if (!ObjectID.isValid(value)) return false;

  return true;
}

/**
 * Checks if a value is a FieldDescriptor object.
 *
 * @param value
 *
 * @returns `true` or `false`.
 */
export function typeIsFieldDescriptor(value: any): value is FieldDescriptor {
  if (!_.isPlainObject(value)) return false;

  return true;
}

/**
 * Makes an ObjectID from a value.
 *
 * @param value - Value to make the ObjectID from.
 *
 * @returns If successful, a new ObjectID instance will be returned. If not,
 *          `undefined` will be returned.
 */
export function ObjectIDMake(value: any): ObjectID | undefined {
  if (!valueIsCompatibleObjectID(value)) return undefined;
  return new ObjectID(value);
}

/**
 * Checks to see if a value is a valid ObjectID and returns it if it is. If not,
 * this method will check if the value is an identifiable document, and if it is
 * it will return the `_id` of the document.
 *
 * @param value - Value to check.
 *
 * @returns ObjectID or `undefined` if none are found.
 */
export function ObjectIDGet(value: any): ObjectID | undefined {
  if (valueIsCompatibleObjectID(value)) return value;
  if (typeIsIdentifiableDocument(value)) return value._id;
  return undefined;
}

/**
 * Chec ks to see if 2 values are equal ObjectID's.
 *
 * @param value1 - First value to compare.
 * @param value2 - Second value to compare.
 *
 * @returns `true` if they are equal ObjectID's, `false` otherwise.
 */
export function ObjectIDEqual(value1: any, value2: any): boolean {
  const objectId1 = ObjectIDGet(value1);
  const objectId2 = ObjectIDGet(value2);

  if (!objectId1) return false;
  if (!objectId2) return false;

  return objectId1.equals(objectId2);
}

/**
 * Checks if a value can be used to create a valid ObjectID.
 *
 * @param value - The value to check.
 *
 * @returns `true` or `false`.
 */
export function valueIsCompatibleObjectID(value: any): boolean {
  if (_.isNil(value)) return false;
  if (!ObjectID.isValid(value)) return false;
  if (value instanceof ObjectID) return true;

  try {
    const objectId = new ObjectID(value);
    if (objectId.toHexString() !== String(value)) return false;
  }
  catch (err) {
    return false;
  }

  return true;
}
