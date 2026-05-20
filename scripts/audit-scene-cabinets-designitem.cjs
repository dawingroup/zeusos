/**
 * Audit Scene Cabinets — DesignItem Linkage (P2 Slice 5)
 *
 * READ-ONLY script. Produces a structured report of SceneCabinet docs
 * with missing or malformed `designItemId` — the precondition for safely
 * flipping the field to required (Slice 6) + enforcing it in rules.
 *
 * Checks every cabinet under `designScenes/{sceneId}/cabinets/{cabinetId}`:
 *   1. Missing `designItemId`     — field absent / null / undefined
 *   2. Empty `designItemId`       — empty string
 *   3. Non-string `designItemId`  — unexpected type
 *   4. Dangling `designItemId`    — id set but no matching DesignItem
 *      under the parent scene's `projectId`
 *   5. Cross-project `designItemId` — id resolves, but under a project
 *      different from the scene's projectId (likely bad data; cabinets
 *      should only reference items in their own project)
 *   6. Locked-but-unlinked          — isLocked=true without designItemId
 *      (blocking problem for production handoff)
 *
 * Also reports parent-scene cache divergence:
 *   7. Scene cache drift           — `DesignScene.linkedDesignItemIds[]`
 *      doesn't match the set computed from the scene's cabinets
 *
 * Run: node scripts/audit-scene-cabinets-designitem.cjs
 *
 * Output: a JSON-ish summary to stdout plus a CSV of affected cabinet
 * ids written to ./tmp/scene-cabinets-designitem-audit-<date>.csv.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

// ─── Helpers ────────────────────────────────────────────────────────────────

function csvCell(v) {
  if (v === undefined || v === null) return '';
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

// Cache DesignItem lookups keyed by `${projectId}::${itemId}`.
const designItemCache = new Map(); // key → { exists, projectId }
async function designItemExists(projectId, itemId) {
  const key = `${projectId}::${itemId}`;
  if (designItemCache.has(key)) return designItemCache.get(key);
  const doc = await db
    .collection('designProjects')
    .doc(projectId)
    .collection('designItems')
    .doc(itemId)
    .get();
  const result = { exists: doc.exists, projectId };
  designItemCache.set(key, result);
  return result;
}

// Cross-project scan: find which projectId (if any) contains this item.
// Uses a collectionGroup query to avoid scanning every project.
const crossProjectCache = new Map(); // itemId → projectId | null
async function findItemProject(itemId) {
  if (crossProjectCache.has(itemId)) return crossProjectCache.get(itemId);
  const snap = await db
    .collectionGroup('designItems')
    .where(admin.firestore.FieldPath.documentId(), '==', itemId)
    .limit(1)
    .get();
  if (snap.empty) {
    crossProjectCache.set(itemId, null);
    return null;
  }
  // Parent path: designProjects/{projectId}/designItems/{itemId}
  const parentProjectRef = snap.docs[0].ref.parent.parent;
  const projectId = parentProjectRef?.id ?? null;
  crossProjectCache.set(itemId, projectId);
  return projectId;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Auditing SceneCabinet.designItemId …\n');

  const scenesSnap = await db.collection('designScenes').get();
  const totalScenes = scenesSnap.size;

  const missing = [];       // designItemId absent or null/undefined
  const empty = [];         // designItemId === ''
  const nonString = [];     // designItemId is not a string
  const dangling = [];      // id set but no item in scene's project
  const crossProject = [];  // id set, item exists, but in a different project
  const lockedUnlinked = []; // isLocked=true without designItemId
  const ok = [];            // fully valid
  const cacheDrift = [];    // scene.linkedDesignItemIds[] drift

  let totalCabinets = 0;

  for (const sceneDoc of scenesSnap.docs) {
    const scene = sceneDoc.data();
    const sceneId = sceneDoc.id;
    const projectId = scene.projectId;

    const cabSnap = await sceneDoc.ref.collection('cabinets').get();
    totalCabinets += cabSnap.size;

    const cabinetDesignItemIds = new Set();

    for (const cabDoc of cabSnap.docs) {
      const cab = cabDoc.data();
      const row = {
        sceneId,
        sceneName: scene.name,
        projectId,
        cabinetId: cabDoc.id,
        cabinetCode: cab.cabinetCode,
        displayName: cab.displayName,
        designItemId: cab.designItemId,
        isLocked: !!cab.isLocked,
        createdAt: cab.createdAt?.toDate?.().toISOString(),
      };

      // Check isLocked + missing linkage (a red flag for production).
      if (cab.isLocked && (!cab.designItemId || cab.designItemId === '')) {
        lockedUnlinked.push(row);
      }

      if (cab.designItemId === undefined || cab.designItemId === null) {
        missing.push(row);
        continue;
      }
      if (typeof cab.designItemId !== 'string') {
        nonString.push(row);
        continue;
      }
      if (cab.designItemId === '') {
        empty.push(row);
        continue;
      }

      cabinetDesignItemIds.add(cab.designItemId);

      // Only resolve against a real project; standalone scenes can't have
      // valid item refs, so flag as dangling if they do.
      const isStandalone = !projectId || projectId === 'standalone';
      if (isStandalone) {
        dangling.push({ ...row, reason: 'standalone-scene-with-item' });
        continue;
      }

      const { exists } = await designItemExists(projectId, cab.designItemId);
      if (!exists) {
        // Check if the item lives under a different project.
        const otherProject = await findItemProject(cab.designItemId);
        if (otherProject && otherProject !== projectId) {
          crossProject.push({ ...row, foundInProject: otherProject });
          continue;
        }
        dangling.push({ ...row, reason: 'no-such-item' });
        continue;
      }

      ok.push(row);
    }

    // Scene-level cache drift check.
    const cached = Array.isArray(scene.linkedDesignItemIds)
      ? scene.linkedDesignItemIds
      : [];
    const cachedSet = new Set(cached);
    const actual = cabinetDesignItemIds;
    const sameSize = cachedSet.size === actual.size;
    const sameContents = sameSize && [...actual].every(x => cachedSet.has(x));
    if (!sameContents) {
      cacheDrift.push({
        sceneId,
        sceneName: scene.name,
        projectId,
        cachedIds: [...cachedSet].sort(),
        actualIds: [...actual].sort(),
      });
    }
  }

  const report = {
    scannedAt: new Date().toISOString(),
    totalScenes,
    totalCabinets,
    fullyValid: ok.length,
    issues: {
      missingDesignItemId: missing.length,
      emptyDesignItemId: empty.length,
      nonStringDesignItemId: nonString.length,
      danglingDesignItemId: dangling.length,
      crossProjectDesignItemId: crossProject.length,
      lockedUnlinked: lockedUnlinked.length,
      cacheDrift: cacheDrift.length,
    },
    samples: {
      missingDesignItemId: missing.slice(0, 10),
      emptyDesignItemId: empty.slice(0, 10),
      nonStringDesignItemId: nonString.slice(0, 10),
      danglingDesignItemId: dangling.slice(0, 10),
      crossProjectDesignItemId: crossProject.slice(0, 10),
      lockedUnlinked: lockedUnlinked.slice(0, 10),
      cacheDrift: cacheDrift.slice(0, 10),
    },
  };

  console.log(JSON.stringify(report, null, 2));

  const affected = [
    ...missing.map(r => ({ ...r, issue: 'missing' })),
    ...empty.map(r => ({ ...r, issue: 'empty' })),
    ...nonString.map(r => ({ ...r, issue: 'non_string' })),
    ...dangling.map(r => ({ ...r, issue: `dangling:${r.reason ?? 'unknown'}` })),
    ...crossProject.map(r => ({ ...r, issue: `cross_project:${r.foundInProject}` })),
    ...lockedUnlinked.map(r => ({ ...r, issue: 'locked_unlinked' })),
  ];

  if (affected.length > 0) {
    const outDir = path.join(__dirname, '..', 'tmp');
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    const outPath = path.join(
      outDir,
      `scene-cabinets-designitem-audit-${stamp}.csv`,
    );
    const header = [
      'issue',
      'sceneId',
      'sceneName',
      'projectId',
      'cabinetId',
      'cabinetCode',
      'displayName',
      'designItemId',
      'isLocked',
      'createdAt',
    ];
    const rows = [header.join(',')];
    for (const r of affected) {
      rows.push(header.map(k => csvCell(r[k])).join(','));
    }
    fs.writeFileSync(outPath, rows.join('\n'), 'utf8');
    console.log(`\nWrote ${affected.length} affected cabinet(s) to ${outPath}`);
  }

  if (cacheDrift.length > 0) {
    const outDir = path.join(__dirname, '..', 'tmp');
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    const driftPath = path.join(
      outDir,
      `scene-cabinets-cache-drift-${stamp}.csv`,
    );
    const header = ['sceneId', 'sceneName', 'projectId', 'cachedIds', 'actualIds'];
    const rows = [header.join(',')];
    for (const r of cacheDrift) {
      rows.push(
        [
          r.sceneId,
          r.sceneName,
          r.projectId,
          r.cachedIds.join(';'),
          r.actualIds.join(';'),
        ]
          .map(csvCell)
          .join(','),
      );
    }
    fs.writeFileSync(driftPath, rows.join('\n'), 'utf8');
    console.log(
      `Wrote ${cacheDrift.length} scene(s) with cache drift to ${driftPath}`,
    );
  }

  if (affected.length === 0 && cacheDrift.length === 0) {
    console.log(
      '\nAll scene cabinets have valid designItem linkage and caches are in sync — safe to deploy Slice 6 rules.',
    );
  }

  await admin.app().delete();
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
