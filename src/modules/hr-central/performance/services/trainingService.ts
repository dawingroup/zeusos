// ============================================================================
// TRAINING SERVICE
// DawinOS v2.0 - HR Performance Module
// Firebase service for training catalog and employee training management
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
  TrainingCourse,
  EmployeeTraining,
  TrainingType,
} from '../types/development.types';

// ============================================================================
// TRAINING COURSE CATALOG
// ============================================================================

/**
 * Create a new training course
 */
export async function createTrainingCourse(
  companyId: string,
  input: Omit<TrainingCourse, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>,
  createdBy: string
): Promise<TrainingCourse> {
  const courseData = {
    ...input,
    companyId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy,
  };

  const docRef = await addDoc(collection(db, 'training_courses'), courseData);
  const docSnap = await getDoc(docRef);

  return {
    id: docRef.id,
    ...docSnap.data(),
  } as TrainingCourse;
}

/**
 * Get all training courses
 */
export async function getTrainingCourses(
  companyId: string,
  filters?: {
    type?: TrainingType;
    provider?: 'internal' | 'external' | 'vendor';
    deliveryMethod?: 'classroom' | 'online' | 'hybrid' | 'self_paced';
    targetCompetencyId?: string;
  }
): Promise<TrainingCourse[]> {
  let q = query(
    collection(db, 'training_courses'),
    where('companyId', '==', companyId),
    orderBy('title')
  );

  if (filters?.type) {
    q = query(q, where('type', '==', filters.type));
  }

  if (filters?.provider) {
    q = query(q, where('provider', '==', filters.provider));
  }

  if (filters?.deliveryMethod) {
    q = query(q, where('deliveryMethod', '==', filters.deliveryMethod));
  }

  const snapshot = await getDocs(q);
  let courses = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as TrainingCourse[];

  // Filter by target competency if specified
  if (filters?.targetCompetencyId) {
    courses = courses.filter(c =>
      c.targetCompetencies.includes(filters.targetCompetencyId!)
    );
  }

  return courses;
}

/**
 * Get a single training course
 */
export async function getTrainingCourse(courseId: string): Promise<TrainingCourse> {
  const docRef = doc(db, 'training_courses', courseId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('Training course not found');
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as TrainingCourse;
}

/**
 * Update a training course
 */
export async function updateTrainingCourse(
  courseId: string,
  updates: Partial<Omit<TrainingCourse, 'id' | 'companyId' | 'createdAt'>>,
  updatedBy: string
): Promise<void> {
  const docRef = doc(db, 'training_courses', courseId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
    updatedBy,
  });
}

/**
 * Delete a training course
 */
export async function deleteTrainingCourse(courseId: string): Promise<void> {
  const docRef = doc(db, 'training_courses', courseId);
  await deleteDoc(docRef);
}

// ============================================================================
// EMPLOYEE TRAINING
// ============================================================================

/**
 * Enroll employee in training
 */
export async function enrollEmployeeInTraining(
  companyId: string,
  employeeId: string,
  courseId: string,
  enrolledBy: string,
  plannedStartDate?: Date,
  plannedEndDate?: Date
): Promise<EmployeeTraining> {
  const enrollmentData = {
    companyId,
    employeeId,
    courseId,
    status: 'enrolled' as const,
    progress: 0,
    enrolledDate: serverTimestamp(),
    plannedStartDate: plannedStartDate ? Timestamp.fromDate(plannedStartDate) : null,
    plannedEndDate: plannedEndDate ? Timestamp.fromDate(plannedEndDate) : null,
    enrolledBy,
  };

  const docRef = await addDoc(collection(db, 'employee_training'), enrollmentData);
  const docSnap = await getDoc(docRef);

  return {
    id: docRef.id,
    ...docSnap.data(),
  } as EmployeeTraining;
}

/**
 * Get employee training records
 */
export async function getEmployeeTraining(
  companyId: string,
  employeeId: string,
  filters?: {
    status?: 'planned' | 'enrolled' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
  }
): Promise<EmployeeTraining[]> {
  let q = query(
    collection(db, 'employee_training'),
    where('companyId', '==', companyId),
    where('employeeId', '==', employeeId),
    orderBy('enrolledDate', 'desc')
  );

  if (filters?.status) {
    q = query(q, where('status', '==', filters.status));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as EmployeeTraining[];
}

/**
 * Update training progress
 */
export async function updateTrainingProgress(
  trainingId: string,
  progress: number,
  status?: 'planned' | 'enrolled' | 'in_progress' | 'completed' | 'cancelled' | 'failed',
  updatedBy?: string
): Promise<void> {
  const docRef = doc(db, 'employee_training', trainingId);
  const updates: any = {
    progress,
    updatedAt: serverTimestamp(),
  };

  if (status) {
    updates.status = status;
  }

  if (updatedBy) {
    updates.updatedBy = updatedBy;
  }

  // Auto-set completion date if completed
  if (status === 'completed' && progress === 100) {
    updates.completedDate = serverTimestamp();
  }

  await updateDoc(docRef, updates);
}

/**
 * Complete training with assessment
 */
export async function completeTraining(
  trainingId: string,
  assessmentScore?: number,
  certified?: boolean,
  completedBy?: string
): Promise<void> {
  const docRef = doc(db, 'employee_training', trainingId);
  await updateDoc(docRef, {
    status: 'completed',
    progress: 100,
    assessmentScore,
    certified,
    completedDate: serverTimestamp(),
    updatedBy: completedBy,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Cancel training enrollment
 */
export async function cancelTraining(
  trainingId: string,
  reason?: string,
  cancelledBy?: string
): Promise<void> {
  const docRef = doc(db, 'employee_training', trainingId);
  await updateDoc(docRef, {
    status: 'cancelled',
    cancellationReason: reason,
    cancelledDate: serverTimestamp(),
    cancelledBy,
    updatedAt: serverTimestamp(),
  });
}

// ============================================================================
// TRAINING ANALYTICS
// ============================================================================

/**
 * Get training completion statistics for an employee
 */
export async function getEmployeeTrainingStats(
  companyId: string,
  employeeId: string
): Promise<{
  total: number;
  completed: number;
  inProgress: number;
  planned: number;
  completionRate: number;
  totalHoursTrained: number;
  certificationsEarned: number;
}> {
  const allTraining = await getEmployeeTraining(companyId, employeeId);

  const completed = allTraining.filter(t => t.status === 'completed');
  const inProgress = allTraining.filter(t => t.status === 'in_progress');
  const planned = allTraining.filter(t => t.status === 'planned' || t.status === 'enrolled');

  // Calculate total hours trained
  const totalHoursTrained = await Promise.all(
    completed.map(async (training) => {
      try {
        const course = await getTrainingCourse(training.courseId);
        return course.duration || 0;
      } catch {
        return 0;
      }
    })
  ).then(hours => hours.reduce((sum, h) => sum + h, 0));

  const certificationsEarned = completed.filter(t => t.certified).length;

  return {
    total: allTraining.length,
    completed: completed.length,
    inProgress: inProgress.length,
    planned: planned.length,
    completionRate: allTraining.length > 0 ? (completed.length / allTraining.length) * 100 : 0,
    totalHoursTrained,
    certificationsEarned,
  };
}

/**
 * Get recommended training for employee based on competency gaps
 */
export async function getRecommendedTraining(
  companyId: string,
  competencyGapIds: string[]
): Promise<TrainingCourse[]> {
  if (competencyGapIds.length === 0) {
    return [];
  }

  const allCourses = await getTrainingCourses(companyId);

  // Find courses that target the gap competencies
  const recommendedCourses = allCourses.filter(course =>
    course.targetCompetencies.some(cId => competencyGapIds.includes(cId))
  );

  // Sort by number of matching competencies
  return recommendedCourses.sort((a, b) => {
    const aMatches = a.targetCompetencies.filter(cId => competencyGapIds.includes(cId)).length;
    const bMatches = b.targetCompetencies.filter(cId => competencyGapIds.includes(cId)).length;
    return bMatches - aMatches;
  });
}
