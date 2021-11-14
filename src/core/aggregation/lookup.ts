import _ from 'lodash'
import { AggregationPipeline } from '.'
import * as db from '../..'
import { AnyProps } from '../../types'
import Schema, { FieldDescriptor } from '../Schema'

/**
 * Defines fields to perform lookup on used by #lookupStageFactory(). These fields must be
 * references (i.e. model name as foreign keys) to another model. The fields are represented by the
 * keys in this object. The accepted values of the keys are `true` or another object for recursive
 * lookup of the reference model's foreign keys. If the value is simply `true`, lookup will only be
 * performed on the immediate foreign key, all of its subsequent foreign keys will be ignored. Spec
 * can be nested objects. `$unwind` is immediately followed after the generated `$lookup`.
 */
export type LookupStageFactorySpec = {
  [modelName: string]: boolean | LookupStageFactorySpec
}

export type LookupStageFactoryOptions = {
  /**
  * Prefix for current attributes to look up.
  */
  fromPrefix?: string

  /**
  * Prefix for looked up attributes to save to.
  */
  toPrefix?: string
}

/**
 * Generates the `$lookup` stage of the aggregation pipeline.
 *
 * @param schema - The schema of the database collection.
 * @param spec - Spec that defines the `$lookup` stage, supports looking up nested foreign keys.
 * @param options - Additional options.
 *
 * @returns The aggregation pipeline that handles the generated `$lookup` stage.
 *
 * @example
 * // Returns [{ "$lookup": { "from": "subModels", "localField": "subModel", "foreignField": "_id", "as": "subModel" } },
 *             { "$unwind": { "path": "$subModel", "preserveNullAndEmptyArrays": true } }]
 * lookupStageFactory(schema, { subModel: true })
 *
 * @example
 * // Returns [{ "$lookup": { "from": "subModels", "localField": "subModel", "foreignField": "_id", "as": "subModel" } },
 *             { "$unwind": { "path": "$subModel", "preserveNullAndEmptyArrays": true } },
 *             { "$lookup": { "from": "subSubModels", "localField": "subModel.subSubModel", "foreignField": "_id", "as": "subModel.subSubModel" } },
 *             { "$unwind": { "path": "$subModel.subSubModel", "preserveNullAndEmptyArrays": true } }]
 * lookupStageFactory(schema, { subModel: { subSubModel: true } })
 *
 * @example
 * // Returns [{ "$lookup": { "from": "subModels", "localField": "foo.subModel", "foreignField": "_id", "as": "bar.subModel"" } },
 *             { "$unwind": { "path": "$bar.subModel", "preserveNullAndEmptyArrays": true } },
 *             { "$lookup": { "from": "subSubModels", "localField": "bar.subModel.subSubModel", "foreignField": "_id", "as": "bar.subModel.subSubModel" } },
 *             { "$unwind": { "path": "$bar.subModel.subSubModel", "preserveNullAndEmptyArrays": true } }]
 * lookupStageFactory(schema, { subModel: { subSubModel: true } }, { fromPrefix: 'foo.', toPrefix: 'bar.' })
 *
 * @see
 * {@link https://docs.mongodb.com/manual/reference/operator/aggregation/lookup/}
 *
 * @throws {TypeError} Invalid params or options provided.
 * @throws {Error} Field to populate doesn't have a `ref` field specified.
 * @throws {Error} Unable to find the schema for the field to populate.
 */
export function lookupStageFactory<P extends AnyProps = AnyProps>(schema: Schema<P>, spec: LookupStageFactorySpec, { fromPrefix = '', toPrefix = '' }: LookupStageFactoryOptions = {}): AggregationPipeline {
  const fields: { [fieldName: string]: FieldDescriptor} = schema.fields

  let pipe: AggregationPipeline = []

  for (const key in spec) {
    if (!spec.hasOwnProperty(key)) continue

    const val = spec[key]
    if (!((val === true) || (typeof val === 'object'))) throw new TypeError(`[lookup(${schema}, ${spec}, ${{ fromPrefix, toPrefix }})] Invalid populate properties.`)

    const ref = fields[key] && fields[key].ref
    if (!ref) throw new Error(`[lookup(${schema}, ${spec}, ${{ fromPrefix, toPrefix }})] The field to populate does not have a reference model specified in the schema.`)

    const schemaRef = db.getModel(ref).schema
    if (!schemaRef) throw new Error(`[lookup(${schema}, ${spec}, ${{ fromPrefix, toPrefix }})] Unable to find the model schema corresponding to the field to populate.`)

    pipe.push({
      $lookup: {
        from: `${schemaRef.collection}`,
        localField: `${fromPrefix}${key}`,
        foreignField: '_id',
        as: `${toPrefix}${key}`,
      },
    })

    pipe.push({
      $unwind: {
        path: `$${toPrefix}${key}`,
        preserveNullAndEmptyArrays: true,
      },
    })

    if (!_.isBoolean(val)) {
      pipe = pipe.concat(lookupStageFactory(schemaRef, val, {
        fromPrefix: `${toPrefix}${key}.`,
        toPrefix: `${toPrefix}${key}.`,
      }))
    }
  }

  return pipe
}
