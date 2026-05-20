// ============================================================================
// OKR SERVICE - DawinOS CEO Strategy Command
// Firebase service for OKR management
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  limit,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import {
  OKRObjective,
  KeyResult,
  KeyResultCheckIn,
  KeyResultMilestone,
  OKRCyclePeriod,
  OKRCycleSettings,
  OKRAnalytics,
  OKRTreeNode,
  OKRFilters,
  CreateObjectiveInput,
  UpdateObjectiveInput,
  CreateKeyResultInput,
  UpdateKeyResultInput,
  CheckInInput,
  CreateCycleInput,
  UpdateCycleInput,
} from '../types/okr.types';
import {
  OKR_COLLECTIONS,
  OKR_STATUS,
  OKR_DEFAULTS,
  CONFIDENCE_LEVEL,
  CHECK_IN_FREQUENCY,
  OKR_CYCLE_STATUS,
  OKR_VISIBILITY,
  OKR_SCORING_METHOD,
} from '../constants/okr.constants';

// ----------------------------------------------------------------------------
// ID Generation
// ----------------------------------------------------------------------------
function generateId(): string {
  return doc(collection(db, '_')).id;
}

// ----------------------------------------------------------------------------
// Collection References
// ----------------------------------------------------------------------------
function getOKRsCollection(companyId: string) {
  return collection(db, 'companies', companyId, OKR_COLLECTIONS.OBJECTIVES);
}

function getOKRRef(companyId: string, okrId: string) {
  return doc(db, 'companies', companyId, OKR_COLLECTIONS.OBJECTIVES, okrId);
}

function getCyclesCollection(companyId: string) {
  return collection(db, 'companies', companyId, OKR_COLLECTIONS.CYCLES);
}

function getCycleRef(companyId: string, cycleId: string) {
  return doc(db, 'companies', companyId, OKR_COLLECTIONS.CYCLES, cycleId);
}

// Alignments collection - reserved for future use
// function getAlignmentsCollection(companyId: string) {
//   return collection(db, 'companies', companyId, OKR_COLLECTIONS.ALIGNMENTS);
// }

// ============================================================================
// SCORE CALCULATION UTILITIES
// ============================================================================

function calculateKeyResultScore(kr: KeyResult): number {
  if (kr.type === 'binary') {
    return kr.currentValue >= 1 ? 1.0 : 0.0;
  }

  if (kr.type === 'milestone' && kr.milestones.length > 0) {
    const completed = kr.milestones.filter((m) => m.isComplete).length;
    return completed / kr.milestones.length;
  }

  // Numeric, percentage, currency
  const range = Math.abs(kr.targetValue - kr.startValue);
  if (range === 0) return kr.currentValue === kr.targetValue ? 1.0 : 0.0;

  const progress = (kr.currentValue - kr.startValue) / (kr.targetValue - kr.startValue);
  return Math.max(0, Math.min(1, progress));
}

function calculateKeyResultProgress(kr: KeyResult): number {
  return Math.round(calculateKeyResultScore(kr) * 100);
}

function calculateObjectiveScore(
  keyResults: KeyResult[],
  method: 'average' | 'weighted' = 'average'
): number {
  if (keyResults.length === 0) return 0;

  if (method === 'weighted') {
    const totalWeight = keyResults.reduce((sum, kr) => sum + (kr.weight || 1), 0);
    const weightedSum = keyResults.reduce(
      (sum, kr) => sum + calculateKeyResultScore(kr) * (kr.weight || 1),
      0
    );
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  // Average method
  const sum = keyResults.reduce((acc, kr) => acc + calculateKeyResultScore(kr), 0);
  return sum / keyResults.length;
}

function getOverallConfidence(keyResults: KeyResult[]): typeof CONFIDENCE_LEVEL[keyof typeof CONFIDENCE_LEVEL] {
  if (keyResults.length === 0) return CONFIDENCE_LEVEL.ON_TRACK;

  const confidenceScores = keyResults.map((kr) => {
    if (kr.confidence === CONFIDENCE_LEVEL.ON_TRACK) return 3;
    if (kr.confidence === CONFIDENCE_LEVEL.AT_RISK) return 2;
    return 1;
  });

  const avg = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;

  if (avg > 2.5) return CONFIDENCE_LEVEL.ON_TRACK;
  if (avg > 1.5) return CONFIDENCE_LEVEL.AT_RISK;
  return CONFIDENCE_LEVEL.OFF_TRACK;
}

// ============================================================================
// OKR SERVICE CLASS
// ============================================================================
class OKRService {
  // ==========================================================================
  // OBJECTIVE CRUD
  // ==========================================================================

  async createObjective(
    companyId: string,
    input: CreateObjectiveInput,
    userId: string
  ): Promise<OKRObjective> {
    const colRef = getOKRsCollection(companyId);
    const docRef = doc(colRef);
    const now = Timestamp.now();

    // Get cycle info
    const cycle = await this.getCycle(companyId, input.cycleId);
    if (!cycle) {
      throw new Error('OKR cycle not found');
    }

    // Process key results
    const keyResults: KeyResult[] = (input.keyResults || []).map((kr, index) => ({
      id: generateId(),
      objectiveId: docRef.id,
      title: kr.title,
      description: kr.description,
      type: kr.type,
      unit: kr.unit,
      startValue: kr.startValue,
      targetValue: kr.targetValue,
      currentValue: kr.startValue,
      stretchValue: kr.stretchValue,
      milestones: (kr.milestones || []).map((m, i) => ({
        id: generateId(),
        title: m.title,
        description: m.description,
        targetDate: m.targetDate ? Timestamp.fromDate(m.targetDate) : undefined,
        isComplete: false,
        order: m.order ?? i,
      })),
      score: 0,
      progress: 0,
      confidence: CONFIDENCE_LEVEL.ON_TRACK,
      ownerId: kr.ownerId,
      ownerName: kr.ownerName,
      isComplete: false,
      order: index,
      weight: kr.weight || 1,
      checkIns: [],
    }));

    const objective: OKRObjective = {
      id: docRef.id,
      companyId,
      level: input.level,
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      ownerName: input.ownerName,
      ownerAvatarUrl: input.ownerAvatarUrl,
      cycle: cycle.cycle,
      cycleId: input.cycleId,
      year: cycle.year,
      quarter: cycle.quarter,
      title: input.title,
      description: input.description,
      category: input.category,
      status: OKR_STATUS.DRAFT,
      keyResults,
      score: 0,
      progress: 0,
      parentOKRId: input.parentOKRId,
      alignedStrategyPillarId: input.alignedStrategyPillarId,
      alignedStrategyObjectiveId: input.alignedStrategyObjectiveId,
      childOKRIds: [],
      tags: input.tags || [],
      visibility: input.visibility || OKR_VISIBILITY.PUBLIC,
      isStretch: input.isStretch || false,
      checkInFrequency: input.checkInFrequency || OKR_DEFAULTS.DEFAULT_CHECK_IN_FREQUENCY,
      checkInCount: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };

    await setDoc(docRef, objective);

    // Add to parent's childOKRIds if has parent
    if (input.parentOKRId) {
      await this.addChildToParent(companyId, input.parentOKRId, docRef.id);
    }

    // Update cycle objective count
    await this.updateCycleStats(companyId, input.cycleId);

    return objective;
  }

  async getObjective(companyId: string, okrId: string): Promise<OKRObjective | null> {
    const docSnap = await getDoc(getOKRRef(companyId, okrId));
    if (!docSnap.exists()) {
      return null;
    }
    return { id: docSnap.id, ...docSnap.data() } as OKRObjective;
  }

  async getObjectives(companyId: string, filters?: OKRFilters): Promise<OKRObjective[]> {
    let q = query(getOKRsCollection(companyId), orderBy('createdAt', 'desc'));

    if (filters?.cycleId) {
      q = query(q, where('cycleId', '==', filters.cycleId));
    }
    if (filters?.ownerId) {
      q = query(q, where('ownerId', '==', filters.ownerId));
    }
    if (filters?.ownerType) {
      q = query(q, where('ownerType', '==', filters.ownerType));
    }
    if (filters?.level) {
      q = query(q, where('level', '==', filters.level));
    }
    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters?.parentOKRId !== undefined) {
      q = query(q, where('parentOKRId', '==', filters.parentOKRId || null));
    }
    if (filters?.visibility) {
      q = query(q, where('visibility', '==', filters.visibility));
    }

    const snapshot = await getDocs(q);
    let objectives = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as OKRObjective[];

    // Client-side filtering
    if (filters?.tags && filters.tags.length > 0) {
      objectives = objectives.filter((obj) =>
        filters.tags!.some((tag) => obj.tags.includes(tag))
      );
    }

    if (filters?.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      objectives = objectives.filter(
        (obj) =>
          obj.title.toLowerCase().includes(searchLower) ||
          obj.description?.toLowerCase().includes(searchLower)
      );
    }

    return objectives;
  }

  async getMyOKRs(companyId: string, userId: string, cycleId?: string): Promise<OKRObjective[]> {
    return this.getObjectives(companyId, {
      ownerId: userId,
      ownerType: 'user',
      cycleId,
    });
  }

  async getCompanyOKRs(companyId: string, cycleId: string): Promise<OKRObjective[]> {
    return this.getObjectives(companyId, {
      cycleId,
      level: 'company',
    });
  }

  async updateObjective(
    companyId: string,
    okrId: string,
    input: UpdateObjectiveInput,
    userId: string
  ): Promise<OKRObjective> {
    const existing = await this.getObjective(companyId, okrId);
    if (!existing) {
      throw new Error('Objective not found');
    }

    const now = Timestamp.now();
    const updateData: Partial<OKRObjective> = {
      updatedAt: now,
      updatedBy: userId,
    };

    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description || undefined;
    if (input.category !== undefined) updateData.category = input.category || undefined;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.tags !== undefined) updateData.tags = input.tags || [];
    if (input.visibility !== undefined) updateData.visibility = input.visibility;
    if (input.checkInFrequency !== undefined) updateData.checkInFrequency = input.checkInFrequency;

    // Handle parent change
    if (input.parentOKRId !== undefined && input.parentOKRId !== existing.parentOKRId) {
      // Remove from old parent
      if (existing.parentOKRId) {
        await this.removeChildFromParent(companyId, existing.parentOKRId, okrId);
      }
      // Add to new parent
      if (input.parentOKRId) {
        await this.addChildToParent(companyId, input.parentOKRId, okrId);
      }
      updateData.parentOKRId = input.parentOKRId || undefined;
    }

    if (input.alignedStrategyPillarId !== undefined) {
      updateData.alignedStrategyPillarId = input.alignedStrategyPillarId || undefined;
    }
    if (input.alignedStrategyObjectiveId !== undefined) {
      updateData.alignedStrategyObjectiveId = input.alignedStrategyObjectiveId || undefined;
    }

    await updateDoc(getOKRRef(companyId, okrId), updateData);
    return (await this.getObjective(companyId, okrId))!;
  }

  async deleteObjective(companyId: string, okrId: string): Promise<void> {
    const objective = await this.getObjective(companyId, okrId);
    if (!objective) {
      throw new Error('Objective not found');
    }

    // Remove from parent
    if (objective.parentOKRId) {
      await this.removeChildFromParent(companyId, objective.parentOKRId, okrId);
    }

    // Orphan children (remove their parentOKRId)
    const batch = writeBatch(db);
    for (const childId of objective.childOKRIds) {
      batch.update(getOKRRef(companyId, childId), { parentOKRId: null });
    }
    await batch.commit();

    await deleteDoc(getOKRRef(companyId, okrId));

    // Update cycle stats
    await this.updateCycleStats(companyId, objective.cycleId);
  }

  async activateObjective(companyId: string, okrId: string, userId: string): Promise<OKRObjective> {
    const objective = await this.getObjective(companyId, okrId);
    if (!objective) {
      throw new Error('Objective not found');
    }

    if (objective.keyResults.length < OKR_DEFAULTS.MIN_KEY_RESULTS_TO_ACTIVATE) {
      throw new Error(`Objective must have at least ${OKR_DEFAULTS.MIN_KEY_RESULTS_TO_ACTIVATE} key result(s)`);
    }

    return this.updateObjective(companyId, okrId, { status: OKR_STATUS.ACTIVE }, userId);
  }

  async completeObjective(companyId: string, okrId: string, userId: string): Promise<OKRObjective> {
    return this.updateObjective(companyId, okrId, { status: OKR_STATUS.COMPLETED }, userId);
  }

  // ==========================================================================
  // KEY RESULT MANAGEMENT
  // ==========================================================================

  async addKeyResult(
    companyId: string,
    okrId: string,
    input: CreateKeyResultInput,
    userId: string
  ): Promise<KeyResult> {
    const objective = await this.getObjective(companyId, okrId);
    if (!objective) {
      throw new Error('Objective not found');
    }

    if (objective.keyResults.length >= OKR_DEFAULTS.MAX_KEY_RESULTS_PER_OBJECTIVE) {
      throw new Error(`Maximum ${OKR_DEFAULTS.MAX_KEY_RESULTS_PER_OBJECTIVE} key results allowed`);
    }

    const newKeyResult: KeyResult = {
      id: generateId(),
      objectiveId: okrId,
      title: input.title,
      description: input.description,
      type: input.type,
      unit: input.unit,
      startValue: input.startValue,
      targetValue: input.targetValue,
      currentValue: input.startValue,
      stretchValue: input.stretchValue,
      milestones: (input.milestones || []).map((m, i) => ({
        id: generateId(),
        title: m.title,
        description: m.description,
        targetDate: m.targetDate ? Timestamp.fromDate(m.targetDate) : undefined,
        isComplete: false,
        order: m.order ?? i,
      })),
      score: 0,
      progress: 0,
      confidence: CONFIDENCE_LEVEL.ON_TRACK,
      ownerId: input.ownerId,
      ownerName: input.ownerName,
      isComplete: false,
      order: objective.keyResults.length,
      weight: input.weight || 1,
      checkIns: [],
    };

    const updatedKeyResults = [...objective.keyResults, newKeyResult];

    await updateDoc(getOKRRef(companyId, okrId), {
      keyResults: updatedKeyResults,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return newKeyResult;
  }

  async updateKeyResult(
    companyId: string,
    okrId: string,
    keyResultId: string,
    input: UpdateKeyResultInput,
    userId: string
  ): Promise<KeyResult> {
    const objective = await this.getObjective(companyId, okrId);
    if (!objective) {
      throw new Error('Objective not found');
    }

    const krIndex = objective.keyResults.findIndex((kr) => kr.id === keyResultId);
    if (krIndex === -1) {
      throw new Error('Key result not found');
    }

    const updatedKeyResult: KeyResult = {
      ...objective.keyResults[krIndex],
    };

    if (input.title !== undefined) updatedKeyResult.title = input.title;
    if (input.description !== undefined) updatedKeyResult.description = input.description || undefined;
    if (input.targetValue !== undefined) updatedKeyResult.targetValue = input.targetValue;
    if (input.currentValue !== undefined) updatedKeyResult.currentValue = input.currentValue;
    if (input.stretchValue !== undefined) updatedKeyResult.stretchValue = input.stretchValue || undefined;
    if (input.confidence !== undefined) updatedKeyResult.confidence = input.confidence;
    if (input.confidenceNote !== undefined) updatedKeyResult.confidenceNote = input.confidenceNote || undefined;
    if (input.ownerId !== undefined) updatedKeyResult.ownerId = input.ownerId || undefined;
    if (input.ownerName !== undefined) updatedKeyResult.ownerName = input.ownerName || undefined;
    if (input.weight !== undefined) updatedKeyResult.weight = input.weight;

    // Recalculate score and progress
    updatedKeyResult.score = calculateKeyResultScore(updatedKeyResult);
    updatedKeyResult.progress = calculateKeyResultProgress(updatedKeyResult);

    // Check completion
    if (updatedKeyResult.score >= 1.0 && !updatedKeyResult.isComplete) {
      updatedKeyResult.isComplete = true;
      updatedKeyResult.completedAt = Timestamp.now();
    }

    const updatedKeyResults = [...objective.keyResults];
    updatedKeyResults[krIndex] = updatedKeyResult;

    // Recalculate objective score
    const objectiveScore = calculateObjectiveScore(updatedKeyResults);
    const objectiveProgress = Math.round(objectiveScore * 100);

    await updateDoc(getOKRRef(companyId, okrId), {
      keyResults: updatedKeyResults,
      score: objectiveScore,
      progress: objectiveProgress,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return updatedKeyResult;
  }

  async removeKeyResult(
    companyId: string,
    okrId: string,
    keyResultId: string,
    userId: string
  ): Promise<void> {
    const objective = await this.getObjective(companyId, okrId);
    if (!objective) {
      throw new Error('Objective not found');
    }

    const updatedKeyResults = objective.keyResults
      .filter((kr) => kr.id !== keyResultId)
      .map((kr, i) => ({ ...kr, order: i }));

    // Recalculate scores
    const objectiveScore = calculateObjectiveScore(updatedKeyResults);
    const objectiveProgress = Math.round(objectiveScore * 100);

    await updateDoc(getOKRRef(companyId, okrId), {
      keyResults: updatedKeyResults,
      score: objectiveScore,
      progress: objectiveProgress,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  // ==========================================================================
  // MILESTONE MANAGEMENT
  // ==========================================================================

  async completeMilestone(
    companyId: string,
    okrId: string,
    keyResultId: string,
    milestoneId: string,
    userId: string,
    userName?: string
  ): Promise<KeyResultMilestone> {
    const objective = await this.getObjective(companyId, okrId);
    if (!objective) {
      throw new Error('Objective not found');
    }

    const krIndex = objective.keyResults.findIndex((kr) => kr.id === keyResultId);
    if (krIndex === -1) {
      throw new Error('Key result not found');
    }

    const keyResult = objective.keyResults[krIndex];
    const milestoneIndex = keyResult.milestones.findIndex((m) => m.id === milestoneId);
    if (milestoneIndex === -1) {
      throw new Error('Milestone not found');
    }

    const now = Timestamp.now();
    const updatedMilestone: KeyResultMilestone = {
      ...keyResult.milestones[milestoneIndex],
      isComplete: true,
      completedAt: now,
      completedBy: userId,
      completedByName: userName,
    };

    const updatedMilestones = [...keyResult.milestones];
    updatedMilestones[milestoneIndex] = updatedMilestone;

    // Update key result current value based on completed milestones
    const completedCount = updatedMilestones.filter((m) => m.isComplete).length;

    const updatedKeyResult: KeyResult = {
      ...keyResult,
      milestones: updatedMilestones,
      currentValue: completedCount,
    };
    updatedKeyResult.score = calculateKeyResultScore(updatedKeyResult);
    updatedKeyResult.progress = calculateKeyResultProgress(updatedKeyResult);

    if (updatedKeyResult.score >= 1.0) {
      updatedKeyResult.isComplete = true;
      updatedKeyResult.completedAt = now;
    }

    const updatedKeyResults = [...objective.keyResults];
    updatedKeyResults[krIndex] = updatedKeyResult;

    // Recalculate objective
    const objectiveScore = calculateObjectiveScore(updatedKeyResults);
    const objectiveProgress = Math.round(objectiveScore * 100);

    await updateDoc(getOKRRef(companyId, okrId), {
      keyResults: updatedKeyResults,
      score: objectiveScore,
      progress: objectiveProgress,
      updatedAt: now,
      updatedBy: userId,
    });

    return updatedMilestone;
  }

  // ==========================================================================
  // CHECK-INS
  // ==========================================================================

  async createCheckIn(
    companyId: string,
    okrId: string,
    input: CheckInInput,
    userId: string,
    userName?: string
  ): Promise<KeyResultCheckIn> {
    const objective = await this.getObjective(companyId, okrId);
    if (!objective) {
      throw new Error('Objective not found');
    }

    const krIndex = objective.keyResults.findIndex((kr) => kr.id === input.keyResultId);
    if (krIndex === -1) {
      throw new Error('Key result not found');
    }

    const keyResult = objective.keyResults[krIndex];
    const now = Timestamp.now();
    const previousScore = keyResult.score;

    // Create check-in record
    const checkIn: KeyResultCheckIn = {
      id: generateId(),
      keyResultId: input.keyResultId,
      objectiveId: okrId,
      date: now,
      previousValue: keyResult.currentValue,
      newValue: input.newValue,
      previousScore,
      newScore: 0, // Will be calculated
      confidence: input.confidence,
      note: input.note,
      blockers: input.blockers || [],
      wins: input.wins || [],
      createdBy: userId,
      createdByName: userName,
      createdAt: now,
    };

    // Update key result
    const updatedKeyResult: KeyResult = {
      ...keyResult,
      currentValue: input.newValue,
      confidence: input.confidence,
      confidenceNote: input.note,
      checkIns: [...keyResult.checkIns, checkIn],
    };
    updatedKeyResult.score = calculateKeyResultScore(updatedKeyResult);
    updatedKeyResult.progress = calculateKeyResultProgress(updatedKeyResult);
    checkIn.newScore = updatedKeyResult.score;

    if (updatedKeyResult.score >= 1.0 && !updatedKeyResult.isComplete) {
      updatedKeyResult.isComplete = true;
      updatedKeyResult.completedAt = now;
    }

    const updatedKeyResults = [...objective.keyResults];
    updatedKeyResults[krIndex] = updatedKeyResult;

    // Recalculate objective
    const objectiveScore = calculateObjectiveScore(updatedKeyResults);
    const objectiveProgress = Math.round(objectiveScore * 100);

    // Calculate next check-in date
    const checkInDays = {
      daily: 1,
      weekly: 7,
      bi_weekly: 14,
      monthly: 30,
    }[objective.checkInFrequency] || 7;
    const nextCheckIn = new Date(now.toDate().getTime() + checkInDays * 24 * 60 * 60 * 1000);

    await updateDoc(getOKRRef(companyId, okrId), {
      keyResults: updatedKeyResults,
      score: objectiveScore,
      progress: objectiveProgress,
      lastCheckInDate: now,
      nextCheckInDate: Timestamp.fromDate(nextCheckIn),
      checkInCount: (objective.checkInCount || 0) + 1,
      updatedAt: now,
      updatedBy: userId,
    });

    return checkIn;
  }

  async bulkCheckIn(
    companyId: string,
    okrId: string,
    checkIns: CheckInInput[],
    userId: string,
    userName?: string
  ): Promise<KeyResultCheckIn[]> {
    const results: KeyResultCheckIn[] = [];
    for (const input of checkIns) {
      const checkIn = await this.createCheckIn(companyId, okrId, input, userId, userName);
      results.push(checkIn);
    }
    return results;
  }

  // ==========================================================================
  // CYCLE MANAGEMENT
  // ==========================================================================

  async createCycle(
    companyId: string,
    input: CreateCycleInput,
    userId: string
  ): Promise<OKRCyclePeriod> {
    const colRef = getCyclesCollection(companyId);
    const docRef = doc(colRef);
    const now = Timestamp.now();

    const defaultSettings: OKRCycleSettings = {
      allowStretchGoals: true,
      requireAlignment: true,
      minKeyResultsPerObjective: 1,
      maxKeyResultsPerObjective: 5,
      defaultCheckInFrequency: CHECK_IN_FREQUENCY.WEEKLY,
      autoRemindCheckIns: true,
      scoringMethod: OKR_SCORING_METHOD.AVERAGE,
      gracePeriodsEnabled: false,
    };

    const cycle: OKRCyclePeriod = {
      id: docRef.id,
      companyId,
      cycle: input.cycle,
      year: input.year,
      quarter: input.quarter,
      name: input.name,
      startDate: Timestamp.fromDate(input.startDate),
      endDate: Timestamp.fromDate(input.endDate),
      status: OKR_CYCLE_STATUS.PLANNING,
      planningDeadline: input.planningDeadline ? Timestamp.fromDate(input.planningDeadline) : undefined,
      reviewStartDate: input.reviewStartDate ? Timestamp.fromDate(input.reviewStartDate) : undefined,
      settings: { ...defaultSettings, ...input.settings },
      objectiveCount: 0,
      averageScore: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };

    await setDoc(docRef, cycle);
    return cycle;
  }

  async getCycle(companyId: string, cycleId: string): Promise<OKRCyclePeriod | null> {
    const docSnap = await getDoc(getCycleRef(companyId, cycleId));
    if (!docSnap.exists()) {
      return null;
    }
    return { id: docSnap.id, ...docSnap.data() } as OKRCyclePeriod;
  }

  async getCycles(companyId: string, year?: number): Promise<OKRCyclePeriod[]> {
    let q = query(getCyclesCollection(companyId), orderBy('startDate', 'desc'));
    if (year) {
      q = query(q, where('year', '==', year));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as OKRCyclePeriod[];
  }

  async getActiveCycle(companyId: string): Promise<OKRCyclePeriod | null> {
    const q = query(
      getCyclesCollection(companyId),
      where('status', '==', OKR_CYCLE_STATUS.ACTIVE),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as OKRCyclePeriod;
  }

  async updateCycle(
    companyId: string,
    cycleId: string,
    input: UpdateCycleInput,
    _userId: string
  ): Promise<OKRCyclePeriod> {
    const existing = await this.getCycle(companyId, cycleId);
    if (!existing) {
      throw new Error('Cycle not found');
    }

    const now = Timestamp.now();
    const updateData: Partial<OKRCyclePeriod> = {
      updatedAt: now,
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.planningDeadline !== undefined) {
      updateData.planningDeadline = input.planningDeadline
        ? Timestamp.fromDate(input.planningDeadline)
        : undefined;
    }
    if (input.reviewStartDate !== undefined) {
      updateData.reviewStartDate = input.reviewStartDate
        ? Timestamp.fromDate(input.reviewStartDate)
        : undefined;
    }
    if (input.settings) {
      updateData.settings = { ...existing.settings, ...input.settings };
    }

    await updateDoc(getCycleRef(companyId, cycleId), updateData);
    return (await this.getCycle(companyId, cycleId))!;
  }

  async activateCycle(companyId: string, cycleId: string, activatorId: string): Promise<OKRCyclePeriod> {
    // Close any existing active cycle
    const activeCycle = await this.getActiveCycle(companyId);
    if (activeCycle && activeCycle.id !== cycleId) {
      await this.updateCycle(companyId, activeCycle.id, { status: OKR_CYCLE_STATUS.CLOSED }, activatorId);
    }

    return this.updateCycle(companyId, cycleId, { status: OKR_CYCLE_STATUS.ACTIVE }, activatorId);
  }

  private async updateCycleStats(companyId: string, cycleId: string): Promise<void> {
    const objectives = await this.getObjectives(companyId, { cycleId });
    const activeObjectives = objectives.filter((o) => o.status === OKR_STATUS.ACTIVE);

    const objectiveCount = objectives.length;
    const averageScore =
      activeObjectives.length > 0
        ? activeObjectives.reduce((sum, o) => sum + o.score, 0) / activeObjectives.length
        : 0;

    await updateDoc(getCycleRef(companyId, cycleId), {
      objectiveCount,
      averageScore,
      updatedAt: Timestamp.now(),
    });
  }

  // ==========================================================================
  // ALIGNMENT TREE
  // ==========================================================================

  async getAlignmentTree(companyId: string, cycleId: string): Promise<OKRTreeNode[]> {
    const allOKRs = await this.getObjectives(companyId, { cycleId });

    const buildTree = (parentId: string | null | undefined, level: number): OKRTreeNode[] => {
      return allOKRs
        .filter((okr) => (okr.parentOKRId || null) === parentId)
        .sort((a, b) => {
          // Sort by level order first, then by title
          const levelOrder = ['company', 'subsidiary', 'department', 'team', 'individual'];
          return levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level);
        })
        .map((okr) => ({
          objective: okr,
          level,
          children: buildTree(okr.id, level + 1),
        }));
    };

    return buildTree(null, 0);
  }

  // ==========================================================================
  // ANALYTICS
  // ==========================================================================

  async getAnalytics(companyId: string, cycleId: string): Promise<OKRAnalytics> {
    const cycle = await this.getCycle(companyId, cycleId);
    if (!cycle) {
      throw new Error('Cycle not found');
    }

    const objectives = await this.getObjectives(companyId, { cycleId });
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - OKR_DEFAULTS.STALE_OKR_DAYS * 24 * 60 * 60 * 1000);

    const analytics: OKRAnalytics = {
      companyId,
      cycleId,
      cycleName: cycle.name,
      asOfDate: Timestamp.now(),
      totalObjectives: objectives.length,
      totalKeyResults: objectives.reduce((sum, o) => sum + o.keyResults.length, 0),
      totalCheckIns: objectives.reduce(
        (sum, o) => sum + o.keyResults.reduce((s, kr) => s + kr.checkIns.length, 0),
        0
      ),
      objectivesByStatus: {} as Record<string, number>,
      objectivesByLevel: {} as Record<string, number>,
      averageScore: 0,
      medianScore: 0,
      scoreDistribution: { stretch: 0, target: 0, partial: 0, miss: 0 },
      alignedToStrategyCount: 0,
      alignedToParentCount: 0,
      orphanedCount: 0,
      onTrackCount: 0,
      atRiskCount: 0,
      offTrackCount: 0,
      averageCheckInsPerOKR: 0,
      staleOKRsCount: 0,
      activeContributors: 0,
    };

    const scores: number[] = [];
    const contributors = new Set<string>();

    objectives.forEach((okr) => {
      // By status
      analytics.objectivesByStatus[okr.status] =
        (analytics.objectivesByStatus[okr.status] || 0) + 1;

      // By level
      analytics.objectivesByLevel[okr.level] =
        (analytics.objectivesByLevel[okr.level] || 0) + 1;

      // Score distribution
      if (okr.status === OKR_STATUS.ACTIVE) {
        scores.push(okr.score);
        // Classify score into distribution buckets
        if (okr.score >= 0.7) analytics.scoreDistribution.stretch++;
        else if (okr.score >= 0.5) analytics.scoreDistribution.target++;
        else if (okr.score >= 0.3) analytics.scoreDistribution.partial++;
        else analytics.scoreDistribution.miss++;
      }

      // Alignment
      if (okr.alignedStrategyPillarId || okr.alignedStrategyObjectiveId) {
        analytics.alignedToStrategyCount++;
      }
      if (okr.parentOKRId) {
        analytics.alignedToParentCount++;
      }
      if (!okr.parentOKRId && okr.level !== 'company') {
        analytics.orphanedCount++;
      }

      // Confidence
      const confidence = getOverallConfidence(okr.keyResults);
      if (confidence === CONFIDENCE_LEVEL.ON_TRACK) analytics.onTrackCount++;
      else if (confidence === CONFIDENCE_LEVEL.AT_RISK) analytics.atRiskCount++;
      else analytics.offTrackCount++;

      // Stale check
      if (okr.status === OKR_STATUS.ACTIVE) {
        if (okr.lastCheckInDate && okr.lastCheckInDate.toDate() < twoWeeksAgo) {
          analytics.staleOKRsCount++;
        } else if (!okr.lastCheckInDate) {
          analytics.staleOKRsCount++;
        }
      }

      // Contributors
      contributors.add(okr.ownerId);
    });

    // Calculate averages
    analytics.averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    analytics.medianScore = scores.length > 0 ? scores.sort()[Math.floor(scores.length / 2)] : 0;
    analytics.averageCheckInsPerOKR =
      objectives.length > 0 ? analytics.totalCheckIns / objectives.length : 0;
    analytics.activeContributors = contributors.size;

    return analytics;
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private async addChildToParent(companyId: string, parentId: string, childId: string): Promise<void> {
    const parent = await this.getObjective(companyId, parentId);
    if (parent) {
      await updateDoc(getOKRRef(companyId, parentId), {
        childOKRIds: [...(parent.childOKRIds || []), childId],
      });
    }
  }

  private async removeChildFromParent(companyId: string, parentId: string, childId: string): Promise<void> {
    const parent = await this.getObjective(companyId, parentId);
    if (parent) {
      await updateDoc(getOKRRef(companyId, parentId), {
        childOKRIds: (parent.childOKRIds || []).filter((id) => id !== childId),
      });
    }
  }
}

// Export singleton instance
export const okrService = new OKRService();
