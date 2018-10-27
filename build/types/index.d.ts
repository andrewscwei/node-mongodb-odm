import { IndexOptions, ObjectID, UpdateQuery } from 'mongodb';
declare type FieldBaseType = typeof String | typeof Number | typeof Boolean | typeof Date | typeof ObjectID | typeof Array;
export declare type Document<T = {}> = Partial<T> & {
    _id?: ObjectID;
    createdAt?: Date;
    updatedAt?: Date;
    [field: string]: FieldValue;
};
export declare type Query<T = {}> = string | ObjectID | Document<T> | {
    [key: string]: any;
};
export declare type Update<T = {}> = UpdateQuery<Document<T>>;
export declare type FieldType = FieldBaseType | FieldBaseType[] | {
    [key: string]: FieldSpecs;
};
export declare type GeoCoordinate = [number, number];
export interface FieldSpecs {
    type: FieldType;
    ref?: string;
    required?: boolean;
    encrypted?: boolean;
    default?: FieldValue | FieldDefaultValueFunction;
    format?: FieldFormatFunction;
    validate?: FieldValidationStrategy;
    random?: FieldRandomValueFunction;
}
export interface Schema<T = {}> {
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
        [K in keyof T]: FieldSpecs;
    };
    indexes?: SchemaIndex[];
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
declare type FieldValue = undefined | null | ObjectID | string | number | boolean | Date | any[] | {
    [key: string]: FieldValue;
};
declare type FieldFormatFunction = (value: any) => FieldValue;
declare type FieldValidationStrategy = RegExp | number | any[] | FieldValidationFunction;
declare type FieldValidationFunction = (value: any) => boolean;
declare type FieldRandomValueFunction = () => FieldValue;
declare type FieldDefaultValueFunction = () => FieldValue;
interface SchemaIndex {
    spec: {
        [key: string]: any;
    };
    options?: IndexOptions;
}
export declare function typeIsUpdate<T = {}>(value: any): value is Update<T>;
export declare function typeIsGeoCoordinate(value: any): value is GeoCoordinate;
export {};
