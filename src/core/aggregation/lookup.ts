import _ from 'lodash'
import * as db from '../..'
import { AnyProps } from '../../types'
import fieldPath from '../../utils/fieldPath'
import prefixed from '../../utils/prefixed'
import Schema from '../Schema'

export type UnwindStage = {
  $unwind: Record<string, any>
}

export type LookupStage = {
  $lookup: Record<string, any>
}

/**
 * Defines fields to perform lookup on used by `lookupStageFactory`. These fields must be references
 * (i.e. model name as foreign keys) to another model. The fields are represented by the keys in
 * this object. The accepted values of the keys are `true` or another object for recursive lookup of
 * the reference model's foreign keys. If the value is simply `true`, lookup will only be performed
 * on the immediate foreign key, all of its inner foreign keys will be ignored. Specs can be nested.
 * `$unwind` is immediately followed after the generated `$lookup`.
 */
export type LookupStageFactorySpecs = {
  [refField: string]: boolean | LookupStageFactorySpecs
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
 * Generates a series of `$lookup` and `$unwind` stages for a collection to be used in an
 * aggregation pipeline. The `specs` define which fields to look up. Each field will be unwinded
 * accordingly so the result of the new field is the looked up document(s) itself.
 *
 * @param schema - The schema of the database collection.
 * @param specs - The specifications for the `$lookup` stage, supports looking up nested foreign
 *                keys.
 * @param options - Additional options.
 *
 * @returns An abstract aggregation pipeline containing the generated series of `$lookup` and
 *          `$unwind` stages.
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
 * @see {@link https://docs.mongodb.com/manual/reference/operator/aggregation/lookup/}
 * @see {@link https://docs.mongodb.com/manual/reference/operator/aggregation/unwind/}
 *
 * @throws {TypeError} Invalid params or options provided.
 * @throws {Error} Field to populate doesn't have a `ref` field specified.
 * @throws {Error} Unable to find the schema for the field to populate.
 */
export function lookupStageFactory<P extends AnyProps = AnyProps>(
  schema: Schema<P>,
  specs: LookupStageFactorySpecs, {
    fromPrefix = '',
    toPrefix = '',
  }: LookupStageFactoryOptions = {},
): (LookupStage | UnwindStage)[] {
  const fields = schema.fields

  let pipe: (LookupStage | UnwindStage)[] = []

  for (const key in specs) {
    if (!specs.hasOwnProperty(key)) continue

    const spec = specs[key]
    const isShallowLookup = _.isBoolean(spec)
    const isDeepLookup = _.isPlainObject(spec)

    if (!isShallowLookup && !isDeepLookup) throw new TypeError(`[lookup(${schema}, ${specs}, ${{ fromPrefix, toPrefix }})] Invalid populate properties.`)

    if (spec === false) continue

    const targetModel = fields[key] && fields[key].ref
    if (!targetModel) throw new Error(`[lookup(${schema}, ${specs}, ${{ fromPrefix, toPrefix }})] The field to populate does not have a reference model specified in the schema.`)

    const targetSchema = db.getModel(targetModel).schema
    if (!targetSchema) throw new Error(`[lookup(${schema}, ${specs}, ${{ fromPrefix, toPrefix }})] Unable to find the model schema corresponding to the field to populate.`)

    // Look up the reference field.
    pipe.push({
      $lookup: {
        from: `${targetSchema.collection}`,
        localField: prefixed(key, fromPrefix),
        foreignField: '_id',
        as: prefixed(key, toPrefix)
      },
    })

    // Unwind the results of the lookup.
    pipe.push({
      $unwind: {
        path: fieldPath(key, toPrefix),
        preserveNullAndEmptyArrays: true,
      },
    })

    // Recursively look up reference fields.
    if (isDeepLookup) {
      pipe = pipe.concat(lookupStageFactory(targetSchema, spec as LookupStageFactorySpecs, {
        fromPrefix: prefixed(key, toPrefix),
        toPrefix: prefixed(key, toPrefix),
      }))
    }
  }

  return pipe
}
