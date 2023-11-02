import * as db from '../../index.js'
import { type AnyProps } from '../../types/index.js'
import { fieldPath, prefixed } from '../../utils/index.js'
import { type Schema } from '../Schema.js'

export type UnwindStage = {
  $unwind: Record<string, any>
}

export type LookupStage = {
  $lookup: Record<string, any>
}

/**
 * Defines fields to perform lookup on in the {@link lookupStageFactory} method.
 * These fields, as represented by the keys, must be references (i.e. model
 * names as foreign keys) to other models. The accepted values of the keys are
 * `true` or a {@link LookupStageSingleFieldFactorySpecs} object that specifies
 * custom parameters for the `$lookup` stage. If the value is simply `true`, the
 * `$lookup` stage will use default parameters.
 */
export type LookupStageFactorySpecs = Record<string, boolean | LookupStageSingleFieldFactorySpecs>

/**
 * Specifies parameters that define how the `$lookup` stage should be generated
 * for a single field.
 */
export type LookupStageSingleFieldFactorySpecs = {
  /**
   * Specifies the `foreignField` parameter of the `$lookup` stage, which is the
   * field of the target collection to perform the lookup on. If unspecified,
   * this defaults to `_id`.
   */
  foreign?: string

  /**
   * Specifies if the looked up field should be an array. Set this to `false` to
   * generate an `$unwind` stage following the `$lookup` stage in order to
   * convert the results array to a single result.
   */
  isArray?: boolean

  /**
   * Specifies the {@link LookupStageFactorySpecs} to apply to this field after
   * the immediate is complete, to further look up nested reference fields.
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
 * Generates a series of `$lookup` and (if needed) `$unwind` stages for a
 * collection to be used in an aggregation pipeline. The `specs` define which
 * fields to look up. Each field will be unwinded accordingly so the result of
 * the new field is the looked up document(s) itself.
 *
 * @param schema The schema of the database collection.
 * @param specs Look up specs for each field to look up, see
 *              {@link LookupStageFactorySpecs}.
 * @param options Additional options, see {@link LookupStageFactoryOptions}.
 *
 * @returns An abstract aggregation pipeline containing the generated series of
 *          `$lookup` and (if needed) `$unwind` stages.
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
 * @see
 * {@link https://docs.mongodb.com/manual/reference/operator/aggregation/unwind/}
 *
 * @throws {Error} When there is an error generating the `$lookup` stage for a
 *                 field.
 */
export function lookupStageFactory<P extends AnyProps = AnyProps>(
  schema: Schema<P>,
  specs: LookupStageFactorySpecs,
  options: LookupStageFactoryOptions = {},
): (LookupStage | UnwindStage)[] {
  let out: (LookupStage | UnwindStage)[] = []

  for (const field in specs) {
    if (!{}.hasOwnProperty.call(specs, field)) continue

    const spec = specs[field]
    if (spec === false) continue

    out = out.concat(lookupStageSingleFieldFactory(schema, field, spec === true ? undefined : spec, options)) // Throws
  }

  return out
}

/**
 * Generates a `$lookup` stage and (if any) `$unwind` stage for a field defined
 * in the schema of a collection.
 *
 * @param schema The schema of the target collection.
 * @param field The field in the schema to look up.
 * @param specs Specs for look up this field, see
 *              {@link LookupStageSingleFieldFactorySpecs}.
 * @param options Additional options, see {@link LookupStageFactoryOptions}.
 *
 * @returns An arbitrary pipeline containing the generated `$lookup` stage and
 *          `$unwind` stage (if applicable).
 *
 * @throws {Error} - When there is an error generating the `$lookup` stage.
 */
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
