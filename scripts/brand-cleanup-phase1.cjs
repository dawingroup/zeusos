/**
 * Function-First Brand Cleanup — Phase 1: Hardware Families
 *
 * Cleans 43 hardware family parents and their ~121 children:
 *   1. Family parents lose `brand` and `model` from variantAttributeDefinitions.
 *   2. Children get brand+model stripped from name and SKU, a tier code (ECO/STD/PRM)
 *      inserted into the SKU after the family prefix, and matching brand/model entries
 *      removed from variantAttributes and parametricTags.
 *   3. SKU collisions are detected across the full batch BEFORE any write — the script
 *      refuses to commit if any are found.
 *
 * Rules (locked, agreed with Onzimai before writing this):
 *   - Name = functional (no brand, no model). Tier word kept (Economy / Standard / Premium).
 *   - SKU  = <FAMILY>-<TIER>-[<SUFFIX>]. Tier code is ECO / STD / PRM.
 *   - Variant axes lose brand+model. quality_tier defaults to "Standard" when missing.
 *   - Brand info is dropped entirely. Not relocated to supplier or tags.
 *
 * Usage:
 *   node scripts/brand-cleanup-phase1.cjs               # dry-run (default)
 *   node scripts/brand-cleanup-phase1.cjs --commit      # commit after dry-run
 *
 * Targets: scripts/brand_cleanup_targets.json — { families: [{ id, sku, name }, ...] }
 *
 * Collection: `inventoryItems` (per CLAUDE.md). The spec uses "inventory" — that's
 * the spec's generic name; this codebase actually uses `inventoryItems`.
 */

const path = require('path');
const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

const COMMIT = process.argv.includes('--commit');
const COLLECTION = 'inventoryItems';
const BATCH_SIZE = 400;

const TIER_CODE = {
  Economy: 'ECO',
  Standard: 'STD',
  Premium: 'PRM',
};
const TIER_WORDS = ['Economy', 'Standard', 'Premium'];
const TIER_CODES_LIST = ['ECO', 'STD', 'PRM'];
const DROPPED_AXES = new Set(['brand', 'model']);

// ─── helpers ──────────────────────────────────────────────────────────────────

function getAttr(attrs, key) {
  if (!Array.isArray(attrs)) return undefined;
  const hit = attrs.find((a) => a && a.key === key);
  return hit ? hit.value : undefined;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strip a token (brand or model) from a free-text string. Whole-word, case-insensitive,
 * collapses leftover whitespace.
 */
function stripTokenFromText(input, token) {
  if (!token) return input;
  const re = new RegExp(`\\b${escapeRegex(token)}\\b`, 'gi');
  return input.replace(re, '').replace(/\s+/g, ' ').trim();
}

/**
 * Clean a child's name: strip brand, strip model, repair leftover punctuation.
 */
function cleanName(rawName, brand, model) {
  let n = rawName || '';
  n = stripTokenFromText(n, brand);
  n = stripTokenFromText(n, model);
  // Repair the "— BRAND MODEL —" pattern that turns into "— —" / "—  —" after strip.
  n = n.replace(/—\s*—/g, '—');
  // Trim leading or trailing em-dashes left orphaned.
  n = n.replace(/\s*—\s*$/g, '').replace(/^\s*—\s*/g, '');
  n = n.replace(/\s+/g, ' ').trim();
  return n;
}

/**
 * Strip a token from a SKU. SKUs are usually hyphen-separated but the existing
 * data has free spaces and mixed case in many child SKUs (e.g.
 * "HNG-CONC-155-FO-Premium SALICE C2PKAE9-I"). We try both the original token
 * and its hyphen-normalized form so multi-word tokens like "Silentia+ 700 HO"
 * also match the SKU's hyphenated representation.
 */
function stripTokenFromSku(input, token) {
  if (!token) return input;
  const variants = new Set([token, token.replace(/\s+/g, '-')]);
  let out = input;
  for (const v of variants) {
    const re = new RegExp(`(^|-)${escapeRegex(v)}(?=-|$)`, 'gi');
    out = out.replace(re, '$1');
  }
  return out;
}

/**
 * Rebuild a SKU as <FAMILY>-<TIER>[-<SUFFIX>] where <SUFFIX> is whatever functional
 * descriptor remains after stripping brand, model, and a leading tier word/code.
 *
 * The family prefix is preserved verbatim — strips ONLY apply to the suffix portion,
 * which is critical for families like `DRW-BOX-STD` whose own SKU contains a tier-code
 * substring. Tier-code stripping is suffix-leading-only so embedded descriptors like
 * `-std-recess` (a functional name, not a tier leak) are never corrupted.
 */
function cleanSku(rawSku, familySku, brand, model, tier, tierCode) {
  let s = (rawSku || '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  // Split off the suffix, keeping the family prefix verbatim.
  let suffix;
  if (s === familySku) {
    suffix = '';
  } else if (s.startsWith(familySku + '-')) {
    suffix = s.slice(familySku.length + 1);
  } else {
    // Prefix mismatch (rare): treat the whole thing as the suffix and rebuild.
    suffix = s;
  }

  // Strip brand/model/tier-word tokens from the SUFFIX only.
  suffix = stripTokenFromSku(suffix, brand);
  suffix = stripTokenFromSku(suffix, model);
  if (tier) suffix = stripTokenFromSku(suffix, tier);
  for (const w of TIER_WORDS) suffix = stripTokenFromSku(suffix, w);
  suffix = suffix.replace(/-+/g, '-').replace(/^-|-$/g, '');

  // Idempotency: if the suffix's first segment is already a tier code, drop it
  // (we'll re-insert the canonical one). Only the LEADING segment is checked, so
  // embedded descriptors like `23x8mm-std-recess` are preserved.
  const segments = suffix.split('-').filter(Boolean);
  if (segments.length > 0 && TIER_CODES_LIST.includes(segments[0].toUpperCase())) {
    segments.shift();
  }
  suffix = segments.join('-');

  return suffix ? `${familySku}-${tierCode}-${suffix}` : `${familySku}-${tierCode}`;
}

// Deep equality for the small set of structures we compare.
function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ─── child fetch ──────────────────────────────────────────────────────────────

async function fetchChildren(famId, famData) {
  // Prefer a familySkuIds array if it exists; otherwise query by familyId.
  if (Array.isArray(famData.familySkuIds) && famData.familySkuIds.length > 0) {
    const refs = famData.familySkuIds.map((cid) => db.collection(COLLECTION).doc(cid));
    const snaps = await db.getAll(...refs);
    return snaps.filter((s) => s.exists);
  }
  const q = await db.collection(COLLECTION).where('familyId', '==', famId).get();
  return q.docs;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function run() {
  const targetsPath = path.join(__dirname, 'brand_cleanup_targets.json');
  const targets = require(targetsPath);
  const families = (targets && targets.families) || [];
  if (families.length === 0) {
    throw new Error(`brand_cleanup_targets.json has no families`);
  }

  console.log(
    `\n=== Brand cleanup Phase 1 ${COMMIT ? '(COMMIT)' : '(DRY-RUN)'} ===\n` +
      `Targets: ${families.length} family parents in scope.\n` +
      `Collection: ${COLLECTION}\n`
  );

  const pending = []; // { ref, id, kind, before, after, newSku? }
  const collisionMap = new Map(); // newSku → [`${id} (was ${oldSku} / ${oldName})`, ...]
  let missingFamilies = 0;
  let missingChildren = 0;

  for (const fam of families) {
    const famRef = db.collection(COLLECTION).doc(fam.id);
    const famSnap = await famRef.get();
    if (!famSnap.exists) {
      console.warn(`  [family ${fam.sku} / ${fam.id}] NOT FOUND — skipping`);
      missingFamilies++;
      continue;
    }
    const famData = famSnap.data() || {};
    const oldDefs = Array.isArray(famData.variantAttributeDefinitions)
      ? famData.variantAttributeDefinitions
      : [];
    const newDefs = oldDefs.filter((d) => !DROPPED_AXES.has(d));

    // Always queue the family update — even if defs already lack brand/model,
    // it costs nothing and the diff makes that visible.
    if (JSON.stringify(oldDefs) !== JSON.stringify(newDefs)) {
      pending.push({
        ref: famRef,
        id: fam.id,
        kind: 'family',
        before: { sku: fam.sku, variantAttributeDefinitions: oldDefs },
        after: { variantAttributeDefinitions: newDefs },
      });
    }

    const childDocs = await fetchChildren(fam.id, famData);
    if (childDocs.length === 0) {
      console.warn(`  [family ${fam.sku}] no children found`);
      missingChildren++;
    }

    for (const childSnap of childDocs) {
      const c = { id: childSnap.id, ...(childSnap.data() || {}) };
      const brand = getAttr(c.variantAttributes, 'brand') || '';
      const model = getAttr(c.variantAttributes, 'model') || '';
      const tier = getAttr(c.variantAttributes, 'quality_tier') || 'Standard';
      const tierCode = TIER_CODE[tier] || 'STD';

      const oldAttrs = Array.isArray(c.variantAttributes) ? c.variantAttributes : [];
      const newAttrs = oldAttrs.filter((a) => a && !DROPPED_AXES.has(a.key));
      // Guarantee a quality_tier on every child.
      if (!newAttrs.find((a) => a.key === 'quality_tier')) {
        newAttrs.unshift({ key: 'quality_tier', value: 'Standard' });
      }

      const oldTags = c.parametricTags && typeof c.parametricTags === 'object' ? c.parametricTags : {};
      const newTags = { ...oldTags };
      for (const axis of DROPPED_AXES) delete newTags[axis];
      if (!newTags.quality_tier) newTags.quality_tier = 'Standard';

      const newName = cleanName(c.name || '', brand, model);
      const newSku = cleanSku(c.sku || '', fam.sku, brand, model, tier, tierCode);

      // Register for collision check (always — even unchanged children can collide
      // with a sibling that IS being updated to the same SKU).
      const bucket = collisionMap.get(newSku) || [];
      bucket.push(`${c.id} (was ${c.sku || '∅'} / ${c.name || '∅'})`);
      collisionMap.set(newSku, bucket);

      // Idempotency: skip queueing the child if every mutated field is already
      // in the desired state. Otherwise re-running the script after a successful
      // commit would re-stamp updatedAt on every child for no reason.
      const beforeShape = {
        sku: c.sku || '',
        name: c.name || '',
        variantAttributes: oldAttrs,
        parametricTags: oldTags,
      };
      const afterShape = {
        sku: newSku,
        name: newName,
        variantAttributes: newAttrs,
        parametricTags: newTags,
      };
      if (deepEqual(beforeShape, afterShape)) {
        continue;
      }

      pending.push({
        ref: db.collection(COLLECTION).doc(c.id),
        id: c.id,
        kind: 'child',
        before: beforeShape,
        after: afterShape,
        newSku,
      });
    }
  }

  // ── dry-run diff ────────────────────────────────────────────────────────────
  console.log(`\n=== DRY-RUN DIFF (${pending.length} updates) ===\n`);
  for (const p of pending) {
    if (p.kind === 'family') {
      console.log(`FAMILY ${p.before.sku} (${p.id})`);
      console.log(
        `  variantAttributeDefinitions: ${JSON.stringify(p.before.variantAttributeDefinitions)} → ${JSON.stringify(p.after.variantAttributeDefinitions)}`
      );
    } else {
      console.log(`CHILD  ${p.id}`);
      console.log(`  sku:  ${p.before.sku} → ${p.after.sku}`);
      console.log(`  name: ${p.before.name}`);
      console.log(`     →  ${p.after.name}`);
    }
  }

  console.log(
    `\nSummary: ${pending.length} updates queued ` +
      `(missing families: ${missingFamilies}, families with no children: ${missingChildren}).`
  );

  // ── collision check ────────────────────────────────────────────────────────
  const collisions = [...collisionMap.entries()].filter(([, ids]) => ids.length > 1);
  if (collisions.length > 0) {
    console.error(`\n=== SKU COLLISIONS (${collisions.length}) ===`);
    for (const [sku, ids] of collisions) {
      console.error(`  ${sku}`);
      for (const i of ids) console.error(`    - ${i}`);
    }
    console.error(
      `\nRefusing to commit. Resolve manually (archive one side, or add a disambiguating ` +
        `functional axis like a SLIM/WIDE descriptor), then re-run.`
    );
    process.exit(2);
  }
  console.log(`\n✓ No SKU collisions detected.`);

  if (!COMMIT) {
    console.log(
      `\nDry-run complete. Re-run with --commit to write these ${pending.length} updates.`
    );
    return;
  }

  // ── commit ─────────────────────────────────────────────────────────────────
  console.log(`\n=== COMMITTING ${pending.length} updates ===`);
  let committed = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const slice = pending.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const p of slice) {
      batch.update(p.ref, {
        ...p.after,
        updatedAt: new Date().toISOString(),
        updatedBy: 'brand-cleanup-phase1',
      });
    }
    try {
      await batch.commit();
      committed += slice.length;
      console.log(`  Committed ${committed}/${pending.length}`);
    } catch (err) {
      console.error(`  Batch ${i}-${i + slice.length} FAILED: ${err.message}`);
      // Per-item fallback so one bad doc doesn't sink the whole batch.
      for (const p of slice) {
        try {
          await p.ref.update({
            ...p.after,
            updatedAt: new Date().toISOString(),
            updatedBy: 'brand-cleanup-phase1',
          });
          committed++;
        } catch (e) {
          failed++;
          console.warn(`    [${p.id}] skipped: ${e.message}`);
        }
      }
    }
  }

  console.log(`\nDone. Committed: ${committed}. Failed: ${failed}.`);
}

run().catch((err) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
