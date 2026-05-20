/**
 * Manufacturing Execution Service
 * Step lifecycle management for MES (Manufacturing Execution System)
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc as _rawUpdateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  runTransaction,
  type Unsubscribe,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { cleanForFirestore } from './manufacturingOrderService';
import type {
  ManufacturingStep,
  StepStatus,
  TimeEntry,
  StepStatusChange,
  StepMaterialConsumption,
  ManufacturingOrderMES,
  MOStatus,
  QualityEvent,
  Workstation,
} from '../types';

const MO_COLLECTION = 'manufacturingOrders';

/** Safe updateDoc wrapper — deep-cleans data to strip undefined before writing */
async function updateDoc(ref: DocumentReference, data: Record<string, unknown>) {
  return _rawUpdateDoc(ref, cleanForFirestore(data));
}
const STEPS_SUBCOLLECTION = 'steps';
const QUALITY_EVENTS_SUBCOLLECTION = 'quality_events';
const WORKSTATION_COLLECTION = 'workstations';

// ============================================
// Step Lifecycle
// ============================================

/**
 * Start a step: validate dependencies, set in_progress, record TimeEntry
 */
async function startStep(
  orderId: string,
  stepId: string,
  operatorId: string,
  operatorName: string,
): Promise<void> {
  const stepRef = doc(db, MO_COLLECTION, orderId, STEPS_SUBCOLLECTION, stepId);
  const moRef = doc(db, MO_COLLECTION, orderId);

  await runTransaction(db, async (transaction) => {
    const stepSnap = await transaction.get(stepRef);
    if (!stepSnap.exists()) throw new Error('Step not found');

    const step = { id: stepSnap.id, ...stepSnap.data() } as ManufacturingStep;

    if (step.status !== 'queued' && step.status !== 'ready') {
      throw new Error(`Cannot start step in status "${step.status}". Must be "queued" or "ready".`);
    }

    // Validate dependencies are completed
    if (step.dependsOnStepIds.length > 0) {
      const stepsQuery = query(
        collection(db, MO_COLLECTION, orderId, STEPS_SUBCOLLECTION),
        where('__name__', 'in', step.dependsOnStepIds),
      );
      const depSnaps = await getDocs(stepsQuery);
      for (const depSnap of depSnaps.docs) {
        const depStatus = depSnap.data().status as StepStatus;
        if (depStatus !== 'completed' && depStatus !== 'skipped') {
          throw new Error(`Dependency step "${depSnap.data().name}" is not completed`);
        }
      }
    }

    const now = serverTimestamp();
    const timeEntry: TimeEntry = {
      id: crypto.randomUUID(),
      operatorId,
      operatorName,
      action: 'start',
      timestamp: now as never,
    };

    const statusChange: StepStatusChange = {
      from: step.status,
      to: 'in_progress',
      changedBy: operatorId,
      changedAt: now as never,
    };

    transaction.update(stepRef, {
      status: 'in_progress',
      assignedOperatorId: operatorId,
      assignedOperatorName: operatorName,
      startedAt: now,
      timeEntries: [...step.timeEntries, timeEntry],
      statusHistory: [...step.statusHistory, statusChange],
      updatedAt: now,
    });

    // Update MO status to in_progress if it's not already
    const moSnap = await transaction.get(moRef);
    if (moSnap.exists()) {
      const mo = moSnap.data() as ManufacturingOrderMES;
      if (mo.mesStatus === 'ready' || mo.mesStatus === 'planned') {
        transaction.update(moRef, {
          mesStatus: 'in_progress' as MOStatus,
          status: 'in-progress',
          actualStartDate: now,
          currentStepIndex: step.stepIndex,
          currentWorkstationId: step.workstationId ?? null,
          updatedAt: now,
        });
      } else {
        transaction.update(moRef, {
          currentStepIndex: step.stepIndex,
          currentWorkstationId: step.workstationId ?? null,
          updatedAt: now,
        });
      }
    }

    // Update workstation active jobs
    if (step.workstationId) {
      const wsRef = doc(db, WORKSTATION_COLLECTION, step.workstationId);
      const wsSnap = await transaction.get(wsRef);
      if (wsSnap.exists()) {
        const ws = wsSnap.data() as Workstation;
        transaction.update(wsRef, {
          currentActiveJobs: ws.currentActiveJobs + 1,
          currentStepIds: [...ws.currentStepIds, stepId],
          updatedAt: now,
        });
      }
    }
  });
}

/**
 * Pause a step: record pause TimeEntry
 */
async function pauseStep(
  orderId: string,
  stepId: string,
  operatorId: string,
  reason?: string,
): Promise<void> {
  const stepRef = doc(db, MO_COLLECTION, orderId, STEPS_SUBCOLLECTION, stepId);

  await runTransaction(db, async (transaction) => {
    const stepSnap = await transaction.get(stepRef);
    if (!stepSnap.exists()) throw new Error('Step not found');

    const step = { id: stepSnap.id, ...stepSnap.data() } as ManufacturingStep;
    if (step.status !== 'in_progress') {
      throw new Error(`Cannot pause step in status "${step.status}"`);
    }

    const now = serverTimestamp();
    const timeEntry: TimeEntry = {
      id: crypto.randomUUID(),
      operatorId,
      operatorName: step.assignedOperatorName ?? '',
      action: 'pause',
      timestamp: now as never,
      notes: reason,
    };

    const statusChange: StepStatusChange = {
      from: 'in_progress',
      to: 'paused',
      changedBy: operatorId,
      changedAt: now as never,
      reason,
    };

    transaction.update(stepRef, {
      status: 'paused',
      timeEntries: [...step.timeEntries, timeEntry],
      statusHistory: [...step.statusHistory, statusChange],
      updatedAt: now,
    });
  });
}

/**
 * Resume a paused step
 */
async function resumeStep(
  orderId: string,
  stepId: string,
  operatorId: string,
  operatorName: string,
): Promise<void> {
  const stepRef = doc(db, MO_COLLECTION, orderId, STEPS_SUBCOLLECTION, stepId);

  await runTransaction(db, async (transaction) => {
    const stepSnap = await transaction.get(stepRef);
    if (!stepSnap.exists()) throw new Error('Step not found');

    const step = { id: stepSnap.id, ...stepSnap.data() } as ManufacturingStep;
    if (step.status !== 'paused') {
      throw new Error(`Cannot resume step in status "${step.status}"`);
    }

    const now = serverTimestamp();
    const timeEntry: TimeEntry = {
      id: crypto.randomUUID(),
      operatorId,
      operatorName,
      action: 'resume',
      timestamp: now as never,
    };

    const statusChange: StepStatusChange = {
      from: 'paused',
      to: 'in_progress',
      changedBy: operatorId,
      changedAt: now as never,
    };

    transaction.update(stepRef, {
      status: 'in_progress',
      assignedOperatorId: operatorId,
      assignedOperatorName: operatorName,
      timeEntries: [...step.timeEntries, timeEntry],
      statusHistory: [...step.statusHistory, statusChange],
      updatedAt: now,
    });
  });
}

/**
 * Complete a step: record completion, calculate duration, handle QC
 */
async function completeStep(
  orderId: string,
  stepId: string,
  operatorId: string,
  operatorName: string,
  materialsConsumed?: StepMaterialConsumption[],
): Promise<void> {
  const stepRef = doc(db, MO_COLLECTION, orderId, STEPS_SUBCOLLECTION, stepId);

  await runTransaction(db, async (transaction) => {
    const stepSnap = await transaction.get(stepRef);
    if (!stepSnap.exists()) throw new Error('Step not found');

    const step = { id: stepSnap.id, ...stepSnap.data() } as ManufacturingStep;
    if (step.status !== 'in_progress') {
      throw new Error(`Cannot complete step in status "${step.status}"`);
    }

    const now = serverTimestamp();
    const timeEntry: TimeEntry = {
      id: crypto.randomUUID(),
      operatorId,
      operatorName,
      action: 'complete',
      timestamp: now as never,
    };

    const actualDuration = calculateDurationFromEntries([...step.timeEntries, timeEntry]);
    const nextStatus: StepStatus = step.qcRequired ? 'qc_pending' : 'completed';

    const statusChange: StepStatusChange = {
      from: 'in_progress',
      to: nextStatus,
      changedBy: operatorId,
      changedAt: now as never,
    };

    transaction.update(stepRef, {
      status: nextStatus,
      completedAt: step.qcRequired ? undefined : now,
      actualDurationMinutes: actualDuration,
      timeEntries: [...step.timeEntries, timeEntry],
      statusHistory: [...step.statusHistory, statusChange],
      materialsConsumed: materialsConsumed ?? step.materialsConsumed,
      updatedAt: now,
    });

    // Update workstation load
    if (step.workstationId) {
      const wsRef = doc(db, WORKSTATION_COLLECTION, step.workstationId);
      const wsSnap = await transaction.get(wsRef);
      if (wsSnap.exists()) {
        const ws = wsSnap.data() as Workstation;
        transaction.update(wsRef, {
          currentActiveJobs: Math.max(0, ws.currentActiveJobs - 1),
          currentStepIds: ws.currentStepIds.filter((id: string) => id !== stepId),
          updatedAt: now,
        });
      }
    }
  });

  // Update MO progress (outside transaction to avoid conflicts)
  await updateMOProgress(orderId);
}

/**
 * Skip a step
 */
async function skipStep(
  orderId: string,
  stepId: string,
  userId: string,
  reason: string,
): Promise<void> {
  const stepRef = doc(db, MO_COLLECTION, orderId, STEPS_SUBCOLLECTION, stepId);

  await runTransaction(db, async (transaction) => {
    const stepSnap = await transaction.get(stepRef);
    if (!stepSnap.exists()) throw new Error('Step not found');

    const step = { id: stepSnap.id, ...stepSnap.data() } as ManufacturingStep;
    const now = serverTimestamp();

    const statusChange: StepStatusChange = {
      from: step.status,
      to: 'skipped',
      changedBy: userId,
      changedAt: now as never,
      reason,
    };

    transaction.update(stepRef, {
      status: 'skipped',
      statusHistory: [...step.statusHistory, statusChange],
      updatedAt: now,
    });
  });

  await updateMOProgress(orderId);
}

/**
 * Record QC result for a step
 */
async function recordQCResult(
  orderId: string,
  stepId: string,
  result: 'pass' | 'fail' | 'conditional',
  inspectorId: string,
  inspectorName: string,
  notes?: string,
  defectDetails?: {
    defectType: QualityEvent['defectType'];
    defectSeverity: QualityEvent['defectSeverity'];
    defectDescription?: string;
    affectedQuantity?: number;
    resolution?: QualityEvent['resolution'];
    photos?: string[];
  },
): Promise<string | undefined> {
  const stepRef = doc(db, MO_COLLECTION, orderId, STEPS_SUBCOLLECTION, stepId);
  const now = serverTimestamp();

  await runTransaction(db, async (transaction) => {
    const stepSnap = await transaction.get(stepRef);
    if (!stepSnap.exists()) throw new Error('Step not found');

    const step = { id: stepSnap.id, ...stepSnap.data() } as ManufacturingStep;
    if (step.status !== 'qc_pending') {
      throw new Error(`Cannot record QC for step in status "${step.status}"`);
    }

    const nextStatus: StepStatus = result === 'pass' || result === 'conditional'
      ? 'completed'
      : 'failed';

    const statusChange: StepStatusChange = {
      from: 'qc_pending',
      to: nextStatus,
      changedBy: inspectorId,
      changedAt: now as never,
      reason: notes,
    };

    transaction.update(stepRef, {
      status: nextStatus,
      qcResult: result,
      completedAt: nextStatus === 'completed' ? now : undefined,
      statusHistory: [...step.statusHistory, statusChange],
      updatedAt: now,
    });
  });

  // Create quality event document
  let reworkOrderId: string | undefined;

  if (result === 'fail' && defectDetails) {
    const qeData: Omit<QualityEvent, 'id'> = {
      orderId,
      stepId,
      type: 'defect',
      result: 'fail',
      defectType: defectDetails.defectType,
      defectSeverity: defectDetails.defectSeverity,
      defectDescription: defectDetails.defectDescription,
      affectedQuantity: defectDetails.affectedQuantity,
      resolution: defectDetails.resolution ?? 'pending',
      photos: defectDetails.photos ?? [],
      inspectorId,
      inspectorName,
      notes,
      createdAt: now as never,
      updatedAt: now as never,
    };

    await addDoc(
      collection(db, MO_COLLECTION, orderId, QUALITY_EVENTS_SUBCOLLECTION),
      qeData,
    );

    // Update MO defect count
    const moRef = doc(db, MO_COLLECTION, orderId);
    const moSnap = await getDoc(moRef);
    if (moSnap.exists()) {
      const mo = moSnap.data() as ManufacturingOrderMES;
      await updateDoc(moRef, {
        defectCount: (mo.defectCount ?? 0) + 1,
        updatedAt: now,
      });
    }

    if (defectDetails.resolution === 'rework') {
      reworkOrderId = await createReworkOrder(orderId, stepId, `Rework for defect: ${defectDetails.defectDescription}`);
    }
  } else {
    // Record passing inspection event
    const qeData: Omit<QualityEvent, 'id'> = {
      orderId,
      stepId,
      type: 'inspection',
      result,
      photos: [],
      inspectorId,
      inspectorName,
      notes,
      createdAt: now as never,
      updatedAt: now as never,
    };

    await addDoc(
      collection(db, MO_COLLECTION, orderId, QUALITY_EVENTS_SUBCOLLECTION),
      qeData,
    );
  }

  await updateMOProgress(orderId);
  return reworkOrderId;
}

// ============================================
// Rework
// ============================================

/**
 * Create a rework manufacturing order from a failed step
 */
async function createReworkOrder(
  parentOrderId: string,
  failedStepId: string,
  reason: string,
): Promise<string> {
  const moRef = doc(db, MO_COLLECTION, parentOrderId);
  const moSnap = await getDoc(moRef);
  if (!moSnap.exists()) throw new Error('Parent order not found');

  const parentMO = { id: moSnap.id, ...moSnap.data() } as ManufacturingOrderMES;

  // Get the failed step to replicate
  const stepRef = doc(db, MO_COLLECTION, parentOrderId, STEPS_SUBCOLLECTION, failedStepId);
  const stepSnap = await getDoc(stepRef);
  if (!stepSnap.exists()) throw new Error('Failed step not found');

  const failedStep = { id: stepSnap.id, ...stepSnap.data() } as ManufacturingStep;

  // Create rework MO
  const now = serverTimestamp();
  const reworkData = {
    moNumber: `${parentMO.moNumber}-RW`,
    status: 'draft' as const,
    mesStatus: 'draft' as const,
    sourceType: 'rework' as const,
    sourceRef: {
      parentOrderId,
      designProjectId: parentMO.sourceRef?.designProjectId,
      designItemId: parentMO.sourceRef?.designItemId ?? parentMO.designItemId,
    },
    designItemId: parentMO.designItemId,
    projectId: parentMO.projectId,
    projectCode: parentMO.projectCode,
    designItemName: parentMO.designItemName,
    quantity: parentMO.quantity,
    priority: 'high' as const,
    bom: parentMO.bom,
    parts: parentMO.parts,
    instructions: `REWORK: ${reason}`,
    handoverNotes: parentMO.handoverNotes,
    scheduling: {},
    materialReservations: [],
    materialConsumptions: [],
    stageHistory: [],
    currentStage: 'queued' as const,
    stageEnteredAt: now,
    costSummary: { materialCost: 0, laborCost: 0, totalCost: 0, currency: parentMO.costSummary.currency },
    subsidiaryId: parentMO.subsidiaryId,
    totalSteps: 1,
    completedSteps: 0,
    currentStepIndex: 0,
    estimatedLaborHours: (failedStep.estimatedDurationMinutes ?? 60) / 60,
    actualLaborHours: 0,
    estimatedMaterialCost: 0,
    actualMaterialCost: 0,
    estimatedTotalCost: 0,
    actualTotalCost: 0,
    defectCount: 0,
    reworkOrderIds: [],
    bomLineCount: 0,
    bomTotalMaterialCost: 0,
    customerName: parentMO.customerName,
    customerId: parentMO.customerId,
    projectName: parentMO.projectName,
    createdAt: now,
    createdBy: 'system',
    updatedAt: now,
    updatedBy: 'system',
  };

  const reworkRef = await addDoc(collection(db, MO_COLLECTION), reworkData);

  // Create the rework step
  const reworkStepData = {
    orderId: reworkRef.id,
    stepIndex: 0,
    name: `Rework: ${failedStep.name}`,
    workstationType: failedStep.workstationType,
    workstationId: failedStep.workstationId,
    status: 'queued' as const,
    statusHistory: [],
    estimatedDurationMinutes: failedStep.estimatedDurationMinutes,
    timeEntries: [],
    qcRequired: true,
    materialsConsumed: [],
    dependsOnStepIds: [],
    isRework: true,
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };

  await addDoc(
    collection(db, MO_COLLECTION, reworkRef.id, STEPS_SUBCOLLECTION),
    reworkStepData,
  );

  // Link rework order to parent
  await updateDoc(moRef, {
    reworkOrderIds: [...(parentMO.reworkOrderIds ?? []), reworkRef.id],
    updatedAt: now,
  });

  return reworkRef.id;
}

// ============================================
// MO Progress & Status
// ============================================

/**
 * Recalculate MO progress from its steps
 */
async function updateMOProgress(orderId: string): Promise<void> {
  const stepsSnap = await getDocs(
    query(
      collection(db, MO_COLLECTION, orderId, STEPS_SUBCOLLECTION),
      orderBy('stepIndex', 'asc'),
    ),
  );

  const steps = stepsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as ManufacturingStep);
  const totalSteps = steps.length;
  const completedSteps = steps.filter(
    s => s.status === 'completed' || s.status === 'skipped',
  ).length;

  // Find current step (first non-completed/non-skipped)
  const currentStep = steps.find(
    s => s.status !== 'completed' && s.status !== 'skipped',
  );
  const currentStepIndex = currentStep?.stepIndex ?? (totalSteps - 1);

  // Calculate actual labor hours from all step durations
  const actualLaborHours = steps.reduce((total, step) => {
    return total + (step.actualDurationMinutes ?? 0) / 60;
  }, 0);

  const allCompleted = completedSteps === totalSteps;
  const hasFailed = steps.some(s => s.status === 'failed');

  const updates: Record<string, unknown> = {
    totalSteps,
    completedSteps,
    currentStepIndex,
    currentWorkstationId: currentStep?.workstationId ?? null,
    actualLaborHours,
    updatedAt: serverTimestamp(),
  };

  if (allCompleted) {
    updates.mesStatus = 'completed';
    updates.status = 'completed';
    updates.actualEndDate = serverTimestamp();
  } else if (hasFailed) {
    updates.mesStatus = 'quality_review';
    updates.qcStatus = 'failed';
  }

  await updateDoc(doc(db, MO_COLLECTION, orderId), updates);
}

/**
 * Release MO from draft to planned (validate BOM + routing exist)
 */
async function releaseMO(orderId: string, userId: string): Promise<void> {
  const moRef = doc(db, MO_COLLECTION, orderId);
  const moSnap = await getDoc(moRef);
  if (!moSnap.exists()) throw new Error('Order not found');

  const mo = moSnap.data() as ManufacturingOrderMES;
  if (mo.mesStatus !== 'draft') {
    throw new Error(`Cannot release order in status "${mo.mesStatus}"`);
  }

  // Validate steps exist
  const stepsSnap = await getDocs(
    collection(db, MO_COLLECTION, orderId, STEPS_SUBCOLLECTION),
  );
  if (stepsSnap.empty) {
    throw new Error('Cannot release order without routing steps');
  }

  await updateDoc(moRef, {
    mesStatus: 'planned' as MOStatus,
    status: 'pending-approval',
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Confirm materials are available and transition to ready
 */
async function confirmMaterials(orderId: string, userId: string): Promise<void> {
  const moRef = doc(db, MO_COLLECTION, orderId);
  const moSnap = await getDoc(moRef);
  if (!moSnap.exists()) throw new Error('Order not found');

  const mo = moSnap.data() as ManufacturingOrderMES;
  if (mo.mesStatus !== 'planned') {
    throw new Error(`Cannot confirm materials for order in status "${mo.mesStatus}"`);
  }

  // Set first steps with no dependencies to 'ready'
  const stepsSnap = await getDocs(
    query(
      collection(db, MO_COLLECTION, orderId, STEPS_SUBCOLLECTION),
      orderBy('stepIndex', 'asc'),
    ),
  );

  const batch = writeBatch(db);

  for (const stepDoc of stepsSnap.docs) {
    const step = stepDoc.data() as ManufacturingStep;
    if (step.dependsOnStepIds.length === 0 && step.status === 'queued') {
      batch.update(stepDoc.ref, {
        status: 'ready',
        statusHistory: [...(step.statusHistory ?? []), {
          from: 'queued',
          to: 'ready',
          changedBy: userId,
          changedAt: serverTimestamp(),
        }],
        updatedAt: serverTimestamp(),
      });
    }
  }

  batch.update(moRef, {
    mesStatus: 'ready' as MOStatus,
    status: 'approved',
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  await batch.commit();
}

// ============================================
// Queries & Subscriptions
// ============================================

/**
 * Get all steps for an order
 */
async function getOrderSteps(orderId: string): Promise<ManufacturingStep[]> {
  const stepsSnap = await getDocs(
    query(
      collection(db, MO_COLLECTION, orderId, STEPS_SUBCOLLECTION),
      orderBy('stepIndex', 'asc'),
    ),
  );
  return stepsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as ManufacturingStep);
}

/**
 * Subscribe to steps for an order in real-time
 */
function subscribeToOrderSteps(
  orderId: string,
  callback: (steps: ManufacturingStep[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, MO_COLLECTION, orderId, STEPS_SUBCOLLECTION),
    orderBy('stepIndex', 'asc'),
  );
  return onSnapshot(q, (snapshot) => {
    const steps = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as ManufacturingStep);
    callback(steps);
  });
}

/**
 * Get steps queued at a specific workstation
 */
async function getWorkstationQueue(
  workstationId: string,
  _orgId: string,
): Promise<ManufacturingStep[]> {
  // Get all active MOs for this org, then fan out one step-subcollection
  // query per MO in parallel. Prior version awaited each in series, so
  // 50 active MOs meant 51 sequential round trips before the page rendered.
  const mosSnap = await getDocs(
    query(
      collection(db, MO_COLLECTION),
      where('mesStatus', 'in', ['ready', 'in_progress']),
    ),
  );

  const stepResults = await Promise.all(
    mosSnap.docs.map(async (moDoc) => {
      const stepsQ = query(
        collection(db, MO_COLLECTION, moDoc.id, STEPS_SUBCOLLECTION),
        where('workstationId', '==', workstationId),
        where('status', 'in', ['queued', 'ready', 'in_progress']),
      );
      const snap = await getDocs(stepsQ);
      return snap.docs.map(d => ({ id: d.id, ...d.data(), orderId: moDoc.id }) as ManufacturingStep);
    }),
  );

  const allSteps = stepResults.flat();
  return allSteps.sort((a, b) => a.stepIndex - b.stepIndex);
}

/**
 * Get operator's current workload
 */
async function getOperatorWorkload(
  operatorId: string,
): Promise<ManufacturingStep[]> {
  const mosSnap = await getDocs(
    query(
      collection(db, MO_COLLECTION),
      where('mesStatus', 'in', ['ready', 'in_progress']),
    ),
  );

  const stepResults = await Promise.all(
    mosSnap.docs.map(async (moDoc) => {
      const stepsQ = query(
        collection(db, MO_COLLECTION, moDoc.id, STEPS_SUBCOLLECTION),
        where('assignedOperatorId', '==', operatorId),
        where('status', 'in', ['queued', 'ready', 'in_progress', 'paused', 'qc_pending']),
      );
      const snap = await getDocs(stepsQ);
      return snap.docs.map(d => ({ id: d.id, ...d.data(), orderId: moDoc.id }) as ManufacturingStep);
    }),
  );

  return stepResults.flat();
}

/**
 * Subscribe to steps at a workstation in real-time
 */
function subscribeToWorkstationSteps(
  workstationId: string,
  orderId: string,
  callback: (steps: ManufacturingStep[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, MO_COLLECTION, orderId, STEPS_SUBCOLLECTION),
    where('workstationId', '==', workstationId),
  );
  return onSnapshot(q, (snapshot) => {
    const steps = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as ManufacturingStep);
    callback(steps);
  });
}

/**
 * Get quality events for an order
 */
async function getQualityEvents(orderId: string): Promise<QualityEvent[]> {
  const snap = await getDocs(
    query(
      collection(db, MO_COLLECTION, orderId, QUALITY_EVENTS_SUBCOLLECTION),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as QualityEvent);
}

// ============================================
// Utilities
// ============================================

/**
 * Calculate total active duration from time entries (excluding paused periods)
 */
function calculateDurationFromEntries(entries: TimeEntry[]): number {
  let totalMs = 0;
  let lastStart: number | null = null;

  for (const entry of entries) {
    const ts = entry.timestamp && typeof entry.timestamp === 'object' && 'toMillis' in entry.timestamp
      ? (entry.timestamp as { toMillis: () => number }).toMillis()
      : Date.now();

    switch (entry.action) {
      case 'start':
      case 'resume':
        lastStart = ts;
        break;
      case 'pause':
      case 'complete':
        if (lastStart !== null) {
          totalMs += ts - lastStart;
          lastStart = null;
        }
        break;
    }
  }

  return Math.round(totalMs / 60000); // Convert to minutes
}

// ============================================
// Exports
// ============================================

export const manufacturingExecutionService = {
  startStep,
  pauseStep,
  resumeStep,
  completeStep,
  skipStep,
  recordQCResult,
  createReworkOrder,
  updateMOProgress,
  releaseMO,
  confirmMaterials,
  getOrderSteps,
  subscribeToOrderSteps,
  getWorkstationQueue,
  getOperatorWorkload,
  subscribeToWorkstationSteps,
  getQualityEvents,
  calculateDurationFromEntries,
};
