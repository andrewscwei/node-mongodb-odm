import { Document, Schema } from '../types';
export default function sanitizeDocument<T = {}>(schema: Schema, doc: Document<T> | {
    [key: string]: any;
}): Document<T>;
