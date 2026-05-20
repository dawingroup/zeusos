/**
 * Set `counters/so_global_{year}` to max(counter, max SO-{year}-* in salesOrders).
 * Run after switching the app to org-wide SO numbering, or if the counter drifted.
 *
 *   gcloud auth application-default login
 *   node scripts/repair-sales-order-global-counter.cjs 2026        # dry-run
 *   node scripts/repair-sales-order-global-counter.cjs 2026 --apply
 *
 * Omit the year to repair the current calendar year only.
 */

const admin = require('firebase-admin');

const PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  'dawinos';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');
const yearArg = process.argv.find((a) => /^\d{4}$/.test(a));
const YEARS = yearArg ? [parseInt(yearArg, 10)] : [new Date().getFullYear()];

async function maxSeqInOrders(year) {
  const yearLo = `SO-${year}-`;
  const yearHi = `SO-${year + 1}-`;
  const snap = await db
    .collection('salesOrders')
    .where('orderNumber', '>=', yearLo)
    .where('orderNumber', '<', yearHi)
    .get();
  let max = 0;
  const re = new RegExp(`^SO-${year}-(\\d+)$`);
  for (const d of snap.docs) {
    const on = d.data().orderNumber;
    if (typeof on !== 'string') continue;
    const m = on.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

async function main() {
  console.log(`Project: ${PROJECT_ID}  |  ${APPLY ? 'WRITE' : 'dry-run'}\n`);

  for (const year of YEARS) {
    const fromOrders = await maxSeqInOrders(year);
    const ref = db.collection('counters').doc(`so_global_${year}`);
    const snap = await ref.get();
    const cur = snap.exists ? snap.data().value ?? 0 : 0;
    const target = Math.max(cur, fromOrders);
    console.log(
      `Year ${year}: counter doc value=${cur}  max in orders=${fromOrders}  → set value=${target}`,
    );
    if (APPLY) {
      await ref.set(
        { value: target, prefix: 'SO', year, scheme: 'global' },
        { merge: true },
      );
    }
  }

  if (!APPLY) {
    console.log('\nAdd --apply to write counters.');
  } else {
    console.log('\nDone.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
