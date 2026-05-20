/**
 * Shared write helpers for the inventory MCP write surface.
 *
 * Provides:
 *   - Standard envelope types (WriteEnvelope, ItemDiff, WriteWarning)
 *   - Diff computation (before/after → FieldDiff[])
 *   - SKU uniqueness pre-checks
 *   - Cross-reference scanning (inventoryItemId across BOQ, MOs, POs, quotes, adjustments)
 *   - Audit-field stamping
 *   - Batch commit with per-doc fallback
 *
 * All helpers key off COLLECTIONS.INVENTORY_ITEMS (inventoryItems) — NOT the spec's
 * generic "inventory" name. Writers used this module should be the ONLY way MCP
 * tools mutate inventory, so retiring bespoke admin scripts stays coherent.
 */
import type { DocumentReference } from 'firebase-admin/firestore';
/**
 * A single field-level change on one document.
 * `path` uses dot notation for nested fields (e.g. "pricing.costPerUnit").
 */
export interface FieldDiff {
    path: string;
    before: unknown;
    after: unknown;
}
/**
 * A diff for one inventory item — a list of changed fields plus identifiers
 * sufficient to show the user which row is being mutated.
 */
export interface ItemDiff {
    itemId: string;
    sku: string;
    name: string;
    changes: FieldDiff[];
}
/**
 * A non-fatal warning surfaced to the caller. Unlike collisions (which ABORT),
 * warnings are informational — e.g. "item referenced by 3 BOQ rows".
 */
export interface WriteWarning {
    kind: 'cross_reference' | 'collision' | 'missing' | 'noop' | 'other';
    itemId?: string;
    message: string;
    details?: unknown;
}
/**
 * Standard envelope every write tool returns. Lets the caller inspect the
 * planned diff before confirming a commit, and surfaces warnings consistently.
 */
export interface WriteEnvelope {
    mode: 'dry_run' | 'commit';
    itemsPlanned: number;
    itemsCommitted: number;
    diffs: ItemDiff[];
    warnings: WriteWarning[];
    errors: string[];
}
export declare function emptyEnvelope(mode: 'dry_run' | 'commit'): WriteEnvelope;
/**
 * JSON-based deep equality. Sufficient for the JSON-shaped values Firestore
 * returns (strings, numbers, booleans, nested objects, arrays). NOT safe for
 * functions, Dates, Maps, Sets, or Firestore Timestamps (convert those first).
 */
export declare function deepEqual(a: unknown, b: unknown): boolean;
/**
 * Walk two objects and produce one FieldDiff per differing leaf path.
 * Fields present in `after` but missing from `before` produce `before: undefined`.
 * Fields present in `before` but missing from `after` are NOT reported — use
 * explicit `FieldValue.delete()` if you need to remove a field, and pass the
 * symbol marker instead (see `markDeleted`).
 *
 * Nested arrays are compared as whole values (no per-index diffing) — the only
 * array fields this module touches are `familySkuIds`, `variantAttributes`,
 * `variantAttributeDefinitions`, and `tags`, all of which are small.
 */
export declare function computeDiff(before: Record<string, unknown>, after: Record<string, unknown>): FieldDiff[];
/**
 * Check whether `newSku` is already taken by some OTHER inventory doc.
 * Returns the colliding doc ID, or null if the SKU is free.
 *
 * `excludeDocId` lets a rename skip its own current row — without it the caller
 * would see its own doc as a collision when the SKU is unchanged or being reset
 * to itself.
 */
export declare function findSkuCollision(newSku: string, excludeDocId?: string): Promise<string | null>;
/**
 * Like findSkuCollision but batch-aware: takes a list of {docId, newSku} pairs
 * and returns collisions across both (a) the collection at rest and (b) other
 * pairs in the SAME batch.
 *
 * Returns one WriteWarning per collision. Empty array = no collisions.
 */
export declare function findBatchSkuCollisions(pairs: Array<{
    itemId: string;
    newSku: string;
}>): Promise<WriteWarning[]>;
/**
 * Scan for references to an inventory item across BOQs, MOs, POs, quotes, and
 * stock adjustments. Returns one WriteWarning per non-empty collection hit.
 *
 * This is a BEST-EFFORT safety net — not a full referential-integrity check.
 * The goal is to surface "this item is referenced elsewhere" so callers can
 * decide whether to abort or pass `allow_cross_ref: true` to proceed anyway.
 *
 * Most downstream collections store inventory links by DOC ID, not SKU — so
 * renaming a SKU is usually safe even with references. The warning is mainly
 * for DELETE and for SKU renames where downstream systems might have cached.
 */
export declare function scanSkuReferences(itemId: string, options?: {
    oldSku?: string;
}): Promise<WriteWarning[]>;
/**
 * Mutates `update` in place to add audit fields and returns it for chaining.
 * `writer` should be the MCP tool name (e.g. "dawinos_update_inventory_item")
 * so downstream observability can trace which tool touched which doc.
 */
export declare function stampAudit(update: Record<string, unknown>, writer: string): Record<string, unknown>;
/**
 * Commit a batch of {ref, update} pairs. Chunks at 400 (Firestore hard limit
 * is 500) and falls back to per-doc updates if a batch fails. Returns the
 * number committed and the number that failed.
 */
export declare function commitBatch(writes: Array<{
    ref: DocumentReference;
    update: Record<string, unknown>;
}>, writer: string): Promise<{
    committed: number;
    failed: number;
    errors: string[];
}>;
/**
 * Fetch one inventory item by ID. Returns `null` if missing (NOT an error) so
 * callers can distinguish a missing doc from a network failure.
 */
export declare function loadItem(itemId: string): Promise<{
    id: string;
    data: Record<string, unknown>;
    ref: DocumentReference;
} | null>;
/**
 * Fetch one inventory item or throw. Use when a missing doc IS an error (e.g.
 * updateInventoryItem on a nonexistent ID).
 */
export declare function assertItemExists(itemId: string): Promise<{
    id: string;
    data: Record<string, unknown>;
    ref: DocumentReference;
}>;
/**
 * Marker the caller passes to request deletion of a field. We don't pass
 * FieldValue.delete() directly through tool inputs (zod wouldn't know what to
 * do with it) — instead, callers use this sentinel in their "after" object,
 * and the write helpers translate it to FieldValue.delete() before commit.
 */
export declare const DELETE_FIELD: unique symbol;
export type DeleteMarker = typeof DELETE_FIELD;
/**
 * Walk a Firestore update object, replacing any DELETE_FIELD sentinels with
 * FieldValue.delete(). Dot-path keys pass through unchanged. Returns the same
 * object for chaining.
 */
export declare function resolveDeletions(update: Record<string, unknown>): Record<string, unknown>;
//# sourceMappingURL=write-helpers.d.ts.map