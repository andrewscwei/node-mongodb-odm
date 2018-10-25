import { ObjectID } from 'mongodb';
import Model from '../../core/Model';
import { Schema } from '../../types';
export interface BarProps {
    aBar: ObjectID;
    aString: string;
    aDate: Date;
    anObject: {
        aString: string;
        aNumber: number;
        aBoolean: boolean;
    };
    aNumber: number;
    aBoolean: boolean;
}
export declare const BarSchema: Schema<BarProps>;
export default class Bar extends Model {
    static schema: Schema<BarProps>;
}
