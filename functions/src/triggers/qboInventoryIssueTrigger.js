/**
 * QBO Inventory Issue Journal Entry Trigger
 * Creates expense journal entries in QuickBooks Online when consumables/spareparts
 * are issued from stores.
 *
 * Journal entry pattern:
 *   Debit:  Expense account (from category qboExpenseAccountId)
 *   Credit: Inventory Asset account (from category qboAssetAccountId)
 */

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const {
  refreshTokens,
  TOKEN_ENCRYPTION_KEY,
  QUICKBOOKS_CLIENT_ID,
  QUICKBOOKS_CLIENT_SECRET,
} = require('../integrations/quickbooks/auth');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// ── Journal Entry on Issue ───────────────────────────────────────────────────

/**
 * When an inventoryIssue is created with status 'issued', create a QBO journal entry.
 */
exports.onInventoryIssueQBOSync = onDocumentCreated({
  document: 'inventoryIssues/{issueId}',
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (event) => {
  const issueId = event.params.issueId;
  const data = event.data.data();

  if (data.status !== 'issued') return;
  if (data.qboJournalEntryId) return; // Idempotency

  const lineItems = data.lineItems || [];
  if (lineItems.length === 0) return;

  const issueRef = db.collection('inventoryIssues').doc(issueId);

  try {
    // Look up QBO config
    const configSnap = await db.collection('integrations').doc('quickbooks_config').get();
    if (!configSnap.exists) {
      console.log(`[QBO-Issue] No QBO config found, skipping journal for ${issueId}`);
      await issueRef.update({ qboSyncStatus: 'skipped' });
      return;
    }
    const config = configSnap.data();
    if (!config.enabled) {
      await issueRef.update({ qboSyncStatus: 'skipped' });
      return;
    }

    // Look up category QBO account mappings
    const categoryCache = new Map();
    for (const line of lineItems) {
      if (!categoryCache.has(line.category)) {
        const catSnap = await db.collection('inventoryCategories').doc(line.category).get();
        if (catSnap.exists) {
          categoryCache.set(line.category, catSnap.data());
        }
      }
    }

    // Build journal lines — group by expense account
    const expenseGroups = new Map();
    let totalAmount = 0;

    for (const line of lineItems) {
      const cat = categoryCache.get(line.category);
      const expenseAccountId = cat?.qboExpenseAccountId || config.defaultExpenseAccountId;
      const expenseAccountName = cat?.qboExpenseAccountName || config.defaultExpenseAccountName || 'Consumables Expense';

      if (!expenseAccountId) continue;

      const key = expenseAccountId;
      if (!expenseGroups.has(key)) {
        expenseGroups.set(key, {
          accountId: expenseAccountId,
          accountName: expenseAccountName,
          amount: 0,
          description: '',
        });
      }

      const group = expenseGroups.get(key);
      group.amount += line.totalCost;
      totalAmount += line.totalCost;
    }

    if (totalAmount === 0 || expenseGroups.size === 0) {
      await issueRef.update({ qboSyncStatus: 'skipped' });
      return;
    }

    // Get inventory asset account
    const assetAccountId = config.inventoryAssetAccountId;
    const assetAccountName = config.inventoryAssetAccountName || 'Inventory Asset';

    if (!assetAccountId) {
      console.warn(`[QBO-Issue] No inventory asset account configured, skipping ${issueId}`);
      await issueRef.update({ qboSyncStatus: 'skipped' });
      return;
    }

    // Build QBO journal entry payload
    const journalLines = [];
    const issueNumber = data.issueNumber || issueId.slice(0, 8);

    // Debit lines (expense)
    for (const [, group] of expenseGroups) {
      journalLines.push({
        JournalEntryLineDetail: {
          PostingType: 'Debit',
          AccountRef: { value: group.accountId, name: group.accountName },
        },
        Amount: (group.amount / 100).toFixed(2), // Convert from UGX cents if needed
        Description: `Stores issue ${issueNumber}: ${data.reason || 'general'}`,
      });
    }

    // Credit line (inventory asset)
    journalLines.push({
      JournalEntryLineDetail: {
        PostingType: 'Credit',
        AccountRef: { value: assetAccountId, name: assetAccountName },
      },
      Amount: (totalAmount / 100).toFixed(2),
      Description: `Stores issue ${issueNumber}: stock deduction`,
    });

    // POST to QBO
    const tokens = await refreshTokens(TOKEN_ENCRYPTION_KEY.value());

    const QBO_API_BASE = config.isSandbox
      ? 'https://sandbox-quickbooks.api.intuit.com/v3/company'
      : 'https://quickbooks.api.intuit.com/v3/company';

    const response = await fetch(`${QBO_API_BASE}/${tokens.realm_id}/journalentry`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        Line: journalLines,
        DocNumber: issueNumber,
        TxnDate: new Date().toISOString().split('T')[0],
        PrivateNote: `Auto-generated: Stores issue to ${data.issuedTo || 'unknown'} — ${data.reason || 'general'}`,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[QBO-Issue] Journal entry creation failed for ${issueId}:`, errBody);
      await issueRef.update({
        qboSyncStatus: 'error',
        qboSyncError: errBody.slice(0, 500),
      });
      return;
    }

    const result = await response.json();
    const journalEntryId = result.JournalEntry?.Id;

    await issueRef.update({
      qboJournalEntryId: journalEntryId || null,
      qboSyncStatus: 'synced',
      qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[QBO-Issue] Journal entry ${journalEntryId} created for issue ${issueId}`);
  } catch (err) {
    console.error(`[QBO-Issue] Error syncing issue ${issueId}:`, err);
    await issueRef.update({
      qboSyncStatus: 'error',
      qboSyncError: err.message?.slice(0, 500) || 'Unknown error',
    }).catch(() => {});
  }
});

// ── Reversal Journal Entry ───────────────────────────────────────────────────

/**
 * When an issue is reversed, create a reversing journal entry in QBO.
 */
exports.onInventoryIssueReversalQBOSync = onDocumentUpdated({
  document: 'inventoryIssues/{issueId}',
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const issueId = event.params.issueId;

  if (before.status === after.status) return;
  if (after.status !== 'reversed') return;
  if (!after.qboJournalEntryId) return; // Nothing to reverse if no original JE

  const issueRef = db.collection('inventoryIssues').doc(issueId);

  try {
    const configSnap = await db.collection('integrations').doc('quickbooks_config').get();
    if (!configSnap.exists || !configSnap.data().enabled) return;

    // Delete the original journal entry in QBO (or create a reversing entry)
    // For simplicity, mark as reversed in our system — full QBO reversal is a future enhancement
    await issueRef.update({
      qboReversalStatus: 'pending_manual',
      qboReversalNote: `Original JE ${after.qboJournalEntryId} needs manual reversal in QBO`,
    });

    console.log(`[QBO-Issue] Marked issue ${issueId} for manual QBO reversal`);
  } catch (err) {
    console.error(`[QBO-Issue] Reversal sync error for ${issueId}:`, err);
  }
});
