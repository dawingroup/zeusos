/**
 * BACKFILL: Create QBO Invoices for existing released Sales Orders
 *
 * Scans `salesOrders` for orders with status in ['released_to_production',
 * 'in_progress', 'completed'] that do NOT yet have a `qboInvoiceId`.
 * For each eligible SO, creates a QuickBooks Invoice from scopeItems.
 *
 * Requires the QBO_TOKEN_ENCRYPTION_KEY environment variable to decrypt
 * stored OAuth tokens.
 *
 * DRY RUN by default — set DRY_RUN=false to apply changes.
 *
 * Usage:
 *   QBO_TOKEN_ENCRYPTION_KEY=<key> DRY_RUN=true  node scripts/backfill-so-invoices-to-qbo.cjs
 *   QBO_TOKEN_ENCRYPTION_KEY=<key> DRY_RUN=false node scripts/backfill-so-invoices-to-qbo.cjs
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const fetch = require('node-fetch');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ── Config ──────────────────────────────────────────────────────────────────
const DRY_RUN = process.env.DRY_RUN !== 'false';
const ENCRYPTION_KEY = process.env.QBO_TOKEN_ENCRYPTION_KEY;
const QBO_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';
const ELIGIBLE_STATUSES = ['released_to_production', 'in_progress', 'completed'];

// ── Crypto helpers (mirror functions/src/integrations/quickbooks/auth.js) ───
function decryptToken(ciphertext, key) {
  const data = Buffer.from(ciphertext, 'hex');
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(data.length - 16);
  const encrypted = data.subarray(12, data.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, null, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function fmt(amount, currency = 'UGX') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount || 0);
}

// ── Customer helpers ─────────────────────────────────────────────────────────

/**
 * Search QBO for an existing customer by multiple strategies, create if not found.
 * Updates Firestore with the quickbooksId.
 */
async function findOrCreateQBOCustomer(realmId, accessToken, customerId, custData) {
  const displayName = `${custData.name} (${custData.code || 'N/A'})`;

  // Strategy 1: Exact DisplayName match
  let found = await searchQBOCustomer(realmId, accessToken, 'DisplayName', displayName);

  // Strategy 2: CompanyName match
  if (!found && custData.name) {
    found = await searchQBOCustomer(realmId, accessToken, 'CompanyName', custData.name);
  }

  // Strategy 3: Email match
  if (!found && custData.email) {
    found = await searchQBOCustomer(realmId, accessToken, 'PrimaryEmailAddr', custData.email);
  }

  // Strategy 4: LIKE search on DisplayName
  if (!found && custData.name) {
    const safeName = custData.name.replace(/'/g, "\\'");
    const query = encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName LIKE '%${safeName}%'`);
    const result = await qboRequest(realmId, accessToken, `/query?query=${query}`);
    if (result.QueryResponse?.Customer?.length > 0) {
      found = result.QueryResponse.Customer[0];
      console.log(`    → Found by LIKE search: "${found.DisplayName}" (ID: ${found.Id})`);
    }
  }

  if (found) {
    // Link existing QBO customer to Firestore
    await db.collection('customers').doc(customerId).update({
      'externalIds.quickbooksId': found.Id,
      'syncStatus.quickbooks': 'synced',
      'syncStatus.quickbooksLastSync': FieldValue.serverTimestamp(),
    });
    return found;
  }

  // No match found — create new customer in QBO
  console.log(`    → No match in QBO — creating new customer "${displayName}"`);
  const newCustomer = {
    DisplayName: displayName,
    CompanyName: custData.name,
  };
  if (custData.email) newCustomer.PrimaryEmailAddr = { Address: custData.email };
  if (custData.phone) newCustomer.PrimaryPhone = { FreeFormNumber: custData.phone };

  const createResult = await qboRequest(realmId, accessToken, '/customer', {
    method: 'POST',
    body: JSON.stringify(newCustomer),
  });

  const created = createResult.Customer;

  // Update Firestore with the new QBO ID
  await db.collection('customers').doc(customerId).update({
    'externalIds.quickbooksId': created.Id,
    'syncStatus.quickbooks': 'synced',
    'syncStatus.quickbooksLastSync': FieldValue.serverTimestamp(),
  });

  return created;
}

/**
 * Search QBO for a customer by a specific field.
 */
async function searchQBOCustomer(realmId, accessToken, field, value) {
  const safeValue = value.replace(/'/g, "\\'").substring(0, 100);
  const query = encodeURIComponent(`SELECT * FROM Customer WHERE ${field} = '${safeValue}'`);
  const result = await qboRequest(realmId, accessToken, `/query?query=${query}`);
  if (result.QueryResponse?.Customer?.length > 0) {
    const cust = result.QueryResponse.Customer[0];
    console.log(`    → Found by ${field}: "${cust.DisplayName}" (ID: ${cust.Id})`);
    return cust;
  }
  return null;
}

// ── QBO helpers ─────────────────────────────────────────────────────────────

async function getQBOTokens() {
  if (!ENCRYPTION_KEY) throw new Error('QBO_TOKEN_ENCRYPTION_KEY not set');

  const doc = await db.collection('integrations').doc('quickbooks').get();
  if (!doc.exists) throw new Error('QuickBooks not connected — no integrations/quickbooks doc');

  const data = doc.data();
  if (!data.isConnected) throw new Error('QuickBooks not connected');

  return {
    accessToken: decryptToken(data.access_token_encrypted, ENCRYPTION_KEY),
    realmId: data.realm_id,
  };
}

async function qboRequest(realmId, accessToken, endpoint, options = {}) {
  const url = `${QBO_API_BASE}/${realmId}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QBO API error (${response.status}): ${errorText}`);
  }
  return response.json();
}

/**
 * Resolve or find a QBO item by name (simplified for backfill — checks cache first)
 */
async function resolveQBOItem(realmId, accessToken, itemName, category) {
  // Check cache first
  const cacheKey = itemName.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 60);
  const cacheDoc = await db.collection('integrations').doc('qbo_item_cache').collection('items').doc(cacheKey).get();
  if (cacheDoc.exists) {
    return cacheDoc.data().qboItemId;
  }

  // Search QBO by name
  const safeName = itemName.replace(/'/g, "\\'").substring(0, 100);
  const query = encodeURIComponent(`SELECT * FROM Item WHERE Name = '${safeName}'`);
  const result = await qboRequest(realmId, accessToken, `/query?query=${query}`);

  if (result.QueryResponse?.Item?.length > 0) {
    const item = result.QueryResponse.Item[0];
    // Cache the result
    await db.collection('integrations').doc('qbo_item_cache').collection('items').doc(cacheKey).set({
      qboItemId: item.Id,
      qboItemName: item.Name,
      matchType: 'exact',
      createdAt: FieldValue.serverTimestamp(),
      lastUsedAt: FieldValue.serverTimestamp(),
    });
    return item.Id;
  }

  // Auto-create as Service item
  const isLabor = ['labor', 'construction', 'installation', 'design_fee', 'consultation'].includes(category);
  const newItem = {
    Name: itemName.substring(0, 100),
    Type: isLabor ? 'Service' : 'NonInventory',
    IncomeAccountRef: { value: '1' }, // Default — will be overridden by QBO
  };

  const createResult = await qboRequest(realmId, accessToken, '/item', {
    method: 'POST',
    body: JSON.stringify(newItem),
  });

  const createdItem = createResult.Item;

  // Cache it
  await db.collection('integrations').doc('qbo_item_cache').collection('items').doc(cacheKey).set({
    qboItemId: createdItem.Id,
    qboItemName: createdItem.Name,
    matchType: 'created',
    createdAt: FieldValue.serverTimestamp(),
    lastUsedAt: FieldValue.serverTimestamp(),
  });

  return createdItem.Id;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(70));
  console.log('BACKFILL: Sales Orders → QuickBooks Invoices');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE — will create invoices'}`);
  console.log('='.repeat(70));

  // 1. Pre-flight checks
  let tokens;
  try {
    tokens = await getQBOTokens();
    console.log(`\n✓ QuickBooks connected (realm: ${tokens.realmId})`);
  } catch (err) {
    console.error(`\n✗ ${err.message}`);
    if (DRY_RUN) {
      console.log('  (Continuing in dry-run mode without QBO connection)');
      tokens = null;
    } else {
      process.exit(1);
    }
  }

  const configDoc = await db.collection('integrations').doc('quickbooks_config').get();
  const config = configDoc.exists ? configDoc.data() : null;
  if (!config?.isConfigured) {
    console.warn('⚠  QuickBooks config not fully configured');
  }

  // 2. Query eligible Sales Orders
  const soSnap = await db.collection('salesOrders')
    .where('status', 'in', ELIGIBLE_STATUSES)
    .get();

  const eligible = [];
  soSnap.forEach(doc => {
    const data = doc.data();
    if (!data.qboInvoiceId) {
      eligible.push({ id: doc.id, ...data });
    }
  });

  console.log(`\nFound ${soSnap.size} SOs with eligible status, ${eligible.length} without QBO invoice\n`);

  if (eligible.length === 0) {
    console.log('Nothing to do.');
    process.exit(0);
  }

  // 3. Process each eligible SO
  const results = { created: 0, skipped: 0, errors: 0 };

  for (const so of eligible) {
    const label = `${so.orderNumber || so.id} — ${so.customerName || 'Unknown'} — ${fmt(so.currentAmount, so.currency)}`;
    const scopeCount = (so.scopeItems || []).filter(i => i.isActive !== false).length;

    if (scopeCount === 0) {
      console.log(`  SKIP  ${label} (no active scope items)`);
      results.skipped++;
      continue;
    }

    if (!so.customerId) {
      console.log(`  SKIP  ${label} (no customerId)`);
      results.skipped++;
      continue;
    }

    // Check customer has QBO ID — auto-sync if missing
    const custDoc = await db.collection('customers').doc(so.customerId).get();
    let custData = custDoc.exists ? custDoc.data() : null;
    if (!custData) {
      console.log(`  SKIP  ${label} (customer doc not found)`);
      results.skipped++;
      continue;
    }

    if (!custData.externalIds?.quickbooksId) {
      if (DRY_RUN) {
        console.log(`  NOTE  Customer "${custData.name || so.customerId}" not synced to QBO — will auto-sync in live mode`);
      } else if (tokens) {
        // Auto-sync customer: search QBO by name, then create if not found
        console.log(`    → Auto-syncing customer "${custData.name}" to QBO...`);
        try {
          const qboCustomer = await findOrCreateQBOCustomer(tokens.realmId, tokens.accessToken, so.customerId, custData);
          custData = { ...custData, externalIds: { ...custData.externalIds, quickbooksId: qboCustomer.Id } };
          console.log(`    ✓ Customer synced → QBO ID: ${qboCustomer.Id} ("${qboCustomer.DisplayName}")`);
        } catch (custErr) {
          console.log(`  SKIP  ${label} (customer auto-sync failed: ${custErr.message})`);
          results.skipped++;
          continue;
        }
      }
    }

    console.log(`  SYNC  ${label} (${scopeCount} items, status: ${so.status})`);

    if (DRY_RUN) {
      results.created++;
      continue;
    }

    // Build and create invoice
    try {
      const scopeItems = (so.scopeItems || []).filter(i => i.isActive !== false);
      const invoiceLines = [];

      for (const item of scopeItems) {
        try {
          const qboItemId = await resolveQBOItem(
            tokens.realmId, tokens.accessToken,
            item.name || item.description || 'Unnamed item',
            item.category
          );
          invoiceLines.push({
            DetailType: 'SalesItemLineDetail',
            Amount: item.totalPrice,
            Description: item.description || item.name,
            SalesItemLineDetail: {
              ItemRef: { value: qboItemId },
              Qty: item.quantity,
              UnitPrice: item.unitPrice,
              TaxCodeRef: { value: 'NON' },
            },
          });
        } catch (itemErr) {
          console.warn(`    ⚠ Item resolution failed for "${item.name}": ${itemErr.message}`);
        }
      }

      if (invoiceLines.length === 0) {
        console.log(`  ERROR ${label} — no items resolved`);
        results.errors++;
        continue;
      }

      // Add discount line
      if (so.totalDiscountAmount && so.totalDiscountAmount > 0) {
        invoiceLines.push({
          DetailType: 'DiscountLineDetail',
          Amount: so.totalDiscountAmount,
          DiscountLineDetail: { PercentBased: false },
        });
      }

      // Build payload
      const today = new Date().toISOString().split('T')[0];
      const invoicePayload = {
        CustomerRef: { value: custData.externalIds.quickbooksId },
        TxnDate: today,
        Line: invoiceLines,
        PrivateNote: `DawinOS Sales Order: ${so.orderNumber} | Customer: ${so.customerName || custData.name} | Backfill`,
      };

      // Due date
      const payDays = so.paymentTerms?.paymentDueDays;
      if (payDays && payDays > 0) {
        const due = new Date();
        due.setDate(due.getDate() + payDays);
        invoicePayload.DueDate = due.toISOString().split('T')[0];
      }

      // Link to QBO Sales Order
      if (so.qboSalesOrderId) {
        invoicePayload.LinkedTxn = [{ TxnId: so.qboSalesOrderId, TxnType: 'SalesOrder' }];
      }

      // Create invoice
      const response = await qboRequest(tokens.realmId, tokens.accessToken, '/invoice', {
        method: 'POST',
        body: JSON.stringify(invoicePayload),
      });

      const invoice = response.Invoice;
      console.log(`    ✓ Invoice ${invoice.DocNumber} (QBO ID: ${invoice.Id})`);

      // Update SO
      await db.collection('salesOrders').doc(so.id).update({
        qboInvoiceId: invoice.Id,
        qboInvoiceDocNumber: invoice.DocNumber,
        qboSyncStatus: 'synced',
        qboSyncedAt: FieldValue.serverTimestamp(),
        qboSyncError: null,
      });

      // Update linked quote
      if (so.quoteId) {
        try {
          await db.collection('clientQuotes').doc(so.quoteId).update({
            qboInvoiceId: invoice.Id,
            qboInvoiceDocNumber: invoice.DocNumber,
            qboSyncedAt: FieldValue.serverTimestamp(),
          });
        } catch (qErr) {
          console.warn(`    ⚠ Failed to update quote ${so.quoteId}: ${qErr.message}`);
        }
      }

      // Emit business event
      await db.collection('business_events').add({
        type: 'so_invoice_created_in_quickbooks',
        entityType: 'salesOrder',
        entityId: so.id,
        data: {
          orderNumber: so.orderNumber,
          customerName: so.customerName,
          currentAmount: so.currentAmount,
          qboInvoiceId: invoice.Id,
          qboInvoiceDocNumber: invoice.DocNumber,
          backfill: true,
        },
        timestamp: FieldValue.serverTimestamp(),
      });

      results.created++;

      // Rate limit: pause 1s between API calls
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`  ERROR ${label}: ${err.message}`);

      // Mark error on SO
      await db.collection('salesOrders').doc(so.id).update({
        qboSyncStatus: 'error',
        qboSyncError: `Backfill failed: ${err.message}`,
        qboSyncedAt: FieldValue.serverTimestamp(),
      });

      results.errors++;
    }
  }

  // 4. Summary
  console.log('\n' + '='.repeat(70));
  console.log('Summary:');
  console.log(`  ${DRY_RUN ? 'Would create' : 'Created'}: ${results.created} invoices`);
  console.log(`  Skipped: ${results.skipped}`);
  console.log(`  Errors:  ${results.errors}`);
  console.log('='.repeat(70));

  process.exit(results.errors > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
