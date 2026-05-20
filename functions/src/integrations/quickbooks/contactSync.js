/**
 * QuickBooks Contact Sync Service
 * Pulls customers and vendors FROM QuickBooks INTO DawinOS
 *
 * Customers → Firestore `customers/{id}`
 * Vendors   → Firestore `platform/suppliers/records/{id}`
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const { refreshTokens, TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET } = require('./auth');
const { ALLOWED_ORIGINS } = require('../../config/cors');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const QBO_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function qboRequest(endpoint, options = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const encryptionKey = TOKEN_ENCRYPTION_KEY.value();
      const tokens = await refreshTokens(encryptionKey);

      const url = `${QBO_API_BASE}/${tokens.realm_id}${endpoint}`;
      if (attempt === 1) console.log('[ContactSync] QBO API:', endpoint.slice(0, 100));

      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
      });

      if (response.status === 429) {
        const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
        console.warn(`[ContactSync] Rate limited (429). Retry ${attempt}/${retries} in ${backoffMs}ms...`);
        await sleep(backoffMs);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`QuickBooks API error (${response.status}): ${errorText}`);
      }

      return response.json();
    } catch (error) {
      if (attempt === retries) throw error;
      const backoffMs = 2000 * attempt;
      console.warn(`[ContactSync] Error (attempt ${attempt}): ${error.message}. Retrying in ${backoffMs}ms...`);
      await sleep(backoffMs);
    }
  }
}

async function createSyncJob(companyId, category, userId) {
  const jobRef = db.collection('companies').doc(companyId)
    .collection('qbo_sync_jobs').doc();

  await jobRef.set({
    id: jobRef.id,
    companyId,
    category,
    status: 'syncing',
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    triggeredBy: userId,
  });

  return jobRef;
}

async function completeSyncJob(jobRef, recordCount) {
  await jobRef.update({
    status: 'success',
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    recordCount,
  });
}

async function failSyncJob(jobRef, error) {
  await jobRef.update({
    status: 'error',
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    error: error.message || 'Unknown error',
  });
}

// ----------------------------------------------------------------------------
// PAGINATED QBO FETCH
// ----------------------------------------------------------------------------

async function fetchAllQBOCustomers() {
  const all = [];
  let startPosition = 1;
  const maxResults = 1000;

  while (true) {
    const query = encodeURIComponent(
      `SELECT * FROM Customer STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
    );
    const response = await qboRequest(`/query?query=${query}`);
    const items = response.QueryResponse?.Customer || [];
    all.push(...items);

    if (items.length < maxResults) break;
    startPosition += maxResults;
    await sleep(1000);
  }

  console.log(`[ContactSync] Fetched ${all.length} customers from QBO`);
  return all;
}

async function fetchAllQBOVendors() {
  const all = [];
  let startPosition = 1;
  const maxResults = 1000;

  while (true) {
    const query = encodeURIComponent(
      `SELECT * FROM Vendor STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
    );
    const response = await qboRequest(`/query?query=${query}`);
    const items = response.QueryResponse?.Vendor || [];
    all.push(...items);

    if (items.length < maxResults) break;
    startPosition += maxResults;
    await sleep(1000);
  }

  console.log(`[ContactSync] Fetched ${all.length} vendors from QBO`);
  return all;
}

// ----------------------------------------------------------------------------
// QBO → FIRESTORE MAPPING: CUSTOMER
// ----------------------------------------------------------------------------

function mapQBOCustomerToFirestore(qboCustomer) {
  const name = qboCustomer.DisplayName || qboCustomer.CompanyName || 'Unknown';

  const customer = {
    name,
    type: qboCustomer.CompanyName ? 'commercial' : 'residential',
    status: qboCustomer.Active !== false ? 'active' : 'inactive',
    email: qboCustomer.PrimaryEmailAddr?.Address || null,
    phone: qboCustomer.PrimaryPhone?.FreeFormNumber || null,
    website: qboCustomer.WebAddr?.URI || null,
    notes: qboCustomer.Notes || '',
    tags: ['qbo-import'],
    contacts: [],
    externalIds: {
      quickbooksId: qboCustomer.Id,
    },
  };

  // Billing address
  if (qboCustomer.BillAddr) {
    customer.billingAddress = {
      street1: qboCustomer.BillAddr.Line1 || '',
      street2: qboCustomer.BillAddr.Line2 || '',
      city: qboCustomer.BillAddr.City || '',
      state: qboCustomer.BillAddr.CountrySubDivisionCode || '',
      postalCode: qboCustomer.BillAddr.PostalCode || '',
      country: qboCustomer.BillAddr.Country || '',
    };
  }

  // Shipping address
  if (qboCustomer.ShipAddr) {
    customer.shippingAddress = {
      street1: qboCustomer.ShipAddr.Line1 || '',
      street2: qboCustomer.ShipAddr.Line2 || '',
      city: qboCustomer.ShipAddr.City || '',
      state: qboCustomer.ShipAddr.CountrySubDivisionCode || '',
      postalCode: qboCustomer.ShipAddr.PostalCode || '',
      country: qboCustomer.ShipAddr.Country || '',
    };
  }

  // Primary contact from GivenName/FamilyName
  const contactName = [qboCustomer.GivenName, qboCustomer.FamilyName]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (contactName) {
    customer.contacts.push({
      name: contactName,
      email: qboCustomer.PrimaryEmailAddr?.Address || '',
      phone: qboCustomer.PrimaryPhone?.FreeFormNumber || '',
      isPrimary: true,
    });
  }

  return customer;
}

// ----------------------------------------------------------------------------
// QBO → FIRESTORE MAPPING: VENDOR → SUPPLIER
// ----------------------------------------------------------------------------

function mapQBOVendorToSupplier(qboVendor) {
  const name = qboVendor.DisplayName || qboVendor.CompanyName || 'Unknown';

  const contactPerson = qboVendor.PrintOnCheckName
    || [qboVendor.GivenName, qboVendor.FamilyName].filter(Boolean).join(' ').trim()
    || '';

  const supplier = {
    name,
    tradeName: qboVendor.CompanyName || '',
    contactPerson,
    email: qboVendor.PrimaryEmailAddr?.Address || '',
    phone: qboVendor.PrimaryPhone?.FreeFormNumber || '',
    alternatePhone: qboVendor.AlternatePhone?.FreeFormNumber || '',
    website: qboVendor.WebAddr?.URI || '',
    address: {
      line1: '',
      city: '',
      country: '',
    },
    categories: ['other'],
    materials: [],
    status: qboVendor.Active !== false ? 'active' : 'inactive',
    subsidiaries: ['all'],
    externalIds: {
      quickbooksId: qboVendor.Id,
    },
    qboSyncStatus: 'synced',
    rating: 0,
    totalOrders: 0,
    totalValue: { amount: 0, currency: 'KES' },
  };

  // Payment terms
  if (qboVendor.TermRef?.name) {
    supplier.paymentTerms = qboVendor.TermRef.name;
  }

  // Tax ID
  if (qboVendor.TaxIdentifier) {
    supplier.taxId = qboVendor.TaxIdentifier;
  }

  // Address
  if (qboVendor.BillAddr) {
    supplier.address = {
      line1: qboVendor.BillAddr.Line1 || '',
      line2: qboVendor.BillAddr.Line2 || '',
      city: qboVendor.BillAddr.City || '',
      region: qboVendor.BillAddr.CountrySubDivisionCode || '',
      postalCode: qboVendor.BillAddr.PostalCode || '',
      country: qboVendor.BillAddr.Country || '',
    };
  }

  return supplier;
}

// ----------------------------------------------------------------------------
// CUSTOMER CODE GENERATION
// ----------------------------------------------------------------------------

async function getNextCustomerCodeNumber() {
  const snapshot = await db.collection('customers').get();
  let maxNumber = 0;
  snapshot.docs.forEach(doc => {
    const code = doc.data().code || '';
    const match = code.match(/DF-CUS-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) maxNumber = num;
    }
  });
  return maxNumber + 1;
}

function formatCustomerCode(num) {
  return `DF-CUS-${num.toString().padStart(3, '0')}`;
}

// ----------------------------------------------------------------------------
// SUPPLIER CODE GENERATION
// ----------------------------------------------------------------------------

async function getNextSupplierCodeNumber() {
  const snapshot = await db.collection('platform').doc('suppliers')
    .collection('records').get();
  let maxNumber = 0;
  snapshot.docs.forEach(doc => {
    const code = doc.data().code || '';
    const match = code.match(/OTH-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) maxNumber = num;
    }
  });
  return maxNumber + 1;
}

function formatSupplierCode(num) {
  return `OTH-${num.toString().padStart(4, '0')}`;
}

// ----------------------------------------------------------------------------
// SYNC: QBO CUSTOMERS → FIRESTORE
// ----------------------------------------------------------------------------

async function syncQBOCustomersToFirestore(companyId, userId) {
  const jobRef = await createSyncJob(companyId, 'customers', userId);

  try {
    const qboCustomers = await fetchAllQBOCustomers();

    // Build lookup of existing customers by QBO ID
    const existingSnapshot = await db.collection('customers').get();
    const existingByQboId = {};
    const existingByName = {};

    existingSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const qboId = data.externalIds?.quickbooksId;
      if (qboId) {
        existingByQboId[qboId] = { id: doc.id, ...data };
      }
      if (data.name) {
        existingByName[data.name.toLowerCase().trim()] = { id: doc.id, ...data };
      }
    });

    // Pre-calculate customer codes for new records
    let nextCodeNum = await getNextCustomerCodeNumber();

    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Process in batches of 450 (Firestore limit is 500)
    const batchOps = [];

    for (const qboCustomer of qboCustomers) {
      // Skip sub-customers/jobs
      if (qboCustomer.Job === true) {
        skipped++;
        continue;
      }

      const qboId = qboCustomer.Id;
      const displayName = qboCustomer.DisplayName || qboCustomer.CompanyName || '';
      const mapped = mapQBOCustomerToFirestore(qboCustomer);

      // Tier 1: Match by QBO ID
      const existingByQbo = existingByQboId[qboId];
      if (existingByQbo) {
        batchOps.push({
          type: 'update',
          ref: db.collection('customers').doc(existingByQbo.id),
          data: {
            name: mapped.name,
            email: mapped.email || existingByQbo.email || null,
            phone: mapped.phone || existingByQbo.phone || null,
            website: mapped.website || existingByQbo.website || null,
            billingAddress: mapped.billingAddress || existingByQbo.billingAddress || null,
            shippingAddress: mapped.shippingAddress || existingByQbo.shippingAddress || null,
            status: mapped.status,
            'syncStatus.quickbooks': 'synced',
            'syncStatus.quickbooksLastSync': admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: userId,
          },
        });
        updated++;
        continue;
      }

      // Tier 2: Match by name (case-insensitive)
      const nameMatch = existingByName[displayName.toLowerCase().trim()];
      if (nameMatch) {
        batchOps.push({
          type: 'update',
          ref: db.collection('customers').doc(nameMatch.id),
          data: {
            'externalIds.quickbooksId': qboId,
            email: mapped.email || nameMatch.email || null,
            phone: mapped.phone || nameMatch.phone || null,
            'syncStatus.quickbooks': 'synced',
            'syncStatus.quickbooksLastSync': admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: userId,
          },
        });
        // Prevent future duplicate name matches
        existingByQboId[qboId] = nameMatch;
        updated++;
        continue;
      }

      // Tier 3: Create new customer
      const code = formatCustomerCode(nextCodeNum++);
      const docRef = db.collection('customers').doc();
      batchOps.push({
        type: 'set',
        ref: docRef,
        data: {
          ...mapped,
          code,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: userId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: userId,
          'syncStatus.quickbooks': 'synced',
          'syncStatus.quickbooksLastSync': admin.firestore.FieldValue.serverTimestamp(),
        },
      });
      created++;
    }

    // Commit in batches of 450
    for (let i = 0; i < batchOps.length; i += 450) {
      const batch = db.batch();
      const slice = batchOps.slice(i, i + 450);
      for (const op of slice) {
        if (op.type === 'set') {
          batch.set(op.ref, op.data);
        } else {
          batch.update(op.ref, op.data);
        }
      }
      await batch.commit();
      if (i + 450 < batchOps.length) await sleep(500);
    }

    await completeSyncJob(jobRef, qboCustomers.length);
    console.log(`[ContactSync] Customers: ${created} created, ${updated} updated, ${skipped} skipped`);
    return { created, updated, skipped, total: qboCustomers.length };
  } catch (error) {
    console.error('[ContactSync] Customer sync failed:', error);
    await failSyncJob(jobRef, error);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// SYNC: QBO VENDORS → FIRESTORE SUPPLIERS
// ----------------------------------------------------------------------------

async function syncQBOVendorsToFirestore(companyId, userId) {
  const jobRef = await createSyncJob(companyId, 'vendors', userId);

  try {
    const qboVendors = await fetchAllQBOVendors();

    // Build lookup of existing suppliers by QBO ID
    const suppliersRef = db.collection('platform').doc('suppliers').collection('records');
    const existingSnapshot = await suppliersRef.get();
    const existingByQboId = {};
    const existingByName = {};

    existingSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const qboId = data.externalIds?.quickbooksId;
      if (qboId) {
        existingByQboId[qboId] = { id: doc.id, ...data };
      }
      if (data.name) {
        existingByName[data.name.toLowerCase().trim()] = { id: doc.id, ...data };
      }
    });

    // Pre-calculate supplier codes
    let nextCodeNum = await getNextSupplierCodeNumber();

    let created = 0;
    let updated = 0;
    let skipped = 0;

    const batchOps = [];

    for (const qboVendor of qboVendors) {
      const qboId = qboVendor.Id;
      const displayName = qboVendor.DisplayName || qboVendor.CompanyName || '';
      const mapped = mapQBOVendorToSupplier(qboVendor);

      // Tier 1: Match by QBO ID
      const existingByQbo = existingByQboId[qboId];
      if (existingByQbo) {
        batchOps.push({
          type: 'update',
          ref: suppliersRef.doc(existingByQbo.id),
          data: {
            name: mapped.name,
            tradeName: mapped.tradeName || existingByQbo.tradeName || '',
            contactPerson: mapped.contactPerson || existingByQbo.contactPerson || '',
            email: mapped.email || existingByQbo.email || '',
            phone: mapped.phone || existingByQbo.phone || '',
            website: mapped.website || existingByQbo.website || '',
            address: mapped.address.line1 ? mapped.address : (existingByQbo.address || mapped.address),
            status: mapped.status,
            qboSyncStatus: 'synced',
            qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
            'audit.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
            'audit.updatedBy': userId,
          },
        });
        updated++;
        continue;
      }

      // Tier 2: Match by name
      const nameMatch = existingByName[displayName.toLowerCase().trim()];
      if (nameMatch) {
        batchOps.push({
          type: 'update',
          ref: suppliersRef.doc(nameMatch.id),
          data: {
            'externalIds.quickbooksId': qboId,
            email: mapped.email || nameMatch.email || '',
            phone: mapped.phone || nameMatch.phone || '',
            qboSyncStatus: 'synced',
            qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
            'audit.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
            'audit.updatedBy': userId,
          },
        });
        existingByQboId[qboId] = nameMatch;
        updated++;
        continue;
      }

      // Tier 3: Create new supplier
      const code = formatSupplierCode(nextCodeNum++);
      const docRef = suppliersRef.doc();
      batchOps.push({
        type: 'set',
        ref: docRef,
        data: {
          ...mapped,
          id: docRef.id,
          code,
          audit: {
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: userId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: userId,
            version: 1,
          },
          qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      });
      created++;
    }

    // Commit in batches of 450
    for (let i = 0; i < batchOps.length; i += 450) {
      const batch = db.batch();
      const slice = batchOps.slice(i, i + 450);
      for (const op of slice) {
        if (op.type === 'set') {
          batch.set(op.ref, op.data);
        } else {
          batch.update(op.ref, op.data);
        }
      }
      await batch.commit();
      if (i + 450 < batchOps.length) await sleep(500);
    }

    await completeSyncJob(jobRef, qboVendors.length);
    console.log(`[ContactSync] Vendors: ${created} created, ${updated} updated, ${skipped} skipped`);
    return { created, updated, skipped, total: qboVendors.length };
  } catch (error) {
    console.error('[ContactSync] Vendor sync failed:', error);
    await failSyncJob(jobRef, error);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// CALLABLE: Pull Customers & Vendors from QBO
// ----------------------------------------------------------------------------

exports.syncQBOContactsToFirestore = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
  timeoutSeconds: 540,
  memory: '1GiB',
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { companyId, types } = request.data;
  if (!companyId) {
    throw new HttpsError('invalid-argument', 'companyId is required');
  }

  const userId = request.auth.uid;
  const typesToSync = types || ['customers', 'vendors'];
  const results = {};
  const errors = {};

  for (const type of typesToSync) {
    try {
      if (type === 'customers') {
        results.customers = await syncQBOCustomersToFirestore(companyId, userId);
      } else if (type === 'vendors') {
        results.vendors = await syncQBOVendorsToFirestore(companyId, userId);
      }
    } catch (error) {
      console.error(`[ContactSync] ${type} sync error:`, error);
      errors[type] = error.message;
    }
  }

  return {
    success: Object.keys(errors).length === 0,
    results,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
});
