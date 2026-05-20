/**
 * Diagnose procurement requirements that reference missing manufacturing orders.
 *
 * Usage:
 *   node scripts/diagnose-procurement-missing-mo-links.cjs
 */
const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

async function main() {
  console.log('Diagnosing procurement requirements with missing MO links...');

  const reqSnap = await db.collection('procurementRequirements').get();
  const activeReqs = reqSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.status !== 'cancelled');

  const uniqueMoIds = [...new Set(activeReqs.map((r) => r.moId).filter(Boolean))];
  const moExistsMap = new Map();

  for (const moId of uniqueMoIds) {
    try {
      const snap = await db.collection('manufacturingOrders').doc(moId).get();
      moExistsMap.set(moId, snap.exists);
    } catch {
      moExistsMap.set(moId, false);
    }
  }

  const missing = activeReqs.filter((r) => !r.moId || moExistsMap.get(r.moId) !== true);

  console.log(`Active procurement requirements: ${activeReqs.length}`);
  console.log(`Unique referenced MO IDs: ${uniqueMoIds.length}`);
  console.log(`Requirements with missing MO link: ${missing.length}`);

  if (missing.length === 0) {
    console.log('No missing MO links detected.');
    return;
  }

  console.log('\nMissing link rows:');
  for (const row of missing) {
    console.log(
      [
        `- requirementId=${row.id}`,
        `moId=${row.moId || 'null'}`,
        `moNumber=${row.moNumber || 'n/a'}`,
        `projectCode=${row.projectCode || 'n/a'}`,
        `supplier=${row.supplierName || row.supplierId || 'n/a'}`,
        `item="${row.itemDescription || 'n/a'}"`,
        `status=${row.status || 'n/a'}`,
      ].join(' | '),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
