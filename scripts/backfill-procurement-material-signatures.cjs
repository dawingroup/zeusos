/**
 * Backfill procurement requirement grouping/signature fields so consolidated PO
 * behavior aligns with project-level nesting outputs.
 *
 * Fields backfilled:
 * - projectId
 * - designProjectId
 * - salesOrderId
 * - projectSalesOrderGroupKey
 * - materialCategory (when missing)
 * - sourceRunId
 * - materialGroupKey
 *
 * Usage:
 *   node scripts/backfill-procurement-material-signatures.cjs
 *   node scripts/backfill-procurement-material-signatures.cjs --apply
 */
const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');
const REQUIREMENTS_COLLECTION = 'procurementRequirements';
const MANUFACTURING_ORDERS_COLLECTION = 'manufacturingOrders';
const DESIGN_PROJECTS_COLLECTION = 'designProjects';

function normalizeToken(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeMaterialName(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\bmm\b/gi, '')
    .replace(/\d+\s*mm/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForMatching(value) {
  return normalizeToken(normalizeMaterialName(value));
}

function extractThickness(value) {
  const match = String(value ?? '').match(/(\d+(?:\.\d+)?)\s*mm/i);
  if (!match) return 18;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 18;
}

function isSheetCategory(category) {
  const token = normalizeToken(category);
  return token.includes('sheet') || token.includes('panel');
}

function isSheetCategoryOrUnit(category, unit) {
  return isSheetCategory(category) || normalizeToken(unit) === 'sheet';
}

function getProjectSalesOrderGroupKey(projectId, salesOrderId) {
  return `${projectId ?? 'unlinked'}|${salesOrderId ?? 'no-so'}`;
}

function getMillisFromTimestamp(value) {
  if (!value || typeof value !== 'object') return null;

  if (typeof value.toMillis === 'function') {
    try {
      return value.toMillis();
    } catch {
      return null;
    }
  }

  if (typeof value.seconds === 'number') {
    return Math.floor(value.seconds * 1000 + (value.nanoseconds ?? 0) / 1_000_000);
  }

  return null;
}

function resolveSourceRunId(projectData) {
  const optimization = projectData?.optimizationState;
  if (!optimization || typeof optimization !== 'object') return null;

  const productionMs =
    getMillisFromTimestamp(optimization.lastProductionRun) ||
    getMillisFromTimestamp(optimization.production?.validAt);
  if (productionMs) return `production:${productionMs}`;

  const estimationMs =
    getMillisFromTimestamp(optimization.lastEstimationRun) ||
    getMillisFromTimestamp(optimization.estimation?.validAt);
  if (estimationMs) return `estimation:${estimationMs}`;

  return null;
}

async function loadProjectSheetAlignment(projectId, cache) {
  if (!projectId) return { sourceRunId: null, byMaterialAndThickness: new Map() };
  if (cache.has(projectId)) return cache.get(projectId);

  try {
    const snap = await db.collection(DESIGN_PROJECTS_COLLECTION).doc(projectId).get();
    if (!snap.exists) {
      const empty = { sourceRunId: null, byMaterialAndThickness: new Map() };
      cache.set(projectId, empty);
      return empty;
    }

    const projectData = snap.data() || {};
    const summaries = projectData.optimizationState?.estimation?.sheetSummary;
    const byMaterialAndThickness = new Map();

    if (Array.isArray(summaries)) {
      for (const row of summaries) {
        const materialName = row?.materialName;
        const thickness = Number(row?.thickness);
        const sheetLength = Number(row?.sheetSize?.length);
        const sheetWidth = Number(row?.sheetSize?.width);
        if (
          !materialName ||
          !Number.isFinite(thickness) ||
          !Number.isFinite(sheetLength) ||
          !Number.isFinite(sheetWidth)
        ) {
          continue;
        }

        const normalizedName = normalizeForMatching(materialName);
        const key = `${normalizedName}|${thickness}`;
        if (!byMaterialAndThickness.has(key)) {
          byMaterialAndThickness.set(key, {
            normalizedName,
            thickness,
            sheetLength,
            sheetWidth,
          });
        }
      }
    }

    const aligned = {
      sourceRunId: resolveSourceRunId(projectData),
      byMaterialAndThickness,
    };
    cache.set(projectId, aligned);
    return aligned;
  } catch {
    const empty = { sourceRunId: null, byMaterialAndThickness: new Map() };
    cache.set(projectId, empty);
    return empty;
  }
}

function resolveSheetSignature(req, alignment) {
  if (!isSheetCategoryOrUnit(req.materialCategory, req.unit)) return null;

  const normalizedName = normalizeForMatching(req.itemDescription);
  const thickness = extractThickness(req.itemDescription);
  const exact = alignment.byMaterialAndThickness.get(`${normalizedName}|${thickness}`);
  if (exact) return exact;

  const sameName = [];
  for (const entry of alignment.byMaterialAndThickness.values()) {
    if (entry.normalizedName === normalizedName) sameName.push(entry);
  }
  if (sameName.length === 1) return sameName[0];

  return null;
}

function buildMaterialGroupKey(req, sourceRunId, sheetSignature) {
  const projectToken = req.projectId ?? 'unlinked';
  const salesOrderToken = req.salesOrderId ?? 'no-so';
  const categoryToken = normalizeToken(req.materialCategory ?? 'unknown');
  const unitToken = normalizeToken(req.unit ?? 'unit');
  const sourceToken = sourceRunId ? `run:${sourceRunId}` : 'run:na';

  if (sheetSignature) {
    return [
      projectToken,
      salesOrderToken,
      categoryToken,
      `sheet:${sheetSignature.normalizedName}`,
      `t:${sheetSignature.thickness}`,
      `sz:${sheetSignature.sheetLength}x${sheetSignature.sheetWidth}`,
      sourceToken,
    ].join('|');
  }

  const identityToken = req.inventoryItemId
    ? `inv:${req.inventoryItemId}`
    : `desc:${normalizeToken(req.itemDescription)}`;
  return `${projectToken}|${salesOrderToken}|${categoryToken}|${identityToken}|${unitToken}|${sourceToken}`;
}

async function main() {
  console.log('Procurement material signature backfill');
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const reqSnap = await db.collection(REQUIREMENTS_COLLECTION).get();
  const allReqs = reqSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const targetReqs = allReqs.filter((r) => r.status !== 'cancelled');

  const uniqueMoIds = [...new Set(targetReqs.map((r) => r.moId).filter(Boolean))];
  const moCache = new Map();
  for (const moId of uniqueMoIds) {
    try {
      const moSnap = await db.collection(MANUFACTURING_ORDERS_COLLECTION).doc(moId).get();
      if (moSnap.exists) moCache.set(moId, moSnap.data());
    } catch {
      // best-effort: leave missing MO lookups unresolved
    }
  }

  const projectAlignmentCache = new Map();
  const toUpdate = [];
  let scanned = 0;
  let alreadyAligned = 0;
  let skippedMissingMO = 0;

  for (const req of targetReqs) {
    scanned += 1;

    const mo = moCache.get(req.moId);
    if (!mo) {
      skippedMissingMO += 1;
      continue;
    }

    const next = {
      projectId: mo.designProjectId ?? mo.projectId ?? req.projectId ?? null,
      designProjectId: mo.designProjectId ?? mo.projectId ?? req.designProjectId ?? null,
      salesOrderId: mo.salesOrderId ?? req.salesOrderId ?? null,
      projectSalesOrderGroupKey: null,
      materialCategory: req.materialCategory ?? req.category ?? null,
      sourceRunId: null,
      materialGroupKey: null,
    };
    next.projectSalesOrderGroupKey = getProjectSalesOrderGroupKey(next.projectId, next.salesOrderId);

    const alignment = await loadProjectSheetAlignment(next.designProjectId, projectAlignmentCache);
    next.sourceRunId = alignment.sourceRunId;
    const sheetSignature = resolveSheetSignature(
      {
        itemDescription: req.itemDescription,
        materialCategory: next.materialCategory,
        unit: req.unit,
      },
      alignment,
    );
    next.materialGroupKey = buildMaterialGroupKey(
      {
        projectId: next.projectId,
        salesOrderId: next.salesOrderId,
        materialCategory: next.materialCategory,
        unit: req.unit,
        inventoryItemId: req.inventoryItemId ?? null,
        itemDescription: req.itemDescription,
      },
      next.sourceRunId,
      sheetSignature,
    );

    const patch = {};
    if ((req.projectId ?? null) !== next.projectId) patch.projectId = next.projectId;
    if ((req.designProjectId ?? null) !== next.designProjectId) patch.designProjectId = next.designProjectId;
    if ((req.salesOrderId ?? null) !== next.salesOrderId) patch.salesOrderId = next.salesOrderId;
    if ((req.projectSalesOrderGroupKey ?? null) !== next.projectSalesOrderGroupKey) {
      patch.projectSalesOrderGroupKey = next.projectSalesOrderGroupKey;
    }
    if ((req.materialCategory ?? null) !== next.materialCategory) patch.materialCategory = next.materialCategory;
    if ((req.sourceRunId ?? null) !== (next.sourceRunId ?? null)) patch.sourceRunId = next.sourceRunId ?? null;
    if ((req.materialGroupKey ?? null) !== next.materialGroupKey) patch.materialGroupKey = next.materialGroupKey;

    if (Object.keys(patch).length === 0) {
      alreadyAligned += 1;
      continue;
    }

    patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    toUpdate.push({ id: req.id, patch });
  }

  console.log(`Scanned (non-cancelled): ${scanned}`);
  console.log(`Already aligned: ${alreadyAligned}`);
  console.log(`Skipped (missing MO): ${skippedMissingMO}`);
  console.log(`Candidates to update: ${toUpdate.length}`);

  if (!APPLY) {
    console.log('\nDry-run complete. Pass --apply to write updates.');
    return;
  }

  const chunkSize = 400;
  for (let i = 0; i < toUpdate.length; i += chunkSize) {
    const chunk = toUpdate.slice(i, i + chunkSize);
    const batch = db.batch();
    for (const row of chunk) {
      batch.update(db.collection(REQUIREMENTS_COLLECTION).doc(row.id), row.patch);
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
