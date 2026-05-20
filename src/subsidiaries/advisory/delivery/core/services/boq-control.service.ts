/**
 * BOQ CONTROL SERVICE (ADD-FIN-001)
 *
 * Enhanced BOQ control service with ADD-FIN-001 integration:
 * - Budget control tracking
 * - Requisition validation
 * - Quantity reservation and execution
 * - Variance detection and alerting
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  Firestore,
  Timestamp,
} from 'firebase/firestore';
import type {
  ControlBOQItem,
  BOQBudgetControl,
  VarianceBudgetStatus,
} from '../../types/control-boq';
import {
  calculateBudgetControl,
  hasSufficientBudget,
  updateBOQAfterRequisitionApproval,
  updateBOQAfterAccountability,
  getAvailableQuantity,
} from '../../types/control-boq';

// ─────────────────────────────────────────────────────────────────
// COLLECTION PATHS
// ─────────────────────────────────────────────────────────────────

const PROJECTS_PATH = 'projects';
const BOQ_ITEMS_SUBCOLLECTION = 'boq_items';
const PAYMENTS_SUBCOLLECTION = 'payments';

function getBoqItemsPath(projectId: string): string {
  return `${PROJECTS_PATH}/${projectId}/${BOQ_ITEMS_SUBCOLLECTION}`;
}

function getPaymentsPath(projectId: string): string {
  return `${PROJECTS_PATH}/${projectId}/${PAYMENTS_SUBCOLLECTION}`;
}

// ─────────────────────────────────────────────────────────────────
// VALIDATION TYPES
// ─────────────────────────────────────────────────────────────────

export interface RequisitionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  boqItem?: ControlBOQItem;
}

export interface BudgetValidationResult {
  sufficient: boolean;
  message?: string;
  remainingBudget?: number;
  requestedAmount?: number;
}

export interface VarianceAlert {
  boqItemId: string;
  boqItemCode: string;
  description: string;
  varianceStatus: VarianceBudgetStatus;
  varianceAmount: number;
  variancePercentage: number;
  severity: 'low' | 'medium' | 'high';
}

// ─────────────────────────────────────────────────────────────────
// BOQ CONTROL SERVICE
// ─────────────────────────────────────────────────────────────────

export class BOQControlService {
  constructor(private db: Firestore) {}

  // ───────────────────────────────────────────────────────────────
  // VALIDATION
  // ───────────────────────────────────────────────────────────────

  /**
   * Validate a requisition against BOQ item availability
   */
  async validateRequisition(
    projectId: string,
    boqItemId: string,
    requestedQuantity: number,
    requestedAmount: number
  ): Promise<RequisitionValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Fetch BOQ item
    const boqItem = await this.getBOQItem(projectId, boqItemId);
    if (!boqItem) {
      errors.push(`BOQ item ${boqItemId} not found`);
      return { valid: false, errors, warnings };
    }

    // Check quantity availability
    const availableQuantity = getAvailableQuantity(boqItem);
    if (requestedQuantity > availableQuantity) {
      errors.push(
        `Requested quantity (${requestedQuantity}) exceeds available quantity (${availableQuantity})`
      );
    }

    // Check budget availability
    if (boqItem.budgetControl) {
      const budgetCheck = hasSufficientBudget(boqItem, requestedAmount);
      if (!budgetCheck.sufficient) {
        errors.push(budgetCheck.message || 'Insufficient budget');
      } else if (budgetCheck.message) {
        warnings.push(budgetCheck.message);
      }
    }

    // Check if BOQ item is already fully requisitioned
    if (boqItem.status === 'completed') {
      errors.push('BOQ item is already completed');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      boqItem,
    };
  }

  /**
   * Validate multiple requisition items in batch
   */
  async validateBatchRequisition(
    projectId: string,
    items: Array<{ boqItemId: string; quantity: number; amount: number }>
  ): Promise<{
    valid: boolean;
    itemResults: Map<string, RequisitionValidationResult>;
    overallErrors: string[];
  }> {
    const itemResults = new Map<string, RequisitionValidationResult>();
    const overallErrors: string[] = [];

    for (const item of items) {
      const result = await this.validateRequisition(
        projectId,
        item.boqItemId,
        item.quantity,
        item.amount
      );
      itemResults.set(item.boqItemId, result);

      if (!result.valid) {
        overallErrors.push(
          `BOQ item ${item.boqItemId}: ${result.errors.join(', ')}`
        );
      }
    }

    return {
      valid: overallErrors.length === 0,
      itemResults,
      overallErrors,
    };
  }

  // ───────────────────────────────────────────────────────────────
  // BUDGET CONTROL
  // ───────────────────────────────────────────────────────────────

  /**
   * Initialize or update budget control for a BOQ item
   */
  async updateBudgetControl(
    projectId: string,
    boqItemId: string
  ): Promise<BOQBudgetControl> {
    const boqItem = await this.getBOQItem(projectId, boqItemId);
    if (!boqItem) {
      throw new Error(`BOQ item ${boqItemId} not found`);
    }

    // Fetch related requisitions and accountabilities
    const requisitions = await this.getBoqItemRequisitions(projectId, boqItemId);
    const accountabilities = await this.getBoqItemAccountabilities(
      projectId,
      boqItemId
    );

    // Calculate budget control
    const budgetControl = calculateBudgetControl(
      boqItem,
      requisitions.map(r => ({ amount: r.amount, status: r.status })),
      accountabilities.map(a => ({ amount: a.amount }))
    );

    // Update BOQ item with new budget control
    const docRef = doc(this.db, getBoqItemsPath(projectId), boqItemId);
    await updateDoc(docRef, {
      budgetControl,
      updatedAt: Timestamp.now(),
    });

    return budgetControl;
  }

  /**
   * Batch update budget control for all BOQ items in a project
   */
  async updateAllBudgetControls(projectId: string): Promise<number> {
    const items = await this.getProjectBOQItems(projectId);
    let updatedCount = 0;

    for (const item of items) {
      try {
        await this.updateBudgetControl(projectId, item.id);
        updatedCount++;
      } catch (error) {
        console.error(`Failed to update budget control for ${item.id}:`, error);
      }
    }

    return updatedCount;
  }

  // ───────────────────────────────────────────────────────────────
  // QUANTITY MANAGEMENT
  // ───────────────────────────────────────────────────────────────

  /**
   * Reserve quantity when requisition is approved
   */
  async reserveQuantity(
    projectId: string,
    boqItemId: string,
    quantity: number,
    amount: number,
    requisitionId: string
  ): Promise<void> {
    const boqItem = await this.getBOQItem(projectId, boqItemId);
    if (!boqItem) {
      throw new Error(`BOQ item ${boqItemId} not found`);
    }

    // Calculate updates
    const updates = updateBOQAfterRequisitionApproval(
      boqItem,
      quantity,
      amount,
      requisitionId
    );

    // Apply updates
    const docRef = doc(this.db, getBoqItemsPath(projectId), boqItemId);
    await updateDoc(docRef, updates);
  }

  /**
   * Update executed quantity when accountability is approved
   */
  async executeQuantity(
    projectId: string,
    boqItemId: string,
    quantity: number,
    amount: number
  ): Promise<void> {
    const boqItem = await this.getBOQItem(projectId, boqItemId);
    if (!boqItem) {
      throw new Error(`BOQ item ${boqItemId} not found`);
    }

    // Calculate updates
    const updates = updateBOQAfterAccountability(boqItem, quantity, amount);

    // Apply updates
    const docRef = doc(this.db, getBoqItemsPath(projectId), boqItemId);
    await updateDoc(docRef, updates);
  }

  /**
   * Release reserved quantity when requisition is cancelled/rejected
   */
  async releaseQuantity(
    projectId: string,
    boqItemId: string,
    quantity: number,
    amount: number,
    requisitionId: string
  ): Promise<void> {
    const boqItem = await this.getBOQItem(projectId, boqItemId);
    if (!boqItem) {
      throw new Error(`BOQ item ${boqItemId} not found`);
    }

    // Calculate reverse updates
    const newQuantityRequisitioned = Math.max(
      0,
      boqItem.quantityRequisitioned - quantity
    );
    const newQuantityRemaining = boqItem.quantityContract - boqItem.quantityExecuted;

    // Remove requisition from linked list
    const linkedRequisitionIds = boqItem.linkedRequisitionIds.filter(
      id => id !== requisitionId
    );

    // Update status
    let newStatus = boqItem.status;
    if (newQuantityRequisitioned === 0 && boqItem.quantityExecuted === 0) {
      newStatus = 'pending';
    } else if (
      newQuantityRequisitioned < boqItem.quantityContract &&
      boqItem.quantityExecuted === 0
    ) {
      newStatus = 'partial';
    }

    // Update budget control if exists
    let updatedBudgetControl: BOQBudgetControl | undefined;
    if (boqItem.budgetControl) {
      const newCommittedAmount = Math.max(
        0,
        boqItem.budgetControl.committedAmount - amount
      );
      const newRemainingBudget =
        boqItem.budgetControl.allocatedAmount - newCommittedAmount;
      const newVarianceAmount =
        boqItem.budgetControl.spentAmount - newCommittedAmount;
      const newVariancePercentage =
        newCommittedAmount > 0 ? (newVarianceAmount / newCommittedAmount) * 100 : 0;

      const commitmentPercentage =
        boqItem.budgetControl.allocatedAmount > 0
          ? (newCommittedAmount / boqItem.budgetControl.allocatedAmount) * 100
          : 0;

      let newVarianceStatus: VarianceBudgetStatus;
      if (newCommittedAmount > boqItem.budgetControl.allocatedAmount) {
        newVarianceStatus = 'exceeded';
      } else if (commitmentPercentage >= 90) {
        newVarianceStatus = 'alert';
      } else {
        newVarianceStatus = 'on_budget';
      }

      updatedBudgetControl = {
        ...boqItem.budgetControl,
        committedAmount: newCommittedAmount,
        remainingBudget: newRemainingBudget,
        varianceAmount: newVarianceAmount,
        variancePercentage: newVariancePercentage,
        varianceStatus: newVarianceStatus,
        lastUpdated: Timestamp.now(),
      };
    }

    // Apply updates
    const docRef = doc(this.db, getBoqItemsPath(projectId), boqItemId);
    await updateDoc(docRef, {
      quantityRequisitioned: newQuantityRequisitioned,
      quantityRemaining: newQuantityRemaining,
      status: newStatus,
      linkedRequisitionIds,
      budgetControl: updatedBudgetControl,
      updatedAt: Timestamp.now(),
    });
  }

  // ───────────────────────────────────────────────────────────────
  // VARIANCE DETECTION
  // ───────────────────────────────────────────────────────────────

  /**
   * Detect variance alerts across all BOQ items in a project
   */
  async detectVarianceAlerts(projectId: string): Promise<VarianceAlert[]> {
    const items = await this.getProjectBOQItems(projectId);
    const alerts: VarianceAlert[] = [];

    for (const item of items) {
      if (!item.budgetControl) continue;

      const { varianceStatus, varianceAmount, variancePercentage } =
        item.budgetControl;

      // Only alert on non-compliant items
      if (varianceStatus !== 'on_budget') {
        const severity =
          varianceStatus === 'exceeded'
            ? 'high'
            : varianceStatus === 'alert'
            ? 'medium'
            : 'low';

        alerts.push({
          boqItemId: item.id,
          boqItemCode: item.itemCode,
          description: item.description,
          varianceStatus,
          varianceAmount,
          variancePercentage,
          severity,
        });
      }
    }

    // Sort by severity
    return alerts.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Get BOQ items with budget alerts (>90% committed)
   */
  async getBudgetAlerts(projectId: string): Promise<ControlBOQItem[]> {
    const items = await this.getProjectBOQItems(projectId);
    return items.filter(
      item =>
        item.budgetControl &&
        (item.budgetControl.varianceStatus === 'alert' ||
          item.budgetControl.varianceStatus === 'exceeded')
    );
  }

  /**
   * Get BOQ items that are over budget
   */
  async getOverBudgetItems(projectId: string): Promise<ControlBOQItem[]> {
    const items = await this.getProjectBOQItems(projectId);
    return items.filter(
      item =>
        item.budgetControl && item.budgetControl.varianceStatus === 'exceeded'
    );
  }

  // ───────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ───────────────────────────────────────────────────────────────

  private async getBOQItem(
    projectId: string,
    itemId: string
  ): Promise<ControlBOQItem | null> {
    const docRef = doc(this.db, getBoqItemsPath(projectId), itemId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    return { id: docSnap.id, ...docSnap.data() } as ControlBOQItem;
  }

  private async getProjectBOQItems(projectId: string): Promise<ControlBOQItem[]> {
    const collRef = collection(this.db, getBoqItemsPath(projectId));
    const snapshot = await getDocs(collRef);

    return snapshot.docs.map(
      doc => ({ id: doc.id, ...doc.data() } as ControlBOQItem)
    );
  }

  private async getBoqItemRequisitions(
    projectId: string,
    boqItemId: string
  ): Promise<Array<{ amount: number; status: string }>> {
    const paymentsRef = collection(this.db, getPaymentsPath(projectId));
    const q = query(
      paymentsRef,
      where('paymentType', '==', 'requisition'),
      where('boqItems', 'array-contains', { boqItemId })
    );

    try {
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          amount: data.grossAmount || 0,
          status: data.status || 'pending',
        };
      });
    } catch (error) {
      // Fallback if query fails (e.g., missing index)
      console.warn('BOQ requisition query failed, using fallback:', error);
      const allPayments = await getDocs(collection(this.db, getPaymentsPath(projectId)));
      return allPayments.docs
        .filter(doc => {
          const data = doc.data();
          if (data.paymentType !== 'requisition') return false;
          const boqItems = data.boqItems || [];
          return boqItems.some((item: any) => item.boqItemId === boqItemId);
        })
        .map(doc => {
          const data = doc.data();
          return {
            amount: data.grossAmount || 0,
            status: data.status || 'pending',
          };
        });
    }
  }

  private async getBoqItemAccountabilities(
    projectId: string,
    boqItemId: string
  ): Promise<Array<{ amount: number }>> {
    const paymentsRef = collection(this.db, getPaymentsPath(projectId));
    const q = query(
      paymentsRef,
      where('paymentType', '==', 'accountability'),
      where('expenses.boqItemId', '==', boqItemId)
    );

    try {
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          amount: data.totalExpenses || 0,
        };
      });
    } catch (error) {
      // Fallback if query fails
      console.warn('BOQ accountability query failed, using fallback:', error);
      const allPayments = await getDocs(collection(this.db, getPaymentsPath(projectId)));
      return allPayments.docs
        .filter(doc => {
          const data = doc.data();
          if (data.paymentType !== 'accountability') return false;
          const expenses = data.expenses || [];
          return expenses.some((exp: any) => exp.boqItemId === boqItemId);
        })
        .map(doc => {
          const data = doc.data();
          return {
            amount: data.totalExpenses || 0,
          };
        });
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// FACTORY FUNCTION
// ─────────────────────────────────────────────────────────────────

export function createBOQControlService(db: Firestore): BOQControlService {
  return new BOQControlService(db);
}
