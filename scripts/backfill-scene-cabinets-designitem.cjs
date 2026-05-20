/**
 * Backfill Scene Cabinets — DesignItem Linkage (P2 Slice 5)
 *
 * Fills `SceneCabinet.designItemId` on existing orphan cabinets so the
 * field can be safely flipped to required (Slice 6).
 *
 * Two modes:
 *
 *  --mode=auto       For each scene with orphan cabinets, create ONE new
 *                    DesignItem under the scene's projectId named after
 *                    the scene (prefix "[Auto] " to flag it for operator
 *                    review), then bind every orphan cabinet in that
 *                    scene to the new item. Safe default when we don't
 *                    know the operator's intent — no cabinets are lost,
 *                    items can be merged/renamed later.
 *
 *  --mode=mapping    Read an operator-supplied CSV of sceneId → designItemId
 *                    (or cabinetId → designItemId) and assign accordingly.
 *                    Skips any row that references an item that doesn't
 *                    exist in the expected project. Use this after the
 *                    audit CSV has been hand-annotated.
 *
 * Flags:
 *   --dry-run        Don't write; print what would happen.
 *   --mapping=PATH   Required when --mode=mapping. CSV columns:
 *                      id_kind,id,designItemId
 *                    where id_kind ∈ {scene,cabinet}.
 *   --project=PID    Optional: restrict to scenes in this project.
 *
 * Safety:
 *   - NEVER modifies locked cabinets unless --force-locked is passed.
 *     Locked cabinets in production usually have explicit handling
 *     requirements — surface them and let an operator decide.
 *   - Skips scenes whose projectId is empty / 'standalone' — those need
 *     a project attachment first (separate Slice 5 / operator task).
 *   - Updates the parent `DesignScene.linkedDesignItemIds[]` cache to
 *     match the new set of cabinet designItemIds.
 *
 * Run:
 *   node scripts/backfill-scene-cabinets-designitem.cjs --mode=auto --dry-run
 *   node scripts/backfill-scene-cabinets-designitem.cjs --mode=auto
 *   node scripts/backfill-scene-cabinets-designitem.cjs --mode=mapping --mapping=./tmp/annotated.csv
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

// ─── CLI parsing ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function flag(name, defaultValue) {
  const prefix = `--${name}=`;
  const hit = args.find(a => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  return args.includes(`--${name}`) ? true : defaultValue;
}

const MODE = flag('mode', null);
const DRY_RUN = !!flag('dry-run', false);
const MAPPING_PATH = flag('mapping', null);
const PROJECT_FILTER = flag('project', null);
const FORCE_LOCKED = !!flag('force-locked', false);

if (!MODE || (MODE !== 'auto' && MODE !== 'mapping')) {
  console.error(
    'Usage: node scripts/backfill-scene-cabinets-designitem.cjs --mode=auto|mapping [--dry-run] [--mapping=PATH] [--project=PID] [--force-locked]',
  );
  process.exit(1);
}
if (MODE === 'mapping' && !MAPPING_PATH) {
  console.error('--mode=mapping requires --mapping=PATH');
  process.exit(1);
}

// ─── Mapping-mode CSV loader ────────────────────────────────────────────────

function loadMapping(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8').trim().split(/\r?\n/);
  const header = raw.shift().split(',').map(s => s.trim());
  const idxKind = header.indexOf('id_kind');
  const idxId = header.indexOf('id');
  const idxItem = header.indexOf('designItemId');
  if (idxKind < 0 || idxId < 0 || idxItem < 0) {
    throw new Error(
      `Mapping CSV must have columns: id_kind,id,designItemId — got ${header.join(',')}`,
    );
  }
  const byScene = new Map();    // sceneId → designItemId (fallback for all cabinets)
  const byCabinet = new Map();  // cabinetId → designItemId (precedence)
  for (const line of raw) {
    if (!line.trim()) continue;
    const cells = line.split(',').map(s => s.trim());
    const kind = cells[idxKind];
    const id = cells[idxId];
    const designItemId = cells[idxItem];
    if (!kind || !id || !designItemId) continue;
    if (kind === 'scene') byScene.set(id, designItemId);
    else if (kind === 'cabinet') byCabinet.set(id, designItemId);
  }
  return { byScene, byCabinet };
}

// ─── Item existence cache ───────────────────────────────────────────────────

const itemCache = new Map();
async function itemExists(projectId, itemId) {
  const key = `${projectId}::${itemId}`;
  if (itemCache.has(key)) return itemCache.get(key);
  const snap = await db
    .collection('designProjects')
    .doc(projectId)
    .collection('designItems')
    .doc(itemId)
    .get();
  const exists = snap.exists;
  itemCache.set(key, exists);
  return exists;
}

// ─── Auto-mode item creation ────────────────────────────────────────────────

async function createAutoDesignItem(projectId, sceneName, sceneId) {
  // Mirror the minimum shape `createDesignItem()` produces in
  // `src/modules/design-manager/services/firestore.ts`: name, category,
  // sourcingType, ragStatus defaults, sequence, timestamps. We keep the
  // RAG status simple — an operator will clean this up on review.
  const ref = db.collection('designProjects').doc(projectId).collection('designItems').doc();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const itemData = {
    name: `[Auto] ${sceneName || 'Untitled Scene'}`,
    category: 'casework',
    sourcingType: 'MANUFACTURED',
    currentStage: 'not-started',
    ragStatus: {},
    sortOrder: 999,
    // Audit breadcrumb so operators can trace these back to the backfill.
    backfillSource: {
      kind: 'scene-cabinets-backfill',
      sceneId,
      createdAt: new Date().toISOString(),
    },
    createdAt: now,
    updatedAt: now,
  };

  if (DRY_RUN) return { id: `(dry-run:${ref.id})`, ...itemData };
  await ref.set(itemData);
  return { id: ref.id, ...itemData };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `\n=== Backfill scene cabinets ${MODE.toUpperCase()} mode ${DRY_RUN ? '(DRY RUN)' : '(APPLY)'} ===\n`,
  );

  const mapping = MODE === 'mapping' ? loadMapping(MAPPING_PATH) : null;
  if (mapping) {
    console.log(
      `Loaded mapping: ${mapping.byScene.size} scene-level, ${mapping.byCabinet.size} cabinet-level\n`,
    );
  }

  const scenesSnap = await db.collection('designScenes').get();
  let touchedScenes = 0;
  let touchedCabinets = 0;
  let skippedStandalone = 0;
  let skippedLocked = 0;
  let skippedNoMapping = 0;
  let createdAutoItems = 0;

  for (const sceneDoc of scenesSnap.docs) {
    const scene = sceneDoc.data();
    const sceneId = sceneDoc.id;
    const projectId = scene.projectId;

    if (PROJECT_FILTER && projectId !== PROJECT_FILTER) continue;

    if (!projectId || projectId === 'standalone') {
      skippedStandalone += 1;
      continue;
    }

    const cabSnap = await sceneDoc.ref.collection('cabinets').get();

    // Identify orphans in this scene.
    const orphans = cabSnap.docs.filter(d => {
      const c = d.data();
      return !c.designItemId || typeof c.designItemId !== 'string' || c.designItemId === '';
    });
    if (orphans.length === 0) continue;

    console.log(
      `Scene ${sceneId} (${scene.name ?? '—'}) — ${orphans.length} orphan cabinet(s)`,
    );

    // Decide the designItemId for each orphan up front so the write
    // batch is atomic-ish per scene.
    const assignments = []; // { cabinetRef, designItemId, cabinetCode }
    let autoItemIdForScene = null;

    for (const cabDoc of orphans) {
      const cab = cabDoc.data();

      if (cab.isLocked && !FORCE_LOCKED) {
        skippedLocked += 1;
        console.log(
          `  · SKIP locked cabinet ${cabDoc.id} (${cab.cabinetCode}) — pass --force-locked to include`,
        );
        continue;
      }

      let designItemId = null;

      if (MODE === 'mapping') {
        designItemId =
          mapping.byCabinet.get(cabDoc.id) ??
          mapping.byScene.get(sceneId) ??
          null;
        if (!designItemId) {
          skippedNoMapping += 1;
          console.log(
            `  · SKIP cabinet ${cabDoc.id} (${cab.cabinetCode}) — no mapping`,
          );
          continue;
        }
        const exists = await itemExists(projectId, designItemId);
        if (!exists) {
          skippedNoMapping += 1;
          console.log(
            `  · SKIP cabinet ${cabDoc.id} — mapped designItemId ${designItemId} does not exist under project ${projectId}`,
          );
          continue;
        }
      } else {
        // auto mode: create (or reuse) one new DesignItem for this scene.
        if (!autoItemIdForScene) {
          const created = await createAutoDesignItem(projectId, scene.name, sceneId);
          autoItemIdForScene = created.id;
          createdAutoItems += 1;
          console.log(
            `  · Auto-created DesignItem ${autoItemIdForScene} "${created.name}"`,
          );
        }
        designItemId = autoItemIdForScene;
      }

      assignments.push({
        cabinetRef: cabDoc.ref,
        cabinetId: cabDoc.id,
        cabinetCode: cab.cabinetCode,
        designItemId,
      });
    }

    if (assignments.length === 0) continue;

    // Write per-scene: update cabinets, then update the scene cache.
    if (DRY_RUN) {
      for (const a of assignments) {
        console.log(
          `  · DRY assign ${a.cabinetCode ?? a.cabinetId} → ${a.designItemId}`,
        );
      }
      touchedCabinets += assignments.length;
      touchedScenes += 1;
      continue;
    }

    const batch = db.batch();
    for (const a of assignments) {
      batch.update(a.cabinetRef, {
        designItemId: a.designItemId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Recompute the parent scene's linkedDesignItemIds cache from the
    // full set of cabinets (orphans now assigned + already-linked ones).
    const nextCacheSet = new Set();
    for (const d of cabSnap.docs) {
      const c = d.data();
      if (c.designItemId && typeof c.designItemId === 'string' && c.designItemId !== '') {
        nextCacheSet.add(c.designItemId);
      }
    }
    for (const a of assignments) nextCacheSet.add(a.designItemId);

    batch.update(sceneDoc.ref, {
      linkedDesignItemIds: Array.from(nextCacheSet),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();
    touchedCabinets += assignments.length;
    touchedScenes += 1;
    for (const a of assignments) {
      console.log(`  · assigned ${a.cabinetCode ?? a.cabinetId} → ${a.designItemId}`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`  Scenes touched:          ${touchedScenes}`);
  console.log(`  Cabinets updated:        ${touchedCabinets}`);
  console.log(`  Auto DesignItems created: ${createdAutoItems}`);
  console.log(`  Skipped (standalone):    ${skippedStandalone}`);
  console.log(`  Skipped (locked):        ${skippedLocked}`);
  console.log(`  Skipped (no mapping):    ${skippedNoMapping}`);
  console.log(DRY_RUN ? '\n(DRY RUN — no writes performed.)' : '\nDone.');

  await admin.app().delete();
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
