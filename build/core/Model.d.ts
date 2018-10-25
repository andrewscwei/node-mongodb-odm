import { Collection, CollectionAggregationOptions, CollectionInsertManyOptions, CollectionInsertOneOptions, CommonOptions, FindOneAndReplaceOption, ObjectID, ReplaceOneOptions } from 'mongodb';
import { AggregationPipeline, Document, PipelineFactoryOptions, PipelineFactorySpecs, Query, Schema, Update } from '../types';
interface ModelRandomFieldsOptions {
    includeOptionals?: boolean;
}
interface ModelValidateDocumentOptions {
    strict?: boolean;
    ignoreUniqueIndex?: boolean;
}
interface ModelFindOneOptions extends CollectionAggregationOptions {
}
interface ModelFindManyOptions extends CollectionAggregationOptions {
}
interface ModelInsertOneOptions extends ModelValidateDocumentOptions, CollectionInsertOneOptions {
    ignoreTimestamps?: boolean;
}
interface ModelInsertManyOptions extends ModelValidateDocumentOptions, CollectionInsertManyOptions {
    ignoreTimestamps?: boolean;
}
interface ModelUpdateOneOptions extends ModelInsertOneOptions, FindOneAndReplaceOption, ReplaceOneOptions {
    returnDoc?: boolean;
    ignoreTimestamps?: boolean;
    skipHooks?: boolean;
}
interface ModelUpdateManyOptions extends CommonOptions, FindOneAndReplaceOption {
    returnDocs?: boolean;
    ignoreTimestamps?: boolean;
}
interface ModelDeleteOneOptions extends CommonOptions {
    returnDoc?: boolean;
}
interface ModelDeleteManyOptions extends CommonOptions {
    returnDocs?: boolean;
}
interface ModelReplaceOneOptions extends FindOneAndReplaceOption, ModelDeleteOneOptions, ModelInsertOneOptions {
}
interface ModelCountOptions extends ModelFindManyOptions {
}
declare abstract class Model {
    static schema: Schema;
    static getCollection(): Promise<Collection>;
    static randomFields<U = {}>(fixedFields?: Document<U>, { includeOptionals }?: ModelRandomFieldsOptions): Document<U>;
    static pipeline<U = {}>(queryOrSpecs?: Query<U> | PipelineFactorySpecs, options?: PipelineFactoryOptions): AggregationPipeline;
    static identifyOne<U = {}>(query: Query<U>): Promise<ObjectID>;
    static findOne<U = {}>(query?: Query<U>, options?: ModelFindOneOptions): Promise<null | Document<U>>;
    static findMany<U = {}>(query?: Query<U>, options?: ModelFindManyOptions): Promise<Document<U>[]>;
    static insertOne<U = {}>(doc?: Document<U>, options?: ModelInsertOneOptions): Promise<null | Document<U>>;
    static insertMany<U = {}>(docs: Document<U>[], options?: ModelInsertManyOptions): Promise<Document<U>[]>;
    static updateOne<U = {}>(query: Query<U>, update: Document<U> | Update<U>, options?: ModelUpdateOneOptions): Promise<null | boolean | Document<U>>;
    static updateMany<U = {}>(query: Query<U>, update: Document<U> | Update<U>, options?: ModelUpdateManyOptions): Promise<Document<U>[] | boolean>;
    static deleteOne<U = {}>(query: Query<U>, options?: ModelDeleteOneOptions): Promise<Document<U> | boolean | null>;
    static deleteMany<U = {}>(query: Query<U>, options?: ModelDeleteManyOptions): Promise<boolean | Document<U>[]>;
    static findAndReplaceOne<U = {}>(query: Query<U>, replacement?: Document<U>, options?: ModelReplaceOneOptions): Promise<null | Document<U>>;
    static count<U = {}>(query: Query<U>, options?: ModelCountOptions): Promise<number>;
    static formatDocument<U = {}>(doc: Document<U>): Promise<Document<U>>;
    static validateDocument<U = {}>(doc: Document<U>, options?: ModelValidateDocumentOptions): Promise<boolean>;
    static willInsertDocument<U = {}>(doc: Document<U>): Promise<Document<U>>;
    static didInsertDocument<U = {}>(doc: Document<U>): Promise<void>;
    static willUpdateDocument<U = {}>(query: Query<U>, update: Document<U> | Update<U>): Promise<[Query<U>, Document<U> | Update<U>]>;
    static didUpdateDocument<U = {}>(prevDoc?: Document<U>, newDocs?: Document<U> | Document<U>[]): Promise<void>;
    static willDeleteDocument<U = {}>(query: Query<U>): Promise<Query<U>>;
    static didDeleteDocument<U = {}>(docs?: Document<U> | Document<U>[]): Promise<void>;
    private static beforeInsert;
    private static afterInsert;
    private static beforeUpdate;
    private static afterUpdate;
    private static beforeDelete;
    private static afterDelete;
    private static cascadeDelete;
}
export default Model;
