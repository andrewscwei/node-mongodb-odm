import { Db } from 'mongodb';
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
export declare function configure(descriptor: Configuration): void;
export declare function connect(): Promise<void>;
export declare function disconnect(): Promise<void>;
export declare function isConnected(): boolean;
export declare function getInstance(): Promise<Db>;
export declare function getModel(modelOrCollectionName: string): typeof Model;
