/**
 * QuickBooks Sales Order Sync Service
 * Creates Sales Orders in QuickBooks from approved Client Quotes
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const { refreshTokens, TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET } = require('./auth');
const { ALLOWED_ORIGINS } = require('../../config/cors');
const { resolveOrCreateQBOItem } = require('./itemResolutionService');
const { logger } = require('firebase-functions');

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
// TAX CODE MAPPING
// ----------------------------------------------------------------------------

/**
 * Get QBO Tax Code from quote tax rate ID
 */
function getQBOTaxCode(taxRateId, config) {
  const taxMapping = config.taxCodeMapping || {};

  const taxMap = {
    'no_vat': taxMapping.noVat || 'NON',
    'exempt': taxMapping.exempt || 'NON',
    'standard_vat': taxMapping.standardVat || 'NON',
  };

  // Default to NON (out of scope) — we do not file for service tax
  return taxMap[taxRateId] || 'NON';
}

// ----------------------------------------------------------------------------
// SALES ORDER LINE ITEM MAPPING
// ----------------------------------------------------------------------------

/**
 * Map quote line items to QuickBooks Sales Order lines.
 * Uses automatic item resolution (search/create in QBO) with static mapping as fallback.
 */
async function mapQuoteLinesToSOLines(quote, config) {
  const lines = [];

  for (const item of quote.lineItems) {
    const taxCode = getQBOTaxCode(item.taxRateId, config);
    let qboItemId = null;

    // --- Try automatic item resolution ---
    try {
      // Build item info — if linked to an inventory item, fetch its details for a better name
      let itemName = item.description;
      let itemSku = null;
      let itemClassification = null;
      let inventoryItemId = item.linkedMaterialId || null;

      if (inventoryItemId) {
        const invDoc = await db.collection('inventoryItems').doc(inventoryItemId).get();
        if (invDoc.exists) {
          const invData = invDoc.data();
          itemName = invData.displayName || invData.name || item.description;
          itemSku = invData.sku || null;
          itemClassification = invData.classification || null;
        }
      }

      const resolved = await resolveOrCreateQBOItem({
        name: itemName,
        sku: itemSku,
        category: item.category,
        classification: itemClassification,
        unitPrice: item.unitPrice,
        description: item.description,
        inventoryItemId,
      }, config);

      qboItemId = resolved.qboItemId;
      console.log(`[SalesOrderSync] Resolved "${item.description}" → QBO Item ${qboItemId} (${resolved.action})`);
    } catch (resolveError) {
      console.error(`[SalesOrderSync] Item resolution failed for "${item.description}":`, resolveError.message);
      // Item will be skipped — resolveOrCreateQBOItem handles fuzzy matching and auto-creation
    }

    if (!qboItemId) {
      console.warn(`[SalesOrderSync] No QBO item for "${item.description}" (category: ${item.category}) — skipping line`);
      continue;
    }

    lines.push({
      DetailType: 'SalesItemLineDetail',
      Amount: item.totalPrice,
      Description: item.description,
      SalesItemLineDetail: {
        ItemRef: { value: qboItemId },
        Qty: item.quantity,
        UnitPrice: item.unitPrice,
      },
    });
  }

  return lines;
}

// ----------------------------------------------------------------------------
// CUSTOMER RESOLUTION (fuzzy search → exact match → create)
// ----------------------------------------------------------------------------

/**
 * Search QBO for customers whose DisplayName contains the given term.
 * Returns an array of {Id, DisplayName, CompanyName} matches.
 */
async function searchQBOCustomers(searchTerm) {
  const escaped = searchTerm.replace(/'/g, "\\'");
  const query = encodeURIComponent(
    `SELECT Id, DisplayName, CompanyName FROM Customer WHERE DisplayName LIKE '%${escaped}%' MAXRESULTS 10`
  );
  const response = await qboRequest(`/query?query=${query}`);
  return response.QueryResponse.Customer || [];
}

/**
 * Simple similarity score between two strings (case-insensitive).
 * Returns a value between 0 and 1.
 */
function nameSimilarity(a, b) {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;

  // Token-based overlap (handles "Mpande Joseph" vs "Joseph Mpande")
  const tokensA = new Set(la.split(/\s+/));
  const tokensB = new Set(lb.split(/\s+/));
  const intersection = [...tokensA].filter((t) => tokensB.has(t));
  const union = new Set([...tokensA, ...tokensB]);
  if (union.size === 0) return 0;
  return intersection.length / union.size;
}

/**
 * Resolve or create a QuickBooks customer for the given Firestore customer.
 *
 * Strategy:
 * 1. Exact DisplayName match (with customer code suffix)
 * 2. Fuzzy search by customer name — pick best match above 0.6 threshold
 * 3. Create new if no match found
 *
 * Returns the QBO Customer Id.
 */
async function resolveOrCreateQBOCustomer(firestoreCustomer) {
  const displayName = `${firestoreCustomer.name} (${firestoreCustomer.code || firestoreCustomer.id.substring(0, 6)})`;

  // 1. Try exact match by DisplayName
  const escapedDisplay = displayName.replace(/'/g, "\\'");
  const exactQuery = encodeURIComponent(
    `SELECT Id, DisplayName FROM Customer WHERE DisplayName = '${escapedDisplay}'`
  );
  const exactResult = await qboRequest(`/query?query=${exactQuery}`);
  const exactMatches = exactResult.QueryResponse.Customer || [];
  if (exactMatches.length > 0) {
    logger.info(`[CustomerResolve] Exact match: "${displayName}" → QBO ${exactMatches[0].Id}`);
    return exactMatches[0].Id;
  }

  // 2. Fuzzy search by customer name (without code suffix)
  const nameParts = firestoreCustomer.name.split(/\s+/);
  // Search using each name part to catch partial matches
  const candidates = new Map();
  for (const part of nameParts) {
    if (part.length < 3) continue; // skip very short tokens
    const results = await searchQBOCustomers(part);
    for (const c of results) {
      if (!candidates.has(c.Id)) {
        candidates.set(c.Id, c);
      }
    }
  }

  // Score candidates
  let bestMatch = null;
  let bestScore = 0;
  for (const [, candidate] of candidates) {
    // Compare against both DisplayName and CompanyName
    const scoreDisplay = nameSimilarity(firestoreCustomer.name, candidate.DisplayName || '');
    const scoreCompany = nameSimilarity(firestoreCustomer.name, candidate.CompanyName || '');
    const score = Math.max(scoreDisplay, scoreCompany);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  if (bestMatch && bestScore >= 0.6) {
    logger.info(
      `[CustomerResolve] Fuzzy match: "${firestoreCustomer.name}" → "${bestMatch.DisplayName}" (QBO ${bestMatch.Id}, score: ${bestScore.toFixed(2)})`
    );
    return bestMatch.Id;
  }

  // 3. No match — create new customer
  logger.info(`[CustomerResolve] No match for "${firestoreCustomer.name}" — creating new QBO customer`);
  const qboPayload = {
    DisplayName: displayName,
    CompanyName: firestoreCustomer.name,
  };
  if (firestoreCustomer.email) {
    qboPayload.PrimaryEmailAddr = { Address: firestoreCustomer.email };
  }
  if (firestoreCustomer.phone) {
    qboPayload.PrimaryPhone = { FreeFormNumber: firestoreCustomer.phone };
  }
  if (firestoreCustomer.billingAddress) {
    qboPayload.BillAddr = {
      Line1: firestoreCustomer.billingAddress.street1,
      Line2: firestoreCustomer.billingAddress.street2,
      City: firestoreCustomer.billingAddress.city,
      CountrySubDivisionCode: firestoreCustomer.billingAddress.state,
      PostalCode: firestoreCustomer.billingAddress.postalCode,
      Country: firestoreCustomer.billingAddress.country,
    };
  }

  const created = await qboRequest('/customer', {
    method: 'POST',
    body: JSON.stringify(qboPayload),
  });

  logger.info(`[CustomerResolve] Created QBO customer: ${created.Customer.Id} - "${displayName}"`);
  return created.Customer.Id;
}

// ----------------------------------------------------------------------------
// LINKED SALES ORDER LOOKUP
// ----------------------------------------------------------------------------

/**
 * Find the DawinOS Sales Order document linked to a given quote.
 * Returns null if no SO exists for this quote.
 */
async function findLinkedSalesOrder(quoteId) {
  const soQuery = await db.collection('salesOrders')
    .where('quoteId', '==', quoteId)
    .limit(1)
    .get();
  if (soQuery.empty) return null;
  return { id: soQuery.docs[0].id, ...soQuery.docs[0].data() };
}

// ----------------------------------------------------------------------------
// SALES ORDER CREATION
// ----------------------------------------------------------------------------

/**
 * Create Sales Order in QuickBooks from Client Quote.
 * Also propagates sync status to the linked Sales Order document (if one exists)
 * so the sync badge works from the SO detail page, MO closeout, or any other entry point.
 */
async function createSalesOrderFromQuote(quoteId) {
  console.log(`[SalesOrderSync] Creating sales order for quote ${quoteId}`);

  // 1. Fetch Quote
  const quoteDoc = await db.collection('clientQuotes').doc(quoteId).get();
  if (!quoteDoc.exists) {
    throw new Error(`Client Quote ${quoteId} not found`);
  }

  const quote = { id: quoteDoc.id, ...quoteDoc.data() };

  // 1b. Find linked Sales Order (for idempotency check & write-back)
  const linkedSO = await findLinkedSalesOrder(quoteId);

  // 2. Check if already synced (quote or linked SO)
  if (quote.qboSalesOrderId) {
    console.log(`[SalesOrderSync] Quote ${quoteId} already has sales order ${quote.qboSalesOrderId}`);
    return {
      action: 'skipped',
      reason: 'already_synced',
      qboSalesOrderId: quote.qboSalesOrderId
    };
  }

  if (linkedSO?.qboSalesOrderId) {
    logger.info(`[SalesOrderSync] Linked SO ${linkedSO.id} already synced to QBO ${linkedSO.qboSalesOrderId}`);
    return {
      action: 'skipped',
      reason: 'already_synced',
      qboSalesOrderId: linkedSO.qboSalesOrderId,
      qboSalesOrderDocNumber: linkedSO.qboSalesOrderDocNumber || '',
    };
  }

  // 3. Resolve customer — auto-sync to QuickBooks if needed
  if (!quote.customerId) {
    throw new Error(`Quote ${quoteId} has no customerId`);
  }

  const customerDoc = await db.collection('customers').doc(quote.customerId).get();
  if (!customerDoc.exists) {
    throw new Error(`Customer ${quote.customerId} not found`);
  }

  const customer = { id: customerDoc.id, ...customerDoc.data() };

  // Auto-sync customer if not yet linked to QBO
  if (!customer.externalIds?.quickbooksId) {
    logger.info(`[SalesOrderSync] Customer "${customer.name}" not synced — auto-syncing to QuickBooks`);

    const qboCustomerId = await resolveOrCreateQBOCustomer(customer);

    // Persist the QBO ID back to Firestore
    await db.collection('customers').doc(quote.customerId).update({
      'externalIds.quickbooksId': qboCustomerId,
      'syncStatus.quickbooks': 'synced',
      'syncStatus.quickbooksLastSync': admin.firestore.FieldValue.serverTimestamp(),
    });

    customer.externalIds = { ...(customer.externalIds || {}), quickbooksId: qboCustomerId };
    logger.info(`[SalesOrderSync] Customer "${customer.name}" synced to QBO ID ${qboCustomerId}`);
  }

  // 4. Fetch QBO config
  const configDoc = await db.collection('integrations').doc('quickbooks_config').get();
  if (!configDoc.exists || !configDoc.data().isConfigured) {
    throw new Error(
      'QuickBooks account mapping not configured. Please configure account mappings first.'
    );
  }

  const config = configDoc.data();

  // 5. Map line items to Sales Order lines (async: resolves/creates QBO items)
  const soLines = await mapQuoteLinesToSOLines(quote, config);

  if (soLines.length === 0) {
    throw new Error('No line items could be resolved to QuickBooks items. Please check account mappings and ensure inventory items are configured.');
  }

  // 6. Build Estimate object (QBO Estimate = DawinOS Sales Order)
  // Note: QBO Sales Orders are only available in Plus/Advanced subscriptions.
  // Estimates are universally supported and serve the same commercial purpose.
  const txnDate = quote.respondedAt
    ? admin.firestore.Timestamp.fromDate(new Date(quote.respondedAt.toDate())).toDate().toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const estimatePayload = {
    CustomerRef: { value: customer.externalIds.quickbooksId },
    TxnDate: txnDate,
    Line: soLines,
    GlobalTaxCalculation: 'NotApplicable',
    PrivateNote: `DawinOS Quote: ${quote.quoteNumber} - Project: ${quote.projectName}`,
    // Mark as Accepted since we only sync confirmed/approved quotes
    TxnStatus: 'Accepted',
  };

  // Add payment terms if available
  if (quote.paymentTerms) {
    estimatePayload.PrivateNote += ` | Payment Terms: ${quote.paymentTerms}`;
  }

  // 7. Create Estimate in QuickBooks
  try {
    console.log('[SalesOrderSync] Creating estimate in QuickBooks:', JSON.stringify(estimatePayload, null, 2));
    const response = await qboRequest('/estimate', {
      method: 'POST',
      body: JSON.stringify(estimatePayload),
    });

    const salesOrder = response.Estimate;
    console.log(`[SalesOrderSync] Estimate created: ${salesOrder.Id} - Doc #${salesOrder.DocNumber}`);

    // 8. Update Quote with sales order information
    await db.collection('clientQuotes').doc(quoteId).update({
      qboSalesOrderId: salesOrder.Id,
      qboSalesOrderDocNumber: salesOrder.DocNumber || '',
      qboSyncStatus: 'synced',
      qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      qboSyncError: admin.firestore.FieldValue.delete(),
    });

    // 9. Also update linked Sales Order document (if it exists)
    if (linkedSO) {
      logger.info(`[SalesOrderSync] Propagating sync status to SO ${linkedSO.id}`);
      await db.collection('salesOrders').doc(linkedSO.id).update({
        qboSalesOrderId: salesOrder.Id,
        qboSalesOrderDocNumber: salesOrder.DocNumber || '',
        qboSyncStatus: 'synced',
        qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
        qboSyncError: admin.firestore.FieldValue.delete(),
      });
    }

    return {
      action: 'created',
      qboSalesOrderId: salesOrder.Id,
      qboSalesOrderDocNumber: salesOrder.DocNumber || '',
    };
  } catch (error) {
    console.error(`[SalesOrderSync] Error creating sales order for quote ${quoteId}:`, error);

    // Update Quote with error
    await db.collection('clientQuotes').doc(quoteId).update({
      qboSyncStatus: 'error',
      qboSyncError: error.message || 'Unknown error creating sales order',
      qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Also update linked Sales Order with error status
    if (linkedSO) {
      await db.collection('salesOrders').doc(linkedSO.id).update({
        qboSyncStatus: 'error',
        qboSyncError: error.message || 'Unknown error creating sales order',
        qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    throw error;
  }
}

// ----------------------------------------------------------------------------
// CALLABLE FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Manual sales order sync (callable from UI)
 */
exports.syncQuoteToSalesOrder = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { quoteId } = request.data;
  if (!quoteId) {
    throw new HttpsError('invalid-argument', 'quoteId is required');
  }

  try {
    const result = await createSalesOrderFromQuote(quoteId);
    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error('[SalesOrderSync] Manual sync failed:', error);
    throw new HttpsError('internal', error.message || 'Failed to create sales order in QuickBooks');
  }
});

/**
 * Bulk sales order sync for multiple quotes
 */
exports.syncMultipleQuotesToSalesOrders = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
  timeoutSeconds: 540, // 9 minutes for bulk operations
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { quoteIds } = request.data;
  if (!quoteIds || !Array.isArray(quoteIds)) {
    throw new HttpsError('invalid-argument', 'quoteIds array is required');
  }

  const results = [];
  const errors = [];

  for (const quoteId of quoteIds) {
    try {
      const result = await createSalesOrderFromQuote(quoteId);
      results.push({ quoteId, ...result });
    } catch (error) {
      errors.push({ quoteId, error: error.message });
    }
  }

  return {
    success: errors.length === 0,
    synced: results.length,
    failed: errors.length,
    results,
    errors,
  };
});

// Export core functions for use by triggers and other modules
exports.createSalesOrderFromQuote = createSalesOrderFromQuote;
exports.resolveOrCreateQBOCustomer = resolveOrCreateQBOCustomer;
