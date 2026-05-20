/**
 * Refresh Palette Stock-Sheet Dimensions From Inventory
 *
 * Historically, the mapping UI created default stockSheets entries with
 * DEFAULT_SHEET_DIMENSIONS (2440×1220) regardless of what the mapped
 * inventory SKU actually measured. A SKU like "3mm Plain MDF Sheet
 * 2730x1830" would end up stored as if it were 2440×1220, which inflates
 * cost-per-m² by the ratio of the two sheet areas:
 *     (2730*1830) / (2440*1220) ≈ 1.68×
 *
 * The mapping service has since been fixed to refresh dimensions from
 * `inventoryItems/{id}.dimensions` at mapping time. This script repairs
 * existing palette entries written before the fix.
 *
 * Rules:
 *   - Only palette entries with `inventoryId` set (mapped).
 *   - Only when the inventory doc has a structured `dimensions.length/width`.
 *   - Only when stockSheets[0].length/width differ by > 1mm from inventory.
 *   - Never touches timber/linear/glass/fabric stock (different schemas).
 *   - Never touches offcut-sourced rows (`inventoryId` starts with "offcut:").
 *   - Sanity guard: skip when the new/old area ratio is outside [0.5, 2.0].
 *     A >2× jump almost always means the palette entry was mis-mapped to a
 *     non-sheet SKU (e.g. a timber plank's 2600×300 cross-section), and
 *     blindly refreshing would inflate costs further. Flag these for manual
 *     review rather than silently "fixing" them.
 *
 * Run:
 *   gcloud auth application-default login
 *   # Dry run — always safe
 *   node scripts/refresh-palette-stock-dimensions.cjs
 *   # Scope to one project
 *   node scripts/refresh-palette-stock-dimensions.cjs --project=DF-2026-694
 *   # Commit
 *   node scripts/refresh-palette-stock-dimensions.cjs --project=DF-2026-694 --apply
 *   node scripts/refresh-palette-stock-dimensions.cjs --apply  # all projects
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const args = process.argv.slice(2);
function arg(name, def) {
  const m = args.find((a) => a.startsWith(`--${name}=`));
  return m ? m.split('=')[1] : def;
}
const PROJECT_CODE = arg('project');
const APPLY = args.includes('--apply');

async function main() {
  console.log('============================================================');
  console.log('  Refresh Palette Stock-Sheet Dimensions From Inventory');
  console.log(`  Scope:  ${PROJECT_CODE || 'ALL designProjects'}`);
  console.log(`  Mode:   ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  console.log('============================================================\n');

  let query = db.collection('designProjects');
  if (PROJECT_CODE) query = query.where('code', '==', PROJECT_CODE);

  const snap = await query.get();
  if (snap.empty) {
    console.log('  (No matching projects.)');
    return;
  }

  // Cache inventory lookups across projects to avoid re-reads.
  const inventoryCache = new Map();
  async function getInventory(id) {
    if (inventoryCache.has(id)) return inventoryCache.get(id);
    const ref = db.collection('inventoryItems').doc(id);
    const snap = await ref.get();
    const data = snap.exists ? snap.data() : null;
    inventoryCache.set(id, data);
    return data;
  }

  // Area-ratio sanity window. Refreshes outside [MIN_RATIO, MAX_RATIO] are
  // almost always a mismapping (e.g. a PANEL entry pointing at a timber
  // plank's 2600×300 cross-section). We flag those instead of applying.
  const MIN_RATIO = 0.5;
  const MAX_RATIO = 2.0;

  let totalProjectsTouched = 0;
  let totalEntriesUpdated = 0;
  const flagged = []; // {projectCode, designName, inventoryName, from, to, ratio}

  for (const projDoc of snap.docs) {
    const data = projDoc.data();
    const palette = data.materialPalette;
    if (!palette?.entries?.length) continue;

    const updates = []; // entry index + new stockSheet + reason
    for (let i = 0; i < palette.entries.length; i++) {
      const e = palette.entries[i];
      if (!e.inventoryId) continue;
      if (e.inventoryId.startsWith('offcut:')) continue;
      if (!Array.isArray(e.stockSheets) || e.stockSheets.length === 0) continue;

      const inv = await getInventory(e.inventoryId);
      if (!inv) continue;
      const dims = inv.dimensions;
      if (
        !dims ||
        typeof dims.length !== 'number' ||
        typeof dims.width !== 'number' ||
        dims.length <= 0 ||
        dims.width <= 0
      ) {
        continue;
      }

      const current = e.stockSheets[0];
      const dLen = dims.length - (current.length || 0);
      const dWid = dims.width - (current.width || 0);
      if (Math.abs(dLen) <= 1 && Math.abs(dWid) <= 1) continue;

      // Sanity: flag and skip clearly-unsafe ratio jumps.
      const fromA = ((current.length || 0) * (current.width || 0)) / 1_000_000;
      const toA = (dims.length * dims.width) / 1_000_000;
      const ratio = fromA > 0 ? toA / fromA : Infinity;
      if (ratio < MIN_RATIO || ratio > MAX_RATIO) {
        flagged.push({
          projectCode: data.code || projDoc.id,
          projectName: data.name || '—',
          designName: e.designName,
          inventoryName: e.inventoryName || inv.name,
          from: { length: current.length, width: current.width },
          to: { length: dims.length, width: dims.width },
          ratio,
        });
        continue;
      }

      updates.push({
        index: i,
        designName: e.designName,
        inventoryName: e.inventoryName || inv.name,
        from: { length: current.length, width: current.width },
        to: { length: dims.length, width: dims.width },
      });
    }

    if (updates.length === 0) continue;

    totalProjectsTouched++;
    totalEntriesUpdated += updates.length;
    console.log(`Project ${data.code || projDoc.id}  (${data.name || '—'})`);
    for (const u of updates) {
      const fromA = ((u.from.length || 0) * (u.from.width || 0)) / 1_000_000;
      const toA = (u.to.length * u.to.width) / 1_000_000;
      const ratio = fromA > 0 ? (toA / fromA).toFixed(2) : '—';
      console.log(
        `  ✎ ${u.designName} → ${u.inventoryName}`,
      );
      console.log(
        `      ${u.from.length}×${u.from.width} (${fromA.toFixed(3)}m²)  →  ${u.to.length}×${u.to.width} (${toA.toFixed(3)}m²)   [area ratio ${ratio}×]`,
      );
    }

    if (APPLY) {
      const timestamp = admin.firestore.Timestamp.now();
      const newEntries = palette.entries.map((e, i) => {
        const u = updates.find((x) => x.index === i);
        if (!u) return e;
        const [first, ...rest] = e.stockSheets;
        return {
          ...e,
          stockSheets: [
            { ...first, length: u.to.length, width: u.to.width },
            ...rest,
          ],
          updatedAt: timestamp,
        };
      });

      await db.collection('designProjects').doc(projDoc.id).update({
        'materialPalette.entries': newEntries,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: 'SYSTEM_STOCK_DIM_REFRESH',
        // Invalidate cached estimation — sheetArea changed so costs change.
        'optimizationState.estimation.invalidatedAt': timestamp,
        'optimizationState.estimation.invalidationReasons': [
          `Stock-sheet dimensions refreshed from inventory for ${updates.length} entries`,
        ],
      });
    }

    console.log('');
  }

  if (flagged.length > 0) {
    console.log('── ⚠  Flagged for manual review (area ratio outside [0.5, 2.0]) ──\n');
    for (const f of flagged) {
      const fromA = ((f.from.length || 0) * (f.from.width || 0)) / 1_000_000;
      const toA = (f.to.length * f.to.width) / 1_000_000;
      console.log(`  ${f.projectCode} — ${f.designName} → ${f.inventoryName}`);
      console.log(
        `    ${f.from.length}×${f.from.width} (${fromA.toFixed(3)}m²)  →  ${f.to.length}×${f.to.width} (${toA.toFixed(3)}m²)   [ratio ${f.ratio.toFixed(2)}× — likely mismapping]`,
      );
    }
    console.log('');
  }

  console.log('============================================================');
  if (totalEntriesUpdated === 0) {
    console.log('  No stale dimensions found — palettes already match inventory.');
  } else {
    console.log(
      `  ${APPLY ? '✅ Updated' : 'Would update'} ${totalEntriesUpdated} entries across ${totalProjectsTouched} project(s).`,
    );
  }
  if (flagged.length > 0) {
    console.log(`  ⚠  ${flagged.length} entries flagged — review palette→inventory mapping manually.`);
  }
  if (!APPLY && totalEntriesUpdated > 0) {
    console.log('  DRY RUN — rerun with --apply to commit.');
  }
  console.log('============================================================\n');
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
