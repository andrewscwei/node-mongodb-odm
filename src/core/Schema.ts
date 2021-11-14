import _ from 'lodash'
import { CreateIndexesOptions, IndexSpecification, ObjectId } from 'mongodb'
import { AnyProps } from '../types'

/**
 * Data type for describing multiple (can be nested) fields in the `Schema`.
 */
export type MultiFieldDescriptor<P extends AnyProps = AnyProps> = { [K in keyof P]: FieldDescriptor }

/**
 * Data type for describing a single (can be nested) field in the `Schema`.
 */
export type FieldDescriptor = {

  /**
   * @see FieldType
   */
  type: FieldType | MultiFieldDescriptor

  /**
   * When the `type` is an ObjectId, that means this field is a foreign key to another collection.
   * This `ref` value indicates the name of model in which the foreign key belongs to.
   */
  ref?: string

  /**
   * Specifies if this field is required (will be checked during validation process).
   */
  required?: boolean

  /**
   * Specifies if this field should be encrypted.
   */
  encrypted?: boolean
}

/**
 * Data type representing primitive field types only, that are acceptable values of
 * `FieldDescriptor.type`.
 */
export type FieldPrimitiveType = typeof String | typeof Number | typeof Boolean | typeof Date | typeof ObjectId | typeof Array

/**
 * Data type for all acceptable values of `FieldDescriptor.type`.
 */
export type FieldType = FieldPrimitiveType | FieldPrimitiveType[]

/**
 * Data type for primitive field values only.
 */
export type FieldPrimitiveValue = ObjectId | string | number | boolean | Date

/**
 * Data type for all acceptable field values.
 */
export type FieldValue = undefined | FieldPrimitiveValue | FieldPrimitiveValue[] | { [subfield: string]: FieldValue }

/**
 * Describes the indexes to be created in the collection.
 */
export type SchemaIndex = {

  /**
   * Spec to be passed to `Collection#createIndex`.
   *
   * @see {@link https://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#createIndex}
   */
  spec: IndexSpecification

  /**
   * Options to be passed to `Collection#createIndex`.
   *
   * @see {@link https://mongodb.github.io/node-mongodb-native/2.2/api/Collection.html#createIndex}
   */
  options?: CreateIndexesOptions
}

export default interface Schema<P extends AnyProps = AnyProps> {

  /**
   * Name of the model. Should be in upper cammel-case, i.e. `Model`.
   */
  model: string

  /**
   * Name of the collection in the MongoDB. Should be in lower camel-case and pluralized, i.e.
   * `models`.
   */
  collection: string

  /**
   * Specifies whether timestamp fields will be automatically generated and tracked per CRUD
   * operation. The genrated fields are `updatedAt` and `createdAt`, which are both `Date` values.
   */
  timestamps?: boolean

  /**
   * Specifies whether upserting is allowed.
   */
  allowUpserts?: boolean

  /**
   * Specifies whether any form of insertion is disabled.
   */
  noInserts?: boolean

  /**
   * Specifies whether multiple simultaneous insertions are disabled.
   */
  noInsertMany?: boolean

  /**
   * Specifies whether any form of updates is disabled.
   */
  noUpdates?: boolean

  /**
   * Specifies whether multiple simultaneous updates are disabled.
   */
  noUpdateMany?: boolean

  /**
   * Specifies whether any form of deletions is disabled.
   */
  noDeletes?: boolean

  /**
   * Specifies whether multiple simultaneous deletions are disabled.
   */
  noDeleteMany?: boolean

  /**
   * Indicates whether cascade deletion should occur if a document of this collection is deleted.
   * This array should contain a list of model names indicating that once a document in this
   * collection is deleted, other documents in the models listed in this array should also be
   * deleted if it has a foreign key to the deleted document.
   */
  cascade?: string[]

  /**
   * Defines document fields.
   *
   * @see FieldDescriptor
   */
  fields: MultiFieldDescriptor<Required<P>>

  /**
   * Defines the indexes of this collection.
   *
   * @see SchemaIndex
   */
  indexes?: SchemaIndex[]
}

/**
 * Checks if a value is a MultiFieldDescriptor object.
 *
 * @param value
 *
 * @returns `true` or `false`.
 */
export function typeIsFieldDescriptor(value: any): value is MultiFieldDescriptor {
  if (!_.isPlainObject(value)) return false

  return true
}
