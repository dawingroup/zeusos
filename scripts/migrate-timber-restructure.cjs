/**
 * Migrate Timber Inventory: Collapse species x thickness x width x length
 * variants into species x thickness only.
 *
 * Steps:
 *   1. Create 4 missing parent documents for orphaned timber families
 *   2. Query all solid-wood variants (category == 'solid-wood', isFamily != true)
 *   3. Group variants by familyId + thickness
 *   4. For each group: pick keeper, update it, archive redundant variants
 *   5. Update family parents with kept SKU IDs and variantAttributeDefinitions
 *
 * Run: NODE_PATH=functions/node_modules node scripts/migrate-timber-restructure.cjs --dry-run
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

// ── Species code map ────────────────────────────────────────────────────────
const SPECIES_CODE_MAP = {
  'Mahogany': 'MAH',
  'Munyenye': 'MUN',
  'Muvule': 'MUV',
  'Nkalati': 'NKA',
  'Elgon Teak': 'ELG',
  'Pine': 'PIN',
  'Eucalyptus': 'EUC',
  'Musambya': 'MSB',
  'Mugavu': 'MUG',
  'Kirundu': 'KIR',
  'Musizi': 'MSZ',
};

// ── Missing parent definitions ──────────────────────────────────────────────
const MISSING_PARENTS = [
  {
    id: 'aPfydBT4JRz8GtaS6iWl',
    name: 'Muvule Hardwood Timber',
    species: 'Muvule',
  },
  {
    id: 'msj6lNB8S5TuplKNOYV4',
    name: 'Elgon Teak Hardwood Timber',
    species: 'Elgon Teak',
  },
  {
    id: 'qfWFZCWbnkMdIE8xil8L',
    name: 'Musambya Hardwood Timber',
    species: 'Musambya',
  },
  {
    id: 'fIaNvLqqJAmU8bKogUSg',
    name: 'Musizi Hardwood Timber',
    species: 'Musizi',
  },
];

const PARENT_TEMPLATE = {
  isFamily: true,
  isOrderable: false,
  isBomSelectable: false,
  category: 'solid-wood',
  tier: 'catalogue',
  restockable: true,
  status: 'active',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function getThickness(item) {
  if (!Array.isArray(item.variantAttributes)) return null;
  const attr = item.variantAttributes.find((a) => a.key === 'thickness_in');
  return attr ? String(attr.value) : null;
}

/**
 * Derive species name from the family parent name or the item's own name.
 * Tries to match against known species names.
 */
function deriveSpecies(item, familyParentName) {
  const candidates = [familyParentName, item.name, item.displayName].filter(Boolean);
  for (const candidate of candidates) {
    for (const species of Object.keys(SPECIES_CODE_MAP)) {
      if (candidate.toLowerCase().includes(species.toLowerCase())) {
        return species;
      }
    }
  }
  return null;
}

function pickKeeper(variants) {
  // Prefer variant with most data (most fields) and most recent updatedAt
  return variants.slice().sort((a, b) => {
    const aFields = Object.keys(a).length;
    const bFields = Object.keys(b).length;
    if (aFields !== bFields) return bFields - aFields;
    const aTime = a.updatedAt?.toDate?.() || a.updatedAt || new Date(0);
    const bTime = b.updatedAt?.toDate?.() || b.updatedAt || new Date(0);
    return bTime - aTime;
  })[0];
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== Timber Restructure Migration ===\n');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'EXECUTE (writing changes)'}\n`);

  const summary = {
    parentsCreated: 0,
    keepersUpdated: 0,
    variantsArchived: 0,
    familiesUpdated: 0,
    errors: [],
  };

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 1: Create missing parent documents
  // ══════════════════════════════════════════════════════════════════════════
  console.log('--- Phase 1: Create missing parent documents ---\n');

  for (const parent of MISSING_PARENTS) {
    const ref = db.collection('inventoryItems').doc(parent.id);
    const existing = await ref.get();

    if (existing.exists) {
      console.log(`  [SKIP] Parent "${parent.name}" (${parent.id}) already exists.`);
      continue;
    }

    const doc = {
      ...PARENT_TEMPLATE,
      name: parent.name,
      displayName: parent.name,
      sku: `TIM-${SPECIES_CODE_MAP[parent.species]}-FAMILY`,
      skuIds: [],
      variantAttributeDefinitions: ['thickness_in'],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: 'MIGRATION_TIMBER_RESTRUCTURE',
      updatedBy: 'MIGRATION_TIMBER_RESTRUCTURE',
    };

    console.log(`  [CREATE] Parent "${parent.name}" → ${parent.id}`);
    console.log(`           SKU: ${doc.sku}`);

    if (!DRY_RUN) {
      await ref.set(doc);
    }
    summary.parentsCreated++;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 2: Query all solid-wood variants
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n--- Phase 2: Query solid-wood variants ---\n');

  const snapshot = await db
    .collection('inventoryItems')
    .where('category', '==', 'solid-wood')
    .get();

  const allItems = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const variants = allItems.filter((i) => i.isFamily !== true);
  const families = allItems.filter((i) => i.isFamily === true);

  console.log(`  Total solid-wood items: ${allItems.length}`);
  console.log(`  Family parents: ${families.length}`);
  console.log(`  Variants (children): ${variants.length}`);

  // Build a lookup for family parent names
  const familyNameMap = {};
  for (const fam of families) {
    familyNameMap[fam.id] = fam.name;
  }
  // Also include missing parents we just created (or will create)
  for (const mp of MISSING_PARENTS) {
    if (!familyNameMap[mp.id]) {
      familyNameMap[mp.id] = mp.name;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 3: Group variants by familyId + thickness
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n--- Phase 3: Group by familyId + thickness ---\n');

  const groups = {};
  let ungroupable = 0;

  for (const v of variants) {
    const thickness = getThickness(v);
    const familyId = v.familyId;

    if (!familyId || !thickness) {
      console.log(`  [WARN] Cannot group: "${v.name}" (${v.id}) — familyId=${familyId}, thickness=${thickness}`);
      ungroupable++;
      continue;
    }

    const groupKey = `${familyId}::${thickness}`;
    if (!groups[groupKey]) {
      groups[groupKey] = { familyId, thickness, variants: [] };
    }
    groups[groupKey].variants.push(v);
  }

  const groupKeys = Object.keys(groups);
  console.log(`  Groups formed: ${groupKeys.length}`);
  console.log(`  Ungroupable variants: ${ungroupable}`);

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 4: Process each group — pick keeper, archive rest
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n--- Phase 4: Process groups ---\n');

  // Track kept IDs per family for Phase 5
  const keptIdsByFamily = {};

  for (const key of groupKeys) {
    const group = groups[key];
    const { familyId, thickness, variants: groupVariants } = group;
    const familyParentName = familyNameMap[familyId] || 'Unknown';
    const species = deriveSpecies(groupVariants[0], familyParentName);

    if (!species) {
      const msg = `Cannot derive species for group familyId=${familyId}, thickness=${thickness}`;
      console.log(`  [ERROR] ${msg}`);
      summary.errors.push(msg);
      continue;
    }

    const speciesCode = SPECIES_CODE_MAP[species];
    if (!speciesCode) {
      const msg = `No species code for "${species}" (familyId=${familyId})`;
      console.log(`  [ERROR] ${msg}`);
      summary.errors.push(msg);
      continue;
    }

    const keeper = pickKeeper(groupVariants);
    const redundant = groupVariants.filter((v) => v.id !== keeper.id);

    const newSku = `TIM-${speciesCode}-${thickness}IN`;
    const newName = `${thickness}-inch ${species} Timber`;
    const newDisplayName = `${species} \u2014 ${thickness} inch`;

    console.log(`  [GROUP] ${species} @ ${thickness}" — ${groupVariants.length} variant(s)`);
    console.log(`    Keeper: ${keeper.id} (was "${keeper.sku}")`);
    console.log(`      SKU:  ${keeper.sku} → ${newSku}`);
    console.log(`      Name: ${keeper.name} → ${newName}`);
    console.log(`      Display: ${newDisplayName}`);

    // Update keeper
    const keeperRef = db.collection('inventoryItems').doc(keeper.id);
    const keeperUpdates = {
      sku: newSku,
      name: newName,
      displayName: newDisplayName,
      variantAttributes: [{ key: 'thickness_in', value: String(thickness) }],
      'pricing.costPerCubicMetre': 0,
      'pricing.pricingBasis': 'per-cbm',
      stockUom: 'cbm',
      purchaseUom: 'pcs',
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: 'MIGRATION_TIMBER_RESTRUCTURE',
    };

    if (!DRY_RUN) {
      await keeperRef.update(keeperUpdates);
    }
    summary.keepersUpdated++;

    // Track for family update
    if (!keptIdsByFamily[familyId]) {
      keptIdsByFamily[familyId] = [];
    }
    keptIdsByFamily[familyId].push(keeper.id);

    // Archive redundant variants
    for (const rv of redundant) {
      console.log(`    [ARCHIVE] ${rv.id} — "${rv.sku}" ("${rv.name}")`);

      const archiveRef = db.collection('inventoryItems').doc(rv.id);
      const archiveUpdates = {
        status: 'archived',
        restockable: false,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: 'MIGRATION_TIMBER_RESTRUCTURE',
      };

      if (!DRY_RUN) {
        await archiveRef.update(archiveUpdates);
      }
      summary.variantsArchived++;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 5: Update family parents with kept SKU IDs
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n--- Phase 5: Update family parents ---\n');

  for (const familyId of Object.keys(keptIdsByFamily)) {
    const keptIds = keptIdsByFamily[familyId];
    const familyName = familyNameMap[familyId] || familyId;

    console.log(`  [UPDATE] Family "${familyName}" (${familyId})`);
    console.log(`           skuIds: [${keptIds.join(', ')}]`);
    console.log(`           variantAttributeDefinitions: ['thickness_in']`);

    const familyRef = db.collection('inventoryItems').doc(familyId);
    const familyUpdates = {
      skuIds: keptIds,
      variantAttributeDefinitions: ['thickness_in'],
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: 'MIGRATION_TIMBER_RESTRUCTURE',
    };

    if (!DRY_RUN) {
      await familyRef.update(familyUpdates);
    }
    summary.familiesUpdated++;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Summary
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n--- Migration Summary ---\n');
  console.log(`  Parents created:    ${summary.parentsCreated}`);
  console.log(`  Keepers updated:    ${summary.keepersUpdated}`);
  console.log(`  Variants archived:  ${summary.variantsArchived}`);
  console.log(`  Families updated:   ${summary.familiesUpdated}`);
  console.log(`  Errors:             ${summary.errors.length}`);

  if (summary.errors.length > 0) {
    console.log('\n  Errors:');
    summary.errors.forEach((e) => console.log(`    - ${e}`));
  }

  if (DRY_RUN) {
    console.log(
      '\n  [DRY RUN] No changes were written. Run with --execute to apply.\n',
    );
  } else {
    console.log('\n  [DONE] Migration completed successfully.\n');
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
