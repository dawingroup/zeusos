/**
 * MANUAL REQUISITION SERVICE
 *
 * Service for managing manually entered requisitions from backlog.
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
  serverTimestamp,
  Firestore,
  limit,
  runTransaction,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { uploadFile } from '@/core/services/firebase/storage';
import {
  ManualRequisition,
  ManualRequisitionFormData,
  ManualAccountabilityEntry,
  ManualRequisitionStatus,
  LinkToProjectData,
  LinkToRequisitionData,
  AcknowledgementDocument,
  AcknowledgementFormData,
  ActivityReport,
  ActivityReportFormData,
  calculateManualAccountedTotal,
  calculateManualAccountabilityStatus,
  calculateManualRequisitionVariance,
  calculateManualReconciliationDeadline,
} from '../types/manual-requisition';
import { AccountabilityStatus } from '../types/requisition';
import { ReconciliationStatus } from '../types/accountability';

import {
  generateReceiptNumber,
  FundsAcknowledgementDocument,
} from '../types/funds-acknowledgement';

/**
 * Deep clean an object to remove all undefined values recursively.
 * Firestore does NOT accept undefined values at any nesting level.
 */
function removeUndefinedDeep(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj;
  if (typeof obj !== 'object') return obj;

  // Handle Firebase Timestamp
  if ('toDate' in obj && typeof obj.toDate === 'function') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedDeep(item));
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = removeUndefinedDeep(value);
    }
  }
  return cleaned;
}

// ─────────────────────────────────────────────────────────────────
// COLLECTION PATHS
// ─────────────────────────────────────────────────────────────────

const MANUAL_REQUISITIONS_PATH = 'manual_requisitions';
const RECEIPT_SEQUENCES_PATH = 'receipt_sequences';
const FUNDS_ACKNOWLEDGEMENTS_PATH = 'funds_acknowledgements';

// ─────────────────────────────────────────────────────────────────
// MANUAL REQUISITION SERVICE
// ─────────────────────────────────────────────────────────────────

export class ManualRequisitionService {
  private static instance: ManualRequisitionService;
  private db: Firestore;

  private constructor(db: Firestore) {
    this.db = db;
  }

  static getInstance(db: Firestore): ManualRequisitionService {
    if (!ManualRequisitionService.instance) {
      ManualRequisitionService.instance = new ManualRequisitionService(db);
    }
    return ManualRequisitionService.instance;
  }

  // ─────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────

  async createManualRequisition(
    data: ManualRequisitionFormData,
    userId: string,
    userName?: string
  ): Promise<string> {
    // Generate reference number
    const existingCount = await this.getRequisitionCount();
    const referenceNumber = data.referenceNumber ||
      `MAN-REQ-${new Date().getFullYear()}-${(existingCount + 1).toString().padStart(4, '0')}`;

    // Add IDs to accountability entries
    const accountabilities: ManualAccountabilityEntry[] = data.accountabilities.map((acc, index) => ({
      ...acc,
      id: `macc-${Date.now()}-${index}`,
    }));

    const totalAccountedAmount = calculateManualAccountedTotal(accountabilities);
    const unaccountedAmount = data.amount - totalAccountedAmount;

    // Determine link status
    let linkStatus: ManualRequisitionStatus = 'unlinked';
    if (data.linkedProjectId) {
      linkStatus = 'linked';
    }

    // Build manual requisition document - only include defined values
    // Firestore does NOT accept undefined values, so we must exclude them
    const manualRequisition: Record<string, any> = {
      referenceNumber,
      description: data.description,
      purpose: data.purpose,

      currency: data.currency,
      amount: data.amount,

      requisitionDate: data.requisitionDate,

      accountabilityStatus: data.accountabilityStatus ||
        calculateManualAccountabilityStatus(data.amount, totalAccountedAmount, data.accountabilityDueDate),
      accountabilities,
      totalAccountedAmount,
      unaccountedAmount: Math.max(0, unaccountedAmount),

      advanceType: data.advanceType,

      linkStatus,

      createdAt: Timestamp.now(),
      createdBy: userId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    // Only add optional fields if they have defined values (Firestore rejects undefined)
    if (data.accountabilityDueDate !== undefined && data.accountabilityDueDate !== null) {
      manualRequisition.accountabilityDueDate = data.accountabilityDueDate;
    }
    if (data.paidDate !== undefined && data.paidDate !== null) {
      manualRequisition.paidDate = data.paidDate;
    }
    if (data.linkedProjectId !== undefined && data.linkedProjectId !== null && data.linkedProjectId !== '') {
      manualRequisition.linkedProjectId = data.linkedProjectId;
    }
    if (data.linkedProgramId !== undefined && data.linkedProgramId !== null && data.linkedProgramId !== '') {
      manualRequisition.linkedProgramId = data.linkedProgramId;
    }
    if (data.sourceDocument !== undefined && data.sourceDocument !== null && data.sourceDocument !== '') {
      manualRequisition.sourceDocument = data.sourceDocument;
    }
    if (data.sourceReference !== undefined && data.sourceReference !== null && data.sourceReference !== '') {
      manualRequisition.sourceReference = data.sourceReference;
    }
    if (data.notes !== undefined && data.notes !== null && data.notes !== '') {
      manualRequisition.notes = data.notes;
    }
    if (userName !== undefined && userName !== null && userName !== '') {
      manualRequisition.createdByName = userName;
    }

    const docRef = await addDoc(collection(this.db, MANUAL_REQUISITIONS_PATH), manualRequisition);
    return docRef.id;
  }

  // ─────────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────────

  async getManualRequisition(id: string): Promise<ManualRequisition | null> {
    const docRef = doc(this.db, MANUAL_REQUISITIONS_PATH, id);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      return null;
    }

    return { id: snapshot.id, ...snapshot.data() } as ManualRequisition;
  }

  async getAllManualRequisitions(options?: {
    linkStatus?: ManualRequisitionStatus;
    accountabilityStatus?: AccountabilityStatus;
    linkedProjectId?: string;
    limitCount?: number;
  }): Promise<ManualRequisition[]> {
    let q = query(
      collection(this.db, MANUAL_REQUISITIONS_PATH),
      orderBy('requisitionDate', 'desc')
    );

    // Note: Firestore doesn't support multiple inequality filters
    // For complex filtering, we filter in memory after fetching
    const snapshot = await getDocs(q);
    let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ManualRequisition));

    // Apply filters
    if (options?.linkStatus) {
      results = results.filter(r => r.linkStatus === options.linkStatus);
    }
    if (options?.accountabilityStatus) {
      results = results.filter(r => r.accountabilityStatus === options.accountabilityStatus);
    }
    if (options?.linkedProjectId) {
      results = results.filter(r => r.linkedProjectId === options.linkedProjectId);
    }
    if (options?.limitCount) {
      results = results.slice(0, options.limitCount);
    }

    return results;
  }

  async getUnlinkedRequisitions(): Promise<ManualRequisition[]> {
    const q = query(
      collection(this.db, MANUAL_REQUISITIONS_PATH),
      where('linkStatus', '==', 'unlinked'),
      orderBy('requisitionDate', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ManualRequisition));
  }

  async getProjectManualRequisitions(projectId: string): Promise<ManualRequisition[]> {
    const q = query(
      collection(this.db, MANUAL_REQUISITIONS_PATH),
      where('linkedProjectId', '==', projectId),
      orderBy('requisitionDate', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ManualRequisition));
  }

  private async getRequisitionCount(): Promise<number> {
    const snapshot = await getDocs(collection(this.db, MANUAL_REQUISITIONS_PATH));
    return snapshot.size;
  }

  // ─────────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────────

  async updateManualRequisition(
    id: string,
    data: Partial<ManualRequisitionFormData>,
    userId: string
  ): Promise<void> {
    const existing = await this.getManualRequisition(id);
    if (!existing) {
      throw new Error('Manual requisition not found');
    }

    // Build updates object, only including defined values
    // Firestore does NOT accept undefined values
    const updates: Record<string, any> = {
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    // Add each field only if it's defined (not undefined)
    if (data.referenceNumber !== undefined) updates.referenceNumber = data.referenceNumber;
    if (data.description !== undefined) updates.description = data.description;
    if (data.purpose !== undefined) updates.purpose = data.purpose;
    if (data.currency !== undefined) updates.currency = data.currency;
    if (data.amount !== undefined) updates.amount = data.amount;
    if (data.requisitionDate !== undefined) updates.requisitionDate = data.requisitionDate;
    if (data.advanceType !== undefined) updates.advanceType = data.advanceType;
    if (data.accountabilityStatus !== undefined) updates.accountabilityStatus = data.accountabilityStatus;

    // Handle optional fields - only add if defined and not empty string
    if (data.paidDate !== undefined && data.paidDate !== null) {
      updates.paidDate = data.paidDate;
    }
    if (data.accountabilityDueDate !== undefined && data.accountabilityDueDate !== null) {
      updates.accountabilityDueDate = data.accountabilityDueDate;
    }
    if (data.sourceDocument !== undefined && data.sourceDocument !== '') {
      updates.sourceDocument = data.sourceDocument;
    }
    if (data.sourceReference !== undefined && data.sourceReference !== '') {
      updates.sourceReference = data.sourceReference;
    }
    if (data.notes !== undefined && data.notes !== '') {
      updates.notes = data.notes;
    }
    if (data.linkedProjectId !== undefined && data.linkedProjectId !== '') {
      updates.linkedProjectId = data.linkedProjectId;
    }
    if (data.linkedProgramId !== undefined && data.linkedProgramId !== '') {
      updates.linkedProgramId = data.linkedProgramId;
    }

    // Recalculate totals if accountabilities changed
    if (data.accountabilities !== undefined) {
      // Helper to clean a document object (remove undefined fields)
      const cleanDocument = (doc: any): Record<string, any> => {
        if (!doc) return doc;
        const cleaned: Record<string, any> = {
          id: doc.id,
          type: doc.type,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          uploadedAt: doc.uploadedAt,
          uploadedBy: doc.uploadedBy,
        };
        // Only add optional fields if they have values
        if (doc.fileSize !== undefined) cleaned.fileSize = doc.fileSize;
        if (doc.mimeType) cleaned.mimeType = doc.mimeType;
        if (doc.documentNumber) cleaned.documentNumber = doc.documentNumber;
        if (doc.documentDate) cleaned.documentDate = doc.documentDate;
        if (doc.notes) cleaned.notes = doc.notes;
        return cleaned;
      };

      // Helper to clean an activity report object
      const cleanActivityReport = (report: any): Record<string, any> | undefined => {
        if (!report) return undefined;
        const cleaned: Record<string, any> = {};
        if (report.id) cleaned.id = report.id;
        if (report.documentUrl) cleaned.documentUrl = report.documentUrl;
        if (report.documentName) cleaned.documentName = report.documentName;
        if (report.documentSize !== undefined) cleaned.documentSize = report.documentSize;
        if (report.uploadedAt) cleaned.uploadedAt = report.uploadedAt;
        if (report.uploadedBy) cleaned.uploadedBy = report.uploadedBy;
        if (report.notes) cleaned.notes = report.notes;
        if (report.photos && Array.isArray(report.photos)) {
          cleaned.photos = report.photos.map((p: any) => {
            const photo: Record<string, any> = { url: p.url };
            if (p.caption) photo.caption = p.caption;
            return photo;
          });
        }
        return Object.keys(cleaned).length > 0 ? cleaned : undefined;
      };

      const accountabilities: ManualAccountabilityEntry[] = data.accountabilities.map((acc, index) => {
        // Build accountability entry without undefined fields
        // Clean documents array - remove undefined fields from each document
        const cleanedDocuments = (acc.documents || []).map(doc => cleanDocument(doc));

        const entry: Record<string, any> = {
          id: acc.id || `macc-${Date.now()}-${index}`,
          date: acc.date,
          description: acc.description,
          category: acc.category,
          amount: acc.amount,
          documents: cleanedDocuments,
        };
        // Only add optional fields if they have values
        if (acc.vendor) entry.vendor = acc.vendor;
        if (acc.receiptNumber) entry.receiptNumber = acc.receiptNumber;
        if (acc.invoiceNumber) entry.invoiceNumber = acc.invoiceNumber;
        if (acc.notes) entry.notes = acc.notes;
        if (acc.paymentMethod) entry.paymentMethod = acc.paymentMethod;
        if (acc.contractOrPONumber) entry.contractOrPONumber = acc.contractOrPONumber;
        if (acc.contractOrPODocument) entry.contractOrPODocument = cleanDocument(acc.contractOrPODocument);
        const cleanedReport = cleanActivityReport(acc.activityReport);
        if (cleanedReport) entry.activityReport = cleanedReport;
        return entry as ManualAccountabilityEntry;
      });

      const totalAccountedAmount = calculateManualAccountedTotal(accountabilities);
      const amount = data.amount ?? existing.amount;
      const unaccountedAmount = amount - totalAccountedAmount;

      updates.accountabilities = accountabilities;
      updates.totalAccountedAmount = totalAccountedAmount;
      updates.unaccountedAmount = Math.max(0, unaccountedAmount);
      updates.accountabilityStatus = calculateManualAccountabilityStatus(
        amount,
        totalAccountedAmount,
        data.accountabilityDueDate ?? existing.accountabilityDueDate
      );
    }

    const docRef = doc(this.db, MANUAL_REQUISITIONS_PATH, id);
    // Final deep clean to ensure NO undefined values at any level
    const cleanedUpdates = removeUndefinedDeep(updates);
    await updateDoc(docRef, cleanedUpdates);
  }

  async saveAcknowledgement(
    id: string,
    acknowledgementData: AcknowledgementFormData,
    userId: string
  ): Promise<void> {
    const existing = await this.getManualRequisition(id);
    if (!existing) {
      throw new Error('Manual requisition not found');
    }

    const acknowledgement: AcknowledgementDocument = {
      id: `ack-${Date.now()}`,
      amountReceived: acknowledgementData.amountReceived,
      dateReceived: acknowledgementData.dateReceived,
      receivedBy: acknowledgementData.receivedBy,
      receivedByEmail: acknowledgementData.receivedByEmail,
      receivedByTitle: acknowledgementData.receivedByTitle,
      signatureHtml: acknowledgementData.signatureHtml,
      notes: acknowledgementData.notes,
      generatedAt: Timestamp.now(),
      generatedBy: userId,
    };

    const docRef = doc(this.db, MANUAL_REQUISITIONS_PATH, id);
    await updateDoc(docRef, {
      acknowledgement,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }

  async addAccountability(
    id: string,
    accountability: Omit<ManualAccountabilityEntry, 'id'>,
    userId: string
  ): Promise<void> {
    const existing = await this.getManualRequisition(id);
    if (!existing) {
      throw new Error('Manual requisition not found');
    }

    const newAccountability: ManualAccountabilityEntry = {
      ...accountability,
      id: `macc-${Date.now()}`,
    };

    const accountabilities = [...existing.accountabilities, newAccountability];
    const totalAccountedAmount = calculateManualAccountedTotal(accountabilities);
    const unaccountedAmount = existing.amount - totalAccountedAmount;

    const docRef = doc(this.db, MANUAL_REQUISITIONS_PATH, id);
    await updateDoc(docRef, {
      accountabilities,
      totalAccountedAmount,
      unaccountedAmount: Math.max(0, unaccountedAmount),
      accountabilityStatus: calculateManualAccountabilityStatus(
        existing.amount,
        totalAccountedAmount,
        existing.accountabilityDueDate
      ),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // ACTIVITY REPORT OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Save requisition-level activity report
   * This is the overall activity report for the entire requisition
   */
  async saveRequisitionActivityReport(
    requisitionId: string,
    reportData: ActivityReportFormData,
    userId: string,
    userName?: string
  ): Promise<void> {
    const existing = await this.getManualRequisition(requisitionId);
    if (!existing) {
      throw new Error('Manual requisition not found');
    }

    const activityReport: ActivityReport = {
      id: `ar-req-${Date.now()}`,
      level: 'requisition',
      title: reportData.title,
      description: reportData.description,
      workSection: reportData.workSection,
      documentUrl: reportData.documentUrl,
      documentName: reportData.documentName,
      documentType: reportData.documentType,
      documentSize: reportData.documentSize,
      photos: reportData.photos,
      submittedBy: userId,
      submittedByName: userName,
      submittedAt: Timestamp.now(),
      reviewStatus: 'pending',
    };

    // Add optional date fields only if they exist
    if (reportData.startDate) {
      activityReport.startDate = reportData.startDate;
    }
    if (reportData.endDate) {
      activityReport.endDate = reportData.endDate;
    }
    if (reportData.location) {
      activityReport.location = reportData.location;
    }

    const docRef = doc(this.db, MANUAL_REQUISITIONS_PATH, requisitionId);
    await updateDoc(docRef, {
      activityReport,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }

  /**
   * Save accountability-level activity report
   * This is specific to labour payments and professional services
   */
  async saveAccountabilityActivityReport(
    requisitionId: string,
    accountabilityId: string,
    reportData: ActivityReportFormData,
    userId: string,
    userName?: string
  ): Promise<void> {
    const existing = await this.getManualRequisition(requisitionId);
    if (!existing) {
      throw new Error('Manual requisition not found');
    }

    // Find the accountability entry
    const accountabilityIndex = existing.accountabilities.findIndex(
      acc => acc.id === accountabilityId
    );
    if (accountabilityIndex === -1) {
      throw new Error('Accountability entry not found');
    }

    const activityReport: ActivityReport = {
      id: `ar-acc-${Date.now()}`,
      level: 'accountability',
      title: reportData.title,
      description: reportData.description,
      workSection: reportData.workSection,
      documentUrl: reportData.documentUrl,
      documentName: reportData.documentName,
      documentType: reportData.documentType,
      documentSize: reportData.documentSize,
      photos: reportData.photos,
      submittedBy: userId,
      submittedByName: userName,
      submittedAt: Timestamp.now(),
      reviewStatus: 'pending',
    };

    // Add optional date fields only if they exist
    if (reportData.startDate) {
      activityReport.startDate = reportData.startDate;
    }
    if (reportData.endDate) {
      activityReport.endDate = reportData.endDate;
    }
    if (reportData.location) {
      activityReport.location = reportData.location;
    }

    // Update the accountability entry with the activity report
    const updatedAccountabilities = [...existing.accountabilities];
    updatedAccountabilities[accountabilityIndex] = {
      ...updatedAccountabilities[accountabilityIndex],
      activityReport,
    };

    const docRef = doc(this.db, MANUAL_REQUISITIONS_PATH, requisitionId);
    await updateDoc(docRef, {
      accountabilities: updatedAccountabilities,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // LINKING OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  async linkToProject(
    id: string,
    data: LinkToProjectData,
    userId: string
  ): Promise<void> {
    const existing = await this.getManualRequisition(id);
    if (!existing) {
      throw new Error('Manual requisition not found');
    }

    const docRef = doc(this.db, MANUAL_REQUISITIONS_PATH, id);
    // Build update object, only including defined fields to avoid Firestore errors
    const updateData: Record<string, any> = {
      linkStatus: 'linked',
      linkedProjectId: data.projectId,
      linkedProjectName: data.projectName,
      linkedProgramId: data.programId || '',
      linkedProgramName: data.programName || '',
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };
    // Only add linkingNotes if it has a value
    if (data.linkingNotes !== undefined && data.linkingNotes !== null) {
      updateData.linkingNotes = data.linkingNotes;
    }
    await updateDoc(docRef, updateData);

    // Also update the project to include this manual requisition in its list
    // This enables the project to show linked manual requisitions
    const projectDocRef = doc(this.db, `organizations/default/advisory_projects`, data.projectId);
    await updateDoc(projectDocRef, {
      manualRequisitionIds: arrayUnion(id),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }

  async linkToRequisition(
    id: string,
    data: LinkToRequisitionData,
    userId: string
  ): Promise<void> {
    const existing = await this.getManualRequisition(id);
    if (!existing) {
      throw new Error('Manual requisition not found');
    }

    if (existing.linkStatus === 'unlinked') {
      throw new Error('Manual requisition must be linked to a project first');
    }

    const docRef = doc(this.db, MANUAL_REQUISITIONS_PATH, id);
    await updateDoc(docRef, {
      linkStatus: 'reconciled',
      linkedRequisitionId: data.requisitionId,
      linkedRequisitionNumber: data.requisitionNumber,
      linkingNotes: data.linkingNotes || existing.linkingNotes,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }

  async unlinkFromProject(id: string, userId: string): Promise<void> {
    const existing = await this.getManualRequisition(id);
    if (!existing) {
      throw new Error('Manual requisition not found');
    }

    // Remove from project's manualRequisitionIds if it was linked
    if (existing.linkedProjectId) {
      const projectDocRef = doc(this.db, `organizations/default/advisory_projects`, existing.linkedProjectId);
      await updateDoc(projectDocRef, {
        manualRequisitionIds: arrayRemove(id),
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
    }

    const docRef = doc(this.db, MANUAL_REQUISITIONS_PATH, id);
    await updateDoc(docRef, {
      linkStatus: 'unlinked',
      linkedProjectId: null,
      linkedProjectName: null,
      linkedProgramId: null,
      linkedProgramName: null,
      linkedRequisitionId: null,
      linkedRequisitionNumber: null,
      linkingNotes: null,
      linkedSystemAccountabilityId: null,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // ADD-FIN-001 COMPLIANCE OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get manual requisitions by program ID
   */
  async getByProgram(programId: string): Promise<ManualRequisition[]> {
    const q = query(
      collection(this.db, MANUAL_REQUISITIONS_PATH),
      where('linkedProgramId', '==', programId),
      orderBy('requisitionDate', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ManualRequisition));
  }

  /**
   * Get manual requisitions requiring reconciliation
   */
  async getRequiringReconciliation(): Promise<ManualRequisition[]> {
    const all = await this.getAllManualRequisitions();
    return all.filter(r =>
      r.linkStatus === 'linked' &&
      r.accountabilityStatus === 'complete' &&
      (!r.reconciliationStatus || r.reconciliationStatus === 'pending' || r.reconciliationStatus === 'in_progress')
    );
  }

  /**
   * Get overdue manual requisitions
   */
  async getOverdueRequisitions(): Promise<ManualRequisition[]> {
    const all = await this.getAllManualRequisitions();
    return all.filter(r => r.accountabilityStatus === 'overdue');
  }

  /**
   * Update variance and compliance fields for a manual requisition
   */
  async updateComplianceStatus(
    id: string,
    userId: string
  ): Promise<void> {
    const existing = await this.getManualRequisition(id);
    if (!existing) {
      throw new Error('Manual requisition not found');
    }

    // Calculate variance
    const variance = calculateManualRequisitionVariance(existing);

    // Calculate reconciliation deadline if paid
    let reconciliationDeadline: Date | undefined;
    if (existing.paidDate) {
      reconciliationDeadline = calculateManualReconciliationDeadline(
        existing.paidDate instanceof Date ? existing.paidDate : existing.paidDate
      );
    }

    // Determine reconciliation status
    let reconciliationStatus: ReconciliationStatus = 'pending';
    if (existing.accountabilityStatus === 'complete' && variance.isZeroDiscrepancy) {
      reconciliationStatus = 'completed';
    } else if (existing.accountabilityStatus === 'partial') {
      reconciliationStatus = 'in_progress';
    }

    const docRef = doc(this.db, MANUAL_REQUISITIONS_PATH, id);
    await updateDoc(docRef, {
      variance,
      reconciliationStatus,
      reconciliationDeadline,
      requiresInvestigation: variance.requiresInvestigation,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }

  /**
   * Create system accountability record when manual requisition is linked to project
   * This enables the unified dashboard view
   */
  async createSystemAccountabilityOnLink(
    requisitionId: string,
    projectId: string,
    userId: string
  ): Promise<string> {
    const existing = await this.getManualRequisition(requisitionId);
    if (!existing) {
      throw new Error('Manual requisition not found');
    }

    // Calculate variance for the manual requisition
    const variance = calculateManualRequisitionVariance(existing);

    // Create accountability record in payments collection
    const accountabilityData = {
      paymentType: 'accountability',
      projectId,
      programId: existing.linkedProgramId,

      // Reference to manual requisition
      requisitionId: existing.id,
      requisitionNumber: existing.referenceNumber,
      requisitionAmount: existing.amount,

      // Mark as migrated from manual
      source: 'manual_migration',
      manualRequisitionId: existing.id,

      // Financial data
      currency: existing.currency,
      grossAmount: existing.amount,
      totalExpenses: existing.totalAccountedAmount,
      unspentReturned: 0,
      balanceDue: 0,

      // Status
      status: existing.accountabilityStatus === 'complete' ? 'verified' : 'pending',
      accountabilityStatus: existing.accountabilityStatus,

      // ADD-FIN-001 Compliance
      variance,
      isZeroDiscrepancy: variance.isZeroDiscrepancy,
      reconciliationStatus: variance.isZeroDiscrepancy ? 'completed' : 'pending',
      requiresInvestigation: variance.requiresInvestigation,

      // Expenses from manual accountability entries
      expenses: existing.accountabilities.map((acc, index) => ({
        id: acc.id,
        lineNumber: index + 1,
        date: acc.date,
        description: acc.description,
        category: acc.category,
        vendor: acc.vendor,
        amount: acc.amount,
        receiptNumber: acc.receiptNumber,
        invoiceNumber: acc.invoiceNumber,
        documents: acc.documents,
        status: 'pending',
        isZeroDiscrepancy: false,
      })),

      // Receipts summary
      receiptsSummary: {
        totalReceipts: existing.accountabilities.length,
        verifiedReceipts: 0,
        pendingReceipts: existing.accountabilities.length,
        rejectedReceipts: 0,
        totalVerifiedAmount: 0,
      },

      // Audit
      createdAt: Timestamp.now(),
      createdBy: userId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    // Add to payments collection
    const docRef = await addDoc(collection(this.db, 'payments'), accountabilityData);

    // Update manual requisition with link to system accountability
    const manualDocRef = doc(this.db, MANUAL_REQUISITIONS_PATH, requisitionId);
    await updateDoc(manualDocRef, {
      linkedSystemAccountabilityId: docRef.id,
      variance,
      reconciliationStatus: variance.isZeroDiscrepancy ? 'completed' : 'pending',
      requiresInvestigation: variance.requiresInvestigation,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    return docRef.id;
  }

  // ─────────────────────────────────────────────────────────────────
  // RECEIPT SEQUENCE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get next receipt number with atomic increment
   * Uses Firestore transactions to ensure uniqueness
   * Format: #Receipt-{YYYY}-{NNN}
   */
  async getNextReceiptNumber(
    projectCode: string,
    prefix: string = 'Receipt',
    requisitionYear?: number
  ): Promise<string> {
    // Use the requisition year if provided, otherwise fall back to current year
    const year = requisitionYear || new Date().getFullYear();
    const sequenceId = `${projectCode}-${year}`;
    const sequenceRef = doc(this.db, RECEIPT_SEQUENCES_PATH, sequenceId);

    return runTransaction(this.db, async (transaction) => {
      const sequenceDoc = await transaction.get(sequenceRef);

      let nextNumber = 1;

      if (sequenceDoc.exists()) {
        nextNumber = (sequenceDoc.data().lastNumber || 0) + 1;
        transaction.update(sequenceRef, {
          lastNumber: nextNumber,
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.set(sequenceRef, {
          id: sequenceId,
          year,
          lastNumber: nextNumber,
          prefix,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      return generateReceiptNumber(year, nextNumber, prefix);
    });
  }

  /**
   * Get current receipt sequence info for a project
   */
  async getReceiptSequence(projectCode: string): Promise<{
    year: number;
    lastNumber: number;
    prefix: string;
  } | null> {
    const year = new Date().getFullYear();
    const sequenceId = `${projectCode}-${year}`;
    const sequenceRef = doc(this.db, RECEIPT_SEQUENCES_PATH, sequenceId);
    const sequenceDoc = await getDoc(sequenceRef);

    if (!sequenceDoc.exists()) {
      return null;
    }

    const data = sequenceDoc.data();
    return {
      year: data.year,
      lastNumber: data.lastNumber,
      prefix: data.prefix,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // FUNDS ACKNOWLEDGEMENT OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Save a Funds Acknowledgement document with PDF upload
   * If an existing acknowledgement exists, it will be replaced (old PDF deleted)
   */
  async saveFundsAcknowledgement(
    requisitionId: string,
    acknowledgement: Omit<FundsAcknowledgementDocument, 'id' | 'generatedAt'>,
    userId: string,
    userName?: string,
    pdfBlob?: Blob
  ): Promise<string> {
    // Check if there's an existing acknowledgement to replace
    const existingAck = await this.getFundsAcknowledgementByRequisition(requisitionId);
    const existingAckId = existingAck?.id;

    // Get the next receipt number if not already assigned
    let receiptNumber = acknowledgement.receiptNumber;
    if (!receiptNumber || receiptNumber.includes('XXX') || receiptNumber.includes('PREVIEW') || receiptNumber.includes('DRAFT')) {
      // Extract year from the funds transfer date (use requisition year, not current year)
      let requisitionYear: number | undefined;
      if (acknowledgement.dateOfFundsTransfer) {
        const transferDate = acknowledgement.dateOfFundsTransfer instanceof Date
          ? acknowledgement.dateOfFundsTransfer
          : (acknowledgement.dateOfFundsTransfer as any).toDate?.()
            || new Date(acknowledgement.dateOfFundsTransfer as any);
        requisitionYear = transferDate.getFullYear();
      }
      receiptNumber = await this.getNextReceiptNumber(acknowledgement.projectCode, 'Receipt', requisitionYear);
    }

    // Generate storage path for PDF - using projects path which has broader permissions
    const storagePath = `projects/funds-acknowledgements/${requisitionId}/${acknowledgement.fileName}`;
    let documentUrl: string | undefined;
    let documentStoragePath: string | undefined;

    // Upload PDF to storage if provided
    if (pdfBlob) {
      // Skip client-side deletion of prior PDFs.
      // Storage rules can deny deletes for legacy files, causing noisy 403 errors
      // in browser console even though acknowledgement save succeeds.

      // Upload new PDF with explicit content type for storage rules
      const uploadResult = await uploadFile(storagePath, pdfBlob, 'application/pdf');
      documentUrl = uploadResult.url;
      documentStoragePath = storagePath;
    }

    // Defensive: callers may still pass id/generatedAt at runtime despite Omit<...> typing.
    // Never persist those into Firestore document fields because they can shadow real doc IDs.
    const { id: _ignoredId, generatedAt: _ignoredGeneratedAt, ...acknowledgementData } = acknowledgement as any;
    void _ignoredId;
    void _ignoredGeneratedAt;

    const fundsAckDoc = {
      ...acknowledgementData,
      receiptNumber,
      linkedRequisitionId: requisitionId,
      documentUrl,
      documentStoragePath,
      generatedAt: serverTimestamp(),
      generatedBy: userId,
      generatedByName: userName,
    };

    // Remove undefined fields
    const cleanedDoc = removeUndefinedDeep(fundsAckDoc);

    let docId: string;

    if (existingAck && existingAckId) {
      // Update existing document instead of creating new one
      const existingDocRef = doc(this.db, FUNDS_ACKNOWLEDGEMENTS_PATH, existingAckId);
      await updateDoc(existingDocRef, cleanedDoc);
      docId = existingAckId;
    } else {
      // Save to funds_acknowledgements collection
      const docRef = await addDoc(collection(this.db, FUNDS_ACKNOWLEDGEMENTS_PATH), cleanedDoc);
      docId = docRef.id;
    }

    // Update the manual requisition with reference to this acknowledgement
    const requisitionRef = doc(this.db, MANUAL_REQUISITIONS_PATH, requisitionId);
    await updateDoc(requisitionRef, {
      fundsAcknowledgementId: docId,
      fundsAcknowledgementReceiptNumber: receiptNumber,
      fundsAcknowledgementDocumentUrl: documentUrl,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    return docId;
  }

  /**
   * Get Funds Acknowledgement by ID
   */
  async getFundsAcknowledgement(id: string): Promise<FundsAcknowledgementDocument | null> {
    const docRef = doc(this.db, FUNDS_ACKNOWLEDGEMENTS_PATH, id);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      return null;
    }

    return { ...snapshot.data(), id: snapshot.id } as FundsAcknowledgementDocument;
  }

  /**
   * Get Funds Acknowledgement by requisition ID
   */
  async getFundsAcknowledgementByRequisition(
    requisitionId: string
  ): Promise<FundsAcknowledgementDocument | null> {
    const q = query(
      collection(this.db, FUNDS_ACKNOWLEDGEMENTS_PATH),
      where('linkedRequisitionId', '==', requisitionId),
      limit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }

    const record = snapshot.docs[0];
    return { ...record.data(), id: record.id } as FundsAcknowledgementDocument;
  }

  /**
   * Get all Funds Acknowledgements for a project
   */
  async getFundsAcknowledgementsByProject(
    projectId: string
  ): Promise<FundsAcknowledgementDocument[]> {
    const q = query(
      collection(this.db, FUNDS_ACKNOWLEDGEMENTS_PATH),
      where('projectId', '==', projectId),
      orderBy('generatedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((record) => ({ ...record.data(), id: record.id } as FundsAcknowledgementDocument));
  }

  // ─────────────────────────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────────────────────────

  async deleteManualRequisition(id: string): Promise<void> {
    const docRef = doc(this.db, MANUAL_REQUISITIONS_PATH, id);
    await deleteDoc(docRef);
  }

  // ─────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────

  async getBacklogSummary(): Promise<{
    total: number;
    unlinked: number;
    linked: number;
    reconciled: number;
    totalAmount: number;
    totalAccountedAmount: number;
    totalUnaccountedAmount: number;
    overdueCount: number;
  }> {
    const all = await this.getAllManualRequisitions();

    return {
      total: all.length,
      unlinked: all.filter(r => r.linkStatus === 'unlinked').length,
      linked: all.filter(r => r.linkStatus === 'linked').length,
      reconciled: all.filter(r => r.linkStatus === 'reconciled').length,
      totalAmount: all.reduce((sum, r) => sum + r.amount, 0),
      totalAccountedAmount: all.reduce((sum, r) => sum + r.totalAccountedAmount, 0),
      totalUnaccountedAmount: all.reduce((sum, r) => sum + r.unaccountedAmount, 0),
      overdueCount: all.filter(r => r.accountabilityStatus === 'overdue').length,
    };
  }
}

// Export singleton factory
export function getManualRequisitionService(db: Firestore): ManualRequisitionService {
  return ManualRequisitionService.getInstance(db);
}
