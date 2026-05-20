/**
 * Audit Inventory Data Quality
 *
 * READ-ONLY script that produces a structured report of data quality issues
 * in the inventoryItems collection. No writes to Firestore.
 *
 * Checks:
 *   1. Orphaned families — items whose familyId points to a non-existent document
 *   2. Duplicate suppliers — near-duplicate preferredSupplierName values
 *   3. Suspect pricing — costPerUnit < 100 UGX (likely foreign currency)
 *   4. Missing UOMs — items missing both purchaseUom and stockUom
 *   5. "Other" category items — items with category === 'other'
 *   6. Missing descriptions — items with empty/null/undefined description
 *
 * Run: NODE_PATH=functions/node_modules node scripts/audit-inventory-data-quality.cjs
 */

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshtein(a, b) {
  const matrix = [];
  const aLen = a.length;
  const bLen = b.length;

  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  for (let i = 0; i <= bLen; i++) matrix[i] = [i];
  for (let j = 0; j <= aLen; j++) matrix[0][j] = j;

  for (let i = 1; i <= bLen; i++) {
    for (let j = 1; j <= aLen; j++) {
      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[bLen][aLen];
}

/**
 * Normalize a supplier name for comparison: lowercase, trim, collapse whitespace.
 */
function normalize(name) {
  return (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if two supplier names are near-duplicates.
 * Uses: one contains the other, or Levenshtein distance is small relative to length.
 */
function areNearDuplicates(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return false; // exact match, not a "near" duplicate

  // One contains the other
  if (na.includes(nb) || nb.includes(na)) return true;

  // Levenshtein distance relative to the longer string
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return false;
  const dist = levenshtein(na, nb);
  const similarity = 1 - dist / maxLen;
  return similarity >= 0.8;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  INVENTORY DATA QUALITY AUDIT');
  console.log('══════════════════════════════════════════════════════\n');

  const snapshot = await db.collection('inventoryItems').get();
  const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const itemIds = new Set(items.map((i) => i.id));

  console.log(`Total inventory items: ${items.length}\n`);

  // ════════════════════════════════════════════════════════════════════════
  // 1. Orphaned families
  // ════════════════════════════════════════════════════════════════════════
  console.log('──────────────────────────────────────────────────────');
  console.log('  1. ORPHANED FAMILIES');
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

  const orphanFamilyIds = Object.keys(orphansByFamily);
  if (orphanFamilyIds.length === 0) {
    console.log('  No orphaned families found. [OK]\n');
  } else {
    console.log(`  Found ${orphanFamilyIds.length} missing parent(s) with orphaned children:\n`);
    let totalOrphans = 0;
    for (const familyId of orphanFamilyIds) {
      const children = orphansByFamily[familyId];
      totalOrphans += children.length;
      const categories = [...new Set(children.map((c) => c.category || 'undefined'))];
      console.log(`  familyId: ${familyId}  (${children.length} children, categories: ${categories.join(', ')})`);
      children.slice(0, 5).forEach((c) => {
        console.log(`    - ${c.name} [${c.id}]`);
      });
      if (children.length > 5) {
        console.log(`    ... and ${children.length - 5} more`);
      }
    }
    console.log(`\n  Total orphaned items: ${totalOrphans}\n`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // 2. Duplicate suppliers
  // ════════════════════════════════════════════════════════════════════════
  console.log('──────────────────────────────────────────────────────');
  console.log('  2. DUPLICATE SUPPLIER NAMES');
  console.log('──────────────────────────────────────────────────────\n');

  const supplierNames = [
    ...new Set(
      items
        .map((i) => i.preferredSupplierName)
        .filter((n) => n && typeof n === 'string' && n.trim().length > 0),
    ),
  ];

  console.log(`  Unique supplier names: ${supplierNames.length}\n`);

  const duplicatePairs = [];
  for (let i = 0; i < supplierNames.length; i++) {
    for (let j = i + 1; j < supplierNames.length; j++) {
      if (areNearDuplicates(supplierNames[i], supplierNames[j])) {
        const countA = items.filter((it) => it.preferredSupplierName === supplierNames[i]).length;
        const countB = items.filter((it) => it.preferredSupplierName === supplierNames[j]).length;
        duplicatePairs.push({
          a: supplierNames[i],
          b: supplierNames[j],
          countA,
          countB,
        });
      }
    }
  }

  if (duplicatePairs.length === 0) {
    console.log('  No near-duplicate supplier names found. [OK]\n');
  } else {
    console.log(`  Found ${duplicatePairs.length} near-duplicate pair(s):\n`);
    for (const pair of duplicatePairs) {
      console.log(`    "${pair.a}" (${pair.countA} items)  <-->  "${pair.b}" (${pair.countB} items)`);
    }
    console.log();
  }

  // ════════════════════════════════════════════════════════════════════════
  // 3. Suspect pricing
  // ════════════════════════════════════════════════════════════════════════
  console.log('──────────────────────────────────────────────────────');
  console.log('  3. SUSPECT PRICING (costPerUnit < 100 UGX)');
  console.log('──────────────────────────────────────────────────────\n');

  const suspectPricing = items.filter((i) => {
    const cost = i.pricing?.costPerUnit;
    return typeof cost === 'number' && cost > 0 && cost < 100;
  });

  if (suspectPricing.length === 0) {
    console.log('  No suspect pricing found. [OK]\n');
  } else {
    console.log(`  Found ${suspectPricing.length} item(s) with costPerUnit < 100:\n`);
    console.log('  ID                                     | Name                                     | Cost     | Currency');
    console.log('  ' + '-'.repeat(100));
    for (const item of suspectPricing) {
      const id = item.id.padEnd(40);
      const name = (item.name || '(no name)').substring(0, 40).padEnd(40);
      const cost = String(item.pricing?.costPerUnit ?? '').padEnd(8);
      const currency = item.pricing?.currency || 'not set';
      console.log(`  ${id} | ${name} | ${cost} | ${currency}`);
    }
    console.log();
  }

  // ════════════════════════════════════════════════════════════════════════
  // 4. Missing UOMs
  // ════════════════════════════════════════════════════════════════════════
  console.log('──────────────────────────────────────────────────────');
  console.log('  4. MISSING UOMs (both purchaseUom AND stockUom)');
  console.log('──────────────────────────────────────────────────────\n');

  const missingUom = items.filter(
    (i) =>
      (!i.purchaseUom || i.purchaseUom === '') &&
      (!i.stockUom || i.stockUom === ''),
  );

  if (missingUom.length === 0) {
    console.log('  No items missing both UOMs. [OK]\n');
  } else {
    const byCategory = {};
    for (const item of missingUom) {
      const cat = item.category || 'undefined';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    console.log(`  Total items missing both UOMs: ${missingUom.length}\n`);
    console.log('  Count by category:');
    const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    for (const [cat, count] of sorted) {
      console.log(`    ${cat}: ${count}`);
    }
    console.log();
  }

  // ════════════════════════════════════════════════════════════════════════
  // 5. "Other" category items
  // ════════════════════════════════════════════════════════════════════════
  console.log('──────────────────────────────────────────────────────');
  console.log('  5. "OTHER" CATEGORY ITEMS');
  console.log('──────────────────────────────────────────────────────\n');

  const otherCategory = items.filter((i) => i.category === 'other');

  if (otherCategory.length === 0) {
    console.log('  No items with category "other". [OK]\n');
  } else {
    console.log(`  Total items with category "other": ${otherCategory.length}\n`);
    console.log('  First 20 for manual review:');
    otherCategory.slice(0, 20).forEach((item, idx) => {
      console.log(`    ${idx + 1}. ${item.name || '(no name)'} [${item.id}]`);
    });
    if (otherCategory.length > 20) {
      console.log(`    ... and ${otherCategory.length - 20} more`);
    }
    console.log();
  }

  // ════════════════════════════════════════════════════════════════════════
  // 6. Missing descriptions
  // ════════════════════════════════════════════════════════════════════════
  console.log('──────────────────────────────────────────────────────');
  console.log('  6. MISSING DESCRIPTIONS');
  console.log('──────────────────────────────────────────────────────\n');

  const missingDesc = items.filter(
    (i) => !i.description || (typeof i.description === 'string' && i.description.trim() === ''),
  );

  console.log(`  Items with missing/empty description: ${missingDesc.length} of ${items.length} (${((missingDesc.length / items.length) * 100).toFixed(1)}%)\n`);

  // ════════════════════════════════════════════════════════════════════════
  // Summary
  // ════════════════════════════════════════════════════════════════════════
  console.log('══════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('══════════════════════════════════════════════════════\n');

  const totalOrphans = Object.values(orphansByFamily).reduce((s, arr) => s + arr.length, 0);

  console.log(`  1. Orphaned families:       ${orphanFamilyIds.length} missing parents, ${totalOrphans} orphaned items`);
  console.log(`  2. Duplicate suppliers:     ${duplicatePairs.length} near-duplicate pairs`);
  console.log(`  3. Suspect pricing:         ${suspectPricing.length} items`);
  console.log(`  4. Missing UOMs:            ${missingUom.length} items`);
  console.log(`  5. "Other" category:        ${otherCategory.length} items`);
  console.log(`  6. Missing descriptions:    ${missingDesc.length} items`);
  console.log('\n  This is a read-only audit. No changes were made.\n');
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
