/**
 * Workstation Service
 * CRUD and load tracking for manufacturing workstations
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  Workstation,
  WorkstationType,
  WorkstationStatus,
  ManufacturingStep,
} from '../types';

const WORKSTATION_COLLECTION = 'workstations';
const MO_COLLECTION = 'manufacturingOrders';
const STEPS_SUBCOLLECTION = 'steps';

// ============================================
// CRUD
// ============================================

/**
 * Create a new workstation
 */
async function createWorkstation(
  data: Omit<Workstation, 'id' | 'currentActiveJobs' | 'currentStepIds' | 'queuedStepCount' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
  userId: string,
): Promise<string> {
  const now = serverTimestamp();
  const wsData = {
    ...data,
    currentActiveJobs: 0,
    currentStepIds: [],
    queuedStepCount: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    updatedBy: userId,
  };

  const ref = await addDoc(collection(db, WORKSTATION_COLLECTION), wsData);
  return ref.id;
}

/**
 * Update workstation details
 */
async function updateWorkstation(
  workstationId: string,
  updates: Partial<Workstation>,
  userId: string,
): Promise<void> {
  await updateDoc(doc(db, WORKSTATION_COLLECTION, workstationId), {
    ...updates,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Get a single workstation
 */
async function getWorkstation(workstationId: string): Promise<Workstation | null> {
  const snap = await getDoc(doc(db, WORKSTATION_COLLECTION, workstationId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Workstation) : null;
}

/**
 * Get all workstations for an organization
 */
async function getWorkstations(
  organizationId: string,
  subsidiaryId?: string,
): Promise<Workstation[]> {
  const constraints = [
    where('organizationId', '==', organizationId),
    where('isActive', '==', true),
    orderBy('name', 'asc'),
  ];

  if (subsidiaryId) {
    constraints.splice(1, 0, where('subsidiaryId', '==', subsidiaryId));
  }

  const snap = await getDocs(query(collection(db, WORKSTATION_COLLECTION), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Workstation);
}

/**
 * Subscribe to workstations in real-time
 */
function subscribeToWorkstations(
  organizationId: string,
  subsidiaryId: string,
  callback: (workstations: Workstation[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, WORKSTATION_COLLECTION),
    where('organizationId', '==', organizationId),
    where('subsidiaryId', '==', subsidiaryId),
    where('isActive', '==', true),
    orderBy('name', 'asc'),
  );

  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Workstation);
    callback(data);
  });
}

/**
 * Set workstation operational status
 */
async function setWorkstationStatus(
  workstationId: string,
  status: WorkstationStatus,
  userId: string,
): Promise<void> {
  await updateDoc(doc(db, WORKSTATION_COLLECTION, workstationId), {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

// ============================================
// Load Tracking
// ============================================

/**
 * Recalculate workstation load from active steps
 */
async function updateWorkstationLoad(workstationId: string): Promise<void> {
  // Get all active MOs
  const mosSnap = await getDocs(
    query(
      collection(db, MO_COLLECTION),
      where('mesStatus', 'in', ['ready', 'in_progress']),
    ),
  );

  let activeJobs = 0;
  const activeStepIds: string[] = [];
  let queuedCount = 0;

  for (const moDoc of mosSnap.docs) {
    const stepsSnap = await getDocs(
      query(
        collection(db, MO_COLLECTION, moDoc.id, STEPS_SUBCOLLECTION),
        where('workstationId', '==', workstationId),
      ),
    );

    for (const stepDoc of stepsSnap.docs) {
      const step = stepDoc.data() as ManufacturingStep;
      if (step.status === 'in_progress') {
        activeJobs++;
        activeStepIds.push(stepDoc.id);
      } else if (step.status === 'queued' || step.status === 'ready') {
        queuedCount++;
      }
    }
  }

  await updateDoc(doc(db, WORKSTATION_COLLECTION, workstationId), {
    currentActiveJobs: activeJobs,
    currentStepIds: activeStepIds,
    queuedStepCount: queuedCount,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get workstation utilization for a date range
 */
async function getWorkstationUtilization(
  workstationId: string,
  startDate: Date,
  endDate: Date,
): Promise<number> {
  const ws = await getWorkstation(workstationId);
  if (!ws) return 0;

  // Get completed steps at this station in the date range
  const mosSnap = await getDocs(
    query(
      collection(db, MO_COLLECTION),
      where('mesStatus', 'in', ['completed', 'in_progress']),
    ),
  );

  let totalActiveMinutes = 0;

  for (const moDoc of mosSnap.docs) {
    const stepsSnap = await getDocs(
      query(
        collection(db, MO_COLLECTION, moDoc.id, STEPS_SUBCOLLECTION),
        where('workstationId', '==', workstationId),
        where('status', '==', 'completed'),
      ),
    );

    for (const stepDoc of stepsSnap.docs) {
      const step = stepDoc.data() as ManufacturingStep;
      totalActiveMinutes += step.actualDurationMinutes ?? 0;
    }
  }

  // Calculate available minutes
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const availableMinutes = daysDiff * ws.operatingHoursPerDay * 60;

  return availableMinutes > 0 ? Math.min(100, (totalActiveMinutes / availableMinutes) * 100) : 0;
}

/**
 * Simple scheduler: assign queued steps to available workstations
 */
async function scheduleQueuedSteps(
  organizationId: string,
  workstationType: WorkstationType,
): Promise<number> {
  // Get available workstations of this type
  const workstations = await getDocs(
    query(
      collection(db, WORKSTATION_COLLECTION),
      where('organizationId', '==', organizationId),
      where('type', '==', workstationType),
      where('status', '==', 'operational'),
      where('isActive', '==', true),
    ),
  );

  const availableStations = workstations.docs
    .map(d => ({ id: d.id, ...d.data() }) as Workstation)
    .filter(ws => ws.currentActiveJobs < ws.maxConcurrentJobs);

  if (availableStations.length === 0) return 0;

  // Get all queued steps of this workstation type
  const mosSnap = await getDocs(
    query(
      collection(db, MO_COLLECTION),
      where('mesStatus', 'in', ['ready', 'in_progress']),
    ),
  );

  const queuedSteps: Array<ManufacturingStep & { moId: string; moPriority: string; moDueDate: unknown }> = [];

  for (const moDoc of mosSnap.docs) {
    const moData = moDoc.data();
    const stepsSnap = await getDocs(
      query(
        collection(db, MO_COLLECTION, moDoc.id, STEPS_SUBCOLLECTION),
        where('workstationType', '==', workstationType),
        where('status', 'in', ['queued', 'ready']),
      ),
    );

    for (const stepDoc of stepsSnap.docs) {
      queuedSteps.push({
        ...(stepDoc.data() as ManufacturingStep),
        id: stepDoc.id,
        moId: moDoc.id,
        moPriority: moData.priority ?? 'medium',
        moDueDate: moData.dueDate ?? moData.scheduling?.scheduledEnd,
      });
    }
  }

  // Sort by priority then due date (earliest due date first)
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  queuedSteps.sort((a, b) => {
    const pA = priorityOrder[a.moPriority as keyof typeof priorityOrder] ?? 2;
    const pB = priorityOrder[b.moPriority as keyof typeof priorityOrder] ?? 2;
    if (pA !== pB) return pA - pB;
    return 0; // If same priority, keep original order
  });

  // Assign steps to available workstations
  let assigned = 0;
  let stationIdx = 0;

  for (const step of queuedSteps) {
    if (stationIdx >= availableStations.length) break;

    const station = availableStations[stationIdx];
    const stepRef = doc(db, MO_COLLECTION, step.moId, STEPS_SUBCOLLECTION, step.id);

    await updateDoc(stepRef, {
      workstationId: station.id,
      status: 'ready',
      updatedAt: serverTimestamp(),
    });

    station.currentActiveJobs++;
    if (station.currentActiveJobs >= station.maxConcurrentJobs) {
      stationIdx++;
    }

    assigned++;
  }

  return assigned;
}

// ============================================
// Exports
// ============================================

export const workstationService = {
  createWorkstation,
  updateWorkstation,
  getWorkstation,
  getWorkstations,
  subscribeToWorkstations,
  setWorkstationStatus,
  updateWorkstationLoad,
  getWorkstationUtilization,
  scheduleQueuedSteps,
};
