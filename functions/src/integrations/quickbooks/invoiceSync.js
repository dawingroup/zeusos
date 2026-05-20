/**
 * QuickBooks Invoice Sync Service
 * Creates Invoices in QuickBooks from Sales Orders when Manufacturing completes
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const { refreshTokens, TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET } = require('./auth');
const { ALLOWED_ORIGINS } = require('../../config/cors');
const { resolveOrCreateQBOItem, resolveRevenueAccount } = require('./itemResolutionService');
const { syncCustomerToQBO } = require('./customerSync');
const { resolveOrCreateQBOCustomer } = require('./salesOrderSync');
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
// INVOICE CREATION FROM SALES ORDER
// ----------------------------------------------------------------------------

/**
 * Create Invoice in QuickBooks from Sales Order (triggered by MO completion)
 */
async function createInvoiceFromSalesOrder(moId, quoteId) {
  console.log(`[InvoiceSync] Creating invoice for MO ${moId} and Quote ${quoteId}`);

  // 1. Fetch Manufacturing Order
  const moDoc = await db.collection('manufacturingOrders').doc(moId).get();
  if (!moDoc.exists) {
    throw new Error(`Manufacturing Order ${moId} not found`);
  }

  const mo = { id: moDoc.id, ...moDoc.data() };

  // 2. Fetch Quote
  const quoteDoc = await db.collection('clientQuotes').doc(quoteId).get();
  if (!quoteDoc.exists) {
    throw new Error(`Client Quote ${quoteId} not found`);
  }

  const quote = { id: quoteDoc.id, ...quoteDoc.data() };

  // 3. Check if invoice already created
  if (quote.qboInvoiceId) {
    console.log(`[InvoiceSync] Quote ${quoteId} already has invoice ${quote.qboInvoiceId}`);
    return {
      action: 'skipped',
      reason: 'already_invoiced',
      qboInvoiceId: quote.qboInvoiceId
    };
  }

  // 4. Validate Sales Order exists
  if (!quote.qboSalesOrderId) {
    throw new Error(
      `Quote ${quoteId} does not have a Sales Order in QuickBooks. Please sync quote to Sales Order first.`
    );
  }

  // 5. Fetch Sales Order from QuickBooks
  let salesOrder;
  try {
    const response = await qboRequest(`/salesorder/${quote.qboSalesOrderId}`);
    salesOrder = response.SalesOrder;
    console.log(`[InvoiceSync] Fetched Sales Order ${salesOrder.Id} - Doc #${salesOrder.DocNumber}`);
  } catch (error) {
    throw new Error(`Failed to fetch Sales Order ${quote.qboSalesOrderId} from QuickBooks: ${error.message}`);
  }

  // 6. Build Invoice from Sales Order
  const invoicePayload = {
    CustomerRef: salesOrder.CustomerRef,
    TxnDate: new Date().toISOString().split('T')[0], // Today's date
    Line: salesOrder.Line, // Copy line items from Sales Order
    GlobalTaxCalculation: 'NotApplicable',
    PrivateNote: `Manufacturing Order: ${mo.moNumber} | Sales Order: ${salesOrder.DocNumber} | Project: ${quote.projectName}`,
  };

  // Add Sales Order reference
  if (salesOrder.Id) {
    invoicePayload.LinkedTxn = [{
      TxnId: salesOrder.Id,
      TxnType: 'SalesOrder',
    }];
  }

  // Add payment terms if available
  if (quote.paymentTerms) {
    invoicePayload.PrivateNote += ` | Payment Terms: ${quote.paymentTerms}`;
  }

  // 7. Create Invoice in QuickBooks
  try {
    console.log('[InvoiceSync] Creating invoice in QuickBooks:', JSON.stringify(invoicePayload, null, 2));
    const response = await qboRequest('/invoice', {
      method: 'POST',
      body: JSON.stringify(invoicePayload),
    });

    const invoice = response.Invoice;
    console.log(`[InvoiceSync] Invoice created: ${invoice.Id} - Doc #${invoice.DocNumber}`);

    // 8. Update Quote with invoice information
    await db.collection('clientQuotes').doc(quoteId).update({
      qboInvoiceId: invoice.Id,
      qboInvoiceDocNumber: invoice.DocNumber || '',
      qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 9. Update MO with invoice reference (optional)
    await db.collection('manufacturingOrders').doc(moId).update({
      qboInvoiceId: invoice.Id,
      qboInvoiceDocNumber: invoice.DocNumber || '',
      invoicedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 10. Update project estimate if it has quickbooksInvoiceId field
    if (quote.projectId) {
      try {
        const projectRef = db.collection('designProjects').doc(quote.projectId);
        const projectDoc = await projectRef.get();

        if (projectDoc.exists) {
          await projectRef.update({
            'consolidatedEstimate.quickbooksInvoiceId': invoice.Id,
            'consolidatedEstimate.quickbooksInvoiceDocNumber': invoice.DocNumber || '',
            'consolidatedEstimate.invoicedAt': admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`[InvoiceSync] Updated project ${quote.projectId} with invoice reference`);
        }
      } catch (error) {
        console.warn(`[InvoiceSync] Failed to update project estimate:`, error.message);
        // Don't throw - invoice was created successfully
      }
    }

    return {
      action: 'created',
      qboInvoiceId: invoice.Id,
      qboInvoiceDocNumber: invoice.DocNumber || '',
    };
  } catch (error) {
    console.error(`[InvoiceSync] Error creating invoice for MO ${moId}:`, error);

    // Update Quote with error
    await db.collection('clientQuotes').doc(quoteId).update({
      qboSyncError: `Invoice creation failed: ${error.message}`,
      qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    throw error;
  }
}

// ----------------------------------------------------------------------------
// INVOICE CREATION FROM QUOTE (DIRECT)
// ----------------------------------------------------------------------------

/**
 * Create Invoice directly from Quote (bypassing Sales Order if needed)
 * This is a fallback for cases where Sales Order doesn't exist
 */
async function createInvoiceFromQuote(quoteId) {
  console.log(`[InvoiceSync] Creating invoice directly from quote ${quoteId}`);

  // 1. Fetch Quote
  const quoteDoc = await db.collection('clientQuotes').doc(quoteId).get();
  if (!quoteDoc.exists) {
    throw new Error(`Client Quote ${quoteId} not found`);
  }

  const quote = { id: quoteDoc.id, ...quoteDoc.data() };

  // 2. Check if invoice already created
  if (quote.qboInvoiceId) {
    console.log(`[InvoiceSync] Quote ${quoteId} already has invoice ${quote.qboInvoiceId}`);
    return {
      action: 'skipped',
      reason: 'already_invoiced',
      qboInvoiceId: quote.qboInvoiceId
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

  let customer = { id: customerDoc.id, ...customerDoc.data() };

  if (!customer.externalIds?.quickbooksId) {
    logger.info(`[InvoiceSync] Customer "${customer.name}" not synced — auto-syncing to QuickBooks`);
    const qboCustomerId = await resolveOrCreateQBOCustomer(customer);
    await db.collection('customers').doc(quote.customerId).update({
      'externalIds.quickbooksId': qboCustomerId,
      'syncStatus.quickbooks': 'synced',
      'syncStatus.quickbooksLastSync': admin.firestore.FieldValue.serverTimestamp(),
    });
    customer.externalIds = { ...(customer.externalIds || {}), quickbooksId: qboCustomerId };
    logger.info(`[InvoiceSync] Customer "${customer.name}" synced to QBO ID ${qboCustomerId}`);
  }

  // 4. Fetch QBO config for service item mapping
  const configDoc = await db.collection('integrations').doc('quickbooks_config').get();
  if (!configDoc.exists || !configDoc.data().isConfigured) {
    throw new Error('QuickBooks account mapping not configured.');
  }

  const config = configDoc.data();

  // 5. Determine tax mode from config
  const taxMode = config.taxMode || 'out_of_scope';
  const isOutOfScope = taxMode === 'out_of_scope';

  // 6. Build Invoice lines (async: resolves/creates QBO items)
  const invoiceLines = [];
  for (const item of quote.lineItems) {
    let qboItemId = null;

    try {
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
    } catch (resolveError) {
      console.error(`[InvoiceSync] Item resolution failed for "${item.description}":`, resolveError.message);
    }

    if (!qboItemId) continue;

    const lineDetail = {
      ItemRef: { value: qboItemId },
      Qty: item.quantity,
      UnitPrice: item.unitPrice,
    };

    // Only add TaxCodeRef when tax is enabled
    if (!isOutOfScope) {
      lineDetail.TaxCodeRef = { value: getQBOTaxCode(item.taxRateId, config) };
    }

    invoiceLines.push({
      DetailType: 'SalesItemLineDetail',
      Amount: item.totalPrice,
      Description: item.description,
      SalesItemLineDetail: lineDetail,
    });
  }

  // Not filing for service tax — skip tax calculation entirely
  const globalTaxCalc = 'NotApplicable';

  const invoicePayload = {
    CustomerRef: { value: customer.externalIds.quickbooksId },
    TxnDate: new Date().toISOString().split('T')[0],
    Line: invoiceLines,
    GlobalTaxCalculation: globalTaxCalc,
    PrivateNote: `DawinOS Quote: ${quote.quoteNumber} | Project: ${quote.projectName}`,
  };

  // 6. Create Invoice (with tax validation retry)
  try {
    let response;
    try {
      response = await qboRequest('/invoice', {
        method: 'POST',
        body: JSON.stringify(invoicePayload),
      });
    } catch (firstError) {
      // If tax validation fails, retry without TaxCodeRef on line items
      if (firstError.message && firstError.message.includes('sales tax rate')) {
        logger.warn('[InvoiceSync] Tax code validation failed — retrying without TaxCodeRef');
        const noTaxPayload = {
          ...invoicePayload,
          GlobalTaxCalculation: 'NotApplicable',
          Line: invoicePayload.Line.map((line) => {
            if (line.DetailType === 'SalesItemLineDetail' && line.SalesItemLineDetail) {
              const { TaxCodeRef, ...rest } = line.SalesItemLineDetail;
              return { ...line, SalesItemLineDetail: rest };
            }
            return line;
          }),
        };
        response = await qboRequest('/invoice', {
          method: 'POST',
          body: JSON.stringify(noTaxPayload),
        });
      } else {
        throw firstError;
      }
    }

    const invoice = response.Invoice;
    logger.info(`[InvoiceSync] Invoice created: ${invoice.Id} - Doc #${invoice.DocNumber}`);

    // 7. Update Quote
    await db.collection('clientQuotes').doc(quoteId).update({
      qboInvoiceId: invoice.Id,
      qboInvoiceDocNumber: invoice.DocNumber || '',
      qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      action: 'created',
      qboInvoiceId: invoice.Id,
      qboInvoiceDocNumber: invoice.DocNumber || '',
    };
  } catch (error) {
    console.error(`[InvoiceSync] Error creating invoice from quote ${quoteId}:`, error);
    throw error;
  }
}

function getQBOTaxCode(taxRateId, config) {
  const taxMapping = config.taxCodeMapping || {};

  // If explicit tax code IDs are configured, use them
  if (taxMapping.noVat || taxMapping.standardVat) {
    const taxMap = {
      'no_vat': taxMapping.noVat || taxMapping.exempt || 'NON',
      'exempt': taxMapping.exempt || taxMapping.noVat || 'NON',
      'standard_vat': taxMapping.standardVat || 'TAX',
    };
    return taxMap[taxRateId] || taxMapping.noVat || 'NON';
  }

  // Fallback: use standard QBO tax code names
  const defaults = {
    'no_vat': 'NON',
    'exempt': 'NON',
    'standard_vat': 'TAX',
  };
  return defaults[taxRateId] || 'NON';
}

// ----------------------------------------------------------------------------
// INVOICE TAX CODE RESOLUTION (aligned with billSync pattern)
// ----------------------------------------------------------------------------

/**
 * Fetch available QBO tax codes and cache for the current execution.
 */
let _cachedInvoiceTaxCodes = null;
async function getQBOTaxCodes() {
  if (_cachedInvoiceTaxCodes) return _cachedInvoiceTaxCodes;
  try {
    const response = await qboRequest('/query?query=SELECT * FROM TaxCode WHERE Active = true MAXRESULTS 100');
    _cachedInvoiceTaxCodes = response.QueryResponse?.TaxCode || [];
    console.log(`[InvoiceSync] Fetched ${_cachedInvoiceTaxCodes.length} QBO tax codes:`,
      _cachedInvoiceTaxCodes.map(tc => `${tc.Id}="${tc.Name}"`).join(', '));
    return _cachedInvoiceTaxCodes;
  } catch (err) {
    console.warn('[InvoiceSync] Could not fetch QBO tax codes:', err.message);
    return [];
  }
}

/**
 * Validate a tax code value against available QBO tax codes.
 * Falls back to a sensible match by intent ('taxable' or 'exempt').
 */
function resolveValidTaxCodeId(value, intent, taxCodes) {
  if (!taxCodes || taxCodes.length === 0) return value;

  const byId = taxCodes.find(tc => tc.Id === value);
  if (byId) return byId.Id;

  const byName = taxCodes.find(tc => tc.Name.toLowerCase() === value.toLowerCase());
  if (byName) return byName.Id;

  if (intent === 'exempt') {
    const exempt = taxCodes.find(tc => /exempt|no.?tax|out.?of.?scope|non|zero|free|nil/i.test(tc.Name));
    if (exempt) return exempt.Id;
  } else {
    const taxable = taxCodes.find(tc =>
      /standard|vat|tax|gst|output/i.test(tc.Name) && !/exempt|zero|free|nil|out/i.test(tc.Name)
    );
    if (taxable) return taxable.Id;
  }

  return taxCodes[0]?.Id || value;
}

/**
 * Resolve invoice tax code for a line item.
 * Uses taxRateId if available, otherwise defaults to exempt.
 */
function resolveInvoiceTaxCode(taxRateId, config, availableTaxCodes) {
  const taxMapping = config.taxCodeMapping || {};

  let value;
  let intent;

  if (taxRateId === 'standard_vat') {
    value = taxMapping.standardVat || 'TAX';
    intent = 'taxable';
  } else {
    value = taxMapping.noVat || 'NON';
    intent = 'exempt';
  }

  if (availableTaxCodes && availableTaxCodes.length > 0) {
    return resolveValidTaxCodeId(value, intent, availableTaxCodes);
  }

  return value;
}

// ----------------------------------------------------------------------------
// REVENUE ACCOUNT RESOLUTION
// ----------------------------------------------------------------------------

/**
 * Resolve the appropriate revenue account for an invoice line item category.
 * Mirrors how billSync resolves COGS accounts per line — but for income.
 * Falls back to the default `revenue` account.
 */
function resolveLineRevenueAccount(category, config) {
  const mapping = config.accountMapping || {};
  const cat = (category || '').toLowerCase();

  // Products & materials → revenueProducts
  if (['material', 'hardware', 'finishing', 'procurement', 'product', 'furniture', 'fitout'].includes(cat))
    return mapping.revenueProducts || mapping.revenue;

  // Services, labor, construction → revenueServicesAndProjects
  if (['labor', 'construction', 'outsourcing', 'installation', 'design_fee', 'consultation', 'service'].includes(cat))
    return mapping.revenueServicesAndProjects || mapping.revenue;

  // Shipping
  if (cat === 'shipping')
    return mapping.revenueShipping || mapping.revenue;

  // Manufactured items → revenueManufactured (if configured)
  if (cat === 'manufactured' && mapping.revenueManufactured)
    return mapping.revenueManufactured;

  // Default fallback
  return mapping.revenue;
}

// ----------------------------------------------------------------------------
// PAYMENT TERMS
// ----------------------------------------------------------------------------

/**
 * Calculate due date from transaction date and payment terms days.
 */
function calculateDueDate(txnDate, paymentTermsDays) {
  const date = new Date(txnDate);
  date.setDate(date.getDate() + (paymentTermsDays || 30));
  return date.toISOString().split('T')[0];
}

/**
 * Get QBO SalesTermRef name from payment terms days.
 */
function getQBOTermsName(paymentTermsDays) {
  const termsMap = {
    0: 'Due on receipt',
    15: 'Net 15',
    30: 'Net 30',
    45: 'Net 45',
    60: 'Net 60',
  };
  return termsMap[paymentTermsDays] || `Net ${paymentTermsDays}`;
}

/**
 * Look up QBO Term by name and return its numeric ID.
 * Returns null if not found.
 */
async function resolveQBOTermId(termName) {
  try {
    const escaped = termName.replace(/'/g, "\\'");
    const query = encodeURIComponent(
      `SELECT Id, Name FROM Term WHERE Name = '${escaped}'`
    );
    const response = await qboRequest(`/query?query=${query}`);
    const terms = response.QueryResponse.Term || [];
    if (terms.length > 0) {
      return terms[0].Id;
    }
    return null;
  } catch (err) {
    console.warn(`[InvoiceSync] Failed to resolve QBO term "${termName}":`, err.message);
    return null;
  }
}

// ----------------------------------------------------------------------------
// CUSTOM FIELDS BUILDER
// ----------------------------------------------------------------------------

/**
 * Build QBO CustomField array for SO traceability.
 */
function buildInvoiceCustomFields(config, so) {
  const fields = [];
  const cfMapping = config.customFieldMapping || {};

  // Use the PO Number custom field slot for SO number (reuse existing config)
  if (cfMapping.poNumber) {
    fields.push({
      DefinitionId: cfMapping.poNumber,
      Name: 'SO No',
      Type: 'StringType',
      StringValue: so.orderNumber || '',
    });
  }

  return fields.length > 0 ? fields : undefined;
}

// ----------------------------------------------------------------------------
// INVOICE LINE MAPPING (aligned with billSync.mapPOLinesToBillLines)
// ----------------------------------------------------------------------------

/**
 * Map SO scope items to QBO Invoice lines.
 * Uses SalesItemLineDetail for items resolvable to QBO items.
 * Falls back to SalesItemLineDetail with account-based routing for
 * items that cannot be resolved (ensures proper revenue account mapping).
 *
 * Each line is mapped to the correct revenue account based on its category:
 *   - furniture, fitout, material, hardware → revenueProducts
 *   - installation, design_fee, consultation → revenueServicesAndProjects
 *   - shipping → revenueShipping
 *   - other → default revenue
 */
async function mapSOLinesToInvoiceLines(so, config) {
  const lines = [];

  // Fetch available QBO tax codes for validation (like billSync does)
  const availableTaxCodes = await getQBOTaxCodes();

  const scopeItems = (so.scopeItems || []).filter(item => item.isActive !== false);

  for (const item of scopeItems) {
    // Resolve tax code with validation against actual QBO tax codes
    const taxCode = resolveInvoiceTaxCode(item.taxRateId || null, config, availableTaxCodes);

    // Resolve the revenue account for this line item
    const revenueAccountId = resolveLineRevenueAccount(item.category, config);

    // Try item-based resolution (like billSync does for inventory items)
    let resolved = null;
    let itemName = item.name || item.description;
    let itemSku = null;
    let itemClassification = null;
    const inventoryItemId = item.inventoryItemId || null;

    if (inventoryItemId) {
      try {
        const invDoc = await db.collection('inventoryItems').doc(inventoryItemId).get();
        if (invDoc.exists) {
          const invData = invDoc.data();
          itemName = invData.displayName || invData.name || itemName;
          itemSku = invData.sku || null;
          itemClassification = invData.classification || null;
        }
      } catch (err) {
        console.warn(`[InvoiceSync] Could not fetch inventory item ${inventoryItemId}:`, err.message);
      }
    }

    try {
      resolved = await resolveOrCreateQBOItem({
        name: itemName,
        sku: itemSku,
        category: item.category,
        classification: itemClassification,
        unitPrice: item.unitPrice,
        description: item.description || item.name,
        inventoryItemId,
      }, config);
    } catch (resolveError) {
      console.warn(`[InvoiceSync] Item resolution failed for "${itemName}", using account-based fallback:`, resolveError.message);
    }

    if (resolved && resolved.qboItemId) {
      // Item-based line (primary path — aligned with billSync's ItemBasedExpenseLineDetail)
      lines.push({
        DetailType: 'SalesItemLineDetail',
        Amount: item.totalPrice,
        Description: `[${so.orderNumber}] ${item.description || item.name}`,
        SalesItemLineDetail: {
          ItemRef: { value: resolved.qboItemId },
          Qty: item.quantity,
          UnitPrice: item.unitPrice,
          TaxCodeRef: { value: taxCode },
        },
      });
    } else {
      // Fallback: SalesItemLineDetail without item ref — route directly to revenue account
      // This mirrors billSync's AccountBasedExpenseLineDetail fallback
      console.log(`[InvoiceSync] Fallback to account-based line for "${itemName}" → revenue account ${revenueAccountId}`);

      if (!revenueAccountId) {
        console.error(`[InvoiceSync] No revenue account for category "${item.category}" — skipping line "${itemName}"`);
        continue;
      }

      lines.push({
        DetailType: 'SalesItemLineDetail',
        Amount: item.totalPrice,
        Description: `[${so.orderNumber}] ${item.description || item.name} — Qty: ${item.quantity} ${item.unit || 'ea'}`,
        SalesItemLineDetail: {
          Qty: item.quantity,
          UnitPrice: item.unitPrice,
          TaxCodeRef: { value: taxCode },
        },
      });
    }

    // Log the revenue account mapping for traceability
    console.log(`[InvoiceSync] Line: "${itemName}" (${item.category}) → revenue: ${revenueAccountId}, tax: ${taxCode}`);
  }

  return lines;
}

// ----------------------------------------------------------------------------
// INVOICE CREATION FROM SALES ORDER DOCUMENT (SO-CENTRIC)
// Aligned with billSync.createBillFromPO pattern
// ----------------------------------------------------------------------------

/**
 * Create Invoice in QuickBooks directly from a Sales Order document.
 * Triggered when SO status reaches 'released_to_production'.
 *
 * Follows the same pattern as createBillFromPO:
 * 1. Fetch SO + idempotency check
 * 2. Validate customer (like bill validates vendor, auto-sync if needed)
 * 3. Fetch & validate QBO config
 * 4. Map lines with proper revenue account resolution per category
 * 5. Resolve tax codes against actual QBO tax codes
 * 6. Build payload with custom fields, payment terms, linked transactions
 * 7. POST to QBO, update source documents
 */
async function createInvoiceFromSODocument(salesOrderId) {
  console.log(`[InvoiceSync] Creating invoice from Sales Order ${salesOrderId}`);
  _cachedInvoiceTaxCodes = null; // Reset tax code cache for fresh resolution

  // 1. Fetch Sales Order
  const soDoc = await db.collection('salesOrders').doc(salesOrderId).get();
  if (!soDoc.exists) {
    throw new Error(`Sales Order ${salesOrderId} not found`);
  }

  const so = { id: soDoc.id, ...soDoc.data() };

  // 2. Idempotency check
  if (so.qboInvoiceId) {
    console.log(`[InvoiceSync] SO ${salesOrderId} already has invoice ${so.qboInvoiceId}`);
    return {
      action: 'skipped',
      reason: 'already_invoiced',
      qboInvoiceId: so.qboInvoiceId,
    };
  }

  // 3. Validate customer — auto-sync to QBO if not yet linked (mirrors billSync vendor auto-sync)
  if (!so.customerId) {
    throw new Error(`Sales Order ${so.orderNumber} has no customerId`);
  }

  const customerDoc = await db.collection('customers').doc(so.customerId).get();
  if (!customerDoc.exists) {
    throw new Error(`Customer ${so.customerId} not found`);
  }

  let customer = { id: customerDoc.id, ...customerDoc.data() };

  if (!customer.externalIds?.quickbooksId) {
    console.log(`[InvoiceSync] Customer "${customer.name}" not synced to QBO — auto-syncing...`);
    const customerResult = await syncCustomerToQBO(so.customerId);
    console.log(`[InvoiceSync] Customer auto-sync result:`, customerResult);

    // Re-fetch customer to get the updated quickbooksId
    const refreshedDoc = await db.collection('customers').doc(so.customerId).get();
    customer = { id: refreshedDoc.id, ...refreshedDoc.data() };

    if (!customer.externalIds?.quickbooksId) {
      throw new Error(
        `Customer "${customer.name || so.customerName}" could not be synced to QuickBooks. Please check customer details and try again.`
      );
    }
  }

  // 4. Fetch QBO config
  const configDoc = await db.collection('integrations').doc('quickbooks_config').get();
  if (!configDoc.exists || !configDoc.data().isConfigured) {
    throw new Error('QuickBooks account mapping not configured. Please configure account mappings first.');
  }

  const config = configDoc.data();

  // 5. Validate scope items exist
  const scopeItems = (so.scopeItems || []).filter(item => item.isActive !== false);
  if (scopeItems.length === 0) {
    throw new Error(`Sales Order ${so.orderNumber} has no active scope items to invoice.`);
  }

  // 6. Map SO lines to invoice lines (with revenue account resolution per category)
  const invoiceLines = await mapSOLinesToInvoiceLines(so, config);

  if (invoiceLines.length === 0) {
    throw new Error(`No scope items could be resolved to QuickBooks items for SO ${so.orderNumber}.`);
  }

  // Log revenue account summary
  const accountSummary = {};
  for (const item of scopeItems) {
    const acct = resolveLineRevenueAccount(item.category, config);
    accountSummary[item.category || 'unknown'] = acct;
  }
  console.log(`[InvoiceSync] Revenue account mapping for SO ${so.orderNumber}:`, JSON.stringify(accountSummary));

  // 7. Add discount line if applicable
  if (so.totalDiscountAmount && so.totalDiscountAmount > 0) {
    invoiceLines.push({
      DetailType: 'DiscountLineDetail',
      Amount: so.totalDiscountAmount,
      DiscountLineDetail: {
        PercentBased: false,
      },
    });
  }

  // 8. Calculate dates and payment terms (aligned with billSync pattern)
  const txnDate = new Date().toISOString().split('T')[0];
  const paymentDueDays = so.paymentTerms?.paymentDueDays || 30;
  const dueDate = calculateDueDate(txnDate, paymentDueDays);

  // 9. Build invoice payload (aligned with billSync's billPayload structure)
  const invoicePayload = {
    CustomerRef: { value: customer.externalIds.quickbooksId },
    DocNumber: so.orderNumber,
    TxnDate: txnDate,
    DueDate: dueDate,
    Line: invoiceLines,
    PrivateNote: `DawinOS Sales Order: ${so.orderNumber} | Customer: ${so.customerName || customer.name}`,
    // Not filing for service tax — skip tax calculation entirely
    GlobalTaxCalculation: 'NotApplicable',
  };

  // Add payment terms reference (SalesTermRef.value must be a numeric QBO Term ID)
  if (paymentDueDays) {
    const termsMapping = config.paymentTermsMapping || {};
    const mappedValue = termsMapping[String(paymentDueDays)];

    if (mappedValue && /^\d+$/.test(String(mappedValue))) {
      // Config has a numeric ID — use it directly
      invoicePayload.SalesTermRef = { value: String(mappedValue) };
    } else {
      // Resolve by name — look up the QBO Term ID
      const termName = mappedValue || getQBOTermsName(paymentDueDays);
      const termId = await resolveQBOTermId(termName);
      if (termId) {
        invoicePayload.SalesTermRef = { value: String(termId) };
      } else {
        console.warn(`[InvoiceSync] Could not resolve QBO Term for "${termName}" — skipping SalesTermRef`);
      }
    }
  }

  // Add custom fields for traceability (like billSync adds PO number)
  const customFields = buildInvoiceCustomFields(config, so);
  if (customFields) {
    invoicePayload.CustomField = customFields;
  }

  // Link to QBO Sales Order if it exists
  if (so.qboSalesOrderId) {
    invoicePayload.LinkedTxn = [{
      TxnId: so.qboSalesOrderId,
      TxnType: 'SalesOrder',
    }];
  }

  // 10. Create Invoice in QuickBooks
  try {
    console.log('[InvoiceSync] Creating SO invoice in QuickBooks:', JSON.stringify(invoicePayload, null, 2));
    const response = await qboRequest('/invoice', {
      method: 'POST',
      body: JSON.stringify(invoicePayload),
    });

    const invoice = response.Invoice;
    console.log(`[InvoiceSync] SO Invoice created: ${invoice.Id} - Doc #${invoice.DocNumber}`);

    // 11. Update Sales Order with invoice reference
    const soUpdate = {
      qboInvoiceId: invoice.Id,
      qboInvoiceDocNumber: invoice.DocNumber || '',
      qboSyncStatus: 'synced',
      qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    // Clear any previous error (use delete like billSync does)
    soUpdate.qboSyncError = admin.firestore.FieldValue.delete();
    await db.collection('salesOrders').doc(salesOrderId).update(soUpdate);

    // 12. Also update linked quote if it exists
    if (so.quoteId) {
      try {
        await db.collection('clientQuotes').doc(so.quoteId).update({
          qboInvoiceId: invoice.Id,
          qboInvoiceDocNumber: invoice.DocNumber || '',
          qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (quoteErr) {
        console.warn(`[InvoiceSync] Failed to update linked quote ${so.quoteId}:`, quoteErr.message);
      }
    }

    // 13. Update design project if linked
    if (so.designProjectId) {
      try {
        const projectRef = db.collection('designProjects').doc(so.designProjectId);
        const projectDoc = await projectRef.get();
        if (projectDoc.exists) {
          await projectRef.update({
            'consolidatedEstimate.quickbooksInvoiceId': invoice.Id,
            'consolidatedEstimate.quickbooksInvoiceDocNumber': invoice.DocNumber || '',
            'consolidatedEstimate.invoicedAt': admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (projErr) {
        console.warn(`[InvoiceSync] Failed to update project ${so.designProjectId}:`, projErr.message);
      }
    }

    return {
      action: 'created',
      qboInvoiceId: invoice.Id,
      qboInvoiceDocNumber: invoice.DocNumber || '',
    };
  } catch (error) {
    console.error(`[InvoiceSync] Error creating invoice for SO ${so.orderNumber}:`, error);

    // Update SO with error status
    await db.collection('salesOrders').doc(salesOrderId).update({
      qboSyncStatus: 'error',
      qboSyncError: `Invoice creation failed: ${error.message}`,
      qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    throw error;
  }
}

// ----------------------------------------------------------------------------
// CALLABLE FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Manual invoice sync from MO (callable from UI)
 */
exports.syncMOToInvoice = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { moId, quoteId } = request.data;
  if (!moId || !quoteId) {
    throw new HttpsError('invalid-argument', 'moId and quoteId are required');
  }

  try {
    const result = await createInvoiceFromSalesOrder(moId, quoteId);
    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error('[InvoiceSync] Manual sync failed:', error);
    throw new HttpsError('internal', error.message || 'Failed to create invoice in QuickBooks');
  }
});

/**
 * Manual invoice sync directly from quote (callable from UI)
 */
exports.syncQuoteToInvoice = onCall({
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
    const result = await createInvoiceFromQuote(quoteId);
    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error('[InvoiceSync] Manual sync failed:', error);
    throw new HttpsError('internal', error.message || 'Failed to create invoice in QuickBooks');
  }
});

/**
 * Manual invoice sync from Sales Order document (callable from UI)
 */
exports.syncSOToInvoice = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { salesOrderId } = request.data;
  if (!salesOrderId) {
    throw new HttpsError('invalid-argument', 'salesOrderId is required');
  }

  try {
    const result = await createInvoiceFromSODocument(salesOrderId);
    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error('[InvoiceSync] SO invoice sync failed:', error);
    throw new HttpsError('internal', error.message || 'Failed to create invoice from Sales Order in QuickBooks');
  }
});

// ----------------------------------------------------------------------------
// PAYMENT SYNC — Record payment received against a QBO Invoice
// ----------------------------------------------------------------------------

/**
 * Create a QBO Payment for a Sales Order's linked Invoice.
 * The SO must have a qboInvoiceId (invoice already synced to QBO).
 *
 * @param {string} salesOrderId - Firestore SO document ID
 * @param {string} paymentId - The payment record ID within the SO's payments array
 * @returns {{ qboPaymentId: string, qboPaymentDocNumber: string }}
 */
async function createPaymentForInvoice(salesOrderId, paymentId) {
  // 1. Load SO
  const soDoc = await db.collection('salesOrders').doc(salesOrderId).get();
  if (!soDoc.exists) {
    throw new Error(`Sales Order ${salesOrderId} not found`);
  }
  const so = soDoc.data();

  // 2. Find the specific payment record
  const payments = so.payments || [];
  const payment = payments.find((p) => p.id === paymentId);
  if (!payment) {
    throw new Error(`Payment ${paymentId} not found on SO ${salesOrderId}`);
  }

  // 3. Check idempotency — skip if already synced
  if (payment.qboPaymentId) {
    logger.info(`[PaymentSync] Payment ${paymentId} already synced to QBO ${payment.qboPaymentId}`);
    return {
      action: 'skipped',
      reason: 'already_synced',
      qboPaymentId: payment.qboPaymentId,
    };
  }

  // 4. Require linked QBO Invoice
  if (!so.qboInvoiceId) {
    throw new Error(`Sales Order ${so.orderNumber} has no linked QBO Invoice. Sync the invoice first.`);
  }

  // 5. Resolve QBO Customer
  let qboCustomerId = null;
  if (so.customerId) {
    const customerDoc = await db.collection('customers').doc(so.customerId).get();
    if (customerDoc.exists) {
      qboCustomerId = customerDoc.data()?.externalIds?.quickbooksId;
      if (!qboCustomerId) {
        // Auto-sync customer
        const customer = { id: customerDoc.id, ...customerDoc.data() };
        qboCustomerId = await resolveOrCreateQBOCustomer(customer);
        await db.collection('customers').doc(so.customerId).update({
          'externalIds.quickbooksId': qboCustomerId,
          'syncStatus.quickbooks': 'synced',
          'syncStatus.quickbooksLastSync': admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
  }

  if (!qboCustomerId) {
    throw new Error(`Cannot resolve QBO Customer for SO ${so.orderNumber}`);
  }

  // 6. Build QBO Payment payload — use paymentDate (actual date) falling back to recordedAt
  const dateSource = payment.paymentDate || payment.recordedAt;
  const txnDate = dateSource?.toDate
    ? dateSource.toDate().toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const paymentPayload = {
    CustomerRef: { value: String(qboCustomerId) },
    TotalAmt: payment.amount,
    TxnDate: txnDate,
    Line: [
      {
        Amount: payment.amount,
        LinkedTxn: [
          {
            TxnId: String(so.qboInvoiceId),
            TxnType: 'Invoice',
          },
        ],
      },
    ],
    PrivateNote: `${payment.type} payment — ${so.orderNumber}${payment.receiptRef ? ` | Ref: ${payment.receiptRef}` : ''}${payment.method ? ` | Method: ${payment.method}` : ''}`,
  };

  // 7. Fetch config for deposit-to-account mapping (optional)
  const configDoc = await db.collection('integrations').doc('quickbooks_config').get();
  if (configDoc.exists) {
    const config = configDoc.data();
    // If a deposit account is configured (e.g. Undeposited Funds or a bank account)
    const depositAccountId = config.accountMapping?.depositAccount || config.accountMapping?.bankAccount;
    if (depositAccountId) {
      paymentPayload.DepositToAccountRef = { value: String(depositAccountId) };
    }

    // Map payment method to QBO PaymentMethodRef if configured
    const methodMapping = config.paymentMethodMapping || {};
    const qboMethodId = methodMapping[payment.method];
    if (qboMethodId) {
      paymentPayload.PaymentMethodRef = { value: String(qboMethodId) };
    }
  }

  // 8. Create payment in QBO
  logger.info(`[PaymentSync] Creating QBO Payment for SO ${so.orderNumber}, amount ${payment.amount}`);
  const result = await qboRequest('/payment?minorversion=65', {
    method: 'POST',
    body: JSON.stringify(paymentPayload),
  });

  const qboPayment = result.Payment;
  logger.info(`[PaymentSync] QBO Payment created: ID=${qboPayment.Id}`);

  // 9. Update the specific payment record in the SO's payments array
  const updatedPayments = payments.map((p) => {
    if (p.id === paymentId) {
      return {
        ...p,
        qboPaymentId: qboPayment.Id,
        qboPaymentSyncStatus: 'synced',
        qboPaymentSyncedAt: admin.firestore.Timestamp.now(),
      };
    }
    return p;
  });

  await db.collection('salesOrders').doc(salesOrderId).update({
    payments: updatedPayments,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    action: 'created',
    qboPaymentId: qboPayment.Id,
    qboPaymentDocNumber: qboPayment.DocNumber || '',
  };
}

/**
 * Callable: Sync a payment to QBO (from SO detail page or WhatsApp receipt flow)
 */
exports.syncPaymentToQBO = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { salesOrderId, paymentId } = request.data;
  if (!salesOrderId || !paymentId) {
    throw new HttpsError('invalid-argument', 'salesOrderId and paymentId are required');
  }

  try {
    const result = await createPaymentForInvoice(salesOrderId, paymentId);
    return { success: true, ...result };
  } catch (error) {
    logger.error('[PaymentSync] Sync failed:', error);

    // Write error status to the payment record
    try {
      const soDoc = await db.collection('salesOrders').doc(salesOrderId).get();
      if (soDoc.exists) {
        const payments = soDoc.data().payments || [];
        const updatedPayments = payments.map((p) => {
          if (p.id === paymentId) {
            return {
              ...p,
              qboPaymentSyncStatus: 'error',
              qboPaymentSyncError: error.message,
            };
          }
          return p;
        });
        await db.collection('salesOrders').doc(salesOrderId).update({
          payments: updatedPayments,
        });
      }
    } catch (updateErr) {
      logger.error('[PaymentSync] Failed to write error status:', updateErr);
    }

    throw new HttpsError('internal', error.message || 'Failed to sync payment to QuickBooks');
  }
});

// Export core functions for use by triggers
exports.createInvoiceFromSalesOrder = createInvoiceFromSalesOrder;
exports.createInvoiceFromQuote = createInvoiceFromQuote;
exports.createInvoiceFromSODocument = createInvoiceFromSODocument;
exports.createPaymentForInvoice = createPaymentForInvoice;
