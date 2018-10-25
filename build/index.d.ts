import { Collection, Db } from 'mongodb';
import Model from './core/Model';
export interface Configuration {
    host: string;
    name: string;
    username?: string;
    password?: string;
    models?: {
        [modelName: string]: typeof Model;
    };
}
export declare function configureDb(descriptor: Configuration): void;
export declare function getDbInstance(): Promise<Db>;
export declare function getModel(modelOrCollectionName: string): typeof Model;
export declare function getCollection(modelOrCollectionName: string): Promise<Collection>;
