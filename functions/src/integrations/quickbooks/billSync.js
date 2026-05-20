/**
 * QuickBooks Bill Sync Service
 * Creates Bills in QuickBooks from approved Purchase Orders
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const { refreshTokens, TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET } = require('./auth');
const { ALLOWED_ORIGINS } = require('../../config/cors');
const { resolveOrCreateQBOItem } = require('./itemResolutionService');
const { syncSupplierToQBO } = require('./vendorSync');

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

/**
 * Check whether a QBO Bill still exists.
 * Returns the Bill object if it exists, or null if deleted / not found.
 */
async function fetchBillIfExists(qboBillId) {
  try {
    const result = await qboRequest(`/bill/${qboBillId}`);
    return result.Bill || null;
  } catch (err) {
    // QBO returns 4xx when the entity is deleted or not found
    if (err.message && (err.message.includes('(404)') || err.message.includes('(400)') || err.message.includes('Object Not Found'))) {
      return null;
    }
    throw err; // Re-throw unexpected errors
  }
}

/**
 * Reset QBO sync fields on a PO (mark as unsynced).
 */
async function clearBillSyncFields(poId) {
  await db.collection('purchaseOrders').doc(poId).update({
    qboBillId: admin.firestore.FieldValue.delete(),
    qboBillDocNumber: admin.firestore.FieldValue.delete(),
    qboSyncStatus: 'unsynced',
    qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    qboSyncError: admin.firestore.FieldValue.delete(),
  });
  console.log(`[BillSync] Cleared sync fields for PO ${poId} — marked as unsynced`);
}

// ----------------------------------------------------------------------------
// PAYMENT TERMS CALCULATION
// ----------------------------------------------------------------------------

/**
 * Calculate due date based on payment terms
 */
function calculateDueDate(txnDate, paymentTermsDays) {
  const date = new Date(txnDate);
  date.setDate(date.getDate() + (paymentTermsDays || 30));
  return date.toISOString().split('T')[0];
}

/**
 * Get QuickBooks TermsRef name from payment terms days
 */
function getQBOTermsName(paymentTermsDays) {
  const termsMap = {
    15: 'Net 15',
    30: 'Net 30',
    45: 'Net 45',
    60: 'Net 60',
  };
  return termsMap[paymentTermsDays] || 'Net 30';
}

// ----------------------------------------------------------------------------
// COGS ACCOUNT RESOLUTION
// ----------------------------------------------------------------------------

/**
 * Resolve the appropriate COGS account for a line item category.
 * Falls back to the default `cogs` account when no category-specific mapping exists.
 */
function resolveCogsAccount(category, config) {
  const mapping = config.accountMapping || {};
  const cat = (category || '').toLowerCase();

  if (cat.includes('material') && mapping.cogsMaterials) return mapping.cogsMaterials;
  if (cat.includes('product') && mapping.cogsProducts) return mapping.cogsProducts;
  if ((cat.includes('service') || cat.includes('project') || cat.includes('construction')) && mapping.cogsServicesAndProjects) return mapping.cogsServicesAndProjects;
  if ((cat.includes('labour') || cat.includes('labor')) && mapping.cogsLabour) return mapping.cogsLabour;
  if ((cat.includes('outsource') || cat.includes('subcontract') || cat.includes('edge band') || cat.includes('cutting') || cat.includes('welding') || cat.includes('planing')) && mapping.cogsOutsourced) return mapping.cogsOutsourced;

  // Default fallback
  return mapping.cogs;
}

// ----------------------------------------------------------------------------
// TAX CODE RESOLUTION
// ----------------------------------------------------------------------------

/**
 * The functional (home) currency for this QBO company.
 * Uganda-based business → UGX.
 */
const FUNCTIONAL_CURRENCY = 'UGX';

/**
 * Default (static) exchange rates to UGX.
 * Used as a last-resort fallback when the PO has no explicit exchange rate
 * and QBO requires one for foreign-currency transactions.
 */
const DEFAULT_EXCHANGE_RATES_TO_UGX = {
  USD: 3700,
  EUR: 4000,
  GBP: 4600,
  AED: 1000,
  CNY: 510,
  KES: 29,
  ZAR: 205,
};

/**
 * Fetch available tax codes from QBO and cache them for the current execution.
 * Returns an array of { Id, Name, Description, Active } objects.
 */
let _cachedTaxCodes = null;
async function getQBOTaxCodes() {
  if (_cachedTaxCodes) return _cachedTaxCodes;
  try {
    const response = await qboRequest("/query?query=SELECT * FROM TaxCode WHERE Active = true MAXRESULTS 100");
    _cachedTaxCodes = response.QueryResponse?.TaxCode || [];
    console.log(`[BillSync] Fetched ${_cachedTaxCodes.length} QBO tax codes:`,
      _cachedTaxCodes.map(tc => `${tc.Id}="${tc.Name}"`).join(', '));
    return _cachedTaxCodes;
  } catch (err) {
    console.warn('[BillSync] Could not fetch QBO tax codes:', err.message);
    return [];
  }
}

/**
 * Validate a tax code ID/name against available QBO tax codes.
 * If the value matches a tax code ID or Name, returns the ID.
 * Otherwise tries to find a sensible fallback.
 *
 * @param {string} value - The tax code value to validate ('TAX', 'NON', or an ID)
 * @param {string} intent - 'taxable' or 'exempt' — what kind of tax code we need
 * @param {Array} taxCodes - Available QBO tax codes
 */
function resolveValidTaxCodeId(value, intent, taxCodes) {
  if (!taxCodes || taxCodes.length === 0) return value; // no codes available, use as-is

  // Check if value matches a tax code by ID
  const byId = taxCodes.find(tc => tc.Id === value);
  if (byId) return byId.Id;

  // Check if value matches by Name (case-insensitive)
  const byName = taxCodes.find(tc => tc.Name.toLowerCase() === value.toLowerCase());
  if (byName) return byName.Id;

  // Value doesn't match any tax code — find a fallback based on intent
  if (intent === 'exempt') {
    // Look for exempt/no-tax/out-of-scope codes
    const exempt = taxCodes.find(tc =>
      /exempt|no.?tax|out.?of.?scope|non|zero|free|nil/i.test(tc.Name)
    );
    if (exempt) {
      console.log(`[BillSync] Tax code "${value}" not found, using exempt fallback: ${exempt.Id}="${exempt.Name}"`);
      return exempt.Id;
    }
  } else {
    // Look for standard/VAT/taxable codes
    const taxable = taxCodes.find(tc =>
      /standard|vat|tax|gst|input/i.test(tc.Name) && !/exempt|zero|free|nil|out/i.test(tc.Name)
    );
    if (taxable) {
      console.log(`[BillSync] Tax code "${value}" not found, using taxable fallback: ${taxable.Id}="${taxable.Name}"`);
      return taxable.Id;
    }
  }

  // Absolute last resort: use the first available tax code
  console.warn(`[BillSync] No matching tax code for "${value}" (${intent}), using first available: ${taxCodes[0].Id}="${taxCodes[0].Name}"`);
  return taxCodes[0].Id;
}

/**
 * Determine the correct QBO tax code for a bill line item.
 *
 * Default: All bill lines are synced as "Out of Scope" (exempt) tax.
 * VAT is handled separately in the tax return, not on supplier bills.
 *
 * If taxCodeMapping.standardVat is explicitly configured AND the supplier
 * is domestic, that code will be used instead — but out-of-scope is the default.
 *
 * @param {Array} [availableTaxCodes] - Pre-fetched QBO tax codes for validation
 */
function resolveBillTaxCode(config, { isForeignSupplier, isLandedCost = false }, availableTaxCodes) {
  const taxMapping = config.taxCodeMapping || {};

  // Default: all bill lines are out of scope / exempt
  let value = taxMapping.noVat || 'NON';
  let intent = 'exempt';

  // Only use taxable code if explicitly configured AND domestic supplier AND not a landed cost
  if (!isLandedCost && !isForeignSupplier && taxMapping.standardVat) {
    value = taxMapping.standardVat;
    intent = 'taxable';
  }

  // If we have available tax codes, validate and resolve to a valid ID
  if (availableTaxCodes && availableTaxCodes.length > 0) {
    return resolveValidTaxCodeId(value, intent, availableTaxCodes);
  }

  return value;
}

/**
 * Check whether a supplier is foreign (non-Ugandan).
 */
function isForeignSupplier(supplier) {
  const country = (supplier.address?.country || '').toLowerCase().trim();
  return country !== '' && country !== 'uganda' && country !== 'ug';
}

// ----------------------------------------------------------------------------
// BILL LINE ITEM MAPPING
// ----------------------------------------------------------------------------

/**
 * Map PO line items to QuickBooks Bill lines.
 * Uses ItemBasedExpenseLineDetail for inventory-linked items (resolves/creates QBO items).
 * Falls back to AccountBasedExpenseLineDetail for items without inventory links.
 *
 * @param {object} po          - The purchase order document data
 * @param {object} config      - The QBO configuration
 * @param {boolean} isForeign  - Whether the supplier is foreign (non-Ugandan)
 * @param {Array} [landedCostComponents] - If provided, only these components are added as landed cost lines (for multi-supplier bills)
 */
async function mapPOLinesToBillLines(po, config, isForeign, landedCostComponents) {
  const lines = [];

  // Fetch available QBO tax codes for validation
  const availableTaxCodes = await getQBOTaxCodes();

  // Resolve tax code for item lines
  const itemTaxCode = resolveBillTaxCode(config, {
    isForeignSupplier: isForeign,
    isLandedCost: false,
  }, availableTaxCodes);

  // Resolve tax code for landed cost lines (always out of scope)
  const landedTaxCode = resolveBillTaxCode(config, {
    isForeignSupplier: isForeign,
    isLandedCost: true,
  }, availableTaxCodes);

  console.log(`[BillSync] Tax codes — items: ${itemTaxCode}, landed: ${landedTaxCode}, foreign: ${isForeign}`);

  // Map regular PO line items
  for (const item of po.lineItems) {
    // Try item-based resolution if an inventory item is linked
    if (item.inventoryItemId) {
      try {
        const invDoc = await db.collection('inventoryItems').doc(item.inventoryItemId).get();

        if (invDoc.exists) {
          const invItem = invDoc.data();
          const resolved = await resolveOrCreateQBOItem({
            name: invItem.displayName || invItem.name,
            sku: invItem.sku,
            category: invItem.category || 'material',
            classification: invItem.classification || 'material',
            purchaseCost: item.unitCost,
            description: item.description || invItem.description,
            inventoryItemId: item.inventoryItemId,
          }, config);

          lines.push({
            DetailType: 'ItemBasedExpenseLineDetail',
            Amount: item.totalCost,
            ItemBasedExpenseLineDetail: {
              ItemRef: { value: resolved.qboItemId },
              Qty: item.quantity,
              UnitPrice: item.unitCost,
              TaxCodeRef: { value: itemTaxCode },
            },
            Description: `[${po.poNumber}] ${item.description} (SKU: ${item.sku || 'N/A'})`,
          });
          continue; // Skip to next line item
        }
      } catch (resolveError) {
        console.warn(`[BillSync] Item resolution failed for "${item.description}", using account-based fallback:`, resolveError.message);
      }
    }

    // Fallback: Account-based expense line — route by item category
    const categoryAccountMap = {
      inventory: config.accountMapping.inventory,
      asset: config.accountMapping.fixedAssets || config.accountMapping.inventory,
      service: config.accountMapping.cogsServicesAndProjects || config.accountMapping.cogs,
      overhead: config.accountMapping.overhead || config.accountMapping.cogs,
      'manufacturing-overhead': config.accountMapping.manufacturingOverhead || config.accountMapping.overhead || config.accountMapping.cogs,
    };
    const fallbackAccount = categoryAccountMap[item.category || 'inventory'] || config.accountMapping.inventory;

    lines.push({
      DetailType: 'AccountBasedExpenseLineDetail',
      Amount: item.totalCost,
      AccountBasedExpenseLineDetail: {
        AccountRef: { value: fallbackAccount },
        TaxCodeRef: { value: itemTaxCode },
      },
      Description: `[${po.poNumber}] ${item.description} (SKU: ${item.sku || 'N/A'}) - Qty: ${item.quantity} ${item.unit}`,
    });
  }

  // Add landed costs as separate lines if present
  // When landedCostComponents is provided (multi-supplier), only add those specific components.
  // Otherwise (single-supplier legacy path), add all non-zero components.
  if (po.landedCosts && po.landedCosts.totalLandedCost > 0) {
    const landedCostMethod = config.landedCostMethod || 'capitalize';

    // Resolve account for a landed cost component based on method
    const resolveLandedAccount = (expenseField) => {
      if (landedCostMethod === 'capitalize') {
        return config.accountMapping.inventory;
      }
      return config.accountMapping[expenseField] || config.accountMapping.inventory;
    };

    const suffix = landedCostMethod === 'capitalize' ? ' (capitalized to inventory)' : '';

    // Determine which components to add
    const componentsToAdd = landedCostComponents || [
      { amount: po.landedCosts.shipping, field: 'shippingExpense', description: 'Shipping costs', key: 'shipping' },
      { amount: po.landedCosts.customs, field: 'customsExpense', description: 'Customs fees', key: 'customs' },
      { amount: po.landedCosts.duties, field: 'dutiesExpense', description: 'Import duties', key: 'duties' },
      { amount: po.landedCosts.insurance, field: 'insuranceExpense', description: 'Insurance', key: 'insurance' },
      { amount: po.landedCosts.handling, field: 'handlingExpense', description: 'Handling fees', key: 'handling' },
      { amount: po.landedCosts.other, field: 'otherExpense', description: 'Other costs', key: 'other' },
    ];

    for (const comp of componentsToAdd) {
      const amount = comp.amount;
      if (amount > 0) {
        lines.push({
          DetailType: 'AccountBasedExpenseLineDetail',
          Amount: amount,
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: resolveLandedAccount(comp.field) },
            TaxCodeRef: { value: landedTaxCode },
          },
          Description: `[${po.poNumber}] ${comp.description}${suffix}`,
        });
      }
    }
  }

  return lines;
}

// ----------------------------------------------------------------------------
// LANDED COST SUPPLIER GROUPING (server-side)
// ----------------------------------------------------------------------------

/**
 * Group landed cost components by their assigned supplier.
 * Mirrors the frontend getLandedCostSupplierGroups() helper.
 */
function buildSupplierGroups(po) {
  const overrides = (po.landedCosts && po.landedCosts.supplierOverrides) || {};
  const mainSupplierId = po.supplierId || '';
  const mainSupplierName = po.supplierName || '';

  const COMPONENT_META = {
    shipping: { field: 'shippingExpense', desc: 'Shipping costs' },
    customs: { field: 'customsExpense', desc: 'Customs fees' },
    duties: { field: 'dutiesExpense', desc: 'Import duties' },
    insurance: { field: 'insuranceExpense', desc: 'Insurance' },
    handling: { field: 'handlingExpense', desc: 'Handling fees' },
    other: { field: 'otherExpense', desc: 'Other costs' },
  };

  const groups = new Map();

  // Main supplier always gets line items
  groups.set(mainSupplierId, {
    supplierId: mainSupplierId,
    supplierName: mainSupplierName,
    components: [],
    totalAmount: 0,
    includesLineItems: true,
  });

  for (const [key, meta] of Object.entries(COMPONENT_META)) {
    const amount = po.landedCosts[key];
    if (!amount || amount <= 0) continue;

    const override = overrides[key];
    const targetId = (override && override.supplierId) ? override.supplierId : mainSupplierId;
    const targetName = (override && override.supplierName) ? override.supplierName : mainSupplierName;

    if (!groups.has(targetId)) {
      groups.set(targetId, {
        supplierId: targetId,
        supplierName: targetName,
        components: [],
        totalAmount: 0,
        includesLineItems: false,
      });
    }

    const group = groups.get(targetId);
    group.components.push({ key, amount, field: meta.field, description: meta.desc });
    group.totalAmount += amount;
  }

  return Array.from(groups.values());
}

/**
 * Check whether a PO has landed cost supplier overrides pointing to different suppliers.
 */
function hasMultiSupplierOverrides(po) {
  const overrides = (po.landedCosts && po.landedCosts.supplierOverrides) || {};
  return Object.entries(overrides).some(([key, val]) => {
    return val && val.supplierId && val.supplierId !== po.supplierId && po.landedCosts[key] > 0;
  });
}

// ----------------------------------------------------------------------------
// QBO CUSTOM FIELDS BUILDER
// ----------------------------------------------------------------------------

/**
 * Build QBO CustomField array for PO traceability.
 * Uses the "PO No" and "Doc No" custom fields configured in QBO config.
 */
function buildCustomFields(config, po, docNumber) {
  const fields = [];
  const cfMapping = config.customFieldMapping || {};

  if (cfMapping.poNumber) {
    fields.push({
      DefinitionId: cfMapping.poNumber,
      Name: 'PO No',
      Type: 'StringType',
      StringValue: po.poNumber || '',
    });
  }

  if (cfMapping.docNumber && docNumber) {
    fields.push({
      DefinitionId: cfMapping.docNumber,
      Name: 'Doc No',
      Type: 'StringType',
      StringValue: String(docNumber),
    });
  }

  return fields.length > 0 ? fields : undefined;
}

/**
 * Build landed-cost-only bill lines for a subset of components.
 * Used when creating a separate bill for a non-main supplier.
 */
async function mapLandedCostComponentsToLines(components, config, isForeign, poNumber) {
  const landedCostMethod = config.landedCostMethod || 'capitalize';
  const availableTaxCodes = await getQBOTaxCodes();
  const landedTaxCode = resolveBillTaxCode(config, { isForeignSupplier: isForeign, isLandedCost: true }, availableTaxCodes);

  const resolveLandedAccount = (expenseField) => {
    if (landedCostMethod === 'capitalize') {
      return config.accountMapping.inventory;
    }
    return config.accountMapping[expenseField] || config.accountMapping.inventory;
  };

  const suffix = landedCostMethod === 'capitalize' ? ' (capitalized to inventory)' : '';

  return components.map(comp => ({
    DetailType: 'AccountBasedExpenseLineDetail',
    Amount: comp.amount,
    AccountBasedExpenseLineDetail: {
      AccountRef: { value: resolveLandedAccount(comp.field) },
      TaxCodeRef: { value: landedTaxCode },
    },
    Description: `[${poNumber}] ${comp.description}${suffix}`,
  }));
}

// ----------------------------------------------------------------------------
// BILL CREATION
// ----------------------------------------------------------------------------

/**
 * Create Bill in QuickBooks from Purchase Order
 */
async function createBillFromPO(poId) {
  console.log(`[BillSync] Creating bill for PO ${poId}`);
  _cachedTaxCodes = null; // Reset tax code cache for fresh resolution

  // 1. Fetch PO
  const poDoc = await db.collection('purchaseOrders').doc(poId).get();
  if (!poDoc.exists) {
    throw new Error(`Purchase Order ${poId} not found`);
  }

  const po = { id: poDoc.id, ...poDoc.data() };

  // 2. Check if already synced — verify the bill still exists in QBO
  if (po.qboBillId) {
    console.log(`[BillSync] PO ${poId} has recorded bill ${po.qboBillId} — verifying it exists in QBO...`);
    const existingBill = await fetchBillIfExists(po.qboBillId);

    if (existingBill) {
      console.log(`[BillSync] Bill ${po.qboBillId} confirmed in QBO, skipping creation`);
      return {
        action: 'skipped',
        reason: 'already_synced',
        qboBillId: po.qboBillId,
      };
    }

    // Bill was deleted in QBO — reset sync fields and re-create
    console.log(`[BillSync] Bill ${po.qboBillId} NOT found in QBO (deleted?). Resetting sync and re-creating...`);
    await clearBillSyncFields(poId);
    // Continue to re-create the bill below
  }

  // 2b. Check for multi-supplier landed cost overrides
  if (hasMultiSupplierOverrides(po)) {
    // Fetch config for multi-supplier path
    const configDoc = await db.collection('integrations').doc('quickbooks_config').get();
    if (!configDoc.exists || !configDoc.data().isConfigured) {
      throw new Error('QuickBooks account mapping not configured. Please configure account mappings first.');
    }
    return await createMultiSupplierBills(poId, po, configDoc.data());
  }

  // 3. Fetch supplier (single-supplier legacy path)
  if (!po.supplierId) {
    throw new Error(`PO ${poId} has no supplierId`);
  }

  const supplierDoc = await db.collection('platform').doc('suppliers').collection('records').doc(po.supplierId).get();
  if (!supplierDoc.exists) {
    throw new Error(`Supplier ${po.supplierId} not found`);
  }

  const supplier = { id: supplierDoc.id, ...supplierDoc.data() };

  // 4. Ensure supplier has a QuickBooks Vendor — auto-sync if missing
  if (!supplier.externalIds?.quickbooksId) {
    console.log(`[BillSync] Supplier ${supplier.name} not synced to QBO — auto-syncing vendor...`);
    const vendorResult = await syncSupplierToQBO(po.supplierId);
    console.log(`[BillSync] Vendor auto-sync result:`, vendorResult);

    // Re-fetch the supplier to get the updated quickbooksId
    const refreshedDoc = await db.collection('platform').doc('suppliers').collection('records').doc(po.supplierId).get();
    const refreshed = { id: refreshedDoc.id, ...refreshedDoc.data() };

    if (!refreshed.externalIds?.quickbooksId) {
      throw new Error(
        `Supplier ${supplier.name} could not be synced to QuickBooks. Please check vendor details and try again.`
      );
    }

    // Update the local supplier reference with the new QBO ID
    supplier.externalIds = refreshed.externalIds;
  }

  // 5. Fetch QBO config
  const configDoc = await db.collection('integrations').doc('quickbooks_config').get();
  if (!configDoc.exists || !configDoc.data().isConfigured) {
    throw new Error(
      'QuickBooks account mapping not configured. Please configure account mappings first.'
    );
  }

  const config = configDoc.data();

  // 5b. Fetch the QBO Vendor to check its actual currency
  let vendorCurrency = FUNCTIONAL_CURRENCY;
  try {
    const qboVendor = await qboRequest(`/vendor/${supplier.externalIds.quickbooksId}`);
    vendorCurrency = qboVendor.Vendor?.CurrencyRef?.value || FUNCTIONAL_CURRENCY;
    console.log(`[BillSync] QBO Vendor currency: ${vendorCurrency}`);
  } catch (err) {
    console.warn(`[BillSync] Could not fetch vendor currency, assuming ${FUNCTIONAL_CURRENCY}:`, err.message);
  }

  // 6. Build Bill object
  const txnDate = po.approvedAt
    ? admin.firestore.Timestamp.fromDate(new Date(po.approvedAt.toDate())).toDate().toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  // Determine if the supplier is foreign (non-Ugandan)
  const isForeign = isForeignSupplier(supplier);
  console.log(`[BillSync] Supplier "${supplier.name}" — foreign: ${isForeign}, country: "${supplier.address?.country || 'N/A'}"`);

  // Determine PO currency (defaults to functional currency UGX)
  const poCurrency = po.totals?.currency || po.lineItems?.[0]?.currency || FUNCTIONAL_CURRENCY;

  // Determine if we need to convert amounts.
  // If the PO is in a foreign currency but the QBO Vendor is in home currency (UGX),
  // we must convert all amounts to UGX so the bill matches the vendor's currency.
  const vendorIsHomeCurrency = vendorCurrency === FUNCTIONAL_CURRENCY;
  const poIsForeignCurrency = poCurrency !== FUNCTIONAL_CURRENCY;
  const needsConversion = poIsForeignCurrency && vendorIsHomeCurrency;

  let conversionRate = 1;
  if (needsConversion) {
    conversionRate = po.exchangeRateOverride
      || po.lineItems?.[0]?.exchangeRateToUGX
      || DEFAULT_EXCHANGE_RATES_TO_UGX[poCurrency]
      || 1;
    console.log(`[BillSync] Vendor is ${vendorCurrency} but PO is ${poCurrency} — converting amounts at rate ${conversionRate}`);
  }

  const billLines = await mapPOLinesToBillLines(po, config, isForeign);

  // If conversion is needed, multiply all line amounts by the exchange rate
  if (needsConversion && conversionRate !== 1) {
    for (const line of billLines) {
      line.Amount = Math.round(line.Amount * conversionRate * 100) / 100;
      if (line.ItemBasedExpenseLineDetail) {
        line.ItemBasedExpenseLineDetail.UnitPrice = Math.round(line.ItemBasedExpenseLineDetail.UnitPrice * conversionRate * 100) / 100;
      }
    }
  }

  const billPayload = {
    VendorRef: { value: supplier.externalIds.quickbooksId },
    DocNumber: po.poNumber,
    TxnDate: txnDate,
    DueDate: calculateDueDate(txnDate, supplier.paymentTermsDays),
    Line: billLines,
    PrivateNote: needsConversion
      ? `DawinOS Purchase Order: ${po.poNumber} (converted from ${poCurrency} at ${conversionRate})`
      : `DawinOS Purchase Order: ${po.poNumber}`,
    // Tax is specified per-line; tell QBO amounts are exclusive of tax
    GlobalTaxCalculation: 'TaxExcluded',
  };

  // Set CurrencyRef and ExchangeRate when the QBO Vendor is in a foreign currency.
  // QBO requires BOTH fields for foreign currency transactions.
  // If the vendor is in home currency (UGX), we already converted the amounts above.
  if (!vendorIsHomeCurrency && vendorCurrency !== FUNCTIONAL_CURRENCY) {
    billPayload.CurrencyRef = { value: vendorCurrency };
    const exchangeRate = po.exchangeRateOverride
      || po.lineItems?.[0]?.exchangeRateToUGX
      || DEFAULT_EXCHANGE_RATES_TO_UGX[vendorCurrency]
      || DEFAULT_EXCHANGE_RATES_TO_UGX[poCurrency]
      || null;
    if (exchangeRate && exchangeRate > 0) {
      billPayload.ExchangeRate = exchangeRate;
      console.log(`[BillSync] Foreign currency bill — vendor: ${vendorCurrency}, CurrencyRef: ${vendorCurrency}, exchange rate: ${exchangeRate}`);
    } else {
      billPayload.ExchangeRate = 1;
      console.warn(`[BillSync] Foreign currency vendor ${vendorCurrency} with no exchange rate — defaulting to 1`);
    }
  }

  // Add payment terms if available
  if (supplier.paymentTermsDays) {
    billPayload.SalesTermRef = { name: getQBOTermsName(supplier.paymentTermsDays) };
  }

  // 7. Create Bill in QuickBooks
  try {
    console.log('[BillSync] Creating bill in QuickBooks:', JSON.stringify(billPayload, null, 2));
    const response = await qboRequest('/bill', {
      method: 'POST',
      body: JSON.stringify(billPayload),
    });

    const bill = response.Bill;
    console.log(`[BillSync] Bill created: ${bill.Id} - Doc #${bill.DocNumber}`);

    // 8. Update PO with bill information
    const poUpdate = {
      qboBillId: bill.Id,
      qboSyncStatus: 'synced',
      qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      qboSyncError: admin.firestore.FieldValue.delete(),
    };
    if (bill.DocNumber) {
      poUpdate.qboBillDocNumber = bill.DocNumber;
    }
    await db.collection('purchaseOrders').doc(poId).update(poUpdate);

    return {
      action: 'created',
      qboBillId: bill.Id,
      qboBillDocNumber: bill.DocNumber || null,
    };
  } catch (error) {
    console.error(`[BillSync] Error creating bill for PO ${poId}:`, error);

    // Update PO with error
    await db.collection('purchaseOrders').doc(poId).update({
      qboSyncStatus: 'error',
      qboSyncError: error.message || 'Unknown error creating bill',
      qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    throw error;
  }
}

// ----------------------------------------------------------------------------
// MULTI-SUPPLIER BILL CREATION
// ----------------------------------------------------------------------------

/**
 * Create separate bills for each supplier involved in a PO's landed costs.
 * The main supplier's bill includes PO line items + any cost components assigned to them.
 * Each additional supplier gets a bill with only their assigned cost components.
 */
async function createMultiSupplierBills(poId, po, config) {
  console.log(`[BillSync] Creating multi-supplier bills for PO ${poId}`);

  const groups = buildSupplierGroups(po);
  console.log(`[BillSync] ${groups.length} supplier groups identified`);

  const txnDate = po.approvedAt
    ? admin.firestore.Timestamp.fromDate(new Date(po.approvedAt.toDate())).toDate().toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const results = {};
  const errors = {};
  let billIndex = 0;

  for (const group of groups) {
    billIndex++;
    const supplierLabel = group.supplierName || group.supplierId;
    console.log(`[BillSync] Processing group ${billIndex}/${groups.length}: ${supplierLabel} (${group.includesLineItems ? 'main + ' : ''}${group.components.length} components)`);

    try {
      // 1. Fetch supplier
      const supplierDoc = await db.collection('platform').doc('suppliers').collection('records').doc(group.supplierId).get();
      if (!supplierDoc.exists) {
        throw new Error(`Supplier ${group.supplierId} (${supplierLabel}) not found`);
      }
      let supplier = { id: supplierDoc.id, ...supplierDoc.data() };

      // 2. Ensure QBO vendor exists
      if (!supplier.externalIds?.quickbooksId) {
        console.log(`[BillSync] Auto-syncing vendor for ${supplierLabel}...`);
        await syncSupplierToQBO(group.supplierId);
        const refreshedDoc = await db.collection('platform').doc('suppliers').collection('records').doc(group.supplierId).get();
        supplier = { id: refreshedDoc.id, ...refreshedDoc.data() };
        if (!supplier.externalIds?.quickbooksId) {
          throw new Error(`Supplier ${supplierLabel} could not be synced to QuickBooks`);
        }
      }

      // 3. Determine currency and conversion
      const isForeign = isForeignSupplier(supplier);
      let vendorCurrency = FUNCTIONAL_CURRENCY;
      try {
        const qboVendor = await qboRequest(`/vendor/${supplier.externalIds.quickbooksId}`);
        vendorCurrency = qboVendor.Vendor?.CurrencyRef?.value || FUNCTIONAL_CURRENCY;
      } catch (err) {
        console.warn(`[BillSync] Could not fetch vendor currency for ${supplierLabel}, assuming ${FUNCTIONAL_CURRENCY}`);
      }

      const poCurrency = po.totals?.currency || po.lineItems?.[0]?.currency || FUNCTIONAL_CURRENCY;
      const vendorIsHomeCurrency = vendorCurrency === FUNCTIONAL_CURRENCY;
      const poIsForeignCurrency = poCurrency !== FUNCTIONAL_CURRENCY;
      const needsConversion = poIsForeignCurrency && vendorIsHomeCurrency;

      let conversionRate = 1;
      if (needsConversion) {
        conversionRate = po.exchangeRateOverride
          || po.lineItems?.[0]?.exchangeRateToUGX
          || DEFAULT_EXCHANGE_RATES_TO_UGX[poCurrency]
          || 1;
      }

      // 4. Build bill lines
      let billLines = [];

      if (group.includesLineItems) {
        // Main supplier: PO line items + their landed cost components
        billLines = await mapPOLinesToBillLines(po, config, isForeign, group.components);
      }

      // Add landed cost component lines for this group
      if (group.components.length > 0 && !group.includesLineItems) {
        billLines = await mapLandedCostComponentsToLines(group.components, config, isForeign, po.poNumber);
      }

      // 5. Currency conversion
      if (needsConversion && conversionRate !== 1) {
        for (const line of billLines) {
          line.Amount = Math.round(line.Amount * conversionRate * 100) / 100;
          if (line.ItemBasedExpenseLineDetail) {
            line.ItemBasedExpenseLineDetail.UnitPrice = Math.round(line.ItemBasedExpenseLineDetail.UnitPrice * conversionRate * 100) / 100;
          }
        }
      }

      // 6. Build bill payload
      const componentNames = group.components.map(c => c.key).join(', ');
      const noteComponents = group.includesLineItems
        ? (componentNames ? `Line items + ${componentNames}` : 'Line items')
        : `Landed costs: ${componentNames}`;

      // DocNumber: use PO number for main supplier, suffix for additional suppliers
      const docNumber = group.includesLineItems
        ? po.poNumber
        : `${po.poNumber}-${componentNames.replace(/,\s*/g, '-')}`;

      const billPayload = {
        VendorRef: { value: supplier.externalIds.quickbooksId },
        DocNumber: docNumber,
        TxnDate: txnDate,
        DueDate: calculateDueDate(txnDate, supplier.paymentTermsDays),
        Line: billLines,
        PrivateNote: needsConversion
          ? `DawinOS PO: ${po.poNumber} — ${noteComponents} (converted from ${poCurrency} at ${conversionRate})`
          : `DawinOS PO: ${po.poNumber} — ${noteComponents}`,
        GlobalTaxCalculation: 'TaxExcluded',
      };

      // CurrencyRef + ExchangeRate for foreign-currency vendors (QBO requires both)
      if (!vendorIsHomeCurrency && vendorCurrency !== FUNCTIONAL_CURRENCY) {
        billPayload.CurrencyRef = { value: vendorCurrency };
        const exchangeRate = po.exchangeRateOverride
          || po.lineItems?.[0]?.exchangeRateToUGX
          || DEFAULT_EXCHANGE_RATES_TO_UGX[vendorCurrency]
          || DEFAULT_EXCHANGE_RATES_TO_UGX[poCurrency]
          || null;
        billPayload.ExchangeRate = (exchangeRate && exchangeRate > 0) ? exchangeRate : 1;
      }

      // Payment terms
      if (supplier.paymentTermsDays) {
        billPayload.SalesTermRef = { name: getQBOTermsName(supplier.paymentTermsDays) };
      }

      // 7. Create bill in QBO
      console.log(`[BillSync] Creating bill #${billIndex} for ${supplierLabel}:`, JSON.stringify(billPayload, null, 2));
      const response = await qboRequest('/bill', {
        method: 'POST',
        body: JSON.stringify(billPayload),
      });

      const bill = response.Bill;
      console.log(`[BillSync] Bill #${billIndex} created: ${bill.Id} - Doc #${bill.DocNumber}`);

      results[group.supplierId] = {
        qboBillId: bill.Id,
        qboBillDocNumber: bill.DocNumber || null,
        syncStatus: 'synced',
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
        components: group.includesLineItems
          ? ['lineItems', ...group.components.map(c => c.key)]
          : group.components.map(c => c.key),
      };
    } catch (err) {
      console.error(`[BillSync] Error creating bill for ${supplierLabel}:`, err);
      errors[group.supplierId] = err.message;
      results[group.supplierId] = {
        qboBillId: null,
        syncStatus: 'error',
        syncError: err.message,
        components: group.includesLineItems
          ? ['lineItems', ...group.components.map(c => c.key)]
          : group.components.map(c => c.key),
      };
    }
  }

  // 8. Update PO with multi-bill results
  const hasErrors = Object.keys(errors).length > 0;
  const overallStatus = hasErrors ? 'error' : 'synced';

  const poUpdate = {
    qboBills: results,
    qboSyncStatus: overallStatus,
    qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Also set legacy qboBillId to the main supplier's bill for backward compat
  const mainResult = results[po.supplierId];
  if (mainResult && mainResult.qboBillId) {
    poUpdate.qboBillId = mainResult.qboBillId;
    if (mainResult.qboBillDocNumber) {
      poUpdate.qboBillDocNumber = mainResult.qboBillDocNumber;
    }
  }

  if (hasErrors) {
    poUpdate.qboSyncError = `Failed to create ${Object.keys(errors).length} of ${groups.length} bills`;
  } else {
    poUpdate.qboSyncError = admin.firestore.FieldValue.delete();
  }

  await db.collection('purchaseOrders').doc(poId).update(poUpdate);

  return {
    action: 'created_multi',
    billCount: Object.keys(results).length,
    results,
    errors: hasErrors ? errors : undefined,
  };
}

// ----------------------------------------------------------------------------
// CALLABLE FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Manual bill sync (callable from UI)
 */
exports.syncPOToBill = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { poId } = request.data;
  if (!poId) {
    throw new HttpsError('invalid-argument', 'poId is required');
  }

  try {
    const result = await createBillFromPO(poId);
    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error('[BillSync] Manual sync failed:', error);
    throw new HttpsError('internal', error.message || 'Failed to create bill in QuickBooks');
  }
});

/**
 * Bulk bill sync for multiple POs
 */
exports.syncMultiplePOsToBills = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
  timeoutSeconds: 540, // 9 minutes for bulk operations
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { poIds } = request.data;
  if (!poIds || !Array.isArray(poIds)) {
    throw new HttpsError('invalid-argument', 'poIds array is required');
  }

  const results = [];
  const errors = [];

  for (const poId of poIds) {
    try {
      const result = await createBillFromPO(poId);
      results.push({ poId, ...result });
    } catch (error) {
      errors.push({ poId, error: error.message });
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

// ----------------------------------------------------------------------------
// BILL UPDATE (for receipt corrections)
// ----------------------------------------------------------------------------

/**
 * Update multiple QBO Bills when a PO has multi-supplier landed cost overrides.
 * Each bill is updated independently per supplier group.
 */
async function updateMultiSupplierBills(poId, po) {
  console.log(`[BillSync] Updating multi-supplier bills for PO ${poId}`);

  const configDoc = await db.collection('integrations').doc('quickbooks_config').get();
  if (!configDoc.exists || !configDoc.data().isConfigured) {
    throw new Error('QuickBooks account mapping not configured.');
  }
  const config = configDoc.data();

  const groups = buildSupplierGroups(po);
  console.log(`[BillSync] ${groups.length} supplier groups for update`);

  const updatedResults = { ...(po.qboBills || {}) };
  const errors = {};

  for (const group of groups) {
    const supplierLabel = group.supplierName || group.supplierId;
    const existingBillInfo = po.qboBills[group.supplierId];

    if (!existingBillInfo || !existingBillInfo.qboBillId) {
      console.log(`[BillSync] No existing bill for supplier ${supplierLabel} — skipping update`);
      continue;
    }

    try {
      // 1. Fetch existing bill for SyncToken
      const existingBill = await qboRequest(`/bill/${existingBillInfo.qboBillId}`);
      const currentBill = existingBill.Bill;
      if (!currentBill || !currentBill.SyncToken) {
        throw new Error(`Could not retrieve QBO Bill ${existingBillInfo.qboBillId}`);
      }

      // 2. Fetch supplier for foreign/domestic detection
      let isForeign = false;
      let supplierQboVendorId = null;
      if (group.supplierId) {
        const supplierDoc = await db.collection('platform').doc('suppliers').collection('records').doc(group.supplierId).get();
        if (supplierDoc.exists) {
          const supplier = { id: supplierDoc.id, ...supplierDoc.data() };
          isForeign = isForeignSupplier(supplier);
          supplierQboVendorId = supplier.externalIds?.quickbooksId || null;
        }
      }

      // 3. Currency handling
      const vendorCurrency = currentBill.CurrencyRef?.value || FUNCTIONAL_CURRENCY;
      const poCurrency = po.totals?.currency || po.lineItems?.[0]?.currency || FUNCTIONAL_CURRENCY;
      const vendorIsHomeCurrency = vendorCurrency === FUNCTIONAL_CURRENCY;
      const poIsForeignCurrency = poCurrency !== FUNCTIONAL_CURRENCY;
      const needsConversion = poIsForeignCurrency && vendorIsHomeCurrency;

      let conversionRate = 1;
      if (needsConversion) {
        conversionRate = po.exchangeRateOverride
          || po.lineItems?.[0]?.exchangeRateToUGX
          || DEFAULT_EXCHANGE_RATES_TO_UGX[poCurrency]
          || 1;
      }

      // 4. Rebuild bill lines for this group
      let billLines = [];
      if (group.includesLineItems) {
        billLines = await mapPOLinesToBillLines(po, config, isForeign, group.components);
      }
      if (group.components.length > 0 && !group.includesLineItems) {
        billLines = await mapLandedCostComponentsToLines(group.components, config, isForeign, po.poNumber);
      }

      // 5. Currency conversion
      if (needsConversion && conversionRate !== 1) {
        for (const line of billLines) {
          line.Amount = Math.round(line.Amount * conversionRate * 100) / 100;
          if (line.ItemBasedExpenseLineDetail) {
            line.ItemBasedExpenseLineDetail.UnitPrice = Math.round(line.ItemBasedExpenseLineDetail.UnitPrice * conversionRate * 100) / 100;
          }
        }
      }

      // 6. Build update payload
      const componentNames = group.components.map(c => c.key).join(', ');
      const noteComponents = group.includesLineItems
        ? (componentNames ? `Line items + ${componentNames}` : 'Line items')
        : `Landed costs: ${componentNames}`;

      const vendorRef = currentBill.VendorRef || (supplierQboVendorId ? { value: supplierQboVendorId } : null);
      if (!vendorRef || !vendorRef.value) {
        throw new Error(`Could not resolve VendorRef for bill update (${existingBillInfo.qboBillId})`);
      }

      const updatePayload = {
        Id: existingBillInfo.qboBillId,
        SyncToken: currentBill.SyncToken,
        sparse: true,
        VendorRef: vendorRef,
        Line: billLines,
        PrivateNote: needsConversion
          ? `DawinOS PO: ${po.poNumber} — ${noteComponents} (corrected, converted from ${poCurrency} at ${conversionRate})`
          : `DawinOS PO: ${po.poNumber} — ${noteComponents} (corrected)`,
        GlobalTaxCalculation: 'TaxExcluded',
      };

      // CurrencyRef + ExchangeRate for foreign-currency vendors (QBO requires both)
      if (!vendorIsHomeCurrency && vendorCurrency !== FUNCTIONAL_CURRENCY) {
        updatePayload.CurrencyRef = { value: vendorCurrency };
        const exchangeRate = po.exchangeRateOverride
          || po.lineItems?.[0]?.exchangeRateToUGX
          || DEFAULT_EXCHANGE_RATES_TO_UGX[vendorCurrency]
          || DEFAULT_EXCHANGE_RATES_TO_UGX[poCurrency]
          || null;
        updatePayload.ExchangeRate = (exchangeRate && exchangeRate > 0) ? exchangeRate : 1;
      }

      // 7. Update bill in QBO
      console.log(`[BillSync] Updating bill for ${supplierLabel}:`, JSON.stringify(updatePayload, null, 2));
      const response = await qboRequest('/bill', {
        method: 'POST',
        body: JSON.stringify(updatePayload),
      });

      const updatedBill = response.Bill;
      console.log(`[BillSync] Bill updated for ${supplierLabel}: ${updatedBill.Id} - Doc #${updatedBill.DocNumber}`);

      const successEntry = {
        ...existingBillInfo,
        qboBillDocNumber: updatedBill.DocNumber || existingBillInfo.qboBillDocNumber,
        syncStatus: 'synced',
        syncedAt: new Date(),
      };
      delete successEntry.syncError;
      updatedResults[group.supplierId] = successEntry;
    } catch (err) {
      console.error(`[BillSync] Error updating bill for ${supplierLabel}:`, err);
      errors[group.supplierId] = err.message;
      updatedResults[group.supplierId] = {
        ...existingBillInfo,
        syncStatus: 'error',
        syncError: err.message,
      };
    }
  }

  // 8. Update PO with results
  const hasErrors = Object.keys(errors).length > 0;
  const overallStatus = hasErrors ? 'error' : 'synced';

  const poUpdate = {
    qboBills: updatedResults,
    qboSyncStatus: overallStatus,
    qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (hasErrors) {
    poUpdate.qboSyncError = `Errors updating bills for: ${Object.keys(errors).join(', ')}`;
  } else {
    poUpdate.qboSyncError = admin.firestore.FieldValue.delete();
  }

  await db.collection('purchaseOrders').doc(poId).update(poUpdate);

  return {
    action: 'updated_multi',
    billCount: Object.keys(updatedResults).length,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * Update an existing QBO Bill after a goods receipt correction.
 * Fetches the existing Bill to get SyncToken, rebuilds line items
 * from corrected PO data, and pushes a sparse update to QBO.
 */
async function updateBillFromPO(poId) {
  console.log(`[BillSync] Updating bill for PO ${poId} (receipt correction)`);
  _cachedTaxCodes = null; // Reset tax code cache for fresh resolution

  // 1. Fetch PO
  const poDoc = await db.collection('purchaseOrders').doc(poId).get();
  if (!poDoc.exists) {
    throw new Error(`Purchase Order ${poId} not found`);
  }

  const po = { id: poDoc.id, ...poDoc.data() };

  // 1b. Multi-supplier path: if qboBills exists, update each bill independently
  if (po.qboBills && Object.keys(po.qboBills).length > 0) {
    return await updateMultiSupplierBills(poId, po);
  }

  // 2. Verify a bill exists (legacy single-bill path)
  if (!po.qboBillId) {
    throw new Error(`PO ${poId} has no QBO Bill to update`);
  }

  // 3. Fetch existing QBO Bill to get SyncToken
  const existingBill = await qboRequest(`/bill/${po.qboBillId}`);
  const currentBill = existingBill.Bill;

  if (!currentBill || !currentBill.SyncToken) {
    throw new Error(`Could not retrieve QBO Bill ${po.qboBillId} for update`);
  }

  // 4. Fetch supplier to determine foreign/domestic tax treatment
  let isForeign = false;
  let supplierQboVendorId = null;
  if (po.supplierId) {
    const supplierDoc = await db.collection('platform').doc('suppliers').collection('records').doc(po.supplierId).get();
    if (supplierDoc.exists) {
      const supplier = { id: supplierDoc.id, ...supplierDoc.data() };
      isForeign = isForeignSupplier(supplier);
      supplierQboVendorId = supplier.externalIds?.quickbooksId || null;
      console.log(`[BillSync] Update — Supplier "${supplier.name}" foreign: ${isForeign}`);
    }
  }

  // 5. Fetch QBO config
  const configDoc = await db.collection('integrations').doc('quickbooks_config').get();
  if (!configDoc.exists || !configDoc.data().isConfigured) {
    throw new Error(
      'QuickBooks account mapping not configured. Please configure account mappings first.'
    );
  }

  const config = configDoc.data();

  // Determine the vendor's actual currency from the existing bill
  const vendorCurrency = currentBill.CurrencyRef?.value || FUNCTIONAL_CURRENCY;
  const poCurrency = po.totals?.currency || po.lineItems?.[0]?.currency || FUNCTIONAL_CURRENCY;
  const vendorIsHomeCurrency = vendorCurrency === FUNCTIONAL_CURRENCY;
  const poIsForeignCurrency = poCurrency !== FUNCTIONAL_CURRENCY;
  const needsConversion = poIsForeignCurrency && vendorIsHomeCurrency;

  let conversionRate = 1;
  if (needsConversion) {
    conversionRate = po.exchangeRateOverride
      || po.lineItems?.[0]?.exchangeRateToUGX
      || DEFAULT_EXCHANGE_RATES_TO_UGX[poCurrency]
      || 1;
    console.log(`[BillSync] Update — Vendor is ${vendorCurrency} but PO is ${poCurrency}, converting at ${conversionRate}`);
  }

  // 6. Rebuild line items from corrected PO data
  const billLines = await mapPOLinesToBillLines(po, config, isForeign);

  // Convert amounts if vendor currency doesn't match PO currency
  if (needsConversion && conversionRate !== 1) {
    for (const line of billLines) {
      line.Amount = Math.round(line.Amount * conversionRate * 100) / 100;
      if (line.ItemBasedExpenseLineDetail) {
        line.ItemBasedExpenseLineDetail.UnitPrice = Math.round(line.ItemBasedExpenseLineDetail.UnitPrice * conversionRate * 100) / 100;
      }
    }
  }

  // 7. Build sparse update payload
  const vendorRef = currentBill.VendorRef || (supplierQboVendorId ? { value: supplierQboVendorId } : null);
  if (!vendorRef || !vendorRef.value) {
    throw new Error(`Could not resolve VendorRef for bill update (${po.qboBillId})`);
  }

  const updatePayload = {
    Id: po.qboBillId,
    SyncToken: currentBill.SyncToken,
    sparse: true,
    VendorRef: vendorRef,
    Line: billLines,
    PrivateNote: needsConversion
      ? `DawinOS Purchase Order: ${po.poNumber} (corrected, converted from ${poCurrency} at ${conversionRate})`
      : `DawinOS Purchase Order: ${po.poNumber} (corrected)`,
    GlobalTaxCalculation: 'TaxExcluded',
  };

  // Note: QBO API does not support custom fields on Bills (silently ignored)

  // Set CurrencyRef + ExchangeRate when the vendor is in a foreign currency (QBO requires both)
  if (!vendorIsHomeCurrency && vendorCurrency !== FUNCTIONAL_CURRENCY) {
    updatePayload.CurrencyRef = { value: vendorCurrency };
    const exchangeRate = po.exchangeRateOverride
      || po.lineItems?.[0]?.exchangeRateToUGX
      || DEFAULT_EXCHANGE_RATES_TO_UGX[vendorCurrency]
      || DEFAULT_EXCHANGE_RATES_TO_UGX[poCurrency]
      || null;
    if (exchangeRate && exchangeRate > 0) {
      updatePayload.ExchangeRate = exchangeRate;
    } else {
      updatePayload.ExchangeRate = 1;
      console.warn(`[BillSync] Update — foreign vendor ${vendorCurrency} with no exchange rate, defaulting to 1`);
    }
  }

  // 8. Update Bill in QuickBooks
  try {
    console.log('[BillSync] Updating bill in QuickBooks:', JSON.stringify(updatePayload, null, 2));
    const response = await qboRequest('/bill', {
      method: 'POST',
      body: JSON.stringify(updatePayload),
    });

    const updatedBill = response.Bill;
    console.log(`[BillSync] Bill updated: ${updatedBill.Id} - Doc #${updatedBill.DocNumber}`);

    // 9. Update PO sync status
    await db.collection('purchaseOrders').doc(poId).update({
      qboSyncStatus: 'synced',
      qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      qboSyncError: admin.firestore.FieldValue.delete(),
    });

    return {
      action: 'updated',
      qboBillId: updatedBill.Id,
      qboBillDocNumber: updatedBill.DocNumber,
    };
  } catch (error) {
    console.error(`[BillSync] Error updating bill for PO ${poId}:`, error);

    // Update PO with error
    await db.collection('purchaseOrders').doc(poId).update({
      qboSyncStatus: 'error',
      qboSyncError: error.message || 'Unknown error updating bill',
      qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    throw error;
  }
}

// ----------------------------------------------------------------------------
// CALLABLE: BILL CORRECTION SYNC
// ----------------------------------------------------------------------------

/**
 * Manual bill correction sync (callable from UI after receipt correction)
 */
exports.syncBillCorrection = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { poId } = request.data;
  if (!poId) {
    throw new HttpsError('invalid-argument', 'poId is required');
  }

  try {
    const result = await updateBillFromPO(poId);
    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error('[BillSync] Bill correction sync failed:', error);
    throw new HttpsError('internal', error.message || 'Failed to update bill in QuickBooks');
  }
});

// ----------------------------------------------------------------------------
// CALLABLE: VERIFY BILL SYNC STATUS
// ----------------------------------------------------------------------------

/**
 * Verify whether the QBO Bill linked to a PO still exists.
 * If the bill has been deleted in QBO, resets DawinOS sync status to 'unsynced'.
 */
exports.verifyBillSync = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { poId } = request.data;
  if (!poId) {
    throw new HttpsError('invalid-argument', 'poId is required');
  }

  const poDoc = await db.collection('purchaseOrders').doc(poId).get();
  if (!poDoc.exists) {
    throw new HttpsError('not-found', `Purchase Order ${poId} not found`);
  }

  const po = poDoc.data();

  if (!po.qboBillId) {
    return {
      success: true,
      status: 'not_synced',
      message: 'PO has no linked QBO bill',
    };
  }

  try {
    const bill = await fetchBillIfExists(po.qboBillId);

    if (bill) {
      return {
        success: true,
        status: 'synced',
        qboBillId: po.qboBillId,
        qboBillDocNumber: bill.DocNumber || null,
        message: 'Bill exists in QuickBooks',
      };
    }

    // Bill was deleted in QBO — reset
    console.log(`[BillSync] verifyBillSync: Bill ${po.qboBillId} not found in QBO — resetting PO ${poId}`);
    await clearBillSyncFields(poId);

    return {
      success: true,
      status: 'unsynced',
      previousBillId: po.qboBillId,
      message: 'Bill was deleted in QuickBooks. PO has been marked as unsynced and can be re-synced.',
    };
  } catch (error) {
    console.error(`[BillSync] verifyBillSync error for PO ${poId}:`, error);
    throw new HttpsError('internal', error.message || 'Failed to verify bill in QuickBooks');
  }
});

// ----------------------------------------------------------------------------
// CALLABLE: RESET BILL SYNC (manual unlink)
// ----------------------------------------------------------------------------

/**
 * Manually reset QBO sync status for a PO.
 * Clears all QBO bill fields so the PO can be re-synced (creates a new bill).
 * Does NOT delete the bill in QuickBooks — only unlinks it from DawinOS.
 */
exports.resetBillSync = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { poId } = request.data;
  if (!poId) {
    throw new HttpsError('invalid-argument', 'poId is required');
  }

  const poDoc = await db.collection('purchaseOrders').doc(poId).get();
  if (!poDoc.exists) {
    throw new HttpsError('not-found', `Purchase Order ${poId} not found`);
  }

  const po = poDoc.data();
  const previousBillId = po.qboBillId || null;

  console.log(`[BillSync] resetBillSync: Unlinking PO ${poId} from QBO Bill ${previousBillId || '(none)'}`);
  await clearBillSyncFields(poId);

  return {
    success: true,
    previousBillId,
    message: previousBillId
      ? `PO unlinked from QBO Bill ${previousBillId}. You can now re-sync to create a new bill.`
      : 'PO sync status has been reset.',
  };
});

// ----------------------------------------------------------------------------
// BATCH UPDATE BILL NUMBERS
// ----------------------------------------------------------------------------

/**
 * Update all existing synced QBO bills to set their DocNumber to the PO number.
 * Fetches each bill from QBO, sets DocNumber = poNumber via sparse update.
 */
exports.batchUpdateBillNumbers = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
  timeoutSeconds: 540,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  console.log('[BillSync] batchUpdateBillNumbers: Starting batch update of bill numbers');

  // Find all POs with a synced QBO bill
  const posSnapshot = await db.collection('purchaseOrders')
    .where('qboSyncStatus', '==', 'synced')
    .get();

  const results = [];
  const errors = [];

  for (const doc of posSnapshot.docs) {
    const po = doc.data();
    const poId = doc.id;

    if (!po.qboBillId || !po.poNumber) {
      continue;
    }

    // Collect all bills to update: legacy single bill + multi-supplier bills
    const billsToUpdate = [];

    // Legacy single bill
    billsToUpdate.push({
      billId: po.qboBillId,
      docNumber: po.poNumber,
      label: `main (${po.poNumber})`,
    });

    // Multi-supplier bills
    if (po.qboBills) {
      for (const [supplierId, billInfo] of Object.entries(po.qboBills)) {
        if (billInfo.qboBillId && billInfo.qboBillId !== po.qboBillId) {
          const componentNames = (billInfo.components || [])
            .filter(c => c !== 'lineItems')
            .join('-');
          const suffix = componentNames ? `-${componentNames}` : '';
          billsToUpdate.push({
            billId: billInfo.qboBillId,
            docNumber: `${po.poNumber}${suffix}`,
            label: `${supplierId} (${po.poNumber}${suffix})`,
          });
        }
      }
    }

    for (const { billId, docNumber, label } of billsToUpdate) {
      try {
        // Fetch current bill to get SyncToken
        const existing = await qboRequest(`/bill/${billId}`);
        const bill = existing.Bill;

        if (!bill) {
          errors.push({ poId, billId, error: 'Bill not found in QBO' });
          continue;
        }

        // Skip if DocNumber already matches
        if (bill.DocNumber === docNumber) {
          results.push({ poId, billId, docNumber, status: 'already_set' });
          continue;
        }

        // Sparse update to set DocNumber
        const updatePayload = {
          Id: billId,
          SyncToken: bill.SyncToken,
          sparse: true,
          DocNumber: docNumber,
        };

        await qboRequest('/bill', {
          method: 'POST',
          body: JSON.stringify(updatePayload),
        });

        console.log(`[BillSync] Updated bill ${label}: DocNumber = ${docNumber}`);
        results.push({ poId, billId, docNumber, status: 'updated' });

        // Update PO record with the doc number
        if (billId === po.qboBillId) {
          await db.collection('purchaseOrders').doc(poId).update({
            qboBillDocNumber: docNumber,
          });
        }
      } catch (err) {
        console.error(`[BillSync] Error updating bill ${label}:`, err.message);
        errors.push({ poId, billId, docNumber, error: err.message });
      }
    }
  }

  const updated = results.filter(r => r.status === 'updated').length;
  const skipped = results.filter(r => r.status === 'already_set').length;

  console.log(`[BillSync] batchUpdateBillNumbers complete: ${updated} updated, ${skipped} already set, ${errors.length} errors`);

  return {
    success: true,
    updated,
    skipped,
    errors: errors.length,
    errorDetails: errors.length > 0 ? errors : undefined,
    message: `Updated ${updated} bill(s), ${skipped} already had correct number, ${errors.length} error(s).`,
  };
});

// ----------------------------------------------------------------------------
// DETECT QBO CUSTOM FIELDS
// ----------------------------------------------------------------------------

/**
 * Detect custom field DefinitionIds from QuickBooks.
 *
 * QBO has two types of custom fields:
 *   - Classic (SalesFormsPrefs): limited to 3, only on sales forms
 *   - New-style (Settings → Custom Fields): mapped to transaction types including Bills
 *
 * New-style custom fields require minorversion=75 in API calls and only
 * appear on transactions that have values populated. This function uses
 * multiple strategies to discover them.
 */
exports.detectQBOCustomFields = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Helper: QBO request WITH minorversion for new-style custom fields
  async function qboRequestV75(endpoint) {
    const separator = endpoint.includes('?') ? '&' : '?';
    return qboRequest(`${endpoint}${separator}minorversion=75`);
  }

  try {
    const customFields = [];
    const seenIds = new Set();
    const diagnostics = [];

    const addField = (cf) => {
      const id = String(cf.DefinitionId || cf.Id || '');
      const name = cf.Name || cf.name || '';
      if (id && name && !seenIds.has(id)) {
        seenIds.add(id);
        customFields.push({
          definitionId: id,
          name: name,
          type: cf.Type || cf.type || 'StringType',
        });
      }
    };

    // ── Strategy 1: Preferences API (classic custom fields) ──────────
    try {
      const prefsResponse = await qboRequestV75('/preferences');
      const prefs = prefsResponse?.Preferences || prefsResponse;
      const topKeys = Object.keys(prefs || {});
      diagnostics.push(`Prefs keys: ${topKeys.join(', ')}`);

      // Scan ALL preference sections for CustomField arrays
      for (const sectionKey of topKeys) {
        const section = prefs[sectionKey];
        if (!section || typeof section !== 'object') continue;

        if (section.CustomField && Array.isArray(section.CustomField)) {
          diagnostics.push(`${sectionKey}.CustomField (${section.CustomField.length}): ${JSON.stringify(section.CustomField)}`);

          // Collect activation flags and name mappings
          const enabled = {};
          const names = {};
          for (const cf of section.CustomField) {
            if (!cf.Name) continue;
            // Activation: { Name: "SalesFormsPrefs.UseSalesCustom1", BooleanValue: "true" }
            const enableMatch = cf.Name.match(/UseCustom(\d+)$|UseSalesCustom(\d+)$/);
            if (enableMatch && (cf.BooleanValue === 'true' || cf.BooleanValue === true)) {
              enabled[enableMatch[1] || enableMatch[2]] = true;
            }
            // Label: { Name: "SalesFormsPrefs.SalesCustomName1", StringValue: "PO No" }
            const nameMatch = cf.Name.match(/CustomName(\d+)$/);
            if (nameMatch && cf.StringValue) {
              names[nameMatch[1]] = cf.StringValue;
            }
            // Direct DefinitionId/Name
            if (cf.DefinitionId && cf.Name) {
              addField(cf);
            }
          }

          // Cross-reference enabled flags with names
          for (const num of Object.keys(names)) {
            addField({ DefinitionId: num, Name: names[num], Type: 'StringType' });
          }
          // If we have enabled flags but no names, note that
          for (const num of Object.keys(enabled)) {
            if (!names[num]) {
              diagnostics.push(`Custom field #${num} is enabled but has no name entry in Preferences`);
            }
          }
        }
      }
    } catch (prefErr) {
      diagnostics.push(`Preferences error: ${prefErr.message}`);
    }

    // ── Strategy 2: Fetch bills with minorversion=75 ────────────────
    // Search for the most recently updated bills + specific bills known to
    // have custom field values. Dump the full bill response to discover
    // where QBO stores custom field data (it may not be in "CustomField").
    if (customFields.length === 0) {
      try {
        // 2a. Search for the most recently updated bills
        const q = encodeURIComponent("SELECT * FROM Bill ORDER BY MetaData.LastUpdatedTime DESC MAXRESULTS 5");
        const queryResp = await qboRequestV75(`/query?query=${q}`);
        const billStubs = queryResp.QueryResponse?.Bill || [];
        diagnostics.push(`Recent bills found: ${billStubs.length}`);

        for (const billStub of billStubs) {
          if (customFields.length > 0) break;
          try {
            const detail = await qboRequestV75(`/bill/${billStub.Id}`);
            const bill = detail?.Bill;

            if (!bill) continue;

            // Dump ALL keys on this bill for debugging
            const allKeys = Object.keys(bill);
            diagnostics.push(`Bill/${billStub.Id} (${bill.DocNumber || 'no-doc'}): keys=[${allKeys.join(', ')}]`);

            // Check CustomField
            if (bill.CustomField && Array.isArray(bill.CustomField) && bill.CustomField.length > 0) {
              diagnostics.push(`  CustomField: ${JSON.stringify(bill.CustomField)}`);
              for (const cf of bill.CustomField) addField(cf);
            }

            // Check for any other property that might contain custom fields
            // (some QBO versions use different property names)
            for (const key of allKeys) {
              const val = bill[key];
              if (key.toLowerCase().includes('custom') && key !== 'CustomField') {
                diagnostics.push(`  ${key}: ${JSON.stringify(val).substring(0, 500)}`);
              }
              // Also check for arrays that contain DefinitionId
              if (Array.isArray(val) && val.length > 0 && val[0]?.DefinitionId) {
                diagnostics.push(`  ${key} (has DefinitionId): ${JSON.stringify(val)}`);
                for (const cf of val) addField(cf);
              }
            }

            // Dump full bill response (truncated) for the most recent bill only
            if (billStub === billStubs[0]) {
              const billJson = JSON.stringify(bill);
              diagnostics.push(`FULL Bill/${billStub.Id}: ${billJson.substring(0, 1500)}`);
              if (billJson.length > 1500) {
                diagnostics.push(`... (truncated, total ${billJson.length} chars)`);
              }
            }
          } catch (e) {
            diagnostics.push(`Bill/${billStub.Id} fetch error: ${e.message}`);
          }
        }

        if (customFields.length === 0 && billStubs.length > 0) {
          diagnostics.push('No bills had recognizable custom field entries');
        }
      } catch (billErr) {
        diagnostics.push(`Bill scan error: ${billErr.message}`);
      }
    }

    // ── Strategy 3: Fetch invoices/estimates with minorversion=75 ────
    if (customFields.length === 0) {
      const otherTypes = [
        { name: 'Invoice', key: 'Invoice', endpoint: 'invoice' },
        { name: 'Estimate', key: 'Estimate', endpoint: 'estimate' },
        { name: 'SalesReceipt', key: 'SalesReceipt', endpoint: 'salesreceipt' },
      ];

      for (const entity of otherTypes) {
        if (customFields.length > 0) break;
        try {
          const q = encodeURIComponent(`SELECT Id FROM ${entity.name} MAXRESULTS 5`);
          const queryResp = await qboRequestV75(`/query?query=${q}`);
          const items = queryResp.QueryResponse?.[entity.key] || [];

          for (const stub of items) {
            if (customFields.length > 0) break;
            try {
              const detail = await qboRequestV75(`/${entity.endpoint}/${stub.Id}`);
              const record = detail?.[entity.key];
              if (record?.CustomField && Array.isArray(record.CustomField) && record.CustomField.length > 0) {
                diagnostics.push(`${entity.name}/${stub.Id} CustomField: ${JSON.stringify(record.CustomField)}`);
                for (const cf of record.CustomField) addField(cf);
              }
            } catch (e) { /* skip */ }
          }

          if (customFields.length === 0) {
            diagnostics.push(`${entity.name}: scanned ${items.length}, none had custom fields`);
          }
        } catch (entityErr) {
          diagnostics.push(`${entity.name} scan error: ${entityErr.message}`);
        }
      }
    }

    // ── Strategy 4: Try the /preferences CustomFieldDefinition ──────
    if (customFields.length === 0) {
      try {
        const cfDefQuery = encodeURIComponent('SELECT * FROM CustomFieldDefinition');
        const cfDefResp = await qboRequestV75(`/query?query=${cfDefQuery}`);
        const defs = cfDefResp?.QueryResponse?.CustomFieldDefinition || [];
        diagnostics.push(`CustomFieldDefinition: ${defs.length} results`);
        if (defs.length > 0) {
          diagnostics.push(`CustomFieldDefinition data: ${JSON.stringify(defs)}`);
        }
        for (const def of defs) {
          addField({ DefinitionId: def.Id, Name: def.Name, Type: def.Type });
        }
      } catch (cfDefErr) {
        diagnostics.push(`CustomFieldDefinition: ${cfDefErr.message}`);
      }
    }

    // ── Strategy 5: Check if classic field #1 is enabled but unnamed ─
    // If we found enabled flags but no names, we can infer that these
    // are new-style custom fields. In that case, the user needs to have
    // at least one transaction with the fields populated for us to read them.
    if (customFields.length === 0) {
      diagnostics.push('---');
      diagnostics.push('No custom fields discovered via API.');
      diagnostics.push('This likely means your custom fields are new-style (Settings → Custom Fields)');
      diagnostics.push('and no transaction has values populated yet.');
      diagnostics.push('TIP: Open any bill in QBO, fill in PO No and Doc No, save it, then retry.');
    }

    // ── Auto-match known field names ───────────────────────────────
    const autoMapped = {};
    for (const cf of customFields) {
      const lowerName = cf.name.toLowerCase().trim();
      if (['po no', 'po number', 'po#', 'po no.', 'purchase order', 'p.o. no', 'p.o. number'].includes(lowerName)) {
        autoMapped.poNumber = cf.definitionId;
      }
      if (['doc no', 'doc number', 'doc#', 'doc no.', 'document no', 'document number'].includes(lowerName)) {
        autoMapped.docNumber = cf.definitionId;
      }
    }

    // Save matches to QBO config
    if (Object.keys(autoMapped).length > 0) {
      const configRef = db.collection('integrations').doc('quickbooks_config');
      const configDoc = await configRef.get();
      if (configDoc.exists) {
        const existing = configDoc.data().customFieldMapping || {};
        await configRef.update({
          customFieldMapping: { ...existing, ...autoMapped },
          lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastUpdatedBy: request.auth.uid,
        });
      }
    }

    return {
      success: true,
      customFields,
      autoMapped,
      diagnostics,
      message: customFields.length > 0
        ? `Found ${customFields.length} custom field(s) in QuickBooks`
        : 'No custom fields found — see diagnostics below for details.',
    };
  } catch (error) {
    console.error('[detectQBOCustomFields] Error:', error);
    throw new HttpsError('internal', error.message || 'Failed to detect custom fields');
  }
});

/**
 * Probe custom fields on a QBO Bill by attempting a full update that includes
 * CustomField entries. QBO requires VendorRef + Line for bill updates, so we
 * fetch the full bill first and re-submit it with CustomField added.
 */
exports.probeQBOCustomFields = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const diagnostics = [];

  try {
    // Step 1: Find the most recently updated bill and fetch its full data
    const q = encodeURIComponent('SELECT Id FROM Bill ORDER BY MetaData.LastUpdatedTime DESC MAXRESULTS 1');
    const queryResp = await qboRequest(`/query?query=${q}&minorversion=75`);
    const billStubs = queryResp.QueryResponse?.Bill || [];

    if (billStubs.length === 0) {
      return { success: false, message: 'No bills found in QBO', diagnostics };
    }

    // Fetch the full bill (we need VendorRef, Line, etc. for the update)
    const fullResp = await qboRequest(`/bill/${billStubs[0].Id}?minorversion=75`);
    const bill = fullResp?.Bill;
    if (!bill) {
      return { success: false, message: 'Could not fetch bill details', diagnostics };
    }

    diagnostics.push(`Using Bill ID=${bill.Id}, Doc=${bill.DocNumber}, SyncToken=${bill.SyncToken}`);
    diagnostics.push(`VendorRef: ${JSON.stringify(bill.VendorRef)}`);

    // Step 2: Build an update payload that includes ALL required fields
    // plus CustomField with test DefinitionIds 1, 2, 3
    const updatePayload = {
      Id: bill.Id,
      SyncToken: bill.SyncToken,
      sparse: true,
      VendorRef: bill.VendorRef,
      Line: bill.Line,
      TxnDate: bill.TxnDate,
      DueDate: bill.DueDate,
      APAccountRef: bill.APAccountRef,
      CurrencyRef: bill.CurrencyRef,
      CustomField: [
        { DefinitionId: '1', Name: 'PO No', Type: 'StringType', StringValue: 'PROBE-1' },
        { DefinitionId: '2', Name: 'Doc No', Type: 'StringType', StringValue: 'PROBE-2' },
        { DefinitionId: '3', Name: 'Field3', Type: 'StringType', StringValue: 'PROBE-3' },
      ],
    };

    diagnostics.push('Sending update with CustomField DefinitionIds 1, 2, 3...');

    let updateSuccess = false;
    let updateResponse = null;
    try {
      updateResponse = await qboRequest(`/bill?minorversion=75`, {
        method: 'POST',
        body: JSON.stringify(updatePayload),
      });
      updateSuccess = true;
      diagnostics.push('Update succeeded!');

      // Check if the update response includes CustomField
      const updatedBill = updateResponse?.Bill;
      if (updatedBill) {
        const updatedKeys = Object.keys(updatedBill);
        diagnostics.push(`Response keys: ${updatedKeys.join(', ')}`);
        if (updatedBill.CustomField) {
          diagnostics.push(`Response CustomField: ${JSON.stringify(updatedBill.CustomField)}`);
        }
      }
    } catch (updateErr) {
      diagnostics.push(`Update with IDs 1,2,3 failed: ${updateErr.message}`);

      // Try with just IDs 1 and 2
      diagnostics.push('Retrying with DefinitionIds 1,2 only...');
      try {
        const fresh = await qboRequest(`/bill/${bill.Id}?minorversion=75`);
        const freshBill = fresh?.Bill;
        updateResponse = await qboRequest(`/bill?minorversion=75`, {
          method: 'POST',
          body: JSON.stringify({
            ...updatePayload,
            SyncToken: freshBill.SyncToken,
            CustomField: [
              { DefinitionId: '1', Name: 'PO No', Type: 'StringType', StringValue: 'PROBE-1' },
              { DefinitionId: '2', Name: 'Doc No', Type: 'StringType', StringValue: 'PROBE-2' },
            ],
          }),
        });
        updateSuccess = true;
        diagnostics.push('Update with IDs 1,2 succeeded!');
      } catch (retry2Err) {
        diagnostics.push(`IDs 1,2 failed: ${retry2Err.message}`);
      }
    }

    // Step 3: Read the bill back
    const readBack = await qboRequest(`/bill/${bill.Id}?minorversion=75`);
    const readBill = readBack?.Bill;
    const readKeys = Object.keys(readBill || {});
    diagnostics.push(`Read-back keys: ${readKeys.join(', ')}`);

    // Check for CustomField in read-back
    if (readBill?.CustomField && Array.isArray(readBill.CustomField) && readBill.CustomField.length > 0) {
      diagnostics.push(`SUCCESS — CustomField: ${JSON.stringify(readBill.CustomField)}`);

      const customFields = [];
      const autoMapped = {};

      for (const cf of readBill.CustomField) {
        if (cf.DefinitionId) {
          customFields.push({
            definitionId: String(cf.DefinitionId),
            name: cf.Name || `Field ${cf.DefinitionId}`,
            type: cf.Type || 'StringType',
          });
          const ln = (cf.Name || '').toLowerCase().trim();
          if (['po no', 'po number', 'po#'].includes(ln)) autoMapped.poNumber = String(cf.DefinitionId);
          if (['doc no', 'doc number', 'doc#'].includes(ln)) autoMapped.docNumber = String(cf.DefinitionId);
        }
      }

      // Save to config
      if (Object.keys(autoMapped).length > 0) {
        const configRef = db.collection('integrations').doc('quickbooks_config');
        const configDoc = await configRef.get();
        if (configDoc.exists) {
          await configRef.update({
            customFieldMapping: { ...(configDoc.data().customFieldMapping || {}), ...autoMapped },
            lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdatedBy: request.auth.uid,
          });
          diagnostics.push(`Saved mapping: ${JSON.stringify(autoMapped)}`);
        }
      }

      // Clean up test values
      try {
        await qboRequest(`/bill?minorversion=75`, {
          method: 'POST',
          body: JSON.stringify({
            Id: bill.Id,
            SyncToken: readBill.SyncToken,
            sparse: true,
            VendorRef: readBill.VendorRef,
            Line: readBill.Line,
            CustomField: readBill.CustomField.map(cf => ({ ...cf, StringValue: '' })),
          }),
        });
        diagnostics.push('Cleaned up test values');
      } catch (cleanErr) {
        diagnostics.push(`Cleanup: ${cleanErr.message}`);
      }

      return { success: true, customFields, autoMapped, diagnostics,
        message: `Found ${customFields.length} custom field(s)!` };
    }

    // No CustomField in read-back — the API doesn't support custom fields on Bills
    diagnostics.push(`Update ${updateSuccess ? 'succeeded but' : 'failed and'} read-back has no CustomField`);

    if (updateSuccess) {
      diagnostics.push('The QBO API accepted the update but does not return CustomField on bills.');
      diagnostics.push('Custom fields may still work for WRITING even though they are not readable.');
      diagnostics.push('Assuming DefinitionIds: PO No = 1, Doc No = 2 (standard QBO assignment).');

      // Assume standard IDs since the write was accepted
      const autoMapped = { poNumber: '1', docNumber: '2' };
      const configRef = db.collection('integrations').doc('quickbooks_config');
      const configDoc = await configRef.get();
      if (configDoc.exists) {
        await configRef.update({
          customFieldMapping: { ...(configDoc.data().customFieldMapping || {}), ...autoMapped },
          lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastUpdatedBy: request.auth.uid,
        });
        diagnostics.push(`Saved assumed mapping: ${JSON.stringify(autoMapped)}`);
      }

      return {
        success: true,
        customFields: [
          { definitionId: '1', name: 'PO No', type: 'StringType' },
          { definitionId: '2', name: 'Doc No', type: 'StringType' },
        ],
        autoMapped,
        diagnostics,
        message: 'Custom fields accepted by QBO (write-only). Mapped PO No=1, Doc No=2.',
      };
    }

    return {
      success: false, customFields: [], autoMapped: {}, diagnostics,
      message: 'QBO API does not support custom fields on Bills for this account.',
    };
  } catch (error) {
    diagnostics.push(`Error: ${error.message}`);
    return { success: false, customFields: [], autoMapped: {}, diagnostics, message: error.message };
  }
});

// Export core functions for use by triggers and other sync modules
exports.createBillFromPO = createBillFromPO;
exports.updateBillFromPO = updateBillFromPO;
exports.resolveCogsAccount = resolveCogsAccount;
