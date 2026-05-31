/**
 * Finance group-rollup + aging E2E — Phase 1 verification.
 *
 * Seeds 5 brand orgs (UGX/KES mix), gl_postings over two periods,
 * an intercompany invoice, and client invoices, then runs the REAL
 * groupRollup + aging engines against the Firestore emulator and asserts:
 *   - the consolidated balance sheet BALANCES (current-year P&L folds into equity)
 *   - intercompany invoices AUTO-ELIMINATE at group
 *   - a KES brand is FX-converted into the UGX presentation currency
 *   - AR aging buckets + FX-normalises
 *
 * Run (starts + tears down the emulator automatically):
 *   cd /Users/danielonzimai/Developer/zeusos && \
 *     firebase emulators:exec --only firestore --project zeusos \
 *     "node scripts/finance-e2e.cjs"
 */

// Use the SAME firebase-admin copy the Cloud Functions use, so the seed and
// the engine share one Admin app + one emulator connection.
const admin = require('../functions/node_modules/firebase-admin');

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'zeusos';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'zeusos';
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

if (!admin.apps.length) admin.initializeApp({ projectId: 'zeusos' });
const db = admin.firestore();

// ── tiny assert harness ─────────────────────────────────────────────────────
let pass = 0;
let fail = 0;
function check(label, cond, detail) {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${label}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function leg(accountCode, debitMinor, creditMinor) {
  const l = { accountCode };
  if (debitMinor) l.debitMinor = debitMinor;
  if (creditMinor) l.creditMinor = creditMinor;
  return l;
}

async function seed() {
  console.log('Seeding emulator…');
  const batch = db.batch();

  // Orgs — mixed base currencies.
  const orgs = {
    'zeus-the-agency': 'UGX',
    'zeus-digital': 'UGX',
    'labyrinth': 'KES',
    'odd-gorilla': 'UGX',
    'house-of-zeus': 'KES',
  };
  for (const [id, base_currency] of Object.entries(orgs)) {
    batch.set(db.doc(`organizations/${id}`), { id, kind: 'SUBSIDIARY', base_currency });
  }
  batch.set(db.doc('organizations/zeus-group'), { id: 'zeus-group', kind: 'PARENT', base_currency: 'UGX' });

  // Finance config.
  batch.set(db.doc('finance_config/group'), { presentationCurrency: 'UGX' });
  batch.set(db.doc('finance_config/payment_terms'), { defaultPaymentTermsDays: 30 });

  // ── gl_postings (all balanced) ────────────────────────────────────────────
  const post = (id, orgId, date, lines, currency = 'UGX') =>
    batch.set(db.doc(`gl_postings/${id}`), { entityOrgId: orgId, currency, date, lines });

  // zeus-the-agency (UGX): Apr recognise 2,000,000 rev → AR; May collect 1,200,000; May 500,000 cost → AP.
  post('zta_apr_rev', 'zeus-the-agency', '2026-04-15', [leg('1200', 2_000_000, 0), leg('4000', 0, 2_000_000)]);
  post('zta_may_pay', 'zeus-the-agency', '2026-05-10', [leg('1000', 1_200_000, 0), leg('1200', 0, 1_200_000)]);
  post('zta_may_cost', 'zeus-the-agency', '2026-05-20', [leg('5000', 500_000, 0), leg('2000', 0, 500_000)]);

  // labyrinth (KES): Apr 300,000 rev → cash; May 100,000 opex.
  post('lab_apr_rev', 'labyrinth', '2026-04-12', [leg('1000', 300_000, 0), leg('4000', 0, 300_000)], 'KES');
  post('lab_may_opex', 'labyrinth', '2026-05-18', [leg('5100', 100_000, 0), leg('1000', 0, 100_000)], 'KES');
  // labyrinth IC sale to parent: 50,000 KES — sub books IC AR + IC revenue.
  post('lab_ic', 'labyrinth', '2026-05-20', [leg('1200', 50_000, 0), leg('4000', 0, 50_000)], 'KES');

  // Intercompany invoice (the elimination source).
  batch.set(db.doc('intercompany_invoices/ic_e2e'), {
    fromOrgId: 'labyrinth', toOrgId: 'zeus-group',
    amount: { amountMinor: 50_000, currency: 'KES' },
    status: 'POSTED', postedAt: '2026-05-20', raisedAt: '2026-05-20',
  });

  // Client invoices (AR aging).
  batch.set(db.doc('client_invoices/inv_e2e_1'), {
    clientId: 'acme', status: 'ISSUED', issuedAt: '2026-03-01',
    total: { amountMinor: 1_000_000, currency: 'UGX' }, paidMinor: 0,
    lines: [{ sourceSubsidiaryId: 'zeus-the-agency' }],
  });
  batch.set(db.doc('client_invoices/inv_e2e_2'), {
    clientId: 'globex', status: 'PART_PAID', issuedAt: '2026-05-15',
    total: { amountMinor: 200_000, currency: 'KES' }, paidMinor: 50_000,
    lines: [{ sourceSubsidiaryId: 'labyrinth' }],
  });

  await batch.commit();
  console.log('Seed complete.\n');
}

async function main() {
  await seed();

  const { runGroupRollup } = require('../functions/src/finance/groupRollup');
  const aging = require('../functions/src/finance/aging');

  console.log('Running group rollup (2 periods ending May 2026)…');
  const result = await runGroupRollup({ asOf: new Date(Date.UTC(2026, 4, 31)), count: 2 });
  console.log(`  presentationCurrency=${result.presentationCurrency}  periods=${result.periods.join(', ')}\n`);

  const apr = (await db.doc('companies/zeus-group/rollups/2026-04').get()).data();
  const may = (await db.doc('companies/zeus-group/rollups/2026-05').get()).data();

  console.log('Assertions — group rollup:');
  check('April rollup written', !!apr);
  check('May rollup written', !!may);
  check('April balance sheet balances', apr && apr.balanceSheet.isBalanced, apr && `diff=${apr.balanceSheet.difference}`);
  check('May balance sheet balances', may && may.balanceSheet.isBalanced, may && `diff=${may.balanceSheet.difference}`);
  check('May presentation currency = UGX', may && may.presentationCurrency === 'UGX');
  const icRows = (may && may.eliminationsApplied || []).filter((r) => r.source === 'ic-auto');
  check('IC invoice auto-eliminated (4 rows)', icRows.length === 4, `got ${icRows.length}`);
  check('labyrinth consolidated as KES', may && may.bySubsidiary.labyrinth && may.bySubsidiary.labyrinth.baseCurrency === 'KES');
  check('labyrinth FX rate > 1 (KES→UGX)', may && may.bySubsidiary.labyrinth && may.bySubsidiary.labyrinth.fxRateToPresentation > 1,
    may && may.bySubsidiary.labyrinth && `rate=${may.bySubsidiary.labyrinth.fxRateToPresentation}`);
  check('zeus-the-agency contributed', may && may.sourceSubsidiaries.includes('zeus-the-agency'));
  // Operating revenue was booked in APRIL (ZTA 2,000,000 UGX + labyrinth
  // 300,000 KES → FX UGX). May's ONLY revenue was the intercompany sale, which
  // the auto-elimination removes — so May consolidated revenue is exactly 0.
  // That zero is the strongest proof the IC elimination fired end-to-end.
  check('April revenue carries ZTA 2M + FX labyrinth', apr && apr.pnl.revenue > 2_000_000, apr && `aprRev=${apr.pnl.revenue}`);
  check('May revenue nets to 0 (IC eliminated)', may && may.pnl.revenue === 0, may && `mayRev=${may.pnl.revenue}`);

  console.log('\nRunning AR aging…');
  const ar = await aging.getArAging({ now: new Date(Date.UTC(2026, 4, 31)) });
  console.log(`  totalOutstanding=${ar.totalOutstanding} ${ar.presentationCurrency}  buckets=${JSON.stringify(ar.buckets)}`);
  console.log('Assertions — AR aging:');
  check('AR presentation currency = UGX', ar.presentationCurrency === 'UGX');
  // inv1: 1,000,000 UGX issued 3/1, terms 30 → due 3/31 → 61d overdue → d61_90.
  check('UGX invoice in 61-90 bucket', ar.buckets.d61_90 === 1_000_000, `d61_90=${ar.buckets.d61_90}`);
  // inv2: balance 150,000 KES → UGX at 29 = 4,350,000; issued 5/15 → due 6/14 → current.
  check('KES invoice FX-normalised into current', ar.buckets.current === 150_000 * 29, `current=${ar.buckets.current}`);
  check('AR total = sum of both (FX-normalised)', ar.totalOutstanding === 1_000_000 + 150_000 * 29, `total=${ar.totalOutstanding}`);

  console.log(`\n${'='.repeat(48)}`);
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  console.log('='.repeat(48));
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('E2E crashed:', err);
  process.exit(1);
});
