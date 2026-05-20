/**
 * Deal-Project Sync Service
 * 
 * Investment-specific synchronization logic
 */

import { Timestamp } from 'firebase/firestore';
import {
  DealProjectLink,
  SyncResult,
  ProgressMapping,
  FinancialMapping,
  CrossModuleAlert,
  SyncError,
} from '../../shared/types/cross-module-link';
import { crossModuleService } from '../../shared/services/cross-module-service';

export class DealProjectSyncService {
  /**
   * Sync deal with project progress
   */
  async syncDealWithProjectProgress(
    dealId: string,
    userId: string
  ): Promise<SyncResult> {
    const link = await crossModuleService.getDealProjectLink(dealId);
    
    if (!link) {
      throw new Error('No project linked to this deal');
    }
    
    return crossModuleService.syncLink(link.id, userId);
  }

  /**
   * Check for budget variance and create alerts
   */
  async checkBudgetVariance(dealId: string): Promise<CrossModuleAlert | null> {
    const link = await crossModuleService.getDealProjectLink(dealId);
    
    if (!link) return null;
    
    const varianceThreshold = 10; // 10% variance
    const variance = link.financialMapping.budgetVariancePercentage;
    
    if (Math.abs(variance) > varianceThreshold) {
      return crossModuleService.createCrossModuleAlert({
        type: 'budget_variance',
        severity: variance > 20 ? 'high' : 'medium',
        title: `Budget Variance Alert: ${link.dealData.dealName}`,
        message: `Project budget has deviated by ${variance.toFixed(1)}% from original investment amount`,
        sourceModule: 'delivery',
        sourceEntityId: link.projectData.projectId,
        targetModule: 'investment',
        targetEntityId: dealId,
      });
    }
    
    return null;
  }

  /**
   * Check for schedule delays and create alerts
   */
  async checkScheduleDelay(dealId: string): Promise<CrossModuleAlert | null> {
    const link = await crossModuleService.getDealProjectLink(dealId);
    
    if (!link) return null;
    
    const delayThreshold = 14; // 14 days delay
    const daysDelayed = -link.progressMapping.daysAheadOrBehind;
    
    if (daysDelayed > delayThreshold) {
      return crossModuleService.createCrossModuleAlert({
        type: 'schedule_delay',
        severity: daysDelayed > 30 ? 'high' : 'medium',
        title: `Schedule Delay Alert: ${link.dealData.dealName}`,
        message: `Project is ${daysDelayed} days behind schedule`,
        sourceModule: 'delivery',
        sourceEntityId: link.projectData.projectId,
        targetModule: 'investment',
        targetEntityId: dealId,
      });
    }
    
    return null;
  }

  /**
   * Update deal valuation based on construction progress
   */
  async updateDealValuationFromProgress(
    dealId: string,
    _userId: string
  ): Promise<void> {
    const link = await crossModuleService.getDealProjectLink(dealId);
    
    if (!link) return;
    
    // Calculate updated valuation based on progress
    const constructionProgress = link.progressMapping.physicalProgress / 100;
    const costVariance = link.financialMapping.costVarianceFromModel;
    
    // Update deal with progress-adjusted metrics
    // This would integrate with the financial model service
    console.log('Updating deal valuation:', {
      dealId,
      constructionProgress,
      costVariance,
    });
  }

  /**
   * Get construction progress summary for deal
   */
  async getConstructionSummaryForDeal(
    dealId: string
  ): Promise<{
    progress: ProgressMapping;
    financials: FinancialMapping;
    milestones: unknown[];
    alerts: CrossModuleAlert[];
  } | null> {
    const link = await crossModuleService.getDealProjectLink(dealId);
    
    if (!link) return null;
    
    // Get active alerts for this deal
    const alerts: CrossModuleAlert[] = [];
    
    const budgetAlert = await this.checkBudgetVariance(dealId);
    if (budgetAlert) alerts.push(budgetAlert);
    
    const scheduleAlert = await this.checkScheduleDelay(dealId);
    if (scheduleAlert) alerts.push(scheduleAlert);
    
    return {
      progress: link.progressMapping,
      financials: link.financialMapping,
      milestones: link.milestoneMapping.projectMilestones,
      alerts,
    };
  }

  /**
   * Batch sync all deal-project links
   */
  async batchSyncDealProjectLinks(
    dealIds: string[],
    userId: string
  ): Promise<Map<string, SyncResult>> {
    const results = new Map<string, SyncResult>();
    
    for (const dealId of dealIds) {
      try {
        const result = await this.syncDealWithProjectProgress(dealId, userId);
        results.set(dealId, result);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const syncError: SyncError = {
          timestamp: Timestamp.now(),
          field: 'all',
          sourceValue: null,
          targetValue: null,
          errorType: 'permission',
          errorMessage,
          resolved: false,
        };
        
        results.set(dealId, {
          success: false,
          syncedAt: Timestamp.now(),
          fieldsUpdated: [],
          errors: [syncError],
          warnings: [],
        });
      }
    }
    
    return results;
  }

  /**
   * Get deals with linked projects
   */
  async getDealsWithLinkedProjects(engagementId?: string): Promise<DealProjectLink[]> {
    const dashboard = await crossModuleService.getCrossModuleDashboard(engagementId || '');
    return dashboard.links;
  }

  /**
   * Check if deal has linked project
   */
  async hasLinkedProject(dealId: string): Promise<boolean> {
    const link = await crossModuleService.getDealProjectLink(dealId);
    return link !== null;
  }

  /**
   * Get project progress for multiple deals
   */
  async getBatchDealProgress(
    dealIds: string[]
  ): Promise<Map<string, ProgressMapping | null>> {
    const results = new Map<string, ProgressMapping | null>();
    
    for (const dealId of dealIds) {
      const link = await crossModuleService.getDealProjectLink(dealId);
      results.set(dealId, link?.progressMapping || null);
    }
    
    return results;
  }
}

// Export singleton instance
let dealProjectSyncServiceInstance: DealProjectSyncService | null = null;

export function getDealProjectSyncService(): DealProjectSyncService {
  if (!dealProjectSyncServiceInstance) {
    dealProjectSyncServiceInstance = new DealProjectSyncService();
  }
  return dealProjectSyncServiceInstance;
}

export const dealProjectSyncService = getDealProjectSyncService();
