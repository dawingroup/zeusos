/**
 * REQUISITION SERVICE
 * 
 * Requisition and accountability operations for direct implementation projects.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  Firestore,
  arrayUnion,
} from 'firebase/firestore';
import {
  Requisition,
  RequisitionFormData,
  RequisitionItem,
  AccountabilityStatus,
  calculateRequisitionTotal,
} from '../types/requisition';
import {
  Accountability,
  AccountabilityFormData,
  AccountabilityExpense,
  calculateReceiptsSummary,
  calculateTotalExpenses,
  calculateBalanceDue,
} from '../types/accountability';

// ─────────────────────────────────────────────────────────────────
// COLLECTION PATHS
// ─────────────────────────────────────────────────────────────────

const PAYMENTS_PATH = 'payments';
const ORG_ID = 'default'; // Fallback org — callers should pass orgId from auth context

function accountabilityCreatedAtMs(a: Accountability): number {
  const c = a.createdAt as Timestamp | undefined;
  if (!c || typeof (c as Timestamp).toMillis !== 'function') return 0;
  return (c as Timestamp).toMillis();
}

// ─────────────────────────────────────────────────────────────────
// REQUISITION SERVICE
// ─────────────────────────────────────────────────────────────────

export class RequisitionService {
  private static instance: RequisitionService;
  private db: Firestore;

  private constructor(db: Firestore) {
    this.db = db;
  }

  static getInstance(db: Firestore): RequisitionService {
    if (!RequisitionService.instance) {
      RequisitionService.instance = new RequisitionService(db);
    }
    return RequisitionService.instance;
  }

  // ─────────────────────────────────────────────────────────────────
  // CREATE REQUISITION
  // ─────────────────────────────────────────────────────────────────

  async createRequisition(
    data: RequisitionFormData,
    userId: string,
    orgId?: string
  ): Promise<string> {
    // Use provided orgId or fall back to default
    const organizationId = orgId || ORG_ID;
    console.log('RequisitionService: Using orgId:', organizationId);

    // Get project details - use path segments instead of concatenated string
    const projectDocRef = doc(this.db, 'organizations', organizationId, 'advisory_projects', data.projectId);
    console.log('RequisitionService: Looking for project at:', `organizations/${organizationId}/advisory_projects/${data.projectId}`);

    const projectDoc = await getDoc(projectDocRef);
    console.log('RequisitionService: Project exists?', projectDoc.exists());

    if (!projectDoc.exists()) {
      throw new Error('Project not found');
    }

    const projectData = projectDoc.data();

    // Validate implementation type
    if (projectData.implementationType === 'contractor') {
      throw new Error('Requisitions are for direct implementation projects');
    }

    // Get requisition count for numbering
    const existingReqs = await this.getProjectRequisitions(data.projectId);
    const sequence = existingReqs.length + 1;

    // Add IDs to items
    const items: RequisitionItem[] = data.items.map((item, index) => ({
      ...item,
      id: `item-${Date.now()}-${index}`,
    }));

    const totalAmount = calculateRequisitionTotal(items);

    // Build requisition document
    const requisition: Omit<Requisition, 'id'> = {
      projectId: data.projectId,
      programId: projectData.programId,
      engagementId: projectData.engagementId,

      paymentType: 'requisition',
      paymentNumber: `REQ-${projectData.projectCode}-${sequence.toString().padStart(3, '0')}`,
      requisitionNumber: `REQ-${projectData.projectCode}-${sequence.toString().padStart(3, '0')}`,

      purpose: data.purpose,
      budgetLineId: data.budgetLineId,
      budgetLineName: '', // Would be fetched from budget
      budgetLineBalance: 0, // Would be fetched from budget

      items,
      boqItems: data.boqItems as any,
      sourceType: data.sourceType,
      requisitionType: data.requisitionType,
      advanceType: data.advanceType,
      expectedReturnDate: data.expectedReturnDate,

      currency: projectData.budget.currency,
      grossAmount: totalAmount,
      deductions: [],
      netAmount: totalAmount,

      accountabilityStatus: 'pending',
      accountabilityDueDate: data.accountabilityDueDate,
      linkedAccountabilityIds: [],
      unaccountedAmount: totalAmount,

      // ADD-FIN-001: Quotation management (optional)
      quotations: data.quotations as any,
      selectedSupplier: data.selectedSupplier,

      // ADD-FIN-001: Custom approval chain
      useCustomApprovalChain: data.useCustomApprovalChain || false,
      customApprovalChainId: data.customApprovalChainId,

      // Hierarchical requisition fields
      ...(data.parentRequisitionId && {
        parentRequisitionId: data.parentRequisitionId,
        parentRequisitionNumber: data.parentRequisitionNumber,
      }),

      // Labour reconciliation
      ...(data.requisitionType === 'labour' && data.isLabourAdvance && {
        labourReconciliation: {
          isAdvance: true,
          reconciled: false,
        },
      }),

      status: 'draft',
      currentApprovalLevel: 0,
      approvalChain: [],
      supportingDocs: [],

      createdAt: Timestamp.now(),
      createdBy: userId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    const docRef = await addDoc(collection(this.db, PAYMENTS_PATH), requisition);
    return docRef.id;
  }

  // ─────────────────────────────────────────────────────────────────
  // READ OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  async getRequisition(requisitionId: string): Promise<Requisition | null> {
    const docRef = doc(this.db, PAYMENTS_PATH, requisitionId);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    if (data.paymentType !== 'requisition') {
      return null;
    }

    return { id: snapshot.id, ...data } as Requisition;
  }

  async getProjectRequisitions(projectId: string): Promise<Requisition[]> {
    const q = query(
      collection(this.db, PAYMENTS_PATH),
      where('projectId', '==', projectId),
      where('paymentType', '==', 'requisition'),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Requisition));
  }

  async getPendingAccountabilities(projectId: string): Promise<Requisition[]> {
    const q = query(
      collection(this.db, PAYMENTS_PATH),
      where('projectId', '==', projectId),
      where('paymentType', '==', 'requisition'),
      where('accountabilityStatus', 'in', ['pending', 'partial', 'overdue']),
      orderBy('accountabilityDueDate', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Requisition));
  }

  // ─────────────────────────────────────────────────────────────────
  // HIERARCHICAL REQUISITION OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create a child requisition (materials or labour) linked to a parent funds requisition.
   */
  async createChildRequisition(
    data: RequisitionFormData,
    userId: string,
    orgId?: string
  ): Promise<string> {
    if (!data.parentRequisitionId) {
      throw new Error('Parent requisition ID is required for child requisitions');
    }

    // Validate parent
    const parent = await this.getRequisition(data.parentRequisitionId);
    if (!parent) throw new Error('Parent requisition not found');

    const parentType = (parent.requisitionType as string) === 'materials_services'
      ? 'funds' : parent.requisitionType;
    if (parentType !== 'funds') {
      throw new Error('Parent must be a funds requisition');
    }
    if (!['approved', 'paid'].includes(parent.status)) {
      throw new Error('Parent requisition must be approved or paid before creating child requisitions');
    }

    // Create child requisition
    const childId = await this.createRequisition(data, userId, orgId);

    // Update parent with child link
    const updatedChildIds = [...(parent.childRequisitionIds || []), childId];
    await updateDoc(doc(this.db, PAYMENTS_PATH, data.parentRequisitionId), {
      childRequisitionIds: updatedChildIds,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Recalculate parent summary
    await this.updateParentSummary(data.parentRequisitionId, userId);

    return childId;
  }

  /**
   * Get all child requisitions of a parent funds requisition.
   */
  async getChildRequisitions(parentId: string): Promise<Requisition[]> {
    const q = query(
      collection(this.db, PAYMENTS_PATH),
      where('parentRequisitionId', '==', parentId),
      where('paymentType', '==', 'requisition'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Requisition));
  }

  /**
   * Get BOQ items from the parent requisition for pre-populating child forms.
   */
  async getParentBOQItems(parentId: string): Promise<Requisition['boqItems']> {
    const parent = await this.getRequisition(parentId);
    if (!parent) throw new Error('Parent requisition not found');
    return parent.boqItems || [];
  }

  /**
   * Recalculate the childRequisitionsSummary on a parent funds requisition.
   */
  async updateParentSummary(parentId: string, userId: string): Promise<void> {
    const parent = await this.getRequisition(parentId);
    if (!parent) return;

    const children = await this.getChildRequisitions(parentId);

    let materialCount = 0;
    let labourCount = 0;
    let materialAmount = 0;
    let labourAmount = 0;

    for (const child of children) {
      const childType = (child.requisitionType as string) === 'materials_services'
        ? 'materials' : child.requisitionType;
      if (childType === 'materials') {
        materialCount++;
        materialAmount += child.grossAmount || 0;
      } else if (childType === 'labour') {
        labourCount++;
        labourAmount += child.grossAmount || 0;
      }
    }

    const totalChildAmount = materialAmount + labourAmount;
    const parentAmount = parent.grossAmount || 0;

    await updateDoc(doc(this.db, PAYMENTS_PATH, parentId), {
      childRequisitionsSummary: {
        totalChildAmount,
        materialRequisitionsCount: materialCount,
        labourRequisitionsCount: labourCount,
        materialRequisitionsAmount: materialAmount,
        labourRequisitionsAmount: labourAmount,
        remainingFundsBalance: parentAmount - totalChildAmount,
        budgetExceeded: totalChildAmount > parentAmount,
      },
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  /**
   * Reconcile a labour advance requisition against BOQ items.
   */
  async reconcileLabourRequisition(
    requisitionId: string,
    reconciledBoqItems: Array<{ boqItemId: string; boqItemCode: string; description: string; unit: string; quantityExecuted: number; rate: number; amount: number }>,
    userId: string
  ): Promise<void> {
    const requisition = await this.getRequisition(requisitionId);
    if (!requisition) throw new Error('Requisition not found');
    if (requisition.requisitionType !== 'labour') {
      throw new Error('Only labour requisitions can be reconciled');
    }
    if (!requisition.labourReconciliation?.isAdvance) {
      throw new Error('Only advance labour requisitions require reconciliation');
    }

    await updateDoc(doc(this.db, PAYMENTS_PATH, requisitionId), {
      'labourReconciliation.reconciled': true,
      'labourReconciliation.reconciledAt': Timestamp.now(),
      'labourReconciliation.reconciledBy': userId,
      'labourReconciliation.reconciledBoqItems': reconciledBoqItems,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // CREATE ACCOUNTABILITY
  // ─────────────────────────────────────────────────────────────────

  async createAccountability(
    data: AccountabilityFormData,
    userId: string
  ): Promise<string> {
    // Get requisition
    const requisition = await this.getRequisition(data.requisitionId);
    if (!requisition) {
      throw new Error('Requisition not found');
    }

    if (requisition.status !== 'paid') {
      throw new Error('Accountability can only be created for paid requisitions');
    }

    // Get existing accountabilities for this requisition
    const existingAccounts = await this.getRequisitionAccountabilities(data.requisitionId);
    const sequence = existingAccounts.length + 1;

    // Add IDs and status to expenses
    const expenses: AccountabilityExpense[] = data.expenses.map((expense, index) => ({
      ...expense,
      id: `exp-${Date.now()}-${index}`,
      status: 'pending',
    }));

    const totalExpenses = calculateTotalExpenses(expenses);
    const balanceDue = calculateBalanceDue(
      totalExpenses,
      requisition.grossAmount,
      data.unspentReturned
    );
    const receiptsSummary = calculateReceiptsSummary(expenses);

    // Calculate variance
    const varianceAmount = (totalExpenses + data.unspentReturned) - requisition.grossAmount;
    const variancePercentage = Math.abs(varianceAmount / requisition.grossAmount);
    const isZeroDiscrepancy = Math.abs(varianceAmount) < 0.01;

    let varianceStatus: 'compliant' | 'minor' | 'moderate' | 'severe';
    if (isZeroDiscrepancy) {
      varianceStatus = 'compliant';
    } else if (variancePercentage < 0.02) {
      varianceStatus = 'minor';
    } else if (variancePercentage < 0.05) {
      varianceStatus = 'moderate';
    } else {
      varianceStatus = 'severe';
    }

    const requiresInvestigation = varianceStatus === 'moderate' || varianceStatus === 'severe';

    // Build accountability document
    const accountability: Omit<Accountability, 'id'> = {
      projectId: requisition.projectId,
      programId: requisition.programId,
      engagementId: requisition.engagementId,

      paymentType: 'accountability',
      paymentNumber: `ACC-${requisition.requisitionNumber.replace('REQ-', '')}-${sequence.toString().padStart(2, '0')}`,

      requisitionId: data.requisitionId,
      requisitionNumber: requisition.requisitionNumber,
      requisitionAmount: requisition.grossAmount,

      expenses,
      totalExpenses,
      unspentReturned: data.unspentReturned,
      balanceDue,
      receiptsSummary,

      currency: requisition.currency,
      grossAmount: totalExpenses,
      deductions: [],
      netAmount: balanceDue > 0 ? balanceDue : 0,

      // ADD-FIN-001: Variance tracking
      variance: {
        varianceAmount,
        variancePercentage,
        varianceStatus,
        isZeroDiscrepancy,
        totalExpenses,
        unspentReturned: data.unspentReturned,
        requisitionAmount: requisition.grossAmount,
        requiresInvestigation,
        investigationDeadline: requiresInvestigation
          ? new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours
          : undefined,
      },
      isZeroDiscrepancy,

      // ADD-FIN-001: Reconciliation
      reconciliationStatus: 'pending',
      reconciliationDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days

      // ADD-FIN-001: Investigation
      requiresInvestigation,

      status: 'draft',
      currentApprovalLevel: 0,
      approvalChain: [],
      supportingDocs: [],

      createdAt: Timestamp.now(),
      createdBy: userId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    const docRef = await addDoc(collection(this.db, PAYMENTS_PATH), accountability);

    // Link accountability to requisition
    await updateDoc(doc(this.db, PAYMENTS_PATH, data.requisitionId), {
      linkedAccountabilityIds: arrayUnion(docRef.id),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    return docRef.id;
  }

  // ─────────────────────────────────────────────────────────────────
  // ACCOUNTABILITY OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  async getAccountability(accountabilityId: string): Promise<Accountability | null> {
    const docRef = doc(this.db, PAYMENTS_PATH, accountabilityId);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    if (data.paymentType !== 'accountability') {
      return null;
    }

    return { id: snapshot.id, ...data } as Accountability;
  }

  async getRequisitionAccountabilities(requisitionId: string): Promise<Accountability[]> {
    const qByReqId = query(
      collection(this.db, PAYMENTS_PATH),
      where('requisitionId', '==', requisitionId),
      where('paymentType', '==', 'accountability'),
      orderBy('createdAt', 'desc')
    );

    const qByLinked = query(
      collection(this.db, PAYMENTS_PATH),
      where('linkedRequisitionId', '==', requisitionId),
      where('paymentType', '==', 'accountability'),
      orderBy('createdAt', 'desc')
    );

    const [byReqIdSnap, byLinkedSnap] = await Promise.all([
      getDocs(qByReqId),
      getDocs(qByLinked),
    ]);

    const merged = new Map<string, Accountability>();
    for (const d of byReqIdSnap.docs) {
      merged.set(d.id, { id: d.id, ...d.data() } as Accountability);
    }
    for (const d of byLinkedSnap.docs) {
      merged.set(d.id, { id: d.id, ...d.data() } as Accountability);
    }

    return [...merged.values()].sort(
      (a, b) => accountabilityCreatedAtMs(b) - accountabilityCreatedAtMs(a)
    );
  }

  async verifyExpense(
    accountabilityId: string,
    expenseId: string,
    userId: string,
    approved: boolean,
    rejectionReason?: string
  ): Promise<void> {
    const accountability = await this.getAccountability(accountabilityId);
    if (!accountability) {
      throw new Error('Accountability not found');
    }

    const expenseIndex = accountability.expenses.findIndex(e => e.id === expenseId);
    if (expenseIndex === -1) {
      throw new Error('Expense not found');
    }

    const updatedExpenses = [...accountability.expenses];
    updatedExpenses[expenseIndex] = {
      ...updatedExpenses[expenseIndex],
      status: approved ? 'verified' : 'rejected',
      rejectionReason: approved ? undefined : rejectionReason,
    };

    const receiptsSummary = calculateReceiptsSummary(updatedExpenses);

    const docRef = doc(this.db, PAYMENTS_PATH, accountabilityId);
    await updateDoc(docRef, {
      expenses: updatedExpenses,
      receiptsSummary,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }

  async completeVerification(
    accountabilityId: string,
    userId: string,
    notes?: string
  ): Promise<void> {
    const accountability = await this.getAccountability(accountabilityId);
    if (!accountability) {
      throw new Error('Accountability not found');
    }

    const docRef = doc(this.db, PAYMENTS_PATH, accountabilityId);
    await updateDoc(docRef, {
      verifiedBy: userId,
      verifiedAt: Timestamp.now(),
      verificationNotes: notes,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    // Update requisition accountability status
    await this.updateRequisitionAccountabilityStatus(
      accountability.requisitionId,
      userId
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────

  private async updateRequisitionAccountabilityStatus(
    requisitionId: string,
    userId: string
  ): Promise<void> {
    const requisition = await this.getRequisition(requisitionId);
    if (!requisition) return;

    const accountabilities = await this.getRequisitionAccountabilities(requisitionId);
    const approvedAccountabilities = accountabilities.filter(
      a => a.status === 'approved' || a.status === 'paid'
    );

    const totalAccounted = approvedAccountabilities.reduce(
      (sum, a) => sum + a.totalExpenses + a.unspentReturned, 0
    );

    let newStatus: AccountabilityStatus;
    const unaccountedAmount = requisition.grossAmount - totalAccounted;

    if (unaccountedAmount <= 0) {
      newStatus = 'complete';
    } else if (totalAccounted > 0) {
      newStatus = 'partial';
    } else if (new Date(requisition.accountabilityDueDate) < new Date()) {
      newStatus = 'overdue';
    } else {
      newStatus = 'pending';
    }

    const docRef = doc(this.db, PAYMENTS_PATH, requisitionId);
    await updateDoc(docRef, {
      accountabilityStatus: newStatus,
      unaccountedAmount: Math.max(0, unaccountedAmount),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }
}

// Export singleton factory
export function getRequisitionService(db: Firestore): RequisitionService {
  return RequisitionService.getInstance(db);
}
