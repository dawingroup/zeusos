/**
 * Migration Script: Merge materials + katanaCatalogItems → inventoryItems
 * 
 * This script:
 * 1. Reads all documents from `materials` collection
 * 2. Reads all documents from `katanaCatalogItems` collection
 * 3. Merges them into unified `inventoryItems` collection
 * 4. Preserves all existing data with proper source tracking
 * 
 * Run with: node scripts/migrate-to-inventory.mjs
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin using Application Default Credentials
// This uses your gcloud/firebase CLI credentials automatically
initializeApp({
  credential: applicationDefault(),
  projectId: 'dawinos',
});

const db = getFirestore();

// Collection references
const materialsRef = db.collection('materials');
const katanaCatalogRef = db.collection('katanaCatalogItems');
const inventoryRef = db.collection('inventoryItems');

// Category mapping from old materials to new inventory
const categoryMapping = {
  'sheet-goods': 'sheet-goods',
  'solid-wood': 'solid-wood',
  'hardware': 'hardware',
  'edge-banding': 'edge-banding',
  'finishing': 'finishing',
  'other': 'other',
};

// Infer category from Katana type/name
function inferCategoryFromKatana(type, name) {
  const lowerType = (type || '').toLowerCase();
  const lowerName = (name || '').toLowerCase();
  
  if (lowerType.includes('board') || lowerType.includes('sheet') || 
      lowerName.includes('mdf') || lowerName.includes('plywood') ||
      lowerName.includes('chipboard') || lowerName.includes('melamine')) {
    return 'sheet-goods';
  }
  if (lowerType.includes('hardware') || lowerName.includes('hinge') ||
      lowerName.includes('handle') || lowerName.includes('drawer slide')) {
    return 'hardware';
  }
  if (lowerType.includes('edge') || lowerName.includes('edge')) {
    return 'edge-banding';
  }
  if (lowerType.includes('finish') || lowerName.includes('lacquer') ||
      lowerName.includes('stain') || lowerName.includes('polish')) {
    return 'finishing';
  }
  if (lowerType.includes('adhesive') || lowerName.includes('glue')) {
    return 'adhesives';
  }
  if (lowerType.includes('fastener') || lowerName.includes('screw') ||
      lowerName.includes('nail') || lowerName.includes('bolt')) {
    return 'fasteners';
  }
  
  return 'other';
}

// Convert material document to inventory item
function materialToInventoryItem(doc) {
  const data = doc.data();
  
  return {
    sku: data.code || `MAT-${doc.id.substring(0, 8).toUpperCase()}`,
    name: data.name || 'Unknown Material',
    displayName: data.name,
    description: data.description || null,
    category: categoryMapping[data.category] || 'other',
    subcategory: null,
    tags: [],
    aliases: [],
    source: 'manual',
    katanaId: null,
    promotedFromPartId: null,
    tier: data.tier || 'global',
    scopeId: null,
    dimensions: data.dimensions || null,
    grainPattern: data.grainPattern || null,
    pricing: {
      costPerUnit: data.pricing?.unitCost || data.unitCost || 0,
      currency: data.pricing?.currency || data.currency || 'KES',
      unit: data.pricing?.unit || 'sheet',
      lastSyncedFromKatana: null,
    },
    inventory: {
      inStock: 0,
      reorderLevel: null,
      lastSyncedFromKatana: null,
    },
    katanaSync: {
      isStandard: false,
      pendingPush: true,
      lastPulledAt: null,
      lastPushedAt: null,
      syncErrors: [],
    },
    status: data.status || 'active',
    createdAt: data.createdAt || FieldValue.serverTimestamp(),
    createdBy: data.createdBy || 'migration',
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: 'migration',
    _migratedFrom: 'materials',
    _originalId: doc.id,
  };
}

// Convert katana catalog item to inventory item
function katanaToInventoryItem(doc) {
  const data = doc.data();
  
  return {
    sku: data.sku || data.katanaId || doc.id,
    name: data.name || 'Unknown Item',
    displayName: data.displayNameOverride || data.name,
    description: null,
    category: inferCategoryFromKatana(data.type, data.name),
    subcategory: data.categoryOverride || data.type || null,
    tags: [],
    aliases: Array.isArray(data.aliases) ? data.aliases : [],
    source: 'katana',
    katanaId: data.katanaId || doc.id,
    promotedFromPartId: null,
    tier: 'global',
    scopeId: null,
    dimensions: null,
    grainPattern: null,
    pricing: {
      costPerUnit: data.costPerUnit || 0,
      currency: 'KES', // Assuming local currency
      unit: data.unit || 'ea',
      lastSyncedFromKatana: data.lastSyncedAt || FieldValue.serverTimestamp(),
    },
    inventory: {
      inStock: data.inStock || 0,
      reorderLevel: null,
      lastSyncedFromKatana: data.lastSyncedAt || FieldValue.serverTimestamp(),
    },
    katanaSync: {
      isStandard: data.isStandard || false,
      pendingPush: false, // Already from Katana
      lastPulledAt: data.lastSyncedAt || FieldValue.serverTimestamp(),
      lastPushedAt: null,
      syncErrors: [],
    },
    status: 'active',
    createdAt: data.createdAt || FieldValue.serverTimestamp(),
    createdBy: data.createdBy || 'migration',
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: 'migration',
    _migratedFrom: 'katanaCatalogItems',
    _originalId: doc.id,
  };
}

async function migrate() {
  console.log('🚀 Starting migration to unified inventoryItems collection...\n');
  
  const stats = {
    materials: { read: 0, migrated: 0, skipped: 0 },
    katana: { read: 0, migrated: 0, skipped: 0 },
    errors: [],
  };

  // Track SKUs to avoid duplicates
  const existingSkus = new Set();
  
  // Check for existing inventory items
  const existingSnapshot = await inventoryRef.get();
  existingSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.sku) existingSkus.add(data.sku.toLowerCase());
  });
  console.log(`📋 Found ${existingSkus.size} existing inventory items\n`);

  // === Migrate Materials ===
  console.log('📦 Migrating materials collection...');
  const materialsSnapshot = await materialsRef.get();
  stats.materials.read = materialsSnapshot.size;
  
  for (const doc of materialsSnapshot.docs) {
    try {
      const inventoryItem = materialToInventoryItem(doc);
      const skuLower = inventoryItem.sku.toLowerCase();
      
      if (existingSkus.has(skuLower)) {
        console.log(`  ⏭️  Skipping duplicate SKU: ${inventoryItem.sku}`);
        stats.materials.skipped++;
        continue;
      }
      
      await inventoryRef.add(inventoryItem);
      existingSkus.add(skuLower);
      stats.materials.migrated++;
      console.log(`  ✅ Migrated material: ${inventoryItem.name} (${inventoryItem.sku})`);
    } catch (error) {
      stats.errors.push(`Material ${doc.id}: ${error.message}`);
      console.error(`  ❌ Error migrating material ${doc.id}:`, error.message);
    }
  }
  
  console.log(`\n📊 Materials: ${stats.materials.migrated}/${stats.materials.read} migrated, ${stats.materials.skipped} skipped\n`);

  // === Migrate Katana Catalog Items ===
  console.log('🔄 Migrating katanaCatalogItems collection...');
  const katanaSnapshot = await katanaCatalogRef.get();
  stats.katana.read = katanaSnapshot.size;
  
  for (const doc of katanaSnapshot.docs) {
    try {
      const inventoryItem = katanaToInventoryItem(doc);
      const skuLower = inventoryItem.sku.toLowerCase();
      
      if (existingSkus.has(skuLower)) {
        console.log(`  ⏭️  Skipping duplicate SKU: ${inventoryItem.sku}`);
        stats.katana.skipped++;
        continue;
      }
      
      await inventoryRef.add(inventoryItem);
      existingSkus.add(skuLower);
      stats.katana.migrated++;
      console.log(`  ✅ Migrated Katana item: ${inventoryItem.name} (${inventoryItem.sku})`);
    } catch (error) {
      stats.errors.push(`Katana ${doc.id}: ${error.message}`);
      console.error(`  ❌ Error migrating Katana item ${doc.id}:`, error.message);
    }
  }
  
  console.log(`\n📊 Katana: ${stats.katana.migrated}/${stats.katana.read} migrated, ${stats.katana.skipped} skipped\n`);

  // === Summary ===
  console.log('═══════════════════════════════════════════');
  console.log('                 SUMMARY                   ');
  console.log('═══════════════════════════════════════════');
  console.log(`Materials:     ${stats.materials.migrated} migrated, ${stats.materials.skipped} skipped`);
  console.log(`Katana Items:  ${stats.katana.migrated} migrated, ${stats.katana.skipped} skipped`);
  console.log(`Total:         ${stats.materials.migrated + stats.katana.migrated} items in inventoryItems`);
  
  if (stats.errors.length > 0) {
    console.log(`\n⚠️  ${stats.errors.length} errors occurred:`);
    stats.errors.forEach(e => console.log(`   - ${e}`));
  } else {
    console.log('\n✅ Migration completed successfully!');
  }
  
  console.log('\n📝 Next steps:');
  console.log('   1. Verify data in Firebase Console → Firestore → inventoryItems');
  console.log('   2. Update app code to use new inventory module');
  console.log('   3. Deploy Katana sync Cloud Functions');
  console.log('   4. (Optional) Archive old collections after verification');
}

// Run migration
migrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
