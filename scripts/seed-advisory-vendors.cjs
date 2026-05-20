/**
 * Seed Advisory Vendors to Supplier Library
 *
 * Reads all manual_requisitions from Firestore, extracts unique vendor names
 * from accountability entries, and creates supplier records in the unified
 * platform/suppliers/records collection.
 *
 * Run with:
 *   node scripts/seed-advisory-vendors.cjs
 *   node scripts/seed-advisory-vendors.cjs --dry-run
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

// ─── CLI Flags ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

if (DRY_RUN) console.log('\n  DRY RUN — no documents will be created\n');

// ─── Constants ───────────────────────────────────────────────────────────────

const MANUAL_REQUISITIONS_PATH = 'manual_requisitions';
const SUPPLIERS_COLLECTION = 'platform/suppliers/records';

// Category mapping: map expense categories to supplier categories
const EXPENSE_TO_SUPPLIER_CATEGORY = {
  construction_materials: 'materials',
  labor_wages: 'services',
  equipment_rental: 'equipment',
  transport_logistics: 'services',
  utilities: 'services',
  permits_fees: 'services',
  professional_services: 'services',
  contingency: 'other',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId() {
  return `sup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function normalizeVendorName(name) {
  if (!name) return null;
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function generateSupplierCode(index, category) {
  const prefixes = {
    materials: 'MAT',
    equipment: 'EQP',
    services: 'SVC',
    subcontractor: 'SUB',
    other: 'OTH',
  };
  const prefix = prefixes[category] || 'OTH';
  return `${prefix}-ADV-${(index + 1).toString().padStart(4, '0')}`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Seed Advisory Vendors to Supplier Library ===\n');

  // Step 1: Fetch all manual requisitions
  console.log('1. Fetching manual requisitions...');
  const snapshot = await db.collection(MANUAL_REQUISITIONS_PATH).get();
  console.log(`   Found ${snapshot.size} manual requisitions\n`);

  if (snapshot.size === 0) {
    console.log('   No manual requisitions found. Exiting.');
    process.exit(0);
  }

  // Step 2: Extract unique vendors with metadata
  console.log('2. Extracting vendor data from accountability entries...');

  const vendorMap = new Map();
  let totalEntries = 0;
  let entriesWithVendor = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const accountabilities = data.accountabilities || [];

    for (const acc of accountabilities) {
      totalEntries++;

      if (!acc.vendor || acc.vendor.trim() === '') continue;
      entriesWithVendor++;

      const normalizedName = normalizeVendorName(acc.vendor);
      if (!normalizedName) continue;

      if (!vendorMap.has(normalizedName)) {
        vendorMap.set(normalizedName, {
          name: normalizedName,
          originalNames: new Set(),
          categories: new Set(),
          totalAmount: 0,
          transactionCount: 0,
          requisitionIds: new Set(),
          firstSeen: null,
          lastSeen: null,
          descriptions: [],
        });
      }

      const vendor = vendorMap.get(normalizedName);
      vendor.originalNames.add(acc.vendor.trim());
      vendor.totalAmount += acc.amount || 0;
      vendor.transactionCount++;
      vendor.requisitionIds.add(doc.id);

      if (acc.category) {
        const supplierCat = EXPENSE_TO_SUPPLIER_CATEGORY[acc.category] || 'other';
        vendor.categories.add(supplierCat);
      }

      if (acc.description) {
        vendor.descriptions.push(acc.description);
      }

      // Track date range
      const entryDate = acc.date || data.requisitionDate;
      if (entryDate) {
        let dateValue;
        if (entryDate._seconds) {
          dateValue = new Date(entryDate._seconds * 1000);
        } else if (entryDate.toDate) {
          dateValue = entryDate.toDate();
        } else {
          dateValue = new Date(entryDate);
        }

        if (!vendor.firstSeen || dateValue < vendor.firstSeen) {
          vendor.firstSeen = dateValue;
        }
        if (!vendor.lastSeen || dateValue > vendor.lastSeen) {
          vendor.lastSeen = dateValue;
        }
      }
    }
  }

  console.log(`   Total accountability entries: ${totalEntries}`);
  console.log(`   Entries with vendor names: ${entriesWithVendor}`);
  console.log(`   Unique vendors found: ${vendorMap.size}\n`);

  if (vendorMap.size === 0) {
    console.log('   No vendors found in accountability entries. Exiting.');
    process.exit(0);
  }

  // Step 3: Check for existing suppliers to avoid duplicates
  console.log('3. Checking for existing suppliers...');
  const existingSnapshot = await db.collection(SUPPLIERS_COLLECTION).get();
  const existingNames = new Set();
  for (const doc of existingSnapshot.docs) {
    const data = doc.data();
    if (data.name) existingNames.add(data.name.toLowerCase());
    if (data.tradeName) existingNames.add(data.tradeName.toLowerCase());
  }
  console.log(`   ${existingSnapshot.size} existing suppliers in library`);

  // Step 4: Create supplier records
  console.log('\n4. Creating supplier records...\n');

  const vendors = Array.from(vendorMap.values());
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < vendors.length; i++) {
    const vendor = vendors[i];

    // Skip if already exists
    if (existingNames.has(vendor.name.toLowerCase())) {
      console.log(`   SKIP: "${vendor.name}" (already exists)`);
      skipped++;
      continue;
    }

    const categories = Array.from(vendor.categories);
    const primaryCategory = categories[0] || 'other';
    const supplierId = generateId();
    const supplierCode = generateSupplierCode(i, primaryCategory);

    const supplierDoc = {
      id: supplierId,
      code: supplierCode,
      name: vendor.name,

      // Contact – placeholder, to be filled in manually
      contactPerson: '',
      email: '',
      phone: '',

      // Address – default Uganda
      address: {
        line1: '',
        city: 'Kampala',
        country: 'Uganda',
      },

      // Categories from expense data
      categories: categories,
      materials: [],

      // Performance – seeded from accountability data
      totalOrders: vendor.transactionCount,
      totalValue: {
        amount: vendor.totalAmount,
        currency: 'UGX',
      },

      // Terms
      paymentTerms: 'Net 30',

      // Status
      status: 'active',

      // Subsidiary access – advisory
      subsidiaries: ['advisory'],

      // Source metadata
      sourceMetadata: {
        importedFrom: 'advisory_accountabilities',
        importDate: admin.firestore.FieldValue.serverTimestamp(),
        requisitionCount: vendor.requisitionIds.size,
        transactionCount: vendor.transactionCount,
        totalSpend: vendor.totalAmount,
        currency: 'UGX',
        firstTransaction: vendor.firstSeen || null,
        lastTransaction: vendor.lastSeen || null,
        sampleDescriptions: vendor.descriptions.slice(0, 5),
      },

      // Audit
      audit: {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'system-migration',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'system-migration',
        version: 1,
      },
    };

    // Add tradeName only if there are multiple name variants
    if (vendor.originalNames.size > 1) {
      supplierDoc.tradeName = Array.from(vendor.originalNames).join(' / ');
    }

    if (DRY_RUN) {
      console.log(`   [DRY] Would create: "${vendor.name}" (${supplierCode})`);
      console.log(`         Categories: ${categories.join(', ')}`);
      console.log(`         Transactions: ${vendor.transactionCount}, Total: UGX ${vendor.totalAmount.toLocaleString()}`);
      console.log(`         Linked requisitions: ${vendor.requisitionIds.size}`);
    } else {
      await db.collection(SUPPLIERS_COLLECTION).doc(supplierId).set(supplierDoc);
      console.log(`   CREATED: "${vendor.name}" (${supplierCode}) — ${vendor.transactionCount} txns, UGX ${vendor.totalAmount.toLocaleString()}`);
    }

    created++;
  }

  // Step 5: Summary
  console.log('\n=== Summary ===');
  console.log(`   Vendors found: ${vendorMap.size}`);
  console.log(`   Suppliers created: ${created}`);
  console.log(`   Skipped (duplicates): ${skipped}`);

  if (DRY_RUN) {
    console.log('\n   (Dry run — no changes were made)');
  }

  console.log('\nDone!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
