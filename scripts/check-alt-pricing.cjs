const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with best available credentials
if (!admin.apps.length) {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(__dirname, '../service-account-key.json');
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('Initialized with service account\n');
  } catch (_) {
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'dawinos',
      });
      console.log('Initialized with application default credentials\n');
    } catch (__) {
      admin.initializeApp({ projectId: 'dawinos' });
      console.log('Initialized without credentials (emulator mode)\n');
    }
  }
}

const db = admin.firestore();

const PROJECT_ID = 'yk1FWKjCGA6g9OYkPQ5l';

async function main() {
  console.log('=== Alternative Pricing Check ===');
  console.log(`Project ID: ${PROJECT_ID}\n`);

  // 1. Get the project doc
  const projectDoc = await db.collection('projects').doc(PROJECT_ID).get();
  if (!projectDoc.exists) {
    console.error('Project not found!');
    process.exit(1);
  }
  const project = projectDoc.data();
  console.log(`Project: ${project.name || '(unnamed)'}\n`);

  // ─────────────────────────────────────────────
  // 1. Material Palette with Alternatives
  // ─────────────────────────────────────────────
  const palette = project.materialPalette;
  if (!palette || !palette.entries || palette.entries.length === 0) {
    console.log('No materialPalette found on project.\n');
  } else {
    console.log('═══════════════════════════════════════════════════════');
    console.log('1. MATERIAL PALETTE ENTRIES WITH ALTERNATIVES');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total entries: ${palette.entries.length}, mapped: ${palette.mappedCount}, unmapped: ${palette.unmappedCount}\n`);

    const entriesWithAlts = palette.entries.filter(e => e.alternatives && e.alternatives.length > 0);
    if (entriesWithAlts.length === 0) {
      console.log('  No palette entries have alternatives.\n');
    }

    for (const entry of entriesWithAlts) {
      console.log(`  ▸ ${entry.designName}`);
      console.log(`    materialType: ${entry.materialType}, thickness: ${entry.thickness}mm`);
      console.log(`    unitCost: ${entry.unitCost}, costUnit: ${entry.costUnit || '(none)'}`);
      console.log(`    baseQualityTier: ${entry.baseQualityTier || 'standard'}`);
      console.log(`    Alternatives (${entry.alternatives.length}):`);
      for (const alt of entry.alternatives) {
        console.log(`      - [${alt.qualityTier}] ${alt.inventoryName}`);
        console.log(`        unitCost: ${alt.unitCost}, costUnit: ${alt.costUnit || '(none)'}, inventoryId: ${alt.inventoryId}`);
      }
      console.log();
    }

    // Also show entries WITHOUT alternatives for context
    const entriesWithoutAlts = palette.entries.filter(e => !e.alternatives || e.alternatives.length === 0);
    if (entriesWithoutAlts.length > 0) {
      console.log(`  (${entriesWithoutAlts.length} palette entries have NO alternatives)\n`);
    }
  }

  // ─────────────────────────────────────────────
  // 2. Consolidated Estimate - material line items
  // ─────────────────────────────────────────────
  const estimate = project.consolidatedEstimate;
  console.log('═══════════════════════════════════════════════════════');
  console.log('2. CONSOLIDATED ESTIMATE - MATERIAL LINE ITEMS');
  console.log('═══════════════════════════════════════════════════════');
  if (!estimate || !estimate.lineItems) {
    console.log('  No consolidatedEstimate found.\n');
  } else {
    console.log(`  Total line items: ${estimate.lineItems.length}`);
    console.log(`  Subtotal: ${estimate.subtotal}, Tax: ${estimate.taxAmount}, Total: ${estimate.total}`);
    console.log(`  isStale: ${estimate.isStale}, hasAlternatives: ${estimate.hasAlternatives}\n`);

    const materialItems = estimate.lineItems.filter(li => li.category === 'material');
    console.log(`  Material line items (${materialItems.length}):`);
    for (const li of materialItems) {
      console.log(`    - ${li.description}`);
      console.log(`      unitPrice: ${li.unitPrice}, qty: ${li.quantity} ${li.unit}, totalPrice: ${li.totalPrice}`);
      console.log(`      linkedDesignItemId: ${li.linkedDesignItemId || '(none)'}, linkedMaterialId: ${li.linkedMaterialId || '(none)'}`);
    }
    console.log();
  }

  // ─────────────────────────────────────────────
  // 3. Alternative Estimates
  // ─────────────────────────────────────────────
  const altEstimates = project.alternativeEstimates;
  console.log('═══════════════════════════════════════════════════════');
  console.log('3. ALTERNATIVE ESTIMATES');
  console.log('═══════════════════════════════════════════════════════');
  if (!altEstimates || !altEstimates.alternatives || altEstimates.alternatives.length === 0) {
    console.log('  No alternativeEstimates found.\n');
  } else {
    console.log(`  isStale: ${altEstimates.isStale}`);
    console.log(`  Alternatives count: ${altEstimates.alternatives.length}\n`);

    for (const alt of altEstimates.alternatives) {
      console.log(`  ▸ [${alt.qualityTier}] ${alt.tierLabel}`);
      console.log(`    total: ${alt.total}, deltaFromStandard: ${alt.deltaFromStandard}, deltaPercent: ${alt.deltaPercent}%`);
      console.log(`    subtotal: ${alt.subtotal}, taxAmount: ${alt.taxAmount}`);

      // Show substitutions
      if (alt.substitutions && alt.substitutions.length > 0) {
        console.log(`    Substitutions (${alt.substitutions.length}):`);
        for (const sub of alt.substitutions) {
          console.log(`      - "${sub.originalMaterialName}" → "${sub.alternativeMaterialName}"`);
          console.log(`        originalUnitCost: ${sub.originalUnitCost}, alternativeUnitCost: ${sub.alternativeUnitCost}, costDelta: ${sub.costDelta}`);
        }
      }

      // Show material line items that differ from standard
      if (alt.lineItems) {
        const altMaterialItems = alt.lineItems.filter(li => li.category === 'material');
        console.log(`    Material line items (${altMaterialItems.length}):`);
        for (const li of altMaterialItems) {
          console.log(`      - ${li.description}: unitPrice=${li.unitPrice}, qty=${li.quantity}, totalPrice=${li.totalPrice}`);
        }
      }
      console.log();
    }
  }

  // ─────────────────────────────────────────────
  // 4. Inventory items referenced in alternatives
  // ─────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════');
  console.log('4. INVENTORY ITEMS REFERENCED IN ALTERNATIVES');
  console.log('═══════════════════════════════════════════════════════');

  // Collect all inventoryIds from alternatives
  const inventoryIds = new Set();
  if (palette && palette.entries) {
    for (const entry of palette.entries) {
      if (entry.alternatives) {
        for (const alt of entry.alternatives) {
          if (alt.inventoryId) {
            inventoryIds.add(alt.inventoryId);
          }
        }
      }
      // Also collect the main mapped inventory id
      if (entry.inventoryId) {
        inventoryIds.add(entry.inventoryId);
      }
    }
  }

  if (inventoryIds.size === 0) {
    console.log('  No inventory IDs referenced in alternatives.\n');
  } else {
    console.log(`  Looking up ${inventoryIds.size} inventory items...\n`);
    for (const invId of inventoryIds) {
      const invDoc = await db.collection('inventory').doc(invId).get();
      if (!invDoc.exists) {
        console.log(`  ✗ ${invId}: NOT FOUND`);
        continue;
      }
      const inv = invDoc.data();
      const pricing = inv.pricing || {};
      console.log(`  ▸ ${invId}`);
      console.log(`    name: ${inv.name}`);
      console.log(`    pricing.costPerUnit: ${pricing.costPerUnit}, pricing.unit: ${pricing.unit}`);
      console.log(`    pricing.currency: ${pricing.currency || '(none)'}`);
      if (pricing.costPerSheet !== undefined) {
        console.log(`    pricing.costPerSheet: ${pricing.costPerSheet}`);
      }
      console.log();
    }
  }

  console.log('=== Done ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
