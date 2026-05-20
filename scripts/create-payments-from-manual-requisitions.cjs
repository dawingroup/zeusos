/**
 * Create Payments from Manual Requisitions Backlog
 *
 * For each linked manual requisition that does NOT yet have a corresponding
 * payment record, this script:
 *   1. Creates a Payment document in the `payments` collection
 *   2. Updates the project budget (budget.spent += amount, budget.remaining -= amount)
 *   3. Stamps the manual requisition with `linkedSystemAccountabilityId`
 *
 * Each payment includes a placeholder exchange rate (USD→UGX @ 3750) that
 * can be adjusted later in the UI.
 *
 * DRY RUN by default — set DRY_RUN=false to apply changes.
 *
 * Run:
 *   DRY_RUN=true  node scripts/create-payments-from-manual-requisitions.cjs
 *   DRY_RUN=false node scripts/create-payments-from-manual-requisitions.cjs
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

// ── Config ──────────────────────────────────────

const DRY_RUN = process.env.DRY_RUN !== 'false';
const SYSTEM_USER = 'SYSTEM_MIGRATION';
const ORG_ID = 'default';

// Default exchange rate — adjust later per payment
const DEFAULT_EXCHANGE_RATE = {
  fromCurrency: 'USD',
  toCurrency: 'UGX',
  rate: 3750,
  inverseRate: 1 / 3750,
  rateDate: new Date(),
  source: 'manual',
  notes: 'Placeholder rate — adjust per actual transaction date',
};

// Collection paths
const MANUAL_REQUISITIONS = 'manual_requisitions';
const PAYMENTS = 'payments';
const PROJECTS = `organizations/${ORG_ID}/advisory_projects`;

// ── Helpers ─────────────────────────────────────

function toDate(val) {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val instanceof Date) return val;
  if (val.seconds) return new Date(val.seconds * 1000);
  return new Date(val);
}

function fmtAmount(amount, currency = 'UGX') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Main ────────────────────────────────────────

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  CREATE PAYMENTS FROM MANUAL REQUISITIONS`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE — writing to Firestore'}`);
  console.log(`${'='.repeat(60)}\n`);

  // 1. Fetch all manual requisitions that are linked to a project
  console.log('Fetching linked manual requisitions...\n');

  const reqSnap = await db
    .collection(MANUAL_REQUISITIONS)
    .where('linkStatus', 'in', ['linked', 'reconciled'])
    .get();

  if (reqSnap.empty) {
    console.log('No linked manual requisitions found. Nothing to do.');
    return;
  }

  const requisitions = reqSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(`Found ${requisitions.length} linked manual requisition(s).\n`);

  // 2. Filter out requisitions that already have a payment
  const needsPayment = requisitions.filter((r) => !r.linkedSystemAccountabilityId);
  const alreadyDone = requisitions.length - needsPayment.length;

  if (alreadyDone > 0) {
    console.log(`  Skipping ${alreadyDone} requisition(s) that already have payments.\n`);
  }

  if (needsPayment.length === 0) {
    console.log('All linked requisitions already have payments. Nothing to do.');
    return;
  }

  console.log(`Creating payments for ${needsPayment.length} requisition(s)...\n`);
  console.log('-'.repeat(60));

  // 3. Group by project for budget updates
  const projectUpdates = {}; // projectId -> total amount to add to spent

  let created = 0;
  let errors = 0;

  for (const req of needsPayment) {
    const projectId = req.linkedProjectId;
    const programId = req.linkedProgramId || '';
    const currency = req.currency || 'UGX';
    const amount = req.amount || 0;
    const paidDate = toDate(req.paidDate) || toDate(req.requisitionDate) || new Date();

    if (!projectId) {
      console.log(`  [SKIP] ${req.referenceNumber} — no linkedProjectId`);
      continue;
    }

    if (amount <= 0) {
      console.log(`  [SKIP] ${req.referenceNumber} — zero or negative amount`);
      continue;
    }

    // Build payment document
    const paymentNumber = `PAY-MIG-${req.referenceNumber}`;

    const paymentData = {
      projectId,
      programId,
      engagementId: '',
      paymentType: 'requisition',
      paymentNumber,
      currency,
      grossAmount: amount,
      deductions: [],
      netAmount: amount,
      status: 'paid',
      currentApprovalLevel: 0,
      approvalChain: [
        {
          level: 0,
          role: 'system_migration',
          name: 'System Migration',
          status: 'approved',
          completedAt: Timestamp.now(),
          completedBy: SYSTEM_USER,
          comments: `Auto-created from manual requisition ${req.referenceNumber}`,
        },
      ],
      periodFrom: paidDate,
      periodTo: paidDate,
      submittedAt: Timestamp.now(),
      approvedAt: Timestamp.now(),
      paidAt: Timestamp.fromDate(paidDate),
      supportingDocs: [],
      relatedPaymentId: null,
      // Exchange rate — editable later
      exchangeRate: DEFAULT_EXCHANGE_RATE,
      fundLocationId: null,
      budgetPeriodId: null,
      // Source tracking
      sourceRequisitionId: req.id,
      sourceRequisitionRef: req.referenceNumber,
      migrationSource: 'manual_requisition_backlog',
      createdAt: Timestamp.now(),
      createdBy: SYSTEM_USER,
      updatedAt: Timestamp.now(),
      updatedBy: SYSTEM_USER,
    };

    // Remove null/undefined values (Firestore rejects undefined)
    const cleanedData = Object.fromEntries(
      Object.entries(paymentData).filter(([_, v]) => v !== undefined && v !== null)
    );

    console.log(`  [${created + 1}] ${req.referenceNumber}`);
    console.log(`      Project:  ${req.linkedProjectName || projectId}`);
    console.log(`      Amount:   ${fmtAmount(amount, currency)}`);
    console.log(`      Paid:     ${paidDate.toISOString().split('T')[0]}`);
    console.log(`      Payment#: ${paymentNumber}`);

    if (!DRY_RUN) {
      try {
        // Create the payment
        const payRef = await db.collection(PAYMENTS).add(cleanedData);

        // Stamp the manual requisition
        await db.collection(MANUAL_REQUISITIONS).doc(req.id).update({
          linkedSystemAccountabilityId: payRef.id,
          updatedAt: Timestamp.now(),
          updatedBy: SYSTEM_USER,
        });

        // Accumulate budget update
        if (!projectUpdates[projectId]) {
          projectUpdates[projectId] = { total: 0, name: req.linkedProjectName || projectId };
        }
        projectUpdates[projectId].total += amount;

        console.log(`      -> Payment created: ${payRef.id}`);
        created++;
      } catch (err) {
        console.error(`      [ERROR] ${err.message}`);
        errors++;
      }
    } else {
      // Track for summary even in dry run
      if (!projectUpdates[projectId]) {
        projectUpdates[projectId] = { total: 0, name: req.linkedProjectName || projectId };
      }
      projectUpdates[projectId].total += amount;
      created++;
    }
  }

  // 4. Update project budgets
  console.log(`\n${'-'.repeat(60)}`);
  console.log(`\nUpdating project budgets...\n`);

  for (const [projectId, info] of Object.entries(projectUpdates)) {
    console.log(`  Project: ${info.name}`);
    console.log(`    Budget adjustment: spent += ${fmtAmount(info.total)}`);

    if (!DRY_RUN) {
      try {
        const projectRef = db.doc(`${PROJECTS}/${projectId}`);
        const projectSnap = await projectRef.get();

        if (!projectSnap.exists) {
          console.log(`    [WARN] Project ${projectId} not found — skipping budget update`);
          continue;
        }

        const projectData = projectSnap.data();
        const currentSpent = projectData.budget?.spent || 0;
        const totalBudget = projectData.budget?.totalBudget || 0;
        const newSpent = currentSpent + info.total;
        const financialProgress = totalBudget > 0
          ? Math.min(100, (newSpent / totalBudget) * 100)
          : 0;

        await projectRef.update({
          'budget.spent': FieldValue.increment(info.total),
          'budget.remaining': FieldValue.increment(-info.total),
          'progress.financialProgress': financialProgress,
          'progress.lastFinancialUpdate': FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: SYSTEM_USER,
        });

        console.log(`    [OK] Budget updated (spent: ${fmtAmount(currentSpent)} -> ${fmtAmount(newSpent)})`);
      } catch (err) {
        console.error(`    [ERROR] ${err.message}`);
        errors++;
      }
    }
  }

  // 5. Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  SUMMARY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Payments created:   ${created}`);
  console.log(`  Projects updated:   ${Object.keys(projectUpdates).length}`);
  console.log(`  Errors:             ${errors}`);
  console.log(`  Total disbursed:    ${fmtAmount(Object.values(projectUpdates).reduce((s, p) => s + p.total, 0))}`);
  console.log(`  Exchange rate:      1 USD = ${DEFAULT_EXCHANGE_RATE.rate} UGX (placeholder)`);

  if (DRY_RUN) {
    console.log(`\n  ** DRY RUN — no changes written. Run with DRY_RUN=false to apply. **`);
  }

  console.log();
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
