/**
 * DIAGNOSE LAUNDRY PROJECT
 *
 * Dumps all payments for the project whose name contains "laundry"
 * (case-insensitive) and shows the current budget.spent value.
 *
 * Usage:
 *   node scripts/diagnose-laundry-project.cjs
 */

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

const PROJECTS = 'organizations/default/advisory_projects';
const PAYMENTS = 'payments';

function fmt(n, cur = 'UGX') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: cur,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

async function main() {
  // 1. Find the project
  const projectsSnap = await db.collection(PROJECTS).get();
  const laundryProjects = projectsSnap.docs.filter(d => {
    const name = (d.data().name || '').toLowerCase();
    return name.includes('laundry');
  });

  if (laundryProjects.length === 0) {
    console.log('No project with "laundry" in name found.');
    console.log('All projects:');
    projectsSnap.docs.forEach(d => console.log(' -', d.id, d.data().name));
    return;
  }

  for (const projectDoc of laundryProjects) {
    const project = { id: projectDoc.id, ...projectDoc.data() };
    const budgetCurrency = project.budget?.currency || 'USD';

    console.log('\n' + '='.repeat(70));
    console.log('PROJECT:', project.name, '  ID:', project.id);
    console.log('Budget currency:   ', budgetCurrency);
    console.log('budget.spent:      ', project.budget?.spent, budgetCurrency);
    console.log('budget.totalBudget:', project.budget?.totalBudget, budgetCurrency);
    console.log('budget.committed:  ', project.budget?.committed, budgetCurrency);
    console.log('budget.remaining:  ', project.budget?.remaining, budgetCurrency);

    // 2. Load ALL payments for this project (any status)
    const paymentsSnap = await db
      .collection(PAYMENTS)
      .where('projectId', '==', project.id)
      .get();

    console.log('\nAll payments (' + paymentsSnap.size + '):');
    if (paymentsSnap.empty) {
      console.log('  (none)');
    } else {
      paymentsSnap.docs.forEach(d => {
        const p = d.data();
        console.log(
          `  ${p.paymentNumber || d.id}` +
          `  status=${p.status}` +
          `  currency=${p.currency || '?'}` +
          `  netAmount=${p.netAmount}` +
          (p.exchangeRate ? `  rate=${JSON.stringify(p.exchangeRate)}` : '  rate=NONE') +
          `  programId=${p.programId || 'NONE'}`
        );
      });
    }

    // 3. Show only approved/paid
    const approvedPaid = paymentsSnap.docs.filter(d =>
      ['approved', 'paid'].includes(d.data().status)
    );
    console.log('\nApproved/paid payments:', approvedPaid.length);
    approvedPaid.forEach(d => {
      const p = d.data();
      console.log(
        `  ${p.paymentNumber || d.id}` +
        `  ${p.currency || '?'} ${p.netAmount}`
      );
    });
  }
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
