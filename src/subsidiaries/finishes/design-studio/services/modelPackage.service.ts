/**
 * ModelPackage Service — Persistence and lifecycle for processed model snapshots
 *
 * Every cabinet gets a `current` ModelPackage that represents the latest processing
 * result. Previous versions are archived under `versions/{versionId}`.
 */
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, query, orderBy, limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type {
  ModelPackage,
  CreateModelPackageInput,
  ModelGrouping,
  ModelMaterials,
  ModelRenders,
} from '../types/modelPackage.types';
import { joinPartsIntoAssemblies } from './groupingAssemblyJoin';
import type { ComputedBOMLine, PricingBreakdown } from '../types/constraintEngine.types';

const SCENES = 'designScenes';
const CABINETS = 'cabinets';
const MODEL_PACKAGE = 'modelPackage';
const CURRENT = 'current';
const VERSIONS = 'versions';

/**
 * Recursively remove keys whose values are `undefined`. Firestore rejects any
 * document containing undefined (not null — undefined), so we scrub the payload
 * before `setDoc`. Only plain objects (POJOs) are recursed into — Firestore
 * sentinels (serverTimestamp, etc.), Timestamps, Dates, and any class instance
 * are passed through unchanged.
 */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === null || proto === Object.prototype;
}
function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefinedDeep(v)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      out[k] = stripUndefinedDeep(v);
    }
    return out as T;
  }
  return value;
}

function packageRef(sceneId: string, cabinetId: string) {
  return doc(db, SCENES, sceneId, CABINETS, cabinetId, MODEL_PACKAGE, CURRENT);
}

function versionCol(sceneId: string, cabinetId: string) {
  return collection(db, SCENES, sceneId, CABINETS, cabinetId, MODEL_PACKAGE, CURRENT, VERSIONS);
}

/**
 * Create or replace the current ModelPackage for a cabinet.
 * If a current package exists, it's archived to versions before being overwritten.
 */
export async function createModelPackage(
  input: CreateModelPackageInput,
): Promise<string> {
  const { sceneId, cabinetId } = input;
  const ref = packageRef(sceneId, cabinetId);
  const existing = await getDoc(ref);

  let version = 1;
  if (existing.exists()) {
    const old = existing.data() as ModelPackage;
    version = (old.version ?? 0) + 1;

    // Archive the old one
    const versionId = `v${old.version}-${Date.now()}`;
    const versionRef = doc(versionCol(sceneId, cabinetId), versionId);
    await setDoc(versionRef, old);
  }

  const now = serverTimestamp();
  const packageData = {
    id: `${cabinetId}-package`,
    version,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    modelRef: input.modelRef,
    grouping: input.grouping,
    materials: input.materials,
    renders: { ...input.renders, generatedAt: now },
    bom: input.bom,
    pricing: input.pricing,
    context: input.context,
    metadata: {
      ...input.metadata,
      processedAt: now,
    },
  };

  // Strip any `undefined` leaves anywhere in the payload. Firestore rejects
  // undefined values and several optional fields (modelRef.glbUrl, renders.*,
  // context.*) can legitimately be absent on a first-time package.
  await setDoc(ref, stripUndefinedDeep(packageData));

  // Denormalize key fields on the cabinet for quick access. The scene
  // workspace and viewers read `cabinets/{id}.assemblies` — without this,
  // processing only wrote `modelPackage/current` and parts never appeared
  // in the 3D scene UI until a separate sync path ran.
  const nestedAssemblies = joinPartsIntoAssemblies(
    input.grouping.assemblies ?? [],
    input.grouping.parts ?? [],
    cabinetId,
  );
  const cabRef = doc(db, SCENES, sceneId, CABINETS, cabinetId);
  await updateDoc(cabRef, stripUndefinedDeep({
    packageId: packageData.id,
    packageVersion: version,
    lastProcessedAt: now,
    thumbnailUrl: input.renders.thumbnail ?? null,
    renderUrl: input.renders.productCatalog ?? input.renders.isometric ?? null,
    groupingConfidence: input.grouping.confidence,
    groupingSource: input.grouping.source,
    updatedAt: now,
    assemblies: nestedAssemblies,
  }));

  return packageData.id;
}

/**
 * Get the current ModelPackage for a cabinet. Returns null if not yet processed.
 */
export async function getModelPackage(
  sceneId: string,
  cabinetId: string,
): Promise<ModelPackage | null> {
  const snap = await getDoc(packageRef(sceneId, cabinetId));
  if (!snap.exists()) return null;
  return snap.data() as ModelPackage;
}

/**
 * List historical versions of a ModelPackage.
 */
export async function getModelPackageVersions(
  sceneId: string,
  cabinetId: string,
  max = 20,
): Promise<ModelPackage[]> {
  const q = query(versionCol(sceneId, cabinetId), orderBy('version', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as ModelPackage);
}

/**
 * Update grouping section of the current package (e.g., manual assembly edits).
 */
export async function updateModelPackageGrouping(
  sceneId: string,
  cabinetId: string,
  grouping: Partial<ModelGrouping>,
): Promise<void> {
  const ref = packageRef(sceneId, cabinetId);
  await updateDoc(ref, {
    ...Object.fromEntries(
      Object.entries(grouping).map(([k, v]) => [`grouping.${k}`, v]),
    ),
    'metadata.updatedAt': serverTimestamp(),
  });
}

/**
 * Update materials section after manual resolution or refresh.
 */
export async function updateModelPackageMaterials(
  sceneId: string,
  cabinetId: string,
  materials: Partial<ModelMaterials>,
): Promise<void> {
  const ref = packageRef(sceneId, cabinetId);
  await updateDoc(ref, {
    ...Object.fromEntries(
      Object.entries(materials).map(([k, v]) => [`materials.${k}`, v]),
    ),
    'metadata.updatedAt': serverTimestamp(),
  });
}

/**
 * Update renders after regeneration.
 */
export async function updateModelPackageRenders(
  sceneId: string,
  cabinetId: string,
  renders: Partial<ModelRenders>,
): Promise<void> {
  const ref = packageRef(sceneId, cabinetId);
  const now = serverTimestamp();
  await updateDoc(ref, {
    ...Object.fromEntries(
      Object.entries(renders).map(([k, v]) => [`renders.${k}`, v]),
    ),
    'renders.generatedAt': now,
    'metadata.updatedAt': now,
  });

  // Also update cabinet denormalized thumbnail/render URLs
  const cabRef = doc(db, SCENES, sceneId, CABINETS, cabinetId);
  const updates: Record<string, unknown> = { updatedAt: now };
  if (renders.thumbnail) updates.thumbnailUrl = renders.thumbnail;
  if (renders.productCatalog) updates.renderUrl = renders.productCatalog;
  else if (renders.isometric) updates.renderUrl = renders.isometric;
  await updateDoc(cabRef, updates);
}

/**
 * Update BOM and pricing after reprocessing.
 */
export async function updateModelPackageBOM(
  sceneId: string,
  cabinetId: string,
  bom: ComputedBOMLine[],
  pricing: PricingBreakdown | null,
): Promise<void> {
  const ref = packageRef(sceneId, cabinetId);
  await updateDoc(ref, {
    bom,
    pricing,
    'metadata.updatedAt': serverTimestamp(),
  });
}
