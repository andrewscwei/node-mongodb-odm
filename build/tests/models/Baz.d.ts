import Model from '../../core/Model';
import { Schema } from '../../types';
export interface BazProps {
    aString: string;
    aNumber?: number;
    aBoolean?: boolean;
    aFormattedString?: string;
    anEncryptedString?: string;
}
export declare const BazSchema: Schema<BazProps>;
export default class Baz extends Model {
    static schema: Schema<BazProps>;
}
