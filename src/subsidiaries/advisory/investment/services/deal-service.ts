/**
 * Deal Service
 * 
 * Handles all deal CRUD operations, stage transitions,
 * and pipeline management.
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
  Timestamp,
  onSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import {
  Deal,
  DealFormData,
  DealSummary,
  DealStatus,
  DealActivity,
  DealActivityType,
  MoneyAmount,
  Sector,
} from '../types/deal';
import {
  DealStage,
  StageHistory,
  ALLOWED_TRANSITIONS,
  DEFAULT_STAGE_CONFIGS,
} from '../types/deal-stage';
import { TeamMember } from '../types/deal-team';
import { InvestmentStructure } from '../types/deal-structure';
import { DealGeography } from '../types/deal-geography';

// Collection paths
const DEALS_COLLECTION = 'advisoryPlatform/investment/deals';
const ACTIVITY_SUBCOLLECTION = 'activityLog';

export class DealService {
  // ==================== CRUD Operations ====================

  /**
   * Create a new deal
   */
  async createDeal(
    engagementId: string,
    data: DealFormData,
    createdBy: string
  ): Promise<Deal> {
    const dealRef = doc(collection(db, DEALS_COLLECTION));
    const dealCode = await this.generateDealCode(data.sector);

    // Sanitize investment structure - Firestore doesn't accept undefined
    const sanitizedInvestmentStructure = {
      primaryType: data.investmentStructure?.primaryType || 'equity',
      instruments: data.investmentStructure?.instruments || [],
    } as InvestmentStructure;

    // Sanitize geography
    const sanitizedGeography = {
      country: data.geography?.country || 'UG',
      region: data.geography?.region || '',
      city: data.geography?.city || '',
    } as DealGeography;

    // Build deal object, excluding undefined fields
    const deal: Deal = {
      id: dealRef.id,
      engagementId: engagementId || '',
      dealCode,
      name: data.name,
      description: data.description || '',
      dealType: data.dealType,
      sector: data.sector,
      subsector: data.subsector || '',
      status: 'active',
      currentStage: 'screening',
      stageHistory: [{
        stage: 'screening',
        enteredAt: Timestamp.now(),
      }],
      stageEnteredAt: Timestamp.now(),
      ...(data.expectedCloseDate && { expectedCloseDate: data.expectedCloseDate }),
      investmentStructure: sanitizedInvestmentStructure,
      targetAmount: data.targetAmount || { amount: 0, currency: 'USD' },
      geography: sanitizedGeography,
      dealTeam: {
        dealLead: {
          userId: createdBy,
          name: '',
          email: '',
          role: 'deal_lead',
          joinedAt: new Date(),
        },
        members: [],
      },
      dueDiligenceStatus: {
        status: 'not_started',
        completionPercentage: 0,
        redFlagsCount: 0,
        lastUpdated: Timestamp.now(),
      },
      matflowLinked: false,
      priority: 'medium',
      confidentiality: 'confidential',
      createdAt: Timestamp.now(),
      createdBy,
      updatedAt: Timestamp.now(),
      updatedBy: createdBy,
    };

    await setDoc(dealRef, deal);
    await this.logActivity(deal.id, 'created', 'Deal created', createdBy);

    return deal;
  }

  /**
   * Get a deal by ID
   */
  async getDeal(dealId: string): Promise<Deal | null> {
    const dealRef = doc(db, DEALS_COLLECTION, dealId);
    const dealSnap = await getDoc(dealRef);

    if (!dealSnap.exists()) {
      return null;
    }

    return dealSnap.data() as Deal;
  }

  /**
   * Update a deal
   */
  async updateDeal(
    dealId: string,
    updates: Partial<Deal>,
    updatedBy: string
  ): Promise<void> {
    const dealRef = doc(db, DEALS_COLLECTION, dealId);

    await updateDoc(dealRef, {
      ...updates,
      updatedAt: Timestamp.now(),
      updatedBy,
    });

    await this.logActivity(dealId, 'stage_changed', 'Deal updated', updatedBy, updates);
  }

  /**
   * Delete a deal (soft delete by changing status)
   */
  async deleteDeal(dealId: string, deletedBy: string): Promise<void> {
    await this.updateDeal(dealId, { status: 'withdrawn' }, deletedBy);
    await this.logActivity(dealId, 'status_changed', 'Deal withdrawn', deletedBy);
  }

  // ==================== Query Operations ====================

  /**
   * Get deals by engagement
   */
  async getDealsByEngagement(engagementId: string): Promise<Deal[]> {
    const q = query(
      collection(db, DEALS_COLLECTION),
      where('engagementId', '==', engagementId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as Deal);
  }

  /**
   * Get deals by stage (for pipeline view)
   */
  async getDealsByStage(stage: DealStage): Promise<DealSummary[]> {
    const q = query(
      collection(db, DEALS_COLLECTION),
      where('currentStage', '==', stage),
      where('status', '==', 'active'),
      orderBy('stageEnteredAt', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => this.toDealSummary(d.data() as Deal));
  }

  /**
   * Get pipeline summary (counts by stage)
   */
  async getPipelineSummary(): Promise<PipelineSummary> {
    const stages: DealStage[] = [
      'screening', 'preliminary', 'due_diligence', 'negotiation',
      'documentation', 'closing', 'post_closing', 'asset_management',
    ];

    const summary: PipelineSummary = {
      stages: {} as Record<DealStage, { count: number; value: MoneyAmount }>,
      totalDeals: 0,
      totalValue: { amount: 0, currency: 'USD' },
    };

    for (const stage of stages) {
      const q = query(
        collection(db, DEALS_COLLECTION),
        where('currentStage', '==', stage),
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(q);
      
      let stageValue = 0;
      snapshot.docs.forEach(d => {
        const deal = d.data() as Deal;
        stageValue += deal.targetAmount.amount;
      });

      summary.stages[stage] = {
        count: snapshot.size,
        value: { amount: stageValue, currency: 'USD' },
      };
      summary.totalDeals += snapshot.size;
      summary.totalValue.amount += stageValue;
    }

    return summary;
  }

  /**
   * Search deals with filters
   */
  async searchDeals(filters: DealFilters): Promise<DealSummary[]> {
    const constraints: QueryConstraint[] = [];

    if (filters.status) {
      constraints.push(where('status', '==', filters.status));
    }
    if (filters.stage) {
      constraints.push(where('currentStage', '==', filters.stage));
    }
    if (filters.sector) {
      constraints.push(where('sector', '==', filters.sector));
    }
    if (filters.dealType) {
      constraints.push(where('dealType', '==', filters.dealType));
    }
    if (filters.country) {
      constraints.push(where('geography.country', '==', filters.country));
    }
    if (filters.priority) {
      constraints.push(where('priority', '==', filters.priority));
    }

    constraints.push(orderBy('updatedAt', 'desc'));

    if (filters.limit) {
      constraints.push(limit(filters.limit));
    }

    const q = query(collection(db, DEALS_COLLECTION), ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map(d => this.toDealSummary(d.data() as Deal));
  }

  // ==================== Stage Management ====================

  /**
   * Change deal stage
   */
  async changeStage(
    dealId: string,
    newStage: DealStage,
    changedBy: string,
    notes?: string
  ): Promise<void> {
    const deal = await this.getDeal(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    // Validate transition
    const transition = ALLOWED_TRANSITIONS.find(
      t => t.fromStage === deal.currentStage && t.toStage === newStage
    );

    if (!transition || !transition.allowed) {
      throw new Error(`Invalid stage transition from ${deal.currentStage} to ${newStage}`);
    }

    // Update stage history
    const updatedHistory: StageHistory[] = [...deal.stageHistory];
    const lastEntry = updatedHistory[updatedHistory.length - 1];
    if (lastEntry && !lastEntry.exitedAt) {
      lastEntry.exitedAt = Timestamp.now();
      lastEntry.exitReason = 'approved';
      lastEntry.notes = notes;
    }

    updatedHistory.push({
      stage: newStage,
      enteredAt: Timestamp.now(),
    });

    await this.updateDeal(
      dealId,
      {
        currentStage: newStage,
        stageHistory: updatedHistory,
        stageEnteredAt: Timestamp.now(),
      },
      changedBy
    );

    await this.logActivity(
      dealId,
      'stage_changed',
      `Stage changed from ${deal.currentStage} to ${newStage}`,
      changedBy,
      { fromStage: deal.currentStage, toStage: newStage, notes }
    );
  }

  /**
   * Get stage gate status
   */
  async getStageGateStatus(dealId: string): Promise<StageGateStatus> {
    const deal = await this.getDeal(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    const stageConfig = DEFAULT_STAGE_CONFIGS.find(
      c => c.stage === deal.currentStage
    );

    if (!stageConfig) {
      return { canProgress: false, criteria: [], missingDocuments: [], pendingApprovals: [] };
    }

    // Check each gate criterion against deal data
    const missingDocuments: string[] = [];
    const pendingApprovals: string[] = [];

    const criteria = stageConfig.gateCriteria.map(c => {
      let met = false;

      switch (c.type) {
        case 'document':
          met = deal.documents?.some(
            (d: any) => d.type === c.id || d.name?.toLowerCase().includes(c.name.toLowerCase())
          ) ?? false;
          if (!met) missingDocuments.push(c.name);
          break;
        case 'approval':
          met = deal.approvals?.some(
            (a: any) => a.type === c.id && a.status === 'approved'
          ) ?? false;
          if (!met) pendingApprovals.push(c.name);
          break;
        case 'checklist':
          met = deal.checklistItems?.some(
            (item: any) => item.criterionId === c.id && item.completed
          ) ?? false;
          break;
        case 'metric':
          if (c.validationRule && deal.metrics) {
            const metricValue = deal.metrics[c.id];
            met = metricValue !== undefined && metricValue !== null;
          }
          break;
        default:
          met = false;
      }

      return { ...c, met };
    });

    const canProgress = criteria.every(c => !c.required || c.met);

    return { canProgress, criteria, missingDocuments, pendingApprovals };
  }

  // ==================== Team Management ====================

  /**
   * Add team member
   */
  async addTeamMember(
    dealId: string,
    member: TeamMember,
    addedBy: string
  ): Promise<void> {
    const deal = await this.getDeal(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    const updatedMembers = [...deal.dealTeam.members, member];

    await this.updateDeal(
      dealId,
      {
        dealTeam: {
          ...deal.dealTeam,
          members: updatedMembers,
        },
      },
      addedBy
    );

    await this.logActivity(
      dealId,
      'team_updated',
      `Team member added: ${member.name}`,
      addedBy,
      { memberId: member.userId, role: member.role }
    );
  }

  /**
   * Remove team member
   */
  async removeTeamMember(
    dealId: string,
    userId: string,
    removedBy: string
  ): Promise<void> {
    const deal = await this.getDeal(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    const updatedMembers = deal.dealTeam.members.filter(m => m.userId !== userId);

    await this.updateDeal(
      dealId,
      {
        dealTeam: {
          ...deal.dealTeam,
          members: updatedMembers,
        },
      },
      removedBy
    );

    await this.logActivity(
      dealId,
      'team_updated',
      `Team member removed`,
      removedBy,
      { memberId: userId }
    );
  }

  // ==================== Cross-Module Linking ====================

  /**
   * Link deal to delivery project
   */
  async linkToProject(
    dealId: string,
    projectId: string,
    linkedBy: string
  ): Promise<void> {
    await this.updateDeal(dealId, { linkedProjectId: projectId }, linkedBy);
    await this.logActivity(
      dealId,
      'project_linked',
      `Linked to delivery project ${projectId}`,
      linkedBy,
      { projectId }
    );
  }

  /**
   * Link deal to MatFlow BOQ
   */
  async linkToMatFlow(
    dealId: string,
    boqId: string,
    linkedBy: string
  ): Promise<void> {
    await this.updateDeal(
      dealId,
      { matflowLinked: true, matflowBoqId: boqId },
      linkedBy
    );
    await this.logActivity(
      dealId,
      'project_linked',
      `Linked to MatFlow BOQ ${boqId}`,
      linkedBy,
      { boqId }
    );
  }

  // ==================== Real-time Subscriptions ====================

  /**
   * Subscribe to deal changes
   */
  subscribeToDeal(
    dealId: string,
    callback: (deal: Deal | null) => void
  ): () => void {
    const dealRef = doc(db, DEALS_COLLECTION, dealId);
    return onSnapshot(dealRef, (snapshot) => {
      callback(snapshot.exists() ? (snapshot.data() as Deal) : null);
    });
  }

  /**
   * Subscribe to pipeline changes
   */
  subscribeToPipeline(
    callback: (deals: DealSummary[]) => void
  ): () => void {
    const q = query(
      collection(db, DEALS_COLLECTION),
      where('status', '==', 'active'),
      orderBy('currentStage'),
      orderBy('stageEnteredAt', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const deals = snapshot.docs.map(d => this.toDealSummary(d.data() as Deal));
      callback(deals);
    });
  }

  // ==================== Activity Logging ====================

  /**
   * Log deal activity
   */
  async logActivity(
    dealId: string,
    type: DealActivityType,
    description: string,
    createdBy: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const activityRef = doc(
      collection(db, DEALS_COLLECTION, dealId, ACTIVITY_SUBCOLLECTION)
    );

    const activity: DealActivity = {
      id: activityRef.id,
      dealId,
      type,
      description,
      metadata,
      createdAt: Timestamp.now(),
      createdBy,
    };

    await setDoc(activityRef, activity);
  }

  /**
   * Get deal activity history
   */
  async getActivityHistory(dealId: string, limitCount = 50): Promise<DealActivity[]> {
    const q = query(
      collection(db, DEALS_COLLECTION, dealId, ACTIVITY_SUBCOLLECTION),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as DealActivity);
  }

  // ==================== Helper Methods ====================

  /**
   * Generate deal code
   */
  private async generateDealCode(sector: Sector): Promise<string> {
    const year = new Date().getFullYear();
    const sectorPrefix = sector.substring(0, 3).toUpperCase();
    
    // Get count of deals this year for sequence
    const q = query(
      collection(db, DEALS_COLLECTION),
      where('dealCode', '>=', `DL-${sectorPrefix}-${year}`),
      where('dealCode', '<=', `DL-${sectorPrefix}-${year}\uf8ff`)
    );
    const snapshot = await getDocs(q);
    const sequence = (snapshot.size + 1).toString().padStart(3, '0');

    return `DL-${sectorPrefix}-${year}-${sequence}`;
  }

  /**
   * Convert Deal to DealSummary
   */
  private toDealSummary(deal: Deal): DealSummary {
    const now = new Date();
    const stageEnteredDate = deal.stageEnteredAt.toDate();
    const daysInStage = Math.floor(
      (now.getTime() - stageEnteredDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      id: deal.id,
      dealCode: deal.dealCode,
      name: deal.name,
      dealType: deal.dealType,
      sector: deal.sector,
      status: deal.status,
      currentStage: deal.currentStage,
      targetAmount: deal.targetAmount,
      geography: {
        country: deal.geography.country,
        region: deal.geography.region,
      },
      dueDiligenceStatus: deal.dueDiligenceStatus,
      priority: deal.priority,
      expectedCloseDate: deal.expectedCloseDate,
      daysInStage,
    };
  }
}

// Types for service methods
export interface DealFilters {
  status?: DealStatus;
  stage?: DealStage;
  sector?: string;
  dealType?: string;
  country?: string;
  priority?: string;
  limit?: number;
}

export interface PipelineSummary {
  stages: Record<DealStage, { count: number; value: MoneyAmount }>;
  totalDeals: number;
  totalValue: MoneyAmount;
}

export interface StageGateStatus {
  canProgress: boolean;
  criteria: Array<{ id: string; name: string; met: boolean; description: string; type: string; required: boolean }>;
  missingDocuments: string[];
  pendingApprovals: string[];
}

// Export singleton instance
let dealServiceInstance: DealService | null = null;

export function getDealService(): DealService {
  if (!dealServiceInstance) {
    dealServiceInstance = new DealService();
  }
  return dealServiceInstance;
}

export const dealService = getDealService();
