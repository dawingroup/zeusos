/**
 * PROGRAM SERVICE
 * 
 * Service for managing infrastructure delivery programs.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  increment,
  QueryConstraint,
  Firestore,
  writeBatch,
} from 'firebase/firestore';
import {
  Program,
  CreateProgramData,
  UpdateProgramData,
  ProgramStatus,
  StatusChange,
  ProgramExtension,
  getDefaultProgramSettings,
  getDefaultMatFlowConfig,
  getEmptyProjectStats,
  isStatusTransitionAllowed,
  generateProgramCode,
} from '../types/program';
import { BudgetAllocation, initializeProgramBudget } from '../types/program-budget';
import { ProgramTeamMember } from '../types/program-team';

// ─────────────────────────────────────────────────────────────────
// COLLECTION PATHS
// ─────────────────────────────────────────────────────────────────

// IMPORTANT: This path must match the one used by ProjectService and other services
// to ensure proper program-project linking. The canonical path is under organizations.
const PROGRAMS_PATH = 'organizations/default/advisory_programs';
const ENGAGEMENTS_PATH = 'engagements';
const ACTIVITY_LOG_PATH = 'activityLog';

// ─────────────────────────────────────────────────────────────────
// PROGRAM SERVICE
// ─────────────────────────────────────────────────────────────────

export class ProgramService {
  private static instance: ProgramService;
  private db: Firestore;

  private constructor(db: Firestore) {
    this.db = db;
  }

  static getInstance(db: Firestore): ProgramService {
    if (!ProgramService.instance) {
      ProgramService.instance = new ProgramService(db);
    }
    return ProgramService.instance;
  }

  // ─────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create a new program
   */
  async createProgram(
    data: CreateProgramData,
    userId: string
  ): Promise<Program> {
    let clientId = data.clientId || '';
    
    // Get engagement to validate and extract client info (if provided)
    if (data.engagementId) {
      const engagement = await this.getEngagement(data.engagementId);
      if (!engagement) {
        throw new Error(`Engagement ${data.engagementId} not found`);
      }
      clientId = engagement.clientId;
    }

    // Generate unique code
    const programCount = data.engagementId 
      ? await this.getProgramCountForEngagement(data.engagementId)
      : await this.getTotalProgramCount();
    const code = data.code || generateProgramCode(data.name, programCount + 1);

    // Initialize budget
    const budget = initializeProgramBudget(
      data.budgetAllocations?.[0]?.allocatedAmount.currency || 'USD'
    );
    if (data.budgetAllocations) {
      budget.fundingAllocations = data.budgetAllocations;
      budget.allocated.amount = data.budgetAllocations.reduce(
        (sum, a) => sum + a.allocatedAmount.amount, 0
      );
      budget.available = { ...budget.allocated };
    }

    // Build program object - ensure no undefined values for Firestore
    const programData: Omit<Program, 'id'> = {
      engagementId: data.engagementId || '',
      clientId,
      // Customer link (from global customers collection)
      customerId: data.customerId || '',
      customerName: data.customerName || '',
      name: data.name,
      code,
      description: data.description || '',
      icon: data.icon || '',
      implementationType: data.implementationType || 'direct',
      sectors: data.sectors || [],
      coverage: data.coverage || {
        countries: [],
      },
      budget,
      projectIds: [],
      projectStats: getEmptyProjectStats(budget.currency),
      managerId: data.managerId || '',
      team: [],
      startDate: Timestamp.fromDate(data.startDate instanceof Date ? data.startDate : new Date(data.startDate)),
      endDate: Timestamp.fromDate(data.endDate instanceof Date ? data.endDate : new Date(data.endDate)),
      extensions: [],
      status: 'planning',
      statusHistory: [],
      matflowConfig: {
        ...getDefaultMatFlowConfig(),
        ...data.matflowConfig,
        enabled: true,
      },
      settings: {
        ...getDefaultProgramSettings(),
        ...data.settings,
      },
      createdBy: userId,
      createdAt: Timestamp.now(),
      updatedBy: userId,
      updatedAt: Timestamp.now(),
    };

    // Add to Firestore
    const programsRef = collection(this.db, PROGRAMS_PATH);
    console.log('[ProgramService] Creating program at:', PROGRAMS_PATH);
    let docRef;
    try {
      docRef = await addDoc(programsRef, programData);
      console.log('[ProgramService] Program created:', docRef.id);
    } catch (err) {
      console.error('[ProgramService] Failed to create program doc:', err);
      throw err;
    }

    // Log activity - ensure no undefined values
    try {
      await this.logActivity(docRef.id, 'program_created', userId, {
        programName: data.name,
        implementationType: data.implementationType || 'direct',
      });
    } catch (err) {
      console.error('[ProgramService] Failed to log activity:', err);
      // Don't throw - activity logging failure shouldn't block program creation
    }

    return {
      id: docRef.id,
      ...programData,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get program by ID
   */
  async getProgram(programId: string): Promise<Program | null> {
    const docRef = doc(this.db, PROGRAMS_PATH, programId);
    const snapshot = await getDoc(docRef);
    
    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as Program;
  }

  /**
   * Get programs for engagement
   */
  async getProgramsForEngagement(
    engagementId: string,
    options: {
      status?: ProgramStatus[];
      orderByField?: 'name' | 'createdAt' | 'startDate';
      orderDirection?: 'asc' | 'desc';
      limitCount?: number;
    } = {}
  ): Promise<Program[]> {
    const constraints: QueryConstraint[] = [
      where('engagementId', '==', engagementId),
    ];

    if (options.status?.length) {
      constraints.push(where('status', 'in', options.status));
    }

    constraints.push(
      orderBy(options.orderByField || 'createdAt', options.orderDirection || 'desc')
    );

    if (options.limitCount) {
      constraints.push(limit(options.limitCount));
    }

    const q = query(collection(this.db, PROGRAMS_PATH), ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Program[];
  }

  /**
   * Get all programs
   */
  async getAllPrograms(
    options: {
      status?: ProgramStatus[];
      orderByField?: 'name' | 'createdAt' | 'startDate' | 'updatedAt';
      orderDirection?: 'asc' | 'desc';
      limitCount?: number;
    } = {}
  ): Promise<Program[]> {
    const constraints: QueryConstraint[] = [];

    if (options.status?.length) {
      constraints.push(where('status', 'in', options.status));
    }

    constraints.push(
      orderBy(options.orderByField || 'createdAt', options.orderDirection || 'desc')
    );

    if (options.limitCount) {
      constraints.push(limit(options.limitCount));
    }

    const q = query(collection(this.db, PROGRAMS_PATH), ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Program[];
  }

  /**
   * Get programs managed by user
   */
  async getProgramsForManager(
    userId: string,
    options: {
      status?: ProgramStatus[];
      limitCount?: number;
    } = {}
  ): Promise<Program[]> {
    const constraints: QueryConstraint[] = [
      where('managerId', '==', userId),
    ];

    if (options.status?.length) {
      constraints.push(where('status', 'in', options.status));
    }

    constraints.push(orderBy('updatedAt', 'desc'));

    if (options.limitCount) {
      constraints.push(limit(options.limitCount));
    }

    const q = query(collection(this.db, PROGRAMS_PATH), ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Program[];
  }

  /**
   * Get programs where user is team member
   */
  async getProgramsForTeamMember(
    userId: string,
    options: {
      status?: ProgramStatus[];
      limitCount?: number;
    } = {}
  ): Promise<Program[]> {
    // Query programs where team array contains a member with this userId
    // Note: This requires a denormalized field or client-side filtering
    const constraints: QueryConstraint[] = [];

    if (options.status?.length) {
      constraints.push(where('status', 'in', options.status));
    }

    constraints.push(orderBy('updatedAt', 'desc'));

    if (options.limitCount) {
      constraints.push(limit(options.limitCount));
    }

    const q = query(collection(this.db, PROGRAMS_PATH), ...constraints);
    const snapshot = await getDocs(q);

    // Filter client-side for team membership
    const programs = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Program[];

    return programs.filter(p =>
      p.team.some(m => m.userId === userId && m.isActive)
    );
  }

  /**
   * Subscribe to program updates
   */
  subscribeToProgram(
    programId: string,
    callback: (program: Program | null) => void
  ): () => void {
    const docRef = doc(this.db, PROGRAMS_PATH, programId);
    
    return onSnapshot(docRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }

      callback({
        id: snapshot.id,
        ...snapshot.data(),
      } as Program);
    });
  }

  /**
   * Subscribe to programs for engagement
   */
  subscribeToProgramsForEngagement(
    engagementId: string,
    callback: (programs: Program[]) => void
  ): () => void {
    const q = query(
      collection(this.db, PROGRAMS_PATH),
      where('engagementId', '==', engagementId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const programs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Program[];
      callback(programs);
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Update program
   */
  async updateProgram(
    programId: string,
    data: UpdateProgramData,
    userId: string
  ): Promise<void> {
    const docRef = doc(this.db, PROGRAMS_PATH, programId);
    
    const updateData: Record<string, unknown> = {
      ...data,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    };

    if (data.endDate) {
      updateData.endDate = Timestamp.fromDate(data.endDate);
    }

    await updateDoc(docRef, updateData);

    await this.logActivity(programId, 'program_updated', userId, {
      updatedFields: Object.keys(data),
    });
  }

  /**
   * Update program status
   */
  async updateStatus(
    programId: string,
    newStatus: ProgramStatus,
    userId: string,
    reason?: string
  ): Promise<void> {
    const program = await this.getProgram(programId);
    if (!program) {
      throw new Error(`Program ${programId} not found`);
    }

    if (!isStatusTransitionAllowed(program.status, newStatus)) {
      throw new Error(
        `Cannot transition from ${program.status} to ${newStatus}` 
      );
    }

    const statusChange: StatusChange = {
      fromStatus: program.status,
      toStatus: newStatus,
      reason,
      changedBy: userId,
      changedAt: Timestamp.now(),
    };

    const docRef = doc(this.db, PROGRAMS_PATH, programId);
    await updateDoc(docRef, {
      status: newStatus,
      statusHistory: [...program.statusHistory, statusChange],
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    });

    await this.logActivity(programId, 'status_changed', userId, {
      fromStatus: program.status,
      toStatus: newStatus,
      reason,
    });
  }

  /**
   * Add project to program
   */
  async addProject(
    programId: string,
    projectId: string,
    userId: string
  ): Promise<void> {
    const program = await this.getProgram(programId);
    if (!program) {
      throw new Error(`Program ${programId} not found`);
    }

    if (program.projectIds.includes(projectId)) {
      return;
    }

    const docRef = doc(this.db, PROGRAMS_PATH, programId);
    await updateDoc(docRef, {
      projectIds: [...program.projectIds, projectId],
      'projectStats.total': increment(1),
      'projectStats.byStatus.planning': increment(1),
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    });

    await this.logActivity(programId, 'project_added', userId, { projectId });
  }

  /**
   * Remove project from program
   */
  async removeProject(
    programId: string,
    projectId: string,
    userId: string
  ): Promise<void> {
    const program = await this.getProgram(programId);
    if (!program) {
      throw new Error(`Program ${programId} not found`);
    }

    const docRef = doc(this.db, PROGRAMS_PATH, programId);
    await updateDoc(docRef, {
      projectIds: program.projectIds.filter(id => id !== projectId),
      'projectStats.total': increment(-1),
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    });

    await this.logActivity(programId, 'project_removed', userId, { projectId });
  }

  /**
   * Update project stats
   */
  async updateProjectStats(
    programId: string,
    stats: Partial<Program['projectStats']>
  ): Promise<void> {
    const docRef = doc(this.db, PROGRAMS_PATH, programId);
    
    const updateData: Record<string, unknown> = {};
    Object.entries(stats).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        Object.entries(value).forEach(([subKey, subValue]) => {
          updateData[`projectStats.${key}.${subKey}`] = subValue;
        });
      } else {
        updateData[`projectStats.${key}`] = value;
      }
    });

    await updateDoc(docRef, {
      ...updateData,
      updatedAt: serverTimestamp(),
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // TEAM MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Add team member
   */
  async addTeamMember(
    programId: string,
    member: Omit<ProgramTeamMember, 'addedBy' | 'addedAt'>,
    userId: string
  ): Promise<void> {
    const program = await this.getProgram(programId);
    if (!program) {
      throw new Error(`Program ${programId} not found`);
    }

    if (program.team.some(m => m.userId === member.userId)) {
      throw new Error('User is already a team member');
    }

    const teamMember: ProgramTeamMember = {
      ...member,
      addedBy: userId,
      addedAt: Timestamp.now(),
    };

    const docRef = doc(this.db, PROGRAMS_PATH, programId);
    await updateDoc(docRef, {
      team: [...program.team, teamMember],
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    });

    await this.logActivity(programId, 'team_member_added', userId, {
      memberId: member.userId,
      role: member.role,
    });
  }

  /**
   * Update team member
   */
  async updateTeamMember(
    programId: string,
    memberId: string,
    updates: Partial<Omit<ProgramTeamMember, 'userId' | 'addedBy' | 'addedAt'>>,
    userId: string
  ): Promise<void> {
    const program = await this.getProgram(programId);
    if (!program) {
      throw new Error(`Program ${programId} not found`);
    }

    const memberIndex = program.team.findIndex(m => m.userId === memberId);
    if (memberIndex === -1) {
      throw new Error('Team member not found');
    }

    const updatedTeam = [...program.team];
    updatedTeam[memberIndex] = {
      ...updatedTeam[memberIndex],
      ...updates,
    };

    const docRef = doc(this.db, PROGRAMS_PATH, programId);
    await updateDoc(docRef, {
      team: updatedTeam,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    });

    await this.logActivity(programId, 'team_member_updated', userId, {
      memberId,
      updates: Object.keys(updates),
    });
  }

  /**
   * Remove team member
   */
  async removeTeamMember(
    programId: string,
    memberId: string,
    userId: string
  ): Promise<void> {
    const program = await this.getProgram(programId);
    if (!program) {
      throw new Error(`Program ${programId} not found`);
    }

    const docRef = doc(this.db, PROGRAMS_PATH, programId);
    await updateDoc(docRef, {
      team: program.team.filter(m => m.userId !== memberId),
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    });

    await this.logActivity(programId, 'team_member_removed', userId, { memberId });
  }

  // ─────────────────────────────────────────────────────────────────
  // BUDGET MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Update budget allocation
   */
  async updateBudgetAllocation(
    programId: string,
    allocation: BudgetAllocation,
    userId: string
  ): Promise<void> {
    const program = await this.getProgram(programId);
    if (!program) {
      throw new Error(`Program ${programId} not found`);
    }

    const existingIndex = program.budget.fundingAllocations.findIndex(
      (a: BudgetAllocation) => a.fundingSourceId === allocation.fundingSourceId
    );

    const updatedAllocations = [...program.budget.fundingAllocations];
    if (existingIndex >= 0) {
      updatedAllocations[existingIndex] = allocation;
    } else {
      updatedAllocations.push(allocation);
    }

    const totalAllocated = updatedAllocations.reduce(
      (sum, a) => sum + a.allocatedAmount.amount, 0
    );

    const docRef = doc(this.db, PROGRAMS_PATH, programId);
    await updateDoc(docRef, {
      'budget.fundingAllocations': updatedAllocations,
      'budget.allocated.amount': totalAllocated,
      'budget.available.amount': totalAllocated - program.budget.committed.amount,
      'budget.lastCalculatedAt': new Date(),
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    });

    await this.logActivity(programId, 'budget_updated', userId, {
      fundingSourceId: allocation.fundingSourceId,
      amount: allocation.allocatedAmount.amount,
    });
  }

  /**
   * Update the program budget allocated amount and currency directly.
   */
  async updateBudgetAllocated(
    programId: string,
    data: { amount: number; currency: string },
    userId: string
  ): Promise<void> {
    const program = await this.getProgram(programId);
    if (!program) throw new Error(`Program ${programId} not found`);

    const committed = program.budget.committed.amount;
    const spent = program.budget.spent.amount;
    const available = data.amount - committed - spent;

    const docRef = doc(this.db, PROGRAMS_PATH, programId);
    await updateDoc(docRef, {
      'budget.allocated.amount': data.amount,
      'budget.allocated.currency': data.currency,
      'budget.currency': data.currency,
      'budget.available.amount': available,
      'budget.available.currency': data.currency,
      'budget.lastCalculatedAt': new Date(),
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    });

    await this.logActivity(programId, 'budget_updated', userId, {
      allocatedAmount: data.amount,
      currency: data.currency,
    });
  }

  /**
   * Recalculate budget from projects
   */
  async recalculateBudget(programId: string): Promise<void> {
    const docRef = doc(this.db, PROGRAMS_PATH, programId);
    await updateDoc(docRef, {
      'budget.lastCalculatedAt': new Date(),
      updatedAt: serverTimestamp(),
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // EXTENSIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Request program extension
   */
  async requestExtension(
    programId: string,
    newEndDate: Date,
    reason: string,
    userId: string
  ): Promise<string> {
    const program = await this.getProgram(programId);
    if (!program) {
      throw new Error(`Program ${programId} not found`);
    }

    const extension: ProgramExtension = {
      id: `ext-${Date.now()}`,
      originalEndDate: program.endDate,
      newEndDate: Timestamp.fromDate(newEndDate),
      durationDays: Math.ceil(
        (newEndDate.getTime() - program.endDate.toDate().getTime()) / (1000 * 60 * 60 * 24)
      ),
      reason,
      requestedBy: userId,
      createdAt: Timestamp.now(),
    };

    const docRef = doc(this.db, PROGRAMS_PATH, programId);
    await updateDoc(docRef, {
      extensions: [...program.extensions, extension],
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    });

    await this.logActivity(programId, 'extension_requested', userId, {
      extensionId: extension.id,
      newEndDate: newEndDate.toISOString(),
      durationDays: extension.durationDays,
    });

    return extension.id;
  }

  /**
   * Approve program extension
   */
  async approveExtension(
    programId: string,
    extensionId: string,
    userId: string
  ): Promise<void> {
    const program = await this.getProgram(programId);
    if (!program) {
      throw new Error(`Program ${programId} not found`);
    }

    const extensionIndex = program.extensions.findIndex(e => e.id === extensionId);
    if (extensionIndex === -1) {
      throw new Error('Extension not found');
    }

    const extension = program.extensions[extensionIndex];
    if (extension.approvedBy) {
      throw new Error('Extension already approved');
    }

    const updatedExtensions = [...program.extensions];
    updatedExtensions[extensionIndex] = {
      ...extension,
      approvedBy: userId,
      approvedAt: Timestamp.now(),
    };

    const docRef = doc(this.db, PROGRAMS_PATH, programId);
    await updateDoc(docRef, {
      endDate: extension.newEndDate,
      extensions: updatedExtensions,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    });

    await this.logActivity(programId, 'extension_approved', userId, {
      extensionId,
      newEndDate: extension.newEndDate.toDate().toISOString(),
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Delete program (hard delete) and all associated projects
   */
  async deleteProgram(
    programId: string,
    _userId: string,
    _reason?: string
  ): Promise<void> {
    const batch = writeBatch(this.db);
    
    // Get all projects associated with this program
    const projectsQuery = query(
      collection(this.db, 'projects'),
      where('programId', '==', programId)
    );
    const projectsSnapshot = await getDocs(projectsQuery);
    
    // Delete all associated projects
    projectsSnapshot.docs.forEach((projectDoc) => {
      batch.delete(projectDoc.ref);
    });
    
    // Delete the program document
    const programRef = doc(this.db, PROGRAMS_PATH, programId);
    batch.delete(programRef);
    
    // Commit the batch
    await batch.commit();
    
    console.log(`Deleted program ${programId} and ${projectsSnapshot.size} associated projects`);
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────

  private async getEngagement(engagementId: string): Promise<{ clientId: string } | null> {
    const docRef = doc(this.db, ENGAGEMENTS_PATH, engagementId);
    const snapshot = await getDoc(docRef);
    
    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    return {
      clientId: data.clientId || '',
    };
  }

  private async getProgramCountForEngagement(engagementId: string): Promise<number> {
    const q = query(
      collection(this.db, PROGRAMS_PATH),
      where('engagementId', '==', engagementId)
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  }

  private async getTotalProgramCount(): Promise<number> {
    const snapshot = await getDocs(collection(this.db, PROGRAMS_PATH));
    return snapshot.size;
  }

  private async logActivity(
    programId: string,
    action: string,
    userId: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const activityRef = collection(
      this.db,
      PROGRAMS_PATH,
      programId,
      ACTIVITY_LOG_PATH
    );

    await addDoc(activityRef, {
      action,
      userId,
      details,
      timestamp: serverTimestamp(),
    });
  }
}

// Export singleton factory
export function getProgramService(db: Firestore): ProgramService {
  return ProgramService.getInstance(db);
}
