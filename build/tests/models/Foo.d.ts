import { ObjectID } from 'mongodb';
import Model from '../../core/Model';
import { Schema } from '../../types';
export interface FooProps {
    aString: string;
    aNumber: number;
    aBar: ObjectID;
    aFoo: ObjectID;
}
export declare const FooSchema: Schema<FooProps>;
export default class Foo extends Model {
    static schema: Schema<FooProps>;
}
