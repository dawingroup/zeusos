/**
 * Load a Design Studio scene from Firestore and run parts-quality / proposed
 * naming (same logic as SceneFilesPanel / parts review).
 *
 * Run from repo root:
 *   npm run audit:scene-parts
 *   npx tsx scripts/audit-design-scene-parts.ts
 *
 * **Agent / Cursor / non-interactive use:** do not rely on
 * `gcloud auth application-default login` (often hits invalid_rapt in sandboxes).
 * Prefer a **Firebase service account** (GitHub’s `FIREBASE_SERVICE_ACCOUNT`):
 *
 * 1. Create `.env.local` in the repo root (gitignored) with either:
 *    - `FIREBASE_SERVICE_ACCOUNT_BASE64=<base64 of the whole JSON file>`  (one line, safest in env)
 *    - or `FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}` on one line
 * 2. Or set `GOOGLE_APPLICATION_CREDENTIALS` to the path of the downloaded JSON file.
 * 3. Or define the same variables in **Cursor → Settings → Environment** for the agent.
 *
 * Other env:
 *   FIREBASE_PROJECT_ID, GCLOUD_PROJECT, or GOOGLE_CLOUD_PROJECT — project id (default: dawinos)
 *   SCENE_PROJECT_MATCH — substring for designProjects.name (default: Cornelius)
 *   SCENE_NAME_MATCH — substring for designScenes.name (default: Scene 1)
 */
import { config as loadDotenv } from 'dotenv';
import { cert, getApps, initializeApp, type AppOptions } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';

import {
  analyzeSceneCabinets,
  collectAuditableParts,
} from '../src/subsidiaries/finishes/design-studio/services/partsQualityHelper';

const root = process.cwd();
loadDotenv({ path: resolve(root, '.env') });
loadDotenv({ path: resolve(root, '.env.local'), override: true });

const PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  'dawinos';
const PROJECT_NAME_SUB = process.env.SCENE_PROJECT_MATCH || 'Cornelius';
const SCENE_NAME_SUB = process.env.SCENE_NAME_MATCH || 'Scene 1';

type SaJson = { project_id?: string; client_email?: string; private_key?: string };

function parseServiceAccountObject(): AppOptions | null {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  if (b64) {
    const raw = Buffer.from(b64, 'base64').toString('utf8');
    const json = JSON.parse(raw) as SaJson;
    return {
      credential: cert({
        projectId: json.project_id || PROJECT_ID,
        clientEmail: json.client_email,
        privateKey: json.private_key?.replace(/\\n/g, '\n'),
      }),
    };
  }
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (inline) {
    const json = JSON.parse(inline) as SaJson;
    return {
      credential: cert({
        projectId: json.project_id || PROJECT_ID,
        clientEmail: json.client_email,
        privateKey: json.private_key?.replace(/\\n/g, '\n'),
      }),
    };
  }
  return null;
}

function initAdmin() {
  if (getApps().length) return;
  const fromEnv = parseServiceAccountObject();
  if (fromEnv) {
    initializeApp({ ...fromEnv, projectId: PROJECT_ID });
    return;
  }

  let credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    const path = isAbsolute(credPath) ? credPath : resolve(root, credPath);
    if (existsSync(path)) {
      const raw = readFileSync(path, 'utf8');
      const json = JSON.parse(raw) as SaJson;
      initializeApp({
        projectId: PROJECT_ID,
        credential: cert({
          projectId: json.project_id || PROJECT_ID,
          clientEmail: json.client_email,
          privateKey: json.private_key?.replace(/\\n/g, '\n'),
        }),
      });
      return;
    }
  }
  // Last resort: Application Default Credentials (user OAuth — often broken in agents).
  initializeApp({ projectId: PROJECT_ID });
}

async function main() {
  initAdmin();
  const db = getFirestore();

  const projectsSnap = await db.collection('designProjects').get();
  const projectDocs = projectsSnap.docs
    .map(d => ({ id: d.id, ...(d.data() as { name?: string }) }))
    .filter(p => {
      const n = String(p.name ?? '');
      return n.includes(PROJECT_NAME_SUB);
    });

  if (projectDocs.length === 0) {
    console.error(`No designProjects with name containing "${PROJECT_NAME_SUB}".`);
    process.exit(1);
  }

  const project =
    projectDocs.find(p => /Residential\s+Furniture/i.test(String(p.name ?? ''))) ?? projectDocs[0];

  console.log(`Project: ${project.name} (${project.id})\n`);

  const scenesSnap = await db
    .collection('designScenes')
    .where('projectId', '==', project.id)
    .get();

  const scenes = scenesSnap.docs.map(d => ({
    id: d.id,
    ...(d.data() as { name?: string; projectId?: string }),
  }));

  const scene =
    scenes.find(s => String(s.name ?? '').includes(SCENE_NAME_SUB)) ?? scenes[0];

  if (!scene) {
    console.error('No scenes for this project.');
    process.exit(1);
  }

  console.log(`Scene: ${scene.name ?? '(unnamed)'} (${scene.id})\n`);

  const cabsSnap = await db.collection('designScenes').doc(scene.id).collection('cabinets').get();

  const cabinets = cabsSnap.docs.map(d => ({
    id: d.id,
    ...(d.data() as { assemblies?: unknown[]; displayName?: string; cabinetCode?: string }),
  }));

  const forAudit = cabinets.map(c => ({
    id: c.id,
    assemblies: (c.assemblies ?? []) as Array<{ id?: string; parts?: unknown[] }>,
  }));

  const parts = collectAuditableParts(forAudit);
  const report = analyzeSceneCabinets(forAudit);

  console.log('--- Summary ---');
  console.log(JSON.stringify(report.summary, null, 2));
  console.log('\n--- Parts (current → suggested) ---');

  const sugById = new Map(report.suggestions.map(s => [s.partId, s]));

  for (const p of parts) {
    const s = sugById.get(p.id);
    const line = [
      `[${p.partCode || '—'}]`,
      p.partName || '(unnamed)',
      '→',
      s?.suggestedName ?? '(unchanged)',
    ].join(' ');
    console.log(line);
  }

  const err = report.issues.filter(i => i.severity === 'error');
  const warn = report.issues.filter(i => i.severity === 'warning');
  if (err.length || warn.length) {
    console.log('\n--- Issues (errors / warnings) ---');
    for (const i of [...err, ...warn].slice(0, 80)) {
      console.log(`- [${i.severity}] ${i.code}: ${i.message}`);
    }
    if (err.length + warn.length > 80) console.log(`… and ${err.length + warn.length - 80} more`);
  }

  console.log('\n--- Name suggestions detail (first 40) ---');
  for (const s of report.suggestions.slice(0, 40)) {
    console.log(`- ${s.currentName} → ${s.suggestedName}`);
    console.log(`  ${s.rationale}`);
  }
  if (report.suggestions.length > 40) {
    console.log(`… ${report.suggestions.length - 40} more suggestions`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
