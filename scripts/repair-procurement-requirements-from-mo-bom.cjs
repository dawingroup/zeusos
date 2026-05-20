/**
 * Repair malformed procurement requirements by:
 * 1) Cancelling malformed pending rows for a project code
 * 2) Recreating clean pending rows from manufacturingOrders.bom
 *
 * Malformed = pending requirement missing any of:
 * - moId
 * - itemDescription
 * - quantityRequired (> 0)
 *
 * Usage:
 *   node scripts/repair-procurement-requirements-from-mo-bom.cjs --projectCode=DF-2026-584
 *   node scripts/repair-procurement-requirements-from-mo-bom.cjs --projectCode=DF-2026-584 --apply
 */
const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

const args = process.argv.slice(2);
function arg(name, def = null) {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : def;
}

const PROJECT_CODE = arg('projectCode');
const APPLY = args.includes('--apply');

if (!PROJECT_CODE) {
  console.error('❌ Missing required flag: --projectCode=<CODE>');
  process.exit(1);
}

function normalizeToken(value) {
  return String(value ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function buildMaterialGroupKey({
  projectId,
  salesOrderId,
  category,
  inventoryItemId,
  itemDescription,
  unit,
}) {
  const projectToken = projectId ?? 'unlinked';
  const salesToken = salesOrderId ?? 'no-so';
  const categoryToken = normalizeToken(category ?? 'unknown');
  const unitToken = normalizeToken(unit ?? 'unit');
  const identity = inventoryItemId
    ? `inv:${inventoryItemId}`
    : `desc:${normalizeToken(itemDescription)}`;
  return `${projectToken}|${salesToken}|${categoryToken}|${identity}|${unitToken}|run:na`;
}

function isMalformedPendingRequirement(r) {
  if (r.status !== 'pending') return false;
  const hasMo = typeof r.moId === 'string' && r.moId.trim().length > 0;
  const hasItem = typeof r.itemDescription === 'string' && r.itemDescription.trim().length > 0;
  const qty = Number(r.quantityRequired ?? 0);
  return !hasMo || !hasItem || !Number.isFinite(qty) || qty <= 0;
}

function isPurchasableBOMEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  const category = normalizeToken(entry.category ?? '');
  if (category === 'labor') return false;
  return true;
}

async function main() {
  console.log(`Repair procurement requirements for project ${PROJECT_CODE}`);
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const reqSnap = await db
    .collection('procurementRequirements')
    .where('projectCode', '==', PROJECT_CODE)
    .get();
  const reqs = reqSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
  const malformed = reqs.filter(isMalformedPendingRequirement);

  const moSnap = await db
    .collection('manufacturingOrders')
    .where('projectCode', '==', PROJECT_CODE)
    .get();
  const mos = moSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Build active req lookup by moId+bomEntryId to avoid duplicate creation
  const activeStatuses = new Set(['pending', 'added-to-po', 'ordered', 'received']);
  const activeByMoBom = new Set(
    reqs
      .filter((r) => activeStatuses.has(r.status))
      .map((r) => `${r.moId ?? ''}::${r.bomEntryId ?? ''}`),
  );

  const toCreate = [];
  for (const mo of mos) {
    const bom = Array.isArray(mo.bom) ? mo.bom : [];
    const projectId = mo.designProjectId ?? mo.projectId ?? null;
    const salesOrderId = mo.salesOrderId ?? null;
    const projectSalesOrderGroupKey = `${projectId ?? 'unlinked'}|${salesOrderId ?? 'no-so'}`;

    for (const entry of bom) {
      if (!isPurchasableBOMEntry(entry)) continue;

      const bomEntryId = entry.id ?? `BOM-${Math.random().toString(36).slice(2, 10)}`;
      const dedupeKey = `${mo.id}::${bomEntryId}`;
      if (activeByMoBom.has(dedupeKey)) continue;

      const quantityRequired = Number(entry.quantityRequired ?? 0);
      if (!Number.isFinite(quantityRequired) || quantityRequired <= 0) continue;

      const estimatedUnitCost = Number(entry.unitCost ?? 0);
      const totalFromBOM = Number(entry.totalCost ?? NaN);
      const estimatedTotalCost = Number.isFinite(totalFromBOM)
        ? totalFromBOM
        : quantityRequired * estimatedUnitCost;

      const itemDescription = entry.itemName ?? entry.materialName ?? 'Material';
      const unit = entry.unit ?? 'unit';
      const materialCategory = entry.category ?? null;

      toCreate.push({
        subsidiaryId: mo.subsidiaryId ?? 'finishes',
        moId: mo.id,
        moNumber: mo.moNumber ?? 'N/A',
        bomEntryId,
        designItemName: mo.designItemName ?? '',
        projectCode: mo.projectCode ?? PROJECT_CODE,
        projectId,
        designProjectId: projectId,
        salesOrderId,
        projectSalesOrderGroupKey,
        inventoryItemId: entry.inventoryItemId ?? null,
        itemDescription,
        quantityRequired,
        unit,
        estimatedUnitCost,
        estimatedTotalCost,
        currency: mo.costSummary?.currency ?? 'UGX',
        materialCategory,
        materialGroupKey: buildMaterialGroupKey({
          projectId,
          salesOrderId,
          category: materialCategory,
          inventoryItemId: entry.inventoryItemId ?? null,
          itemDescription,
          unit,
        }),
        sourceRunId: null,
        supplierId: entry.supplierId ?? null,
        supplierName: entry.supplierName ?? null,
        status: 'pending',
        poId: null,
        poLineItemId: null,
        source: 'repair_from_mo_bom',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'repair-procurement-requirements-from-mo-bom',
      });
    }
  }

  console.log(`Existing requirements for project: ${reqs.length}`);
  console.log(`Malformed pending rows to cancel: ${malformed.length}`);
  console.log(`Manufacturing orders found: ${mos.length}`);
  console.log(`Clean requirements to create: ${toCreate.length}`);

  if (!APPLY) {
    console.log('Dry-run complete. Re-run with --apply to execute.');
    return;
  }

  // Cancel malformed pending rows
  for (let i = 0; i < malformed.length; i += 400) {
    const batch = db.batch();
    for (const row of malformed.slice(i, i + 400)) {
      batch.update(row.ref, {
        status: 'cancelled',
        cancellationReason: 'repair_malformed_requirement',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  // Create repaired rows
  for (const row of toCreate) {
    await db.collection('procurementRequirements').add(row);
  }

  console.log('Repair applied successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
