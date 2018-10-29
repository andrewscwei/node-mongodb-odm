import { CollectionAggregationOptions, CollectionInsertManyOptions, CollectionInsertOneOptions, CommonOptions, FilterQuery, FindOneAndReplaceOption, IndexOptions, ObjectID, ReplaceOneOptions, UpdateQuery } from 'mongodb';
export declare type Document<T = {}> = T & {
    _id: ObjectID;
    createdAt?: Date;
    updatedAt?: Date;
} & {
    [field: string]: FieldValue;
};
export declare type DocumentFragment<T = {}> = Partial<Document<T>>;
export declare type Query<T = {}> = string | ObjectID | FilterQuery<T>;
export declare type Update<T = {}> = UpdateQuery<DocumentFragment<T>>;
export declare type FieldType = FieldBasicType | FieldBasicType[] | {
    [field: string]: FieldSpecs;
};
export declare type FieldValue = undefined | FieldBasicValue | FieldBasicValue[] | {
    [subfield: string]: FieldValue;
};
export declare type GeoCoordinate = [number, number];
export interface FieldSpecs<T = FieldValue> {
    type: FieldType;
    ref?: string;
    required?: boolean;
    encrypted?: boolean;
    default?: T | FieldDefaultValueFunction<T>;
    format?: FieldFormatFunction<T>;
    validate?: FieldValidationStrategy<T>;
    random?: FieldRandomValueFunction<T>;
}
export interface Schema<T = any> {
    model: string;
    collection: string;
    timestamps?: boolean;
    allowUpsert?: boolean;
    noInserts?: boolean;
    noInsertMany?: boolean;
    noUpdates?: boolean;
    noUpdateMany?: boolean;
    noDeletes?: boolean;
    noDeleteMany?: boolean;
    cascade?: string[];
    fields: {
        [K in keyof Required<T>]: FieldSpecs<NonNullable<T[K]>>;
    };
    indexes?: SchemaIndex[];
}
export interface ModelRandomFieldsOptions {
    includeOptionals?: boolean;
}
export interface ModelValidateDocumentOptions {
    strict?: boolean;
    ignoreUniqueIndex?: boolean;
}
export interface ModelFindOneOptions extends CollectionAggregationOptions {
}
export interface ModelFindManyOptions extends CollectionAggregationOptions {
}
export interface ModelInsertOneOptions extends ModelValidateDocumentOptions, CollectionInsertOneOptions {
    ignoreTimestamps?: boolean;
}
export interface ModelInsertManyOptions extends ModelValidateDocumentOptions, CollectionInsertManyOptions {
    ignoreTimestamps?: boolean;
}
export interface ModelUpdateOneOptions extends ModelInsertOneOptions, FindOneAndReplaceOption, ReplaceOneOptions {
    returnDoc?: boolean;
    ignoreTimestamps?: boolean;
    skipHooks?: boolean;
}
export interface ModelUpdateManyOptions extends CommonOptions, FindOneAndReplaceOption {
    returnDocs?: boolean;
    ignoreTimestamps?: boolean;
}
export interface ModelDeleteOneOptions extends CommonOptions {
    returnDoc?: boolean;
}
export interface ModelDeleteManyOptions extends CommonOptions {
    returnDocs?: boolean;
}
export interface ModelReplaceOneOptions extends FindOneAndReplaceOption, ModelDeleteOneOptions, ModelInsertOneOptions {
}
export interface ModelCountOptions extends ModelFindManyOptions {
}
export interface AggregationStageDescriptor {
    [stageName: string]: {
        [key: string]: any;
    };
}
export declare type AggregationPipeline = AggregationStageDescriptor[];
export interface PipelineFactoryOptions {
    prefix?: string;
    pipeline?: AggregationPipeline;
}
export interface PipelineFactorySpecs {
    $lookup?: LookupStageFactorySpecs;
    $match?: MatchStageFactorySpecs;
    $prune?: MatchStageFactorySpecs;
    $group?: GroupStageFactorySpecs;
    $sort?: SortStageFactorySpecs;
}
export declare type MatchStageFactorySpecs = Query;
export interface MatchStageFactoryOptions {
    prefix?: string;
}
export interface LookupStageFactorySpecs {
    [modelName: string]: boolean | LookupStageFactorySpecs;
}
export interface LookupStageFactoryOptions {
    fromPrefix?: string;
    toPrefix?: string;
}
export declare type GroupStageFactorySpecs = string | {
    [key: string]: any;
};
export interface SortStageFactorySpecs {
    [key: string]: any;
}
export interface ProjectStageFactoryOptions {
    toPrefix?: string;
    fromPrefix?: string;
    populate?: ProjectStageFactoryOptionsPopulate;
    exclude?: any[];
}
export interface ProjectStageFactoryOptionsPopulate {
    [modelName: string]: boolean | ProjectStageFactoryOptionsPopulate;
}
declare type FieldBasicType = typeof String | typeof Number | typeof Boolean | typeof Date | typeof ObjectID | typeof Array;
declare type FieldBasicValue = null | ObjectID | string | number | boolean | Date;
declare type FieldFormatFunction<T = FieldValue> = (value: T) => T;
declare type FieldValidationStrategy<T = FieldValue> = RegExp | number | any[] | FieldValidationFunction<T>;
declare type FieldValidationFunction<T = FieldValue> = (value: T) => boolean;
declare type FieldRandomValueFunction<T = FieldValue> = () => T;
declare type FieldDefaultValueFunction<T = FieldValue> = () => T;
interface SchemaIndex {
    spec: {
        [key: string]: any;
    };
    options?: IndexOptions;
}
export declare function typeIsUpdate<T = {}>(value: any): value is Update<T>;
export declare function typeIsIdentifiableDocument(value: any): value is {
    _id: ObjectID;
} & {
    [field: string]: FieldValue;
};
export declare function typeIsObjectID(value: any): value is ObjectID;
export declare function typeIsGeoCoordinate(value: any): value is GeoCoordinate;
export {};
