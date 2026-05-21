// ============================================================================
// INTELLIGENCE INTEGRATION SERVICE
// ZeusOS v2.0 - Intelligence Layer
// Service for integrating AI intelligence across all modules
// ============================================================================

import {
  collection,
  onSnapshot,
  type Unsubscribe,
  type DocumentChange,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import { businessEventService } from './businessEventService';
import { taskGenerationService } from './taskGenerationService';
import type { SourceModuleId } from '../constants';
import type {
  BusinessEvent,
  GeneratedTask,
  SubsidiaryId,
} from '../types/businessEvents';

// ============================================================================
// MODULE COLLECTION PATHS
// ============================================================================

const MODULE_COLLECTIONS: Record<SourceModuleId, string[]> = {
  // Zeus Group
  design_manager: [
    'designProjects',
    'designProjects/{projectId}/designItems',
  ],
  launch_pipeline: ['launchProducts'],
  inventory: ['inventoryItems'],
  customer_hub: ['customers'],
  feature_library: ['featureLibrary'],
  cutlist: ['workInstances'],
  
  // Zeus Group
  engagements: ['engagements'],
  funding: [
    'engagements/{engagementId}/fundingSources',
    'engagements/{engagementId}/fundingSources/{fundingSourceId}/disbursements',
  ],
  reporting: ['engagements/{engagementId}/reportSubmissions'],
  matflow: ['organizations/{orgId}/matflow_projects'],
  
  // Shared
  hr_central: ['employees', 'leave_requests'],
  ceo_strategy: ['executive/strategy/okrs', 'executive/strategy/kpis'],
  financial: ['budgets', 'expenses'],
  staff_performance: ['goals', 'reviews'],
  capital_hub: ['deals', 'portfolios'],
  market_intelligence: ['market_insights', 'competitors'],
  advisory: ['engagements'],
  compliance: ['compliance_documents', 'compliance_obligations'],
};

const SUBSIDIARY_MAPPING: Record<SourceModuleId, SubsidiaryId> = {
  design_manager: 'finishes',
  launch_pipeline: 'finishes',
  inventory: 'finishes',
  customer_hub: 'finishes',
  feature_library: 'finishes',
  cutlist: 'finishes',
  engagements: 'advisory',
  funding: 'advisory',
  reporting: 'advisory',
  matflow: 'advisory',
  hr_central: 'finishes',
  ceo_strategy: 'finishes',
  financial: 'finishes',
  staff_performance: 'finishes',
  capital_hub: 'capital',
  market_intelligence: 'finishes',
  advisory: 'advisory',
  compliance: 'corporate',
};

// ============================================================================
// INTELLIGENCE INTEGRATION SERVICE
// ============================================================================

class IntelligenceIntegrationService {
  private listeners: Map<string, Unsubscribe> = new Map();

  // ----------------------------------------
  // Module Registration
  // ----------------------------------------

  async registerModule(
    moduleId: SourceModuleId,
    options?: {
      customCollections?: string[];
      enabled?: boolean;
    }
  ): Promise<void> {
    const collections = options?.customCollections || MODULE_COLLECTIONS[moduleId] || [];
    const subsidiary = SUBSIDIARY_MAPPING[moduleId];

    for (const collectionPath of collections) {
      // Skip parameterized paths for now (would need real IDs)
      if (collectionPath.includes('{')) {
        continue;
      }

      const listenerId = `${moduleId}:${collectionPath}`;

      if (this.listeners.has(listenerId)) {
        continue;
      }

      const unsubscribe = this.setupCollectionListener(
        moduleId,
        subsidiary,
        collectionPath
      );

      this.listeners.set(listenerId, unsubscribe);
    }

    console.log(`[Intelligence] Registered module: ${moduleId} with ${collections.length} collections`);
  }

  private setupCollectionListener(
    moduleId: SourceModuleId,
    subsidiary: SubsidiaryId,
    collectionPath: string
  ): Unsubscribe {
    const collectionRef = collection(db, collectionPath);

    return onSnapshot(collectionRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        this.handleDocumentChange(moduleId, subsidiary, collectionPath, change);
      });
    });
  }

  private async handleDocumentChange(
    moduleId: SourceModuleId,
    subsidiary: SubsidiaryId,
    collectionPath: string,
    change: DocumentChange
  ): Promise<void> {
    const entityType = this.getEntityTypeFromPath(collectionPath);
    const entityId = change.doc.id;
    const currentData = change.doc.data();
    const entityName = currentData.name || currentData.title || currentData.itemCode || entityId;

    // Determine project context if available
    const projectId = currentData.projectId;
    const projectName = currentData.projectName || currentData.projectCode;

    let detectedEvents: Partial<BusinessEvent>[] = [];

    switch (change.type) {
      case 'added':
        detectedEvents = businessEventService.detectEventFromChange(
          moduleId,
          subsidiary,
          entityType,
          entityId,
          entityName,
          null,
          currentData,
          projectId,
          projectName
        );
        break;

      case 'modified':
        // For modifications, we'd ideally have the previous data
        // In a real implementation, we'd use a Cloud Function with change triggers
        detectedEvents = businessEventService.detectEventFromChange(
          moduleId,
          subsidiary,
          entityType,
          entityId,
          entityName,
          null, // Would be previousData in Cloud Function
          currentData,
          projectId,
          projectName
        );
        break;

      case 'removed':
        // Handle deletions if needed
        break;
    }

    // Process detected events
    for (const eventData of detectedEvents) {
      await this.processEvent(eventData as BusinessEvent);
    }
  }

  private getEntityTypeFromPath(collectionPath: string): string {
    const parts = collectionPath.split('/');
    return parts[parts.length - 1];
  }

  // ----------------------------------------
  // Event Processing
  // ----------------------------------------

  private async processEvent(eventData: Partial<BusinessEvent>): Promise<void> {
    try {
      // Create the event in Firestore
      const eventId = await businessEventService.createEvent(eventData as any);

      // Generate tasks from the event
      const fullEvent: BusinessEvent = {
        ...eventData,
        id: eventId,
      } as BusinessEvent;

      const generatedTasks = await taskGenerationService.generateTasksFromEvent(fullEvent);

      // Mark event as processed
      await businessEventService.markEventProcessed(
        eventId,
        generatedTasks.map((t) => t.id)
      );

      console.log(
        `[Intelligence] Processed event ${eventId}, generated ${generatedTasks.length} tasks`
      );
    } catch (error) {
      console.error('[Intelligence] Error processing event:', error);
    }
  }

  // ----------------------------------------
  // Manual Event Triggering
  // ----------------------------------------

  async triggerEvent(
    moduleId: SourceModuleId,
    eventType: string,
    entityType: string,
    entityId: string,
    entityName: string,
    options?: {
      projectId?: string;
      projectName?: string;
      previousState?: Record<string, any>;
      currentState?: Record<string, any>;
      triggeredBy?: string;
      triggeredByName?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ eventId: string; tasks: GeneratedTask[] }> {
    const subsidiary = SUBSIDIARY_MAPPING[moduleId];

    const eventData: Partial<BusinessEvent> = {
      eventType,
      category: 'workflow_transition',
      severity: 'medium',
      sourceModule: moduleId,
      subsidiary,
      entityType,
      entityId,
      entityName,
      title: `${eventType}: ${entityName}`,
      description: `Event ${eventType} triggered for ${entityName}`,
      projectId: options?.projectId,
      projectName: options?.projectName,
      previousState: options?.previousState,
      currentState: options?.currentState,
      triggeredBy: options?.triggeredBy,
      triggeredByName: options?.triggeredByName,
      triggeredAt: new Date(),
      metadata: options?.metadata,
    };

    const eventId = await businessEventService.createEvent(eventData as any);

    const fullEvent: BusinessEvent = {
      ...eventData,
      id: eventId,
    } as BusinessEvent;

    const tasks = await taskGenerationService.generateTasksFromEvent(fullEvent);

    await businessEventService.markEventProcessed(
      eventId,
      tasks.map((t) => t.id)
    );

    return { eventId, tasks };
  }

  // ----------------------------------------
  // Design Manager Integration
  // ----------------------------------------

  async onDesignItemStageChange(
    projectId: string,
    designItemId: string,
    designItemName: string,
    previousStage: string,
    newStage: string,
    triggeredBy?: string,
    triggeredByName?: string
  ): Promise<{ eventId: string; tasks: GeneratedTask[] }> {
    return this.triggerEvent(
      'design_manager',
      'design_item_stage_changed',
      'designItems',
      designItemId,
      designItemName,
      {
        projectId,
        previousState: { currentStage: previousStage },
        currentState: { currentStage: newStage },
        triggeredBy,
        triggeredByName,
      }
    );
  }

  async onDesignItemCreated(
    projectId: string,
    designItemId: string,
    designItemName: string,
    designItemData: Record<string, any>,
    triggeredBy?: string,
    triggeredByName?: string
  ): Promise<{ eventId: string; tasks: GeneratedTask[] }> {
    return this.triggerEvent(
      'design_manager',
      'design_item_created',
      'designItems',
      designItemId,
      designItemName,
      {
        projectId,
        currentState: designItemData,
        triggeredBy,
        triggeredByName,
      }
    );
  }

  async onDesignItemApprovalRequested(
    projectId: string,
    designItemId: string,
    designItemName: string,
    approvalType: string,
    triggeredBy?: string,
    triggeredByName?: string
  ): Promise<{ eventId: string; tasks: GeneratedTask[] }> {
    return this.triggerEvent(
      'design_manager',
      'design_item_approval_requested',
      'designItems',
      designItemId,
      designItemName,
      {
        projectId,
        currentState: { approvalType },
        triggeredBy,
        triggeredByName,
      }
    );
  }

  // ----------------------------------------
  // Advisory Integration
  // ----------------------------------------

  async onEngagementCreated(
    engagementId: string,
    engagementName: string,
    engagementData: Record<string, any>,
    triggeredBy?: string,
    triggeredByName?: string
  ): Promise<{ eventId: string; tasks: GeneratedTask[] }> {
    return this.triggerEvent(
      'engagements',
      'engagement_created',
      'engagements',
      engagementId,
      engagementName,
      {
        currentState: engagementData,
        triggeredBy,
        triggeredByName,
      }
    );
  }

  async onDisbursementRequested(
    engagementId: string,
    fundingSourceId: string,
    disbursementId: string,
    amount: number,
    triggeredBy?: string,
    triggeredByName?: string
  ): Promise<{ eventId: string; tasks: GeneratedTask[] }> {
    return this.triggerEvent(
      'funding',
      'disbursement_requested',
      'disbursements',
      disbursementId,
      `Disbursement Request - ${amount}`,
      {
        projectId: engagementId,
        currentState: { fundingSourceId, amount },
        triggeredBy,
        triggeredByName,
      }
    );
  }

  async onReportDue(
    engagementId: string,
    reportId: string,
    reportName: string,
    dueDate: Date,
    triggeredBy?: string
  ): Promise<{ eventId: string; tasks: GeneratedTask[] }> {
    return this.triggerEvent(
      'reporting',
      'report_due',
      'reportSubmissions',
      reportId,
      reportName,
      {
        projectId: engagementId,
        currentState: { dueDate },
        triggeredBy,
      }
    );
  }

  // ----------------------------------------
  // Query Methods
  // ----------------------------------------

  async getTasksForEntity(
    entityType: string,
    entityId: string
  ): Promise<GeneratedTask[]> {
    return taskGenerationService.getTasksByEntity(entityType, entityId);
  }

  async getTasksForProject(projectId: string): Promise<GeneratedTask[]> {
    return taskGenerationService.getTasksByProject(projectId);
  }

  async getTasksForUser(userId: string): Promise<GeneratedTask[]> {
    return taskGenerationService.getTasksByAssignee(userId);
  }

  async getEventsForModule(moduleId: SourceModuleId): Promise<BusinessEvent[]> {
    return businessEventService.getEventsByModule(moduleId);
  }

  // ----------------------------------------
  // Cleanup
  // ----------------------------------------

  unsubscribeAll(): void {
    this.listeners.forEach((unsubscribe) => unsubscribe());
    this.listeners.clear();
    businessEventService.unsubscribeAll();
  }
}

export const intelligenceIntegrationService = new IntelligenceIntegrationService();
export default intelligenceIntegrationService;
