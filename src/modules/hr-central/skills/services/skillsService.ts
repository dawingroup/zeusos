// ============================================================================
// SKILLS SERVICE
// DawinOS v2.0 - HR Module
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
  Skill,
  EmployeeSkillRecord,
  SkillRequirement,
  SkillGapAnalysis,
  TrainingProgram,
  TrainingEnrollment,
  SkillCertification,
  TrainingBudget,
  SkillFilters,
  TrainingProgramFilters,
} from '../types/skills.types';
import {
  SKILLS_COLLECTION,
  EMPLOYEE_SKILLS_COLLECTION,
  TRAINING_PROGRAMS_COLLECTION,
  TRAINING_ENROLLMENTS_COLLECTION,
  CERTIFICATIONS_COLLECTION,
  SKILL_REQUIREMENTS_COLLECTION,
  TRAINING_BUDGETS_COLLECTION,
  SKILL_LEVEL_VALUES,
  SkillLevel,
  GapPriority,
} from '../constants/skills.constants';
import {
  SkillInput,
  EmployeeSkillInput,
  SkillRequirementInput,
  TrainingProgramInput,
  CertificationInput,
  TrainingCompletionInput,
  TrainingFeedbackInput,
} from '../schemas/skills.schemas';

// ----------------------------------------------------------------------------
// SKILLS CRUD
// ----------------------------------------------------------------------------

export const createSkill = async (
  companyId: string,
  input: SkillInput
): Promise<Skill> => {
  const collectionRef = collection(db, SKILLS_COLLECTION);
  
  const skill: Omit<Skill, 'id'> = {
    companyId,
    name: input.name,
    description: input.description || '',
    category: input.category,
    isCore: input.isCore,
    relatedSkills: input.relatedSkills,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collectionRef, skill);
  return { id: docRef.id, ...skill };
};

export const getSkill = async (skillId: string): Promise<Skill | null> => {
  const docRef = doc(db, SKILLS_COLLECTION, skillId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as Skill;
};

export const getSkills = async (
  companyId: string,
  filters: SkillFilters = {}
): Promise<Skill[]> => {
  let q = query(
    collection(db, SKILLS_COLLECTION),
    where('companyId', '==', companyId),
    orderBy('category'),
    orderBy('name')
  );
  
  if (filters.category) {
    q = query(q, where('category', '==', filters.category));
  }
  
  if (filters.isCore !== undefined) {
    q = query(q, where('isCore', '==', filters.isCore));
  }
  
  const snapshot = await getDocs(q);
  let skills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Skill[];
  
  if (filters.search) {
    const search = filters.search.toLowerCase();
    skills = skills.filter(s => 
      s.name.toLowerCase().includes(search) || 
      s.description.toLowerCase().includes(search)
    );
  }
  
  return skills;
};

export const updateSkill = async (
  skillId: string,
  input: Partial<SkillInput>
): Promise<void> => {
  const docRef = doc(db, SKILLS_COLLECTION, skillId);
  await updateDoc(docRef, {
    ...input,
    updatedAt: Timestamp.now(),
  });
};

export const deleteSkill = async (skillId: string): Promise<void> => {
  const docRef = doc(db, SKILLS_COLLECTION, skillId);
  await deleteDoc(docRef);
};

// ----------------------------------------------------------------------------
// EMPLOYEE SKILLS
// ----------------------------------------------------------------------------

export const addEmployeeSkill = async (
  companyId: string,
  employeeId: string,
  input: EmployeeSkillInput,
  skillData: { name: string; category: string }
): Promise<EmployeeSkillRecord> => {
  const collectionRef = collection(db, EMPLOYEE_SKILLS_COLLECTION);
  
  const employeeSkill: Omit<EmployeeSkillRecord, 'id'> = {
    companyId,
    employeeId,
    skillId: input.skillId,
    skillName: skillData.name,
    category: skillData.category as EmployeeSkillRecord['category'],
    selfAssessedLevel: input.selfAssessedLevel,
    yearsExperience: input.yearsExperience,
    lastUsedDate: input.lastUsedDate,
    projectEvidence: input.projectEvidence,
    assessedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collectionRef, employeeSkill);
  return { id: docRef.id, ...employeeSkill };
};

export const getEmployeeSkills = async (
  companyId: string,
  employeeId: string
): Promise<EmployeeSkillRecord[]> => {
  const q = query(
    collection(db, EMPLOYEE_SKILLS_COLLECTION),
    where('companyId', '==', companyId),
    where('employeeId', '==', employeeId)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EmployeeSkillRecord[];
};

export const updateEmployeeSkill = async (
  skillRecordId: string,
  input: Partial<EmployeeSkillInput>
): Promise<void> => {
  const docRef = doc(db, EMPLOYEE_SKILLS_COLLECTION, skillRecordId);
  await updateDoc(docRef, {
    ...input,
    updatedAt: Timestamp.now(),
  });
};

export const verifyEmployeeSkill = async (
  skillRecordId: string,
  verifiedLevel: SkillLevel,
  verifierId: string
): Promise<void> => {
  const docRef = doc(db, EMPLOYEE_SKILLS_COLLECTION, skillRecordId);
  
  await updateDoc(docRef, {
    verifiedLevel,
    verifiedBy: verifierId,
    verifiedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
};

export const setManagerAssessment = async (
  skillRecordId: string,
  managerAssessedLevel: SkillLevel,
  _managerId: string
): Promise<void> => {
  const docRef = doc(db, EMPLOYEE_SKILLS_COLLECTION, skillRecordId);
  
  await updateDoc(docRef, {
    managerAssessedLevel,
    updatedAt: Timestamp.now(),
  });
};

export const deleteEmployeeSkill = async (skillRecordId: string): Promise<void> => {
  const docRef = doc(db, EMPLOYEE_SKILLS_COLLECTION, skillRecordId);
  await deleteDoc(docRef);
};

// ----------------------------------------------------------------------------
// SKILL REQUIREMENTS
// ----------------------------------------------------------------------------

export const setSkillRequirements = async (
  companyId: string,
  input: SkillRequirementInput,
  positionData: { title: string; departmentId: string }
): Promise<SkillRequirement> => {
  // Check if requirements already exist for this position
  const existingQuery = query(
    collection(db, SKILL_REQUIREMENTS_COLLECTION),
    where('companyId', '==', companyId),
    where('positionId', '==', input.positionId)
  );
  const existingSnapshot = await getDocs(existingQuery);
  
  // Get skill names
  const skillsData = await Promise.all(
    input.requiredSkills.map(async (rs) => {
      const skill = await getSkill(rs.skillId);
      return {
        ...rs,
        skillName: skill?.name || '',
      };
    })
  );
  
  if (!existingSnapshot.empty) {
    // Update existing
    const existingDoc = existingSnapshot.docs[0];
    await updateDoc(doc(db, SKILL_REQUIREMENTS_COLLECTION, existingDoc.id), {
      requiredSkills: skillsData,
      updatedAt: Timestamp.now(),
    });
    return { 
      id: existingDoc.id, 
      ...existingDoc.data(),
      requiredSkills: skillsData,
    } as SkillRequirement;
  }
  
  // Create new
  const collectionRef = collection(db, SKILL_REQUIREMENTS_COLLECTION);
  const requirement: Omit<SkillRequirement, 'id'> = {
    companyId,
    positionId: input.positionId,
    positionTitle: positionData.title,
    departmentId: positionData.departmentId,
    requiredSkills: skillsData,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collectionRef, requirement);
  return { id: docRef.id, ...requirement };
};

export const getPositionRequirements = async (
  companyId: string,
  positionId: string
): Promise<SkillRequirement | null> => {
  const q = query(
    collection(db, SKILL_REQUIREMENTS_COLLECTION),
    where('companyId', '==', companyId),
    where('positionId', '==', positionId)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as SkillRequirement;
};

// ----------------------------------------------------------------------------
// SKILL GAP ANALYSIS
// ----------------------------------------------------------------------------

export const analyzeSkillGaps = async (
  companyId: string,
  employeeId: string,
  employeeName: string,
  positionId: string,
  positionTitle: string
): Promise<SkillGapAnalysis> => {
  // Get position requirements
  const requirements = await getPositionRequirements(companyId, positionId);
  
  // Get employee skills
  const employeeSkills = await getEmployeeSkills(companyId, employeeId);
  const skillMap = new Map(employeeSkills.map(s => [s.skillId, s]));
  
  const gaps: SkillGapAnalysis['gaps'] = [];
  let criticalGapsCount = 0;
  
  if (requirements) {
    for (const req of requirements.requiredSkills) {
      const empSkill = skillMap.get(req.skillId);
      const currentLevel = empSkill?.verifiedLevel || empSkill?.managerAssessedLevel || empSkill?.selfAssessedLevel || null;
      const currentValue = currentLevel ? SKILL_LEVEL_VALUES[currentLevel] : 0;
      const requiredValue = SKILL_LEVEL_VALUES[req.minimumLevel];
      const gapSize = Math.max(0, requiredValue - currentValue);
      
      if (gapSize > 0) {
        let priority: GapPriority;
        if (req.isRequired && gapSize >= 2) {
          priority = 'critical';
          criticalGapsCount++;
        } else if (req.isRequired) {
          priority = 'high';
        } else if (gapSize >= 2) {
          priority = 'medium';
        } else {
          priority = 'low';
        }
        
        gaps.push({
          skillId: req.skillId,
          skillName: req.skillName,
          requiredLevel: req.minimumLevel,
          currentLevel,
          gapSize,
          priority,
        });
      }
    }
  }
  
  // Calculate readiness
  const totalRequired = requirements?.requiredSkills.length || 0;
  const metRequirements = totalRequired - gaps.length;
  const overallReadiness = totalRequired > 0 ? (metRequirements / totalRequired) * 100 : 100;
  
  // Sort by priority
  const priorityOrder: Record<GapPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  gaps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  return {
    employeeId,
    employeeName,
    positionId,
    positionTitle,
    analysisDate: new Date(),
    gaps,
    overallReadiness,
    criticalGapsCount,
    developmentPriorities: gaps
      .filter(g => g.priority === 'critical' || g.priority === 'high')
      .map(g => g.skillName),
  };
};

// ----------------------------------------------------------------------------
// TRAINING PROGRAMS
// ----------------------------------------------------------------------------

export const createTrainingProgram = async (
  companyId: string,
  input: TrainingProgramInput,
  userId: string
): Promise<TrainingProgram> => {
  const collectionRef = collection(db, TRAINING_PROGRAMS_COLLECTION);
  
  // Get skill names
  const skillsCovered = await Promise.all(
    input.skillsCovered.map(async (sc) => {
      const skill = await getSkill(sc.skillId);
      return {
        ...sc,
        skillName: skill?.name || '',
      };
    })
  );
  
  const program: Omit<TrainingProgram, 'id'> = {
    companyId,
    title: input.title,
    description: input.description,
    type: input.type,
    provider: input.provider,
    providerContact: input.providerContact,
    location: input.location,
    isOnline: input.isOnline,
    startDate: input.startDate,
    endDate: input.endDate,
    durationHours: input.durationHours,
    schedule: input.schedule,
    maxParticipants: input.maxParticipants,
    costPerPerson: input.costPerPerson,
    currency: input.currency,
    budgetCode: input.budgetCode,
    skillsCovered,
    prerequisites: input.prerequisites,
    targetAudience: input.targetAudience,
    certificateProvided: input.certificateProvided,
    enrolledCount: 0,
    status: 'draft',
    createdBy: userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collectionRef, program);
  return { id: docRef.id, ...program };
};

export const getTrainingProgram = async (programId: string): Promise<TrainingProgram | null> => {
  const docRef = doc(db, TRAINING_PROGRAMS_COLLECTION, programId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    startDate: data.startDate?.toDate?.() || data.startDate,
    endDate: data.endDate?.toDate?.() || data.endDate,
  } as TrainingProgram;
};

export const getTrainingPrograms = async (
  companyId: string,
  filters: TrainingProgramFilters = {}
): Promise<TrainingProgram[]> => {
  let q = query(
    collection(db, TRAINING_PROGRAMS_COLLECTION),
    where('companyId', '==', companyId),
    orderBy('startDate', 'desc')
  );
  
  if (filters.status) {
    q = query(q, where('status', '==', filters.status));
  }
  
  if (filters.type) {
    q = query(q, where('type', '==', filters.type));
  }
  
  const snapshot = await getDocs(q);
  let programs = snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      startDate: data.startDate?.toDate?.() || data.startDate,
      endDate: data.endDate?.toDate?.() || data.endDate,
    } as TrainingProgram;
  });
  
  // Apply date filters
  if (filters.startAfter) {
    programs = programs.filter(p => p.startDate >= filters.startAfter!);
  }
  if (filters.startBefore) {
    programs = programs.filter(p => p.startDate <= filters.startBefore!);
  }
  
  // Filter by skill
  if (filters.skillId) {
    programs = programs.filter(p => 
      p.skillsCovered.some(sc => sc.skillId === filters.skillId)
    );
  }
  
  return programs;
};

export const updateTrainingProgram = async (
  programId: string,
  input: Partial<TrainingProgramInput>
): Promise<void> => {
  const docRef = doc(db, TRAINING_PROGRAMS_COLLECTION, programId);
  await updateDoc(docRef, {
    ...input,
    updatedAt: Timestamp.now(),
  });
};

export const publishTrainingProgram = async (programId: string): Promise<void> => {
  const docRef = doc(db, TRAINING_PROGRAMS_COLLECTION, programId);
  await updateDoc(docRef, {
    status: 'published',
    updatedAt: Timestamp.now(),
  });
};

export const cancelTrainingProgram = async (programId: string): Promise<void> => {
  const docRef = doc(db, TRAINING_PROGRAMS_COLLECTION, programId);
  await updateDoc(docRef, {
    status: 'cancelled',
    updatedAt: Timestamp.now(),
  });
};

// ----------------------------------------------------------------------------
// TRAINING ENROLLMENTS
// ----------------------------------------------------------------------------

export const enrollInTraining = async (
  companyId: string,
  programId: string,
  employeeId: string,
  employeeData: { name: string; departmentId: string },
  programData: { title: string; costPerPerson: number },
  userId: string,
  requiresApproval: boolean = true
): Promise<TrainingEnrollment> => {
  const collectionRef = collection(db, TRAINING_ENROLLMENTS_COLLECTION);
  
  const enrollment: Omit<TrainingEnrollment, 'id'> = {
    companyId,
    programId,
    programTitle: programData.title,
    employeeId,
    employeeName: employeeData.name,
    departmentId: employeeData.departmentId,
    enrolledAt: Timestamp.now(),
    enrolledBy: userId,
    status: requiresApproval ? 'enrolled' : 'in_progress',
    approvalRequired: requiresApproval,
    costToCompany: programData.costPerPerson,
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collectionRef, enrollment);
  
  // Update enrolled count
  const programRef = doc(db, TRAINING_PROGRAMS_COLLECTION, programId);
  const programDoc = await getDoc(programRef);
  if (programDoc.exists()) {
    await updateDoc(programRef, {
      enrolledCount: (programDoc.data().enrolledCount || 0) + 1,
    });
  }
  
  return { id: docRef.id, ...enrollment };
};

export const getEnrollment = async (enrollmentId: string): Promise<TrainingEnrollment | null> => {
  const docRef = doc(db, TRAINING_ENROLLMENTS_COLLECTION, enrollmentId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as TrainingEnrollment;
};

export const getEmployeeEnrollments = async (
  companyId: string,
  employeeId: string
): Promise<TrainingEnrollment[]> => {
  const q = query(
    collection(db, TRAINING_ENROLLMENTS_COLLECTION),
    where('companyId', '==', companyId),
    where('employeeId', '==', employeeId),
    orderBy('enrolledAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TrainingEnrollment[];
};

export const getProgramEnrollments = async (
  companyId: string,
  programId: string
): Promise<TrainingEnrollment[]> => {
  const q = query(
    collection(db, TRAINING_ENROLLMENTS_COLLECTION),
    where('companyId', '==', companyId),
    where('programId', '==', programId)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TrainingEnrollment[];
};

export const approveEnrollment = async (
  enrollmentId: string,
  approverId: string
): Promise<void> => {
  const docRef = doc(db, TRAINING_ENROLLMENTS_COLLECTION, enrollmentId);
  await updateDoc(docRef, {
    status: 'in_progress',
    approvedBy: approverId,
    approvedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
};

export const rejectEnrollment = async (
  enrollmentId: string,
  rejecterId: string,
  reason: string
): Promise<void> => {
  const docRef = doc(db, TRAINING_ENROLLMENTS_COLLECTION, enrollmentId);
  await updateDoc(docRef, {
    status: 'cancelled',
    rejectedBy: rejecterId,
    rejectedAt: Timestamp.now(),
    rejectionReason: reason,
    updatedAt: Timestamp.now(),
  });
};

export const completeTraining = async (
  enrollmentId: string,
  completionData: TrainingCompletionInput
): Promise<void> => {
  const docRef = doc(db, TRAINING_ENROLLMENTS_COLLECTION, enrollmentId);
  
  await updateDoc(docRef, {
    status: completionData.passed ? 'completed' : 'failed',
    completionDate: new Date(),
    attendancePercent: completionData.attendancePercent,
    score: completionData.score,
    passed: completionData.passed,
    certificateId: completionData.certificateId,
    updatedAt: Timestamp.now(),
  });
};

export const submitTrainingFeedback = async (
  enrollmentId: string,
  feedback: TrainingFeedbackInput
): Promise<void> => {
  const docRef = doc(db, TRAINING_ENROLLMENTS_COLLECTION, enrollmentId);
  
  await updateDoc(docRef, {
    feedback: {
      ...feedback,
      submittedAt: Timestamp.now(),
    },
    updatedAt: Timestamp.now(),
  });
};

// ----------------------------------------------------------------------------
// CERTIFICATIONS
// ----------------------------------------------------------------------------

export const addCertification = async (
  companyId: string,
  input: CertificationInput,
  employeeName: string
): Promise<SkillCertification> => {
  const collectionRef = collection(db, CERTIFICATIONS_COLLECTION);
  
  // Determine status
  let status: SkillCertification['status'] = 'active';
  if (input.expiryDate) {
    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (input.expiryDate < now) {
      status = 'expired';
    } else if (input.expiryDate.getTime() - now.getTime() < thirtyDays) {
      status = 'expiring_soon';
    }
  }
  
  const cert: Omit<SkillCertification, 'id'> = {
    companyId,
    employeeId: input.employeeId,
    employeeName,
    name: input.name,
    issuingBody: input.issuingBody,
    credentialId: input.credentialId,
    issueDate: input.issueDate,
    expiryDate: input.expiryDate,
    status,
    verificationUrl: input.verificationUrl,
    renewalRequired: input.renewalRequired,
    renewalCost: input.renewalCost,
    skillIds: input.skillIds,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collectionRef, cert);
  return { id: docRef.id, ...cert };
};

export const getCertification = async (certId: string): Promise<SkillCertification | null> => {
  const docRef = doc(db, CERTIFICATIONS_COLLECTION, certId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    issueDate: data.issueDate?.toDate?.() || data.issueDate,
    expiryDate: data.expiryDate?.toDate?.() || data.expiryDate,
  } as SkillCertification;
};

export const getEmployeeCertifications = async (
  companyId: string,
  employeeId: string
): Promise<SkillCertification[]> => {
  const q = query(
    collection(db, CERTIFICATIONS_COLLECTION),
    where('companyId', '==', companyId),
    where('employeeId', '==', employeeId),
    orderBy('expiryDate', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      issueDate: data.issueDate?.toDate?.() || data.issueDate,
      expiryDate: data.expiryDate?.toDate?.() || data.expiryDate,
    } as SkillCertification;
  });
};

export const getExpiringCertifications = async (
  companyId: string,
  daysAhead: number = 60
): Promise<SkillCertification[]> => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  const q = query(
    collection(db, CERTIFICATIONS_COLLECTION),
    where('companyId', '==', companyId),
    where('expiryDate', '<=', futureDate),
    where('status', 'in', ['active', 'expiring_soon'])
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      issueDate: data.issueDate?.toDate?.() || data.issueDate,
      expiryDate: data.expiryDate?.toDate?.() || data.expiryDate,
    } as SkillCertification;
  });
};

export const verifyCertification = async (
  certId: string,
  verifierId: string,
  documentUrl?: string
): Promise<void> => {
  const docRef = doc(db, CERTIFICATIONS_COLLECTION, certId);
  await updateDoc(docRef, {
    status: 'active',
    verifiedBy: verifierId,
    verifiedAt: Timestamp.now(),
    documentUrl,
    updatedAt: Timestamp.now(),
  });
};

export const updateCertificationStatus = async (
  certId: string,
  status: SkillCertification['status']
): Promise<void> => {
  const docRef = doc(db, CERTIFICATIONS_COLLECTION, certId);
  await updateDoc(docRef, {
    status,
    updatedAt: Timestamp.now(),
  });
};

// ----------------------------------------------------------------------------
// TRAINING BUDGET
// ----------------------------------------------------------------------------

export const getTrainingBudget = async (
  companyId: string,
  fiscalYear: string,
  departmentId?: string
): Promise<TrainingBudget | null> => {
  let q = query(
    collection(db, TRAINING_BUDGETS_COLLECTION),
    where('companyId', '==', companyId),
    where('fiscalYear', '==', fiscalYear)
  );
  
  if (departmentId) {
    q = query(q, where('departmentId', '==', departmentId));
  } else {
    q = query(q, where('departmentId', '==', null));
  }
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as TrainingBudget;
};

export const updateTrainingBudgetSpend = async (
  budgetId: string,
  amount: number,
  isCommitted: boolean = false
): Promise<void> => {
  const docRef = doc(db, TRAINING_BUDGETS_COLLECTION, budgetId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return;
  
  const data = docSnap.data();
  const updates: Record<string, unknown> = { updatedAt: Timestamp.now() };
  
  if (isCommitted) {
    updates.committedAmount = (data.committedAmount || 0) + amount;
  } else {
    updates.spentAmount = (data.spentAmount || 0) + amount;
    updates.committedAmount = Math.max(0, (data.committedAmount || 0) - amount);
  }
  
  updates.remainingBudget = data.allocatedBudget - 
    ((updates.spentAmount as number) || data.spentAmount || 0) - 
    ((updates.committedAmount as number) || data.committedAmount || 0);
  
  await updateDoc(docRef, updates);
};
