/**
 * IPC SERVICE
 * 
 * Interim Payment Certificate operations for contractor projects.
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
} from 'firebase/firestore';
import {
  IPC,
  IPCFormData,
  IPCValuation,
  BillItemValuation,
  buildIPCDeductions,
} from '../types/ipc';

// ─────────────────────────────────────────────────────────────────
// COLLECTION PATHS
// ─────────────────────────────────────────────────────────────────

const PAYMENTS_PATH = 'payments';
const PROJECTS_PATH = 'projects';

// ─────────────────────────────────────────────────────────────────
// IPC SERVICE
// ─────────────────────────────────────────────────────────────────

export class IPCService {
  private static instance: IPCService;
  private db: Firestore;

  private constructor(db: Firestore) {
    this.db = db;
  }

  static getInstance(db: Firestore): IPCService {
    if (!IPCService.instance) {
      IPCService.instance = new IPCService(db);
    }
    return IPCService.instance;
  }

  // ─────────────────────────────────────────────────────────────────
  // CREATE IPC
  // ─────────────────────────────────────────────────────────────────

  async createIPC(
    data: IPCFormData,
    userId: string
  ): Promise<string> {
    // Get project details
    const projectDoc = await getDoc(doc(this.db, PROJECTS_PATH, data.projectId));
    if (!projectDoc.exists()) {
      throw new Error('Project not found');
    }

    const projectData = projectDoc.data();

    // Validate implementation type
    if (projectData.implementationType !== 'contractor') {
      throw new Error('IPCs can only be created for contractor-implemented projects');
    }

    // Get previous IPCs for cumulative calculation
    const previousIPCs = await this.getProjectIPCs(data.projectId);
    const ipcNumber = previousIPCs.length + 1;
    const previousCertified = previousIPCs.reduce(
      (sum, ipc) => sum + ipc.thisCertified, 0
    );

    // Calculate valuation
    const valuation = this.calculateValuation(
      data.billItems as BillItemValuation[],
      previousIPCs,
      data.materialsOnSite || 0
    );

    // Calculate deductions
    const retentionRate = projectData.contractor?.retentionPercentage || 10;
    const deductions = buildIPCDeductions(valuation, retentionRate, 6);
    const netAmount = valuation.amountDue - deductions.reduce((sum, d) => sum + d.amount, 0);

    // Update valuation with deduction amounts
    valuation.lessRetention = deductions.find(d => d.type === 'retention')?.amount || 0;
    valuation.lessWithholdingTax = deductions.find(d => d.type === 'withholding_tax')?.amount || 0;

    const contractValue = projectData.contractor?.contractValue || projectData.budget.totalBudget;
    const percentComplete = ((previousCertified + valuation.amountDue) / contractValue) * 100;

    // Build IPC document
    const ipc: Omit<IPC, 'id'> = {
      projectId: data.projectId,
      programId: projectData.programId,
      engagementId: projectData.engagementId,

      paymentType: 'ipc',
      paymentNumber: `IPC-${projectData.projectCode}-${ipcNumber.toString().padStart(3, '0')}`,
      ipcNumber,
      certificateDate: data.certificateDate,

      currency: projectData.budget.currency,
      grossAmount: valuation.grossValuation,
      deductions,
      netAmount,

      valuation,
      previousCertified,
      thisCertified: valuation.amountDue,
      cumulativeCertified: previousCertified + valuation.amountDue,

      contractValue,
      percentComplete,

      periodFrom: data.periodFrom,
      periodTo: data.periodTo,

      variationOrders: data.variationOrders || [],

      status: 'draft',
      currentApprovalLevel: 0,
      approvalChain: [],
      supportingDocs: [],

      createdAt: Timestamp.now(),
      createdBy: userId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    const docRef = await addDoc(collection(this.db, PAYMENTS_PATH), ipc);
    return docRef.id;
  }

  // ─────────────────────────────────────────────────────────────────
  // READ OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  async getIPC(ipcId: string): Promise<IPC | null> {
    const docRef = doc(this.db, PAYMENTS_PATH, ipcId);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    if (data.paymentType !== 'ipc') {
      return null;
    }

    return { id: snapshot.id, ...data } as IPC;
  }

  async getProjectIPCs(
    projectId: string,
    includeAll: boolean = false
  ): Promise<IPC[]> {
    const constraints = [
      where('projectId', '==', projectId),
      where('paymentType', '==', 'ipc'),
    ];

    if (!includeAll) {
      constraints.push(where('status', 'in', ['approved', 'paid']));
    }

    const q = query(
      collection(this.db, PAYMENTS_PATH),
      ...constraints,
      orderBy('ipcNumber', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IPC));
  }

  // ─────────────────────────────────────────────────────────────────
  // UPDATE OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  async updateIPC(
    ipcId: string,
    updates: Partial<IPCFormData>,
    userId: string
  ): Promise<void> {
    const ipc = await this.getIPC(ipcId);
    if (!ipc) {
      throw new Error('IPC not found');
    }

    if (ipc.status !== 'draft') {
      throw new Error('Only draft IPCs can be updated');
    }

    const docRef = doc(this.db, PAYMENTS_PATH, ipcId);

    // Recalculate if bill items changed
    if (updates.billItems) {
      const previousIPCs = await this.getProjectIPCs(ipc.projectId);
      const filteredIPCs = previousIPCs.filter(p => p.id !== ipcId);

      const valuation = this.calculateValuation(
        updates.billItems as BillItemValuation[],
        filteredIPCs,
        updates.materialsOnSite || 0
      );

      const projectDoc = await getDoc(doc(this.db, PROJECTS_PATH, ipc.projectId));
      const projectData = projectDoc.data();
      const retentionRate = projectData?.contractor?.retentionPercentage || 10;

      const deductions = buildIPCDeductions(valuation, retentionRate, 6);
      const netAmount = valuation.amountDue - deductions.reduce((sum, d) => sum + d.amount, 0);

      await updateDoc(docRef, {
        valuation,
        grossAmount: valuation.grossValuation,
        deductions,
        netAmount,
        thisCertified: valuation.amountDue,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
    } else {
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
    }
  }

  async certifyByQS(
    ipcId: string,
    userId: string,
    comments?: string
  ): Promise<void> {
    const docRef = doc(this.db, PAYMENTS_PATH, ipcId);

    await updateDoc(docRef, {
      qsCertifiedBy: userId,
      qsCertifiedAt: Timestamp.now(),
      qsComments: comments,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // VALUATION CALCULATION
  // ─────────────────────────────────────────────────────────────────

  private calculateValuation(
    billItems: BillItemValuation[],
    previousIPCs: IPC[],
    materialsOnSite: number
  ): IPCValuation {
    // Aggregate previous quantities per bill item
    const previousQuantities = new Map<string, number>();
    const previousAmounts = new Map<string, number>();

    previousIPCs.forEach(ipc => {
      ipc.valuation.billItems.forEach(item => {
        const prevQty = previousQuantities.get(item.billItemId) || 0;
        const prevAmt = previousAmounts.get(item.billItemId) || 0;
        previousQuantities.set(item.billItemId, prevQty + item.thisQuantity);
        previousAmounts.set(item.billItemId, prevAmt + item.thisAmount);
      });
    });

    // Calculate this period's valuation
    const valuedItems: BillItemValuation[] = billItems.map(item => {
      const prevQty = previousQuantities.get(item.billItemId) || 0;
      const prevAmt = previousAmounts.get(item.billItemId) || 0;
      const thisQty = item.thisQuantity || 0;
      const rate = item.contractRate || 0;
      const thisAmt = thisQty * rate;

      return {
        billItemId: item.billItemId,
        billReference: item.billReference,
        description: item.description,
        unit: item.unit,
        contractQuantity: item.contractQuantity,
        contractRate: rate,
        contractAmount: item.contractQuantity * rate,
        previousQuantity: prevQty,
        thisQuantity: thisQty,
        cumulativeQuantity: prevQty + thisQty,
        previousAmount: prevAmt,
        thisAmount: thisAmt,
        cumulativeAmount: prevAmt + thisAmt,
      };
    });

    const worksDone = valuedItems.reduce((sum, item) => sum + item.thisAmount, 0);
    const previousCertificates = previousIPCs.reduce((sum, ipc) => sum + ipc.netAmount, 0);
    const grossValuation = worksDone + materialsOnSite;

    return {
      billItems: valuedItems,
      worksDone,
      materialsOnSite,
      variationsApproved: 0,
      grossValuation,
      lessRetention: 0,
      lessAdvanceRecovery: 0,
      lessWithholdingTax: 0,
      lessPreviousCertificates: previousCertificates,
      otherDeductions: 0,
      amountDue: grossValuation,
    };
  }
}

// Export singleton factory
export function getIPCService(db: Firestore): IPCService {
  return IPCService.getInstance(db);
}
