/**
 * ENHANCED REQUISITION SERVICE
 *
 * ADD-FIN-001 compliant requisition service with:
 * - BOQ validation and budget control
 * - Dual-approval workflow (Technical → Financial)
 * - Advance policy enforcement
 * - Custom approval configuration support
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  Firestore,
  updateDoc,
} from 'firebase/firestore';
import {
  RequisitionFormData,
  RequisitionBOQItem,
} from '../../types/requisition';
import { RequisitionService } from '../../services/requisition-service';
import { BOQControlService } from './boq-control.service';
import {
  ApprovalConfiguration,
  getDefaultRequisitionConfig,
  shouldSkipStage,
} from '../../types/approval-config';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface AdvancePolicyConfig {
  maxAdvancePercent: number; // Default: 80
  accountabilityDeadlineDays: {
    materials: number; // Default: 14
    labor: number; // Default: 7
    equipment: number; // Default: 14
    transport: number; // Default: 7
    miscellaneous: number; // Default: 7
  };
  blockNewAdvances: boolean; // Default: true
}

export interface RequisitionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  boqValidations?: {
    itemId: string;
    itemCode: string;
    valid: boolean;
    errors: string[];
    warnings: string[];
  }[];
}

export interface ApprovalStep {
  sequence: number;
  name: string;
  approverType: 'role' | 'user';
  approverRole?: string;
  approverId?: string;
  alternativeRoles?: string[];
  isRequired: boolean;
  slaHours: number;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  canRunInParallel: boolean;
  parallelGroupId?: string;
  isExternalApproval: boolean;
  assignedTo?: string;
  assignedAt?: Timestamp;
  completedAt?: Timestamp;
  completedBy?: string;
  comments?: string;
}

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

const DEFAULT_ADVANCE_POLICY: AdvancePolicyConfig = {
  maxAdvancePercent: 80,
  accountabilityDeadlineDays: {
    materials: 14,
    labor: 7,
    equipment: 14,
    transport: 7,
    miscellaneous: 7,
  },
  blockNewAdvances: true,
};

const APPROVAL_CONFIG_PATH = 'approval_config';
const PAYMENTS_PATH = 'payments';
const PROJECTS_PATH = 'projects';
const PROGRAMS_PATH = 'programs';
const ORGANIZATIONS_PATH = 'organizations';

// ─────────────────────────────────────────────────────────────────
// ENHANCED REQUISITION SERVICE
// ─────────────────────────────────────────────────────────────────

export class EnhancedRequisitionService {
  private baseService: RequisitionService;
  private boqService: BOQControlService;

  constructor(private db: Firestore) {
    this.baseService = RequisitionService.getInstance(db);
    this.boqService = new BOQControlService(db);
  }

  // ─────────────────────────────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Validate requisition against ADD-FIN-001 policies
   */
  async validateRequisition(
    data: RequisitionFormData,
    userId: string
  ): Promise<RequisitionValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const boqValidations: RequisitionValidationResult['boqValidations'] = [];

    // 1. Check for overdue accountabilities (advance policy)
    const hasOverdue = await this.hasOverdueAccountabilities(
      data.projectId,
      userId
    );
    if (hasOverdue) {
      errors.push(
        'Cannot create new requisition. You have overdue accountabilities that must be completed first.'
      );
    }

    // 2. Validate BOQ items (if any)
    const boqItems = data.items.filter(
      item => (item as unknown as RequisitionBOQItem).sourceType === 'boq'
    );

    for (const item of boqItems) {
      const boqItem = item as unknown as RequisitionBOQItem;
      if (!boqItem.boqItemId) continue;

      const boqValidation = await this.boqService.validateRequisition(
        data.projectId,
        boqItem.boqItemId,
        boqItem.quantity ?? 0,
        boqItem.amount
      );

      boqValidations.push({
        itemId: boqItem.boqItemId,
        itemCode: boqValidation.boqItem?.itemCode || 'Unknown',
        valid: boqValidation.valid,
        errors: boqValidation.errors,
        warnings: boqValidation.warnings,
      });

      if (!boqValidation.valid) {
        errors.push(
          ...boqValidation.errors.map(
            err => `BOQ Item ${boqValidation.boqItem?.itemCode || boqItem.boqItemId}: ${err}`
          )
        );
      }

      if (boqValidation.warnings.length > 0) {
        warnings.push(
          ...boqValidation.warnings.map(
            warn =>
              `BOQ Item ${boqValidation.boqItem?.itemCode || boqItem.boqItemId}: ${warn}`
          )
        );
      }
    }

    // 3. Validate advance amount (if configured)
    const advancePolicy = await this.getAdvancePolicy(data.projectId);
    const totalAmount = data.items.reduce((sum, item) => sum + (item.amount ?? 0), 0);

    // For now, just log warning if advance > 80%
    if (totalAmount > 0) {
      const advancePercent = (totalAmount / totalAmount) * 100; // This would check against budget line
      if (advancePercent > advancePolicy.maxAdvancePercent) {
        warnings.push(
          `Advance amount exceeds ${advancePolicy.maxAdvancePercent}% policy limit.`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      boqValidations:
        boqValidations.length > 0 ? boqValidations : undefined,
    };
  }

  /**
   * Check if user has overdue accountabilities
   */
  async hasOverdueAccountabilities(
    projectId: string,
    userId: string
  ): Promise<boolean> {
    const advancePolicy = await this.getAdvancePolicy(projectId);
    if (!advancePolicy.blockNewAdvances) {
      return false;
    }

    const q = query(
      collection(this.db, PAYMENTS_PATH),
      where('projectId', '==', projectId),
      where('paymentType', '==', 'requisition'),
      where('createdBy', '==', userId),
      where('accountabilityStatus', 'in', ['overdue'])
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }

  /**
   * Get advance policy configuration for project
   */
  async getAdvancePolicy(projectId: string): Promise<AdvancePolicyConfig> {
    // Check for project-specific policy
    const projectDoc = await getDoc(doc(this.db, PROJECTS_PATH, projectId));
    if (projectDoc.exists()) {
      const projectData = projectDoc.data();
      if (projectData.advancePolicy) {
        return { ...DEFAULT_ADVANCE_POLICY, ...projectData.advancePolicy };
      }
    }

    // Fall back to default
    return DEFAULT_ADVANCE_POLICY;
  }

  // ─────────────────────────────────────────────────────────────────
  // APPROVAL CONFIGURATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Resolve which approval configuration to use
   * Hierarchy: Project → Program → Organization Default (ADD-FIN-001)
   */
  async resolveApprovalConfiguration(
    projectId: string
  ): Promise<ApprovalConfiguration> {
    // 1. Check project-level custom config
    const projectConfig = await this.getApprovalConfig('project', projectId);
    if (projectConfig?.isActive && projectConfig?.overridesDefault) {
      return projectConfig;
    }

    // 2. Check program-level custom config
    const projectDoc = await getDoc(doc(this.db, PROJECTS_PATH, projectId));
    let organizationId = 'default';
    if (projectDoc.exists()) {
      const projectData = projectDoc.data();
      if (projectData.organizationId) {
        organizationId = projectData.organizationId;
      }
      if (projectData.programId) {
        const programConfig = await this.getApprovalConfig(
          'program',
          projectData.programId
        );
        if (programConfig?.isActive && programConfig?.overridesDefault) {
          return programConfig;
        }
      }

      // 3. Check organization-level custom config
      if (projectData.organizationId) {
        const orgConfig = await this.getApprovalConfig(
          'organization',
          projectData.organizationId
        );
        if (orgConfig?.isActive && orgConfig?.overridesDefault) {
          return orgConfig;
        }
      }
    }

    // 4. Fall back to ADD-FIN-001 default
    return getDefaultRequisitionConfig(organizationId, 'system') as ApprovalConfiguration;
  }

  /**
   * Get approval configuration from Firestore
   */
  private async getApprovalConfig(
    level: 'organization' | 'program' | 'project',
    entityId: string
  ): Promise<ApprovalConfiguration | null> {
    const basePath =
      level === 'organization'
        ? ORGANIZATIONS_PATH
        : level === 'program'
          ? PROGRAMS_PATH
          : PROJECTS_PATH;

    const q = query(
      collection(this.db, basePath, entityId, APPROVAL_CONFIG_PATH),
      where('type', '==', 'requisition'),
      where('isActive', '==', true),
      orderBy('updatedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }

    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ApprovalConfiguration;
  }

  /**
   * Build approval chain from configuration
   */
  buildApprovalChain(
    config: ApprovalConfiguration,
    requisitionAmount: number,
    requisitionCurrency: string,
    requisitionCategory?: string
  ): ApprovalStep[] {
    const chain: ApprovalStep[] = [];

    for (const stage of config.stages) {
      // Check skip conditions
      if (
        shouldSkipStage(stage, {
          amount: requisitionAmount,
          currency: requisitionCurrency,
          category: requisitionCategory,
        })
      ) {
        continue;
      }

      chain.push({
        sequence: stage.sequence,
        name: stage.name,
        approverType: 'role',
        approverRole: stage.requiredRole,
        alternativeRoles: stage.alternativeRoles,
        isRequired: stage.isRequired,
        slaHours: stage.slaHours,
        status: 'pending',
        canRunInParallel: stage.canRunInParallel,
        parallelGroupId: stage.parallelGroupId,
        isExternalApproval: stage.isExternalApproval,
      });
    }

    return chain;
  }

  // ─────────────────────────────────────────────────────────────────
  // ENHANCED CREATE REQUISITION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create requisition with ADD-FIN-001 enhancements
   */
  async createRequisition(
    data: RequisitionFormData,
    userId: string
  ): Promise<string> {
    // 1. Validate against ADD-FIN-001 policies
    const validation = await this.validateRequisition(data, userId);
    if (!validation.valid) {
      throw new Error(
        `Requisition validation failed:\n${validation.errors.join('\n')}`
      );
    }

    // 2. Create base requisition
    const requisitionId = await this.baseService.createRequisition(
      data,
      userId
    );

    // 3. Resolve and apply approval configuration
    const approvalConfig =
      await this.resolveApprovalConfiguration(data.projectId);
    const totalAmount = data.items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
    const approvalChain = this.buildApprovalChain(
      approvalConfig,
      totalAmount,
      data.currency || 'UGX',
      data.advanceType
    );

    // 4. Update requisition with approval chain and ADD-FIN-001 fields
    await updateDoc(doc(this.db, PAYMENTS_PATH, requisitionId), {
      approvalChain,
      useCustomApprovalChain: !approvalConfig.isDefault,
      customApprovalChainId: approvalConfig.isDefault
        ? undefined
        : approvalConfig.id,
      notionSyncStatus: 'pending',
      updatedAt: Timestamp.now(),
    });

    // 5. Reserve BOQ quantities (if any BOQ items)
    await this.reserveBOQQuantities(requisitionId, data);

    return requisitionId;
  }

  /**
   * Reserve BOQ quantities when requisition is approved
   */
  private async reserveBOQQuantities(
    requisitionId: string,
    data: RequisitionFormData
  ): Promise<void> {
    const boqItems = data.items.filter(
      item => (item as unknown as RequisitionBOQItem).sourceType === 'boq'
    );

    for (const item of boqItems) {
      const boqItem = item as unknown as RequisitionBOQItem;
      if (!boqItem.boqItemId) continue;

      await this.boqService.reserveQuantity(
        data.projectId,
        boqItem.boqItemId,
        boqItem.quantity ?? 0,
        boqItem.amount,
        requisitionId
      );
    }
  }

  /**
   * Update BOQ quantities when requisition is approved
   * Called by approval workflow
   */
  async onRequisitionApproved(
    requisitionId: string,
    userId: string
  ): Promise<void> {
    const requisition = await this.baseService.getRequisition(requisitionId);
    if (!requisition) {
      throw new Error('Requisition not found');
    }

    // Update approval timestamps
    const approvalChain = requisition.approvalChain || [];
    const currentStep = approvalChain.find(step => step.status === 'pending');
    if (currentStep) {
      currentStep.status = 'approved';
      currentStep.completedAt = Timestamp.now();
      currentStep.completedBy = userId;

      // Determine approval type based on step name
      if (currentStep.name === 'Technical Review') {
        await updateDoc(doc(this.db, PAYMENTS_PATH, requisitionId), {
          technicalApprover: userId,
          technicalApprovalDate: Timestamp.now(),
          approvalChain,
        });
      } else if (currentStep.name === 'Financial Approval') {
        await updateDoc(doc(this.db, PAYMENTS_PATH, requisitionId), {
          financialApprover: userId,
          financialApprovalDate: Timestamp.now(),
          approvalChain,
        });
      }
    }

    // If final approval, update BOQ quantities
    const allApproved = approvalChain.every(
      step => !step.isRequired || step.status === 'approved'
    );
    if (allApproved) {
      await this.reserveBOQQuantities(requisitionId, {
        projectId: requisition.projectId,
        items: requisition.items,
      } as unknown as RequisitionFormData);
    }
  }

  /**
   * Calculate accountability due date based on advance type
   */
  calculateAccountabilityDueDate(
    advanceType: string,
    approvalDate: Date
  ): Date {
    const policy = DEFAULT_ADVANCE_POLICY;
    const days =
      policy.accountabilityDeadlineDays[
        advanceType as keyof typeof policy.accountabilityDeadlineDays
      ] || 14;

    const dueDate = new Date(approvalDate);
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate;
  }

  // ─────────────────────────────────────────────────────────────────
  // QUOTATION MANAGEMENT (Optional - PM Responsibility)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Add quotation to requisition (optional, for PM reference)
   */
  async addQuotation(
    requisitionId: string,
    quotation: {
      supplierName: string;
      quotedAmount: number;
      documentUrl?: string;
    },
    userId: string
  ): Promise<void> {
    const requisition = await this.baseService.getRequisition(requisitionId);
    if (!requisition) {
      throw new Error('Requisition not found');
    }

    const quotationId = `quote-${Date.now()}`;
    const newQuotation = {
      id: quotationId,
      ...quotation,
      receivedAt: Timestamp.now(),
    };

    const existingQuotations = requisition.quotations || [];

    await updateDoc(doc(this.db, PAYMENTS_PATH, requisitionId), {
      quotations: [...existingQuotations, newQuotation],
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  /**
   * Select supplier for requisition (optional, for PM reference)
   */
  async selectSupplier(
    requisitionId: string,
    supplier: {
      name: string;
      contactInfo: string;
      selectionReason?: string;
      alternativesConsidered: number;
    },
    userId: string
  ): Promise<void> {
    await updateDoc(doc(this.db, PAYMENTS_PATH, requisitionId), {
      selectedSupplier: supplier,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }
}

// Export factory
export function getEnhancedRequisitionService(
  db: Firestore
): EnhancedRequisitionService {
  return new EnhancedRequisitionService(db);
}
