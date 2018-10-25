import { Document, Query, Schema } from '../types';
interface SanitizeQueryOptions {
    strict?: boolean;
}
export default function sanitizeQuery<T = {}>(schema: Schema, query: Query<T>, { strict }?: SanitizeQueryOptions): Document<T>;
export {};
