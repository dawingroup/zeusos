/**
 * QuickBooks Journal Entry Sync Service
 * Creates Journal Entries for COGS when Manufacturing Orders complete
 *
 * IFRS-Compliant COGS Recognition:
 * - Material costs: Debit COGS-Materials, Credit Inventory (IAS 2)
 * - Outsourced services: Debit COGS-Outsourced, Credit AP (separate line items)
 * - Labour: Excluded — tracked at payroll level (IAS 19)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const { refreshTokens, TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET } = require('./auth');
const { ALLOWED_ORIGINS } = require('../../config/cors');
const { calculateMOCOGS } = require('../../finance/cogsCalculationService');

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
// COGS JOURNAL ENTRY CREATION (IFRS-Compliant)
// ----------------------------------------------------------------------------

/**
 * Create COGS Journal Entry in QuickBooks
 *
 * Produces separate debit/credit lines for each cost category:
 * 1. Materials: Debit cogsMaterials (or cogs fallback), Credit inventory
 * 2. Outsourced services: Debit cogsOutsourced (or cogs fallback), Credit AP
 *
 * Labour is NOT included — it's recognized through payroll (IAS 19).
 */
async function createCOGSJournalEntry(moId, options = {}) {
  console.log(`[JournalEntrySync] Creating COGS journal entry for MO ${moId}`);

  // 1. Calculate COGS (includes material + outsourced breakdown)
  const cogsData = await calculateMOCOGS(moId);

  if (cogsData.totalCOGS === 0) {
    console.log(`[JournalEntrySync] MO ${moId} has zero COGS, skipping journal entry`);
    return {
      action: 'skipped',
      reason: 'zero_cogs',
    };
  }

  // 2. Fetch Manufacturing Order
  const moDoc = await db.collection('manufacturingOrders').doc(moId).get();
  if (!moDoc.exists) {
    throw new Error(`Manufacturing Order ${moId} not found`);
  }

  const mo = { id: moDoc.id, ...moDoc.data() };

  // 3. Idempotency check
  if (mo.qboJournalEntryId) {
    console.log(`[JournalEntrySync] MO ${moId} already has journal entry ${mo.qboJournalEntryId}`);
    return {
      action: 'skipped',
      reason: 'already_synced',
      qboJournalEntryId: mo.qboJournalEntryId
    };
  }

  // 4. Fetch QBO config
  const configDoc = await db.collection('integrations').doc('quickbooks_config').get();
  if (!configDoc.exists || !configDoc.data().isConfigured) {
    throw new Error(
      'QuickBooks account mapping not configured. Please configure account mappings first.'
    );
  }

  const config = configDoc.data();
  const acctMap = config.accountMapping || {};

  // Validate required accounts
  if (!acctMap.cogs) {
    throw new Error('COGS account not mapped in QuickBooks configuration');
  }
  if (!acctMap.inventory) {
    throw new Error('Inventory account not mapped in QuickBooks configuration');
  }

  // 5. Resolve account IDs for each cost category
  // Material COGS: use cogsMaterials sub-account if mapped, otherwise fall back to cogs
  const materialCogsAccount = options.cogsAccountId || acctMap.cogsMaterials || acctMap.cogs;
  // Outsourced COGS: use cogsOutsourced sub-account if mapped, otherwise fall back to cogs
  const outsourcedCogsAccount = acctMap.cogsOutsourced || acctMap.cogs;
  // Credit side: inventory for materials, AP for outsourced
  const inventoryAccount = acctMap.inventory;
  const apAccount = acctMap.accountsPayable;

  // 6. Build Journal Entry lines
  const txnDate = mo.scheduling?.actualEnd
    ? admin.firestore.Timestamp.fromDate(new Date(mo.scheduling.actualEnd.toDate())).toDate().toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const journalLines = [];

  // --- Material COGS lines ---
  if (cogsData.materialCost > 0) {
    // Debit: COGS-Materials
    journalLines.push({
      DetailType: 'JournalEntryLineDetail',
      Amount: cogsData.materialCost,
      JournalEntryLineDetail: {
        PostingType: 'Debit',
        AccountRef: { value: materialCogsAccount },
      },
      Description: `Materials consumed for MO ${mo.moNumber} (${cogsData.consumptionDetails.length} items)`,
    });

    // Credit: Inventory
    journalLines.push({
      DetailType: 'JournalEntryLineDetail',
      Amount: cogsData.materialCost,
      JournalEntryLineDetail: {
        PostingType: 'Credit',
        AccountRef: { value: inventoryAccount },
      },
      Description: `Inventory consumed for MO ${mo.moNumber}`,
    });
  }

  // --- Outsourced Service COGS lines ---
  // NOTE: OPOs that were already synced as Bills to QBO are excluded by
  // calculateMOCOGS() — the bill already posted Debit COGS, Credit AP.
  // Only OPOs WITHOUT a QBO bill (or prepaid OPOs needing reclassification
  // from WIP to COGS) appear here.
  if (cogsData.outsourcedCost > 0 && cogsData.outsourcedDetails) {
    for (const opo of cogsData.outsourcedDetails) {
      if (opo.serviceFee <= 0) continue;

      // Prepaid OPOs: bill was posted to WIP/prepaid asset → reclassify to COGS
      // Non-billed OPOs: accrue the liability against AP
      const creditAccount = opo.isPrepaid
        ? (acctMap.workInProgress || inventoryAccount)
        : (apAccount || inventoryAccount);

      const actionLabel = opo.isPrepaid
        ? 'Reclassify prepaid to COGS'
        : 'Accrue outsourced service';

      // Debit: COGS-Outsourced
      journalLines.push({
        DetailType: 'JournalEntryLineDetail',
        Amount: opo.serviceFee,
        JournalEntryLineDetail: {
          PostingType: 'Debit',
          AccountRef: { value: outsourcedCogsAccount },
        },
        Description: `${actionLabel}: ${opo.supplierName} (PO ${opo.poNumber}) for MO ${mo.moNumber}`,
      });

      // Credit: WIP (prepaid reclassification) or AP (accrued liability)
      journalLines.push({
        DetailType: 'JournalEntryLineDetail',
        Amount: opo.serviceFee,
        JournalEntryLineDetail: {
          PostingType: 'Credit',
          AccountRef: { value: creditAccount },
        },
        Description: `${opo.isPrepaid ? 'Release WIP' : 'Accrued liability'}: ${opo.supplierName} (PO ${opo.poNumber})`,
      });
    }
  }

  if (journalLines.length === 0) {
    console.log(`[JournalEntrySync] MO ${moId} produced no journal lines, skipping`);
    return {
      action: 'skipped',
      reason: 'no_journal_lines',
    };
  }

  // Build cost breakdown for private note
  const costParts = [];
  if (cogsData.materialCost > 0) costParts.push(`Materials: ${cogsData.materialCost.toFixed(2)}`);
  if (cogsData.outsourcedCost > 0) costParts.push(`Outsourced: ${cogsData.outsourcedCost.toFixed(2)}`);

  const journalEntryPayload = {
    DocNumber: mo.moNumber || '',
    TxnDate: txnDate,
    Line: journalLines,
    PrivateNote: `DawinOS MO: ${mo.moNumber} | Project: ${mo.projectId || 'N/A'} | ${costParts.join(', ')} | Total COGS: ${cogsData.totalCOGS.toFixed(2)}`,
  };

  // 7. Create Journal Entry in QuickBooks
  try {
    console.log('[JournalEntrySync] Creating journal entry in QuickBooks:', JSON.stringify(journalEntryPayload, null, 2));
    const response = await qboRequest('/journalentry', {
      method: 'POST',
      body: JSON.stringify(journalEntryPayload),
    });

    const journalEntry = response.JournalEntry;
    console.log(`[JournalEntrySync] Journal Entry created: ${journalEntry.Id} - Doc #${journalEntry.DocNumber}`);

    // 8. Update MO with journal entry information
    await db.collection('manufacturingOrders').doc(moId).update({
      qboJournalEntryId: journalEntry.Id,
      qboJournalEntryDocNumber: journalEntry.DocNumber || '',
      qboSyncStatus: 'synced',
      qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      qboSyncError: admin.firestore.FieldValue.delete(),
      // Store COGS breakdown for audit trail
      cogsRecorded: {
        totalCOGS: cogsData.totalCOGS,
        materialCost: cogsData.materialCost,
        outsourcedCost: cogsData.outsourcedCost || 0,
        laborCost: 0, // Excluded per IAS 19
        overheadCost: 0,
        outsourcedDetails: cogsData.outsourcedDetails || [],
        recordedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    });

    return {
      action: 'created',
      qboJournalEntryId: journalEntry.Id,
      qboJournalEntryDocNumber: journalEntry.DocNumber || '',
      cogsData,
    };
  } catch (error) {
    console.error(`[JournalEntrySync] Error creating journal entry for MO ${moId}:`, error);

    // Update MO with error
    await db.collection('manufacturingOrders').doc(moId).update({
      qboSyncStatus: 'error',
      qboSyncError: error.message || 'Unknown error creating journal entry',
      qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    throw error;
  }
}

// ----------------------------------------------------------------------------
// CALLABLE FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Manual COGS journal entry sync (callable from UI)
 */
exports.syncMOToCOGS = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { moId, cogsAccountId } = request.data;
  if (!moId) {
    throw new HttpsError('invalid-argument', 'moId is required');
  }

  try {
    const result = await createCOGSJournalEntry(moId, { cogsAccountId });
    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error('[JournalEntrySync] Manual sync failed:', error);
    throw new HttpsError('internal', error.message || 'Failed to create COGS journal entry in QuickBooks');
  }
});

/**
 * Bulk COGS journal entry sync for multiple MOs
 */
exports.syncMultipleMOsToCOGS = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
  timeoutSeconds: 540, // 9 minutes for bulk operations
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { moIds } = request.data;
  if (!moIds || !Array.isArray(moIds)) {
    throw new HttpsError('invalid-argument', 'moIds array is required');
  }

  const results = [];
  const errors = [];

  for (const moId of moIds) {
    try {
      const result = await createCOGSJournalEntry(moId);
      results.push({ moId, ...result });
    } catch (error) {
      errors.push({ moId, error: error.message });
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

// Export core function for use by triggers
exports.createCOGSJournalEntry = createCOGSJournalEntry;
