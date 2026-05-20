/**
 * Reclassify Fabric Palette Entries
 *
 * The material harvester preserves an entry's existing `materialType` once it
 * has been set, so older entries that were misclassified (e.g. "Blue uphostry"
 * saved as PANEL because the detector had no fabric branch) stay wrong even
 * after the detector is fixed. This script fixes them in place.
 *
 * Scope: palette entries whose designName/normalizedName contains any of
 *   uphost, fabric, leather, vinyl, velvet, suede, pleather
 * and whose current materialType is not FABRIC → flipped to FABRIC. Also
 * clears `stockSheets` (FABRIC uses `fabricStock`, not sheet-goods config).
 *
 * Run:
 *   gcloud auth application-default login
 *   # Dry run — always safe
 *   node scripts/reclassify-fabric-palette-entries.cjs
 *   # Scope to one project
 *   node scripts/reclassify-fabric-palette-entries.cjs --project=DF-2026-694
 *   # Commit
 *   node scripts/reclassify-fabric-palette-entries.cjs --project=DF-2026-694 --apply
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

const FABRIC_KEYWORDS = [
  'uphost',
  'fabric',
  'leather',
  'vinyl',
  'velvet',
  'suede',
  'pleather',
  'linen',
  'cotton',
  'silk',
  'canvas',
  'wool',
  'polyester',
  'jute',
  'burlap',
  'tweed',
  'chenille',
  'nylon',
];

function isFabricName(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  return FABRIC_KEYWORDS.some((k) => lower.includes(k));
}

async function main() {
  console.log('============================================================');
  console.log(`  Reclassify Fabric Palette Entries`);
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

  let totalProjects = 0;
  let totalEntries = 0;

  for (const projDoc of snap.docs) {
    const data = projDoc.data();
    const palette = data.materialPalette;
    if (!palette?.entries?.length) continue;

    const hits = palette.entries
      .map((e, idx) => ({ e, idx }))
      .filter(
        ({ e }) =>
          e.materialType !== 'FABRIC' &&
          isFabricName(e.designName || e.normalizedName || ''),
      );

    if (hits.length === 0) continue;

    totalProjects++;
    totalEntries += hits.length;

    console.log(`Project ${data.code || projDoc.id}  (${data.name || '—'})`);
    for (const { e } of hits) {
      console.log(
        `  ✎ ${e.designName}  [${e.materialType} → FABRIC]  usage=${e.usageCount}  mapped=${!!e.inventoryId}`,
      );
    }

    if (APPLY) {
      const entries = palette.entries.map((e) => {
        if (!isFabricName(e.designName || e.normalizedName || '')) return e;
        if (e.materialType === 'FABRIC') return e;
        // Flip to FABRIC and clear sheet-goods stock (FABRIC uses fabricStock).
        const { stockSheets, ...rest } = e;
        void stockSheets;
        return {
          ...rest,
          materialType: 'FABRIC',
          stockSheets: [],
          updatedAt: admin.firestore.Timestamp.now(),
        };
      });

      await db.collection('designProjects').doc(projDoc.id).update({
        'materialPalette.entries': entries,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: 'SYSTEM_FABRIC_RECLASSIFY',
      });
    }

    console.log('');
  }

  console.log('============================================================');
  if (totalEntries === 0) {
    console.log('  No entries needed reclassifying.');
  } else {
    console.log(
      `  ${APPLY ? '✅ Updated' : 'Would update'} ${totalEntries} entries across ${totalProjects} project(s).`,
    );
  }
  if (!APPLY && totalEntries > 0) {
    console.log('  DRY RUN — rerun with --apply to commit.');
  }
  console.log('============================================================\n');
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
