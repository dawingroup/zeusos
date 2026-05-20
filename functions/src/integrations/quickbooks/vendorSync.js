/**
 * QuickBooks Vendor Sync Service
 * Bidirectional sync between DawinOS suppliers and QuickBooks vendors
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
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
// HELPER: Authenticated QBO API Request
// ----------------------------------------------------------------------------

async function qboRequest(endpoint, options = {}) {
  const tokens = await refreshTokens(TOKEN_ENCRYPTION_KEY.value());

  const url = `${QBO_API_BASE}/${tokens.realm_id}${endpoint}`;
  console.log('QBO API Request:', url);

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QuickBooks API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// ----------------------------------------------------------------------------
// VENDOR SEARCH & MATCH
// ----------------------------------------------------------------------------

/**
 * Find QuickBooks vendor by display name (exact match)
 */
async function findQBOVendorByName(displayName) {
  const escapedName = displayName.replace(/'/g, "\\'");
  const query = encodeURIComponent(`SELECT * FROM Vendor WHERE DisplayName = '${escapedName}'`);

  try {
    const response = await qboRequest(`/query?query=${query}`);
    const vendors = response.QueryResponse?.Vendor || [];
    return vendors[0] || null;
  } catch (error) {
    console.error('[VendorSync] Error finding vendor by name:', error);
    return null;
  }
}

/**
 * Find QuickBooks vendor by email or phone (fuzzy match)
 */
async function findQBOVendorByContact(email, phone) {
  try {
    // Try email first
    if (email) {
      const emailQuery = encodeURIComponent(
        `SELECT * FROM Vendor WHERE PrimaryEmailAddr = '${email.replace(/'/g, "\\'")}'`
      );
      const response = await qboRequest(`/query?query=${emailQuery}`);
      const vendors = response.QueryResponse?.Vendor || [];
      if (vendors.length > 0) return vendors[0];
    }

    // Try phone if email didn't match
    if (phone) {
      const phoneQuery = encodeURIComponent(
        `SELECT * FROM Vendor WHERE PrimaryPhone = '${phone.replace(/'/g, "\\'")}'`
      );
      const response = await qboRequest(`/query?query=${phoneQuery}`);
      const vendors = response.QueryResponse?.Vendor || [];
      if (vendors.length > 0) return vendors[0];
    }

    return null;
  } catch (error) {
    console.error('[VendorSync] Error finding vendor by contact:', error);
    return null;
  }
}

// ----------------------------------------------------------------------------
// VENDOR CREATE & UPDATE
// ----------------------------------------------------------------------------

/**
 * Create vendor in QuickBooks
 */
async function createQBOVendor(vendor) {
  const response = await qboRequest('/vendor', {
    method: 'POST',
    body: JSON.stringify(vendor),
  });
  return response.Vendor;
}

/**
 * Update vendor in QuickBooks
 */
async function updateQBOVendor(vendor) {
  // QuickBooks requires SyncToken for updates - fetch latest version first
  const existing = await qboRequest(`/vendor/${vendor.Id}`);

  const response = await qboRequest('/vendor', {
    method: 'POST',
    body: JSON.stringify({
      ...vendor,
      SyncToken: existing.Vendor.SyncToken,
      sparse: true, // Only update provided fields
    }),
  });
  return response.Vendor;
}

// ----------------------------------------------------------------------------
// DATA TRANSFORMATION
// ----------------------------------------------------------------------------

/**
 * Map country names / codes to QBO currency codes.
 * QBO uses ISO 4217 currency codes. When a vendor is created with a foreign
 * currency, all bills for that vendor must use that currency.
 */
const COUNTRY_TO_CURRENCY = {
  'uganda': 'UGX',
  'ug': 'UGX',
  'united states': 'USD',
  'us': 'USD',
  'usa': 'USD',
  'united kingdom': 'GBP',
  'uk': 'GBP',
  'gb': 'GBP',
  'uae': 'AED',
  'united arab emirates': 'AED',
  'china': 'CNY',
  'cn': 'CNY',
  'kenya': 'KES',
  'ke': 'KES',
  'south africa': 'ZAR',
  'za': 'ZAR',
  'germany': 'EUR',
  'de': 'EUR',
  'france': 'EUR',
  'fr': 'EUR',
  'italy': 'EUR',
  'it': 'EUR',
  'spain': 'EUR',
  'es': 'EUR',
  'netherlands': 'EUR',
  'nl': 'EUR',
  'belgium': 'EUR',
  'be': 'EUR',
  'portugal': 'EUR',
  'pt': 'EUR',
  'austria': 'EUR',
  'at': 'EUR',
  'ireland': 'EUR',
  'ie': 'EUR',
  'india': 'INR',
  'in': 'INR',
  'japan': 'JPY',
  'jp': 'JPY',
  'turkey': 'TRY',
  'tr': 'TRY',
  'egypt': 'EGP',
  'eg': 'EGP',
  'tanzania': 'TZS',
  'tz': 'TZS',
  'rwanda': 'RWF',
  'rw': 'RWF',
  'nigeria': 'NGN',
  'ng': 'NGN',
};

/** Home currency — vendors in Uganda default to this. */
const HOME_CURRENCY = 'UGX';

/**
 * Resolve the QBO currency for a supplier based on their country.
 * Returns null for domestic suppliers (QBO uses home currency by default).
 */
function resolveVendorCurrency(supplier) {
  const country = (supplier.address?.country || '').toLowerCase().trim();
  if (!country) return null;

  const currency = COUNTRY_TO_CURRENCY[country];
  if (!currency || currency === HOME_CURRENCY) return null; // Domestic — no need to set

  return currency;
}

/**
 * Convert DawinOS supplier to QuickBooks vendor format
 */
function toQBOVendor(supplier) {
  const qboVendor = {
    DisplayName: supplier.name,
    CompanyName: supplier.name,
  };

  // Contact information
  if (supplier.email) {
    qboVendor.PrimaryEmailAddr = { Address: supplier.email };
  }

  if (supplier.phone) {
    qboVendor.PrimaryPhone = { FreeFormNumber: supplier.phone };
  }

  // Address (if available)
  if (supplier.address) {
    qboVendor.BillAddr = {
      Line1: supplier.address.street || supplier.address.line1 || '',
      City: supplier.address.city || '',
      CountrySubDivisionCode: supplier.address.state || supplier.address.region || '',
      PostalCode: supplier.address.postalCode || '',
      Country: supplier.address.country || '',
    };
  }

  // Currency — set foreign currency for non-Ugandan suppliers
  const vendorCurrency = resolveVendorCurrency(supplier);
  if (vendorCurrency) {
    qboVendor.CurrencyRef = { value: vendorCurrency };
    console.log(`[VendorSync] Setting vendor currency to ${vendorCurrency} for "${supplier.name}" (country: ${supplier.address?.country})`);
  }

  // Payment terms (if available)
  if (supplier.paymentTermsDays) {
    // Map common payment terms to QBO TermsRef
    // QuickBooks uses predefined terms like "Net 15", "Net 30", etc.
    const termsMap = {
      15: 'Net 15',
      30: 'Net 30',
      45: 'Net 45',
      60: 'Net 60',
    };
    const termsName = termsMap[supplier.paymentTermsDays] || 'Net 30';
    qboVendor.TermRef = { name: termsName };
  }

  // Notes
  if (supplier.notes) {
    qboVendor.Notes = supplier.notes;
  }

  return qboVendor;
}

// ----------------------------------------------------------------------------
// SYNC FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Sync a single supplier to QuickBooks
 */
async function syncSupplierToQBO(supplierId) {
  const supplierDoc = await db.collection('platform').doc('suppliers').collection('records').doc(supplierId).get();

  if (!supplierDoc.exists) {
    throw new Error(`Supplier ${supplierId} not found`);
  }

  const supplier = { id: supplierDoc.id, ...supplierDoc.data() };

  try {
    // Check if already synced
    const existingQboId = supplier.externalIds?.quickbooksId;

    if (existingQboId) {
      // Update existing vendor
      console.log(`[VendorSync] Updating existing QBO vendor ${existingQboId}`);
      const qboVendor = toQBOVendor(supplier);
      qboVendor.Id = existingQboId;

      const updated = await updateQBOVendor(qboVendor);

      await db.collection('platform').doc('suppliers').collection('records').doc(supplierId).update({
        'externalIds.quickbooksId': updated.Id,
        qboSyncStatus: 'synced',
        qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
        qboSyncError: admin.firestore.FieldValue.delete(),
      });

      return { action: 'updated', qboId: updated.Id };
    } else {
      // Try to find existing vendor by name or contact info
      let existingVendor = await findQBOVendorByName(supplier.name);

      if (!existingVendor) {
        existingVendor = await findQBOVendorByContact(supplier.email, supplier.phone);
      }

      if (existingVendor) {
        // Link to existing vendor
        console.log(`[VendorSync] Linking to existing QBO vendor ${existingVendor.Id}`);

        await db.collection('platform').doc('suppliers').collection('records').doc(supplierId).update({
          'externalIds.quickbooksId': existingVendor.Id,
          qboSyncStatus: 'synced',
          qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
          qboSyncError: admin.firestore.FieldValue.delete(),
        });

        return { action: 'linked', qboId: existingVendor.Id };
      } else {
        // Create new vendor
        console.log(`[VendorSync] Creating new QBO vendor for ${supplier.name}`);
        const qboVendor = toQBOVendor(supplier);
        const created = await createQBOVendor(qboVendor);

        await db.collection('platform').doc('suppliers').collection('records').doc(supplierId).update({
          'externalIds.quickbooksId': created.Id,
          qboSyncStatus: 'synced',
          qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
          qboSyncError: admin.firestore.FieldValue.delete(),
        });

        return { action: 'created', qboId: created.Id };
      }
    }
  } catch (error) {
    console.error(`[VendorSync] Error syncing supplier ${supplierId}:`, error);

    await db.collection('platform').doc('suppliers').collection('records').doc(supplierId).update({
      qboSyncStatus: 'error',
      qboSyncError: error.message || 'Unknown sync error',
      qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    throw error;
  }
}

// ----------------------------------------------------------------------------
// CALLABLE FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Manual vendor sync (callable from UI)
 */
exports.syncSupplierToQuickBooks = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { supplierId } = request.data;
  if (!supplierId) {
    throw new HttpsError('invalid-argument', 'supplierId is required');
  }

  try {
    const result = await syncSupplierToQBO(supplierId);
    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error('[VendorSync] Manual sync failed:', error);
    throw new HttpsError('internal', error.message || 'Failed to sync supplier to QuickBooks');
  }
});

/**
 * Bulk vendor sync (callable from UI)
 */
exports.syncAllSuppliersToQuickBooks = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
  timeoutSeconds: 540, // 9 minutes for bulk operations
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    // Get all suppliers without quickbooksId
    const suppliersSnapshot = await db.collection('platform').doc('suppliers').collection('records')
      .where('externalIds.quickbooksId', '==', null)
      .get();

    const results = [];
    const errors = [];

    for (const doc of suppliersSnapshot.docs) {
      try {
        const result = await syncSupplierToQBO(doc.id);
        results.push({ supplierId: doc.id, ...result });
      } catch (error) {
        errors.push({ supplierId: doc.id, error: error.message });
      }
    }

    return {
      success: errors.length === 0,
      synced: results.length,
      failed: errors.length,
      results,
      errors,
    };
  } catch (error) {
    console.error('[VendorSync] Bulk sync failed:', error);
    throw new HttpsError('internal', error.message || 'Failed to bulk sync suppliers');
  }
});

// ----------------------------------------------------------------------------
// FIRESTORE TRIGGERS
// ----------------------------------------------------------------------------

/**
 * Auto-sync when a new supplier is created
 */
exports.onSupplierCreated = onDocumentCreated({
  document: 'suppliers/{supplierId}',
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (event) => {
  const supplierId = event.params.supplierId;
  const supplier = event.data.data();

  console.log(`[VendorSync] New supplier created: ${supplierId} - ${supplier.name}`);

  // Check if QuickBooks is connected
  const qbDoc = await db.collection('integrations').doc('quickbooks').get();
  if (!qbDoc.exists) {
    console.log('[VendorSync] QuickBooks not connected, skipping auto-sync');
    return;
  }

  try {
    await syncSupplierToQBO(supplierId);
    console.log(`[VendorSync] Successfully synced supplier ${supplierId} to QuickBooks`);
  } catch (error) {
    console.error(`[VendorSync] Failed to auto-sync supplier ${supplierId}:`, error);
    // Don't throw - allow supplier creation to succeed even if sync fails
  }
});

/**
 * Auto-sync when a supplier is updated
 */
exports.onSupplierUpdated = onDocumentUpdated({
  document: 'suppliers/{supplierId}',
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (event) => {
  const supplierId = event.params.supplierId;
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();

  // Only sync if relevant fields changed
  const relevantFields = ['name', 'email', 'phone', 'address', 'paymentTermsDays', 'notes'];
  const hasRelevantChanges = relevantFields.some(
    field => JSON.stringify(beforeData[field]) !== JSON.stringify(afterData[field])
  );

  if (!hasRelevantChanges) {
    console.log(`[VendorSync] No relevant changes for supplier ${supplierId}, skipping sync`);
    return;
  }

  // Only sync if already linked to QuickBooks
  if (!afterData.externalIds?.quickbooksId) {
    console.log(`[VendorSync] Supplier ${supplierId} not linked to QuickBooks, skipping sync`);
    return;
  }

  console.log(`[VendorSync] Supplier updated: ${supplierId} - ${afterData.name}`);

  try {
    await syncSupplierToQBO(supplierId);
    console.log(`[VendorSync] Successfully updated vendor in QuickBooks`);
  } catch (error) {
    console.error(`[VendorSync] Failed to sync supplier update:`, error);
    // Don't throw - allow update to succeed even if sync fails
  }
});

// Export sync function for use by other services
exports.syncSupplierToQBO = syncSupplierToQBO;
