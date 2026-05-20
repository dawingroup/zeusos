/**
 * ENHANCED ACCOUNTABILITY SERVICE
 *
 * ADD-FIN-001 compliant accountability service with:
 * - Zero-discrepancy validation
 * - Proof of spend validation by category
 * - Variance calculation and investigation triggers
 * - BOQ executed quantity updates
 * - Reconciliation workflow
 */

import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  Timestamp,
  Firestore,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import {
  Accountability,
  AccountabilityFormData,
  AccountabilityExpense,
  calculateAccountabilityVariance,
  validateProofOfSpend,
  areAllProofOfSpendComplete,
  calculateInvestigationDeadline,
  calculateReconciliationDeadline,
  VarianceInvestigation,
  ReconciliationRecord,
  ProofOfSpendDocument,
  PROOF_OF_SPEND_REQUIREMENTS,
} from '../../types/accountability';
import { RequisitionService } from '../../services/requisition-service';
import { BOQControlService } from './boq-control.service';
import type { RequisitionBOQItem } from '../../types/requisition';
import { procurementService } from '../../../matflow/services/procurement-service';
import { setDoc } from 'firebase/firestore';
import type { ThreeWayMatch } from '../../../matflow/types/procurement';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface AccountabilityValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  proofOfSpendValidations?: {
    expenseId: string;
    category: string;
    isComplete: boolean;
    missingDocuments: string[];
  }[];
  varianceDetails?: {
    varianceAmount: number;
    variancePercentage: number;
    varianceStatus: string;
    requiresInvestigation: boolean;
  };
}

export interface InvestigationTriggerResult {
  triggered: boolean;
  investigationId?: string;
  deadline?: Date;
  reason?: string;
}

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

const PAYMENTS_PATH = 'payments';
const VARIANCE_INVESTIGATIONS_PATH = 'variance_investigations';
const RECONCILIATION_RECORDS_PATH = 'reconciliation_records';

// ─────────────────────────────────────────────────────────────────
// ENHANCED ACCOUNTABILITY SERVICE
// ─────────────────────────────────────────────────────────────────

export class EnhancedAccountabilityService {
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
   * Validate accountability against ADD-FIN-001 policies
   */
  async validateAccountability(
    data: AccountabilityFormData,
    _userId: string
  ): Promise<AccountabilityValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const proofOfSpendValidations: AccountabilityValidationResult['proofOfSpendValidations'] = [];

    // 1. Get requisition
    const requisition = await this.baseService.getRequisition(data.requisitionId);
    if (!requisition) {
      errors.push('Requisition not found');
      return { valid: false, errors, warnings };
    }

    if (requisition.status !== 'paid') {
      errors.push('Accountability can only be created for paid requisitions');
    }

    // 2. Validate proof of spend for each expense
    for (const expense of data.expenses) {
      const providedDocuments = expense.proofOfSpend?.providedDocuments || [];
      const validation = validateProofOfSpend(expense.category, providedDocuments);

      proofOfSpendValidations.push({
        expenseId: (expense as AccountabilityExpense).id || `expense-${data.expenses.indexOf(expense)}`,
        category: expense.category,
        isComplete: validation.isComplete,
        missingDocuments: validation.missingDocuments,
      });

      if (!validation.isComplete) {
        const requirements = PROOF_OF_SPEND_REQUIREMENTS[expense.category];
        warnings.push(
          `Expense "${expense.description}" (${expense.category}) is missing proof: ${validation.missingDocuments.join(', ')}. Required: ${requirements.description}`
        );
      }

      // Check document quality
      const lowQualityDocs = providedDocuments.filter(
        (d: { dpi?: number }) => d.dpi && d.dpi < PROOF_OF_SPEND_REQUIREMENTS[expense.category].minimumDocumentQuality
      );
      if (lowQualityDocs.length > 0) {
        warnings.push(
          `Expense "${expense.description}" has ${lowQualityDocs.length} document(s) below 300 DPI quality standard`
        );
      }
    }

    // 2.5. NEW: PO validation for each expense
    for (const expense of data.expenses) {
      const requirements = PROOF_OF_SPEND_REQUIREMENTS[expense.category];

      // Check if PO is required
      const poRequired = requirements.requiresPurchaseOrder &&
        (!requirements.poMandatoryThreshold || expense.amount >= requirements.poMandatoryThreshold);

      if (poRequired && !expense.purchaseOrderId) {
        errors.push(
          `Expense "${expense.description}" (${expense.amount.toLocaleString()} UGX) requires purchase order reference`
        );
      }

      // Validate against PO if provided
      if (expense.purchaseOrderId && expense.poItemId) {
        const poValidation = await this.validateExpenseAgainstPO(
          expense as any,
          expense.purchaseOrderId,
          expense.poItemId
        );

        if (!poValidation.valid) {
          errors.push(...poValidation.errors);
        }
        warnings.push(...poValidation.warnings);

        // Mark for investigation if severe variance
        if (poValidation.requiresInvestigation) {
          warnings.push(
            `Expense "${expense.description}" has ${poValidation.variancePercentage.toFixed(2)}% variance from PO - investigation required`
          );
        }
      }
    }

    // 3. Calculate variance
    const totalExpenses = data.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const variance = calculateAccountabilityVariance(
      totalExpenses,
      data.unspentReturned,
      requisition.grossAmount
    );

    // 4. Check for zero discrepancy
    if (!variance.isZeroDiscrepancy) {
      warnings.push(
        `Variance detected: ${variance.varianceAmount.toFixed(2)} ${requisition.currency} (${variance.variancePercentage.toFixed(2)}%). ADD-FIN-001 requires zero discrepancy.`
      );
    }

    // 5. Check if investigation required
    if (variance.requiresInvestigation) {
      warnings.push(
        `Variance of ${variance.variancePercentage.toFixed(2)}% requires investigation within 48 hours.`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      proofOfSpendValidations:
        proofOfSpendValidations.length > 0 ? proofOfSpendValidations : undefined,
      varianceDetails: {
        varianceAmount: variance.varianceAmount,
        variancePercentage: variance.variancePercentage,
        varianceStatus: variance.varianceStatus,
        requiresInvestigation: variance.requiresInvestigation,
      },
    };
  }

  /**
   * Validate document quality (DPI check)
   */
  validateDocumentQuality(
    document: ProofOfSpendDocument,
    category: string
  ): { valid: boolean; message?: string } {
    const requirements = PROOF_OF_SPEND_REQUIREMENTS[category as keyof typeof PROOF_OF_SPEND_REQUIREMENTS];
    if (!requirements) {
      return { valid: false, message: 'Unknown expense category' };
    }

    if (!document.dpi) {
      return {
        valid: false,
        message: 'Document DPI information not available. Manual review required.',
      };
    }

    if (document.dpi < requirements.minimumDocumentQuality) {
      return {
        valid: false,
        message: `Document quality (${document.dpi} DPI) below required ${requirements.minimumDocumentQuality} DPI`,
      };
    }

    return { valid: true };
  }

  // ─────────────────────────────────────────────────────────────────
  // PO VALIDATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Validate expense against purchase order
   */
  async validateExpenseAgainstPO(
    expense: AccountabilityExpense,
    purchaseOrderId: string,
    poItemId: string
  ): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    requiresInvestigation: boolean;
    variancePercentage: number;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Get PO
    const po = await procurementService.getPurchaseOrder(purchaseOrderId);
    if (!po) {
      return {
        valid: false,
        errors: ['Purchase order not found'],
        warnings: [],
        requiresInvestigation: false,
        variancePercentage: 0
      };
    }

    // Find PO item
    const poItem = po.items.find(item => item.materialId === poItemId);
    if (!poItem) {
      return {
        valid: false,
        errors: ['PO item not found'],
        warnings: [],
        requiresInvestigation: false,
        variancePercentage: 0
      };
    }

    // Calculate variance
    const amountVariance = Math.abs(expense.amount - poItem.amount);
    const variancePercentage = (amountVariance / poItem.amount) * 100;

    // Check variance thresholds (2% moderate, 5% severe - same as accountability variance)
    if (variancePercentage >= 2) {
      warnings.push(
        `Amount variance of ${variancePercentage.toFixed(2)}% detected between expense and PO`
      );
    }

    const requiresInvestigation = variancePercentage >= 5;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      requiresInvestigation,
      variancePercentage
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // ENHANCED CREATE ACCOUNTABILITY
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create accountability with ADD-FIN-001 enhancements
   */
  async createAccountability(
    data: AccountabilityFormData,
    userId: string
  ): Promise<string> {
    // 1. Validate against ADD-FIN-001 policies
    const validation = await this.validateAccountability(data, userId);
    if (!validation.valid) {
      throw new Error(
        `Accountability validation failed:\n${validation.errors.join('\n')}`
      );
    }

    // 2. Get requisition
    const requisition = await this.baseService.getRequisition(data.requisitionId);
    if (!requisition) {
      throw new Error('Requisition not found');
    }

    // 3. Calculate variance
    const totalExpenses = data.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const variance = calculateAccountabilityVariance(
      totalExpenses,
      data.unspentReturned,
      requisition.grossAmount
    );

    // 4. Create base accountability
    const accountabilityId = await this.baseService.createAccountability(data, userId);

    // 5. Update with ADD-FIN-001 fields
    const reconciliationDeadline = calculateReconciliationDeadline(
      requisition.updatedAt?.toDate() || new Date()
    );

    await updateDoc(doc(this.db, PAYMENTS_PATH, accountabilityId), {
      variance,
      isZeroDiscrepancy: variance.isZeroDiscrepancy,
      reconciliationStatus: 'pending',
      reconciliationDeadline,
      requiresInvestigation: variance.requiresInvestigation,
      notionSyncStatus: 'pending',
      updatedAt: Timestamp.now(),
    });

    // 6. Trigger investigation if variance exceeds threshold
    if (variance.requiresInvestigation) {
      await this.triggerVarianceInvestigation(
        accountabilityId,
        variance.varianceAmount,
        variance.variancePercentage,
        userId
      );
    }

    // 7. Update BOQ executed quantities (if expenses linked to BOQ)
    await this.updateBOQExecutedQuantities(accountabilityId, data, requisition.projectId);

    return accountabilityId;
  }

  // ─────────────────────────────────────────────────────────────────
  // VARIANCE INVESTIGATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Trigger variance investigation (ADD-FIN-001)
   */
  async triggerVarianceInvestigation(
    accountabilityId: string,
    varianceAmount: number,
    variancePercentage: number,
    assignedTo: string
  ): Promise<string> {
    const investigation: Omit<VarianceInvestigation, 'id'> = {
      accountabilityId,
      varianceAmount,
      variancePercentage,
      assignedTo,
      assignedAt: Timestamp.now(),
      deadline: calculateInvestigationDeadline(),
      status: 'pending',
    };

    const docRef = await addDoc(
      collection(this.db, VARIANCE_INVESTIGATIONS_PATH),
      investigation
    );

    // Update accountability with investigation ID
    await updateDoc(doc(this.db, PAYMENTS_PATH, accountabilityId), {
      investigationId: docRef.id,
      updatedAt: Timestamp.now(),
    });

    return docRef.id;
  }

  /**
   * Complete variance investigation
   */
  async completeInvestigation(
    investigationId: string,
    findings: {
      rootCause: string;
      correctiveActions: string;
      personalLiabilityAmount?: number;
      personalLiabilityAssignedTo?: string;
    },
    _userId: string
  ): Promise<void> {
    await updateDoc(doc(this.db, VARIANCE_INVESTIGATIONS_PATH, investigationId), {
      status: 'completed',
      completedAt: Timestamp.now(),
      findings: findings.rootCause,
      rootCause: findings.rootCause,
      correctiveActions: findings.correctiveActions,
      personalLiabilityAmount: findings.personalLiabilityAmount,
      personalLiabilityAssignedTo: findings.personalLiabilityAssignedTo,
    });

    // Update accountability variance investigation status
    const investigationDoc = await getDoc(
      doc(this.db, VARIANCE_INVESTIGATIONS_PATH, investigationId)
    );
    if (investigationDoc.exists()) {
      const investigation = investigationDoc.data() as VarianceInvestigation;
      await updateDoc(doc(this.db, PAYMENTS_PATH, investigation.accountabilityId), {
        'variance.investigationStatus': 'completed',
        'variance.investigationNotes': findings.rootCause,
        updatedAt: Timestamp.now(),
      });
    }
  }

  /**
   * Escalate overdue investigation
   */
  async escalateInvestigation(
    investigationId: string,
    escalatedTo: string,
    escalationReason: string
  ): Promise<void> {
    await updateDoc(doc(this.db, VARIANCE_INVESTIGATIONS_PATH, investigationId), {
      status: 'escalated',
      escalatedAt: Timestamp.now(),
      escalatedTo,
      escalationReason,
    });
  }

  /**
   * Get overdue investigations
   */
  async getOverdueInvestigations(): Promise<VarianceInvestigation[]> {
    const now = new Date();
    const q = query(
      collection(this.db, VARIANCE_INVESTIGATIONS_PATH),
      where('status', 'in', ['pending', 'in_progress']),
      orderBy('deadline', 'asc')
    );

    const snapshot = await getDocs(q);
    const investigations = snapshot.docs.map(
      doc => ({ id: doc.id, ...doc.data() } as VarianceInvestigation)
    );

    return investigations.filter(inv => new Date(inv.deadline) < now);
  }

  // ─────────────────────────────────────────────────────────────────
  // RECONCILIATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create reconciliation record
   */
  async createReconciliation(
    accountabilityId: string,
    userId: string,
    notes?: string
  ): Promise<string> {
    const accountability = await this.baseService.getAccountability(accountabilityId);
    if (!accountability) {
      throw new Error('Accountability not found');
    }

    // Check proof of spend completeness
    const allProofComplete = areAllProofOfSpendComplete(accountability.expenses);

    const reconciliation: Omit<ReconciliationRecord, 'id'> = {
      accountabilityId,
      reconciledBy: userId,
      reconciledAt: Timestamp.now(),
      status: 'completed',
      requisitionAmount: accountability.requisitionAmount,
      totalExpenses: accountability.totalExpenses,
      unspentReturned: accountability.unspentReturned,
      variance: accountability.variance.varianceAmount,
      allReceiptsVerified: accountability.expenses.every(e => e.status === 'verified'),
      proofOfSpendComplete: allProofComplete,
      zeroDiscrepancyAchieved: accountability.isZeroDiscrepancy,
      notes,
    };

    const docRef = await addDoc(
      collection(this.db, RECONCILIATION_RECORDS_PATH),
      reconciliation
    );

    // Update accountability
    await updateDoc(doc(this.db, PAYMENTS_PATH, accountabilityId), {
      reconciliationStatus: 'completed',
      reconciliationRecord: { id: docRef.id, ...reconciliation },
      updatedAt: Timestamp.now(),
    });

    return docRef.id;
  }

  /**
   * Get pending reconciliations (approaching deadline)
   */
  async getPendingReconciliations(projectId: string): Promise<Accountability[]> {
    const q = query(
      collection(this.db, PAYMENTS_PATH),
      where('projectId', '==', projectId),
      where('paymentType', '==', 'accountability'),
      where('reconciliationStatus', 'in', ['pending', 'in_progress']),
      orderBy('reconciliationDeadline', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Accountability));
  }

  // ─────────────────────────────────────────────────────────────────
  // BOQ UPDATES
  // ─────────────────────────────────────────────────────────────────

  /**
   * Update BOQ executed quantities when accountability is approved
   */
  private async updateBOQExecutedQuantities(
    _accountabilityId: string,
    data: AccountabilityFormData,
    projectId: string
  ): Promise<void> {
    // Get requisition to find BOQ-linked items
    const requisition = await this.baseService.getRequisition(data.requisitionId);
    if (!requisition) return;

    // Filter BOQ items
    const boqItems = requisition.items.filter(
      item => (item as unknown as RequisitionBOQItem).sourceType === 'boq'
    );

    for (const item of boqItems) {
      const boqItem = item as unknown as RequisitionBOQItem;
      if (!boqItem.boqItemId) continue;

      // Find corresponding expense in accountability
      const relatedExpense = data.expenses.find(
        exp => exp.boqItemId === boqItem.boqItemId
      );

      if (relatedExpense && relatedExpense.quantityExecuted) {
        await this.boqService.executeQuantity(
          projectId,
          boqItem.boqItemId,
          relatedExpense.quantityExecuted,
          relatedExpense.amount
        );
      }
    }
  }

  /**
   * Update accountability when BOQ execution is verified
   */
  async onAccountabilityApproved(
    accountabilityId: string,
    _userId: string
  ): Promise<void> {
    const accountability = await this.baseService.getAccountability(accountabilityId);
    if (!accountability) {
      throw new Error('Accountability not found');
    }

    const requisition = await this.baseService.getRequisition(
      accountability.requisitionId
    );
    if (!requisition) {
      throw new Error('Requisition not found');
    }

    // Update BOQ executed quantities
    await this.updateBOQExecutedQuantities(
      accountabilityId,
      {
        requisitionId: accountability.requisitionId,
        expenses: accountability.expenses,
        unspentReturned: accountability.unspentReturned,
      },
      requisition.projectId
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // THREE-WAY MATCHING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create three-way match record (PO → Delivery → Accountability)
   */
  async createThreeWayMatch(
    purchaseOrderId: string,
    poItemId: string,
    deliveryEntryId: string,
    accountabilityExpenseId: string,
    userId: string
  ): Promise<string> {
    // Get all three components
    const po = await procurementService.getPurchaseOrder(purchaseOrderId);
    const delivery = await procurementService.getProcurementEntry(deliveryEntryId);
    const accountability = await this.baseService.getAccountability(accountabilityExpenseId);

    if (!po || !delivery || !accountability) {
      throw new Error('Missing required records for three-way match');
    }

    const poItem = po.items.find(i => i.materialId === poItemId);
    const expense = accountability.expenses.find(e => e.id === accountabilityExpenseId);

    // Calculate variances
    const quantityVariance = (expense?.quantityExecuted || 0) - (poItem?.quantity || 0);
    const amountVariance = (expense?.amount || 0) - (poItem?.amount || 0);
    const variancePercentage = Math.abs(amountVariance / (poItem?.amount || 1)) * 100;

    // Determine match status
    let matchStatus: 'pending' | 'matched' | 'variance_detected' | 'disputed' = 'matched';
    if (variancePercentage >= 2) {
      matchStatus = 'variance_detected';
    }

    // Create match record
    const matchId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const match: ThreeWayMatch = {
      id: matchId,
      purchaseOrderId,
      poItemId,
      deliveryEntryId,
      accountabilityExpenseId,
      poQuantity: poItem?.quantity || 0,
      deliveredQuantity: delivery.quantityAccepted,
      accountedQuantity: expense?.quantityExecuted,
      poAmount: poItem?.amount || 0,
      deliveryAmount: delivery.totalAmount,
      accountedAmount: expense?.amount || 0,
      quantityVariance,
      amountVariance,
      variancePercentage,
      matchStatus,
      requiresInvestigation: variancePercentage >= 5,
      createdAt: Timestamp.now(),
      createdBy: userId
    };

    await setDoc(
      doc(this.db, 'advisoryPlatform/matflow/threeWayMatches', matchId),
      match
    );

    // Trigger investigation if needed
    if (match.requiresInvestigation) {
      await this.triggerVarianceInvestigation(
        accountabilityExpenseId,
        amountVariance,
        variancePercentage,
        userId
      );
    }

    return matchId;
  }

  // ─────────────────────────────────────────────────────────────────
  // PROOF OF SPEND MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Add proof of spend document to expense
   */
  async addProofOfSpendDocument(
    accountabilityId: string,
    expenseId: string,
    document: ProofOfSpendDocument,
    userId: string
  ): Promise<void> {
    const accountability = await this.baseService.getAccountability(accountabilityId);
    if (!accountability) {
      throw new Error('Accountability not found');
    }

    const expenseIndex = accountability.expenses.findIndex(e => e.id === expenseId);
    if (expenseIndex === -1) {
      throw new Error('Expense not found');
    }

    const expense = accountability.expenses[expenseIndex];
    const existingDocs = expense.proofOfSpend?.providedDocuments || [];
    const updatedDocs = [...existingDocs, document];

    // Validate proof of spend completeness
    const validation = validateProofOfSpend(expense.category, updatedDocs);

    // Update expense
    const updatedExpenses = [...accountability.expenses];
    updatedExpenses[expenseIndex] = {
      ...expense,
      proofOfSpend: {
        expenseId,
        category: expense.category,
        requiredDocuments: PROOF_OF_SPEND_REQUIREMENTS[expense.category].requiredDocuments,
        providedDocuments: updatedDocs,
        isComplete: validation.isComplete,
        completionNotes: validation.completionNotes,
      },
    };

    await updateDoc(doc(this.db, PAYMENTS_PATH, accountabilityId), {
      expenses: updatedExpenses,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  /**
   * Validate all proof of spend for accountability
   */
  async validateAllProofOfSpend(accountabilityId: string): Promise<{
    allComplete: boolean;
    incompleteExpenses: { expenseId: string; missingDocuments: string[] }[];
  }> {
    const accountability = await this.baseService.getAccountability(accountabilityId);
    if (!accountability) {
      throw new Error('Accountability not found');
    }

    const incompleteExpenses: { expenseId: string; missingDocuments: string[] }[] = [];

    for (const expense of accountability.expenses) {
      const providedDocs = expense.proofOfSpend?.providedDocuments || [];
      const validation = validateProofOfSpend(expense.category, providedDocs);

      if (!validation.isComplete) {
        incompleteExpenses.push({
          expenseId: expense.id!,
          missingDocuments: validation.missingDocuments,
        });
      }
    }

    return {
      allComplete: incompleteExpenses.length === 0,
      incompleteExpenses,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // REPORTING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get variance summary for project
   */
  async getVarianceSummary(projectId: string): Promise<{
    totalAccountabilities: number;
    zeroDiscrepancyCount: number;
    minorVarianceCount: number;
    moderateVarianceCount: number;
    severeVarianceCount: number;
    totalVarianceAmount: number;
    activeInvestigations: number;
    overdueInvestigations: number;
  }> {
    const q = query(
      collection(this.db, PAYMENTS_PATH),
      where('projectId', '==', projectId),
      where('paymentType', '==', 'accountability')
    );

    const snapshot = await getDocs(q);
    const accountabilities = snapshot.docs.map(
      doc => doc.data() as Accountability
    );

    const summary = accountabilities.reduce(
      (acc, accountability) => {
        const variance = accountability.variance;
        return {
          totalAccountabilities: acc.totalAccountabilities + 1,
          zeroDiscrepancyCount:
            acc.zeroDiscrepancyCount + (variance.isZeroDiscrepancy ? 1 : 0),
          minorVarianceCount:
            acc.minorVarianceCount + (variance.varianceStatus === 'minor' ? 1 : 0),
          moderateVarianceCount:
            acc.moderateVarianceCount +
            (variance.varianceStatus === 'moderate' ? 1 : 0),
          severeVarianceCount:
            acc.severeVarianceCount + (variance.varianceStatus === 'severe' ? 1 : 0),
          totalVarianceAmount:
            acc.totalVarianceAmount + Math.abs(variance.varianceAmount),
          activeInvestigations:
            acc.activeInvestigations + (accountability.requiresInvestigation ? 1 : 0),
          overdueInvestigations: acc.overdueInvestigations, // Calculated separately
        };
      },
      {
        totalAccountabilities: 0,
        zeroDiscrepancyCount: 0,
        minorVarianceCount: 0,
        moderateVarianceCount: 0,
        severeVarianceCount: 0,
        totalVarianceAmount: 0,
        activeInvestigations: 0,
        overdueInvestigations: 0,
      }
    );

    // Get overdue investigations
    const overdueInvestigations = await this.getOverdueInvestigations();
    summary.overdueInvestigations = overdueInvestigations.length;

    return summary;
  }
}

// Export factory
export function getEnhancedAccountabilityService(
  db: Firestore
): EnhancedAccountabilityService {
  return new EnhancedAccountabilityService(db);
}
