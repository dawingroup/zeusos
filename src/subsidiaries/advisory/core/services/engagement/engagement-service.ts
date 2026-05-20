/**
 * ENGAGEMENT SERVICE
 * 
 * Provides CRUD operations, filtering, and module management for engagements.
 * Integrates with Firestore and respects RBAC.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  writeBatch,
  onSnapshot,
  Unsubscribe,
  QueryConstraint,
  DocumentSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../../../../../firebase/config';
import { 
  Engagement,
  EngagementDomain,
  EngagementType,
  EngagementStatus,
  EngagementModules,
  EngagementTimeline,
  EngagementFilter,
  EngagementWithEntities,
  UpdateEngagementData as CoreUpdateEngagementData,
  generateEngagementCode,
} from '../../types';
import { TeamAssignment, TeamMember, TeamRole } from '../../types/engagement-team';
import { FundingCategory } from '../../types/funding';
import { Money } from '../../types/money';
import { engagementConverter, prepareForCreate, prepareForUpdate } from '../../firebase/converters';
import { COLLECTION_PATHS } from '../../firebase/collections';
import { createDefaultApprovalConfig } from '../../types/approval-chain';
import { getDefaultModules } from '../../types/engagement-modules';

// ============================================================================
// Types
// ============================================================================

/**
 * Data required to create a new engagement (service-level)
 */
export interface CreateEngagementInput {
  name: string;
  domain: EngagementDomain;
  type: EngagementType;
  clientId: string;
  clientName: string;
  description?: string;
  country: string;
  regions?: string[];
  sectors?: string[];
  effectiveDate?: Date;
  targetEndDate?: Date;
  teamMembers?: Omit<TeamMember, 'joinedAt'>[];
  modules?: Partial<EngagementModules>;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  pageSize: number;
  cursor?: DocumentSnapshot;
  sortField?: 'createdAt' | 'updatedAt' | 'name' | 'status';
  sortDirection?: 'asc' | 'desc';
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  hasMore: boolean;
  nextCursor?: DocumentSnapshot;
  totalCount?: number;
}

/**
 * Activity log entry
 */
export interface ActivityLogEntry {
  id: string;
  engagementId: string;
  action: string;
  entityType: string;
  entityId?: string;
  userId: string;
  userName: string;
  timestamp: Timestamp;
  details?: Record<string, unknown>;
}

/**
 * Module activation result
 */
export interface ModuleActivationResult {
  success: boolean;
  module: keyof EngagementModules;
  previousState: boolean;
  newState: boolean;
  setupActions?: string[];
}

/**
 * Funding summary for engagement
 */
export interface FundingSummary {
  totalCommitted: Money;
  totalDisbursed: Money;
  sourceCount: number;
  primaryCategory: FundingCategory;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getEngagementsCollection() {
  return collection(db, COLLECTION_PATHS.ENGAGEMENTS);
}

function getEngagementRef(id: string) {
  return doc(db, COLLECTION_PATHS.ENGAGEMENTS, id);
}

async function getCurrentUser() {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  return user;
}

// ============================================================================
// Service Class
// ============================================================================

export class EngagementService {
  private static instance: EngagementService;
  private subscriptions: Map<string, Unsubscribe> = new Map();

  private constructor() {}

  static getInstance(): EngagementService {
    if (!EngagementService.instance) {
      EngagementService.instance = new EngagementService();
    }
    return EngagementService.instance;
  }

  // --------------------------------------------------------------------------
  // Create Operations
  // --------------------------------------------------------------------------

  /**
   * Create a new engagement
   */
  async createEngagement(data: CreateEngagementInput): Promise<Engagement> {
    const user = await getCurrentUser();
    const now = Timestamp.now();
    const engagementId = doc(getEngagementsCollection()).id;

    // Generate code if not provided
    const code = generateEngagementCode(data.domain, data.country);

    // Build team assignment with creator as lead
    const teamMembers: TeamMember[] = [
      {
        userId: user.uid,
        name: user.displayName || 'Unknown',
        email: user.email || '',
        role: 'engagement_lead' as TeamRole,
        allocation: 100,
        startDate: now.toDate(),
        isActive: true,
      },
      ...(data.teamMembers?.map(m => ({ 
        ...m, 
        allocation: m.allocation || 100,
        startDate: new Date(),
        isActive: true,
      })) || []),
    ];

    const team: TeamAssignment = {
      leadId: user.uid,
      leadName: user.displayName || 'Unknown',
      leadEmail: user.email || '',
      members: teamMembers,
      externals: [],
    };

    // Build modules with sensible defaults based on domain
    const modules: EngagementModules = data.modules 
      ? {
          delivery: data.modules.delivery ?? false,
          investment: data.modules.investment ?? false,
          advisory: data.modules.advisory ?? false,
          matflow: data.modules.matflow ?? false,
        }
      : getDefaultModules(data.domain);

    // Build timeline
    const effectiveDate = data.effectiveDate ? Timestamp.fromDate(data.effectiveDate) : now;
    const timeline: EngagementTimeline = {
      effectiveDate,
      targetEndDate: data.targetEndDate ? Timestamp.fromDate(data.targetEndDate) : undefined,
      actualEndDate: undefined,
      milestones: [],
    };

    // Default money value
    const defaultMoney: Money = { amount: 0, currency: 'USD' };

    const engagement: Engagement = {
      id: engagementId,
      name: data.name,
      code,
      description: data.description || '',
      domain: data.domain,
      type: data.type,
      status: 'prospect',
      
      clientId: data.clientId,
      clientName: data.clientName,
      
      country: data.country,
      regions: data.regions || [],
      locations: [],
      sectors: (data.sectors || []) as any[],
      
      team,
      modules,
      timeline,
      
      fundingSources: [],
      totalValue: defaultMoney,
      primaryFundingCategory: 'grant',
      
      beneficiaries: [],
      partners: [],
      
      programIds: [],
      dealIds: [],
      portfolioIds: [],
      
      reportingRequirements: [],
      covenants: [],
      approvalConfig: createDefaultApprovalConfig(engagementId),
      
      createdAt: now,
      createdBy: user.uid,
      updatedAt: now,
    };

    // Save to Firestore
    const docRef = getEngagementRef(engagementId);
    await setDoc(docRef, prepareForCreate(engagement));

    // Log activity
    await this.logActivity(engagementId, {
      action: 'created',
      entityType: 'engagement',
      userId: user.uid,
      userName: user.displayName || 'Unknown',
      details: { name: engagement.name, domain: engagement.domain },
    });

    return engagement;
  }

  /**
   * Clone an existing engagement
   */
  async cloneEngagement(
    sourceId: string,
    overrides?: Partial<CreateEngagementInput>
  ): Promise<Engagement> {
    const source = await this.getEngagement(sourceId);
    if (!source) throw new Error('Source engagement not found');

    const cloneData: CreateEngagementInput = {
      name: overrides?.name || `${source.name} (Copy)`,
      domain: overrides?.domain || source.domain,
      type: overrides?.type || source.type,
      clientId: overrides?.clientId || source.clientId,
      clientName: overrides?.clientName || source.clientName,
      description: overrides?.description || source.description,
      country: overrides?.country || source.country,
      regions: overrides?.regions || source.regions,
      sectors: overrides?.sectors || (source.sectors as string[]),
      modules: overrides?.modules || source.modules,
    };

    return this.createEngagement(cloneData);
  }

  // --------------------------------------------------------------------------
  // Read Operations
  // --------------------------------------------------------------------------

  /**
   * Get a single engagement by ID
   */
  async getEngagement(id: string): Promise<Engagement | null> {
    const docRef = getEngagementRef(id).withConverter(engagementConverter);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  }

  /**
   * Get engagement with related entities
   */
  async getEngagementWithEntities(id: string): Promise<EngagementWithEntities | null> {
    const engagement = await this.getEngagement(id);
    if (!engagement) return null;

    // Load related entities (simplified for now)
    return {
      ...engagement,
      programs: [],
      deals: [],
      portfolios: [],
    };
  }

  /**
   * List engagements with filters and pagination
   */
  async listEngagements(
    filters: EngagementFilter = {},
    pagination: PaginationOptions = { pageSize: 20 }
  ): Promise<PaginatedResult<Engagement>> {
    const constraints: QueryConstraint[] = [];

    // Apply filters
    if (filters.domain) {
      constraints.push(where('domain', '==', filters.domain));
    }
    if (filters.type) {
      constraints.push(where('type', '==', filters.type));
    }
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        constraints.push(where('status', 'in', filters.status));
      } else {
        constraints.push(where('status', '==', filters.status));
      }
    }
    if (filters.clientId) {
      constraints.push(where('clientId', '==', filters.clientId));
    }
    if (filters.country) {
      constraints.push(where('country', '==', filters.country));
    }
    if (filters.leadId) {
      constraints.push(where('team.leadId', '==', filters.leadId));
    }
    if (filters.activeOnly) {
      constraints.push(where('status', 'in', ['active', 'draft']));
    }

    // Apply sorting
    const sortField = pagination.sortField || 'updatedAt';
    const sortDirection = pagination.sortDirection || 'desc';
    constraints.push(orderBy(sortField, sortDirection));

    // Apply pagination
    constraints.push(limit(pagination.pageSize + 1));
    if (pagination.cursor) {
      constraints.push(startAfter(pagination.cursor));
    }

    // Execute query
    const q = query(
      getEngagementsCollection().withConverter(engagementConverter),
      ...constraints
    );
    const snapshot = await getDocs(q);

    const docs = snapshot.docs;
    const hasMore = docs.length > pagination.pageSize;
    const data = docs.slice(0, pagination.pageSize).map(d => d.data());
    const nextCursor = hasMore ? docs[pagination.pageSize - 1] : undefined;

    // Post-query filtering for complex filters
    let filteredData = data;
    
    if (filters.teamMemberId) {
      filteredData = filteredData.filter(e => 
        e.team.members.some(m => m.userId === filters.teamMemberId)
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredData = filteredData.filter(e =>
        e.name.toLowerCase().includes(searchLower) ||
        e.code.toLowerCase().includes(searchLower) ||
        e.description?.toLowerCase().includes(searchLower) ||
        e.clientName.toLowerCase().includes(searchLower)
      );
    }

    return {
      data: filteredData,
      hasMore,
      nextCursor,
    };
  }

  /**
   * Get engagements for current user (team member)
   */
  async getMyEngagements(status?: EngagementStatus): Promise<Engagement[]> {
    const user = await getCurrentUser();
    
    // Query by team lead first (simpler index)
    const constraints: QueryConstraint[] = [
      where('team.leadId', '==', user.uid),
      orderBy('updatedAt', 'desc'),
    ];

    if (status) {
      constraints.push(where('status', '==', status));
    }

    const q = query(
      getEngagementsCollection().withConverter(engagementConverter),
      ...constraints
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data());
  }

  /**
   * Search engagements by name
   */
  async searchEngagements(
    searchTerm: string,
    maxResults: number = 10
  ): Promise<Engagement[]> {
    // Firestore doesn't support full-text search
    // For now, fetch recent engagements and filter client-side
    const q = query(
      getEngagementsCollection().withConverter(engagementConverter),
      orderBy('updatedAt', 'desc'),
      limit(100)
    );

    const snapshot = await getDocs(q);
    const searchLower = searchTerm.toLowerCase();
    
    return snapshot.docs
      .map(d => d.data())
      .filter(e =>
        e.name.toLowerCase().includes(searchLower) ||
        e.code.toLowerCase().includes(searchLower) ||
        e.clientName.toLowerCase().includes(searchLower)
      )
      .slice(0, maxResults);
  }

  // --------------------------------------------------------------------------
  // Update Operations
  // --------------------------------------------------------------------------

  /**
   * Update an engagement
   */
  async updateEngagement(
    id: string,
    updates: CoreUpdateEngagementData
  ): Promise<void> {
    const user = await getCurrentUser();

    const updateData = prepareForUpdate({
      ...updates,
      updatedBy: user.uid,
    });

    await updateDoc(getEngagementRef(id), updateData);

    // Log activity
    await this.logActivity(id, {
      action: 'updated',
      entityType: 'engagement',
      userId: user.uid,
      userName: user.displayName || 'Unknown',
      details: { fields: Object.keys(updates) },
    });
  }

  /**
   * Update engagement status with validation
   */
  async updateStatus(
    id: string,
    newStatus: EngagementStatus,
    reason?: string
  ): Promise<void> {
    const engagement = await this.getEngagement(id);
    if (!engagement) throw new Error('Engagement not found');

    // Validate status transition
    if (!this.isValidStatusTransition(engagement.status, newStatus)) {
      throw new Error(`Invalid status transition from ${engagement.status} to ${newStatus}`);
    }

    const user = await getCurrentUser();

    await updateDoc(getEngagementRef(id), {
      status: newStatus,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });

    // Log activity
    await this.logActivity(id, {
      action: 'status_changed',
      entityType: 'engagement',
      userId: user.uid,
      userName: user.displayName || 'Unknown',
      details: { 
        previousStatus: engagement.status, 
        newStatus, 
        reason 
      },
    });
  }

  /**
   * Validate status transition
   */
  private isValidStatusTransition(
    current: EngagementStatus,
    next: EngagementStatus
  ): boolean {
    // Use the STATUS_TRANSITIONS from engagement-status.ts
    const transitions: Record<EngagementStatus, EngagementStatus[]> = {
      prospect: ['onboarding', 'terminated'],
      onboarding: ['active', 'on_hold', 'terminated'],
      active: ['on_hold', 'closing', 'terminated'],
      on_hold: ['active', 'closing', 'terminated'],
      closing: ['completed', 'terminated'],
      completed: [],
      terminated: [],
    };

    return transitions[current]?.includes(next) ?? false;
  }

  // --------------------------------------------------------------------------
  // Team Management
  // --------------------------------------------------------------------------

  /**
   * Add team member to engagement
   */
  async addTeamMember(
    engagementId: string,
    member: Omit<TeamMember, 'startDate' | 'isActive'>
  ): Promise<void> {
    const engagement = await this.getEngagement(engagementId);
    if (!engagement) throw new Error('Engagement not found');

    const user = await getCurrentUser();

    // Check if member already exists
    const existingMember = engagement.team.members.find(m => m.userId === member.userId);
    if (existingMember) {
      throw new Error('User is already a team member');
    }

    const newMember: TeamMember = {
      ...member,
      startDate: new Date(),
      isActive: true,
    };

    const updatedMembers = [...engagement.team.members, newMember];

    await updateDoc(getEngagementRef(engagementId), {
      'team.members': updatedMembers,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });

    // Log activity
    await this.logActivity(engagementId, {
      action: 'team_member_added',
      entityType: 'team',
      userId: user.uid,
      userName: user.displayName || 'Unknown',
      details: { newMember: { userId: member.userId, role: member.role } },
    });
  }

  /**
   * Update team member role
   */
  async updateTeamMemberRole(
    engagementId: string,
    userId: string,
    newRole: TeamRole
  ): Promise<void> {
    const engagement = await this.getEngagement(engagementId);
    if (!engagement) throw new Error('Engagement not found');

    const user = await getCurrentUser();

    const updatedMembers = engagement.team.members.map(m =>
      m.userId === userId ? { ...m, role: newRole } : m
    );

    await updateDoc(getEngagementRef(engagementId), {
      'team.members': updatedMembers,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
  }

  /**
   * Remove team member from engagement
   */
  async removeTeamMember(
    engagementId: string,
    userId: string
  ): Promise<void> {
    const engagement = await this.getEngagement(engagementId);
    if (!engagement) throw new Error('Engagement not found');

    const user = await getCurrentUser();

    // Filter out the member
    const updatedMembers = engagement.team.members.filter(m => m.userId !== userId);

    await updateDoc(getEngagementRef(engagementId), {
      'team.members': updatedMembers,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });

    // Log activity
    await this.logActivity(engagementId, {
      action: 'team_member_removed',
      entityType: 'team',
      userId: user.uid,
      userName: user.displayName || 'Unknown',
      details: { removedUserId: userId },
    });
  }

  // --------------------------------------------------------------------------
  // Module Management
  // --------------------------------------------------------------------------

  /**
   * Activate a module for an engagement
   */
  async activateModule(
    engagementId: string,
    module: keyof EngagementModules
  ): Promise<ModuleActivationResult> {
    const engagement = await this.getEngagement(engagementId);
    if (!engagement) throw new Error('Engagement not found');

    const user = await getCurrentUser();
    const previousState = engagement.modules[module];
    
    if (previousState) {
      return {
        success: true,
        module,
        previousState,
        newState: true,
        setupActions: [],
      };
    }

    // Activate the module
    await updateDoc(getEngagementRef(engagementId), {
      [`modules.${module}`]: true,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });

    // Perform module-specific setup
    const setupActions = await this.performModuleSetup(engagementId, module);

    // Log activity
    await this.logActivity(engagementId, {
      action: 'module_activated',
      entityType: 'module',
      userId: user.uid,
      userName: user.displayName || 'Unknown',
      details: { module, setupActions },
    });

    return {
      success: true,
      module,
      previousState,
      newState: true,
      setupActions,
    };
  }

  /**
   * Deactivate a module for an engagement
   */
  async deactivateModule(
    engagementId: string,
    module: keyof EngagementModules
  ): Promise<ModuleActivationResult> {
    const engagement = await this.getEngagement(engagementId);
    if (!engagement) throw new Error('Engagement not found');

    const user = await getCurrentUser();
    const previousState = engagement.modules[module];

    // Check if module can be deactivated
    const canDeactivate = await this.canDeactivateModule(engagementId, module);
    if (!canDeactivate) {
      throw new Error(`Cannot deactivate ${module} module: active entities exist`);
    }

    await updateDoc(getEngagementRef(engagementId), {
      [`modules.${module}`]: false,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });

    return {
      success: true,
      module,
      previousState,
      newState: false,
    };
  }

  /**
   * Perform module-specific setup
   */
  private async performModuleSetup(
    _engagementId: string,
    module: keyof EngagementModules
  ): Promise<string[]> {
    const setupActions: string[] = [];

    switch (module) {
      case 'delivery':
        setupActions.push('Default program structure available');
        break;
      
      case 'investment':
        setupActions.push('Deal pipeline initialized');
        break;
      
      case 'advisory':
        setupActions.push('Portfolio tracking enabled');
        break;
      
      case 'matflow':
        setupActions.push('BOQ management enabled');
        setupActions.push('Material tracking enabled');
        break;
    }

    return setupActions;
  }

  /**
   * Check if module can be deactivated
   */
  private async canDeactivateModule(
    engagementId: string,
    module: keyof EngagementModules
  ): Promise<boolean> {
    const engagement = await this.getEngagement(engagementId);
    if (!engagement) return false;

    switch (module) {
      case 'delivery':
        return engagement.programIds.length === 0;
      
      case 'investment':
        return engagement.dealIds.length === 0;
      
      case 'advisory':
        return engagement.portfolioIds.length === 0;
      
      case 'matflow':
        return true; // Always allow for now
      
      default:
        return true;
    }
  }

  // --------------------------------------------------------------------------
  // Delete Operations
  // --------------------------------------------------------------------------

  /**
   * Archive an engagement (soft delete)
   */
  async archiveEngagement(id: string): Promise<void> {
    // 'terminated' is the closest equivalent to archive in the status model
    await this.updateStatus(id, 'terminated', 'Archived by user');
  }

  /**
   * Permanently delete an engagement (admin only)
   */
  async deleteEngagement(id: string): Promise<void> {
    // Verify user is authenticated before deletion
    await getCurrentUser();

    const batch = writeBatch(db);
    batch.delete(getEngagementRef(id));

    await batch.commit();

    // Note: Subcollections need Cloud Functions for recursive delete
  }

  // --------------------------------------------------------------------------
  // Real-time Subscriptions
  // --------------------------------------------------------------------------

  /**
   * Subscribe to engagement updates
   */
  subscribeToEngagement(
    id: string,
    callback: (engagement: Engagement | null) => void
  ): Unsubscribe {
    const unsubscribe = onSnapshot(
      getEngagementRef(id).withConverter(engagementConverter),
      (snapshot) => {
        callback(snapshot.exists() ? snapshot.data() : null);
      },
      (error) => {
        console.error('Error subscribing to engagement:', error);
        callback(null);
      }
    );

    this.subscriptions.set(`engagement:${id}`, unsubscribe);
    return unsubscribe;
  }

  /**
   * Subscribe to engagement list with filters
   */
  subscribeToEngagements(
    filters: EngagementFilter,
    callback: (engagements: Engagement[]) => void
  ): Unsubscribe {
    const constraints: QueryConstraint[] = [];

    if (filters.domain) {
      constraints.push(where('domain', '==', filters.domain));
    }
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        constraints.push(where('status', 'in', filters.status));
      } else {
        constraints.push(where('status', '==', filters.status));
      }
    }
    if (filters.clientId) {
      constraints.push(where('clientId', '==', filters.clientId));
    }

    constraints.push(orderBy('updatedAt', 'desc'));

    const q = query(
      getEngagementsCollection().withConverter(engagementConverter),
      ...constraints
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const engagements = snapshot.docs.map(d => d.data());
        callback(engagements);
      },
      (error) => {
        console.error('Error subscribing to engagements:', error);
        callback([]);
      }
    );

    const key = `engagements:${JSON.stringify(filters)}`;
    this.subscriptions.set(key, unsubscribe);
    return unsubscribe;
  }

  /**
   * Unsubscribe all subscriptions
   */
  unsubscribeAll(): void {
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions.clear();
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  /**
   * Get funding summary for engagement
   */
  async getFundingSummary(engagementId: string): Promise<FundingSummary | undefined> {
    const engagement = await this.getEngagement(engagementId);
    if (!engagement || engagement.fundingSources.length === 0) return undefined;

    const totalCommitted: Money = {
      amount: engagement.fundingSources.reduce((sum, fs) => sum + (fs.committedAmount?.amount || 0), 0),
      currency: engagement.totalValue.currency,
    };

    const totalDisbursed: Money = {
      amount: engagement.fundingSources.reduce((sum, fs) => sum + (fs.disbursedAmount?.amount || 0), 0),
      currency: engagement.totalValue.currency,
    };

    return {
      totalCommitted,
      totalDisbursed,
      sourceCount: engagement.fundingSources.length,
      primaryCategory: engagement.primaryFundingCategory,
    };
  }

  /**
   * Get pending approvals count
   */
  async getPendingApprovalsCount(engagementId: string): Promise<number> {
    const q = query(
      collection(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, COLLECTION_PATHS.APPROVAL_REQUESTS),
      where('status', '==', 'pending')
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  }

  /**
   * Get recent activity for engagement
   */
  async getRecentActivity(
    engagementId: string,
    maxItems: number = 10
  ): Promise<ActivityLogEntry[]> {
    const q = query(
      collection(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, COLLECTION_PATHS.ACTIVITY_LOG),
      orderBy('timestamp', 'desc'),
      limit(maxItems)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      id: d.id,
      engagementId,
      ...d.data(),
    })) as ActivityLogEntry[];
  }

  /**
   * Log activity to engagement
   */
  private async logActivity(
    engagementId: string,
    activity: Omit<ActivityLogEntry, 'id' | 'engagementId' | 'timestamp'>
  ): Promise<void> {
    try {
      const activityRef = doc(
        collection(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, COLLECTION_PATHS.ACTIVITY_LOG)
      );
      
      await setDoc(activityRef, {
        ...activity,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      // Don't fail the main operation if logging fails
      console.error('Failed to log activity:', error);
    }
  }
}

// Export singleton instance
export const engagementService = EngagementService.getInstance();
