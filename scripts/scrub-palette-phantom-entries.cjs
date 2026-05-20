/**
 * Scrub Phantom Material-Palette Entries
 *
 * The material harvester (src/modules/design-manager/services/materialHarvester.ts)
 * indiscriminately creates a palette entry for every unique `part.materialName`
 * across a project's design items. Scene-origin parts with
 * `partType === 'component'` and `source === 'design-studio'` end up with
 * their mesh-node name copied into `materialName`, so the harvester mints a
 * phantom palette row per mesh node (door handles, drawer components, etc.).
 *
 * DF-2026-694 was the reported case: 24 `Door_1_(Double)_2_xxx` rows and
 * 3 `Drawer_3_1_xxx` rows were polluting the palette and forcing manual
 * material uploads as a workaround.
 *
 * This script:
 *   1. Loads a project by code.
 *   2. Scans design-item parts to build a map of materialName → contributing parts.
 *   3. For each palette entry, marks it phantom iff:
 *        - unmapped (no inventoryId), AND
 *        - every contributing part has partType === 'component'
 *          AND source === 'design-studio'.
 *      That test ensures we never strip a legit panel/timber/edge row.
 *   4. Prints a dry-run report. With --apply, rewrites
 *      materialPalette.entries, recomputes unmappedCount/mappedCount.
 *
 * Run:
 *   gcloud auth application-default login
 *   # Dry run — always safe
 *   node scripts/scrub-palette-phantom-entries.cjs --project=DF-2026-694
 *   # Commit
 *   node scripts/scrub-palette-phantom-entries.cjs --project=DF-2026-694 --apply
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

if (!PROJECT_CODE) {
  console.error('❌ --project=<code> required (e.g. --project=DF-2026-694)');
  process.exit(1);
}

function normalize(name) {
  if (!name) return 'unknown';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\bmm\b/gi, '')
    .replace(/\d+\s*mm/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('============================================================');
  console.log(`  Scrub Phantom Palette Entries — ${PROJECT_CODE}`);
  console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  console.log('============================================================\n');

  // 1. Find project
  const projQ = await db
    .collection('designProjects')
    .where('code', '==', PROJECT_CODE)
    .limit(1)
    .get();

  if (projQ.empty) {
    console.error(`❌ No project found with code ${PROJECT_CODE}`);
    process.exit(1);
  }

  const projDoc = projQ.docs[0];
  const projId = projDoc.id;
  const project = projDoc.data();
  const palette = project.materialPalette;

  if (!palette || !Array.isArray(palette.entries) || palette.entries.length === 0) {
    console.log('  (Palette is empty — nothing to scrub.)');
    return;
  }

  console.log(`Project: ${projId}`);
  console.log(`Palette entries: ${palette.entries.length}`);
  console.log(`Currently unmapped: ${palette.unmappedCount}`);
  console.log(`Currently mapped:   ${palette.mappedCount}\n`);

  // 2. Walk design items to classify contributing parts per normalized name
  const itemsSnap = await db
    .collection('designProjects')
    .doc(projId)
    .collection('designItems')
    .get();

  // key: normalizedName → { total, componentSceneOrigin, sample: [part] }
  const partIndex = new Map();
  for (const itemDoc of itemsSnap.docs) {
    const parts = itemDoc.data().parts || [];
    for (const p of parts) {
      const n = normalize(p.materialName || p.materialId || 'Unknown');
      const entry =
        partIndex.get(n) ||
        { total: 0, componentSceneOrigin: 0, samples: [] };
      entry.total += 1;
      if (p.partType === 'component' && p.source === 'design-studio') {
        entry.componentSceneOrigin += 1;
      }
      if (entry.samples.length < 2) {
        entry.samples.push({
          name: p.name,
          materialName: p.materialName,
          partType: p.partType,
          source: p.source,
        });
      }
      partIndex.set(n, entry);
    }
  }

  // 3. Classify palette entries
  const phantoms = [];
  const kept = [];

  for (const e of palette.entries) {
    const n = e.normalizedName || normalize(e.designName);
    const stats = partIndex.get(n);
    const unmapped = !e.inventoryId;
    const allScenePhantom =
      stats && stats.total > 0 && stats.total === stats.componentSceneOrigin;

    if (unmapped && allScenePhantom) {
      phantoms.push({ entry: e, stats });
    } else {
      kept.push(e);
    }
  }

  // 4. Report
  console.log(`── Phantom entries flagged for removal: ${phantoms.length} ──\n`);
  for (const { entry, stats } of phantoms) {
    console.log(`  ✗ ${entry.designName}`);
    console.log(
      `    id=${entry.id}  thickness=${entry.thickness}  type=${entry.materialType}`,
    );
    console.log(
      `    contributing parts: ${stats.total} (all component+design-studio)`,
    );
    if (stats.samples.length) {
      const s = stats.samples[0];
      console.log(
        `    sample part: name="${s.name}" materialName="${s.materialName}" partType=${s.partType} source=${s.source}`,
      );
    }
  }
  if (phantoms.length === 0) {
    console.log('  (None — palette is clean.)');
  }

  console.log(`\n── Entries kept: ${kept.length} ──`);
  for (const e of kept) {
    const marker = e.inventoryId ? '🔗' : '○';
    console.log(
      `  ${marker} ${e.designName}  (type=${e.materialType}, usage=${e.usageCount})`,
    );
  }
  console.log();

  if (phantoms.length === 0) {
    console.log('Nothing to do.\n');
    return;
  }

  if (!APPLY) {
    console.log('============================================================');
    console.log('  DRY RUN — rerun with --apply to commit.');
    console.log('============================================================\n');
    return;
  }

  // 5. Apply
  const removedMapped = phantoms.filter((p) => !!p.entry.inventoryId).length;
  const removedUnmapped = phantoms.length - removedMapped;

  const newPalette = {
    ...palette,
    entries: kept,
    unmappedCount: Math.max(0, (palette.unmappedCount || 0) - removedUnmapped),
    mappedCount: Math.max(0, (palette.mappedCount || 0) - removedMapped),
    lastHarvestedAt: admin.firestore.Timestamp.now(),
  };

  await db.collection('designProjects').doc(projId).update({
    materialPalette: newPalette,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: 'SYSTEM_PALETTE_SCRUB',
  });

  console.log('============================================================');
  console.log(`  ✅ Removed ${phantoms.length} phantom palette entries.`);
  console.log(`     unmappedCount: ${palette.unmappedCount} → ${newPalette.unmappedCount}`);
  console.log(`     mappedCount:   ${palette.mappedCount} → ${newPalette.mappedCount}`);
  console.log('============================================================\n');
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
