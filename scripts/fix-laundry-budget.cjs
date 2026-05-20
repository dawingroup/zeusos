/**
 * FIX LAUNDRY FACILITY BUDGET
 *
 * Project "Laundry Facility" (LOKsoZ759U4mCgvVGCKW)
 *   Budget currency: USD
 *   Two UGX payments were stored without conversion:
 *     PAY-MIG-MAN-REQ-2026-0004  UGX 48,580,850
 *     PAY-MIG-REQ-2023-0002      UGX 38,708,500
 *   Exchange rate stored on both payments: USD→UGX @ 3,750
 *
 * Correct spent = (48,580,850 + 38,708,500) / 3,750 = $23,277.16 USD
 *
 * DRY_RUN=true (default) — set DRY_RUN=false to apply.
 */

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const DRY_RUN = process.env.DRY_RUN !== 'false';
const PROJECT_ID = 'LOKsoZ759U4mCgvVGCKW';
const PROJECTS = 'organizations/default/advisory_projects';
const PAYMENTS = 'payments';

function fmt(n, cur = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: cur,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

async function main() {
  console.log('\n' + '='.repeat(65));
  console.log('  FIX LAUNDRY FACILITY BUDGET');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE — writing to Firestore'}`);
  console.log('='.repeat(65) + '\n');

  // Load project
  const projectRef = db.doc(`${PROJECTS}/${PROJECT_ID}`);
  const projectSnap = await projectRef.get();
  if (!projectSnap.exists) {
    console.error('Project not found!');
    process.exit(1);
  }
  const project = { id: projectSnap.id, ...projectSnap.data() };
  const budgetCurrency = project.budget?.currency || 'USD';
  const totalBudget = project.budget?.totalBudget || 0;
  const committed = project.budget?.committed || 0;
  const currentSpent = project.budget?.spent || 0;

  console.log(`Project:       ${project.name}`);
  console.log(`Budget cur:    ${budgetCurrency}`);
  console.log(`Total budget:  ${fmt(totalBudget, budgetCurrency)}`);
  console.log(`Current spent: ${fmt(currentSpent, budgetCurrency)}  ← WRONG (raw UGX)`);

  // Load all paid/approved payments
  const paymentsSnap = await db
    .collection(PAYMENTS)
    .where('projectId', '==', PROJECT_ID)
    .where('status', 'in', ['approved', 'paid'])
    .get();

  console.log(`\nPayments (approved/paid): ${paymentsSnap.size}`);

  let recalculatedSpent = 0;

  for (const d of paymentsSnap.docs) {
    const p = d.data();
    const paymentCurrency = p.currency || budgetCurrency;
    const netAmount = p.netAmount || 0;
    const er = p.exchangeRate;

    let converted = netAmount;
    let note = 'same currency';

    if (paymentCurrency !== budgetCurrency) {
      if (er && er.fromCurrency === budgetCurrency && er.toCurrency === paymentCurrency && er.rate > 0) {
        // e.g. USD→UGX rate=3750: to get USD from UGX, divide
        converted = netAmount / er.rate;
        note = `${paymentCurrency}→${budgetCurrency} via inverse of ${er.rate} = ${converted.toFixed(4)}`;
      } else if (er && er.fromCurrency === paymentCurrency && er.toCurrency === budgetCurrency && er.rate > 0) {
        converted = netAmount * er.rate;
        note = `${paymentCurrency}→${budgetCurrency} direct @ ${er.rate}`;
      } else {
        note = 'NO RATE — stored unconverted';
      }
    }

    console.log(
      `  ${p.paymentNumber || d.id}` +
      `  ${paymentCurrency} ${netAmount.toLocaleString()}` +
      `  →  ${budgetCurrency} ${converted.toFixed(2)}` +
      `  [${note}]`
    );
    recalculatedSpent += converted;
  }

  const newRemaining = totalBudget - committed - recalculatedSpent;
  const financialProgress = totalBudget > 0
    ? Math.min(100, (recalculatedSpent / totalBudget) * 100)
    : 0;

  console.log(`\nRecalculated spent: ${fmt(recalculatedSpent, budgetCurrency)}`);
  console.log(`New remaining:      ${fmt(newRemaining, budgetCurrency)}`);
  console.log(`Financial progress: ${financialProgress.toFixed(1)}%`);

  if (!DRY_RUN) {
    await projectRef.update({
      'budget.spent': recalculatedSpent,
      'budget.remaining': newRemaining,
      'progress.financialProgress': financialProgress,
      'progress.lastFinancialUpdate': FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: 'SYSTEM_FIX_LAUNDRY_BUDGET',
    });
    console.log('\n[UPDATED] ✓');
  } else {
    console.log('\n[DRY RUN] Would write the above values.');
  }

  console.log('\n' + '='.repeat(65));
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
