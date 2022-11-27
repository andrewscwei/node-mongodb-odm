import { SortDirection } from 'mongodb'
import { AnyProps } from '../../types'
import Schema from '../Schema'

export type SortStage = {
  $sort: Record<string, any>
}

export type SortStageFactorySpecs<P extends AnyProps = AnyProps> = {
  _id?: SortDirection
  createdAt?: SortDirection
  updatedAt?: SortDirection
} & {
  [K in keyof P]?: SortDirection
}

/**
 * Generates a `$sort` stage for a collection to be used in an aggregation
 * pipeline.
 *
 * @param schema - The schema of the database collection.
 * @param specs - The specifications for the `$sort` stage.
 *
 * @returns An abstract aggregation pipeline containing the generated `$sort` stage.
 *
 * @example
 * // Returns [{ "$sort": { "a": 1, "b": -1 } }]
 * sort(schema, { a: 1, b: -1 })
 *
 * @see {@link https://docs.mongodb.com/manual/reference/operator/aggregation/sort/}
 */
export function sortStageFactory<P extends AnyProps = AnyProps>(
  schema: Schema<P>,
  specs: SortStageFactorySpecs<P>,
): [SortStage] {
  return [{ $sort: specs }]
}
