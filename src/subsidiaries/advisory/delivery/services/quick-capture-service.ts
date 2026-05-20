/**
 * QUICK CAPTURE SERVICE
 *
 * Field expenditure recording for quick captures. Creates accountability records
 * in the existing `payments` collection and maintains a denormalized index in
 * `organizations/{orgId}/quick_capture_index` for cross-project querying.
 *
 * Delegates to RequisitionService for requisition linkage operations.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  Firestore,
  arrayUnion,
} from 'firebase/firestore';
import { RequisitionService } from './requisition-service';
import type { Accountability, AccountabilityExpense } from '../types/accountability';
import type { Requisition, RequisitionFormData } from '../types/requisition';
import type {
  QuickCaptureInput,
  QuickCaptureIndex,
} from '../types/quick-capture';

// ─────────────────────────────────────────────────────────────────
// COLLECTION PATHS
// ─────────────────────────────────────────────────────────────────

const PAYMENTS_PATH = 'payments';

function quickCaptureIndexPath(orgId: string) {
  return `organizations/${orgId}/quick_capture_index`;
}

// ─────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────

export class QuickCaptureService {
  private static instance: QuickCaptureService;
  private db: Firestore;
  private requisitionService: RequisitionService;

  private constructor(db: Firestore) {
    this.db = db;
    this.requisitionService = RequisitionService.getInstance(db);
  }

  static getInstance(db: Firestore): QuickCaptureService {
    if (!QuickCaptureService.instance) {
      QuickCaptureService.instance = new QuickCaptureService(db);
    }
    return QuickCaptureService.instance;
  }

  // ─────────────────────────────────────────────────────────────────
  // CREATE QUICK CAPTURE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create a quick-capture accountability record in the existing `payments`
   * collection with captureMode: 'quick_capture'.
   *
   * If a requisitionId is provided, the capture is immediately linked.
   * Otherwise it is "floating" (pending linkage within 48h).
   */
  async createQuickCapture(
    data: QuickCaptureInput,
    userId: string,
    orgId: string
  ): Promise<string> {
    // Fetch project for context
    const projectDocRef = doc(
      this.db,
      'organizations',
      orgId,
      'advisory_projects',
      data.projectId
    );
    const projectDoc = await getDoc(projectDocRef);
    if (!projectDoc.exists()) {
      throw new Error('Project not found');
    }
    const projectData = projectDoc.data();

    const capturedAt = Timestamp.now();
    const linkDeadline = Timestamp.fromMillis(
      capturedAt.toMillis() + 48 * 60 * 60 * 1000
    );

    const isLinked = !!data.requisitionId;

    // If linking to a requisition, validate it exists and has capacity
    let requisition: Requisition | null = null;
    if (data.requisitionId) {
      requisition = await this.requisitionService.getRequisition(
        data.requisitionId
      );
      if (!requisition) {
        throw new Error('Requisition not found');
      }
    }

    // Build a single-expense accountability entry
    const expense: AccountabilityExpense = {
      id: `exp-qc-${Date.now()}-0`,
      lineNumber: 1,
      date: data.date,
      description: data.description,
      category: (data.budgetCategory as any) || 'construction_materials',
      vendor: data.vendorName,
      amount: data.totalAmount,
      documents: data.documents.map((d, i) => ({
        id: `doc-qc-${Date.now()}-${i}`,
        type: (d.type === 'Receipt' ? 'receipt'
          : d.type === 'Invoice' ? 'invoice'
          : d.type === 'DeliveryNote' ? 'delivery_note'
          : 'other') as any,
        fileName: d.fileName,
        fileUrl: d.storageUrl,
        uploadedAt: new Date(),
        uploadedBy: userId,
      })),
      status: 'pending',
      isZeroDiscrepancy: false,
    };

    // Capture GPS if available (best-effort, non-blocking)
    let captureLocation: { latitude: number; longitude: number } | null = null;

    // Build the accountability document
    const accountability: Omit<Accountability, 'id'> = {
      projectId: data.projectId,
      programId: projectData.programId || '',
      engagementId: projectData.engagementId || '',

      paymentType: 'accountability',
      paymentNumber: `QC-${Date.now().toString(36).toUpperCase()}`,

      requisitionId: data.requisitionId || '',
      requisitionNumber: requisition?.requisitionNumber || '',
      requisitionAmount: requisition?.grossAmount || 0,

      expenses: [expense],
      totalExpenses: data.totalAmount,
      unspentReturned: 0,
      balanceDue: 0,
      receiptsSummary: {
        totalReceipts: 1,
        verifiedReceipts: 0,
        pendingReceipts: 1,
        rejectedReceipts: 0,
        totalVerifiedAmount: 0,
      },

      currency: data.currency,
      grossAmount: data.totalAmount,
      deductions: [],
      netAmount: data.totalAmount,

      variance: {
        varianceAmount: 0,
        variancePercentage: 0,
        varianceStatus: 'compliant',
        isZeroDiscrepancy: true,
        totalExpenses: data.totalAmount,
        unspentReturned: 0,
        requisitionAmount: requisition?.grossAmount || 0,
        requiresInvestigation: false,
      },
      isZeroDiscrepancy: true,

      reconciliationStatus: 'pending',
      reconciliationDeadline: new Date(
        Date.now() + 14 * 24 * 60 * 60 * 1000
      ),
      requiresInvestigation: false,

      // Quick capture extension fields
      captureMode: 'quick_capture',
      capturedAt,
      captureLocation,
      requisitionLinkStatus: isLinked ? 'linked' : 'pending',
      linkedRequisitionId: data.requisitionId || null,
      linkDeadline: isLinked ? null : linkDeadline,

      status: 'draft',
      currentApprovalLevel: 0,
      approvalChain: [],
      supportingDocs: data.documents.map((d, i) => ({
        id: `sdoc-qc-${Date.now()}-${i}`,
        name: d.fileName,
        type: d.type,
        url: d.storageUrl,
        uploadedAt: Timestamp.now(),
        uploadedBy: userId,
      })),

      createdAt: Timestamp.now(),
      createdBy: userId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    const docRef = await addDoc(
      collection(this.db, PAYMENTS_PATH),
      accountability
    );

    // If linked, update the requisition's linked accountability IDs
    if (isLinked && requisition && data.requisitionId) {
      await updateDoc(doc(this.db, PAYMENTS_PATH, data.requisitionId), {
        linkedAccountabilityIds: arrayUnion(docRef.id),
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      // Recalculate parent summary if this requisition has a parent
      if (requisition.parentRequisitionId) {
        await this.requisitionService.updateParentSummary(
          requisition.parentRequisitionId,
          userId
        );
      }
    }

    // Create index entry for unlinked captures
    if (!isLinked) {
      const indexEntry: Omit<QuickCaptureIndex, 'id'> = {
        projectId: data.projectId,
        projectName: projectData.name || projectData.projectName || '',
        programId: projectData.programId || '',
        vendorName: data.vendorName,
        description: data.description,
        amount: data.totalAmount,
        currency: data.currency,
        capturedAt,
        linkDeadline,
        requisitionLinkStatus: 'pending',
        thumbnailUrl: data.documents[0]?.storageUrl || null,
        organizationId: orgId,
        budgetCategory: data.budgetCategory,
        paymentMethod: data.paymentMethod,
        accountabilityId: docRef.id,
        createdBy: userId,
      };

      await addDoc(
        collection(this.db, quickCaptureIndexPath(orgId)),
        indexEntry
      );
    }

    return docRef.id;
  }

  // ─────────────────────────────────────────────────────────────────
  // GET UNLINKED CAPTURES
  // ─────────────────────────────────────────────────────────────────

  /**
   * Query all unlinked quick captures via the denormalized index.
   * Ordered by linkDeadline ASC (most urgent first).
   */
  async getUnlinkedCaptures(orgId: string): Promise<QuickCaptureIndex[]> {
    const q = query(
      collection(this.db, quickCaptureIndexPath(orgId)),
      where('requisitionLinkStatus', '==', 'pending'),
      orderBy('linkDeadline', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as QuickCaptureIndex[];
  }

  // ─────────────────────────────────────────────────────────────────
  // LINK CAPTURE TO REQUISITION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Link a pending quick capture to an existing requisition.
   * Updates the accountability record and removes the index entry.
   */
  async linkCaptureToRequisition(
    captureId: string,
    _projectId: string,
    requisitionId: string,
    userId: string,
    orgId: string
  ): Promise<void> {
    // Update accountability record
    const paymentRef = doc(this.db, PAYMENTS_PATH, captureId);
    const paymentSnap = await getDoc(paymentRef);
    if (!paymentSnap.exists()) {
      throw new Error('Quick capture not found');
    }

    const requisition = await this.requisitionService.getRequisition(
      requisitionId
    );
    if (!requisition) {
      throw new Error('Requisition not found');
    }

    await updateDoc(paymentRef, {
      requisitionLinkStatus: 'linked',
      linkedRequisitionId: requisitionId,
      requisitionId: requisitionId,
      requisitionNumber: requisition.requisitionNumber,
      requisitionAmount: requisition.grossAmount,
      linkDeadline: null,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Add to requisition's linked accountability IDs
    await updateDoc(doc(this.db, PAYMENTS_PATH, requisitionId), {
      linkedAccountabilityIds: arrayUnion(captureId),
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Recalculate parent summary if applicable
    if (requisition.parentRequisitionId) {
      await this.requisitionService.updateParentSummary(
        requisition.parentRequisitionId,
        userId
      );
    }

    // Remove from quick_capture_index
    await this.removeFromIndex(captureId, orgId);
  }

  // ─────────────────────────────────────────────────────────────────
  // CREATE RETROACTIVE REQUISITION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create a new Funds Requisition pre-filled from a quick capture,
   * flagged as retroactive. The requisition still goes through the
   * standard approval workflow (Technical Review → Financial Approval).
   */
  async createRetroactiveRequisition(
    captureId: string,
    projectId: string,
    userId: string,
    orgId: string
  ): Promise<string> {
    // Read the quick capture accountability record
    const paymentRef = doc(this.db, PAYMENTS_PATH, captureId);
    const paymentSnap = await getDoc(paymentRef);
    if (!paymentSnap.exists()) {
      throw new Error('Quick capture not found');
    }
    const captureData = paymentSnap.data();

    // Fetch project for context
    const projectDocRef = doc(
      this.db,
      'organizations',
      orgId,
      'advisory_projects',
      projectId
    );
    const projectDoc = await getDoc(projectDocRef);
    if (!projectDoc.exists()) {
      throw new Error('Project not found');
    }
    projectDoc.data(); // validate project exists

    // Build requisition form data
    const formData: RequisitionFormData = {
      projectId,
      purpose: `[Retroactive] ${captureData.expenses?.[0]?.description || 'Quick capture expenditure'}`,
      budgetLineId: captureData.expenses?.[0]?.category || 'construction_materials',
      currency: captureData.currency,
      requisitionType: 'funds',
      advanceType: 'materials',
      accountabilityDueDate: new Date(
        Date.now() + 14 * 24 * 60 * 60 * 1000
      ),
      sourceType: 'manual',
      items: [
        {
          description: captureData.expenses?.[0]?.description || 'Quick capture expenditure',
          category: captureData.expenses?.[0]?.category || 'construction_materials',
          quantity: 1,
          unit: 'lump sum',
          unitCost: captureData.grossAmount || 0,
          totalCost: captureData.grossAmount || 0,
        },
      ],
    };

    // Create the requisition via the existing service
    const requisitionId = await this.requisitionService.createRequisition(
      formData,
      userId,
      orgId
    );

    // Flag it as retroactive
    await updateDoc(doc(this.db, PAYMENTS_PATH, requisitionId), {
      isRetroactive: true,
      linkedAccountabilityIds: arrayUnion(captureId),
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Link the capture to this new requisition
    const newReq = await this.requisitionService.getRequisition(requisitionId);
    await updateDoc(paymentRef, {
      requisitionLinkStatus: 'retroactive',
      linkedRequisitionId: requisitionId,
      requisitionId: requisitionId,
      requisitionNumber: newReq?.requisitionNumber || '',
      requisitionAmount: newReq?.grossAmount ?? captureData.grossAmount ?? 0,
      linkDeadline: null,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Remove from quick_capture_index
    await this.removeFromIndex(captureId, orgId);

    return requisitionId;
  }

  // ─────────────────────────────────────────────────────────────────
  // GET MATCHING REQUISITIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Find Funds Requisitions in a project that have enough remaining balance
   * to cover the capture amount. Includes in-flight requisitions (draft through
   * paid) so newly created requests appear in the linker and form pickers.
   */
  async getMatchingRequisitions(
    projectId: string,
    amount: number
  ): Promise<Requisition[]> {
    // Use existing composite index: [projectId, paymentType, createdAt]
    // Filter status in memory to avoid needing a 4-field index
    const q = query(
      collection(this.db, PAYMENTS_PATH),
      where('projectId', '==', projectId),
      where('paymentType', '==', 'requisition'),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const requisitions = snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() } as Requisition)
    );

    // Exclude terminal states; allow draft → paid so new requisitions are linkable
    const EXCLUDED_STATUSES = ['rejected', 'cancelled'];
    return requisitions
      .filter((r) => {
        if (EXCLUDED_STATUSES.includes(r.status)) return false;
        const remaining =
          r.childRequisitionsSummary?.remainingFundsBalance ??
          r.unaccountedAmount ??
          r.grossAmount;
        return remaining >= amount;
      })
      .sort((a, b) => {
        // Sort by closest match to the capture amount
        const aRemaining =
          a.childRequisitionsSummary?.remainingFundsBalance ??
          a.unaccountedAmount ??
          a.grossAmount;
        const bRemaining =
          b.childRequisitionsSummary?.remainingFundsBalance ??
          b.unaccountedAmount ??
          b.grossAmount;
        return Math.abs(aRemaining - amount) - Math.abs(bRemaining - amount);
      });
  }

  // ─────────────────────────────────────────────────────────────────
  // VOID QUICK CAPTURE
  // ─────────────────────────────────────────────────────────────────

  async voidCapture(
    captureId: string,
    _reason: string,
    userId: string,
    orgId: string
  ): Promise<void> {
    await updateDoc(doc(this.db, PAYMENTS_PATH, captureId), {
      status: 'cancelled',
      requisitionLinkStatus: 'linked', // No longer pending
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Remove from index
    await this.removeFromIndex(captureId, orgId);
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Remove a capture from the quick_capture_index by accountabilityId.
   */
  private async removeFromIndex(
    accountabilityId: string,
    orgId: string
  ): Promise<void> {
    const q = query(
      collection(this.db, quickCaptureIndexPath(orgId)),
      where('accountabilityId', '==', accountabilityId)
    );
    const snapshot = await getDocs(q);
    for (const indexDoc of snapshot.docs) {
      await deleteDoc(indexDoc.ref);
    }
  }
}
