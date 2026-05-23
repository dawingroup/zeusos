/**
 * Production Job service — CRUD + stage advancement.
 *
 * Stage advance rule: you may only advance to the next stage in the
 * ordered PRODUCTION_STAGES list (no stage skipping). The guard is
 * enforced here in the service layer; Firestore rules enforce auth
 * (any staff member may advance) — business logic lives here.
 */

import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  ProductionJob,
  ProductionStage,
  ProductionStageTransition,
} from '../types/production-job.types';
import { PRODUCTION_STAGES } from '../types/production-job.types';

const JOBS_COLL = 'production_jobs';

export async function createProductionJob(
  input: Omit<ProductionJob, 'id' | 'stageHistory' | 'createdAt' | 'updatedAt'>,
): Promise<ProductionJob> {
  const ref = await addDoc(collection(db, JOBS_COLL), {
    ...input,
    stage: 'BRIEF',
    stageHistory: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return getProductionJob(ref.id) as Promise<ProductionJob>;
}

export async function getProductionJob(jobId: string): Promise<ProductionJob | null> {
  const snap = await getDoc(doc(db, JOBS_COLL, jobId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<ProductionJob, 'id'>) };
}

export async function listProductionJobs(filters: {
  masterJobId?: string;
  campaignId?: string;
  stage?: ProductionStage;
  subsidiaryOrgId?: string;
} = {}): Promise<ProductionJob[]> {
  const constraints = [];
  if (filters.masterJobId)    constraints.push(where('masterJobId',    '==', filters.masterJobId));
  if (filters.campaignId)     constraints.push(where('campaignId',     '==', filters.campaignId));
  if (filters.stage)          constraints.push(where('stage',          '==', filters.stage));
  if (filters.subsidiaryOrgId) constraints.push(where('subsidiaryOrgId', '==', filters.subsidiaryOrgId));

  const q = constraints.length
    ? query(collection(db, JOBS_COLL), ...constraints, orderBy('createdAt', 'desc'))
    : query(collection(db, JOBS_COLL), orderBy('createdAt', 'desc'));

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProductionJob, 'id'>) }));
}

export async function updateProductionJob(
  jobId: string,
  updates: Partial<Omit<ProductionJob, 'id' | 'createdAt' | 'createdBy' | 'stage' | 'stageHistory'>>,
): Promise<void> {
  await updateDoc(doc(db, JOBS_COLL, jobId), { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteProductionJob(jobId: string): Promise<void> {
  await deleteDoc(doc(db, JOBS_COLL, jobId));
}

/**
 * Advance a production job to the next stage.
 *
 * Guard: may only advance by exactly one step in PRODUCTION_STAGES order.
 * Throws if the caller tries to skip stages or move backwards.
 */
export async function advanceProductionStage(
  jobId: string,
  advancedBy: string,
  notes?: string,
): Promise<ProductionStage> {
  const job = await getProductionJob(jobId);
  if (!job) throw new Error(`[production] Job ${jobId} not found`);

  const currentIdx = PRODUCTION_STAGES.indexOf(job.stage);
  if (currentIdx === -1) throw new Error(`[production] Unknown stage: ${job.stage}`);
  if (currentIdx === PRODUCTION_STAGES.length - 1) {
    throw new Error(`[production] Job is already at COMPLETE — cannot advance further`);
  }

  const nextStage = PRODUCTION_STAGES[currentIdx + 1];
  const transition: ProductionStageTransition = {
    fromStage: job.stage,
    toStage: nextStage,
    transitionedAt: new Date().toISOString(),
    transitionedBy: advancedBy,
    notes,
  };

  await updateDoc(doc(db, JOBS_COLL, jobId), {
    stage: nextStage,
    stageHistory: [...(job.stageHistory ?? []), transition],
    updatedAt: serverTimestamp(),
  });

  return nextStage;
}
