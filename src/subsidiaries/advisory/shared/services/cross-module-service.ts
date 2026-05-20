/**
 * Cross-Module Service
 * 
 * Manages links and synchronization between modules
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
  Timestamp,
  writeBatch,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import {
  CrossModuleLink,
  DealProjectLink,
  CreateLinkRequest,
  SyncResult,
  SyncError,
  ModuleType,
  LinkStatus,
  CrossModuleDashboard,
  CrossModuleAlert,
  ProgressMapping,
  FinancialMapping,
  MilestoneMapping,
  DealLinkData,
  ProjectLinkData,
  ProjectCreationFromDeal,
  DEFAULT_DEAL_PROJECT_SYNC,
  InvestmentSummary,
  DeliverySummary,
} from '../types/cross-module-link';
import { getProjectService } from '../../core/project/services/project.service';
import type { ProjectFormData } from '../../core/project/types/project.types';

const LINKS_COLLECTION = 'advisoryPlatform/crossModuleLinks';
const ALERTS_COLLECTION = 'advisoryPlatform/crossModuleAlerts';
// Engagements live at the top-level `engagements` collection
// (see src/subsidiaries/advisory/core/firebase/collections.ts → COLLECTION_PATHS.ENGAGEMENTS).
const ENGAGEMENTS_COLLECTION = 'engagements';

export class CrossModuleService {
  /**
   * Create a cross-module link
   */
  async createLink(
    request: CreateLinkRequest,
    userId: string
  ): Promise<CrossModuleLink> {
    // Validate entities exist
    await this.validateEntitiesExist(request);
    
    // Check for existing link
    const existingLink = await this.findExistingLink(
      request.sourceModule,
      request.sourceEntityId,
      request.targetModule,
      request.targetEntityId
    );
    
    if (existingLink) {
      throw new Error('Link already exists between these entities');
    }
    
    const linkId = doc(collection(db, LINKS_COLLECTION)).id;
    const now = Timestamp.now();
    
    const link: CrossModuleLink = {
      id: linkId,
      sourceModule: request.sourceModule,
      sourceEntityType: request.sourceEntityType,
      sourceEntityId: request.sourceEntityId,
      targetModule: request.targetModule,
      targetEntityType: request.targetEntityType,
      targetEntityId: request.targetEntityId,
      linkType: request.linkType,
      syncConfig: {
        ...DEFAULT_DEAL_PROJECT_SYNC,
        ...request.syncConfig,
      },
      status: 'active',
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
    };
    
    await setDoc(doc(db, LINKS_COLLECTION, linkId), link);
    
    // Update both entities with link references
    await this.updateEntityWithLink(request.sourceModule, request.sourceEntityId, linkId, 'outgoing');
    await this.updateEntityWithLink(request.targetModule, request.targetEntityId, linkId, 'incoming');
    
    // Initial sync
    await this.syncLink(linkId, userId);
    
    return link;
  }

  /**
   * Get link by ID
   */
  async getLink(linkId: string): Promise<CrossModuleLink | null> {
    const docRef = doc(db, LINKS_COLLECTION, linkId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return docSnap.data() as CrossModuleLink;
  }

  /**
   * Get all links for an entity
   */
  async getEntityLinks(
    module: ModuleType,
    entityId: string
  ): Promise<CrossModuleLink[]> {
    // Get outgoing links
    const outgoingQuery = query(
      collection(db, LINKS_COLLECTION),
      where('sourceModule', '==', module),
      where('sourceEntityId', '==', entityId),
      where('status', '==', 'active')
    );
    
    // Get incoming links
    const incomingQuery = query(
      collection(db, LINKS_COLLECTION),
      where('targetModule', '==', module),
      where('targetEntityId', '==', entityId),
      where('status', '==', 'active')
    );
    
    const [outgoingSnap, incomingSnap] = await Promise.all([
      getDocs(outgoingQuery),
      getDocs(incomingQuery),
    ]);
    
    const links: CrossModuleLink[] = [];
    outgoingSnap.docs.forEach(d => links.push(d.data() as CrossModuleLink));
    incomingSnap.docs.forEach(d => links.push(d.data() as CrossModuleLink));
    
    return links;
  }

  /**
   * Get deal-project link with enriched data
   */
  async getDealProjectLink(dealId: string): Promise<DealProjectLink | null> {
    const q = query(
      collection(db, LINKS_COLLECTION),
      where('sourceModule', '==', 'investment'),
      where('sourceEntityId', '==', dealId),
      where('linkType', '==', 'deal_to_project'),
      where('status', '==', 'active')
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    const baseLink = snapshot.docs[0].data() as CrossModuleLink;
    
    // Enrich with deal and project data
    const [dealData, projectData] = await Promise.all([
      this.fetchDealData(baseLink.sourceEntityId),
      this.fetchProjectData(baseLink.targetEntityId),
    ]);
    
    if (!dealData || !projectData) {
      return null;
    }
    
    // Build progress and financial mappings
    const progressMapping = this.buildProgressMapping(projectData);
    const financialMapping = this.buildFinancialMapping(dealData, projectData);
    const milestoneMapping = await this.buildMilestoneMapping(dealData, projectData);
    
    return {
      ...baseLink,
      linkType: 'deal_to_project',
      dealData,
      projectData,
      progressMapping,
      financialMapping,
      milestoneMapping,
    };
  }

  /**
   * Sync a link manually or triggered
   */
  async syncLink(linkId: string, _userId: string): Promise<SyncResult> {
    const link = await this.getLink(linkId);
    
    if (!link) {
      throw new Error('Link not found');
    }
    
    if (link.status !== 'active') {
      throw new Error('Link is not active');
    }
    
    const errors: SyncError[] = [];
    const fieldsUpdated: string[] = [];
    const warnings: string[] = [];
    
    // Get source and target data
    const sourceData = await this.fetchEntityData(link.sourceModule, link.sourceEntityId);
    const targetData = await this.fetchEntityData(link.targetModule, link.targetEntityId);
    
    // Process each sync field
    for (const fieldConfig of link.syncConfig.syncFields) {
      if (!fieldConfig.enabled) continue;
      
      try {
        const sourceValue = this.getNestedValue(sourceData, fieldConfig.sourceField);
        const currentTargetValue = this.getNestedValue(targetData, fieldConfig.targetField);
        
        // Transform value if needed
        const transformedValue = this.transformValue(
          sourceValue,
          fieldConfig.transform || 'direct',
          { sourceData, targetData }
        );
        
        // Check for conflicts
        if (transformedValue !== currentTargetValue) {
          // Apply update
          await this.updateEntityField(
            link.targetModule,
            link.targetEntityId,
            fieldConfig.targetField,
            transformedValue
          );
          
          fieldsUpdated.push(fieldConfig.targetField);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          timestamp: Timestamp.now(),
          field: fieldConfig.sourceField,
          sourceValue: this.getNestedValue(sourceData, fieldConfig.sourceField),
          targetValue: this.getNestedValue(targetData, fieldConfig.targetField),
          errorType: 'transform',
          errorMessage,
          resolved: false,
        });
      }
    }
    
    const result: SyncResult = {
      success: errors.length === 0,
      syncedAt: Timestamp.now(),
      fieldsUpdated,
      errors,
      warnings,
    };
    
    // Update link with sync status
    await updateDoc(doc(db, LINKS_COLLECTION, linkId), {
      lastSyncedAt: result.syncedAt,
      syncErrors: errors.length > 0 ? errors : [],
      updatedAt: Timestamp.now(),
    });
    
    // Send notifications if configured
    if (link.syncConfig.notifyOnError && errors.length > 0) {
      await this.sendSyncErrorNotification(link, errors);
    }
    
    return result;
  }

  /**
   * Create project from closed deal
   */
  async createProjectFromDeal(
    orgId: string,
    config: ProjectCreationFromDeal,
    userId: string
  ): Promise<{ projectId: string; linkId: string }> {
    const deal = await this.fetchDealData(config.dealId);

    if (!deal) {
      throw new Error('Deal not found');
    }

    // Resolve the advisory Client/Customer via the deal's engagement.
    // Historical behaviour (pre-audit fix P1) substituted `deal.engagementId` for `customerId`, which is
    // semantically wrong: an engagement ≠ a client. We now look up the engagement and read its `clientId`.
    // If the engagement or its clientId is missing, fail loud rather than create an orphan project.
    if (!deal.engagementId) {
      throw new Error(
        `Cannot create project from deal ${config.dealId}: deal has no engagementId. ` +
        `Link the deal to an engagement before creating a project.`
      );
    }
    const customerId = await this.fetchEngagementClientId(deal.engagementId);
    if (!customerId) {
      throw new Error(
        `Cannot create project from deal ${config.dealId}: engagement ${deal.engagementId} ` +
        `has no clientId. Ensure the engagement is linked to a Client before creating a project.`
      );
    }

    // Get the core project service
    const projectService = getProjectService(db);

    // 1. Create project via the CORE service
    const projectData: ProjectFormData = {
      programId: config.programId,
      name: config.projectConfig.name,
      projectType: 'new_construction', // Or derive from deal
      description: deal.dealName,
      location: {
        region: config.projectConfig.region,
        district: config.projectConfig.district,
        siteName: config.projectConfig.location,
      },
      estimatedStartDate: config.projectConfig.startDate,
      estimatedEndDate: config.projectConfig.expectedEndDate,
      budgetAmount: config.projectConfig.budgetFromDeal
        ? deal.investmentAmount
        : config.projectConfig.budgetOverride || deal.investmentAmount,
      budgetCurrency: (deal.currency || 'USD') as 'UGX' | 'USD',
      customerId, // Resolved from engagement.clientId
    };
    
    await projectService.createProject(orgId, userId, projectData);
    
    // Create project in delivery module (data structure for reference)
    void ({
      engagementId: deal.engagementId,
      programId: config.programId,
      name: config.projectConfig.name,
      implementationType: config.projectConfig.implementationType,
      
      // Location
      location: {
        region: config.projectConfig.region,
        district: config.projectConfig.district,
        location: config.projectConfig.location,
        coordinates: config.projectConfig.coordinates,
      },
      
      // Budget
      totalBudget: config.projectConfig.budgetFromDeal 
        ? deal.investmentAmount 
        : config.projectConfig.budgetOverride || deal.investmentAmount,
      currency: deal.currency || 'USD',
      
      // Schedule
      startDate: config.projectConfig.startDate,
      expectedEndDate: config.projectConfig.expectedEndDate,
      
      // Team
      projectManager: config.projectConfig.projectManagerId,
      siteTeam: config.projectConfig.siteTeam || [],
      
      // Contractor (if applicable)
      contractor: config.projectConfig.implementationType === 'contractor' 
        ? {
            id: config.projectConfig.contractorId,
            contractValue: config.projectConfig.contractValue,
          }
        : undefined,
      
      // Status
      status: 'planning',
      progressPercentage: 0,
      spentToDate: 0,
      
      // Source deal reference
      linkedDealId: config.dealId,
    });

    // Create project via delivery service
    const projectId = await this.createProjectInDelivery(projectData as any, userId);
    
    // Create link
    const link = await this.createLink({
      sourceModule: 'investment',
      sourceEntityType: 'deal',
      sourceEntityId: config.dealId,
      targetModule: 'delivery',
      targetEntityType: 'project',
      targetEntityId: projectId,
      linkType: 'deal_to_project',
    }, userId);
    
    // Create MatFlow BOQ if configured
    if (config.matflowConfig?.createBoq) {
      await this.createMatFlowBoqForProject(projectId, config.matflowConfig, userId);
    }
    
    // Copy documents if configured
    if (config.autoLink.documents) {
      await this.linkDealDocumentsToProject(config.dealId, projectId);
    }
    
    // Update deal with project reference
    await this.updateDealWithProjectLink(config.dealId, projectId, link.id, userId);
    
    return { projectId, linkId: link.id };
  }

  /**
   * Update link status
   */
  async updateLinkStatus(
    linkId: string,
    status: LinkStatus,
    _userId: string
  ): Promise<void> {
    await updateDoc(doc(db, LINKS_COLLECTION, linkId), {
      status,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Subscribe to link updates (real-time)
   */
  subscribeToLinkUpdates(
    linkId: string,
    callback: (link: CrossModuleLink | null) => void
  ): () => void {
    const docRef = doc(db, LINKS_COLLECTION, linkId);
    
    return onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as CrossModuleLink);
      } else {
        callback(null);
      }
    });
  }

  /**
   * Get cross-module dashboard
   */
  async getCrossModuleDashboard(engagementId: string): Promise<CrossModuleDashboard> {
    // Get all deal-project links for engagement
    const linksQuery = query(
      collection(db, LINKS_COLLECTION),
      where('linkType', '==', 'deal_to_project'),
      where('status', '==', 'active')
    );
    
    const linksSnapshot = await getDocs(linksQuery);
    const links: DealProjectLink[] = [];
    
    for (const linkDoc of linksSnapshot.docs) {
      const baseLink = linkDoc.data() as CrossModuleLink;
      const enriched = await this.getDealProjectLink(baseLink.sourceEntityId);
      if (enriched) links.push(enriched);
    }
    
    // Calculate summaries
    const investmentSummary = this.calculateInvestmentSummary(links);
    const deliverySummary = this.calculateDeliverySummary(links);
    
    // Get recent syncs
    const recentSyncs = await this.getRecentSyncs(links.map(l => l.id));
    
    // Get active alerts
    const alerts = await this.getActiveAlerts(engagementId);
    
    return {
      investmentSummary,
      deliverySummary,
      links,
      recentSyncs,
      alerts,
    };
  }

  /**
   * Create alert for cross-module issues
   */
  async createCrossModuleAlert(
    alert: Omit<CrossModuleAlert, 'id' | 'createdAt' | 'acknowledged'>
  ): Promise<CrossModuleAlert> {
    const alertId = doc(collection(db, ALERTS_COLLECTION)).id;
    
    const newAlert: CrossModuleAlert = {
      ...alert,
      id: alertId,
      createdAt: Timestamp.now(),
      acknowledged: false,
    };
    
    await setDoc(doc(db, ALERTS_COLLECTION, alertId), newAlert);
    
    return newAlert;
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    await updateDoc(doc(db, ALERTS_COLLECTION, alertId), {
      acknowledged: true,
      acknowledgedBy: userId,
      acknowledgedAt: Timestamp.now(),
    });
  }

  // ==================== Private Helper Methods ====================

  private async validateEntitiesExist(request: CreateLinkRequest): Promise<void> {
    const sourceExists = await this.entityExists(request.sourceModule, request.sourceEntityId);
    const targetExists = await this.entityExists(request.targetModule, request.targetEntityId);
    
    if (!sourceExists) {
      throw new Error(`Source entity not found: ${request.sourceModule}/${request.sourceEntityId}`);
    }
    
    if (!targetExists) {
      throw new Error(`Target entity not found: ${request.targetModule}/${request.targetEntityId}`);
    }
  }

  private async entityExists(module: ModuleType, entityId: string): Promise<boolean> {
    const collectionPath = this.getModuleCollectionPath(module);
    const docRef = doc(db, collectionPath, entityId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  }

  private getModuleCollectionPath(module: ModuleType): string {
    switch (module) {
      case 'investment':
        return 'advisoryPlatform/investment/deals';
      case 'delivery':
        return 'advisoryPlatform/delivery/projects';
      case 'advisory':
        return 'advisoryPlatform/advisory/portfolios';
      case 'matflow':
        return 'advisoryPlatform/matflow/boqs';
      default:
        throw new Error(`Unknown module: ${module}`);
    }
  }

  private async findExistingLink(
    sourceModule: ModuleType,
    sourceEntityId: string,
    targetModule: ModuleType,
    targetEntityId: string
  ): Promise<CrossModuleLink | null> {
    const q = query(
      collection(db, LINKS_COLLECTION),
      where('sourceModule', '==', sourceModule),
      where('sourceEntityId', '==', sourceEntityId),
      where('targetModule', '==', targetModule),
      where('targetEntityId', '==', targetEntityId)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : snapshot.docs[0].data() as CrossModuleLink;
  }

  private async updateEntityWithLink(
    module: ModuleType,
    entityId: string,
    linkId: string,
    direction: 'incoming' | 'outgoing'
  ): Promise<void> {
    const collectionPath = this.getModuleCollectionPath(module);
    const docRef = doc(db, collectionPath, entityId);
    
    // Get current links
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;
    
    const data = docSnap.data();
    const existingLinks = data.crossModuleLinks || [];
    
    await updateDoc(docRef, {
      crossModuleLinks: [...existingLinks, { linkId, direction }],
      updatedAt: Timestamp.now(),
    });
  }

  private async fetchEntityData(module: ModuleType, entityId: string): Promise<Record<string, unknown> | null> {
    const collectionPath = this.getModuleCollectionPath(module);
    const docRef = doc(db, collectionPath, entityId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as Record<string, unknown> : null;
  }

  private async fetchDealData(dealId: string): Promise<DealLinkData | null> {
    const data = await this.fetchEntityData('investment', dealId);
    if (!data) return null;
    
    return {
      dealId,
      dealName: data.name as string || '',
      dealStage: data.stage as string || '',
      investmentAmount: data.investmentAmount as number || 0,
      investmentStructure: data.investmentStructure as string || '',
      equityPercentage: data.equityPercentage as number,
      closingDate: data.closingDate as Date,
      engagementId: data.engagementId as string,
      currency: data.currency as string,
    };
  }

  /**
   * Look up an engagement by ID and return its `clientId`.
   * Returns `null` if the engagement doesn't exist or has no `clientId`.
   *
   * Used by `createProjectFromDeal` to resolve a deal's engagement to the correct Client FK
   * (advisory `customerId` === advisory `Client.id`). Previously the code substituted
   * `deal.engagementId` directly for `customerId`, which produced silent data corruption.
   */
  private async fetchEngagementClientId(engagementId: string): Promise<string | null> {
    const docRef = doc(db, ENGAGEMENTS_COLLECTION, engagementId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return null;
    }
    const data = docSnap.data() as Record<string, unknown>;
    const clientId = data.clientId;
    return typeof clientId === 'string' && clientId.length > 0 ? clientId : null;
  }

  private async fetchProjectData(projectId: string): Promise<ProjectLinkData | null> {
    const data = await this.fetchEntityData('delivery', projectId);
    if (!data) return null;
    
    return {
      projectId,
      projectName: data.name as string || '',
      projectStatus: data.status as string || '',
      totalBudget: data.totalBudget as number || 0,
      spentToDate: data.spentToDate as number || 0,
      progressPercentage: data.progressPercentage as number || 0,
      expectedCompletion: data.expectedEndDate as Date,
    };
  }

  private getNestedValue(obj: Record<string, unknown> | null, path: string): unknown {
    if (!obj) return undefined;
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  private transformValue(
    value: unknown,
    transform: string,
    _context: { sourceData: unknown; targetData: unknown }
  ): unknown {
    switch (transform) {
      case 'direct':
        return value;
      case 'percentage':
        return typeof value === 'number' ? value * 100 : value;
      case 'map_status':
        return this.mapProjectStatusToDealStatus(value as string);
      default:
        return value;
    }
  }

  private mapProjectStatusToDealStatus(projectStatus: string): string {
    const mapping: Record<string, string> = {
      'planning': 'pre_construction',
      'active': 'under_construction',
      'on_hold': 'construction_delayed',
      'completed': 'construction_complete',
      'cancelled': 'terminated',
    };
    return mapping[projectStatus] || projectStatus;
  }

  private async updateEntityField(
    module: ModuleType,
    entityId: string,
    fieldPath: string,
    value: unknown
  ): Promise<void> {
    const collectionPath = this.getModuleCollectionPath(module);
    const docRef = doc(db, collectionPath, entityId);
    
    await updateDoc(docRef, {
      [fieldPath]: value,
      updatedAt: Timestamp.now(),
    });
  }

  private buildProgressMapping(projectData: ProjectLinkData): ProgressMapping {
    return {
      constructionStarted: projectData.projectStatus !== 'planning',
      physicalProgress: projectData.progressPercentage || 0,
      financialProgress: projectData.totalBudget > 0 
        ? (projectData.spentToDate / projectData.totalBudget) * 100 
        : 0,
      foundationComplete: projectData.progressPercentage >= 15,
      structureComplete: projectData.progressPercentage >= 50,
      mepComplete: projectData.progressPercentage >= 80,
      handoverComplete: projectData.progressPercentage >= 100,
      onSchedule: true, // Would need more data to determine
      daysAheadOrBehind: 0,
    };
  }

  private buildFinancialMapping(dealData: DealLinkData, projectData: ProjectLinkData): FinancialMapping {
    const originalBudget = dealData.investmentAmount || 0;
    const currentBudget = projectData.totalBudget || originalBudget;
    const spent = projectData.spentToDate || 0;
    
    return {
      originalBudget,
      currentBudget,
      budgetVariance: currentBudget - originalBudget,
      budgetVariancePercentage: originalBudget > 0 
        ? ((currentBudget - originalBudget) / originalBudget) * 100 
        : 0,
      totalCommitted: 0, // Would need commitment data
      totalSpent: spent,
      totalRemaining: currentBudget - spent,
      estimatedFinalCost: currentBudget,
      costVarianceFromModel: 0,
      sourceCurrency: projectData.projectStatus || 'USD',
      targetCurrency: dealData.currency || 'USD',
      exchangeRate: 1.0,
    };
  }

  private async buildMilestoneMapping(
    _dealData: DealLinkData,
    _projectData: ProjectLinkData
  ): Promise<MilestoneMapping> {
    // Simplified - would fetch actual milestones
    return {
      dealMilestones: [],
      projectMilestones: [],
      mappings: [],
    };
  }

  private async createProjectInDelivery(
    projectData: Record<string, unknown>,
    userId: string
  ): Promise<string> {
    const projectId = doc(collection(db, 'advisoryPlatform/delivery/projects')).id;
    
    await setDoc(doc(db, 'advisoryPlatform/delivery/projects', projectId), {
      ...projectData,
      id: projectId,
      createdAt: Timestamp.now(),
      createdBy: userId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
    
    return projectId;
  }

  private async createMatFlowBoqForProject(
    projectId: string,
    config: { createBoq: boolean; trackProcurement: boolean },
    userId: string
  ): Promise<void> {
    const boqId = doc(collection(db, 'advisoryPlatform/matflow/boqs')).id;
    
    await setDoc(doc(db, 'advisoryPlatform/matflow/boqs', boqId), {
      id: boqId,
      projectId,
      status: 'draft',
      trackProcurement: config.trackProcurement,
      createdAt: Timestamp.now(),
      createdBy: userId,
    });
    
    // Create link from project to MatFlow
    await this.createLink({
      sourceModule: 'delivery',
      sourceEntityType: 'project',
      sourceEntityId: projectId,
      targetModule: 'matflow',
      targetEntityType: 'boq',
      targetEntityId: boqId,
      linkType: 'project_to_matflow',
    }, userId);
  }

  private async linkDealDocumentsToProject(
    dealId: string,
    projectId: string
  ): Promise<void> {
    const dealDocs = await getDocs(
      collection(db, `advisoryPlatform/investment/deals/${dealId}/documents`)
    );
    
    const batch = writeBatch(db);
    
    dealDocs.docs.forEach(docRef => {
      const newDocRef = doc(
        collection(db, `advisoryPlatform/delivery/projects/${projectId}/documents`)
      );
      batch.set(newDocRef, {
        ...docRef.data(),
        linkedFromDeal: dealId,
        createdAt: Timestamp.now(),
      });
    });
    
    await batch.commit();
  }

  private async updateDealWithProjectLink(
    dealId: string,
    projectId: string,
    linkId: string,
    userId: string
  ): Promise<void> {
    await updateDoc(doc(db, 'advisoryPlatform/investment/deals', dealId), {
      linkedProjectId: projectId,
      crossModuleLinkId: linkId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  private async sendSyncErrorNotification(
    link: CrossModuleLink,
    errors: SyncError[]
  ): Promise<void> {
    console.log('Sync errors for link:', link.id, errors);
    // Would integrate with notification service
  }

  private calculateInvestmentSummary(links: DealProjectLink[]): InvestmentSummary {
    const totalDeals = links.length;
    const totalInvested = links.reduce((sum, l) => sum + (l.dealData.investmentAmount || 0), 0);
    const avgProgress = links.length > 0 
      ? links.reduce((sum, l) => sum + (l.progressMapping.physicalProgress || 0), 0) / links.length 
      : 0;
    
    const onTrack = links.filter(l => l.progressMapping.onSchedule).length;
    const delayed = links.filter(l => !l.progressMapping.onSchedule && l.progressMapping.daysAheadOrBehind < 0).length;
    const atRisk = links.filter(l => l.progressMapping.daysAheadOrBehind < -30).length;
    
    return {
      totalDealsWithProjects: totalDeals,
      totalInvestedAmount: totalInvested,
      portfolioConstructionProgress: avgProgress,
      projectsOnTrack: onTrack,
      projectsDelayed: delayed,
      projectsAtRisk: atRisk,
    };
  }

  private calculateDeliverySummary(links: DealProjectLink[]): DeliverySummary {
    const totalBudget = links.reduce((sum, l) => sum + (l.projectData.totalBudget || 0), 0);
    const totalSpent = links.reduce((sum, l) => sum + (l.projectData.spentToDate || 0), 0);
    
    return {
      projectsWithInvestmentLinks: links.length,
      totalBudgetFromInvestments: totalBudget,
      budgetUtilization: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
      activeConstructionValue: totalBudget - totalSpent,
    };
  }

  private async getRecentSyncs(_linkIds: string[]): Promise<SyncResult[]> {
    // Would query sync history
    return [];
  }

  private async getActiveAlerts(_engagementId: string): Promise<CrossModuleAlert[]> {
    const q = query(
      collection(db, ALERTS_COLLECTION),
      where('acknowledged', '==', false),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as CrossModuleAlert);
  }
}

// Export singleton instance
let crossModuleServiceInstance: CrossModuleService | null = null;

export function getCrossModuleService(): CrossModuleService {
  if (!crossModuleServiceInstance) {
    crossModuleServiceInstance = new CrossModuleService();
  }
  return crossModuleServiceInstance;
}

export const crossModuleService = getCrossModuleService();
