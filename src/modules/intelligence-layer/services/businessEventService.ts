// ============================================================================
// BUSINESS EVENT SERVICE
// DawinOS v2.0 - Intelligence Layer
// Service for detecting and processing business events across modules
// ============================================================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import type { SourceModuleId } from '../constants';
import type {
  BusinessEvent,
  BusinessEventCategory,
  BusinessEventSeverity,
  SubsidiaryId,
} from '../types/businessEvents';

// ============================================================================
// COLLECTION REFERENCES
// ============================================================================

const BUSINESS_EVENTS_COLLECTION = 'businessEvents';

// ============================================================================
// EVENT DETECTION PATTERNS
// ============================================================================

interface EventPattern {
  eventType: string;
  category: BusinessEventCategory;
  detectFrom: {
    previousField?: string;
    currentField: string;
    changeType: 'created' | 'updated' | 'deleted' | 'field_changed';
  };
  severityRules: SeverityRule[];
}

interface SeverityRule {
  condition: (prev: any, curr: any) => boolean;
  severity: BusinessEventSeverity;
}

// Design Manager Event Patterns
const DESIGN_MANAGER_PATTERNS: EventPattern[] = [
  {
    eventType: 'design_item_stage_changed',
    category: 'workflow_transition',
    detectFrom: {
      previousField: 'currentStage',
      currentField: 'currentStage',
      changeType: 'field_changed',
    },
    severityRules: [
      {
        condition: (_, curr) => curr === 'production-ready',
        severity: 'high',
      },
      {
        condition: (_, curr) => curr === 'pre-production',
        severity: 'medium',
      },
      {
        condition: () => true,
        severity: 'info',
      },
    ],
  },
  {
    eventType: 'design_item_approval_requested',
    category: 'approval_required',
    detectFrom: {
      currentField: 'approvals',
      changeType: 'field_changed',
    },
    severityRules: [
      {
        condition: () => true,
        severity: 'medium',
      },
    ],
  },
  {
    eventType: 'design_item_rag_updated',
    category: 'quality_gate',
    detectFrom: {
      previousField: 'ragStatus',
      currentField: 'ragStatus',
      changeType: 'field_changed',
    },
    severityRules: [
      {
        condition: (_, curr) => {
          // Check if any critical RAG items went red
          const hasRed = JSON.stringify(curr).includes('"status":"red"');
          return hasRed;
        },
        severity: 'high',
      },
      {
        condition: () => true,
        severity: 'low',
      },
    ],
  },
];

// Inventory Event Patterns
const INVENTORY_PATTERNS: EventPattern[] = [
  {
    eventType: 'stock_low',
    category: 'resource_constraint',
    detectFrom: {
      currentField: 'stockLevel',
      changeType: 'field_changed',
    },
    severityRules: [
      {
        condition: (_, curr) => curr <= 0,
        severity: 'critical',
      },
      {
        condition: (prev, curr) => {
          const reorderPoint = prev?.reorderPoint || 10;
          return curr <= reorderPoint;
        },
        severity: 'high',
      },
      {
        condition: () => true,
        severity: 'info',
      },
    ],
  },
  {
    eventType: 'stock_reorder_required',
    category: 'resource_constraint',
    detectFrom: {
      currentField: 'stockLevel',
      changeType: 'field_changed',
    },
    severityRules: [
      {
        condition: (prev, curr) => {
          const reorderPoint = prev?.reorderPoint || 10;
          return curr <= reorderPoint && (!prev || prev.stockLevel > reorderPoint);
        },
        severity: 'high',
      },
      {
        condition: () => true,
        severity: 'low',
      },
    ],
  },
  {
    eventType: 'material_received',
    category: 'milestone_reached',
    detectFrom: {
      currentField: 'lastReceivedAt',
      changeType: 'field_changed',
    },
    severityRules: [
      {
        condition: () => true,
        severity: 'info',
      },
    ],
  },
];

// Launch Pipeline Event Patterns
const LAUNCH_PIPELINE_PATTERNS: EventPattern[] = [
  {
    eventType: 'product_stage_changed',
    category: 'workflow_transition',
    detectFrom: {
      previousField: 'stage',
      currentField: 'stage',
      changeType: 'field_changed',
    },
    severityRules: [
      {
        condition: (_, curr) => curr === 'launched',
        severity: 'high',
      },
      {
        condition: (_, curr) => curr === 'ready_to_launch',
        severity: 'medium',
      },
      {
        condition: () => true,
        severity: 'info',
      },
    ],
  },
  {
    eventType: 'product_created',
    category: 'milestone_reached',
    detectFrom: {
      currentField: 'name',
      changeType: 'created',
    },
    severityRules: [
      {
        condition: () => true,
        severity: 'info',
      },
    ],
  },
  {
    eventType: 'product_pricing_updated',
    category: 'cost_threshold',
    detectFrom: {
      previousField: 'price',
      currentField: 'price',
      changeType: 'field_changed',
    },
    severityRules: [
      {
        condition: (prev, curr) => {
          if (!prev || prev === 0) return false;
          const changePercent = Math.abs((curr - prev) / prev) * 100;
          return changePercent > 20;
        },
        severity: 'high',
      },
      {
        condition: () => true,
        severity: 'low',
      },
    ],
  },
];

// Advisory / Engagements Event Patterns
const ENGAGEMENTS_PATTERNS: EventPattern[] = [
  {
    eventType: 'engagement_status_changed',
    category: 'workflow_transition',
    detectFrom: {
      previousField: 'status',
      currentField: 'status',
      changeType: 'field_changed',
    },
    severityRules: [
      {
        condition: (_, curr) => curr === 'at_risk' || curr === 'on_hold',
        severity: 'high',
      },
      {
        condition: (_, curr) => curr === 'completed',
        severity: 'medium',
      },
      {
        condition: () => true,
        severity: 'info',
      },
    ],
  },
  {
    eventType: 'engagement_created',
    category: 'milestone_reached',
    detectFrom: {
      currentField: 'name',
      changeType: 'created',
    },
    severityRules: [
      {
        condition: () => true,
        severity: 'medium',
      },
    ],
  },
  {
    eventType: 'engagement_budget_threshold',
    category: 'cost_threshold',
    detectFrom: {
      currentField: 'budgetUtilization',
      changeType: 'field_changed',
    },
    severityRules: [
      {
        condition: (_, curr) => curr >= 95,
        severity: 'critical',
      },
      {
        condition: (_, curr) => curr >= 80,
        severity: 'high',
      },
      {
        condition: (_, curr) => curr >= 60,
        severity: 'medium',
      },
      {
        condition: () => true,
        severity: 'info',
      },
    ],
  },
];

// Funding Event Patterns
const FUNDING_PATTERNS: EventPattern[] = [
  {
    eventType: 'disbursement_requested',
    category: 'approval_required',
    detectFrom: {
      currentField: 'amount',
      changeType: 'created',
    },
    severityRules: [
      {
        condition: (_, curr) => curr > 500000,
        severity: 'high',
      },
      {
        condition: () => true,
        severity: 'medium',
      },
    ],
  },
  {
    eventType: 'covenant_breach_risk',
    category: 'quality_gate',
    detectFrom: {
      currentField: 'covenantStatus',
      changeType: 'field_changed',
    },
    severityRules: [
      {
        condition: (_, curr) => curr === 'breached',
        severity: 'critical',
      },
      {
        condition: (_, curr) => curr === 'at_risk',
        severity: 'high',
      },
      {
        condition: () => true,
        severity: 'medium',
      },
    ],
  },
];

// Customer Hub Event Patterns
const CUSTOMER_HUB_PATTERNS: EventPattern[] = [
  {
    eventType: 'customer_created',
    category: 'milestone_reached',
    detectFrom: {
      currentField: 'name',
      changeType: 'created',
    },
    severityRules: [
      {
        condition: () => true,
        severity: 'info',
      },
    ],
  },
  {
    eventType: 'customer_project_assigned',
    category: 'team_assignment',
    detectFrom: {
      currentField: 'projectIds',
      changeType: 'field_changed',
    },
    severityRules: [
      {
        condition: () => true,
        severity: 'info',
      },
    ],
  },
];

// ============================================================================
// BUSINESS EVENT SERVICE
// ============================================================================

class BusinessEventService {
  private listeners: Map<string, Unsubscribe> = new Map();

  // ----------------------------------------
  // Event Creation
  // ----------------------------------------

  async createEvent(
    eventData: Omit<BusinessEvent, 'id' | 'createdAt' | 'status'>
  ): Promise<string> {
    const eventRef = await addDoc(collection(db, BUSINESS_EVENTS_COLLECTION), {
      ...eventData,
      status: 'pending',
      createdAt: Timestamp.now(),
      triggeredAt: Timestamp.fromDate(eventData.triggeredAt),
    });

    return eventRef.id;
  }

  // ----------------------------------------
  // Event Detection from Document Changes
  // ----------------------------------------

  detectEventFromChange(
    sourceModule: SourceModuleId,
    subsidiary: SubsidiaryId,
    entityType: string,
    entityId: string,
    entityName: string,
    previousData: Record<string, any> | null,
    currentData: Record<string, any>,
    projectId?: string,
    projectName?: string,
    triggeredBy?: string,
    triggeredByName?: string
  ): Partial<BusinessEvent>[] {
    const detectedEvents: Partial<BusinessEvent>[] = [];

    // Get patterns for this module
    const patterns = this.getPatternsForModule(sourceModule);

    for (const pattern of patterns) {
      const { detectFrom } = pattern;

      // Check if this change matches the pattern
      let isMatch = false;
      let changedFields: string[] = [];

      if (detectFrom.changeType === 'created' && !previousData) {
        isMatch = true;
      } else if (detectFrom.changeType === 'field_changed' && previousData) {
        const prevValue = this.getNestedValue(previousData, detectFrom.currentField);
        const currValue = this.getNestedValue(currentData, detectFrom.currentField);

        if (JSON.stringify(prevValue) !== JSON.stringify(currValue)) {
          isMatch = true;
          changedFields.push(detectFrom.currentField);
        }
      }

      if (isMatch) {
        // Determine severity
        let severity: BusinessEventSeverity = 'info';
        for (const rule of pattern.severityRules) {
          const prevValue = previousData
            ? this.getNestedValue(previousData, detectFrom.currentField)
            : null;
          const currValue = this.getNestedValue(currentData, detectFrom.currentField);

          if (rule.condition(prevValue, currValue)) {
            severity = rule.severity;
            break;
          }
        }

        // Build event title and description
        const { title, description } = this.buildEventDescription(
          pattern.eventType,
          entityName,
          previousData,
          currentData,
          changedFields
        );

        detectedEvents.push({
          eventType: pattern.eventType,
          category: pattern.category,
          severity,
          sourceModule,
          subsidiary,
          entityType,
          entityId,
          entityName,
          projectId,
          projectName,
          title,
          description,
          previousState: previousData || undefined,
          currentState: currentData,
          changedFields,
          triggeredBy,
          triggeredByName,
          triggeredAt: new Date(),
        });
      }
    }

    return detectedEvents;
  }

  private getPatternsForModule(moduleId: SourceModuleId): EventPattern[] {
    switch (moduleId) {
      case 'design_manager':
        return DESIGN_MANAGER_PATTERNS;
      case 'inventory':
        return INVENTORY_PATTERNS;
      case 'launch_pipeline':
        return LAUNCH_PIPELINE_PATTERNS;
      case 'engagements':
      case 'advisory':
        return ENGAGEMENTS_PATTERNS;
      case 'funding':
        return FUNDING_PATTERNS;
      case 'customer_hub':
        return CUSTOMER_HUB_PATTERNS;
      default:
        return [];
    }
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private buildEventDescription(
    eventType: string,
    entityName: string,
    previousData: Record<string, any> | null,
    currentData: Record<string, any>,
    changedFields: string[]
  ): { title: string; description: string } {
    switch (eventType) {
      case 'design_item_stage_changed':
        const prevStage = previousData?.currentStage || 'unknown';
        const currStage = currentData.currentStage;
        return {
          title: `Design Item Stage Changed: ${entityName}`,
          description: `Design item "${entityName}" moved from ${prevStage} to ${currStage} stage.`,
        };

      case 'design_item_approval_requested':
        return {
          title: `Approval Requested: ${entityName}`,
          description: `An approval has been requested for design item "${entityName}".`,
        };

      case 'design_item_rag_updated':
        return {
          title: `RAG Status Updated: ${entityName}`,
          description: `RAG status has been updated for design item "${entityName}".`,
        };

      case 'design_item_created':
        return {
          title: `New Design Item Created: ${entityName}`,
          description: `A new design item "${entityName}" has been created.`,
        };

      // Inventory events
      case 'stock_low':
        return {
          title: `Low Stock Alert: ${entityName}`,
          description: `Stock level for "${entityName}" has fallen below the reorder threshold.`,
        };

      case 'stock_reorder_required':
        return {
          title: `Reorder Required: ${entityName}`,
          description: `"${entityName}" needs to be reordered to maintain adequate stock levels.`,
        };

      case 'material_received':
        return {
          title: `Material Received: ${entityName}`,
          description: `New stock has been received for "${entityName}".`,
        };

      // Launch Pipeline events
      case 'product_stage_changed': {
        const prevS = previousData?.stage || 'unknown';
        const currS = currentData.stage;
        return {
          title: `Product Stage Changed: ${entityName}`,
          description: `Product "${entityName}" moved from ${prevS} to ${currS}.`,
        };
      }

      case 'product_created':
        return {
          title: `New Product Created: ${entityName}`,
          description: `A new product "${entityName}" has been added to the launch pipeline.`,
        };

      case 'product_pricing_updated':
        return {
          title: `Pricing Updated: ${entityName}`,
          description: `Pricing has been updated for product "${entityName}".`,
        };

      // Engagement events
      case 'engagement_status_changed': {
        const prevEs = previousData?.status || 'unknown';
        const currEs = currentData.status;
        return {
          title: `Engagement Status Changed: ${entityName}`,
          description: `Engagement "${entityName}" status changed from ${prevEs} to ${currEs}.`,
        };
      }

      case 'engagement_created':
        return {
          title: `New Engagement Created: ${entityName}`,
          description: `A new engagement "${entityName}" has been created.`,
        };

      case 'engagement_budget_threshold':
        return {
          title: `Budget Threshold: ${entityName}`,
          description: `Budget utilization for engagement "${entityName}" has reached ${currentData.budgetUtilization}%.`,
        };

      // Funding events
      case 'disbursement_requested':
        return {
          title: `Disbursement Requested: ${entityName}`,
          description: `A disbursement has been requested for "${entityName}".`,
        };

      case 'covenant_breach_risk':
        return {
          title: `Covenant Risk: ${entityName}`,
          description: `Covenant compliance risk detected for "${entityName}": status is ${currentData.covenantStatus}.`,
        };

      // Customer Hub events
      case 'customer_created':
        return {
          title: `New Customer: ${entityName}`,
          description: `A new customer "${entityName}" has been created.`,
        };

      case 'customer_project_assigned':
        return {
          title: `Project Assigned to Customer: ${entityName}`,
          description: `A project has been assigned to customer "${entityName}".`,
        };

      default:
        return {
          title: `Event: ${entityName}`,
          description: `An event occurred for "${entityName}". Changed fields: ${changedFields.join(', ')}.`,
        };
    }
  }

  // ----------------------------------------
  // Event Queries
  // ----------------------------------------

  async getPendingEvents(limitCount: number = 50): Promise<BusinessEvent[]> {
    const q = query(
      collection(db, BUSINESS_EVENTS_COLLECTION),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      triggeredAt: doc.data().triggeredAt?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      processedAt: doc.data().processedAt?.toDate(),
    })) as BusinessEvent[];
  }

  async getEventsByModule(
    moduleId: SourceModuleId,
    limitCount: number = 50
  ): Promise<BusinessEvent[]> {
    const q = query(
      collection(db, BUSINESS_EVENTS_COLLECTION),
      where('sourceModule', '==', moduleId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      triggeredAt: doc.data().triggeredAt?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      processedAt: doc.data().processedAt?.toDate(),
    })) as BusinessEvent[];
  }

  async getEventsByEntity(
    entityType: string,
    entityId: string,
    limitCount: number = 20
  ): Promise<BusinessEvent[]> {
    const q = query(
      collection(db, BUSINESS_EVENTS_COLLECTION),
      where('entityType', '==', entityType),
      where('entityId', '==', entityId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      triggeredAt: doc.data().triggeredAt?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      processedAt: doc.data().processedAt?.toDate(),
    })) as BusinessEvent[];
  }

  // ----------------------------------------
  // Event Processing
  // ----------------------------------------

  async markEventProcessed(
    eventId: string,
    generatedTaskIds: string[]
  ): Promise<void> {
    await updateDoc(doc(db, BUSINESS_EVENTS_COLLECTION, eventId), {
      status: 'processed',
      processedAt: Timestamp.now(),
      generatedTaskIds,
    });
  }

  async markEventFailed(eventId: string, error: string): Promise<void> {
    await updateDoc(doc(db, BUSINESS_EVENTS_COLLECTION, eventId), {
      status: 'failed',
      processedAt: Timestamp.now(),
      error,
    });
  }

  // ----------------------------------------
  // Real-time Listeners
  // ----------------------------------------

  subscribeToPendingEvents(
    callback: (events: BusinessEvent[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, BUSINESS_EVENTS_COLLECTION),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const events = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        triggeredAt: doc.data().triggeredAt?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as BusinessEvent[];

      callback(events);
    });
  }

  // ----------------------------------------
  // Cleanup
  // ----------------------------------------

  unsubscribeAll(): void {
    this.listeners.forEach((unsubscribe) => unsubscribe());
    this.listeners.clear();
  }
}

export const businessEventService = new BusinessEventService();
export default businessEventService;
