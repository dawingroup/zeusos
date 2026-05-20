/**
 * Backfill missing manufacturing order linkage fields:
 * - salesOrderId
 * - designProjectId (alias of projectId)
 *
 * Strategy:
 * 1) Prefer existing references on the MO:
 *    - demandSource.referenceId (when type = sales_order)
 *    - parentMO.salesOrderId (for cascade children/derivatives)
 * 2) Fallback to Sales Orders linked by design project:
 *    - salesOrders.designProjectId == MO.projectId|MO.designProjectId
 * 3) Only write when a single unambiguous sales order candidate is found.
 *
 * Usage:
 *   node scripts/backfill-mo-project-sales-order-links.cjs
 *   node scripts/backfill-mo-project-sales-order-links.cjs --apply
 */
const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');

function getProjectId(docData) {
  return docData.designProjectId || docData.projectId || docData?.sourceRef?.designProjectId || null;
}

function getDemandSalesOrderId(docData) {
  if (!docData?.demandSource || typeof docData.demandSource !== 'object') return null;
  if (docData.demandSource.type !== 'sales_order') return null;
  const referenceId = docData.demandSource.referenceId;
  return typeof referenceId === 'string' && referenceId.trim() ? referenceId : null;
}

async function buildSalesOrderMapByProjectId() {
  const snap = await db.collection('salesOrders').get();
  const map = new Map();
  for (const soDoc of snap.docs) {
    const so = soDoc.data();
    const projectId = so.designProjectId;
    if (!projectId || typeof projectId !== 'string') continue;
    if (!map.has(projectId)) map.set(projectId, []);
    map.get(projectId).push(soDoc.id);
  }
  return map;
}

async function main() {
  console.log('MO project + SO linkage backfill');
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const moSnap = await db.collection('manufacturingOrders').get();
  const soByProject = await buildSalesOrderMapByProjectId();

  const allDocs = new Map();
  for (const d of moSnap.docs) allDocs.set(d.id, d.data());

  const toUpdate = [];
  const unresolved = [];
  let alreadyComplete = 0;
  let scanned = 0;

  for (const moDoc of moSnap.docs) {
    scanned += 1;
    const mo = moDoc.data();

    const currentSalesOrderId = typeof mo.salesOrderId === 'string' && mo.salesOrderId.trim()
      ? mo.salesOrderId
      : null;
    const projectId = getProjectId(mo);

    const patch = {};

    if (!mo.designProjectId && projectId) {
      patch.designProjectId = projectId;
    }

    if (!currentSalesOrderId) {
      const candidates = new Set();
      const demandSo = getDemandSalesOrderId(mo);
      if (demandSo) candidates.add(demandSo);

      const parentMOId = mo.parentMOId;
      if (typeof parentMOId === 'string' && parentMOId.trim()) {
        const parent = allDocs.get(parentMOId);
        if (parent?.salesOrderId && typeof parent.salesOrderId === 'string') {
          candidates.add(parent.salesOrderId);
        }
      }

      if (projectId && soByProject.has(projectId)) {
        for (const soId of soByProject.get(projectId)) {
          candidates.add(soId);
        }
      }

      if (candidates.size === 1) {
        patch.salesOrderId = [...candidates][0];
      } else if (candidates.size > 1) {
        unresolved.push({
          moId: moDoc.id,
          reason: 'ambiguous_sales_order_candidates',
          candidates: [...candidates],
          projectId,
        });
      } else {
        unresolved.push({
          moId: moDoc.id,
          reason: 'no_sales_order_candidate',
          candidates: [],
          projectId,
        });
      }
    }

    if (Object.keys(patch).length === 0) {
      if (currentSalesOrderId && mo.designProjectId) alreadyComplete += 1;
      continue;
    }

    toUpdate.push({ id: moDoc.id, patch });
  }

  console.log(`Scanned: ${scanned}`);
  console.log(`Already complete: ${alreadyComplete}`);
  console.log(`Candidates to update: ${toUpdate.length}`);
  console.log(`Unresolved rows: ${unresolved.length}`);

  if (unresolved.length > 0) {
    console.log('\nSample unresolved rows:');
    unresolved.slice(0, 20).forEach((row) => {
      console.log(
        `  - ${row.moId} [${row.reason}] project=${row.projectId || 'none'} candidates=${row.candidates.join(', ') || 'none'}`,
      );
    });
  }

  if (!APPLY) {
    console.log('\nDry-run complete. Pass --apply to write updates.');
    return;
  }

  const chunkSize = 400;
  for (let i = 0; i < toUpdate.length; i += chunkSize) {
    const chunk = toUpdate.slice(i, i + chunkSize);
    const batch = db.batch();
    for (const entry of chunk) {
      batch.update(db.collection('manufacturingOrders').doc(entry.id), entry.patch);
    }
    await batch.commit();
    console.log(`Committed ${Math.min(i + chunkSize, toUpdate.length)} / ${toUpdate.length}`);
  }

  console.log('\nBackfill applied successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
