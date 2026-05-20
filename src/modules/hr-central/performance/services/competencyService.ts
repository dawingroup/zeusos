// ============================================================================
// COMPETENCY SERVICE
// DawinOS v2.0 - HR Performance Module
// Firebase service for competency management
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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import type {
  Competency,
  EmployeeCompetency,
  CompetencyCategory,
  ProficiencyLevel,
} from '../types/development.types';
import { DAWIN_COMPETENCIES } from '../data/dawin-competencies';

// ============================================================================
// COMPETENCY CRUD
// ============================================================================

/**
 * Create a new competency
 */
export async function createCompetency(
  companyId: string,
  input: Omit<Competency, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>,
  createdBy: string
): Promise<Competency> {
  const competencyData = {
    ...input,
    companyId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy,
  };

  const docRef = await addDoc(collection(db, 'competencies'), competencyData);
  const docSnap = await getDoc(docRef);

  return {
    id: docRef.id,
    ...docSnap.data(),
  } as Competency;
}

/**
 * Get all competencies for a company
 */
export async function getCompetencies(
  companyId: string,
  filters?: {
    category?: CompetencyCategory;
    isActive?: boolean;
    role?: string;
  }
): Promise<Competency[]> {
  try {
    let q = query(
      collection(db, 'competencies'),
      where('companyId', '==', companyId),
      orderBy('category'),
      orderBy('name')
    );

    if (filters?.category) {
      q = query(q, where('category', '==', filters.category));
    }

    if (filters?.isActive !== undefined) {
      q = query(q, where('isActive', '==', filters.isActive));
    }

    console.log('[Competency Service] Fetching competencies for company:', companyId);
    const snapshot = await getDocs(q);
    console.log('[Competency Service] Retrieved', snapshot.docs.length, 'competencies');

    let competencies = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Competency[];

    // Filter by role if specified (can't do in query due to array-contains)
    if (filters?.role) {
      competencies = competencies.filter(
        c => !c.applicableRoles || c.applicableRoles.includes(filters.role!)
      );
    }

    return competencies;
  } catch (error) {
    console.error('[Competency Service] Error fetching competencies:', error);
    throw error;
  }
}

/**
 * Get a single competency
 */
export async function getCompetency(competencyId: string): Promise<Competency> {
  const docRef = doc(db, 'competencies', competencyId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('Competency not found');
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as Competency;
}

/**
 * Update a competency
 */
export async function updateCompetency(
  competencyId: string,
  updates: Partial<Omit<Competency, 'id' | 'companyId' | 'createdAt'>>,
  updatedBy: string
): Promise<void> {
  const docRef = doc(db, 'competencies', competencyId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
    updatedBy,
  });
}

/**
 * Delete a competency
 */
export async function deleteCompetency(competencyId: string): Promise<void> {
  const docRef = doc(db, 'competencies', competencyId);
  await deleteDoc(docRef);
}

// ============================================================================
// EMPLOYEE COMPETENCY ASSESSMENTS
// ============================================================================

/**
 * Assess employee competency
 */
export async function assessEmployeeCompetency(
  companyId: string,
  employeeId: string,
  competencyId: string,
  currentLevel: ProficiencyLevel,
  targetLevel: ProficiencyLevel,
  assessedBy: string,
  evidence?: string,
  developmentActions?: string[]
): Promise<EmployeeCompetency> {
  const assessmentData = {
    companyId,
    employeeId,
    competencyId,
    currentLevel,
    targetLevel,
    assessedBy,
    assessmentDate: serverTimestamp(),
    evidence,
    developmentActions,
  };

  const docRef = await addDoc(collection(db, 'employee_competencies'), assessmentData);
  const docSnap = await getDoc(docRef);

  return {
    id: docRef.id,
    ...docSnap.data(),
  } as EmployeeCompetency;
}

/**
 * Get employee competencies
 */
export async function getEmployeeCompetencies(
  companyId: string,
  employeeId: string
): Promise<EmployeeCompetency[]> {
  const q = query(
    collection(db, 'employee_competencies'),
    where('companyId', '==', companyId),
    where('employeeId', '==', employeeId),
    orderBy('assessmentDate', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as EmployeeCompetency[];
}

/**
 * Update employee competency assessment
 */
export async function updateEmployeeCompetency(
  assessmentId: string,
  updates: Partial<Omit<EmployeeCompetency, 'id' | 'companyId' | 'employeeId' | 'competencyId'>>,
  assessedBy: string
): Promise<void> {
  const docRef = doc(db, 'employee_competencies', assessmentId);
  await updateDoc(docRef, {
    ...updates,
    assessedBy,
    assessmentDate: serverTimestamp(),
  });
}

/**
 * Get competency gap analysis for an employee
 */
export async function getCompetencyGaps(
  companyId: string,
  employeeId: string
): Promise<Array<{
  competency: Competency;
  assessment: EmployeeCompetency;
  gap: number;
}>> {
  const assessments = await getEmployeeCompetencies(companyId, employeeId);
  const competencyIds = [...new Set(assessments.map(a => a.competencyId))];

  const gaps = await Promise.all(
    competencyIds.map(async (competencyId) => {
      const competency = await getCompetency(competencyId);
      const latestAssessment = assessments
        .filter(a => a.competencyId === competencyId)
        .sort((a, b) => {
          const aDate = a.assessmentDate instanceof Timestamp
            ? a.assessmentDate.toDate()
            : new Date(a.assessmentDate);
          const bDate = b.assessmentDate instanceof Timestamp
            ? b.assessmentDate.toDate()
            : new Date(b.assessmentDate);
          return bDate.getTime() - aDate.getTime();
        })[0];

      const levelOrder: ProficiencyLevel[] = ['novice', 'beginner', 'intermediate', 'advanced', 'expert'];
      const currentIndex = levelOrder.indexOf(latestAssessment.currentLevel);
      const targetIndex = levelOrder.indexOf(latestAssessment.targetLevel);

      return {
        competency,
        assessment: latestAssessment,
        gap: targetIndex - currentIndex,
      };
    })
  );

  return gaps.filter(g => g.gap > 0).sort((a, b) => b.gap - a.gap);
}

// ============================================================================
// SEEDING FUNCTIONS
// ============================================================================

/**
 * Seed standard Dawin competencies for a company
 * Checks for existing competencies to prevent duplicates
 */
export async function seedDawinCompetencies(
  companyId: string,
  createdBy: string
): Promise<Competency[]> {
  // Check if competencies already exist to prevent duplicates
  const alreadySeeded = await hasCompetenciesSeeded(companyId);
  if (alreadySeeded) {
    console.warn('Competencies already exist for this company. Skipping seed.');
    return await getCompetencies(companyId);
  }

  const seededCompetencies: Competency[] = [];

  for (const competencyTemplate of DAWIN_COMPETENCIES) {
    const competency = await createCompetency(companyId, competencyTemplate, createdBy);
    seededCompetencies.push(competency);
  }

  return seededCompetencies;
}

/**
 * Check if competencies have been seeded for a company
 */
export async function hasCompetenciesSeeded(companyId: string): Promise<boolean> {
  const q = query(
    collection(db, 'competencies'),
    where('companyId', '==', companyId)
  );

  const snapshot = await getDocs(q);
  return !snapshot.empty;
}
