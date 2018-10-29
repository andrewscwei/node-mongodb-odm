import { DocumentFragment, FieldValue, Schema } from '../types';
export default function sanitizeDocument<T = {}>(schema: Schema, doc: {
    [field: string]: FieldValue;
}): DocumentFragment<T>;
