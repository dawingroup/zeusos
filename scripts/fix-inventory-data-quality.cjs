/**
 * Fix Inventory Data Quality
 *
 * This script fixes identified data quality issues in the inventoryItems
 * collection. Run the audit script first to see what will be affected.
 *
 * Fixes:
 *   1. Create missing parent documents for orphaned non-timber families
 *   2. Normalize duplicate supplier names
 *   3. Tag suspect pricing items with 'needs-price-review'
 *   4. Set default UOMs by category for items missing both
 *   5. Log all changes with item IDs and field names
 *
 * Run: NODE_PATH=functions/node_modules node scripts/fix-inventory-data-quality.cjs --dry-run
 *      NODE_PATH=functions/node_modules node scripts/fix-inventory-data-quality.cjs --execute
 *
 * Options:
 *   --dry-run   Preview changes without writing (default)
 *   --execute   Actually write changes to Firestore
 */

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const DRY_RUN = !process.argv.includes('--execute');
const MAX_BATCH_SIZE = 500;

// ─── Configuration ──────────────────────────────────────────────────────────

/**
 * Known supplier name duplicates: variant → canonical name.
 */
const SUPPLIER_NAME_MAP = {
  'Ingco Uganda (official store)': 'Ingco Uganda',
};

/**
 * Default UOMs by category for items missing both purchaseUom and stockUom.
 */
const DEFAULT_UOMS = {
  'solid-wood':    { purchaseUom: 'pcs',   stockUom: 'cbm' },
  'sheet-goods':   { purchaseUom: 'sheet', stockUom: 'sheet' },
  'hardware':      { purchaseUom: 'pcs',   stockUom: 'pcs' },
  'finishing':     { purchaseUom: 'can',   stockUom: 'ltr' },
  'fasteners':     { purchaseUom: 'box',   stockUom: 'pcs' },
  'adhesives':     { purchaseUom: 'can',   stockUom: 'ltr' },
  'edge-banding':  { purchaseUom: 'roll',  stockUom: 'lft' },
  'other':         { purchaseUom: 'pcs',   stockUom: 'pcs' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Find the longest common prefix among an array of strings.
 */
function longestCommonPrefix(strings) {
  if (!strings || strings.length === 0) return '';
  if (strings.length === 1) return strings[0];

  const sorted = [...strings].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  let i = 0;
  while (i < first.length && first[i] === last[i]) i++;

  let prefix = first.substring(0, i).trim();
  // Remove trailing punctuation/separators
  prefix = prefix.replace(/[\s\-–—,;:|]+$/, '').trim();
  return prefix;
}

/**
 * Batch writer that auto-commits at MAX_BATCH_SIZE.
 */
class BatchWriter {
  constructor() {
    this.batch = db.batch();
    this.count = 0;
    this.totalCommitted = 0;
  }

  set(ref, data) {
    this.batch.set(ref, data);
    this.count++;
    return this._maybeCommit();
  }

  update(ref, data) {
    this.batch.update(ref, data);
    this.count++;
    return this._maybeCommit();
  }

  async _maybeCommit() {
    if (this.count >= MAX_BATCH_SIZE) {
      await this.commit();
    }
  }

  async commit() {
    if (this.count > 0) {
      await this.batch.commit();
      this.totalCommitted += this.count;
      this.count = 0;
      this.batch = db.batch();
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  INVENTORY DATA QUALITY FIX');
  console.log('══════════════════════════════════════════════════════\n');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'EXECUTE (writing changes)'}\n`);

  const snapshot = await db.collection('inventoryItems').get();
  const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const itemIds = new Set(items.map((i) => i.id));

  console.log(`Total inventory items: ${items.length}\n`);

  const writer = new BatchWriter();
  const changeLog = [];

  function logChange(itemId, itemName, field, oldVal, newVal) {
    changeLog.push({ itemId, itemName, field, oldVal, newVal });
    console.log(`  [CHANGE] ${itemId} "${itemName}" — ${field}: ${JSON.stringify(oldVal)} → ${JSON.stringify(newVal)}`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Fix 1: Create missing parents for orphaned non-timber families
  // ════════════════════════════════════════════════════════════════════════
  console.log('──────────────────────────────────────────────────────');
  console.log('  FIX 1: CREATE MISSING PARENT DOCUMENTS');
  console.log('──────────────────────────────────────────────────────\n');

  const orphansByFamily = {};
  for (const item of items) {
    if (item.familyId && !itemIds.has(item.familyId)) {
      if (!orphansByFamily[item.familyId]) {
        orphansByFamily[item.familyId] = [];
      }
      orphansByFamily[item.familyId].push(item);
    }
  }

  let parentsCreated = 0;
  let parentsSkippedTimber = 0;

  for (const [familyId, children] of Object.entries(orphansByFamily)) {
    const firstChild = children[0];
    const category = firstChild.category || 'other';

    // Skip solid-wood (timber) — handled separately
    if (category === 'solid-wood') {
      parentsSkippedTimber++;
      console.log(`  [SKIP] familyId=${familyId} — solid-wood (timber orphans handled separately)`);
      continue;
    }

    // Derive name from longest common prefix of children names
    const childNames = children.map((c) => c.name || '').filter(Boolean);
    let parentName = longestCommonPrefix(childNames);
    if (!parentName || parentName.length < 3) {
      // Fallback: use first child's name with " (Family)" suffix
      parentName = (firstChild.name || 'Unknown') + ' (Family)';
    }

    const parentDoc = {
      name: parentName,
      isFamily: true,
      isOrderable: false,
      isBomSelectable: false,
      category: category,
      tier: firstChild.tier || null,
      status: 'active',
      skuIds: children.map((c) => c.id),
      createdAt: FieldValue.serverTimestamp(),
      createdBy: 'SCRIPT_FIX_DATA_QUALITY',
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: 'SCRIPT_FIX_DATA_QUALITY',
    };

    console.log(`  [CREATE] Parent "${parentName}" (id=${familyId}, category=${category}, ${children.length} children)`);
    logChange(familyId, parentName, 'document', null, 'CREATED');

    if (!DRY_RUN) {
      const ref = db.collection('inventoryItems').doc(familyId);
      await writer.set(ref, parentDoc);
    }

    parentsCreated++;
  }

  console.log(`\n  Parents to create: ${parentsCreated}`);
  console.log(`  Timber families skipped: ${parentsSkippedTimber}\n`);

  // ════════════════════════════════════════════════════════════════════════
  // Fix 2: Normalize supplier names
  // ════════════════════════════════════════════════════════════════════════
  console.log('──────────────────────────────────────────────────────');
  console.log('  FIX 2: NORMALIZE SUPPLIER NAMES');
  console.log('──────────────────────────────────────────────────────\n');

  let suppliersNormalized = 0;

  for (const item of items) {
    const currentName = item.preferredSupplierName;
    if (!currentName) continue;

    const canonical = SUPPLIER_NAME_MAP[currentName];
    if (canonical) {
      logChange(item.id, item.name, 'preferredSupplierName', currentName, canonical);

      if (!DRY_RUN) {
        const ref = db.collection('inventoryItems').doc(item.id);
        await writer.update(ref, {
          preferredSupplierName: canonical,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: 'SCRIPT_FIX_DATA_QUALITY',
        });
      }

      suppliersNormalized++;
    }
  }

  console.log(`\n  Supplier names normalized: ${suppliersNormalized}\n`);

  // ════════════════════════════════════════════════════════════════════════
  // Fix 3: Tag suspect pricing
  // ════════════════════════════════════════════════════════════════════════
  console.log('──────────────────────────────────────────────────────');
  console.log('  FIX 3: TAG SUSPECT PRICING');
  console.log('──────────────────────────────────────────────────────\n');

  let pricingTagged = 0;

  for (const item of items) {
    const cost = item.pricing?.costPerUnit;
    const currency = item.pricing?.currency;

    if (typeof cost === 'number' && cost > 0 && cost < 100 && currency === 'UGX') {
      const currentTags = item.tags || [];
      if (currentTags.includes('needs-price-review')) {
        continue; // Already tagged
      }

      logChange(item.id, item.name, 'tags', currentTags, [...currentTags, 'needs-price-review']);

      if (!DRY_RUN) {
        const ref = db.collection('inventoryItems').doc(item.id);
        await writer.update(ref, {
          tags: FieldValue.arrayUnion('needs-price-review'),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: 'SCRIPT_FIX_DATA_QUALITY',
        });
      }

      pricingTagged++;
    }
  }

  console.log(`\n  Items tagged with 'needs-price-review': ${pricingTagged}\n`);

  // ════════════════════════════════════════════════════════════════════════
  // Fix 4: Set default UOMs by category
  // ════════════════════════════════════════════════════════════════════════
  console.log('──────────────────────────────────────────────────────');
  console.log('  FIX 4: SET DEFAULT UOMs BY CATEGORY');
  console.log('──────────────────────────────────────────────────────\n');

  let uomsSet = 0;

  for (const item of items) {
    const hasPurchaseUom = item.purchaseUom && item.purchaseUom !== '';
    const hasStockUom = item.stockUom && item.stockUom !== '';

    if (hasPurchaseUom || hasStockUom) continue; // At least one is set

    const category = item.category || 'other';
    const defaults = DEFAULT_UOMS[category] || DEFAULT_UOMS['other'];

    logChange(item.id, item.name, 'purchaseUom', item.purchaseUom || null, defaults.purchaseUom);
    logChange(item.id, item.name, 'stockUom', item.stockUom || null, defaults.stockUom);

    if (!DRY_RUN) {
      const ref = db.collection('inventoryItems').doc(item.id);
      await writer.update(ref, {
        purchaseUom: defaults.purchaseUom,
        stockUom: defaults.stockUom,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: 'SCRIPT_FIX_DATA_QUALITY',
      });
    }

    uomsSet++;
  }

  console.log(`\n  Items with UOMs set: ${uomsSet}\n`);

  // ════════════════════════════════════════════════════════════════════════
  // Commit remaining writes
  // ════════════════════════════════════════════════════════════════════════
  if (!DRY_RUN) {
    await writer.commit();
  }

  // ════════════════════════════════════════════════════════════════════════
  // Report
  // ════════════════════════════════════════════════════════════════════════
  console.log('══════════════════════════════════════════════════════');
  console.log('  CHANGE SUMMARY');
  console.log('══════════════════════════════════════════════════════\n');

  console.log(`  1. Missing parents created:       ${parentsCreated}`);
  console.log(`     Timber families skipped:        ${parentsSkippedTimber}`);
  console.log(`  2. Supplier names normalized:      ${suppliersNormalized}`);
  console.log(`  3. Suspect pricing tagged:         ${pricingTagged}`);
  console.log(`  4. Default UOMs set:               ${uomsSet}`);
  console.log(`  Total field-level changes logged:  ${changeLog.length}`);

  if (DRY_RUN) {
    console.log('\n  [DRY RUN] No changes were written. Run with --execute to apply.\n');
  } else {
    console.log(`\n  [DONE] ${writer.totalCommitted} Firestore operations committed successfully.\n`);
  }
}

main().catch((err) => {
  console.error('Fix script failed:', err);
  process.exit(1);
});
