/**
 * QuickBooks Customer Sync Service
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const { refreshTokens, TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET } = require('./auth');
const { ALLOWED_ORIGINS } = require('../../config/cors');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const QBO_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';

async function qboRequest(endpoint, options = {}) {
  const tokens = await refreshTokens(TOKEN_ENCRYPTION_KEY.value());

  const response = await fetch(
    `${QBO_API_BASE}/${tokens.realm_id}${endpoint}`,
    {
      ...options,
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QuickBooks API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Find QuickBooks customer by display name (exact match)
 */
async function findQBOCustomer(displayName) {
  // Use simple query escaping for single quotes
  const escapedName = displayName.replace(/'/g, "\\'");
  const query = encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${escapedName}'`);
  const response = await qboRequest(`/query?query=${query}`);

  const customers = response.QueryResponse.Customer || [];
  return customers[0] || null;
}

/**
 * Find QuickBooks customer by company name (fuzzy — searches CompanyName)
 */
async function findQBOCustomerByCompanyName(companyName) {
  const escapedName = companyName.replace(/'/g, "\\'");
  const query = encodeURIComponent(`SELECT * FROM Customer WHERE CompanyName = '${escapedName}'`);
  const response = await qboRequest(`/query?query=${query}`);

  const customers = response.QueryResponse.Customer || [];
  return customers[0] || null;
}

/**
 * Find QuickBooks customer by email
 */
async function findQBOCustomerByEmail(email) {
  if (!email) return null;
  const escapedEmail = email.replace(/'/g, "\\'");
  const query = encodeURIComponent(`SELECT * FROM Customer WHERE PrimaryEmailAddr = '${escapedEmail}'`);
  const response = await qboRequest(`/query?query=${query}`);

  const customers = response.QueryResponse.Customer || [];
  return customers[0] || null;
}

/**
 * Search QBO customers by partial name (LIKE query)
 */
async function searchQBOCustomerByName(name) {
  if (!name) return null;
  const escapedName = name.replace(/'/g, "\\'");
  const query = encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName LIKE '%${escapedName}%'`);
  const response = await qboRequest(`/query?query=${query}`);

  const customers = response.QueryResponse.Customer || [];
  return customers[0] || null;
}

/**
 * Create customer in QuickBooks
 */
async function createQBOCustomer(customer) {
  const response = await qboRequest('/customer', {
    method: 'POST',
    body: JSON.stringify(customer),
  });
  return response.Customer;
}

/**
 * Update customer in QuickBooks
 */
async function updateQBOCustomer(customer) {
  // QuickBooks requires SyncToken for updates. We need to fetch the latest version first.
  const existing = await qboRequest(`/customer/${customer.Id}`);

  const response = await qboRequest('/customer', {
    method: 'POST',
    body: JSON.stringify({
      ...customer,
      SyncToken: existing.Customer.MetaData?.LastUpdatedTime || existing.Customer.SyncToken,
      sparse: true,
    }),
  });
  return response.Customer;
}

/**
 * Convert Firestore customer to QuickBooks format
 */
function toQBOCustomer(firestoreCustomer) {
  const qboCustomer = {
    DisplayName: `${firestoreCustomer.name} (${firestoreCustomer.code})`,
    CompanyName: firestoreCustomer.name,
  };

  if (firestoreCustomer.email) {
    qboCustomer.PrimaryEmailAddr = { Address: firestoreCustomer.email };
  }

  if (firestoreCustomer.phone) {
    qboCustomer.PrimaryPhone = { FreeFormNumber: firestoreCustomer.phone };
  }

  if (firestoreCustomer.billingAddress) {
    qboCustomer.BillAddr = {
      Line1: firestoreCustomer.billingAddress.street1,
      Line2: firestoreCustomer.billingAddress.street2,
      City: firestoreCustomer.billingAddress.city,
      CountrySubDivisionCode: firestoreCustomer.billingAddress.state,
      PostalCode: firestoreCustomer.billingAddress.postalCode,
      Country: firestoreCustomer.billingAddress.country,
    };
  }

  return qboCustomer;
}

// ----------------------------------------------------------------------------
// REUSABLE SYNC FUNCTION (for use by other services like invoiceSync)
// Mirrors vendorSync.syncSupplierToQBO pattern
// ----------------------------------------------------------------------------

/**
 * Sync a Firestore customer to QuickBooks.
 * Searches QBO for existing customer by:
 *   1. DisplayName (exact match — "Name (Code)")
 *   2. CompanyName (exact match)
 *   3. Email (exact match)
 *   4. DisplayName LIKE search (partial name match)
 * If found, links the existing QBO customer. Otherwise creates a new one.
 * Updates Firestore with the quickbooksId.
 *
 * @param {string} customerId - Firestore customer document ID
 * @returns {{ action: 'linked'|'created'|'updated', qboId: string }}
 */
async function syncCustomerToQBO(customerId) {
  const customerDoc = await db.collection('customers').doc(customerId).get();
  if (!customerDoc.exists) {
    throw new Error(`Customer ${customerId} not found`);
  }

  const customer = { id: customerDoc.id, ...customerDoc.data() };

  try {
    const existingQboId = customer.externalIds?.quickbooksId;

    if (existingQboId) {
      // Update existing QBO customer
      console.log(`[CustomerSync] Updating existing QBO customer ${existingQboId}`);
      const qboCustomer = toQBOCustomer(customer);
      qboCustomer.Id = existingQboId;
      const updated = await updateQBOCustomer(qboCustomer);

      await db.collection('customers').doc(customerId).update({
        'externalIds.quickbooksId': updated.Id,
        'syncStatus.quickbooks': 'synced',
        'syncStatus.quickbooksLastSync': admin.firestore.FieldValue.serverTimestamp(),
      });

      return { action: 'updated', qboId: updated.Id };
    }

    // Search for existing customer in QBO (multi-strategy, like vendorSync)
    const qboCustomer = toQBOCustomer(customer);
    let existingCustomer = null;

    // Strategy 1: Exact DisplayName match (e.g. "Acme Corp (ACM)")
    existingCustomer = await findQBOCustomer(qboCustomer.DisplayName);
    if (existingCustomer) {
      console.log(`[CustomerSync] Found QBO customer by DisplayName "${qboCustomer.DisplayName}" → ID ${existingCustomer.Id}`);
    }

    // Strategy 2: CompanyName match (e.g. "Acme Corp")
    if (!existingCustomer && customer.name) {
      existingCustomer = await findQBOCustomerByCompanyName(customer.name);
      if (existingCustomer) {
        console.log(`[CustomerSync] Found QBO customer by CompanyName "${customer.name}" → ID ${existingCustomer.Id}`);
      }
    }

    // Strategy 3: Email match
    if (!existingCustomer && customer.email) {
      existingCustomer = await findQBOCustomerByEmail(customer.email);
      if (existingCustomer) {
        console.log(`[CustomerSync] Found QBO customer by email "${customer.email}" → ID ${existingCustomer.Id}`);
      }
    }

    // Strategy 4: Partial name search (LIKE)
    if (!existingCustomer && customer.name) {
      existingCustomer = await searchQBOCustomerByName(customer.name);
      if (existingCustomer) {
        console.log(`[CustomerSync] Found QBO customer by name search "${customer.name}" → ID ${existingCustomer.Id} ("${existingCustomer.DisplayName}")`);
      }
    }

    if (existingCustomer) {
      // Link existing QBO customer to Firestore
      console.log(`[CustomerSync] Linking customer "${customer.name}" to existing QBO customer ${existingCustomer.Id}`);

      await db.collection('customers').doc(customerId).update({
        'externalIds.quickbooksId': existingCustomer.Id,
        'syncStatus.quickbooks': 'synced',
        'syncStatus.quickbooksLastSync': admin.firestore.FieldValue.serverTimestamp(),
      });

      return { action: 'linked', qboId: existingCustomer.Id };
    }

    // No match found — create new customer in QBO
    console.log(`[CustomerSync] No match found in QBO for "${customer.name}" — creating new customer`);
    const created = await createQBOCustomer(qboCustomer);

    await db.collection('customers').doc(customerId).update({
      'externalIds.quickbooksId': created.Id,
      'syncStatus.quickbooks': 'synced',
      'syncStatus.quickbooksLastSync': admin.firestore.FieldValue.serverTimestamp(),
    });

    return { action: 'created', qboId: created.Id };
  } catch (error) {
    console.error(`[CustomerSync] Failed to sync customer ${customerId} ("${customer.name}"):`, error);

    await db.collection('customers').doc(customerId).update({
      'syncStatus.quickbooks': 'failed',
      'syncStatus.quickbooksError': error.message || 'Unknown error',
    });

    throw error;
  }
}

// Export for use by other services (e.g. invoiceSync)
exports.syncCustomerToQBO = syncCustomerToQBO;

/**
 * Sync customer to QuickBooks on create
 */
exports.onCustomerCreatedQBO = onDocumentCreated({
  document: 'customers/{customerId}',
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (event) => {
    const customerId = event.params.customerId;
    const customer = event.data.data();

    if (!customer) return;

    // Check if QuickBooks is connected
    const integrationDoc = await db.collection('integrations').doc('quickbooks').get();
    if (!integrationDoc.exists) {
      console.log('QuickBooks not connected, skipping sync');
      return;
    }

    console.log(`Syncing customer ${customerId} to QuickBooks`);

    try {
      const qboCustomer = toQBOCustomer(customer);

      // Check if customer exists in QBO
      const existing = await findQBOCustomer(qboCustomer.DisplayName);

      let qboId;
      if (existing) {
        qboId = existing.Id;
        console.log(`Found existing QuickBooks customer: ${qboId}`);
      } else {
        const created = await createQBOCustomer(qboCustomer);
        qboId = created.Id;
        console.log(`Created QuickBooks customer: ${qboId}`);
      }

      // Update Firestore with QuickBooks ID
      await db.collection('customers').doc(customerId).update({
        'externalIds.quickbooksId': qboId,
        'syncStatus.quickbooks': 'synced',
        'syncStatus.quickbooksLastSync': admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error(`Failed to sync customer ${customerId} to QuickBooks:`, error);
      await db.collection('customers').doc(customerId).update({
        'syncStatus.quickbooks': 'failed',
        'syncStatus.quickbooksError': error.message || 'Unknown error',
      });
    }
});

/**
 * Manual sync callable function
 */
exports.syncCustomerToQuickBooks = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { customerId } = request.data;
    const customerDoc = await db.collection('customers').doc(customerId).get();
    if (!customerDoc.exists) {
      throw new HttpsError('not-found', 'Customer not found');
    }

    const customer = customerDoc.data();

    try {
      const qboCustomer = toQBOCustomer(customer);
      let qboId = customer.externalIds?.quickbooksId;

      if (qboId) {
        // Update existing
        qboCustomer.Id = qboId;
        await updateQBOCustomer(qboCustomer);
      } else {
        // Create or find
        const existing = await findQBOCustomer(qboCustomer.DisplayName);
        if (existing) {
          qboId = existing.Id;
        } else {
          const created = await createQBOCustomer(qboCustomer);
          qboId = created.Id;
        }

        await db.collection('customers').doc(customerId).update({
          'externalIds.quickbooksId': qboId,
        });
      }

      await db.collection('customers').doc(customerId).update({
        'syncStatus.quickbooks': 'synced',
        'syncStatus.quickbooksLastSync': admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, quickbooksId: qboId };
    } catch (error) {
      throw new HttpsError(
        'internal',
        error.message || 'Failed to sync to QuickBooks'
      );
    }
});
