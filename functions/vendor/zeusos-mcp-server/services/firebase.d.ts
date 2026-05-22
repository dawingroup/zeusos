import { FieldValue, type Firestore, type DocumentData } from 'firebase-admin/firestore';
export { FieldValue };
export declare const serverTimestamp: () => FieldValue;
export declare function getDb(): Firestore;
export declare function serializeDoc(data: DocumentData): Record<string, unknown>;
export declare function formatTimestamp(ts: unknown): string;
export declare function formatCurrency(amount: number | undefined | null, currency?: string): string;
export declare function truncateIfNeeded(text: string): string;
export interface QueryFilter {
    field: string;
    op: FirebaseFirestore.WhereFilterOp;
    value: unknown;
}
export interface QueryOptions {
    filters?: QueryFilter[];
    orderByField?: string;
    orderByDirection?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}
/**
 * Query a Firestore collection with filters, ordering, and pagination.
 * Returns raw document data (not serialized — callers handle that).
 */
export declare function queryCollection<T extends {
    id: string;
}>(collectionPath: string, options?: QueryOptions): Promise<{
    items: T[];
    total: number;
}>;
/**
 * Fetch ALL documents matching a set of filters by paging via cursors.
 * Use when you need to apply client-side filtering (text search, nested-field
 * filters) on a small-to-medium collection. Hard-capped to avoid runaway reads.
 */
export declare function fetchAllMatching<T extends {
    id: string;
}>(collectionPath: string, options?: {
    filters?: QueryFilter[];
    orderByField?: string;
    orderByDirection?: 'asc' | 'desc';
    hardCap?: number;
}): Promise<T[]>;
/**
 * Fetch a single document by ID.
 */
export declare function getDocument<T extends {
    id: string;
}>(collectionPath: string, documentId: string): Promise<T | null>;
/**
 * Fetch a single document from a subcollection, e.g. designItems under a project.
 */
export declare function getSubDocument<T extends {
    id: string;
}>(parentCollectionPath: string, parentId: string, subcollectionName: string, documentId: string): Promise<T | null>;
/**
 * Fetch a subcollection from a document.
 */
export declare function getSubcollection<T extends {
    id: string;
}>(parentCollectionPath: string, parentId: string, subcollectionName: string, options?: {
    orderByField?: string;
    orderByDirection?: 'asc' | 'desc';
    limit?: number;
}): Promise<T[]>;
//# sourceMappingURL=firebase.d.ts.map