/**
 * Task Assignment Service
 * Functions for managers to assign and reassign tasks
 * Includes input validation, atomic batch operations, and audit trail
 */

import { db } from '@/shared/services/firebase/firestore';
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  writeBatch,
  Timestamp,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';

export interface TaskAssignment {
  taskId: string;
  assignedTo: string;
  assignedBy: string;
  assignedAt: Date;
  reason?: string;
}

export interface TaskReassignment extends TaskAssignment {
  previousAssignee: string;
}

// ============================================
// Validation
// ============================================

function validateId(value: string, label: string): void {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} is required and must be a non-empty string`);
  }
  if (value.length > 128) {
    throw new Error(`${label} must be 128 characters or fewer`);
  }
}

async function assertTaskExists(taskId: string): Promise<void> {
  const taskRef = doc(db, 'generatedTasks', taskId);
  const taskSnap = await getDoc(taskRef);
  if (!taskSnap.exists()) {
    throw new Error(`Task ${taskId} not found`);
  }
}

// ============================================
// Audit Trail
// ============================================

async function writeAuditEntry(
  action: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await addDoc(collection(db, 'auditLog'), {
      module: 'intelligence-layer',
      action,
      ...details,
      timestamp: Timestamp.now(),
    });
  } catch (err) {
    // Audit failures should not block the primary operation
    console.error('Failed to write audit entry:', err);
  }
}

// ============================================
// Assignment Functions
// ============================================

/**
 * Look up employee name by ID
 */
async function getEmployeeName(employeeId: string): Promise<string | null> {
  try {
    const empRef = doc(db, 'employees', employeeId);
    const empSnap = await getDoc(empRef);
    if (!empSnap.exists()) return null;
    const data = empSnap.data();
    const name = `${data.firstName || ''} ${data.lastName || ''}`.trim();
    return name || data.displayName || null;
  } catch {
    return null;
  }
}

/**
 * Assign a task to an employee
 */
export async function assignTask(
  taskId: string,
  assignedTo: string,
  assignedBy: string,
  reason?: string
): Promise<void> {
  validateId(taskId, 'Task ID');
  validateId(assignedTo, 'Assignee ID');
  validateId(assignedBy, 'Assigner ID');
  await assertTaskExists(taskId);

  const assigneeName = await getEmployeeName(assignedTo);
  const taskRef = doc(db, 'generatedTasks', taskId);

  await updateDoc(taskRef, {
    assignedTo,
    assignedToName: assigneeName,
    assignedBy,
    assignedAt: Timestamp.now(),
    assignmentReason: reason || null,
    stage: 'assigned',
    updatedAt: Timestamp.now(),
  });

  await writeAuditEntry('task_assigned', {
    taskId,
    assignedTo,
    assignedBy,
    reason: reason || null,
  });
}

/**
 * Reassign a task from one employee to another
 */
export async function reassignTask(
  taskId: string,
  newAssignee: string,
  reassignedBy: string,
  reason?: string
): Promise<void> {
  validateId(taskId, 'Task ID');
  validateId(newAssignee, 'New assignee ID');
  validateId(reassignedBy, 'Reassigner ID');
  await assertTaskExists(taskId);

  const assigneeName = await getEmployeeName(newAssignee);
  const taskRef = doc(db, 'generatedTasks', taskId);

  await updateDoc(taskRef, {
    assignedTo: newAssignee,
    assignedToName: assigneeName,
    reassignedBy,
    reassignedAt: Timestamp.now(),
    reassignmentReason: reason || null,
    updatedAt: Timestamp.now(),
  });

  await writeAuditEntry('task_reassigned', {
    taskId,
    newAssignee,
    reassignedBy,
    reason: reason || null,
  });
}

/**
 * Take up (claim) a task assigned to someone else
 */
export async function takeUpTask(
  taskId: string,
  newAssignee: string,
  takenBy: string,
  reason?: string
): Promise<void> {
  validateId(taskId, 'Task ID');
  validateId(newAssignee, 'New assignee ID');
  validateId(takenBy, 'Taker ID');
  await assertTaskExists(taskId);

  const assigneeName = await getEmployeeName(newAssignee);
  const taskRef = doc(db, 'generatedTasks', taskId);

  await updateDoc(taskRef, {
    assignedTo: newAssignee,
    assignedToName: assigneeName,
    takenUpBy: takenBy,
    takenUpAt: Timestamp.now(),
    takeUpReason: reason || null,
    status: 'in_progress',
    stage: 'assigned',
    updatedAt: Timestamp.now(),
  });

  await writeAuditEntry('task_taken_up', {
    taskId,
    newAssignee,
    takenBy,
    reason: reason || null,
  });
}

/**
 * Bulk assign tasks to an employee using an atomic WriteBatch
 */
export async function bulkAssignTasks(
  taskIds: string[],
  assignedTo: string,
  assignedBy: string,
  reason?: string
): Promise<void> {
  if (!taskIds || taskIds.length === 0) {
    throw new Error('At least one task ID is required');
  }
  if (taskIds.length > 500) {
    throw new Error('Cannot bulk assign more than 500 tasks at once');
  }
  validateId(assignedTo, 'Assignee ID');
  validateId(assignedBy, 'Assigner ID');

  const batch = writeBatch(db);
  const now = Timestamp.now();

  for (const taskId of taskIds) {
    validateId(taskId, 'Task ID');
    const taskRef = doc(db, 'generatedTasks', taskId);
    batch.update(taskRef, {
      assignedTo,
      assignedBy,
      assignedAt: now,
      assignmentReason: reason || null,
      updatedAt: now,
    });
  }

  await batch.commit();

  await writeAuditEntry('tasks_bulk_assigned', {
    taskIds,
    assignedTo,
    assignedBy,
    reason: reason || null,
    count: taskIds.length,
  });
}

// ============================================
// Query Functions
// ============================================

/**
 * Get all unassigned tasks
 */
export async function getUnassignedTasks() {
  const tasksRef = collection(db, 'generatedTasks');
  const q = query(
    tasksRef,
    where('assignedTo', '==', null),
    where('status', '==', 'pending')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

/**
 * Get tasks assigned to a specific employee
 */
export async function getEmployeeTasks(employeeId: string) {
  validateId(employeeId, 'Employee ID');

  const tasksRef = collection(db, 'generatedTasks');
  const q = query(tasksRef, where('assignedTo', '==', employeeId));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}
