import { Filter, ObjectId, UpdateFilter } from 'mongodb'

/**
 * A type representing a generic set of properties of a model.
 */
export type AnyProps = { [key: string]: any }

/**
 * Full structure of a document.
 */
export type Document<P extends AnyProps = AnyProps> = P & {
  _id: ObjectId
  createdAt?: Date
  updatedAt?: Date
}

/**
 * A document without `_id`.
 */
export type OptionallyIdentifiableDocument<P extends AnyProps = AnyProps> = Pick<Partial<Document<P>>, '_id'> & Omit<Document<P>, '_id'>

/**
 * A generic {@link Document}.
 */
export type AnyDocument = { [key: string]: any }

/**
 * Structure that represents parts of a document.
 */
export type DocumentFragment<P> = Partial<Document<P>>

/**
 * A generic {@link DocumentFragment}.
 */
export type AnyDocumentFragment = Partial<AnyDocument>

/**
 * Supported filter types for finding documents in the MongoDB database.
 */
export type AnyFilter<P extends AnyProps = AnyProps> = Filter<Document<P>> | ObjectId | string

/**
 * Supported update descriptor types.
 */
export type AnyUpdate<P extends AnyProps = AnyProps> = UpdateFilter<Document<P>> | Partial<{ [K in keyof Document<P>]: Document<P>[K] | undefined }>
