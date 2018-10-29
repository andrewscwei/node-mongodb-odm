import { Collection, CollectionAggregationOptions, CollectionInsertManyOptions, CollectionInsertOneOptions, CommonOptions, FindOneAndReplaceOption, ObjectID, ReplaceOneOptions } from 'mongodb';
import { AggregationPipeline, Document, DocumentFragment, PipelineFactoryOptions, PipelineFactorySpecs, Query, Schema, Update } from '../types';
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
    static randomFields<T = {}>(fixedFields?: DocumentFragment<T>, { includeOptionals }?: ModelRandomFieldsOptions): DocumentFragment<T>;
    static pipeline<T = {}>(queryOrSpecs?: Query<T> | PipelineFactorySpecs, options?: PipelineFactoryOptions): AggregationPipeline;
    static identifyOne<T = {}>(query: Query<T>): Promise<ObjectID>;
    static findOne<T = {}>(query?: Query<T>, options?: ModelFindOneOptions): Promise<null | Document<T>>;
    static findMany<T = {}>(query?: Query<T>, options?: ModelFindManyOptions): Promise<Document<T>[]>;
    static insertOne<T>(doc?: DocumentFragment<T>, options?: ModelInsertOneOptions): Promise<null | Document<T>>;
    static insertMany<T = {}>(docs: DocumentFragment<T>[], options?: ModelInsertManyOptions): Promise<Document<T>[]>;
    static updateOne<T = {}>(query: Query<T>, update: DocumentFragment<T> | Update<T>, options?: ModelUpdateOneOptions): Promise<null | boolean | Document<T>>;
    static updateMany<T = {}>(query: Query<T>, update: DocumentFragment<T> | Update<T>, options?: ModelUpdateManyOptions): Promise<Document<T>[] | boolean>;
    static deleteOne<T = {}>(query: Query<T>, options?: ModelDeleteOneOptions): Promise<Document<T> | boolean | null>;
    static deleteMany<T = {}>(query: Query<T>, options?: ModelDeleteManyOptions): Promise<boolean | Document<T>[]>;
    static findAndReplaceOne<T = {}>(query: Query<T>, replacement?: DocumentFragment<T>, options?: ModelReplaceOneOptions): Promise<null | Document<T>>;
    static count(query: Query, options?: ModelCountOptions): Promise<number>;
    static formatDocument<T = {}>(doc: DocumentFragment<T>): Promise<DocumentFragment<T>>;
    static validateDocument<T = {}>(doc: DocumentFragment<T>, options?: ModelValidateDocumentOptions): Promise<boolean>;
    static willInsertDocument<T = {}>(doc: DocumentFragment<T>): Promise<DocumentFragment<T>>;
    static didInsertDocument<T = {}>(doc: Document<T>): Promise<void>;
    static willUpdateDocument<T = {}>(query: Query<T>, update: DocumentFragment<T> | Update<T>): Promise<[Query, DocumentFragment<T> | Update<T>]>;
    static didUpdateDocument<T = {}>(prevDoc?: Document<T>, newDocs?: Document<T> | Document<T>[]): Promise<void>;
    static willDeleteDocument<T = {}>(query: Query<T>): Promise<Query<T>>;
    static didDeleteDocument<T = {}>(docs?: Document<T> | Document<T>[]): Promise<void>;
    private static beforeInsert;
    private static afterInsert;
    private static beforeUpdate;
    private static afterUpdate;
    private static beforeDelete;
    private static afterDelete;
    private static cascadeDelete;
    constructor();
}
export default Model;
