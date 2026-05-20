/**
 * FIX BUDGET SPENT CURRENCY
 *
 * Recalculates project.budget.spent by summing all approved/paid payments
 * for each project, converting each payment's netAmount into the project's
 * budget currency before summing.
 *
 * Background
 * ----------
 * The create-payments-from-manual-requisitions.cjs script (and a bug in
 * PaymentService.updateProjectBudget) added UGX amounts directly to
 * budget.spent without converting to the project's budget currency.
 * This script corrects those historical values.
 *
 * Conversion priority for each payment:
 *   1. payment.exchangeRate (stored on the payment document)
 *   2. Latest stored rate for the program  (advisory_programs/.../exchange_rates)
 *   3. Fallback: amount stored as-is (no rate available — logged as warning)
 *
 * DRY RUN by default — set DRY_RUN=false to apply changes.
 *
 * Usage:
 *   DRY_RUN=true  node scripts/fix-budget-spent-currency.cjs
 *   DRY_RUN=false node scripts/fix-budget-spent-currency.cjs
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ── Config ──────────────────────────────────────────────────────

const DRY_RUN = process.env.DRY_RUN !== 'false';
const SYSTEM_USER = 'SYSTEM_FIX_BUDGET_CURRENCY';

const PROJECTS = 'organizations/default/advisory_projects';
const PAYMENTS = 'payments';
const PROGRAMS  = 'organizations/default/advisory_programs';

// ── Helpers ─────────────────────────────────────────────────────

function fmt(amount, currency = 'UGX') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Fetch the most recent exchange rate entry for a program/pair.
 * Returns { rate } (fromCurrency → toCurrency) or null.
 */
async function fetchProgramRate(programId, fromCurrency, toCurrency) {
  if (!programId) return null;
  const snap = await db
    .collection(`${PROGRAMS}/${programId}/exchange_rates`)
    .where('fromCurrency', '==', fromCurrency)
    .where('toCurrency',   '==', toCurrency)
    .orderBy('effectiveDate', 'desc')
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data();
}

/**
 * Convert `amount` from `paymentCurrency` to `budgetCurrency`.
 * Returns the converted amount, or the original amount if no rate is found.
 */
async function convertAmount(amount, paymentCurrency, budgetCurrency, programId, paymentExchangeRate) {
  if (paymentCurrency === budgetCurrency) return { converted: amount, rateUsed: null, note: 'same currency' };

  // 1. Try rate stored on payment
  if (paymentExchangeRate) {
    const { fromCurrency, toCurrency, rate } = paymentExchangeRate;
    if (fromCurrency === paymentCurrency && toCurrency === budgetCurrency && rate > 0) {
      return { converted: amount * rate, rateUsed: rate, note: 'payment.exchangeRate (direct)' };
    }
    if (fromCurrency === budgetCurrency && toCurrency === paymentCurrency && rate > 0) {
      return { converted: amount / rate, rateUsed: rate, note: 'payment.exchangeRate (inverse)' };
    }
  }

  // 2. Try program exchange rates — direct pair
  let entry = await fetchProgramRate(programId, paymentCurrency, budgetCurrency);
  if (entry && entry.rate > 0) {
    return { converted: amount * entry.rate, rateUsed: entry.rate, note: `program rate (${paymentCurrency}→${budgetCurrency})` };
  }

  // 3. Try inverse pair
  entry = await fetchProgramRate(programId, budgetCurrency, paymentCurrency);
  if (entry && entry.rate > 0) {
    return { converted: amount / entry.rate, rateUsed: entry.rate, note: `program rate inverse (${budgetCurrency}→${paymentCurrency})` };
  }

  // 4. No rate found
  return { converted: amount, rateUsed: null, note: 'NO RATE FOUND — stored unconverted' };
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'='.repeat(65)}`);
  console.log('  FIX BUDGET SPENT CURRENCY');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE — writing to Firestore'}`);
  console.log(`${'='.repeat(65)}\n`);

  // 1. Load all advisory projects
  const projectsSnap = await db.collection(PROJECTS).get();
  if (projectsSnap.empty) {
    console.log('No advisory projects found.');
    return;
  }

  const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Loaded ${projects.length} project(s).\n`);

  let totalFixed = 0;
  let totalSkipped = 0;
  let totalWarnings = 0;

  for (const project of projects) {
    const budgetCurrency = project.budget?.currency || 'USD';
    const currentSpent   = project.budget?.spent    || 0;
    const totalBudget    = project.budget?.totalBudget || 0;
    const committed      = project.budget?.committed   || 0;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Project: ${project.name || project.id}`);
    console.log(`  Budget currency: ${budgetCurrency}`);
    console.log(`  Current spent:   ${fmt(currentSpent, budgetCurrency)}`);

    // 2. Load all approved/paid payments for this project
    const paymentsSnap = await db
      .collection(PAYMENTS)
      .where('projectId', '==', project.id)
      .where('status', 'in', ['approved', 'paid'])
      .get();

    if (paymentsSnap.empty) {
      console.log('  No approved/paid payments — skipping.');
      totalSkipped++;
      continue;
    }

    const payments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`  Payments found:  ${payments.length}`);

    // 3. Convert each payment's netAmount to budget currency
    let recalculatedSpent = 0;
    let hasWarnings = false;

    for (const payment of payments) {
      const paymentCurrency = payment.currency || budgetCurrency;
      const netAmount       = payment.netAmount || 0;
      const programId       = payment.programId || '';
      const exchangeRate    = payment.exchangeRate;

      const { converted, rateUsed, note } = await convertAmount(
        netAmount, paymentCurrency, budgetCurrency, programId, exchangeRate
      );

      const needsConversion = paymentCurrency !== budgetCurrency;
      const marker = rateUsed === null && needsConversion ? '⚠ ' : '  ';

      console.log(
        `  ${marker}${payment.paymentNumber || payment.id}` +
        `  ${fmt(netAmount, paymentCurrency)}` +
        (needsConversion ? ` → ${fmt(converted, budgetCurrency)}` : '') +
        `  [${note}]`
      );

      if (rateUsed === null && needsConversion) hasWarnings = true;
      recalculatedSpent += converted;
    }

    const diff = recalculatedSpent - currentSpent;
    const newRemaining = totalBudget - committed - recalculatedSpent;
    const financialProgress = totalBudget > 0 ? Math.min(100, (recalculatedSpent / totalBudget) * 100) : 0;

    console.log(`\n  Recalculated spent: ${fmt(recalculatedSpent, budgetCurrency)}`);
    console.log(`  Current spent:      ${fmt(currentSpent, budgetCurrency)}`);
    console.log(`  Difference:         ${fmt(Math.abs(diff), budgetCurrency)} ${diff >= 0 ? '(increase)' : '(decrease)'}`);
    console.log(`  New remaining:      ${fmt(newRemaining, budgetCurrency)}`);
    if (hasWarnings) {
      console.log('  ⚠  Some payments had no exchange rate — stored unconverted.');
      totalWarnings++;
    }

    if (Math.abs(diff) < 1) {
      console.log('  [OK] No correction needed (difference < 1).');
      totalSkipped++;
      continue;
    }

    if (!DRY_RUN) {
      await db.doc(`${PROJECTS}/${project.id}`).update({
        'budget.spent': recalculatedSpent,
        'budget.remaining': newRemaining,
        'progress.financialProgress': financialProgress,
        'progress.lastFinancialUpdate': FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: SYSTEM_USER,
      });
      console.log('  [UPDATED] ✓');
      totalFixed++;
    } else {
      console.log('  [DRY RUN] Would update.');
      totalFixed++;
    }
  }

  // Summary
  console.log(`\n${'='.repeat(65)}`);
  console.log('SUMMARY');
  console.log(`  Projects ${DRY_RUN ? 'to fix' : 'fixed'}: ${totalFixed}`);
  console.log(`  Projects skipped (no change): ${totalSkipped}`);
  if (totalWarnings > 0) {
    console.log(`  Projects with missing rates: ${totalWarnings}`);
    console.log('  ⚠  Check those projects and add exchange rates in the UI, then re-run.');
  }
  console.log(`${'='.repeat(65)}\n`);
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  process.exit(1);
});
