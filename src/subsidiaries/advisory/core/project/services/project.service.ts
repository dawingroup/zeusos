/**
 * CORE PROJECT SERVICE
 * =================================================================
 * This is the canonical service for managing "Project" entities within Zeus Group.
 * It consolidates logic from the original Delivery and MatFlow services.
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
  writeBatch,
  increment,
  QueryConstraint,
  Firestore,
} from 'firebase/firestore';
import {
  Project,
  ProjectFormData,
  ProjectStatus,
  ProjectStage,
  ProjectSettings
} from '../types/project.types';
// FacilityBranding inlined after Phase 1.C deletion of advisory/delivery (construction-project-delivery sub-module). TODO Phase 3: replace with Campaign-branding equivalent.
type FacilityBranding = { name?: string; logoUrl?: string };

// =================================================================
// SERVICE CONFIGURATION
// =================================================================

// Phase 2.D: collection renamed `advisory_projects` → `campaigns`. The
// AdvisoryProject TypeScript type is retained for now and becomes Campaign's
// financial backbone in Phase 3 when the campaign-specific fields (clientId,
// brandId, imcTeam, bigIdea, tier, performanceReview) are layered on.
const getProjectsCollection = (orgId: string) => `organizations/${orgId}/campaigns`;
const getProjectDoc = (orgId: string, id: string) => `${getProjectsCollection(orgId)}/${id}`;
const getProgramDoc = (orgId: string, id: string) => `organizations/${orgId}/advisory_programs/${id}`;


// =================================================================
// PROJECT SERVICE CLASS
// =================================================================

export class ProjectService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPER: Enrich projects with programName
  // ─────────────────────────────────────────────────────────────────

  /**
   * Fetch all programs and build a map of programId -> programName
   * This is used to denormalize programName on projects for UI display
   */
  private async getProgramNameMap(orgId: string): Promise<Map<string, string>> {
    const programsRef = collection(this.db, `organizations/${orgId}/advisory_programs`);
    const snapshot = await getDocs(programsRef);
    const map = new Map<string, string>();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.name) {
        map.set(doc.id, data.name);
      }
    });
    return map;
  }

  /**
   * Enrich a list of projects with programName from their associated programs
   */
  private async enrichProjectsWithProgramName(orgId: string, projects: Project[]): Promise<Project[]> {
    if (projects.length === 0) return projects;

    // Get unique program IDs
    const programIds = new Set(projects.map(p => p.programId).filter(Boolean));
    if (programIds.size === 0) return projects;

    // Fetch program names
    const programNameMap = await this.getProgramNameMap(orgId);

    // Enrich projects
    return projects.map(project => ({
      ...project,
      programName: project.programId ? programNameMap.get(project.programId) : undefined,
    }));
  }

  // ─────────────────────────────────────────────────────────────────
  // CODE GENERATION (Adapted from MatFlow)
  // ─────────────────────────────────────────────────────────────────
  private async generateProjectCode(orgId: string, programCode: string): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = `${programCode}-${year}-`;

    const q = query(
      collection(this.db, getProjectsCollection(orgId)),
      where('projectCode', '>=', prefix),
      where('projectCode', '<', prefix + '\uf8ff'),
      orderBy('projectCode', 'desc'),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return `${prefix}001`;
    }
    
    const lastCode = snapshot.docs[0].data().projectCode;
    const lastNumber = parseInt(lastCode.split('-').pop() || '0', 10);
    return `${prefix}${String(lastNumber + 1).padStart(3, '0')}`;
  }


  // ─────────────────────────────────────────────────────────────────
  // CREATE (Consolidated)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get or create default program for projects without a program
   */
  private async getOrCreateDefaultProgram(orgId: string, userId: string): Promise<any> {
    const programsCol = collection(this.db, `organizations/${orgId}/advisory_programs`);

    // Try to find existing default program
    const q = query(programsCol, where('code', '==', 'DEFAULT'), limit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }

    // Create default program
    const defaultProgram = {
      name: 'General Projects',
      code: 'DEFAULT',
      description: 'Default program for projects without a specific program',
      status: 'active',
      engagementId: null,
      customerId: null,
      customerName: '',
      location: {
        country: 'Unknown',
        region: '',
      },
      projectStats: {
        total: 0,
        byStatus: {
          planning: 0,
          procurement: 0,
          mobilization: 0,
          active: 0,
          substantial_completion: 0,
          defects_liability: 0,
          completed: 0,
          suspended: 0,
          cancelled: 0,
        },
      },
      createdAt: Timestamp.now(),
      createdBy: userId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
      isDeleted: false,
    };

    const docRef = await addDoc(programsCol, defaultProgram);
    return { id: docRef.id, ...defaultProgram };
  }

  async createProject(
    orgId: string,
    userId: string,
    data: ProjectFormData
  ): Promise<Project> {

    // 1. Get Program for context (or create default if not provided)
    let program: any;
    let programId = data.programId;

    if (!programId) {
      // No program specified, use default
      const defaultProgram = await this.getOrCreateDefaultProgram(orgId, userId);
      program = defaultProgram;
      programId = defaultProgram.id;
    } else {
      // Try to get specified program
      const programDocRef = doc(this.db, getProgramDoc(orgId, programId));
      const programDoc = await getDoc(programDocRef);

      if (!programDoc.exists()) {
        // Program doesn't exist, fall back to default
        const defaultProgram = await this.getOrCreateDefaultProgram(orgId, userId);
        program = defaultProgram;
        programId = defaultProgram.id;
      } else {
        program = programDoc.data();
      }
    }

    // 2. Generate Code
    const projectCode = await this.generateProjectCode(orgId, program.code || 'PROG');

    // 3. Define Default Structures
    const defaultSettings: ProjectSettings = {
      taxEnabled: false,
      taxRate: 18,
      defaultWastagePercent: 10,
    };
    
    const defaultStages: ProjectStage[] = [
        { id: 'preliminaries', name: 'Preliminaries', order: 1, status: 'not_started', completionPercent: 0 },
        { id: 'substructures', name: 'Substructures', order: 2, status: 'not_started', completionPercent: 0 },
        { id: 'superstructure', name: 'Superstructure', order: 3, status: 'not_started', completionPercent: 0 },
        { id: 'finishes', name: 'Finishes', order: 4, status: 'not_started', completionPercent: 0 },
        { id: 'external_works', name: 'External Works', order: 5, status: 'not_started', completionPercent: 0 },
    ];

    // 4. Build Canonical Project Object
    const newProjectData: Omit<Project, 'id'> = {
      name: data.name,
      projectCode,
      description: data.description || '',
      programId: programId, // Use resolved programId
      engagementId: program.engagementId || null,
      customerId: data.customerId || program.customerId || null,
      customerName: program.customerName || '', // Inherit from program
      status: 'planning',
      projectType: data.projectType || 'new_construction',
      location: {
        country: program.location?.country || 'Unknown',
        region: data.location?.region || program.location?.region || '',
        district: data.location?.district || '',
        siteName: data.location?.siteName || data.name,
      },
      budget: {
        currency: data.budgetCurrency || 'UGX',
        totalBudget: data.budgetAmount || 0,
        spent: 0,
        committed: 0,
        remaining: data.budgetAmount || 0,
        variance: 0,
        varianceStatus: 'on_track',
        contingencyPercent: 10,
      },
      progress: {
        physicalProgress: 0,
        financialProgress: 0,
        completionPercent: 0,
        progressStatus: 'on_track',
      },
      timeline: (() => {
        // Provide default dates if not supplied
        const now = new Date();
        const defaultStartDate = data.estimatedStartDate || now;
        const defaultEndDate = data.estimatedEndDate || new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now

        return {
          plannedStartDate: defaultStartDate,
          plannedEndDate: defaultEndDate,
          currentStartDate: defaultStartDate,
          currentEndDate: defaultEndDate,
          isDelayed: false,
          daysRemaining: Math.floor((defaultEndDate.getTime() - now.getTime()) / (1000 * 3600 * 24)),
          currentDuration: Math.floor((defaultEndDate.getTime() - defaultStartDate.getTime()) / (1000 * 3600 * 24)),
          percentTimeElapsed: 0,
          delayDays: 0,
        };
      })(),
      settings: defaultSettings,
      stages: defaultStages,
      members: [],
      boqIds: [],
      createdAt: Timestamp.now(),
      createdBy: userId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
      version: 1,
      isDeleted: false,
    };

    // 5. Save to Firestore
    const docRef = await addDoc(collection(this.db, getProjectsCollection(orgId)), newProjectData);

    // 6. Update Program Stats (use resolved programId)
    const resolvedProgramRef = doc(this.db, getProgramDoc(orgId, programId));
    await updateDoc(resolvedProgramRef, {
        'projectStats.total': increment(1),
        'projectStats.byStatus.planning': increment(1),
    });

    return { id: docRef.id, ...newProjectData };
  }

  // ─────────────────────────────────────────────────────────────────
  // READ (Adapted from Delivery)
  // ─────────────────────────────────────────────────────────────────

  async getProject(orgId: string, projectId: string): Promise<Project | null> {
    const docRef = doc(this.db, getProjectDoc(orgId, projectId));
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists() || snapshot.data().isDeleted) {
      return null;
    }
    const project = { id: snapshot.id, ...snapshot.data() } as Project;

    // Enrich with programName for UI display
    if (project.programId) {
      const programDoc = await getDoc(doc(this.db, getProgramDoc(orgId, project.programId)));
      if (programDoc.exists()) {
        project.programName = programDoc.data().name;
      }
    }

    return project;
  }

  async getAllProjects(
    orgId: string,
    options?: {
      status?: ProjectStatus[];
      orderByField?: 'name' | 'createdAt' | 'status';
      orderDirection?: 'asc' | 'desc';
      limitCount?: number;
      includeDeleted?: boolean;
    }
  ): Promise<Project[]> {
    const collectionPath = getProjectsCollection(orgId);

    try {
      // Build constraints.
      // NOTE: we avoid querying with isDeleted here to prevent composite index requirements
      // in environments where index rollout lags; we filter isDeleted in memory instead.
      const constraints: QueryConstraint[] = [];

      // Add status filter if provided
      if (options?.status && options.status.length > 0) {
        if (options.status.length === 1) {
          constraints.push(where('status', '==', options.status[0]));
        }
      }

      // Add ordering
      const orderField = options?.orderByField || 'createdAt';
      const orderDir = options?.orderDirection || 'desc';
      constraints.push(orderBy(orderField, orderDir));

      // Add limit if provided
      if (options?.limitCount) {
        constraints.push(limit(options.limitCount));
      }

      const q = query(collection(this.db, collectionPath), ...constraints);
      const snapshot = await getDocs(q);

      let projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[];

      // Filter by status in memory if multiple statuses
      if (options?.status && options.status.length > 1) {
        projects = projects.filter(p => options.status!.includes(p.status));
      }

      // Filter out deleted in memory (for projects that might not have isDeleted field)
      if (!options?.includeDeleted) {
        projects = projects.filter(p => p.isDeleted !== true);
      }

      // Enrich with programName for UI display
      return this.enrichProjectsWithProgramName(orgId, projects);
    } catch (error) {
      console.error('[CoreProjectService.getAllProjects] Error querying projects:', error);

      // Fallback: try without the isDeleted filter and use createdAt ordering
      // (which doesn't require a composite index)
      try {
        const fallbackConstraints: QueryConstraint[] = [];
        // Always use createdAt for fallback to avoid index requirements
        fallbackConstraints.push(orderBy('createdAt', 'desc'));

        if (options?.limitCount) {
          fallbackConstraints.push(limit(options.limitCount));
        }

        const fallbackQ = query(collection(this.db, collectionPath), ...fallbackConstraints);
        const fallbackSnapshot = await getDocs(fallbackQ);

        let projects = fallbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[];

        // Filter out deleted in memory
        if (!options?.includeDeleted) {
          projects = projects.filter(p => p.isDeleted !== true);
        }

        // Filter by status in memory
        if (options?.status && options.status.length > 0) {
          projects = projects.filter(p => options.status!.includes(p.status));
        }

        // Sort in memory if a different orderBy was requested
        const orderField = options?.orderByField || 'createdAt';
        const orderDir = options?.orderDirection || 'desc';
        if (orderField !== 'createdAt') {
          projects.sort((a, b) => {
            const aVal = (a as any)[orderField] || '';
            const bVal = (b as any)[orderField] || '';
            const comparison = String(aVal).localeCompare(String(bVal));
            return orderDir === 'asc' ? comparison : -comparison;
          });
        }

        // Enrich with programName for UI display
        return this.enrichProjectsWithProgramName(orgId, projects);
      } catch (fallbackError) {
        console.error('[CoreProjectService.getAllProjects] Fallback query also failed:', fallbackError);
        throw error; // Throw the original error
      }
    }
  }

  async getProjectsByProgram(
    orgId: string,
    programId: string,
    options?: {
      status?: ProjectStatus[];
    }
  ): Promise<Project[]> {
    const constraints: QueryConstraint[] = [
      where('programId', '==', programId),
      where('isDeleted', '==', false),
      orderBy('createdAt', 'desc')
    ];

    const q = query(collection(this.db, getProjectsCollection(orgId)), ...constraints);
    const snapshot = await getDocs(q);
    let projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[];

    // Filter by status if provided
    if (options?.status && options.status.length > 0) {
      projects = projects.filter(p => options.status!.includes(p.status));
    }

    // Enrich with programName for UI display
    return this.enrichProjectsWithProgramName(orgId, projects);
  }

  subscribeToProject(orgId: string, projectId: string, callback: (project: Project | null) => void): () => void {
    const docRef = doc(this.db, getProjectDoc(orgId, projectId));
    return onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists() && !snapshot.data().isDeleted) {
        callback({ id: snapshot.id, ...snapshot.data() } as Project);
      } else {
        callback(null);
      }
    });
  }

  subscribeToProjectsByProgram(
    orgId: string,
    programId: string,
    callback: (projects: Project[]) => void
  ): () => void {
    const q = query(
      collection(this.db, getProjectsCollection(orgId)),
      where('programId', '==', programId),
      where('isDeleted', '==', false),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[];
      callback(projects);
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // UPDATE (Consolidated)
  // ─────────────────────────────────────────────────────────────────

  async updateProject(orgId: string, projectId: string, userId: string, updates: Partial<Project>): Promise<void> {
    const docRef = doc(this.db, getProjectDoc(orgId, projectId));
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
      version: increment(1),
    });
  }
  
  // Includes logic from delivery/project-service
  async updateProjectStatus(orgId: string, projectId: string, newStatus: ProjectStatus, userId: string): Promise<void> {
    const project = await this.getProject(orgId, projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const oldStatus = project.status;
    // TODO: Add back status transition validation logic if needed

    const batch = writeBatch(this.db);
    const projectRef = doc(this.db, getProjectDoc(orgId, projectId));
    batch.update(projectRef, { status: newStatus, updatedAt: serverTimestamp(), updatedBy: userId });

    const programRef = doc(this.db, getProgramDoc(orgId, project.programId));
    batch.update(programRef, {
        [`projectStats.byStatus.${oldStatus}`]: increment(-1),
        [`projectStats.byStatus.${newStatus}`]: increment(1),
    });

    await batch.commit();
  }

  // ─────────────────────────────────────────────────────────────────
  // FACILITY BRANDING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Update facility branding for a project
   * Used for generating branded documents like Funds Acknowledgement Forms
   */
  async updateFacilityBranding(
    orgId: string,
    projectId: string,
    branding: FacilityBranding,
    userId: string
  ): Promise<void> {
    const docRef = doc(this.db, getProjectDoc(orgId, projectId));
    await updateDoc(docRef, {
      facilityBranding: branding,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
      version: increment(1),
    });
  }

  /**
   * Get facility branding for a project
   */
  async getFacilityBranding(orgId: string, projectId: string): Promise<FacilityBranding | null> {
    const project = await this.getProject(orgId, projectId);
    return project?.facilityBranding || null;
  }

  // ─────────────────────────────────────────────────────────────────
  // DELETE (Soft Delete from MatFlow)
  // ─────────────────────────────────────────────────────────────────

  async deleteProject(orgId: string, projectId: string, userId: string): Promise<void> {
    const docRef = doc(this.db, getProjectDoc(orgId, projectId));
    const project = await this.getProject(orgId, projectId);

    if(!project) return;

    await updateDoc(docRef, {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: userId,
      status: 'cancelled', // Also update status
    });

    // Decrement program stats
    const programRef = doc(this.db, getProgramDoc(orgId, project.programId));
    await updateDoc(programRef, {
        'projectStats.total': increment(-1),
        [`projectStats.byStatus.${project.status}`]: increment(-1),
    });
  }
}

// =================================================================
// SERVICE INSTANCE FACTORY
// =================================================================

let projectServiceInstance: ProjectService;

export function getProjectService(db: Firestore): ProjectService {
  if (!projectServiceInstance) {
    projectServiceInstance = new ProjectService(db);
  }
  return projectServiceInstance;
}
