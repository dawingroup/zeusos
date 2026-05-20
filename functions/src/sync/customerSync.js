/**
 * Customer Sync Service
 * Syncs customer data between this tool, Shopify, and QuickBooks
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');

const db = getFirestore();

/**
 * Sync customer data to Shopify
 * Creates or updates customer in Shopify based on local data
 */
async function syncCustomerToShopify(customer, shopifyConfig) {
  if (!shopifyConfig?.accessToken || !shopifyConfig?.shopDomain) {
    return { success: false, error: 'Shopify not configured' };
  }

  try {
    const customerData = {
      customer: {
        first_name: customer.name.split(' ')[0] || customer.name,
        last_name: customer.name.split(' ').slice(1).join(' ') || '',
        email: customer.email || undefined,
        phone: customer.phone || undefined,
        tags: [customer.code, customer.type, ...(customer.tags || [])].join(','),
        note: customer.notes || '',
        addresses: [],
      }
    };

    // Add billing address if exists
    if (customer.billingAddress) {
      customerData.customer.addresses.push({
        address1: customer.billingAddress.street1,
        address2: customer.billingAddress.street2 || '',
        city: customer.billingAddress.city,
        province: customer.billingAddress.state,
        zip: customer.billingAddress.postalCode,
        country: customer.billingAddress.country,
        default: true,
      });
    }

    const shopifyUrl = `https://${shopifyConfig.shopDomain}/admin/api/2024-01/customers`;
    const shopifyId = customer.externalIds?.shopifyId;

    let response;
    if (shopifyId) {
      // Update existing customer
      const numericId = shopifyId.replace(/\D/g, '');
      response = await fetch(`${shopifyUrl}/${numericId}.json`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shopifyConfig.accessToken,
        },
        body: JSON.stringify(customerData),
      });
    } else {
      // Create new customer
      response = await fetch(`${shopifyUrl}.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shopifyConfig.accessToken,
        },
        body: JSON.stringify(customerData),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return {
      success: true,
      shopifyId: `gid://shopify/Customer/${result.customer.id}`,
    };
  } catch (error) {
    console.error('Shopify sync error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sync customer data to QuickBooks
 * Creates or updates customer in QuickBooks based on local data
 */
async function syncCustomerToQuickBooks(customer, qbConfig) {
  if (!qbConfig?.accessToken || !qbConfig?.realmId) {
    return { success: false, error: 'QuickBooks not configured' };
  }

  try {
    const customerData = {
      DisplayName: customer.name,
      CompanyName: customer.type === 'commercial' ? customer.name : undefined,
      PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
      PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
      Notes: `${customer.code} | ${customer.notes || ''}`,
    };

    // Add billing address if exists
    if (customer.billingAddress) {
      customerData.BillAddr = {
        Line1: customer.billingAddress.street1,
        Line2: customer.billingAddress.street2 || '',
        City: customer.billingAddress.city,
        CountrySubDivisionCode: customer.billingAddress.state,
        PostalCode: customer.billingAddress.postalCode,
        Country: customer.billingAddress.country,
      };
    }

    const qbUrl = `https://quickbooks.api.intuit.com/v3/company/${qbConfig.realmId}/customer`;
    const qbId = customer.externalIds?.quickbooksId;

    let response;
    if (qbId) {
      // Get current sync token for update
      const getResponse = await fetch(`${qbUrl}/${qbId}?minorversion=65`, {
        headers: {
          'Authorization': `Bearer ${qbConfig.accessToken}`,
          'Accept': 'application/json',
        },
      });
      
      if (getResponse.ok) {
        const currentData = await getResponse.json();
        customerData.Id = qbId;
        customerData.SyncToken = currentData.Customer.SyncToken;
        customerData.sparse = true;
      }

      response = await fetch(`${qbUrl}?minorversion=65`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${qbConfig.accessToken}`,
        },
        body: JSON.stringify(customerData),
      });
    } else {
      // Create new customer
      response = await fetch(`${qbUrl}?minorversion=65`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${qbConfig.accessToken}`,
        },
        body: JSON.stringify(customerData),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QuickBooks API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return {
      success: true,
      quickbooksId: result.Customer.Id,
    };
  } catch (error) {
    console.error('QuickBooks sync error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sync a single customer to external platforms
 */
async function syncCustomer(customerId, platforms = ['shopify', 'quickbooks']) {
  const customerDoc = await db.collection('customers').doc(customerId).get();
  
  if (!customerDoc.exists) {
    throw new Error('Customer not found');
  }

  const customer = { id: customerDoc.id, ...customerDoc.data() };
  const results = { shopify: null, quickbooks: null };
  const updates = { syncStatus: {} };

  // Get Shopify config from existing systemConfig/shopifyConfig
  const shopifyConfigDoc = await db.doc('systemConfig/shopifyConfig').get();
  const shopifyConfig = shopifyConfigDoc.exists ? {
    accessToken: shopifyConfigDoc.data().accessToken,
    shopDomain: shopifyConfigDoc.data().shopDomain,
  } : null;
  
  // Get QuickBooks config from integrations/quickbooks (existing OAuth setup)
  const qbDoc = await db.collection('integrations').doc('quickbooks').get();
  const qbConfig = qbDoc.exists ? {
    accessToken: qbDoc.data().access_token,
    realmId: qbDoc.data().realm_id,
  } : null;

  // Sync to Shopify
  if (platforms.includes('shopify')) {
    const shopifyResult = await syncCustomerToShopify(customer, shopifyConfig);
    results.shopify = shopifyResult;
    
    updates.syncStatus.shopify = shopifyResult.success ? 'synced' : 'failed';
    updates.syncStatus.shopifyLastSync = shopifyResult.success ? FieldValue.serverTimestamp() : undefined;
    updates.syncStatus.shopifyError = shopifyResult.error || null;
    
    if (shopifyResult.shopifyId && !customer.externalIds?.shopifyId) {
      updates['externalIds.shopifyId'] = shopifyResult.shopifyId;
    }
  }

  // Sync to QuickBooks
  if (platforms.includes('quickbooks')) {
    const qbResult = await syncCustomerToQuickBooks(customer, qbConfig);
    results.quickbooks = qbResult;
    
    updates.syncStatus.quickbooks = qbResult.success ? 'synced' : 'failed';
    updates.syncStatus.quickbooksLastSync = qbResult.success ? FieldValue.serverTimestamp() : undefined;
    updates.syncStatus.quickbooksError = qbResult.error || null;
    
    if (qbResult.quickbooksId && !customer.externalIds?.quickbooksId) {
      updates['externalIds.quickbooksId'] = qbResult.quickbooksId;
    }
  }

  // Update customer with sync results
  await db.collection('customers').doc(customerId).update(updates);

  return results;
}

/**
 * Sync all customers to external platforms
 */
async function syncAllCustomers(platforms = ['shopify', 'quickbooks']) {
  const customersSnapshot = await db.collection('customers')
    .where('status', '==', 'active')
    .get();

  const results = {
    total: customersSnapshot.size,
    synced: 0,
    failed: 0,
    errors: [],
  };

  for (const doc of customersSnapshot.docs) {
    try {
      await syncCustomer(doc.id, platforms);
      results.synced++;
    } catch (error) {
      results.failed++;
      results.errors.push({ customerId: doc.id, error: error.message });
    }
  }

  return results;
}

/**
 * Callable function to sync a single customer
 */
const syncCustomerCallable = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const { customerId, platforms } = request.data;

  if (!customerId) {
    throw new HttpsError('invalid-argument', 'Customer ID is required');
  }

  try {
    const results = await syncCustomer(customerId, platforms);
    return { success: true, results };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Callable function to sync all customers
 */
const syncAllCustomersCallable = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const { platforms } = request.data || {};

  try {
    const results = await syncAllCustomers(platforms);
    return { success: true, results };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Scheduled function to sync all customers daily
 * Runs at 2:00 AM UTC every day
 */
const scheduledCustomerSync = onSchedule({
  schedule: '0 2 * * *',
  timeZone: 'UTC',
  retryCount: 3,
}, async (event) => {
  console.log('Starting scheduled customer sync...');
  
  try {
    const results = await syncAllCustomers(['shopify', 'quickbooks']);
    console.log('Customer sync completed:', results);
    
    // Log sync results
    await db.collection('syncLogs').add({
      type: 'customer_sync',
      scheduledRun: true,
      results,
      completedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Scheduled customer sync failed:', error);
    
    await db.collection('syncLogs').add({
      type: 'customer_sync',
      scheduledRun: true,
      error: error.message,
      failedAt: FieldValue.serverTimestamp(),
    });
  }
});

/**
 * Import customers FROM QuickBooks into this tool
 */
async function importCustomersFromQuickBooks(qbConfig) {
  if (!qbConfig?.accessToken || !qbConfig?.realmId) {
    return { success: false, error: 'QuickBooks not configured' };
  }

  try {
    // Query all active customers from QuickBooks
    const query = "SELECT * FROM Customer WHERE Active = true MAXRESULTS 1000";
    const qbUrl = `https://quickbooks.api.intuit.com/v3/company/${qbConfig.realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;
    
    const response = await fetch(qbUrl, {
      headers: {
        'Authorization': `Bearer ${qbConfig.accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QuickBooks API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const qbCustomers = data.QueryResponse?.Customer || [];
    
    const results = {
      total: qbCustomers.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    // Get next customer number for new imports
    const existingCustomers = await db.collection('customers').get();
    let maxNumber = 0;
    existingCustomers.docs.forEach((doc) => {
      const code = doc.data().code || '';
      const match = code.match(/DF-CUS-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    });

    for (const qbCustomer of qbCustomers) {
      try {
        // Check if customer already exists by QuickBooks ID
        const existingQuery = await db.collection('customers')
          .where('externalIds.quickbooksId', '==', qbCustomer.Id)
          .get();

        if (!existingQuery.empty) {
          // Update existing customer
          const existingDoc = existingQuery.docs[0];
          await db.collection('customers').doc(existingDoc.id).update({
            name: qbCustomer.DisplayName || qbCustomer.CompanyName || 'Unknown',
            email: qbCustomer.PrimaryEmailAddr?.Address || null,
            phone: qbCustomer.PrimaryPhone?.FreeFormNumber || null,
            billingAddress: qbCustomer.BillAddr ? {
              street1: qbCustomer.BillAddr.Line1 || '',
              street2: qbCustomer.BillAddr.Line2 || '',
              city: qbCustomer.BillAddr.City || '',
              state: qbCustomer.BillAddr.CountrySubDivisionCode || '',
              postalCode: qbCustomer.BillAddr.PostalCode || '',
              country: qbCustomer.BillAddr.Country || 'Kenya',
            } : null,
            'syncStatus.quickbooks': 'synced',
            'syncStatus.quickbooksLastSync': FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: 'quickbooks_import',
          });
          results.updated++;
        } else {
          // Create new customer
          maxNumber++;
          const customerCode = `DF-CUS-${maxNumber.toString().padStart(3, '0')}`;
          
          await db.collection('customers').add({
            code: customerCode,
            name: qbCustomer.DisplayName || qbCustomer.CompanyName || 'Unknown',
            type: qbCustomer.CompanyName ? 'commercial' : 'residential',
            status: 'active',
            email: qbCustomer.PrimaryEmailAddr?.Address || null,
            phone: qbCustomer.PrimaryPhone?.FreeFormNumber || null,
            website: qbCustomer.WebAddr?.URI || null,
            billingAddress: qbCustomer.BillAddr ? {
              street1: qbCustomer.BillAddr.Line1 || '',
              street2: qbCustomer.BillAddr.Line2 || '',
              city: qbCustomer.BillAddr.City || '',
              state: qbCustomer.BillAddr.CountrySubDivisionCode || '',
              postalCode: qbCustomer.BillAddr.PostalCode || '',
              country: qbCustomer.BillAddr.Country || 'Kenya',
            } : null,
            contacts: [],
            externalIds: {
              quickbooksId: qbCustomer.Id,
            },
            syncStatus: {
              quickbooks: 'synced',
              quickbooksLastSync: FieldValue.serverTimestamp(),
            },
            notes: qbCustomer.Notes || '',
            tags: ['imported-from-quickbooks'],
            createdAt: FieldValue.serverTimestamp(),
            createdBy: 'quickbooks_import',
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: 'quickbooks_import',
          });
          results.imported++;
        }
      } catch (err) {
        results.errors.push({ qbId: qbCustomer.Id, name: qbCustomer.DisplayName, error: err.message });
      }
    }

    return { success: true, results };
  } catch (error) {
    console.error('QuickBooks import error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Callable function to import customers from QuickBooks
 */
const importFromQuickBooksCallable = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  try {
    // Get QuickBooks config from integrations/quickbooks (existing OAuth setup)
    const qbDoc = await db.collection('integrations').doc('quickbooks').get();
    if (!qbDoc.exists) {
      throw new HttpsError('failed-precondition', 'QuickBooks is not connected. Please connect QuickBooks integration first.');
    }
    
    const qbData = qbDoc.data();
    const qbConfig = {
      accessToken: qbData.access_token,
      realmId: qbData.realm_id,
    };
    
    const result = await importCustomersFromQuickBooks(qbConfig);
    
    if (!result.success) {
      throw new HttpsError('internal', result.error);
    }
    
    // Log import results
    await db.collection('syncLogs').add({
      type: 'quickbooks_import',
      results: result.results,
      completedAt: FieldValue.serverTimestamp(),
    });
    
    return result;
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', error.message);
  }
});

module.exports = {
  syncCustomer,
  syncAllCustomers,
  syncCustomerCallable,
  syncAllCustomersCallable,
  scheduledCustomerSync,
  importFromQuickBooksCallable,
};
