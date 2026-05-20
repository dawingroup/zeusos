/**
 * Link offcuts to Manufacturing Order BOM for Floating TV Cabinet 2 — DF-2026-621
 *
 * This script:
 *   1. Finds the design project by code DF-2026-621
 *   2. Reads the material palette for any offcutIds
 *   3. Reads all offcuts reserved/available for this project
 *   4. Finds the associated Manufacturing Order(s)
 *   5. Updates MO BOM entries with offcutId where materials match
 *   6. Ensures offcuts are reserved for this project
 *
 * Run: NODE_PATH=functions/node_modules node scripts/link-offcuts-to-mo-df-2026-621.cjs
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const PROJECT_CODE = 'DF-2026-621';

async function main() {
  console.log(`\n=== Linking offcuts for ${PROJECT_CODE} ===\n`);

  // ── Step 1: Find the design project ──
  const projectSnap = await db.collection('designProjects')
    .where('code', '==', PROJECT_CODE)
    .limit(1)
    .get();

  if (projectSnap.empty) {
    console.error(`❌ Project ${PROJECT_CODE} not found in designProjects`);
    process.exit(1);
  }

  const projectDoc = projectSnap.docs[0];
  const projectId = projectDoc.id;
  const project = projectDoc.data();
  console.log(`✅ Found project: "${project.name}" (${projectId})`);

  // ── Step 2: Read material palette ──
  const palette = project.materialPalette;
  if (!palette?.entries?.length) {
    console.log('⚠️  No material palette entries found on project');
  } else {
    console.log(`📋 Material palette: ${palette.entries.length} entries (${palette.mappedCount || 0} mapped, ${palette.unmappedCount || 0} unmapped)`);

    const paletteOffcutEntries = palette.entries.filter(e => e.offcutIds?.length > 0);
    if (paletteOffcutEntries.length > 0) {
      console.log(`   └─ ${paletteOffcutEntries.length} entries already have offcutIds:`);
      for (const e of paletteOffcutEntries) {
        console.log(`      • ${e.designName} (${e.thickness}mm): offcutIds=[${e.offcutIds.join(', ')}]`);
      }
    }

    // Check for offcut:-prefixed inventoryIds that weren't persisted as offcutIds
    const offcutPrefixedEntries = palette.entries.filter(e =>
      e.inventoryId?.startsWith('offcut:') && (!e.offcutIds || e.offcutIds.length === 0)
    );
    if (offcutPrefixedEntries.length > 0) {
      console.log(`\n   ⚠️  ${offcutPrefixedEntries.length} entries have offcut: prefix but no offcutIds (fixing...):`);
      for (const e of offcutPrefixedEntries) {
        const offcutId = e.inventoryId.replace('offcut:', '');
        console.log(`      • ${e.designName} (${e.thickness}mm): inventoryId="${e.inventoryId}" → offcutId="${offcutId}"`);
        e.offcutIds = [offcutId];
      }

      // Save fixed palette back to project
      await projectDoc.ref.update({
        materialPalette: palette,
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log('   ✅ Fixed palette offcutIds saved to project');
    }
  }

  // ── Step 3: Find all offcuts related to this project ──
  console.log('\n--- Offcuts in library ---');

  // Offcuts reserved for this project
  const reservedSnap = await db.collection('offcuts')
    .where('reservedForProjectId', '==', projectId)
    .get();

  // Offcuts sourced from this project
  const sourcedSnap = await db.collection('offcuts')
    .where('sourceProjectId', '==', projectId)
    .get();

  // All available offcuts (to match against BOM materials)
  const availableSnap = await db.collection('offcuts')
    .where('status', '==', 'available')
    .get();

  const reservedOffcuts = reservedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const sourcedOffcuts = sourcedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const availableOffcuts = availableSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`  Reserved for this project: ${reservedOffcuts.length}`);
  for (const o of reservedOffcuts) {
    console.log(`    • [${o.id}] ${o.materialName} ${o.length}×${o.width}×${o.thickness}mm (${o.status}) cond=${o.condition}`);
  }

  console.log(`  Sourced from this project: ${sourcedOffcuts.length}`);
  for (const o of sourcedOffcuts) {
    console.log(`    • [${o.id}] ${o.materialName} ${o.length}×${o.width}×${o.thickness}mm (${o.status})`);
  }

  console.log(`  Total available offcuts in library: ${availableOffcuts.length}`);
  if (availableOffcuts.length > 0) {
    for (const o of availableOffcuts) {
      console.log(`    • [${o.id}] ${o.materialType} - ${o.materialName} ${o.length}×${o.width}×${o.thickness}mm cond=${o.condition} cost=${o.originalCostAllocation}`);
    }
  }

  // ── Step 4: Find associated Manufacturing Orders ──
  console.log('\n--- Manufacturing Orders ---');

  const moSnap = await db.collection('manufacturingOrders')
    .where('projectCode', '==', PROJECT_CODE)
    .get();

  if (moSnap.empty) {
    // Try by projectId as fallback
    const moByProjectSnap = await db.collection('manufacturingOrders')
      .where('projectId', '==', projectId)
      .get();

    if (moByProjectSnap.empty) {
      console.log('⚠️  No Manufacturing Orders found for this project');
      console.log('\n--- Summary ---');
      console.log('No MOs to update. Offcuts are registered but no MO exists yet.');
      console.log('When the design item is handed over to manufacturing, the BOM will now');
      console.log('pick up offcutIds from the palette (thanks to the code fix).');
      process.exit(0);
    }
    moSnap.docs.push(...moByProjectSnap.docs);
  }

  // ── Step 5: Collect all offcuts to match (reserved + available) ──
  const allMatchableOffcuts = [...reservedOffcuts, ...availableOffcuts];

  // Build a lookup by material name (normalized lowercase)
  const offcutsByMaterial = new Map();
  for (const o of allMatchableOffcuts) {
    const key = (o.materialName || '').toLowerCase().trim();
    if (!offcutsByMaterial.has(key)) offcutsByMaterial.set(key, []);
    offcutsByMaterial.get(key).push(o);
  }

  // Also collect offcutIds from palette
  const paletteOffcutMap = new Map(); // materialName → offcutId
  if (palette?.entries) {
    for (const e of palette.entries) {
      if (e.offcutIds?.length > 0) {
        const key = (e.inventoryName || e.designName || '').toLowerCase().trim();
        paletteOffcutMap.set(key, e.offcutIds[0]);
        // Also map by normalized name
        if (e.normalizedName) {
          paletteOffcutMap.set(e.normalizedName.toLowerCase(), e.offcutIds[0]);
        }
      }
    }
  }

  // ── Step 6: Update MO BOM entries ──
  for (const moDoc of moSnap.docs) {
    const mo = moDoc.data();
    const moId = moDoc.id;
    console.log(`\n📦 MO: ${mo.moNumber || moId} — Status: ${mo.status} — Stage: ${mo.currentStage}`);
    console.log(`   Design Item: ${mo.designItemName || mo.designItemId}`);

    if (!mo.bom || mo.bom.length === 0) {
      console.log('   ⚠️  No BOM entries');
      continue;
    }

    console.log(`   BOM entries: ${mo.bom.length}`);
    let updated = false;

    for (let i = 0; i < mo.bom.length; i++) {
      const bomEntry = mo.bom[i];
      const itemNameLower = (bomEntry.itemName || '').toLowerCase().trim();

      // Already has an offcut linked
      if (bomEntry.offcutId) {
        console.log(`   ✅ BOM[${i}] "${bomEntry.itemName}" already linked to offcut ${bomEntry.offcutId}`);
        continue;
      }

      // Check 1: Does the palette say this material uses an offcut?
      let matchedOffcutId = paletteOffcutMap.get(itemNameLower);

      // Check 2: Does the inventoryId start with 'offcut:'?
      if (!matchedOffcutId && bomEntry.inventoryItemId?.startsWith('offcut:')) {
        matchedOffcutId = bomEntry.inventoryItemId.replace('offcut:', '');
      }

      // Check 3: Is there a reserved/available offcut matching the material name?
      if (!matchedOffcutId) {
        const candidates = offcutsByMaterial.get(itemNameLower) || [];
        // Prefer reserved-for-this-project, then available
        const reserved = candidates.find(o => o.status === 'reserved' && o.reservedForProjectId === projectId);
        const available = candidates.find(o => o.status === 'available');
        if (reserved) matchedOffcutId = reserved.id;
        else if (available) matchedOffcutId = available.id;
      }

      if (matchedOffcutId) {
        console.log(`   🔗 BOM[${i}] "${bomEntry.itemName}" → linking offcut ${matchedOffcutId}`);
        mo.bom[i].offcutId = matchedOffcutId;
        mo.bom[i].offcutSourceProject = projectId;
        updated = true;

        // Ensure offcut is reserved for this project
        const offcutRef = db.collection('offcuts').doc(matchedOffcutId);
        const offcutDoc = await offcutRef.get();
        if (offcutDoc.exists) {
          const offcutData = offcutDoc.data();
          if (offcutData.status === 'available') {
            await offcutRef.update({
              status: 'reserved',
              reservedForProjectId: projectId,
              reservedAt: FieldValue.serverTimestamp(),
            });
            console.log(`      └─ Reserved offcut ${matchedOffcutId} for project ${projectId}`);
          } else if (offcutData.status === 'reserved' && offcutData.reservedForProjectId === projectId) {
            console.log(`      └─ Already reserved for this project`);
          } else {
            console.log(`      └─ ⚠️  Offcut status is "${offcutData.status}" (reserved for ${offcutData.reservedForProjectId || 'unknown'})`);
          }
        } else {
          console.log(`      └─ ⚠️  Offcut doc ${matchedOffcutId} not found in Firestore`);
        }
      } else {
        console.log(`   ─  BOM[${i}] "${bomEntry.itemName}" — no matching offcut found`);
      }
    }

    if (updated) {
      await moDoc.ref.update({
        bom: mo.bom,
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`   ✅ MO ${mo.moNumber || moId} BOM updated with offcut links`);
    } else {
      console.log(`   ── No BOM changes needed`);
    }
  }

  console.log('\n=== Done ===\n');
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
