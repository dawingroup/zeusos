/**
 * Pipeline Service
 * 
 * Manages pipeline operations, stage transitions,
 * and pipeline analytics.
 */

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
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import {
  PipelineConfig,
  PipelineFilters,
  PipelineColumn,
  PipelineStats,
  StageVelocity,
  StageTransitionRequest,
  StageTransitionApproval,
  DealMovement,
  GateCheckResult,
  MonthlyStats,
  SectorStats,
} from '../types/pipeline';
import { PipelineView, UserPipelinePreferences } from '../types/pipeline-view';
import { Deal, DealSummary } from '../types/deal';
import {
  DealStage,
  ALLOWED_TRANSITIONS,
  DEFAULT_STAGE_CONFIGS,
  StageConfig,
} from '../types/deal-stage';
import { dealService } from './deal-service';

// Collection paths
const DEALS_COLLECTION = 'advisoryPlatform/investment/deals';
const PIPELINE_CONFIG_COLLECTION = 'advisoryPlatform/investment/pipelineConfig';
const PIPELINE_VIEWS_COLLECTION = 'advisoryPlatform/investment/pipelineViews';
const USER_PREFS_COLLECTION = 'advisoryPlatform/investment/userPreferences';
const TRANSITION_APPROVALS_COLLECTION = 'advisoryPlatform/investment/transitionApprovals';

export class PipelineService {
  // ==================== Pipeline Views ====================

  /**
   * Get pipeline columns for Kanban view
   */
  async getPipelineColumns(filters?: PipelineFilters): Promise<PipelineColumn[]> {
    // Get stage configurations
    const stageConfigs = await this.getStageConfigs();
    
    // Get all active deals
    const deals = await this.getFilteredDeals(filters);
    
    // Group deals by stage
    const columns: PipelineColumn[] = stageConfigs
      .filter(config => config.order <= 8)  // Exclude exit stages from main pipeline
      .map(config => {
        const stageDeals = deals.filter(d => d.currentStage === config.stage);
        const totalValue = stageDeals.reduce(
          (sum, d) => sum + d.targetAmount.amount,
          0
        );

        return {
          stage: config.stage,
          config,
          deals: stageDeals,
          totalValue: { amount: totalValue, currency: 'USD' },
          count: stageDeals.length,
          isCollapsed: false,
        };
      });

    return columns;
  }

  /**
   * Get filtered deals
   */
  private async getFilteredDeals(filters?: PipelineFilters): Promise<DealSummary[]> {
    let deals = await dealService.searchDeals({
      status: 'active',
      ...filters,
    });

    // Apply additional client-side filters if needed
    if (filters?.minValue) {
      deals = deals.filter(d => d.targetAmount.amount >= filters.minValue!);
    }
    if (filters?.maxValue) {
      deals = deals.filter(d => d.targetAmount.amount <= filters.maxValue!);
    }

    return deals;
  }

  /**
   * Get stage configurations
   */
  async getStageConfigs(): Promise<StageConfig[]> {
    // Check for custom configs first
    const configRef = doc(db, PIPELINE_CONFIG_COLLECTION, 'default');
    const configSnap = await getDoc(configRef);

    if (configSnap.exists()) {
      const config = configSnap.data() as PipelineConfig;
      return config.stages;
    }

    return DEFAULT_STAGE_CONFIGS;
  }

  // ==================== Stage Transitions ====================

  /**
   * Request stage transition (may require approval)
   */
  async requestStageTransition(
    request: StageTransitionRequest
  ): Promise<StageTransitionApproval | null> {
    // Validate transition is allowed
    const transition = ALLOWED_TRANSITIONS.find(
      t => t.fromStage === request.fromStage && t.toStage === request.toStage
    );

    if (!transition || !transition.allowed) {
      throw new Error(
        `Invalid stage transition from ${request.fromStage} to ${request.toStage}` 
      );
    }

    // Check gate criteria
    const gateResults = await this.checkGateCriteria(request.dealId, request.toStage);
    request.gateCheckResults = gateResults;

    // If transition requires approval, create approval request
    if (transition.requiresApproval) {
      const approval = await this.createTransitionApproval(request, transition.approverRole!);
      return approval;
    }

    // Otherwise, execute transition directly
    await dealService.changeStage(
      request.dealId,
      request.toStage,
      request.requestedBy,
      request.notes
    );

    return null;
  }

  /**
   * Check gate criteria for a stage
   */
  private async checkGateCriteria(
    dealId: string,
    targetStage: DealStage
  ): Promise<GateCheckResult[]> {
    const deal = await dealService.getDeal(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    const stageConfig = DEFAULT_STAGE_CONFIGS.find(c => c.stage === targetStage);
    if (!stageConfig) {
      return [];
    }

    const results: GateCheckResult[] = [];

    for (const criterion of stageConfig.gateCriteria) {
      let passed = false;
      let details: string | undefined;

      switch (criterion.type) {
        case 'checklist':
          // For now, assume checklist items are manually verified
          passed = true;
          details = 'Manual verification required';
          break;

        case 'document': {
          // Check if required document exists in the deal
          const deal = await this.getDealForValidation(dealId);
          passed = deal?.documents?.some(
            (d: any) => d.type === criterion.id || d.name?.toLowerCase().includes(criterion.name.toLowerCase())
          ) ?? false;
          details = passed ? 'Document verified' : `Missing document: ${criterion.name}`;
          break;
        }

        case 'approval': {
          const dealForApproval = await this.getDealForValidation(dealId);
          passed = dealForApproval?.approvals?.some(
            (a: any) => a.type === criterion.id && a.status === 'approved'
          ) ?? false;
          details = passed ? 'Approval obtained' : `Pending approval: ${criterion.name}`;
          break;
        }

        case 'metric':
          if (criterion.validationRule) {
            const dealForMetric = await this.getDealForValidation(dealId);
            const metricValue = dealForMetric?.metrics?.[criterion.id];
            passed = metricValue !== undefined && metricValue !== null;
            details = passed
              ? `Metric "${criterion.name}": ${metricValue}`
              : `Missing metric: ${criterion.name}`;
          }
          break;
      }

      results.push({
        criterionId: criterion.id,
        criterionName: criterion.name,
        passed,
        details,
      });
    }

    return results;
  }

  /**
   * Helper to fetch deal data for validation
   */
  private async getDealForValidation(dealId: string): Promise<any | null> {
    try {
      const dealDoc = await import('firebase/firestore').then(({ doc, getDoc }) =>
        getDoc(doc(db, 'deals', dealId))
      );
      return dealDoc.exists() ? dealDoc.data() : null;
    } catch {
      return null;
    }
  }

  /**
   * Create transition approval request
   */
  private async createTransitionApproval(
    request: StageTransitionRequest,
    approverRole: string
  ): Promise<StageTransitionApproval> {
    const approvalRef = doc(collection(db, TRANSITION_APPROVALS_COLLECTION));

    const approval: StageTransitionApproval = {
      id: approvalRef.id,
      transitionRequest: request,
      status: 'pending',
    };

    await setDoc(approvalRef, {
      ...approval,
      approverRole,
      createdAt: Timestamp.now(),
    });

    return approval;
  }

  /**
   * Approve stage transition
   */
  async approveTransition(
    approvalId: string,
    approverId: string,
    notes?: string
  ): Promise<void> {
    const approvalRef = doc(db, TRANSITION_APPROVALS_COLLECTION, approvalId);
    const approvalSnap = await getDoc(approvalRef);

    if (!approvalSnap.exists()) {
      throw new Error('Approval not found');
    }

    const approval = approvalSnap.data() as StageTransitionApproval;

    if (approval.status !== 'pending') {
      throw new Error('Approval already processed');
    }

    // Update approval status
    await updateDoc(approvalRef, {
      status: 'approved',
      approver: approverId,
      approvedAt: Timestamp.now(),
    });

    // Execute the stage transition
    const { dealId, toStage } = approval.transitionRequest;
    await dealService.changeStage(dealId, toStage, approverId, notes);
  }

  /**
   * Reject stage transition
   */
  async rejectTransition(
    approvalId: string,
    rejectedBy: string,
    reason: string
  ): Promise<void> {
    const approvalRef = doc(db, TRANSITION_APPROVALS_COLLECTION, approvalId);

    await updateDoc(approvalRef, {
      status: 'rejected',
      approver: rejectedBy,
      approvedAt: Timestamp.now(),
      rejectionReason: reason,
    });
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals(_userId?: string): Promise<StageTransitionApproval[]> {
    const q = query(
      collection(db, TRANSITION_APPROVALS_COLLECTION),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as StageTransitionApproval);
  }

  // ==================== Drag and Drop ====================

  /**
   * Handle deal movement (drag and drop in Kanban)
   */
  async moveDeal(movement: DealMovement, movedBy: string): Promise<void> {
    const { dealId, fromStage, toStage } = movement;

    if (fromStage !== toStage) {
      // Stage change - validate and process
      await this.requestStageTransition({
        dealId,
        fromStage,
        toStage,
        requestedBy: movedBy,
      });
    }

    // Note: Position within stage is not persisted in this implementation
    // For position tracking, would need to add a 'position' field to deals
  }

  // ==================== Pipeline Analytics ====================

  /**
   * Get pipeline statistics
   */
  async getPipelineStats(_filters?: PipelineFilters): Promise<PipelineStats> {
    const deals = await this.getAllDeals();
    const activeDeals = deals.filter(d => d.status === 'active');
    const closedWonDeals = deals.filter(d => d.status === 'closed_won');
    const closedLostDeals = deals.filter(d => d.status === 'closed_lost');

    // Calculate total value
    const totalValue = activeDeals.reduce(
      (sum, d) => sum + d.targetAmount.amount,
      0
    );

    // Calculate average days in pipeline
    const now = new Date();
    const totalDays = activeDeals.reduce((sum, d) => {
      const createdAt = d.createdAt.toDate();
      return sum + Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);
    const averageDaysInPipeline = activeDeals.length > 0 
      ? Math.round(totalDays / activeDeals.length) 
      : 0;

    // Calculate conversion rate
    const totalClosed = closedWonDeals.length + closedLostDeals.length;
    const conversionRate = totalClosed > 0 
      ? (closedWonDeals.length / totalClosed) * 100 
      : 0;

    // Calculate velocity by stage
    const velocityByStage = this.calculateStageVelocity(deals);

    // Calculate monthly stats
    const dealsByMonth = this.calculateMonthlyStats(deals);

    // Calculate sector stats
    const topSectors = this.calculateSectorStats(deals);

    return {
      totalDeals: activeDeals.length,
      totalValue: { amount: totalValue, currency: 'USD' },
      averageDaysInPipeline,
      conversionRate,
      velocityByStage,
      dealsByMonth,
      topSectors,
    };
  }

  /**
   * Get all deals (for analytics)
   */
  private async getAllDeals(): Promise<Deal[]> {
    const q = query(
      collection(db, DEALS_COLLECTION),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as Deal);
  }

  /**
   * Calculate stage velocity
   */
  private calculateStageVelocity(deals: Deal[]): StageVelocity[] {
    const stageStats: Map<DealStage, number[]> = new Map();

    for (const deal of deals) {
      if (!deal.stageHistory) continue;

      for (const entry of deal.stageHistory) {
        if (entry.exitedAt) {
          const enteredAt = entry.enteredAt.toDate();
          const exitedAt = entry.exitedAt.toDate();
          const days = Math.floor(
            (exitedAt.getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24)
          );

          const stageDays = stageStats.get(entry.stage) || [];
          stageDays.push(days);
          stageStats.set(entry.stage, stageDays);
        }
      }
    }

    const velocities: StageVelocity[] = [];

    for (const [stage, days] of stageStats) {
      if (days.length === 0) continue;

      const sorted = [...days].sort((a, b) => a - b);
      const averageDays = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
      const medianDays = sorted[Math.floor(sorted.length / 2)];

      velocities.push({
        stage,
        averageDays,
        medianDays,
        deals: days.length,
      });
    }

    return velocities;
  }

  /**
   * Calculate monthly statistics
   */
  private calculateMonthlyStats(deals: Deal[]): MonthlyStats[] {
    const monthlyMap: Map<string, MonthlyStats> = new Map();

    // Get last 12 months
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, {
        month: key,
        dealsEntered: 0,
        dealsClosed: 0,
        valueEntered: { amount: 0, currency: 'USD' },
        valueClosed: { amount: 0, currency: 'USD' },
      });
    }

    for (const deal of deals) {
      const createdMonth = deal.createdAt.toDate();
      const createdKey = `${createdMonth.getFullYear()}-${String(createdMonth.getMonth() + 1).padStart(2, '0')}`;

      if (monthlyMap.has(createdKey)) {
        const stats = monthlyMap.get(createdKey)!;
        stats.dealsEntered++;
        stats.valueEntered.amount += deal.targetAmount.amount;
      }

      // Track closed deals
      if (deal.status === 'closed_won' || deal.status === 'closed_lost') {
        const lastStage = deal.stageHistory[deal.stageHistory.length - 1];
        if (lastStage?.exitedAt) {
          const closedMonth = lastStage.exitedAt.toDate();
          const closedKey = `${closedMonth.getFullYear()}-${String(closedMonth.getMonth() + 1).padStart(2, '0')}`;
          
          if (monthlyMap.has(closedKey) && deal.status === 'closed_won') {
            const stats = monthlyMap.get(closedKey)!;
            stats.dealsClosed++;
            stats.valueClosed.amount += deal.targetAmount.amount;
          }
        }
      }
    }

    return Array.from(monthlyMap.values());
  }

  /**
   * Calculate sector statistics
   */
  private calculateSectorStats(deals: Deal[]): SectorStats[] {
    const sectorMap: Map<string, { count: number; value: number; won: number; total: number }> = new Map();

    for (const deal of deals) {
      const sector = deal.sector;
      const current = sectorMap.get(sector) || { count: 0, value: 0, won: 0, total: 0 };

      if (deal.status === 'active') {
        current.count++;
        current.value += deal.targetAmount.amount;
      }

      if (deal.status === 'closed_won') {
        current.won++;
        current.total++;
      } else if (deal.status === 'closed_lost') {
        current.total++;
      }

      sectorMap.set(sector, current);
    }

    const stats: SectorStats[] = [];

    for (const [sector, data] of sectorMap) {
      stats.push({
        sector,
        dealCount: data.count,
        totalValue: { amount: data.value, currency: 'USD' },
        conversionRate: data.total > 0 ? (data.won / data.total) * 100 : 0,
      });
    }

    return stats.sort((a, b) => b.totalValue.amount - a.totalValue.amount);
  }

  // ==================== User Preferences ====================

  /**
   * Get user pipeline preferences
   */
  async getUserPreferences(userId: string): Promise<UserPipelinePreferences | null> {
    const prefsRef = doc(db, USER_PREFS_COLLECTION, userId);
    const prefsSnap = await getDoc(prefsRef);

    if (!prefsSnap.exists()) {
      return null;
    }

    return prefsSnap.data() as UserPipelinePreferences;
  }

  /**
   * Save user pipeline preferences
   */
  async saveUserPreferences(
    userId: string,
    preferences: Partial<UserPipelinePreferences>
  ): Promise<void> {
    const prefsRef = doc(db, USER_PREFS_COLLECTION, userId);
    
    await setDoc(prefsRef, {
      userId,
      ...preferences,
      updatedAt: Timestamp.now(),
    }, { merge: true });
  }

  // ==================== Pipeline Views ====================

  /**
   * Get saved pipeline views
   */
  async getPipelineViews(userId: string): Promise<PipelineView[]> {
    const q = query(
      collection(db, PIPELINE_VIEWS_COLLECTION),
      where('createdBy', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const userViews = snapshot.docs.map(d => d.data() as PipelineView);

    // Also get shared views
    const sharedQ = query(
      collection(db, PIPELINE_VIEWS_COLLECTION),
      where('isShared', '==', true)
    );
    const sharedSnapshot = await getDocs(sharedQ);
    const sharedViews = sharedSnapshot.docs
      .map(d => d.data() as PipelineView)
      .filter(v => v.createdBy !== userId);

    return [...userViews, ...sharedViews];
  }

  /**
   * Save pipeline view
   */
  async savePipelineView(view: Omit<PipelineView, 'id' | 'createdAt' | 'updatedAt'>): Promise<PipelineView> {
    const viewRef = doc(collection(db, PIPELINE_VIEWS_COLLECTION));
    
    const savedView: PipelineView = {
      ...view,
      id: viewRef.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setDoc(viewRef, savedView);

    return savedView;
  }

  /**
   * Delete pipeline view
   */
  async deletePipelineView(viewId: string): Promise<void> {
    const viewRef = doc(db, PIPELINE_VIEWS_COLLECTION, viewId);
    await deleteDoc(viewRef);
  }

  // ==================== Real-time Subscriptions ====================

  /**
   * Subscribe to pipeline changes
   */
  subscribeToPipeline(
    filters: PipelineFilters | undefined,
    callback: (columns: PipelineColumn[]) => void
  ): () => void {
    const q = query(
      collection(db, DEALS_COLLECTION),
      where('status', '==', 'active'),
      orderBy('stageEnteredAt', 'asc')
    );

    return onSnapshot(q, async () => {
      const columns = await this.getPipelineColumns(filters);
      callback(columns);
    });
  }
}

// Export singleton instance
let pipelineServiceInstance: PipelineService | null = null;

export function getPipelineService(): PipelineService {
  if (!pipelineServiceInstance) {
    pipelineServiceInstance = new PipelineService();
  }
  return pipelineServiceInstance;
}

export const pipelineService = getPipelineService();
