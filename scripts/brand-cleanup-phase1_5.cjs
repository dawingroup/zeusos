/**
 * Brand cleanup Phase 1.5 — targeted residuals.
 *
 * Phase 1 cleared 43 hardware families and ~121 children but missed 30 children
 * because of edge cases the main algorithm couldn't handle:
 *   1. Non-word characters in brand tokens (e.g. `Silentia+`).
 *   2. Token/suffix format mismatch (`STAR` vs `STAR-`).
 *   3. Brand never written to variantAttributes — only baked into the SKU suffix.
 *
 * Rather than complicate the main algorithm, this script operates on an explicit
 * 30-row map. Each row has a hand-curated newSku and a hand-curated list of
 * tokens to remove from `name`. Nothing else in the catalog can be touched.
 *
 * Mirrors brand-cleanup-phase1.cjs:
 *   - Uses `inventoryItems` (NOT the spec's generic `inventory`).
 *   - CommonJS + firebase-admin (matches the runner that ADC is set up for).
 *   - Pre-commit collision check across the whole batch + entire collection.
 *
 * Usage:
 *   node scripts/brand-cleanup-phase1_5.cjs               # dry-run
 *   node scripts/brand-cleanup-phase1_5.cjs --commit      # write
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

const COMMIT = process.argv.includes('--commit');
const COLLECTION = 'inventoryItems';

// ─── targets ──────────────────────────────────────────────────────────────────
//
// 30 children. newSku is the destination; stripFromName is the list of tokens to
// remove from the display name (case-insensitive). Order in the array matters
// only for very rare cases where one token is a prefix of another.

const TARGETS = [
  // Silentia+ concealed hinges → tier-only (family prefix already encodes orientation)
  { id: '3T2ppXftwRSBNxEHUkii', newSku: 'HNG-CONC-110-HO-PRM', stripFromName: ['Silentia+', '700 HO'] },
  { id: 'aXL1PcYlHH86iQO6ThPP', newSku: 'HNG-CONC-PTO-PRM',    stripFromName: ['Silentia+', '700 PTO'] },
  { id: 'o8gcBjiWj54JOmmiOquq', newSku: 'HNG-CONC-45-FO-PRM',  stripFromName: ['Silentia+', '700 45°', '700 45'] },
  { id: 'tr4CyN8ObpWiOONezvla', newSku: 'HNG-CONC-110-IN-PRM', stripFromName: ['Silentia+', '700 IN'] },

  // Air-Series mini hinge
  { id: 'FDTlxpnMPoFaaKrHU73M', newSku: 'HNG-CONC-MINI-PRM', stripFromName: ['Air Series', 'Air-Series'] },

  // Conecta hidden hinges
  { id: 'AfT1V1I7CWlDVJkasamf', newSku: 'HNG-CONC-HIDDEN-PRM-titanium', stripFromName: ['Conecta'] },
  { id: 'YZMUrkGESq0AQrojhXtp', newSku: 'HNG-CONC-HIDDEN-PRM-nickel',   stripFromName: ['Conecta'] },

  // Pivot hinge (SH-H code, keep "black" as a color)
  { id: '4abxJkuRr4rt2Vp8YTWa', newSku: 'HNG-PIVOT-STD-black', stripFromName: ['SH-H8110001', 'SH H8110001'] },

  // Aluminium frame — two variants by overlay configuration (FO vs IN)
  { id: 'toWoZqB1a1ceFQ1YTBOU', newSku: 'HNG-ALUM-FRAME-PRM-FO', stripFromName: ['SH-H8022501'] },
  { id: 'Us8VJHsqA8kW3vrS0tF6', newSku: 'HNG-ALUM-FRAME-PRM-IN', stripFromName: ['SH-H8022503'] },

  // Hinge plates — height-adjustable vs inline
  { id: 'ccntFWl4MMGBLc4GkpXZ', newSku: 'HNG-PLATE-PRM-height-adj', stripFromName: ['B2V3H39-I', 'B2V3H39'] },
  { id: 'ptZTo1yLxZD9ppTrrNQW', newSku: 'HNG-PLATE-PRM-inline',     stripFromName: ['B2V3H29-I', 'B2V3H29'] },

  // LED profile surface (STAR brand)
  { id: '91dcI1tf3upuV9FrQH6V', newSku: 'LED-PROF-SURFACE-ECO-30x10mm-extra-wide', stripFromName: ['STAR'] },
  { id: '94pEuhYO2B46QCOUqCg0', newSku: 'LED-PROF-SURFACE-ECO-23x10mm-wide',       stripFromName: ['STAR'] },
  { id: 'clWi1EyZpGduFa9nq6vE', newSku: 'LED-PROF-SURFACE-ECO-17x8mm',              stripFromName: ['STAR'] },
  { id: 'mUDuIS8tLN30k2ImAPXi', newSku: 'LED-PROF-SURFACE-ECO-15x6mm-slim',         stripFromName: ['STAR'] },

  // LED profile pendant
  { id: 'CRKaB1XJJbNQnXtv0CZb', newSku: 'LED-PROF-PENDANT-STD-35mm-round',   stripFromName: ['STAR'] },
  { id: 'Dh0Hqr8OmWTW8J4AGH6U', newSku: 'LED-PROF-PENDANT-STD-60mm-round',   stripFromName: ['STAR'] },
  { id: 'VxMxCfZrOmxvwv4EPOKP', newSku: 'LED-PROF-PENDANT-STD-50x75mm-rect', stripFromName: ['STAR'] },

  // LED profile flex
  { id: 'DOY75iz7OzV6gy3pdSM4', newSku: 'LED-PROF-FLEX-STD-18mm-silicone', stripFromName: ['STAR'] },
  { id: 'W2SCaDmzJgXt9oP1DS2Y', newSku: 'LED-PROF-FLEX-STD-12mm-neon',     stripFromName: ['STAR'] },

  // LED profile recess
  { id: 'N8pFrwKJbu855sHB50SO', newSku: 'LED-PROF-RECESS-ECO-23x8mm-std',          stripFromName: ['STAR'] },
  { id: 'YYxIWb1wgbute9Gw9J5l', newSku: 'LED-PROF-RECESS-STD-trimless-plaster-in', stripFromName: ['STAR'] },
  { id: 'n9RgZPjyN2aCPiAg9M0A', newSku: 'LED-PROF-RECESS-ECO-12x8mm-narrow-deep',  stripFromName: ['STAR'] },
  { id: 'qFJ0WbMiakkrDuxWe39w', newSku: 'LED-PROF-RECESS-ECO-30x10mm-wide',        stripFromName: ['STAR'] },
  { id: 'uxLVmhHiKRYjHAnkcgzw', newSku: 'LED-PROF-RECESS-ECO-55x9mm-ultra-wide',   stripFromName: ['STAR'] },

  // LED profile corner
  { id: 'a3QaZNSR8HDtYp70DXMV', newSku: 'LED-PROF-CORNER-ECO-16x16mm-V',       stripFromName: ['STAR'] },
  { id: 'usnrtr2YIjBqeXfXbsB1', newSku: 'LED-PROF-CORNER-ECO-18x18mm-large-V', stripFromName: ['STAR'] },

  // LED profile cabinet
  { id: 'TUIfZBod2SswFtmDJXPd', newSku: 'LED-PROF-CABINET-STD-shelf-edge-clip-on',  stripFromName: ['STAR'] },
  { id: 'r970KHffqgQGxdQ8pBZw', newSku: 'LED-PROF-CABINET-STD-wardrobe-rail-combo', stripFromName: ['STAR'] },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanName(raw, tokens) {
  let n = raw || '';
  for (const t of tokens) {
    if (!t) continue;
    // Substring strip (case-insensitive). Word boundaries can't be used because
    // some tokens contain non-word chars (Silentia+, 700 45°). The targets are
    // hand-picked to be unambiguous in their respective names.
    n = n.replace(new RegExp(escapeRegex(t), 'gi'), '');
  }
  // Repair leftover punctuation/whitespace.
  n = n.replace(/—\s*—/g, '—')
       .replace(/\s{2,}/g, ' ')
       .replace(/\s*—\s*$/g, '')
       .replace(/^\s*—\s*/g, '')
       .replace(/-{2,}/g, '-')
       .replace(/^-|-$/g, '')
       .trim();
  return n;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(
    `\n=== Brand cleanup Phase 1.5 ${COMMIT ? '(COMMIT)' : '(DRY-RUN)'} ===\n` +
      `Targets: ${TARGETS.length} explicit children.\n` +
      `Collection: ${COLLECTION}\n`
  );

  // Pre-flight: every target ID must exist.
  const records = [];
  for (const t of TARGETS) {
    const ref = db.collection(COLLECTION).doc(t.id);
    const snap = await ref.get();
    if (!snap.exists) {
      console.error(`  [${t.id}] NOT FOUND — aborting`);
      process.exit(1);
    }
    const data = snap.data() || {};
    records.push({
      target: t,
      ref,
      before: { sku: data.sku || '', name: data.name || '' },
      after:  { sku: t.newSku, name: cleanName(data.name || '', t.stripFromName) },
    });
  }

  // Collision check across the entire collection.
  const allExisting = await db.collection(COLLECTION).get();
  const existingSkus = new Map();
  for (const d of allExisting.docs) {
    const sku = d.data().sku;
    if (sku) existingSkus.set(sku, d.id);
  }

  const collisions = [];
  const newSkuSet = new Set();
  for (const r of records) {
    if (newSkuSet.has(r.after.sku)) {
      collisions.push(`Duplicate new SKU within batch: ${r.after.sku} (${r.target.id})`);
    }
    newSkuSet.add(r.after.sku);

    const owner = existingSkus.get(r.after.sku);
    if (owner && owner !== r.target.id) {
      collisions.push(
        `New SKU ${r.after.sku} (${r.target.id}) already owned by ${owner}`
      );
    }
  }

  // Diff.
  console.log(`=== DRY-RUN DIFF (${records.length}) ===`);
  for (const r of records) {
    console.log(`\n${r.target.id}`);
    console.log(`  sku:  ${r.before.sku}`);
    console.log(`     →  ${r.after.sku}`);
    console.log(`  name: ${r.before.name}`);
    console.log(`     →  ${r.after.name}`);
  }

  if (collisions.length > 0) {
    console.error(`\n=== COLLISIONS (${collisions.length}) ===`);
    for (const c of collisions) console.error(`  ${c}`);
    console.error(`\nRefusing to commit.`);
    process.exit(2);
  }
  console.log(`\n✓ No SKU collisions detected.`);

  if (!COMMIT) {
    console.log(`\nDry-run complete. Re-run with --commit to apply.`);
    return;
  }

  // Commit.
  console.log(`\n=== COMMITTING ${records.length} updates ===`);
  const batch = db.batch();
  for (const r of records) {
    batch.update(r.ref, {
      sku: r.after.sku,
      name: r.after.name,
      updatedAt: new Date().toISOString(),
      updatedBy: 'brand-cleanup-phase1_5',
    });
  }

  try {
    await batch.commit();
    console.log(`Done. Committed ${records.length} updates.`);
  } catch (err) {
    console.error(`Batch commit FAILED:`, err.message);
    console.log(`Falling back to per-item updates...`);
    let ok = 0, fail = 0;
    for (const r of records) {
      try {
        await r.ref.update({
          sku: r.after.sku,
          name: r.after.name,
          updatedAt: new Date().toISOString(),
          updatedBy: 'brand-cleanup-phase1_5',
        });
        ok++;
      } catch (e) {
        fail++;
        console.warn(`  [${r.target.id}] skipped: ${e.message}`);
      }
    }
    console.log(`Per-item fallback: ${ok} ok, ${fail} failed.`);
  }
}

run().catch((err) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
