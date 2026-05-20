/**
 * Inventory Issue Cloud Functions
 * - Auto-number generation on create (ISS-YYYY-NNNN)
 * - Stock deduction on issue (status === 'issued')
 * - Stock return on reversal (status === 'reversed')
 * - QBO journal entry creation (Debit Expense, Credit Inventory Asset)
 */

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ── Number Generation ────────────────────────────────────────────────────────

/**
 * Generate issue number on document create.
 * Format: ISS-YYYY-NNNN
 */
exports.generateIssueNumber = onDocumentCreated({
  document: 'inventoryIssues/{issueId}',
}, async (event) => {
  const issueId = event.params.issueId;
  const data = event.data.data();

  if (data.issueNumber) return;

  const orgId = data.organizationId || 'dawinos';
  const counterRef = db.collection('counters').doc(`inventoryIssues_${orgId}`);
  const issueRef = db.collection('inventoryIssues').doc(issueId);

  try {
    const issueNumber = await db.runTransaction(async (txn) => {
      const counterDoc = await txn.get(counterRef);
      const currentYear = new Date().getFullYear();
      let counter = 0;
      let storedYear = currentYear;

      if (counterDoc.exists) {
        const d = counterDoc.data();
        storedYear = d.year || currentYear;
        counter = d.counter || 0;
      }

      // Reset counter on year change
      if (storedYear !== currentYear) {
        counter = 0;
      }

      counter++;
      const num = `ISS-${currentYear}-${String(counter).padStart(4, '0')}`;

      txn.set(counterRef, { year: currentYear, counter }, { merge: true });
      txn.update(issueRef, { issueNumber: num });

      return num;
    });

    console.log(`[InventoryIssue] Assigned number ${issueNumber} to ${issueId}`);
  } catch (err) {
    console.error(`[InventoryIssue] Failed to number ${issueId}:`, err);
  }
});

// ── Stock Deduction on Issue ─────────────────────────────────────────────────

/**
 * When an issue is created with status 'issued', deduct stock for each line item.
 */
exports.onInventoryIssueCreated = onDocumentCreated({
  document: 'inventoryIssues/{issueId}',
}, async (event) => {
  const issueId = event.params.issueId;
  const data = event.data.data();

  if (data.status !== 'issued') return;

  const lineItems = data.lineItems || [];
  if (lineItems.length === 0) return;

  const batch = db.batch();

  for (const line of lineItems) {
    const stockRef = db.collection('stockLevels').doc(line.inventoryItemId);

    // Deduct stock
    batch.set(stockRef, {
      quantity: FieldValue.increment(-line.quantity),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Add movement record
    const movementRef = stockRef.collection('movements').doc();
    batch.set(movementRef, {
      type: 'issue',
      quantity: -line.quantity,
      referenceType: 'inventoryIssue',
      referenceId: issueId,
      reason: data.reason || 'stores_issue',
      issuedTo: data.issuedTo || '',
      notes: data.notes || '',
      createdBy: data.createdBy || '',
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    console.log(`[InventoryIssue] Deducted stock for ${lineItems.length} items (issue ${issueId})`);
  } catch (err) {
    console.error(`[InventoryIssue] Stock deduction failed for ${issueId}:`, err);
  }
});

// ── Stock Return on Reversal ─────────────────────────────────────────────────

/**
 * When an issue status changes to 'reversed', return stock for each line item.
 */
exports.onInventoryIssueUpdated = onDocumentUpdated({
  document: 'inventoryIssues/{issueId}',
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const issueId = event.params.issueId;

  // Only handle reversal
  if (before.status === after.status) return;
  if (after.status !== 'reversed') return;

  const lineItems = after.lineItems || [];
  if (lineItems.length === 0) return;

  const batch = db.batch();

  for (const line of lineItems) {
    const stockRef = db.collection('stockLevels').doc(line.inventoryItemId);

    // Return stock
    batch.set(stockRef, {
      quantity: FieldValue.increment(line.quantity),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Add reversal movement
    const movementRef = stockRef.collection('movements').doc();
    batch.set(movementRef, {
      type: 'issue_reversal',
      quantity: line.quantity,
      referenceType: 'inventoryIssue',
      referenceId: issueId,
      reason: 'reversal',
      notes: `Reversed issue ${after.issueNumber || issueId}`,
      createdBy: after.createdBy || '',
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    console.log(`[InventoryIssue] Returned stock for ${lineItems.length} items (reversal of ${issueId})`);
  } catch (err) {
    console.error(`[InventoryIssue] Stock return failed for ${issueId}:`, err);
  }
});
