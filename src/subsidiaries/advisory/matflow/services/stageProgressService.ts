/**
 * Stage Progress Service
 * Service for managing construction stage progress and milestones
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  onSnapshot,
  addDoc,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase';
import type {
  StageProgress,
  StageStatus,
  StageHealth,
  StageMilestone,
  StageBlocker,
  StageTimelineEvent,
  ProjectStageOverview,
  CreateMilestoneDTO,
  UpdateStageStatusDTO,
  AddBlockerDTO,
  ResolveBlockerDTO,
  RequestApprovalDTO,
  ProcessApprovalDTO,
  ProgressMetric,
} from '../types/stageProgress';
import type { StageVariance } from '../types/variance';

// Default organization
const DEFAULT_ORG_ID = 'default';

// ============================================================================
// COLLECTION REFERENCES
// ============================================================================

const getProjectPath = (orgId: string, projectId: string) =>
  `organizations/${orgId}/advisory_projects/${projectId}`;

const getStageProgressRef = (orgId: string, projectId: string) =>
  collection(db, getProjectPath(orgId, projectId), 'stage_progress');

const getMilestonesRef = (orgId: string, projectId: string) =>
  collection(db, getProjectPath(orgId, projectId), 'milestones');

const getBlockersRef = (orgId: string, projectId: string) =>
  collection(db, getProjectPath(orgId, projectId), 'blockers');

const getTimelineRef = (orgId: string, projectId: string) =>
  collection(db, getProjectPath(orgId, projectId), 'stage_timeline');

// ============================================================================
// STAGE PROGRESS CRUD
// ============================================================================

/**
 * Get all stage progress records for a project
 */
export async function getProjectStageProgress(
  projectId: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<StageProgress[]> {
  const ref = getStageProgressRef(orgId, projectId);
  const q = query(ref, orderBy('stageOrder', 'asc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as StageProgress[];
}

/**
 * Get single stage progress record
 */
export async function getStageProgress(
  projectId: string,
  stageId: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<StageProgress | null> {
  const docRef = doc(getStageProgressRef(orgId, projectId), stageId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as StageProgress;
}

/**
 * Initialize stage progress records from BOQ stages
 */
export async function initializeStageProgress(
  projectId: string,
  stages: Array<{ id: string; name: string; order: number }>,
  userId: string,
  userName: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<void> {
  const batch = writeBatch(db);
  const ref = getStageProgressRef(orgId, projectId);
  const now = Timestamp.now();
  
  for (const stage of stages) {
    const progressDoc = doc(ref, stage.id);
    const progress: Omit<StageProgress, 'id'> = {
      projectId,
      stageId: stage.id,
      stageName: stage.name,
      stageOrder: stage.order,
      status: 'not_started',
      health: 'healthy',
      materialProgress: { current: 0, target: 0, percent: 0, trend: 'stable' },
      workProgress: { current: 0, target: 100, percent: 0, trend: 'stable' },
      overallProgress: 0,
      budgetedCost: 0,
      actualCost: 0,
      committedCost: 0,
      costVariancePercent: 0,
      totalBOQItems: 0,
      completedBOQItems: 0,
      totalMilestones: 0,
      completedMilestones: 0,
      activeBlockers: [],
      requiresApproval: true,
      lastUpdatedAt: now,
      lastUpdatedBy: userId,
    };
    
    batch.set(progressDoc, progress);
  }
  
  await batch.commit();
  
  // Log initialization event
  if (stages.length > 0) {
    await addTimelineEvent(projectId, stages[0].id, {
      type: 'status_change',
      title: 'Stage tracking initialized',
      description: `${stages.length} stages initialized for tracking`,
      userId,
      userName,
    }, orgId);
  }
}

/**
 * Update stage status
 */
export async function updateStageStatus(
  projectId: string,
  stageId: string,
  update: UpdateStageStatusDTO,
  userId: string,
  userName: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<void> {
  const docRef = doc(getStageProgressRef(orgId, projectId), stageId);
  const now = Timestamp.now();
  
  const currentDoc = await getDoc(docRef);
  const currentStatus = currentDoc.data()?.status as StageStatus | undefined;
  
  const updates: Partial<StageProgress> = {
    status: update.status,
    lastUpdatedAt: now,
    lastUpdatedBy: userId,
  };
  
  // Set actual dates based on status transitions
  if (update.status === 'in_progress' && currentStatus === 'not_started') {
    updates.actualStartDate = now;
  }
  
  if (update.status === 'signed_off') {
    updates.actualEndDate = now;
  }
  
  // Update health based on status
  if (update.status === 'on_hold') {
    updates.health = 'blocked';
  }
  
  await updateDoc(docRef, updates);
  
  // Log status change
  await addTimelineEvent(projectId, stageId, {
    type: 'status_change',
    title: `Status changed to ${formatStatus(update.status)}`,
    description: update.notes,
    userId,
    userName,
  }, orgId);
}

/**
 * Recalculate stage progress from variance data
 */
export async function recalculateStageProgress(
  projectId: string,
  stageVariance: StageVariance,
  userId: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<void> {
  const docRef = doc(getStageProgressRef(orgId, projectId), stageVariance.stageId);
  const now = Timestamp.now();
  
  // Calculate material progress
  const materialProgress: ProgressMetric = {
    current: stageVariance.fullyProcured + stageVariance.partiallyProcured * 0.5,
    target: stageVariance.materialsCount,
    percent: stageVariance.fulfillmentPercent,
    trend: determineTrend(stageVariance.fulfillmentPercent),
  };
  
  // Calculate overall progress (weighted: 60% materials, 40% work)
  const workProgress = await getWorkProgress(projectId, stageVariance.stageId, orgId);
  const overallProgress = materialProgress.percent * 0.6 + workProgress.percent * 0.4;
  
  // Determine health
  const health = determineStageHealth(
    stageVariance,
    materialProgress,
    workProgress
  );
  
  // Determine status if materials are complete
  let status: StageStatus | undefined;
  if (materialProgress.percent >= 100 && stageVariance.notStarted === 0) {
    status = 'materials_complete';
  }
  
  const updates: Partial<StageProgress> = {
    materialProgress,
    workProgress,
    overallProgress,
    health,
    budgetedCost: stageVariance.totalPlannedCost,
    actualCost: stageVariance.totalActualCost,
    costVariancePercent: stageVariance.costVariancePercent,
    totalBOQItems: stageVariance.materialsCount,
    completedBOQItems: stageVariance.fullyProcured,
    lastUpdatedAt: now,
    lastUpdatedBy: userId,
  };
  
  if (status) {
    updates.status = status;
  }
  
  await updateDoc(docRef, updates);
}

// ============================================================================
// MILESTONES
// ============================================================================

/**
 * Get milestones for a stage
 */
export async function getStageMilestones(
  projectId: string,
  stageId: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<StageMilestone[]> {
  const ref = getMilestonesRef(orgId, projectId);
  const q = query(
    ref,
    where('stageId', '==', stageId),
    orderBy('plannedDate', 'asc')
  );
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as StageMilestone[];
}

/**
 * Create a new milestone
 */
export async function createMilestone(
  projectId: string,
  data: CreateMilestoneDTO,
  _userId: string,
  _userName: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<string> {
  const ref = getMilestonesRef(orgId, projectId);
  const now = Timestamp.now();
  
  const milestone: Omit<StageMilestone, 'id'> = {
    stageId: data.stageId,
    projectId,
    name: data.name,
    description: data.description,
    type: data.type,
    plannedDate: Timestamp.fromDate(data.plannedDate),
    status: 'pending',
    dependsOn: data.dependsOn || [],
    createdAt: now,
    updatedAt: now,
  };
  
  const docRef = await addDoc(ref, milestone);
  
  // Update stage milestone count
  await updateStageMilestoneCount(projectId, data.stageId, orgId);
  
  return docRef.id;
}

/**
 * Complete a milestone
 */
export async function completeMilestone(
  projectId: string,
  milestoneId: string,
  userId: string,
  userName: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<void> {
  const docRef = doc(getMilestonesRef(orgId, projectId), milestoneId);
  const now = Timestamp.now();
  
  await updateDoc(docRef, {
    status: 'completed',
    actualDate: now,
    completedBy: userId,
    completedByName: userName,
    updatedAt: now,
  });
  
  const milestoneDoc = await getDoc(docRef);
  const milestone = milestoneDoc.data() as StageMilestone;
  
  // Update stage milestone count
  await updateStageMilestoneCount(projectId, milestone.stageId, orgId);
  
  // Log event
  await addTimelineEvent(projectId, milestone.stageId, {
    type: 'milestone_completed',
    title: `Milestone completed: ${milestone.name}`,
    userId,
    userName,
    relatedMilestoneId: milestoneId,
  }, orgId);
}

/**
 * Check for overdue milestones and update status
 */
export async function checkOverdueMilestones(
  projectId: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<number> {
  const ref = getMilestonesRef(orgId, projectId);
  const now = Timestamp.now();
  
  const q = query(
    ref,
    where('status', 'in', ['pending', 'in_progress'])
  );
  
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  let count = 0;
  
  for (const docSnap of snapshot.docs) {
    const milestone = docSnap.data() as StageMilestone;
    if (milestone.plannedDate.toMillis() < now.toMillis()) {
      batch.update(docSnap.ref, { status: 'overdue', updatedAt: now });
      count++;
      
      // Log overdue event
      addTimelineEvent(projectId, milestone.stageId, {
        type: 'milestone_overdue',
        title: `Milestone overdue: ${milestone.name}`,
        userId: 'system',
        userName: 'System',
        relatedMilestoneId: docSnap.id,
      }, orgId);
    }
  }
  
  if (count > 0) {
    await batch.commit();
  }
  
  return count;
}

// ============================================================================
// BLOCKERS
// ============================================================================

/**
 * Add a blocker to a stage
 */
export async function addBlocker(
  projectId: string,
  data: AddBlockerDTO,
  userId: string,
  userName: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<string> {
  const ref = getBlockersRef(orgId, projectId);
  const now = Timestamp.now();
  
  const blockerData = {
    stageId: data.stageId,
    projectId,
    type: data.type,
    description: data.description,
    severity: data.severity,
    createdAt: now,
  };
  
  const docRef = await addDoc(ref, blockerData);
  
  // Update stage blockers array
  await updateStageBlockers(projectId, data.stageId, orgId);
  
  // Log event
  await addTimelineEvent(projectId, data.stageId, {
    type: 'blocker_added',
    title: `Blocker added: ${formatBlockerType(data.type)}`,
    description: data.description,
    userId,
    userName,
  }, orgId);
  
  return docRef.id;
}

/**
 * Resolve a blocker
 */
export async function resolveBlocker(
  projectId: string,
  stageId: string,
  data: ResolveBlockerDTO,
  userId: string,
  userName: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<void> {
  const docRef = doc(getBlockersRef(orgId, projectId), data.blockerId);
  const now = Timestamp.now();
  
  await updateDoc(docRef, {
    resolvedAt: now,
    resolution: data.resolution,
  });
  
  // Update stage blockers array
  await updateStageBlockers(projectId, stageId, orgId);
  
  // Log event
  await addTimelineEvent(projectId, stageId, {
    type: 'blocker_resolved',
    title: 'Blocker resolved',
    description: data.resolution,
    userId,
    userName,
  }, orgId);
}

/**
 * Get active blockers for a stage
 */
export async function getActiveBlockers(
  projectId: string,
  stageId: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<StageBlocker[]> {
  const ref = getBlockersRef(orgId, projectId);
  const q = query(
    ref,
    where('stageId', '==', stageId)
  );
  
  const snapshot = await getDocs(q);
  
  // Filter for unresolved blockers
  return snapshot.docs
    .map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    } as StageBlocker & { stageId: string; projectId: string }))
    .filter((b) => !b.resolvedAt);
}

// ============================================================================
// APPROVALS
// ============================================================================

/**
 * Request approval for stage completion
 */
export async function requestStageApproval(
  projectId: string,
  data: RequestApprovalDTO,
  userId: string,
  userName: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<void> {
  const docRef = doc(getStageProgressRef(orgId, projectId), data.stageId);
  const now = Timestamp.now();
  
  await updateDoc(docRef, {
    approvalStatus: 'pending',
    lastUpdatedAt: now,
    lastUpdatedBy: userId,
  });
  
  // Log event
  await addTimelineEvent(projectId, data.stageId, {
    type: 'approval_requested',
    title: 'Stage approval requested',
    description: data.notes,
    userId,
    userName,
  }, orgId);
}

/**
 * Process stage approval (approve or reject)
 */
export async function processStageApproval(
  projectId: string,
  data: ProcessApprovalDTO,
  userId: string,
  userName: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<void> {
  const docRef = doc(getStageProgressRef(orgId, projectId), data.stageId);
  const now = Timestamp.now();
  
  const updates: Partial<StageProgress> = {
    approvalStatus: data.approved ? 'approved' : 'rejected',
    lastUpdatedAt: now,
    lastUpdatedBy: userId,
  };
  
  if (data.approved) {
    updates.approvedBy = userId;
    updates.approvedByName = userName;
    updates.approvedAt = now;
    updates.status = 'signed_off';
    updates.actualEndDate = now;
  }
  
  await updateDoc(docRef, updates);
  
  // Log event
  await addTimelineEvent(projectId, data.stageId, {
    type: data.approved ? 'approval_granted' : 'approval_rejected',
    title: data.approved ? 'Stage approved' : 'Stage approval rejected',
    description: data.notes,
    userId,
    userName,
  }, orgId);
}

// ============================================================================
// TIMELINE
// ============================================================================

/**
 * Add a timeline event
 */
export async function addTimelineEvent(
  projectId: string,
  stageId: string,
  event: Omit<StageTimelineEvent, 'id' | 'stageId' | 'projectId' | 'timestamp'>,
  orgId: string = DEFAULT_ORG_ID
): Promise<string> {
  const ref = getTimelineRef(orgId, projectId);
  
  const timelineEvent: Omit<StageTimelineEvent, 'id'> = {
    stageId,
    projectId,
    timestamp: Timestamp.now(),
    ...event,
  };
  
  const docRef = await addDoc(ref, timelineEvent);
  return docRef.id;
}

/**
 * Get timeline events for a stage
 */
export async function getStageTimeline(
  projectId: string,
  stageId: string,
  limitCount = 50,
  orgId: string = DEFAULT_ORG_ID
): Promise<StageTimelineEvent[]> {
  const ref = getTimelineRef(orgId, projectId);
  const q = query(
    ref,
    where('stageId', '==', stageId),
    orderBy('timestamp', 'desc')
  );
  
  const snapshot = await getDocs(q);
  
  return snapshot.docs.slice(0, limitCount).map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as StageTimelineEvent[];
}

/**
 * Get project-wide timeline
 */
export async function getProjectTimeline(
  projectId: string,
  limitCount = 100,
  orgId: string = DEFAULT_ORG_ID
): Promise<StageTimelineEvent[]> {
  const ref = getTimelineRef(orgId, projectId);
  const q = query(ref, orderBy('timestamp', 'desc'));
  
  const snapshot = await getDocs(q);
  
  return snapshot.docs.slice(0, limitCount).map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as StageTimelineEvent[];
}

// ============================================================================
// PROJECT OVERVIEW
// ============================================================================

/**
 * Calculate complete project stage overview
 */
export async function calculateProjectStageOverview(
  projectId: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<ProjectStageOverview> {
  const stages = await getProjectStageProgress(projectId, orgId);
  const now = Timestamp.now();
  
  // Aggregate metrics
  let totalBudget = 0;
  let totalSpent = 0;
  let totalCommitted = 0;
  let completedStages = 0;
  let inProgressStages = 0;
  let notStartedStages = 0;
  let blockedStages = 0;
  let onScheduleStages = 0;
  let delayedStages = 0;
  let aheadOfScheduleStages = 0;
  let totalMaterialProgress = 0;
  let totalWorkProgress = 0;
  
  const criticalPathStages: string[] = [];
  
  for (const stage of stages) {
    totalBudget += stage.budgetedCost;
    totalSpent += stage.actualCost;
    totalCommitted += stage.committedCost;
    totalMaterialProgress += stage.materialProgress.percent;
    totalWorkProgress += stage.workProgress.percent;
    
    // Count by status
    switch (stage.status) {
      case 'signed_off':
      case 'verified':
        completedStages++;
        break;
      case 'in_progress':
      case 'materials_complete':
      case 'work_complete':
        inProgressStages++;
        break;
      case 'not_started':
      case 'materials_pending':
        notStartedStages++;
        break;
      case 'on_hold':
        blockedStages++;
        break;
    }
    
    // Count by health
    if (stage.health === 'critical' || stage.health === 'blocked') {
      criticalPathStages.push(stage.stageId);
    }
    
    // Check schedule status
    if (stage.plannedEndDate && stage.actualEndDate) {
      const plannedMs = stage.plannedEndDate.toMillis();
      const actualMs = stage.actualEndDate.toMillis();
      
      if (actualMs <= plannedMs) {
        aheadOfScheduleStages++;
      } else {
        delayedStages++;
      }
    } else if (stage.plannedEndDate && stage.status !== 'signed_off') {
      const plannedMs = stage.plannedEndDate.toMillis();
      const nowMs = now.toMillis();
      
      if (nowMs > plannedMs) {
        delayedStages++;
      } else {
        onScheduleStages++;
      }
    } else {
      onScheduleStages++;
    }
  }
  
  const stageCount = stages.length || 1;
  
  return {
    projectId,
    calculatedAt: now,
    totalStages: stages.length,
    completedStages,
    inProgressStages,
    notStartedStages,
    blockedStages,
    overallMaterialProgress: totalMaterialProgress / stageCount,
    overallWorkProgress: totalWorkProgress / stageCount,
    overallProgress: (totalMaterialProgress + totalWorkProgress) / (stageCount * 2),
    onScheduleStages,
    delayedStages,
    aheadOfScheduleStages,
    totalBudget,
    totalSpent,
    totalCommitted,
    budgetVariancePercent: totalBudget > 0
      ? ((totalSpent - totalBudget) / totalBudget) * 100
      : 0,
    criticalPathStages,
    daysAheadOrBehind: calculateDaysVariance(stages),
    stages,
  };
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to stage progress updates
 */
export function subscribeToStageProgress(
  projectId: string,
  callback: (stages: StageProgress[]) => void,
  orgId: string = DEFAULT_ORG_ID
): () => void {
  const ref = getStageProgressRef(orgId, projectId);
  const q = query(ref, orderBy('stageOrder', 'asc'));
  
  return onSnapshot(q, (snapshot) => {
    const stages = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as StageProgress[];
    
    callback(stages);
  });
}

/**
 * Subscribe to stage timeline
 */
export function subscribeToStageTimeline(
  projectId: string,
  stageId: string,
  callback: (events: StageTimelineEvent[]) => void,
  orgId: string = DEFAULT_ORG_ID
): () => void {
  const ref = getTimelineRef(orgId, projectId);
  const q = query(
    ref,
    where('stageId', '==', stageId),
    orderBy('timestamp', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const events = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as StageTimelineEvent[];
    
    callback(events);
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatStatus(status: StageStatus): string {
  const statusMap: Record<StageStatus, string> = {
    not_started: 'Not Started',
    materials_pending: 'Materials Pending',
    in_progress: 'In Progress',
    on_hold: 'On Hold',
    materials_complete: 'Materials Complete',
    work_complete: 'Work Complete',
    verified: 'Verified',
    signed_off: 'Signed Off',
  };
  return statusMap[status] || status;
}

function formatBlockerType(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function determineTrend(
  currentPercent: number,
  previousPercent?: number
): 'improving' | 'stable' | 'declining' {
  if (!previousPercent) return 'stable';
  const diff = currentPercent - previousPercent;
  if (diff > 2) return 'improving';
  if (diff < -2) return 'declining';
  return 'stable';
}

function determineStageHealth(
  variance: StageVariance,
  materialProgress: ProgressMetric,
  _workProgress: ProgressMetric
): StageHealth {
  // Critical: cost overrun > 20% or fulfillment < 50% when should be higher
  if (variance.costVariancePercent > 20) return 'critical';
  if (materialProgress.percent < 50 && variance.status === 'under-procured') {
    return 'critical';
  }
  
  // At risk: cost overrun > 10% or minor issues
  if (variance.costVariancePercent > 10) return 'at_risk';
  if (variance.status === 'under-procured') return 'at_risk';
  
  return 'healthy';
}

async function getWorkProgress(
  projectId: string,
  stageId: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<ProgressMetric> {
  // Work progress is manually tracked or derived from other systems
  const docRef = doc(getStageProgressRef(orgId, projectId), stageId);
  const snapshot = await getDoc(docRef);
  
  if (snapshot.exists()) {
    return snapshot.data().workProgress as ProgressMetric;
  }
  
  return { current: 0, target: 100, percent: 0, trend: 'stable' };
}

async function updateStageMilestoneCount(
  projectId: string,
  stageId: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<void> {
  const milestones = await getStageMilestones(projectId, stageId, orgId);
  const completed = milestones.filter((m) => m.status === 'completed').length;
  const nextMilestone = milestones.find((m) => m.status === 'pending');
  
  const docRef = doc(getStageProgressRef(orgId, projectId), stageId);
  
  const updates: Partial<StageProgress> = {
    totalMilestones: milestones.length,
    completedMilestones: completed,
    lastUpdatedAt: Timestamp.now(),
  };
  
  if (nextMilestone) {
    const daysUntilDue = Math.ceil(
      (nextMilestone.plannedDate.toMillis() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    
    updates.nextMilestone = {
      id: nextMilestone.id,
      name: nextMilestone.name,
      dueDate: nextMilestone.plannedDate,
      daysUntilDue,
    };
  } else {
    updates.nextMilestone = undefined;
  }
  
  await updateDoc(docRef, updates);
}

async function updateStageBlockers(
  projectId: string,
  stageId: string,
  orgId: string = DEFAULT_ORG_ID
): Promise<void> {
  const blockers = await getActiveBlockers(projectId, stageId, orgId);
  const docRef = doc(getStageProgressRef(orgId, projectId), stageId);
  
  let health: StageHealth = 'healthy';
  if (blockers.some((b) => b.severity === 'critical')) {
    health = 'blocked';
  } else if (blockers.some((b) => b.severity === 'high')) {
    health = 'at_risk';
  }
  
  const updates: Partial<StageProgress> = {
    activeBlockers: blockers,
    health,
    lastUpdatedAt: Timestamp.now(),
  };
  
  await updateDoc(docRef, updates);
}

function calculateDaysVariance(stages: StageProgress[]): number {
  // Calculate overall days ahead/behind based on completed stages
  let totalVariance = 0;
  let countedStages = 0;
  
  for (const stage of stages) {
    if (stage.plannedEndDate && stage.actualEndDate) {
      const plannedMs = stage.plannedEndDate.toMillis();
      const actualMs = stage.actualEndDate.toMillis();
      const daysDiff = (plannedMs - actualMs) / (1000 * 60 * 60 * 24);
      totalVariance += daysDiff;
      countedStages++;
    }
  }
  
  return countedStages > 0 ? Math.round(totalVariance / countedStages) : 0;
}

export const stageProgressService = {
  // Stage Progress
  getProjectStageProgress,
  getStageProgress,
  initializeStageProgress,
  updateStageStatus,
  recalculateStageProgress,
  calculateProjectStageOverview,
  
  // Milestones
  getStageMilestones,
  createMilestone,
  completeMilestone,
  checkOverdueMilestones,
  
  // Blockers
  addBlocker,
  resolveBlocker,
  getActiveBlockers,
  
  // Approvals
  requestStageApproval,
  processStageApproval,
  
  // Timeline
  addTimelineEvent,
  getStageTimeline,
  getProjectTimeline,
  
  // Subscriptions
  subscribeToStageProgress,
  subscribeToStageTimeline,
};

export default stageProgressService;
