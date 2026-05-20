/**
 * Brand cleanup Phase 1.6 — description sweep.
 *
 * Phase 1 / 1.5 cleaned sku, name, variantAttributes, parametricTags, and
 * variantAttributeDefinitions. Verification confirmed all are clean. But the
 * `description` field was never touched, and the seed importer wrote a
 * template-leak shape into most child descriptions:
 *
 *   "<clean name> <BRAND> <MODEL>. Specifications: quality tier: <tier>,
 *    brand: <BRAND>, model: <MODEL>."
 *
 * Detection rule: a description is a target iff it contains the literal
 * substring `". Specifications: quality tier:"`. That marker only appears in
 * the template — rich/custom prose doesn't use it.
 *
 * Rewrite: `description = "${currentCleanName}."` — period suffix only added
 * if the name doesn't already end with sentence punctuation.
 *
 * Mirrors brand-cleanup-phase1.cjs / 1_5.cjs:
 *   - Uses `inventoryItems` (NOT the spec's generic `inventory`).
 *   - CommonJS + firebase-admin (matches the runner that ADC is set up for).
 *   - Same family traversal (familySkuIds → fallback to where('familyId', '==')).
 *
 * Usage:
 *   node scripts/brand-cleanup-phase1_6.cjs               # dry-run
 *   node scripts/brand-cleanup-phase1_6.cjs --commit      # write
 */

const path = require('path');
const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

const COMMIT = process.argv.includes('--commit');
const COLLECTION = 'inventoryItems';
const BATCH_SIZE = 400;
const MARKER = '. Specifications: quality tier:';
const WRITER_ID = 'brand-cleanup-phase1_6';

// ─── helpers ──────────────────────────────────────────────────────────────────

function isTemplateLeak(desc) {
  return typeof desc === 'string' && desc.includes(MARKER);
}

function rewriteDescription(currentName) {
  const trimmed = (currentName || '').trim();
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

async function fetchChildren(parentId) {
  const parentSnap = await db.collection(COLLECTION).doc(parentId).get();
  if (!parentSnap.exists) {
    console.warn(`  ⚠  parent ${parentId} not found`);
    return [];
  }
  const parent = parentSnap.data() || {};
  const childIds = Array.isArray(parent.familySkuIds) ? parent.familySkuIds : [];
  if (childIds.length > 0) {
    const refs = childIds.map((cid) => db.collection(COLLECTION).doc(cid));
    const snaps = await db.getAll(...refs);
    return snaps.filter((s) => s.exists);
  }
  const fallback = await db.collection(COLLECTION).where('familyId', '==', parentId).get();
  return fallback.docs;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function run() {
  const targetsPath = path.join(__dirname, 'brand_cleanup_targets.json');
  const targets = require(targetsPath);
  const families = (targets && targets.families) || [];
  if (families.length === 0) throw new Error('brand_cleanup_targets.json has no families');

  console.log(
    `\n▶ Phase 1.6 description sweep — ${families.length} family parents, mode=${
      COMMIT ? 'COMMIT' : 'DRY-RUN'
    }\n` + `Collection: ${COLLECTION}\n`
  );

  const diffs = []; // { id, sku, before, after }
  const skipped = { empty: 0, rich: 0, noop: 0 };

  for (const fam of families) {
    const children = await fetchChildren(fam.id);
    if (children.length === 0) {
      console.log(`  ∙ ${fam.sku.padEnd(22)} — no children`);
      continue;
    }

    let touched = 0;
    for (const child of children) {
      const data = child.data() || {};
      const sku = data.sku || '(no sku)';
      const desc = data.description;

      if (!isTemplateLeak(desc)) {
        if (!desc) skipped.empty++;
        else skipped.rich++;
        continue;
      }

      const currentName = data.name || data.displayName || '';
      const after = rewriteDescription(currentName);

      if (after === desc) {
        skipped.noop++;
        continue;
      }

      diffs.push({ id: child.id, sku, before: desc, after });
      touched++;
    }

    console.log(`  ∙ ${fam.sku.padEnd(22)} — ${children.length} children, ${touched} target(s)`);
  }

  // Plan summary.
  console.log(`\n━━━ Plan ━━━`);
  console.log(`  • ${diffs.length} description(s) to rewrite`);
  console.log(
    `  • ${skipped.empty + skipped.rich + skipped.noop} skipped (` +
      `${skipped.empty} empty, ${skipped.rich} rich/custom, ${skipped.noop} no-op)`
  );

  if (diffs.length === 0) {
    console.log(`\n✓ Nothing to do — every description is already clean.\n`);
    return;
  }

  console.log(`\n━━━ Sample diffs (first 5) ━━━`);
  for (const d of diffs.slice(0, 5)) {
    console.log(`\n  ${d.sku}  (${d.id})`);
    console.log(`    before: ${d.before}`);
    console.log(`    after : ${d.after}`);
  }

  if (!COMMIT) {
    console.log(`\n[DRY-RUN] No writes. Re-run with --commit to apply.\n`);
    return;
  }

  // Commit in batches.
  console.log(`\n━━━ Committing ${diffs.length} updates ━━━`);
  const now = new Date().toISOString();
  let committed = 0;
  let failed = 0;

  for (let i = 0; i < diffs.length; i += BATCH_SIZE) {
    const slice = diffs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const d of slice) {
      batch.update(db.collection(COLLECTION).doc(d.id), {
        description: d.after,
        updatedAt: now,
        updatedBy: WRITER_ID,
      });
    }
    try {
      await batch.commit();
      committed += slice.length;
      console.log(`  ✓ batch ${Math.floor(i / BATCH_SIZE) + 1}: ${slice.length} doc(s) (${committed}/${diffs.length})`);
    } catch (err) {
      console.error(`  Batch ${i}-${i + slice.length} FAILED: ${err.message}`);
      // Per-item fallback.
      for (const d of slice) {
        try {
          await db.collection(COLLECTION).doc(d.id).update({
            description: d.after,
            updatedAt: now,
            updatedBy: WRITER_ID,
          });
          committed++;
        } catch (e) {
          failed++;
          console.warn(`    [${d.id}] skipped: ${e.message}`);
        }
      }
    }
  }

  console.log(`\n✓ Done. Committed: ${committed}. Failed: ${failed}.\n`);
}

run().catch((err) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
