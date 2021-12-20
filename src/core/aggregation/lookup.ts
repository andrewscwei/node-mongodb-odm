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
 * Defines fields to perform lookup on in the `lookupStageFactory` method. These fields, as
 * represented by the keys, must be references (i.e. model names as foreign keys) to other models.
 * The accepted values of the keys are `true` or a `LookupStageSingleFieldFactorySpecs` object that
 * specifies custom parameters for the `$lookup` stage. If the value is simply `true`, the `$lookup`
 * stage will use default parameters.
 *
 * @see {@link LookupStageSingleFieldFactorySpecs}
 */
export type LookupStageFactorySpecs = {
  [refField: string]: boolean | LookupStageSingleFieldFactorySpecs
}

/**
 * Specifies parameters that define how the `$lookup` stage should be generated for a single field.
 */
export type LookupStageSingleFieldFactorySpecs = {
  /**
   * Specifies the `foreignField` parameter of the `$lookup` stage, which is the field of the target
   * collection to perform the lookup on. If unspecified, this defaults to `_id`.
   */
  foreign?: string

  /**
   * Specifies if the looked up field should be an array. Set this to `false` to generate an
   * `$unwind` stage following the `$lookup` stage in order to convert the results array to a single
   * result.
   */
  isArray?: boolean

  /**
   * Specifies the `LookupStageFactorySpecs` to apply to this field after the immediate  is
   * complete, to further look up nested reference fields.
   *
   * @see {@link LookupStageFactorySpecs}
   */
  lookup?: LookupStageFactorySpecs

  /**
   * Specifies the `as` parameter of the `$lookup` stage.
   */
  as?: string
}

export type LookupStageFactoryOptions = {
  /**
   * Prefix to prepend fields before the lookup.
   */
  fromPrefix?: string

  /**
   * Prefix to preprend fields after the lookup.
   */
  toPrefix?: string
}

/**
 * Generates a series of `$lookup` and (if needed) `$unwind` stages for a collection to be used in
 * an aggregation pipeline. The `specs` define which fields to look up. Each field will be unwinded
 * accordingly so the result of the new field is the looked up document(s) itself.
 *
 * @param schema - The schema of the database collection.
 * @param specs - The specifications for the `$lookup` stage, supports looking up nested foreign
 *                keys.
 * @param options - Additional options.
 *
 * @returns An abstract aggregation pipeline containing the generated series of `$lookup` and (if
 *          needed) `$unwind` stages.
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
  specs: LookupStageFactorySpecs,
  options: LookupStageFactoryOptions = {},
): (LookupStage | UnwindStage)[] {
  let out: (LookupStage | UnwindStage)[] = []

  for (const field in specs) {
    if (!specs.hasOwnProperty(field)) continue

    const spec = specs[field]
    if (spec === false) continue

    out = out.concat(lookupStageSingleFieldFactory(schema, field, spec === true ? undefined : spec, options))
  }

  return out
}

function lookupStageSingleFieldFactory<P extends AnyProps = AnyProps>(
  schema: Schema<P>,
  field: string,
  {
    as,
    foreign,
    isArray,
    lookup,
  }: LookupStageSingleFieldFactorySpecs = {},
  {
    fromPrefix = '',
    toPrefix = '',
  }: LookupStageFactoryOptions = {},
): (LookupStage | UnwindStage)[] {
  let out: (LookupStage | UnwindStage)[] = []

  const fieldDescriptor = schema.fields[field]
  if (!fieldDescriptor) throw new Error(`Failed to generate $lookup stage: the field "${field}" does not exist in the schema for collection "${schema.collection}"`)

  const targetModel = fieldDescriptor.ref
  if (!targetModel) throw new Error(`Failed to generate $lookup stage: the field "${field}" does not have a reference model specified in the schema for collection "${schema.collection}"`)

  const targetSchema = db.getModel(targetModel).schema
  if (!targetSchema) throw new Error(`Failed to generate $lookup stage: unable to find the schema for to the reference model ${targetModel}.`)

  // Look up the reference field.
  out.push({
    $lookup: {
      as: prefixed(as ?? field, toPrefix),
      foreignField: foreign ?? '_id',
      from: `${targetSchema.collection}`,
      localField: prefixed(field, fromPrefix),
    },
  })

  // Unwind the results of the lookup if applicable.
  if (isArray !== true) {
    out.push({
      $unwind: {
        path: fieldPath(as ?? field, toPrefix),
        preserveNullAndEmptyArrays: true,
      },
    })
  }

  // Recursively look up reference fields.
  if (lookup) {
    out = out.concat(lookupStageFactory(targetSchema, lookup, {
      fromPrefix: prefixed(field, toPrefix),
      toPrefix: prefixed(field, toPrefix),
    }))
  }

  return out
}
