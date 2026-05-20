/**
 * Seed Inventory Categories Migration
 *
 * One-time callable function to populate the inventoryCategories collection
 * with the 12 legacy hardcoded categories + 2 new categories (consumables, spareparts).
 * Idempotent — safe to re-run (uses merge: true).
 * Also backfills itemCount from existing inventory items.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const LEGACY_CATEGORIES = [
  { slug: 'sheet-goods',   name: 'Sheet Goods',   sortOrder: 0 },
  { slug: 'solid-wood',    name: 'Solid Wood',     sortOrder: 1 },
  { slug: 'hardware',      name: 'Hardware',       sortOrder: 2 },
  { slug: 'edge-banding',  name: 'Edge Banding',   sortOrder: 3 },
  { slug: 'finishing',     name: 'Finishing',       sortOrder: 4 },
  { slug: 'adhesives',     name: 'Adhesives',      sortOrder: 5 },
  { slug: 'fasteners',     name: 'Fasteners',      sortOrder: 6 },
  { slug: 'upholstery',    name: 'Upholstery',     sortOrder: 7 },
  { slug: 'abrasives',     name: 'Abrasives',      sortOrder: 8 },
  { slug: 'services',      name: 'Services',       sortOrder: 9 },
  { slug: 'products',      name: 'Products',       sortOrder: 10 },
  { slug: 'other',         name: 'Other',          sortOrder: 11 },
];

const NEW_CATEGORIES = [
  {
    slug: 'consumables',
    name: 'Consumables',
    sortOrder: 12,
    description: 'Items expensed immediately on issue from stores (saw blades, drill bits, tapes, packaging)',
    expenseOnIssue: true,
    isSystem: false,
  },
  {
    slug: 'spareparts',
    name: 'Spareparts',
    sortOrder: 13,
    description: 'Replacement parts for machinery, expensed on issue from stores',
    expenseOnIssue: true,
    isSystem: false,
  },
];

exports.seedInventoryCategories = onCall({
  cors: ALLOWED_ORIGINS,
  timeoutSeconds: 120,
}, async (request) => {
  const now = admin.firestore.Timestamp.now();
  const userId = request.auth?.uid || 'migration';

  // Seed legacy categories
  const batch = db.batch();
  for (const cat of LEGACY_CATEGORIES) {
    const ref = db.collection('inventoryCategories').doc(cat.slug);
    batch.set(ref, {
      slug: cat.slug,
      name: cat.name,
      description: null,
      icon: null,
      color: null,
      parentSlug: null,
      sortOrder: cat.sortOrder,
      depth: 0,
      path: [],
      isSystem: true,
      isActive: true,
      allowItems: true,
      expenseOnIssue: false,
      defaultClassification: 'material',
      itemCount: 0,
      qboExpenseAccountId: null,
      qboExpenseAccountName: null,
      qboAssetAccountId: null,
      qboAssetAccountName: null,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    }, { merge: true });
  }

  // Seed new categories
  for (const cat of NEW_CATEGORIES) {
    const ref = db.collection('inventoryCategories').doc(cat.slug);
    batch.set(ref, {
      slug: cat.slug,
      name: cat.name,
      description: cat.description || null,
      icon: null,
      color: null,
      parentSlug: null,
      sortOrder: cat.sortOrder,
      depth: 0,
      path: [],
      isSystem: cat.isSystem ?? false,
      isActive: true,
      allowItems: true,
      expenseOnIssue: cat.expenseOnIssue ?? false,
      defaultClassification: 'material',
      itemCount: 0,
      qboExpenseAccountId: null,
      qboExpenseAccountName: null,
      qboAssetAccountId: null,
      qboAssetAccountName: null,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    }, { merge: true });
  }

  await batch.commit();

  // Backfill item counts from inventoryItems collection
  const counts = await backfillItemCounts();

  return {
    seeded: LEGACY_CATEGORIES.length + NEW_CATEGORIES.length,
    itemCounts: counts,
  };
});

async function backfillItemCounts() {
  const snapshot = await db.collection('inventoryItems')
    .where('status', '!=', 'archived')
    .select('category')
    .get();

  const counts = {};
  snapshot.docs.forEach(doc => {
    const cat = doc.data().category;
    if (cat) counts[cat] = (counts[cat] || 0) + 1;
  });

  // Batch update counts — max 500 per batch
  const entries = Object.entries(counts);
  for (let i = 0; i < entries.length; i += 500) {
    const chunk = entries.slice(i, i + 500);
    const batch = db.batch();
    for (const [slug, count] of chunk) {
      const ref = db.collection('inventoryCategories').doc(slug);
      batch.update(ref, {
        itemCount: count,
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }
    await batch.commit();
  }

  return counts;
}
