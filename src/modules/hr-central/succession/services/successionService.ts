// ============================================================================
// SUCCESSION SERVICE
// DawinOS v2.0 - HR Module
// Service for Succession Planning & Talent Pipeline
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import {
  CriticalRole,
  SuccessorCandidate,
  DevelopmentPlan,
  DevelopmentAction,
  TalentPool,
  TalentPoolMember,
  SuccessionPlan,
  SuccessionAnalytics,
  CriticalRoleFilters,
  DevelopmentPlanFilters,
} from '../types/succession.types';
import {
  CriticalRoleInput,
  SuccessorCandidateInput,
  DevelopmentPlanInput,
  TalentPoolInput,
  TalentPoolMemberInput,
  SuccessionPlanInput,
} from '../schemas/succession.schemas';
import {
  SUCCESSION_RISK_LEVELS,
  READINESS_LEVELS,
  NINE_BOX_MAPPING,
  NINE_BOX_CATEGORIES,
  CRITICAL_ROLES_COLLECTION,
  DEVELOPMENT_PLANS_COLLECTION,
  TALENT_POOLS_COLLECTION,
  SUCCESSION_PLANS_COLLECTION,
  NineBoxCategory,
  ReadinessLevel,
  ActionStatus,
  SuccessionReviewCycle,
  SuccessionPlanStatus,
} from '../constants/succession.constants';

// ============================================================================
// COLLECTION REFERENCES
// ============================================================================

const getCriticalRolesCollection = (companyId: string) =>
  collection(db, 'companies', companyId, CRITICAL_ROLES_COLLECTION);

const getDevelopmentPlansCollection = (companyId: string) =>
  collection(db, 'companies', companyId, DEVELOPMENT_PLANS_COLLECTION);

const getTalentPoolsCollection = (companyId: string) =>
  collection(db, 'companies', companyId, TALENT_POOLS_COLLECTION);

const getSuccessionPlansCollection = (companyId: string) =>
  collection(db, 'companies', companyId, SUCCESSION_PLANS_COLLECTION);

// ============================================================================
// CRITICAL ROLE OPERATIONS
// ============================================================================

export const createCriticalRole = async (
  companyId: string,
  input: CriticalRoleInput,
  incumbentName?: string,
  userId?: string
): Promise<CriticalRole> => {
  const now = Timestamp.now();

  // Calculate criticality score (weighted average scaled to 0-100)
  const criticalityScore = Math.round(
    input.criticalityFactors.reduce(
      (sum, f) => sum + (f.score * f.weight / 100) * 20,
      0
    )
  );

  const data: Omit<CriticalRole, 'id'> = {
    companyId,
    positionId: input.positionId,
    positionTitle: input.positionTitle,
    departmentId: input.departmentId,
    departmentName: input.departmentName,
    criticalityLevel: input.criticalityLevel,
    criticalityFactors: input.criticalityFactors,
    criticalityScore,
    incumbentId: input.incumbentId,
    incumbentName,
    expectedVacancyDate: input.expectedVacancyDate
      ? Timestamp.fromDate(input.expectedVacancyDate)
      : undefined,
    vacancyReason: input.vacancyReason,
    successors: [],
    successionRisk: SUCCESSION_RISK_LEVELS.CRITICAL,
    benchStrength: 0,
    emergencySuccessorId: input.emergencySuccessorId,
    notes: input.notes,
    lastReviewDate: now,
    nextReviewDate: Timestamp.fromDate(
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    ),
    reviewedBy: userId,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(getCriticalRolesCollection(companyId), data);
  return { id: docRef.id, ...data };
};

export const getCriticalRole = async (
  companyId: string,
  roleId: string
): Promise<CriticalRole | null> => {
  const docRef = doc(getCriticalRolesCollection(companyId), roleId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as CriticalRole;
};

export const getCriticalRoles = async (
  companyId: string,
  filters?: CriticalRoleFilters
): Promise<CriticalRole[]> => {
  const constraints = [where('isActive', '==', true)];

  if (filters?.departmentId) {
    constraints.push(where('departmentId', '==', filters.departmentId));
  }
  if (filters?.criticalityLevel) {
    constraints.push(where('criticalityLevel', '==', filters.criticalityLevel));
  }
  if (filters?.successionRisk) {
    constraints.push(where('successionRisk', '==', filters.successionRisk));
  }

  const q = query(
    getCriticalRolesCollection(companyId),
    ...constraints,
    orderBy('criticalityScore', 'desc')
  );

  const snapshot = await getDocs(q);
  let roles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CriticalRole[];

  // Client-side filter for hasSuccessor
  if (filters?.hasSuccessor !== undefined) {
    roles = roles.filter(r =>
      filters.hasSuccessor ? r.successors.length > 0 : r.successors.length === 0
    );
  }

  return roles;
};

export const updateCriticalRole = async (
  companyId: string,
  roleId: string,
  updates: Partial<CriticalRoleInput>
): Promise<void> => {
  const docRef = doc(getCriticalRolesCollection(companyId), roleId);

  const updateData: Record<string, unknown> = {
    ...updates,
    updatedAt: Timestamp.now(),
  };

  // Recalculate criticality score if factors changed
  if (updates.criticalityFactors) {
    updateData.criticalityScore = Math.round(
      updates.criticalityFactors.reduce(
        (sum, f) => sum + (f.score * f.weight / 100) * 20,
        0
      )
    );
  }

  if (updates.expectedVacancyDate) {
    updateData.expectedVacancyDate = Timestamp.fromDate(updates.expectedVacancyDate);
  }

  await updateDoc(docRef, updateData);
};

export const deleteCriticalRole = async (
  companyId: string,
  roleId: string
): Promise<void> => {
  const docRef = doc(getCriticalRolesCollection(companyId), roleId);
  await updateDoc(docRef, {
    isActive: false,
    updatedAt: Timestamp.now(),
  });
};

// ============================================================================
// SUCCESSOR CANDIDATE OPERATIONS
// ============================================================================

export const addSuccessorCandidate = async (
  companyId: string,
  roleId: string,
  input: SuccessorCandidateInput,
  userId: string
): Promise<CriticalRole> => {
  const now = Timestamp.now();
  const roleRef = doc(getCriticalRolesCollection(companyId), roleId);
  const roleDoc = await getDoc(roleRef);

  if (!roleDoc.exists()) {
    throw new Error('Critical role not found');
  }

  const role = { id: roleDoc.id, ...roleDoc.data() } as CriticalRole;

  // Calculate readiness score
  const assessment = input.readinessAssessment;
  const scores = [
    assessment.leadershipCompetencies,
    assessment.technicalExpertise,
    assessment.businessAcumen,
    assessment.stakeholderManagement,
    assessment.strategicThinking,
    assessment.teamManagement,
  ];
  if (assessment.ugandaMarketKnowledge !== undefined) {
    scores.push(assessment.ugandaMarketKnowledge);
  }
  const readinessScore = Math.round(
    scores.reduce((sum, s) => sum + s, 0) / scores.length
  );

  // Calculate 9-box category
  const performanceLevel = input.performanceRating >= 4 ? 'high'
    : input.performanceRating >= 3 ? 'medium' : 'low';
  const nineBoxKey = `${performanceLevel}-${input.potentialRating}`;
  const nineBoxCategory = NINE_BOX_MAPPING[nineBoxKey] || NINE_BOX_CATEGORIES.CORE_PLAYER;

  const successor: SuccessorCandidate = {
    id: `succ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    employeeId: input.employeeId,
    employeeName: input.employeeName,
    currentPosition: input.currentPosition,
    currentDepartment: input.currentDepartment,
    readinessLevel: input.readinessLevel,
    readinessScore,
    readinessAssessment: {
      ...assessment,
      overallReadiness: readinessScore,
    },
    performanceRating: input.performanceRating,
    potentialRating: input.potentialRating,
    nineBoxCategory,
    competencyGaps: input.competencyGaps?.map(g => ({
      ...g,
      gapSize: g.requiredLevel - g.currentLevel,
      developmentActions: g.developmentActions || [],
    })) || [],
    interestedInRole: input.interestedInRole,
    willingToRelocate: input.willingToRelocate,
    flightRisk: input.flightRisk,
    flightRiskFactors: [],
    rank: input.rank,
    lastAssessedDate: now,
    assessedBy: userId,
  };

  // Add successor and sort by rank
  const successors = [...role.successors, successor].sort((a, b) => a.rank - b.rank);

  // Recalculate succession risk
  const readyNow = successors.filter(s => s.readinessLevel === READINESS_LEVELS.READY_NOW);
  const ready1Year = successors.filter(s => s.readinessLevel === READINESS_LEVELS.READY_1_YEAR);

  const successionRisk = readyNow.length > 0
    ? SUCCESSION_RISK_LEVELS.LOW
    : ready1Year.length > 0
      ? SUCCESSION_RISK_LEVELS.MEDIUM
      : successors.length > 0
        ? SUCCESSION_RISK_LEVELS.HIGH
        : SUCCESSION_RISK_LEVELS.CRITICAL;

  await updateDoc(roleRef, {
    successors,
    successionRisk,
    benchStrength: readyNow.length,
    updatedAt: now,
  });

  return {
    ...role,
    successors,
    successionRisk,
    benchStrength: readyNow.length,
  };
};

export const updateSuccessorCandidate = async (
  companyId: string,
  roleId: string,
  successorId: string,
  updates: Partial<SuccessorCandidateInput>,
  userId: string
): Promise<CriticalRole> => {
  const now = Timestamp.now();
  const roleRef = doc(getCriticalRolesCollection(companyId), roleId);
  const roleDoc = await getDoc(roleRef);

  if (!roleDoc.exists()) {
    throw new Error('Critical role not found');
  }

  const role = { id: roleDoc.id, ...roleDoc.data() } as CriticalRole;
  const successorIndex = role.successors.findIndex(s => s.id === successorId);

  if (successorIndex === -1) {
    throw new Error('Successor not found');
  }

  const currentSuccessor = role.successors[successorIndex];
  
  // Process competency gaps if provided
  const competencyGaps = updates.competencyGaps
    ? updates.competencyGaps.map(g => ({
        ...g,
        gapSize: g.requiredLevel - g.currentLevel,
        developmentActions: g.developmentActions || [],
      }))
    : currentSuccessor.competencyGaps;

  const updatedSuccessor: SuccessorCandidate = {
    ...currentSuccessor,
    employeeId: updates.employeeId ?? currentSuccessor.employeeId,
    employeeName: updates.employeeName ?? currentSuccessor.employeeName,
    currentPosition: updates.currentPosition ?? currentSuccessor.currentPosition,
    currentDepartment: updates.currentDepartment ?? currentSuccessor.currentDepartment,
    readinessLevel: updates.readinessLevel ?? currentSuccessor.readinessLevel,
    performanceRating: updates.performanceRating ?? currentSuccessor.performanceRating,
    potentialRating: updates.potentialRating ?? currentSuccessor.potentialRating,
    interestedInRole: updates.interestedInRole ?? currentSuccessor.interestedInRole,
    willingToRelocate: updates.willingToRelocate ?? currentSuccessor.willingToRelocate,
    flightRisk: updates.flightRisk ?? currentSuccessor.flightRisk,
    rank: updates.rank ?? currentSuccessor.rank,
    competencyGaps,
    readinessAssessment: updates.readinessAssessment
      ? { ...updates.readinessAssessment, overallReadiness: currentSuccessor.readinessAssessment.overallReadiness }
      : currentSuccessor.readinessAssessment,
    lastAssessedDate: now,
    assessedBy: userId,
  };

  // Recalculate if assessment changed
  if (updates.readinessAssessment) {
    const assessment = updates.readinessAssessment;
    const scores = [
      assessment.leadershipCompetencies,
      assessment.technicalExpertise,
      assessment.businessAcumen,
      assessment.stakeholderManagement,
      assessment.strategicThinking,
      assessment.teamManagement,
    ];
    if (assessment.ugandaMarketKnowledge !== undefined) {
      scores.push(assessment.ugandaMarketKnowledge);
    }
    updatedSuccessor.readinessScore = Math.round(
      scores.reduce((sum, s) => sum + s, 0) / scores.length
    );
    updatedSuccessor.readinessAssessment = {
      ...assessment,
      overallReadiness: updatedSuccessor.readinessScore,
    };
  }

  // Recalculate 9-box if ratings changed
  if (updates.performanceRating || updates.potentialRating) {
    const perfRating = updates.performanceRating || currentSuccessor.performanceRating;
    const potRating = updates.potentialRating || currentSuccessor.potentialRating;
    const performanceLevel = perfRating >= 4 ? 'high' : perfRating >= 3 ? 'medium' : 'low';
    const nineBoxKey = `${performanceLevel}-${potRating}`;
    updatedSuccessor.nineBoxCategory = NINE_BOX_MAPPING[nineBoxKey] || NINE_BOX_CATEGORIES.CORE_PLAYER;
  }

  const successors = [...role.successors];
  successors[successorIndex] = updatedSuccessor;
  successors.sort((a, b) => a.rank - b.rank);

  // Recalculate succession risk
  const readyNow = successors.filter(s => s.readinessLevel === READINESS_LEVELS.READY_NOW);
  const ready1Year = successors.filter(s => s.readinessLevel === READINESS_LEVELS.READY_1_YEAR);

  const successionRisk = readyNow.length > 0
    ? SUCCESSION_RISK_LEVELS.LOW
    : ready1Year.length > 0
      ? SUCCESSION_RISK_LEVELS.MEDIUM
      : successors.length > 0
        ? SUCCESSION_RISK_LEVELS.HIGH
        : SUCCESSION_RISK_LEVELS.CRITICAL;

  await updateDoc(roleRef, {
    successors,
    successionRisk,
    benchStrength: readyNow.length,
    updatedAt: now,
  });

  return {
    ...role,
    successors,
    successionRisk,
    benchStrength: readyNow.length,
  };
};

export const removeSuccessorCandidate = async (
  companyId: string,
  roleId: string,
  successorId: string
): Promise<CriticalRole> => {
  const now = Timestamp.now();
  const roleRef = doc(getCriticalRolesCollection(companyId), roleId);
  const roleDoc = await getDoc(roleRef);

  if (!roleDoc.exists()) {
    throw new Error('Critical role not found');
  }

  const role = { id: roleDoc.id, ...roleDoc.data() } as CriticalRole;
  const successors = role.successors.filter(s => s.id !== successorId);

  // Recalculate succession risk
  const readyNow = successors.filter(s => s.readinessLevel === READINESS_LEVELS.READY_NOW);
  const ready1Year = successors.filter(s => s.readinessLevel === READINESS_LEVELS.READY_1_YEAR);

  const successionRisk = readyNow.length > 0
    ? SUCCESSION_RISK_LEVELS.LOW
    : ready1Year.length > 0
      ? SUCCESSION_RISK_LEVELS.MEDIUM
      : successors.length > 0
        ? SUCCESSION_RISK_LEVELS.HIGH
        : SUCCESSION_RISK_LEVELS.CRITICAL;

  await updateDoc(roleRef, {
    successors,
    successionRisk,
    benchStrength: readyNow.length,
    updatedAt: now,
  });

  return {
    ...role,
    successors,
    successionRisk,
    benchStrength: readyNow.length,
  };
};

// ============================================================================
// DEVELOPMENT PLAN OPERATIONS
// ============================================================================

export const createDevelopmentPlan = async (
  companyId: string,
  input: DevelopmentPlanInput,
  employeeName: string,
  ownerId: string
): Promise<DevelopmentPlan> => {
  const now = Timestamp.now();

  const actions: DevelopmentAction[] = input.actions.map((a, i) => ({
    id: `action_${i + 1}_${Date.now()}`,
    type: a.type,
    title: a.title,
    description: a.description,
    targetCompetency: a.targetCompetency,
    startDate: Timestamp.fromDate(a.startDate),
    endDate: Timestamp.fromDate(a.endDate),
    status: 'planned' as ActionStatus,
    progress: 0,
    resources: a.resources,
    estimatedCost: a.estimatedCost,
    expectedOutcome: a.expectedOutcome,
  }));

  const data: Omit<DevelopmentPlan, 'id'> = {
    companyId,
    employeeId: input.employeeId,
    employeeName,
    targetRoleId: input.targetRoleId,
    targetRoleTitle: input.targetRoleTitle,
    objective: input.objective,
    targetReadiness: input.targetReadiness,
    targetDate: Timestamp.fromDate(input.targetDate),
    actions,
    overallProgress: 0,
    status: 'draft',
    ownerId,
    sponsorId: input.sponsorId,
    mentorId: input.mentorId,
    nextReviewDate: Timestamp.fromDate(
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    ),
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(getDevelopmentPlansCollection(companyId), data);
  return { id: docRef.id, ...data };
};

export const getDevelopmentPlan = async (
  companyId: string,
  planId: string
): Promise<DevelopmentPlan | null> => {
  const docRef = doc(getDevelopmentPlansCollection(companyId), planId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as DevelopmentPlan;
};

export const getDevelopmentPlans = async (
  companyId: string,
  filters?: DevelopmentPlanFilters
): Promise<DevelopmentPlan[]> => {
  const constraints = [];

  if (filters?.employeeId) {
    constraints.push(where('employeeId', '==', filters.employeeId));
  }
  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }
  if (filters?.targetRoleId) {
    constraints.push(where('targetRoleId', '==', filters.targetRoleId));
  }

  const q = constraints.length > 0
    ? query(getDevelopmentPlansCollection(companyId), ...constraints, orderBy('createdAt', 'desc'))
    : query(getDevelopmentPlansCollection(companyId), orderBy('createdAt', 'desc'));

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DevelopmentPlan[];
};

export const updateDevelopmentPlan = async (
  companyId: string,
  planId: string,
  updates: Partial<DevelopmentPlanInput>
): Promise<void> => {
  const docRef = doc(getDevelopmentPlansCollection(companyId), planId);

  const updateData: Record<string, unknown> = {
    ...updates,
    updatedAt: Timestamp.now(),
  };

  if (updates.targetDate) {
    updateData.targetDate = Timestamp.fromDate(updates.targetDate);
  }

  await updateDoc(docRef, updateData);
};

export const updateDevelopmentActionProgress = async (
  companyId: string,
  planId: string,
  actionId: string,
  progress: number,
  status?: ActionStatus,
  actualOutcome?: string
): Promise<DevelopmentPlan> => {
  const now = Timestamp.now();
  const planRef = doc(getDevelopmentPlansCollection(companyId), planId);
  const planDoc = await getDoc(planRef);

  if (!planDoc.exists()) {
    throw new Error('Development plan not found');
  }

  const plan = { id: planDoc.id, ...planDoc.data() } as DevelopmentPlan;

  const updatedActions = plan.actions.map(a => {
    if (a.id === actionId) {
      return {
        ...a,
        progress,
        status: status || a.status,
        actualOutcome: actualOutcome || a.actualOutcome,
        completedAt: status === 'completed' ? now : a.completedAt,
      };
    }
    return a;
  });

  // Recalculate overall progress
  const overallProgress = Math.round(
    updatedActions.reduce((sum, a) => sum + a.progress, 0) / updatedActions.length
  );

  // Update plan status if all actions completed
  let planStatus = plan.status;
  if (updatedActions.every(a => a.status === 'completed')) {
    planStatus = 'completed';
  } else if (updatedActions.some(a => a.status === 'in_progress')) {
    planStatus = 'active';
  }

  await updateDoc(planRef, {
    actions: updatedActions,
    overallProgress,
    status: planStatus,
    updatedAt: now,
  });

  return {
    ...plan,
    actions: updatedActions,
    overallProgress,
    status: planStatus,
  };
};

export const activateDevelopmentPlan = async (
  companyId: string,
  planId: string
): Promise<void> => {
  const docRef = doc(getDevelopmentPlansCollection(companyId), planId);
  await updateDoc(docRef, {
    status: 'active',
    updatedAt: Timestamp.now(),
  });
};

export const deleteDevelopmentPlan = async (
  companyId: string,
  planId: string
): Promise<void> => {
  const docRef = doc(getDevelopmentPlansCollection(companyId), planId);
  await deleteDoc(docRef);
};

// ============================================================================
// TALENT POOL OPERATIONS
// ============================================================================

const calculateNextReviewDate = (cycle: SuccessionReviewCycle): Timestamp => {
  const now = new Date();
  let nextDate: Date;

  switch (cycle) {
    case 'quarterly':
      nextDate = new Date(now.setMonth(now.getMonth() + 3));
      break;
    case 'semi_annual':
      nextDate = new Date(now.setMonth(now.getMonth() + 6));
      break;
    case 'annual':
      nextDate = new Date(now.setFullYear(now.getFullYear() + 1));
      break;
    default:
      nextDate = new Date(now.setMonth(now.getMonth() + 3));
  }

  return Timestamp.fromDate(nextDate);
};

export const createTalentPool = async (
  companyId: string,
  input: TalentPoolInput,
  ownerId: string,
  ownerName: string
): Promise<TalentPool> => {
  const now = Timestamp.now();

  const data: Omit<TalentPool, 'id'> = {
    companyId,
    name: input.name,
    description: input.description,
    poolType: input.poolType,
    targetLevel: input.targetLevel,
    members: [],
    memberCount: 0,
    averageReadiness: 0,
    readyNowCount: 0,
    ready1YearCount: 0,
    ownerId,
    ownerName,
    reviewCycle: input.reviewCycle,
    lastReviewDate: now,
    nextReviewDate: calculateNextReviewDate(input.reviewCycle),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(getTalentPoolsCollection(companyId), data);
  return { id: docRef.id, ...data };
};

export const getTalentPool = async (
  companyId: string,
  poolId: string
): Promise<TalentPool | null> => {
  const docRef = doc(getTalentPoolsCollection(companyId), poolId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as TalentPool;
};

export const getTalentPools = async (companyId: string): Promise<TalentPool[]> => {
  const q = query(
    getTalentPoolsCollection(companyId),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TalentPool[];
};

export const addTalentPoolMember = async (
  companyId: string,
  poolId: string,
  input: TalentPoolMemberInput,
  nineBoxCategory: NineBoxCategory,
  readinessLevel: ReadinessLevel,
  userId: string
): Promise<TalentPool> => {
  const now = Timestamp.now();
  const poolRef = doc(getTalentPoolsCollection(companyId), poolId);
  const poolDoc = await getDoc(poolRef);

  if (!poolDoc.exists()) {
    throw new Error('Talent pool not found');
  }

  const pool = { id: poolDoc.id, ...poolDoc.data() } as TalentPool;

  // Check if member already exists
  if (pool.members.some(m => m.employeeId === input.employeeId)) {
    throw new Error('Employee is already in this talent pool');
  }

  const member: TalentPoolMember = {
    employeeId: input.employeeId,
    employeeName: input.employeeName,
    currentPosition: input.currentPosition,
    nineBoxCategory,
    readinessLevel,
    addedDate: now,
    addedBy: userId,
    lastAssessedDate: now,
  };

  const members = [...pool.members, member];

  // Recalculate metrics
  const readyNowCount = members.filter(m => m.readinessLevel === READINESS_LEVELS.READY_NOW).length;
  const ready1YearCount = members.filter(m => m.readinessLevel === READINESS_LEVELS.READY_1_YEAR).length;

  await updateDoc(poolRef, {
    members,
    memberCount: members.length,
    readyNowCount,
    ready1YearCount,
    updatedAt: now,
  });

  return {
    ...pool,
    members,
    memberCount: members.length,
    readyNowCount,
    ready1YearCount,
  };
};

export const removeTalentPoolMember = async (
  companyId: string,
  poolId: string,
  employeeId: string
): Promise<TalentPool> => {
  const now = Timestamp.now();
  const poolRef = doc(getTalentPoolsCollection(companyId), poolId);
  const poolDoc = await getDoc(poolRef);

  if (!poolDoc.exists()) {
    throw new Error('Talent pool not found');
  }

  const pool = { id: poolDoc.id, ...poolDoc.data() } as TalentPool;
  const members = pool.members.filter(m => m.employeeId !== employeeId);

  // Recalculate metrics
  const readyNowCount = members.filter(m => m.readinessLevel === READINESS_LEVELS.READY_NOW).length;
  const ready1YearCount = members.filter(m => m.readinessLevel === READINESS_LEVELS.READY_1_YEAR).length;

  await updateDoc(poolRef, {
    members,
    memberCount: members.length,
    readyNowCount,
    ready1YearCount,
    updatedAt: now,
  });

  return {
    ...pool,
    members,
    memberCount: members.length,
    readyNowCount,
    ready1YearCount,
  };
};

export const deleteTalentPool = async (
  companyId: string,
  poolId: string
): Promise<void> => {
  const docRef = doc(getTalentPoolsCollection(companyId), poolId);
  await updateDoc(docRef, {
    isActive: false,
    updatedAt: Timestamp.now(),
  });
};

// ============================================================================
// SUCCESSION PLAN OPERATIONS
// ============================================================================

export const createSuccessionPlan = async (
  companyId: string,
  input: SuccessionPlanInput,
  roles: CriticalRole[]
): Promise<SuccessionPlan> => {
  const now = Timestamp.now();

  // Calculate metrics from roles
  const includedRoles = roles.filter(r => input.criticalRoleIds.includes(r.id));
  const rolesWithSuccessors = includedRoles.filter(r => r.successors.length > 0).length;
  const rolesWithReadyNow = includedRoles.filter(r =>
    r.successors.some(s => s.readinessLevel === READINESS_LEVELS.READY_NOW)
  ).length;
  const highRiskRoles = includedRoles.filter(r =>
    r.successionRisk === SUCCESSION_RISK_LEVELS.CRITICAL ||
    r.successionRisk === SUCCESSION_RISK_LEVELS.HIGH
  ).length;
  const totalBenchStrength = includedRoles.reduce((sum, r) => sum + r.benchStrength, 0);

  const data: Omit<SuccessionPlan, 'id'> = {
    companyId,
    name: input.name,
    description: input.description,
    fiscalYear: input.fiscalYear,
    scope: input.scope,
    scopeId: input.scopeId,
    criticalRoleIds: input.criticalRoleIds,
    totalCriticalRoles: includedRoles.length,
    rolesWithSuccessors,
    readyNowCoverage: includedRoles.length > 0
      ? Math.round((rolesWithReadyNow / includedRoles.length) * 100)
      : 0,
    averageBenchStrength: includedRoles.length > 0
      ? Math.round(totalBenchStrength / includedRoles.length * 10) / 10
      : 0,
    highRiskRoles,
    status: 'draft' as SuccessionPlanStatus,
    lastReviewDate: now,
    nextReviewDate: Timestamp.fromDate(
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    ),
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(getSuccessionPlansCollection(companyId), data);
  return { id: docRef.id, ...data };
};

export const getSuccessionPlans = async (companyId: string): Promise<SuccessionPlan[]> => {
  const q = query(
    getSuccessionPlansCollection(companyId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SuccessionPlan[];
};

export const updateSuccessionPlanStatus = async (
  companyId: string,
  planId: string,
  status: SuccessionPlanStatus,
  userId?: string
): Promise<void> => {
  const docRef = doc(getSuccessionPlansCollection(companyId), planId);
  const updates: Record<string, unknown> = {
    status,
    updatedAt: Timestamp.now(),
  };

  if (status === 'approved' && userId) {
    updates.approvedBy = userId;
    updates.approvedAt = Timestamp.now();
  }

  await updateDoc(docRef, updates);
};

// ============================================================================
// ANALYTICS OPERATIONS
// ============================================================================

export const getSuccessionAnalytics = async (
  companyId: string
): Promise<SuccessionAnalytics> => {
  const now = Timestamp.now();

  // Get critical roles
  const roles = await getCriticalRoles(companyId);

  // Calculate coverage metrics
  const rolesWithReadySuccessor = roles.filter(r =>
    r.successors.some(s => s.readinessLevel === READINESS_LEVELS.READY_NOW)
  ).length;

  const rolesWithPipelineSuccessor = roles.filter(r =>
    r.successors.length > 0 &&
    !r.successors.some(s => s.readinessLevel === READINESS_LEVELS.READY_NOW)
  ).length;

  const rolesWithNoSuccessor = roles.filter(r => r.successors.length === 0).length;

  // Risk distribution
  const criticalRiskCount = roles.filter(r => r.successionRisk === SUCCESSION_RISK_LEVELS.CRITICAL).length;
  const highRiskCount = roles.filter(r => r.successionRisk === SUCCESSION_RISK_LEVELS.HIGH).length;
  const mediumRiskCount = roles.filter(r => r.successionRisk === SUCCESSION_RISK_LEVELS.MEDIUM).length;
  const lowRiskCount = roles.filter(r => r.successionRisk === SUCCESSION_RISK_LEVELS.LOW).length;

  // 9-box distribution from all successors
  const allSuccessors = roles.flatMap(r => r.successors);
  const nineBoxDistribution = Object.values(NINE_BOX_CATEGORIES).reduce((acc, cat) => {
    acc[cat] = allSuccessors.filter(s => s.nineBoxCategory === cat).length;
    return acc;
  }, {} as Record<NineBoxCategory, number>);

  // Readiness distribution
  const readinessDistribution = Object.values(READINESS_LEVELS).reduce((acc, level) => {
    acc[level] = allSuccessors.filter(s => s.readinessLevel === level).length;
    return acc;
  }, {} as Record<ReadinessLevel, number>);

  // Development plans
  const plans = await getDevelopmentPlans(companyId);
  const activePlans = plans.filter(p => p.status === 'active');

  return {
    companyId,
    asOfDate: now,
    totalCriticalRoles: roles.length,
    rolesWithReadySuccessor,
    rolesWithPipelineSuccessor,
    rolesWithNoSuccessor,
    overallCoverage: roles.length > 0
      ? Math.round((rolesWithReadySuccessor / roles.length) * 100)
      : 0,
    criticalRiskCount,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    totalTalentPoolMembers: allSuccessors.length,
    nineBoxDistribution,
    readinessDistribution,
    activeDevelopmentPlans: activePlans.length,
    onTrackPlans: activePlans.filter(p => p.overallProgress >= 70).length,
    atRiskPlans: activePlans.filter(p => p.overallProgress < 30).length,
    coverageTrend: [],
    riskTrend: [],
  };
};
