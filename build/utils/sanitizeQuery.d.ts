import { Query, Schema } from '../types';
interface SanitizeQueryOptions {
    strict?: boolean;
}
export default function sanitizeQuery<T = {}>(schema: Schema, query: Query, { strict }?: SanitizeQueryOptions): {
    [key: string]: any;
};
export {};
