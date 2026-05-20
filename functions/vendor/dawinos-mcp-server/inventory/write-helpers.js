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
import { getDb, FieldValue, serverTimestamp } from '../services/firebase.js';
import { COLLECTIONS } from '../constants.js';
// ─── Factories ────────────────────────────────────────────────────────────────
export function emptyEnvelope(mode) {
    return {
        mode,
        itemsPlanned: 0,
        itemsCommitted: 0,
        diffs: [],
        warnings: [],
        errors: [],
    };
}
// ─── Diff computation ─────────────────────────────────────────────────────────
/**
 * JSON-based deep equality. Sufficient for the JSON-shaped values Firestore
 * returns (strings, numbers, booleans, nested objects, arrays). NOT safe for
 * functions, Dates, Maps, Sets, or Firestore Timestamps (convert those first).
 */
export function deepEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}
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
export function computeDiff(before, after) {
    const diffs = [];
    walkDiff('', before, after, diffs);
    return diffs;
}
function walkDiff(prefix, before, after, diffs) {
    if (deepEqual(before, after))
        return;
    // Primitives / arrays / mismatched shapes → single diff at this path.
    const bothAreObjects = before !== null &&
        after !== null &&
        typeof before === 'object' &&
        typeof after === 'object' &&
        !Array.isArray(before) &&
        !Array.isArray(after);
    if (!bothAreObjects) {
        diffs.push({ path: prefix || '(root)', before, after });
        return;
    }
    // Recurse into object children under their dot-path.
    const b = before;
    const a = after;
    const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
    for (const key of keys) {
        const nextPath = prefix ? `${prefix}.${key}` : key;
        walkDiff(nextPath, b[key], a[key], diffs);
    }
}
// ─── SKU uniqueness ───────────────────────────────────────────────────────────
/**
 * Check whether `newSku` is already taken by some OTHER inventory doc.
 * Returns the colliding doc ID, or null if the SKU is free.
 *
 * `excludeDocId` lets a rename skip its own current row — without it the caller
 * would see its own doc as a collision when the SKU is unchanged or being reset
 * to itself.
 */
export async function findSkuCollision(newSku, excludeDocId) {
    if (!newSku)
        return null;
    const db = getDb();
    const snap = await db
        .collection(COLLECTIONS.INVENTORY_ITEMS)
        .where('sku', '==', newSku)
        .limit(2)
        .get();
    for (const doc of snap.docs) {
        if (doc.id !== excludeDocId)
            return doc.id;
    }
    return null;
}
/**
 * Like findSkuCollision but batch-aware: takes a list of {docId, newSku} pairs
 * and returns collisions across both (a) the collection at rest and (b) other
 * pairs in the SAME batch.
 *
 * Returns one WriteWarning per collision. Empty array = no collisions.
 */
export async function findBatchSkuCollisions(pairs) {
    const warnings = [];
    // Intra-batch collisions first — cheap, no I/O.
    const newSkuMap = new Map(); // newSku → first itemId that claimed it
    for (const p of pairs) {
        if (!p.newSku)
            continue;
        const owner = newSkuMap.get(p.newSku);
        if (owner && owner !== p.itemId) {
            warnings.push({
                kind: 'collision',
                itemId: p.itemId,
                message: `SKU "${p.newSku}" is claimed by two items in the same batch (${owner} and ${p.itemId})`,
            });
        }
        else {
            newSkuMap.set(p.newSku, p.itemId);
        }
    }
    // Firestore-level collisions (parallel lookups).
    const checks = await Promise.all(pairs.map(async (p) => p.newSku ? { pair: p, owner: await findSkuCollision(p.newSku, p.itemId) } : null));
    for (const c of checks) {
        if (c && c.owner) {
            warnings.push({
                kind: 'collision',
                itemId: c.pair.itemId,
                message: `SKU "${c.pair.newSku}" is already owned by ${c.owner}`,
            });
        }
    }
    return warnings;
}
// ─── Cross-reference scanning ────────────────────────────────────────────────
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
export async function scanSkuReferences(itemId, options = {}) {
    const db = getDb();
    const warnings = [];
    // Each probe: one collection, one field path, description. Keep limits low —
    // we only need a count signal, not the full reference list.
    const probes = [
        // BOQ items store inventoryItemId on their line rows.
        { collection: 'boqItems', field: 'inventoryItemId', value: itemId, label: 'BOQ item rows' },
        // Manufacturing orders: linkedItems[].inventoryItemId is an array field, can't
        // query directly — fall back to a bomEntries subcollection scan if needed.
        // For MVP, probe top-level linkedInventoryItemIds if it exists.
        {
            collection: COLLECTIONS.MANUFACTURING_ORDERS,
            field: 'linkedInventoryItemIds',
            value: itemId,
            label: 'Manufacturing orders',
        },
        // Purchase orders: lineItems[].inventoryItemId — same array-field caveat.
        // Probe top-level itemIds denormalized array.
        {
            collection: COLLECTIONS.PURCHASE_ORDERS,
            field: 'itemIds',
            value: itemId,
            label: 'Purchase orders',
        },
        // Client quotes: lineItems[].inventoryItemId denormalized as itemIds.
        {
            collection: COLLECTIONS.CLIENT_QUOTES,
            field: 'itemIds',
            value: itemId,
            label: 'Client quotes',
        },
        // Stock adjustments denormalize itemIds at the top level.
        {
            collection: COLLECTIONS.STOCK_ADJUSTMENTS,
            field: 'itemIds',
            value: itemId,
            label: 'Stock adjustments',
        },
    ];
    const results = await Promise.all(probes.map(async (p) => {
        try {
            // Try array-contains first — works for both scalar equality (on fields
            // like boqItems.inventoryItemId = itemId → use ==) and array fields
            // (itemIds = [a,b] → use array-contains).
            const op = p.field === 'inventoryItemId' ? '==' : 'array-contains';
            const snap = await db.collection(p.collection).where(p.field, op, p.value).limit(5).get();
            return { probe: p, count: snap.size };
        }
        catch {
            // Missing collection or incompatible field shape — silently skip. The
            // warning is a soft signal, not a guarantee.
            return { probe: p, count: 0 };
        }
    }));
    for (const r of results) {
        if (r.count > 0) {
            const suffix = r.count >= 5 ? '5+' : String(r.count);
            warnings.push({
                kind: 'cross_reference',
                itemId,
                message: `${r.probe.label}: ${suffix} reference(s) found`,
                details: { collection: r.probe.collection, field: r.probe.field },
            });
        }
    }
    // If the caller passed an oldSku, also scan quotes/POs/BOQ for embedded SKU
    // strings (some collections cache the SKU text on their line rows). This is
    // where downstream systems can actually drift when a SKU is renamed.
    if (options.oldSku) {
        const skuProbes = [
            { collection: 'boqItems', field: 'sku', label: 'BOQ rows (by SKU)' },
            { collection: COLLECTIONS.PURCHASE_ORDERS, field: 'skus', label: 'POs (by SKU)' },
            { collection: COLLECTIONS.CLIENT_QUOTES, field: 'skus', label: 'Quotes (by SKU)' },
        ];
        const skuResults = await Promise.all(skuProbes.map(async (p) => {
            try {
                const op = p.field === 'sku' ? '==' : 'array-contains';
                const snap = await db
                    .collection(p.collection)
                    .where(p.field, op, options.oldSku)
                    .limit(5)
                    .get();
                return { probe: p, count: snap.size };
            }
            catch {
                return { probe: p, count: 0 };
            }
        }));
        for (const r of skuResults) {
            if (r.count > 0) {
                const suffix = r.count >= 5 ? '5+' : String(r.count);
                warnings.push({
                    kind: 'cross_reference',
                    itemId,
                    message: `${r.probe.label}: ${suffix} reference(s) found — rename may need downstream update`,
                    details: { collection: r.probe.collection, field: r.probe.field },
                });
            }
        }
    }
    return warnings;
}
// ─── Audit / write stamping ───────────────────────────────────────────────────
/**
 * Mutates `update` in place to add audit fields and returns it for chaining.
 * `writer` should be the MCP tool name (e.g. "dawinos_update_inventory_item")
 * so downstream observability can trace which tool touched which doc.
 */
export function stampAudit(update, writer) {
    update['updatedAt'] = serverTimestamp();
    update['updatedBy'] = writer;
    return update;
}
/**
 * Commit a batch of {ref, update} pairs. Chunks at 400 (Firestore hard limit
 * is 500) and falls back to per-doc updates if a batch fails. Returns the
 * number committed and the number that failed.
 */
export async function commitBatch(writes, writer) {
    const db = getDb();
    const CHUNK = 400;
    let committed = 0;
    let failed = 0;
    const errors = [];
    for (let i = 0; i < writes.length; i += CHUNK) {
        const slice = writes.slice(i, i + CHUNK);
        const batch = db.batch();
        for (const w of slice) {
            batch.update(w.ref, stampAudit({ ...w.update }, writer));
        }
        try {
            await batch.commit();
            committed += slice.length;
        }
        catch (err) {
            // Per-doc fallback: one bad write doesn't sink the whole chunk.
            for (const w of slice) {
                try {
                    await w.ref.update(stampAudit({ ...w.update }, writer));
                    committed++;
                }
                catch (e) {
                    failed++;
                    errors.push(`${w.ref.id}: ${e.message}`);
                }
            }
        }
    }
    return { committed, failed, errors };
}
// ─── Load helpers ─────────────────────────────────────────────────────────────
/**
 * Fetch one inventory item by ID. Returns `null` if missing (NOT an error) so
 * callers can distinguish a missing doc from a network failure.
 */
export async function loadItem(itemId) {
    const db = getDb();
    const ref = db.collection(COLLECTIONS.INVENTORY_ITEMS).doc(itemId);
    const snap = await ref.get();
    if (!snap.exists)
        return null;
    return { id: snap.id, data: snap.data(), ref };
}
/**
 * Fetch one inventory item or throw. Use when a missing doc IS an error (e.g.
 * updateInventoryItem on a nonexistent ID).
 */
export async function assertItemExists(itemId) {
    const item = await loadItem(itemId);
    if (!item)
        throw new Error(`Inventory item "${itemId}" not found`);
    return item;
}
// ─── Field marker ─────────────────────────────────────────────────────────────
/**
 * Marker the caller passes to request deletion of a field. We don't pass
 * FieldValue.delete() directly through tool inputs (zod wouldn't know what to
 * do with it) — instead, callers use this sentinel in their "after" object,
 * and the write helpers translate it to FieldValue.delete() before commit.
 */
export const DELETE_FIELD = Symbol('DELETE_FIELD');
/**
 * Walk a Firestore update object, replacing any DELETE_FIELD sentinels with
 * FieldValue.delete(). Dot-path keys pass through unchanged. Returns the same
 * object for chaining.
 */
export function resolveDeletions(update) {
    for (const [key, val] of Object.entries(update)) {
        if (val === DELETE_FIELD) {
            update[key] = FieldValue.delete();
        }
    }
    return update;
}
//# sourceMappingURL=write-helpers.js.map