/**
 * Requisition Service
 * 
 * Service for managing material requisitions from projects.
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
  Timestamp
} from 'firebase/firestore';
import { db } from '@/core/services/firebase';
import type {
  Requisition,
  RequisitionItem,
  RequisitionStatus,
  RequisitionTemplate,
  CreateRequisitionInput,
  CreateRequisitionItemInput
} from '../types/requisition';
import type { BOQMoney } from '../types/boq';
import { autoPOGenerationService } from './auto-po-generation.service';

// Generate unique IDs
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Generate requisition number
const generateRequisitionNumber = (_projectId: string): string => {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `REQ-${dateStr}-${random}`;
};

const REQUISITIONS_COLLECTION = 'advisoryPlatform/matflow/requisitions';
const TEMPLATES_COLLECTION = 'advisoryPlatform/matflow/requisitionTemplates';

export const requisitionService = {
  // ============================================================================
  // REQUISITION OPERATIONS
  // ============================================================================
  
  /**
   * Create a new requisition
   */
  async createRequisition(
    input: CreateRequisitionInput,
    userId: string
  ): Promise<string> {
    const id = generateId();
    const requisitionNumber = generateRequisitionNumber(input.projectId);
    
    const requisition: Requisition = {
      id,
      requisitionType: input.requisitionType || 'materials',
      projectId: input.projectId,
      projectName: input.projectName,
      engagementId: input.engagementId,
      programId: input.programId,
      requisitionNumber,
      description: input.description,
      priority: input.priority,
      requiredDate: input.requiredDate,
      items: [],
      totalItems: 0,
      totalEstimatedCost: { amount: 0, currency: 'UGX' },
      status: 'draft',
      workflow: {},
      audit: {
        createdAt: Timestamp.now(),
        createdBy: userId,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
        version: 1
      }
    };
    
    await setDoc(doc(db, REQUISITIONS_COLLECTION, id), requisition);
    return id;
  },
  
  /**
   * Get requisition by ID
   */
  async getRequisition(requisitionId: string): Promise<Requisition | null> {
    const snap = await getDoc(doc(db, REQUISITIONS_COLLECTION, requisitionId));
    return snap.exists() ? (snap.data() as Requisition) : null;
  },
  
  /**
   * Get requisitions for a project
   */
  async getRequisitionsForProject(projectId: string): Promise<Requisition[]> {
    const q = query(
      collection(db, REQUISITIONS_COLLECTION),
      where('projectId', '==', projectId),
      orderBy('audit.createdAt', 'desc')
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Requisition);
  },
  
  /**
   * Get requisitions by status
   */
  async getRequisitionsByStatus(status: RequisitionStatus): Promise<Requisition[]> {
    const q = query(
      collection(db, REQUISITIONS_COLLECTION),
      where('status', '==', status),
      orderBy('requiredDate', 'asc')
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Requisition);
  },
  
  /**
   * Get pending approval requisitions
   */
  async getPendingApprovalRequisitions(): Promise<Requisition[]> {
    const q = query(
      collection(db, REQUISITIONS_COLLECTION),
      where('status', 'in', ['submitted', 'under_review']),
      orderBy('requiredDate', 'asc')
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Requisition);
  },
  
  /**
   * Update requisition metadata
   */
  async updateRequisition(
    requisitionId: string,
    updates: Partial<Pick<Requisition, 'description' | 'priority' | 'requiredDate'>>,
    userId: string
  ): Promise<void> {
    await updateDoc(doc(db, REQUISITIONS_COLLECTION, requisitionId), {
      ...updates,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  // ============================================================================
  // REQUISITION ITEM OPERATIONS
  // ============================================================================
  
  /**
   * Add item to requisition
   */
  async addItem(
    requisitionId: string,
    input: CreateRequisitionItemInput,
    userId: string
  ): Promise<string> {
    const requisition = await this.getRequisition(requisitionId);
    if (!requisition) throw new Error('Requisition not found');
    
    const itemId = generateId();
    const lineNumber = requisition.items.length + 1;
    
    const newItem: RequisitionItem = {
      id: itemId,
      requisitionId,
      lineNumber,
      description: input.description,
      materialId: input.materialId,
      materialCode: input.materialCode,
      materialName: input.materialName,
      boqItemId: input.boqItemId,
      boqItemNumber: input.boqItemNumber,
      requestedQuantity: input.requestedQuantity,
      unit: input.unit,
      estimatedRate: input.estimatedRate,
      estimatedAmount: {
        amount: input.estimatedRate.amount * input.requestedQuantity,
        currency: input.estimatedRate.currency
      },
      specifications: input.specifications,
      technicalRequirements: input.technicalRequirements,
      suggestedSuppliers: input.suggestedSuppliers,
      status: 'pending',
      fulfilledQuantity: 0,
      notes: input.notes
    };
    
    const items = [...requisition.items, newItem];
    const totalEstimatedCost = this.calculateTotalCost(items);
    
    await updateDoc(doc(db, REQUISITIONS_COLLECTION, requisitionId), {
      items,
      totalItems: items.length,
      totalEstimatedCost,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
    
    return itemId;
  },
  
  /**
   * Update item
   */
  async updateItem(
    requisitionId: string,
    itemId: string,
    updates: Partial<CreateRequisitionItemInput>,
    userId: string
  ): Promise<void> {
    const requisition = await this.getRequisition(requisitionId);
    if (!requisition) throw new Error('Requisition not found');
    
    const items = requisition.items.map(item => {
      if (item.id !== itemId) return item;
      
      const updated = { ...item, ...updates };
      if (updates.requestedQuantity !== undefined || updates.estimatedRate !== undefined) {
        updated.estimatedAmount = {
          amount: updated.estimatedRate.amount * updated.requestedQuantity,
          currency: updated.estimatedRate.currency
        };
      }
      return updated;
    });
    
    const totalEstimatedCost = this.calculateTotalCost(items);
    
    await updateDoc(doc(db, REQUISITIONS_COLLECTION, requisitionId), {
      items,
      totalEstimatedCost,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Delete item
   */
  async deleteItem(
    requisitionId: string,
    itemId: string,
    userId: string
  ): Promise<void> {
    const requisition = await this.getRequisition(requisitionId);
    if (!requisition) throw new Error('Requisition not found');
    
    // Re-number remaining items
    const items = requisition.items
      .filter(item => item.id !== itemId)
      .map((item, index) => ({ ...item, lineNumber: index + 1 }));
    
    const totalEstimatedCost = this.calculateTotalCost(items);
    
    await updateDoc(doc(db, REQUISITIONS_COLLECTION, requisitionId), {
      items,
      totalItems: items.length,
      totalEstimatedCost,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Bulk add items
   */
  async bulkAddItems(
    requisitionId: string,
    inputs: CreateRequisitionItemInput[],
    userId: string
  ): Promise<string[]> {
    const requisition = await this.getRequisition(requisitionId);
    if (!requisition) throw new Error('Requisition not found');
    
    const itemIds: string[] = [];
    let lineNumber = requisition.items.length;
    
    const newItems = inputs.map(input => {
      const itemId = generateId();
      itemIds.push(itemId);
      lineNumber++;
      
      return {
        id: itemId,
        requisitionId,
        lineNumber,
        description: input.description,
        materialId: input.materialId,
        materialCode: input.materialCode,
        materialName: input.materialName,
        boqItemId: input.boqItemId,
        boqItemNumber: input.boqItemNumber,
        requestedQuantity: input.requestedQuantity,
        unit: input.unit,
        estimatedRate: input.estimatedRate,
        estimatedAmount: {
          amount: input.estimatedRate.amount * input.requestedQuantity,
          currency: input.estimatedRate.currency
        },
        specifications: input.specifications,
        technicalRequirements: input.technicalRequirements,
        suggestedSuppliers: input.suggestedSuppliers,
        status: 'pending' as const,
        fulfilledQuantity: 0,
        notes: input.notes
      } as RequisitionItem;
    });
    
    const items = [...requisition.items, ...newItems];
    const totalEstimatedCost = this.calculateTotalCost(items);
    
    await updateDoc(doc(db, REQUISITIONS_COLLECTION, requisitionId), {
      items,
      totalItems: items.length,
      totalEstimatedCost,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
    
    return itemIds;
  },
  
  // ============================================================================
  // WORKFLOW OPERATIONS
  // ============================================================================
  
  /**
   * Submit requisition for approval
   */
  async submitRequisition(
    requisitionId: string,
    userId: string
  ): Promise<void> {
    await updateDoc(doc(db, REQUISITIONS_COLLECTION, requisitionId), {
      status: 'submitted',
      'workflow.submittedBy': userId,
      'workflow.submittedAt': Timestamp.now(),
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Technical review
   */
  async technicalReview(
    requisitionId: string,
    approved: boolean,
    notes: string,
    userId: string
  ): Promise<void> {
    await updateDoc(doc(db, REQUISITIONS_COLLECTION, requisitionId), {
      status: 'under_review',
      'workflow.technicalReviewedBy': userId,
      'workflow.technicalReviewedAt': Timestamp.now(),
      'workflow.technicalApproved': approved,
      'workflow.technicalNotes': notes,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Budget review
   */
  async budgetReview(
    requisitionId: string,
    approved: boolean,
    notes: string,
    approvedCost: BOQMoney | undefined,
    userId: string
  ): Promise<void> {
    await updateDoc(doc(db, REQUISITIONS_COLLECTION, requisitionId), {
      ...(approvedCost && { totalApprovedCost: approvedCost }),
      'workflow.budgetReviewedBy': userId,
      'workflow.budgetReviewedAt': Timestamp.now(),
      'workflow.budgetApproved': approved,
      'workflow.budgetNotes': notes,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Final approval
   */
  async approveRequisition(
    requisitionId: string,
    notes: string,
    userId: string
  ): Promise<void> {
    const requisition = await this.getRequisition(requisitionId);
    if (!requisition) throw new Error('Requisition not found');
    
    // Update all items to approved
    const items = requisition.items.map(item => ({
      ...item,
      status: 'approved' as const,
      approvedQuantity: item.requestedQuantity,
      approvedRate: item.estimatedRate,
      approvedAmount: item.estimatedAmount
    }));
    
    await updateDoc(doc(db, REQUISITIONS_COLLECTION, requisitionId), {
      status: 'approved',
      items,
      totalApprovedCost: requisition.totalEstimatedCost,
      'workflow.approvedBy': userId,
      'workflow.approvedAt': Timestamp.now(),
      'workflow.approvalNotes': notes,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });

    // Auto-generate POs for materials requisitions (including legacy 'materials_services' from Firestore)
    const reqType = requisition.requisitionType as string;
    if (reqType === 'materials' || reqType === 'materials_services') {
      try {
        const result = await autoPOGenerationService.generatePOsFromRequisition(
          requisitionId,
          userId
        );

        if (result.success) {
          console.log(
            `✓ Generated ${result.summary.totalPOs} PO(s) for requisition ${requisition.requisitionNumber}`,
            result.summary.supplierBreakdown
          );
        } else {
          console.warn(
            `⚠ PO generation had errors for requisition ${requisition.requisitionNumber}:`,
            result.errors
          );
        }

        if (result.warnings.length > 0) {
          console.warn('PO generation warnings:', result.warnings);
        }
      } catch (error) {
        // Don't throw - requisition approval succeeded, PO generation is bonus
        console.error('Failed to auto-generate POs:', error);
      }
    } else {
      console.log(
        `ℹ Skipping PO generation for funds requisition ${requisition.requisitionNumber}`
      );
    }
  },
  
  /**
   * Reject requisition
   */
  async rejectRequisition(
    requisitionId: string,
    reason: string,
    userId: string
  ): Promise<void> {
    const requisition = await this.getRequisition(requisitionId);
    if (!requisition) throw new Error('Requisition not found');
    
    // Update all items to rejected
    const items = requisition.items.map(item => ({
      ...item,
      status: 'rejected' as const
    }));
    
    await updateDoc(doc(db, REQUISITIONS_COLLECTION, requisitionId), {
      status: 'cancelled',
      items,
      'workflow.rejectedBy': userId,
      'workflow.rejectedAt': Timestamp.now(),
      'workflow.rejectionReason': reason,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Update item fulfillment
   */
  async updateItemFulfillment(
    requisitionId: string,
    itemId: string,
    fulfilledQuantity: number,
    userId: string
  ): Promise<void> {
    const requisition = await this.getRequisition(requisitionId);
    if (!requisition) throw new Error('Requisition not found');
    
    const items = requisition.items.map(item => {
      if (item.id !== itemId) return item;
      
      const newFulfilled = fulfilledQuantity;
      const targetQty = item.approvedQuantity ?? item.requestedQuantity;
      
      let status = item.status;
      if (newFulfilled > 0 && newFulfilled < targetQty) {
        status = 'partially_fulfilled';
      } else if (newFulfilled >= targetQty) {
        status = 'fulfilled';
      }
      
      return { ...item, fulfilledQuantity: newFulfilled, status };
    });
    
    // Check if all items are fulfilled
    const allFulfilled = items.every(item => item.status === 'fulfilled');
    const anyFulfilled = items.some(item => 
      item.status === 'fulfilled' || item.status === 'partially_fulfilled'
    );
    
    let requisitionStatus = requisition.status;
    if (allFulfilled) {
      requisitionStatus = 'fulfilled';
    } else if (anyFulfilled) {
      requisitionStatus = 'partially_fulfilled';
    }
    
    await updateDoc(doc(db, REQUISITIONS_COLLECTION, requisitionId), {
      items,
      status: requisitionStatus,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Link purchase order to requisition
   */
  async linkPurchaseOrder(
    requisitionId: string,
    purchaseOrderId: string,
    userId: string
  ): Promise<void> {
    const requisition = await this.getRequisition(requisitionId);
    if (!requisition) throw new Error('Requisition not found');
    
    const purchaseOrderIds = [...(requisition.purchaseOrderIds || []), purchaseOrderId];
    
    await updateDoc(doc(db, REQUISITIONS_COLLECTION, requisitionId), {
      purchaseOrderIds,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================
  
  calculateTotalCost(items: RequisitionItem[]): BOQMoney {
    const total = items.reduce((sum, item) => sum + item.estimatedAmount.amount, 0);
    return {
      amount: total,
      currency: items[0]?.estimatedAmount.currency || 'UGX'
    };
  },
  
  // ============================================================================
  // TEMPLATE OPERATIONS
  // ============================================================================
  
  /**
   * Create requisition template
   */
  async createTemplate(
    template: Omit<RequisitionTemplate, 'id' | 'usageCount' | 'audit'>,
    userId: string
  ): Promise<string> {
    const id = generateId();
    
    const fullTemplate: RequisitionTemplate = {
      ...template,
      id,
      usageCount: 0,
      audit: {
        createdAt: Timestamp.now(),
        createdBy: userId,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
        version: 1
      }
    };
    
    await setDoc(doc(db, TEMPLATES_COLLECTION, id), fullTemplate);
    return id;
  },
  
  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<RequisitionTemplate | null> {
    const snap = await getDoc(doc(db, TEMPLATES_COLLECTION, templateId));
    return snap.exists() ? (snap.data() as RequisitionTemplate) : null;
  },
  
  /**
   * Get all templates
   */
  async getAllTemplates(): Promise<RequisitionTemplate[]> {
    const q = query(
      collection(db, TEMPLATES_COLLECTION),
      orderBy('name')
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as RequisitionTemplate);
  },
  
  /**
   * Create requisition from template
   */
  async createFromTemplate(
    templateId: string,
    input: CreateRequisitionInput,
    userId: string
  ): Promise<string> {
    const template = await this.getTemplate(templateId);
    if (!template) throw new Error('Template not found');
    
    // Create requisition
    const requisitionId = await this.createRequisition(input, userId);
    
    // Add items from template
    await this.bulkAddItems(requisitionId, template.items, userId);
    
    // Update template usage
    await updateDoc(doc(db, TEMPLATES_COLLECTION, templateId), {
      usageCount: template.usageCount + 1,
      lastUsedAt: Timestamp.now()
    });
    
    return requisitionId;
  }
};

export default requisitionService;
