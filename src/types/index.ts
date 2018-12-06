import is from '@sindresorhus/is';
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
export type Update<T = {}> = UpdateQuery<DocumentFragment<T>> | Partial<{ [K in keyof Document<T>]: Document<T>[K] | null }>;

/**
 * Data type for all field types.
 */
export type FieldType = FieldBasicType | FieldBasicType[] | { [field: string]: FieldSpecs };

/**
 * Data type for acceptable field values.
 */
export type FieldValue = undefined | FieldBasicValue | FieldBasicValue[] | { [subfield: string]: FieldValue };

/**
 * Geo coordinate type in the format of [longitude, latitude].
 */
export type GeoCoordinate = [number, number];

/**
 * Specification for defining a field in the MongoDB collection.
 */
export interface FieldSpecs<T = FieldValue> {
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
   * @see FieldSpecs
   */
  fields: {
    [K in keyof Required<T>]: FieldSpecs<NonNullable<T[K]>>;
  };

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

/**
 * Specs that define the $group stage. If this is a string, a simple $group
 * stage will be generated with `_id` equal this string.
 */
export type GroupStageFactorySpecs = string | { [key: string]: any };

export interface SortStageFactorySpecs {
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
   * Schema fields  to exclude.
   */
  exclude?: any[];
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
export type FieldValidationStrategy<T = FieldValue> = RegExp | number | any[] | FieldValidationFunction<T>;

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
  if (!is.plainObject(value)) return false;
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
  if (is.nullOrUndefined(value)) return false;
  if (!is.plainObject(value)) return false;
  if (!typeIsValidObjectID(value._id)) return false;
  return true;
}

/**
 * Checks if a value is a value ObjectID.
 *
 * @param value - Value to check.
 *
 * @returns `true` if valie is an ObjectID, `false` otherwise.
 */
export function typeIsValidObjectID(value: any): value is ObjectID {
  if (is.nullOrUndefined(value)) return false;
  if (!is.directInstanceOf(value, ObjectID)) return false;
  if (!ObjectID.isValid(value)) return false;
  return true;
}

/**
 * Checks if a value is a GeoCoordinate. Also ensures the longitude and latitude
 * ranges, throws if out of range for either value.
 *
 * @param value - Value to check.
 *
 * @returns `true` if value is a GeoCoordinate, `false` otherwise.
 *
 * @throws {Error} Longitude is less than -180.
 * @throws {Error} Longitude is greather than 180.
 * @throws {Error} Latitude is less than -90.
 * @throws {Error} Latitude is greater than 90.
 */
export function typeIsGeoCoordinate(value: any): value is GeoCoordinate {
  if (!is.array(value)) return false;
  if (value.length !== 2) return false;
  if (!is.number(value[0])) return false;
  if (!is.number(value[1])) return false;

  const [longitude, latitude] = value;

  if (longitude < -180) throw new Error('Longitude value must not be less than -180 degrees');
  if (longitude > 180) throw new Error('Longitude value must not be greater than 180 degrees');
  if (latitude < -90) throw new Error('Longitude value must not be less than -90 degrees');
  if (latitude > 90) throw new Error('Longitude value must not be greater than 90 degrees');

  return true;
}

/**
 * Makes a geo coordinate based on the provided params.
 *
 * @param longitude - Longitude.
 * @param latitude - Latitude.
 *
 * @returns The geo coordinate.
 *
 * @throws {Error} Params are invalid.
 */
export function GeoCoordinateMake({ longitude, latitude }: { longitude: string | number, latitude: string | number }): GeoCoordinate {
  const coord = [Number(longitude), Number(latitude)];

  if (!typeIsGeoCoordinate(coord)) throw new Error('Invalid parameters provided');

  return coord;
}
