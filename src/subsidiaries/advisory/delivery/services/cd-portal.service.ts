/**
 * CD PORTAL SERVICE
 *
 * Service for the Country Director Portal - a public-facing dashboard
 * accessed via token-based URLs without authentication.
 */

import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  addDoc,
  deleteDoc,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { signInAnonymouslyForPortal } from '../../../../core/services/firebase/auth';
import {
  PortalAccessToken,
  PortalSession,
  PortalRequisitionDetail,
  PortalAccountabilityEntry,
  CountryDirectorSummary,
  ComplianceAlert,
  UnifiedAgingAnalysis,
  ComplianceScore,
  createDefaultAgingBuckets,
  calculateOverallComplianceScore,
  calculateAlertSeverity,
} from '../types/country-director-dashboard';
import { ManualRequisition, ManualAccountabilityEntry } from '../types/manual-requisition';

// ─────────────────────────────────────────────────────────────────
// SINGLETON SERVICE
// ─────────────────────────────────────────────────────────────────

let portalServiceInstance: CDPortalService | null = null;

export function getCDPortalService(db: Firestore): CDPortalService {
  if (!portalServiceInstance) {
    portalServiceInstance = new CDPortalService(db);
  }
  return portalServiceInstance;
}

// ─────────────────────────────────────────────────────────────────
// PORTAL SERVICE
// ─────────────────────────────────────────────────────────────────

export class CDPortalService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  // ─────────────────────────────────────────────────────────────────
  // TOKEN VALIDATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Validate a portal access token and return session data
   */
  async validateToken(token: string): Promise<PortalSession | null> {
    // Sign in anonymously to satisfy Firestore auth requirements
    // This happens silently in the background - no user interaction needed
    try {
      await signInAnonymouslyForPortal();
    } catch (authError) {
      console.error('Anonymous sign-in failed:', authError);
      throw new Error(
        'Portal authentication failed. Anonymous sign-in may not be enabled in Firebase Console. ' +
        'Please enable Anonymous authentication in Firebase Console > Authentication > Sign-in method.'
      );
    }

    try {
      // Query for token
      const tokensRef = collection(this.db, 'portal_access_tokens');
      const q = query(
        tokensRef,
        where('token', '==', token),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return null;
      }

      const tokenDoc = snapshot.docs[0];
      const tokenData = tokenDoc.data() as PortalAccessToken;

      // Check expiration
      if (tokenData.expiresAt) {
        const expiresAt = tokenData.expiresAt instanceof Timestamp
          ? tokenData.expiresAt.toDate()
          : tokenData.expiresAt;
        if (expiresAt < new Date()) {
          return null;
        }
      }

      // Update access tracking
      await updateDoc(doc(this.db, 'portal_access_tokens', tokenDoc.id), {
        lastAccessedAt: Timestamp.now(),
        accessCount: increment(1),
      });

      return {
        programId: tokenData.programId,
        programName: tokenData.programName,
        tokenId: tokenDoc.id,
        isValid: true,
        expiresAt: tokenData.expiresAt instanceof Timestamp
          ? tokenData.expiresAt.toDate()
          : tokenData.expiresAt,
      };
    } catch (error) {
      console.error('Error validating portal token:', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // TOKEN MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Generate a secure random token string
   */
  private generateTokenString(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = 32;
    let token = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      token += chars[array[i] % chars.length];
    }
    return token;
  }

  /**
   * Create a new portal access token for a program
   */
  async createToken(
    programId: string,
    programName: string,
    createdBy: string,
    options?: {
      label?: string;
      expiresInDays?: number;
    }
  ): Promise<{ token: string; tokenId: string; portalUrl: string }> {
    const tokenString = this.generateTokenString();

    const tokenData: Omit<PortalAccessToken, 'id'> = {
      token: tokenString,
      programId,
      programName,
      label: options?.label || `Portal for ${programName}`,
      createdAt: Timestamp.now(),
      createdBy,
      isActive: true,
      accessCount: 0,
    };

    // Add expiration if specified
    if (options?.expiresInDays) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + options.expiresInDays);
      tokenData.expiresAt = Timestamp.fromDate(expiresAt);
    }

    const docRef = await addDoc(collection(this.db, 'portal_access_tokens'), tokenData);

    // Generate portal URL (relative, will be combined with base URL on client)
    const portalUrl = `/cd-portal?token=${tokenString}`;

    return {
      token: tokenString,
      tokenId: docRef.id,
      portalUrl,
    };
  }

  /**
   * Get all tokens for a program
   */
  async getTokensForProgram(programId: string): Promise<PortalAccessToken[]> {
    const tokensRef = collection(this.db, 'portal_access_tokens');
    const q = query(
      tokensRef,
      where('programId', '==', programId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as PortalAccessToken[];
  }

  /**
   * Deactivate a token (soft delete)
   */
  async deactivateToken(tokenId: string): Promise<void> {
    await updateDoc(doc(this.db, 'portal_access_tokens', tokenId), {
      isActive: false,
    });
  }

  /**
   * Permanently delete a token
   */
  async deleteToken(tokenId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'portal_access_tokens', tokenId));
  }

  /**
   * Reactivate a deactivated token
   */
  async reactivateToken(tokenId: string): Promise<void> {
    await updateDoc(doc(this.db, 'portal_access_tokens', tokenId), {
      isActive: true,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // PORTAL DATA FETCHING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get summary metrics for the portal
   */
  async getPortalSummary(programId: string): Promise<CountryDirectorSummary> {
    const requisitions = await this.getManualRequisitions(programId);

    const summary: CountryDirectorSummary = {
      totalRequisitions: requisitions.length,
      systemRequisitions: 0, // Portal focuses on manual requisitions
      manualRequisitions: requisitions.length,
      totalDisbursed: 0,
      totalAccounted: 0,
      totalUnaccounted: 0,
      pendingCount: 0,
      partialCount: 0,
      completeCount: 0,
      overdueCount: 0,
      complianceRate: 0,
      varianceSummary: { compliant: 0, minor: 0, moderate: 0, severe: 0 },
      activeInvestigations: 0,
      overdueInvestigations: 0,
      pendingReconciliations: 0,
      agingByBucket: createDefaultAgingBuckets(),
    };

    let compliantCount = 0;

    for (const req of requisitions) {
      summary.totalDisbursed += req.amount;
      summary.totalAccounted += req.totalAccountedAmount;
      summary.totalUnaccounted += req.unaccountedAmount;

      // Status counts
      switch (req.accountabilityStatus) {
        case 'pending':
          summary.pendingCount++;
          break;
        case 'partial':
          summary.partialCount++;
          break;
        case 'complete':
          summary.completeCount++;
          break;
        case 'overdue':
          summary.overdueCount++;
          break;
      }

      // Variance tracking
      if (req.variance) {
        switch (req.variance.varianceStatus) {
          case 'compliant':
            summary.varianceSummary.compliant++;
            compliantCount++;
            break;
          case 'minor':
            summary.varianceSummary.minor++;
            break;
          case 'moderate':
            summary.varianceSummary.moderate++;
            break;
          case 'severe':
            summary.varianceSummary.severe++;
            break;
        }
      }

      // Investigation tracking
      if (req.requiresInvestigation) {
        summary.activeInvestigations++;
        if (req.variance?.investigationDeadline && new Date() > req.variance.investigationDeadline) {
          summary.overdueInvestigations++;
        }
      }

      // Reconciliation tracking
      if (req.reconciliationStatus === 'pending' || req.reconciliationStatus === 'in_progress') {
        summary.pendingReconciliations++;
      }

      // Aging buckets
      const daysSincePaid = req.paidDate
        ? Math.floor((new Date().getTime() - this.toDate(req.paidDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      if (req.accountabilityStatus !== 'complete') {
        for (const bucket of summary.agingByBucket) {
          if (daysSincePaid >= bucket.minDays && daysSincePaid <= bucket.maxDays) {
            bucket.count++;
            bucket.amount += req.unaccountedAmount;
            bucket.manualCount++;
            bucket.manualAmount += req.unaccountedAmount;
            break;
          }
        }
      }
    }

    // Calculate compliance rate
    if (requisitions.length > 0) {
      summary.complianceRate = (compliantCount / requisitions.length) * 100;
    }

    return summary;
  }

  /**
   * Get action items requiring attention
   */
  async getActionItems(programId: string): Promise<ComplianceAlert[]> {
    const requisitions = await this.getManualRequisitions(programId);
    const alerts: ComplianceAlert[] = [];

    for (const req of requisitions) {
      // Overdue accountabilities
      if (req.accountabilityStatus === 'overdue') {
        const dueDate = req.accountabilityDueDate ? this.toDate(req.accountabilityDueDate) : null;
        const daysOverdue = dueDate
          ? Math.floor((new Date().getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        alerts.push({
          id: `overdue-${req.id}`,
          type: 'overdue_accountability',
          severity: calculateAlertSeverity('overdue_accountability', daysOverdue),
          entityId: req.id,
          entityType: 'manual_requisition',
          message: `Accountability overdue by ${daysOverdue} days`,
          actionRequired: 'Submit accountability documents',
          deadline: dueDate || undefined,
          projectName: req.linkedProjectName,
          programName: req.linkedProgramName,
          amount: req.unaccountedAmount,
          createdAt: new Date(),
        });
      }

      // Severe variances
      if (req.variance?.varianceStatus === 'severe') {
        alerts.push({
          id: `severe-${req.id}`,
          type: 'severe_variance',
          severity: 'critical',
          entityId: req.id,
          entityType: 'manual_requisition',
          message: `Severe variance of ${req.variance.variancePercentage.toFixed(1)}%`,
          actionRequired: 'Investigation required within 48 hours',
          deadline: req.variance.investigationDeadline,
          projectName: req.linkedProjectName,
          programName: req.linkedProgramName,
          amount: Math.abs(req.variance.varianceAmount),
          createdAt: new Date(),
        });
      }

      // Overdue investigations
      if (req.variance?.investigationDeadline && req.variance.investigationStatus === 'pending') {
        if (new Date() > req.variance.investigationDeadline) {
          alerts.push({
            id: `inv-overdue-${req.id}`,
            type: 'overdue_investigation',
            severity: 'critical',
            entityId: req.id,
            entityType: 'manual_requisition',
            message: 'Investigation deadline passed',
            actionRequired: 'Complete variance investigation immediately',
            deadline: req.variance.investigationDeadline,
            projectName: req.linkedProjectName,
            programName: req.linkedProgramName,
            amount: Math.abs(req.variance.varianceAmount),
            createdAt: new Date(),
          });
        }
      }

      // Overdue reconciliation
      if (req.reconciliationDeadline && req.reconciliationStatus !== 'completed') {
        const deadline = this.toDate(req.reconciliationDeadline);
        if (new Date() > deadline) {
          const daysOverdue = Math.floor((new Date().getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
          alerts.push({
            id: `recon-${req.id}`,
            type: 'overdue_reconciliation',
            severity: calculateAlertSeverity('overdue_reconciliation', daysOverdue),
            entityId: req.id,
            entityType: 'manual_requisition',
            message: `Reconciliation overdue by ${daysOverdue} days`,
            actionRequired: 'Complete reconciliation',
            deadline: deadline,
            projectName: req.linkedProjectName,
            programName: req.linkedProgramName,
            amount: req.amount,
            createdAt: new Date(),
          });
        }
      }
    }

    // Sort by severity (critical first) then by deadline
    return alerts.sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === 'critical' ? -1 : 1;
      }
      if (a.deadline && b.deadline) {
        return a.deadline.getTime() - b.deadline.getTime();
      }
      return 0;
    });
  }

  /**
   * Get all requisitions with details for the portal
   */
  async getPortalRequisitions(programId: string): Promise<PortalRequisitionDetail[]> {
    const requisitions = await this.getManualRequisitions(programId);

    // Fetch funds acknowledgement documents for requisitions that have them
    const requisitionIds = requisitions
      .filter((req) => req.fundsAcknowledgementId)
      .map((req) => req.fundsAcknowledgementId!);

    // Build a map of fundsAcknowledgementId -> documentUrl
    const fundsAckUrlMap = new Map<string, string>();
    if (requisitionIds.length > 0) {
      // Fetch funds acknowledgement documents in batches (Firestore limit is 30 for 'in' queries)
      const batchSize = 30;
      for (let i = 0; i < requisitionIds.length; i += batchSize) {
        const batch = requisitionIds.slice(i, i + batchSize);
        // We need to fetch by document ID, so use getDoc for each
        await Promise.all(
          batch.map(async (id) => {
            try {
              const docRef = doc(this.db, 'funds_acknowledgements', id);
              const snapshot = await getDoc(docRef);
              if (snapshot.exists()) {
                const data = snapshot.data();
                if (data.documentUrl) {
                  fundsAckUrlMap.set(id, data.documentUrl);
                }
              }
            } catch (error) {
              console.error(`[CD Portal] Error fetching funds acknowledgement ${id}:`, error);
            }
          })
        );
      }
    }

    return requisitions.map((req) => {
      const detail = this.mapToPortalDetail(req);
      // Override acknowledgementDocumentUrl with funds acknowledgement document URL if available
      if (req.fundsAcknowledgementId && fundsAckUrlMap.has(req.fundsAcknowledgementId)) {
        detail.acknowledgementDocumentUrl = fundsAckUrlMap.get(req.fundsAcknowledgementId);
      }
      return detail;
    });
  }

  /**
   * Get a single requisition with full details
   */
  async getPortalRequisitionDetail(
    programId: string,
    requisitionId: string
  ): Promise<PortalRequisitionDetail | null> {
    try {
      const docRef = doc(this.db, 'manual_requisitions', requisitionId);
      const snapshot = await getDoc(docRef);

      if (!snapshot.exists()) {
        return null;
      }

      const req = { id: snapshot.id, ...snapshot.data() } as ManualRequisition;

      // Verify it belongs to the program
      if (req.linkedProgramId !== programId) {
        return null;
      }

      return this.mapToPortalDetail(req);
    } catch (error) {
      console.error('Error fetching requisition detail:', error);
      return null;
    }
  }

  /**
   * Get compliance score for the portal
   */
  async getComplianceScore(programId: string): Promise<ComplianceScore> {
    const requisitions = await this.getManualRequisitions(programId);

    const completed = requisitions.filter((r) => r.accountabilityStatus === 'complete');
    const withVariance = requisitions.filter((r) => r.variance);

    const breakdown = {
      zeroDiscrepancyRate:
        withVariance.length > 0
          ? (withVariance.filter((r) => r.variance?.varianceStatus === 'compliant').length /
              withVariance.length) *
            100
          : 100,
      onTimeReconciliationRate:
        completed.length > 0
          ? (completed.filter((r) => r.reconciliationStatus === 'completed').length /
              completed.length) *
            100
          : 100,
      proofOfSpendCompleteness:
        requisitions.length > 0
          ? (requisitions.filter((r) => r.accountabilities.length > 0).length /
              requisitions.length) *
            100
          : 100,
      investigationResolutionRate: 100, // Assume 100% if no investigations
    };

    const investigationsRequired = requisitions.filter((r) => r.requiresInvestigation);
    if (investigationsRequired.length > 0) {
      const resolved = investigationsRequired.filter(
        (r) => r.variance?.investigationStatus === 'completed'
      );
      breakdown.investigationResolutionRate =
        (resolved.length / investigationsRequired.length) * 100;
    }

    return {
      overallScore: calculateOverallComplianceScore(breakdown),
      breakdown,
      trend: 'stable',
      lastUpdated: new Date(),
    };
  }

  /**
   * Get aging analysis for the portal
   */
  async getAgingAnalysis(programId: string): Promise<UnifiedAgingAnalysis> {
    const requisitions = await this.getManualRequisitions(programId);
    const buckets = createDefaultAgingBuckets();

    let totalCount = 0;
    let totalAmount = 0;

    for (const req of requisitions) {
      if (req.accountabilityStatus === 'complete') continue;

      const daysSincePaid = req.paidDate
        ? Math.floor(
            (new Date().getTime() - this.toDate(req.paidDate).getTime()) / (1000 * 60 * 60 * 24)
          )
        : 0;

      for (const bucket of buckets) {
        if (daysSincePaid >= bucket.minDays && daysSincePaid <= bucket.maxDays) {
          bucket.count++;
          bucket.amount += req.unaccountedAmount;
          bucket.manualCount++;
          bucket.manualAmount += req.unaccountedAmount;
          totalCount++;
          totalAmount += req.unaccountedAmount;
          break;
        }
      }
    }

    return {
      buckets,
      totalPending: { count: totalCount, amount: totalAmount },
      manualTotal: { count: totalCount, amount: totalAmount },
      systemTotal: { count: 0, amount: 0 },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────

  private async getManualRequisitions(programId: string): Promise<ManualRequisition[]> {
    const requisitionsRef = collection(this.db, 'manual_requisitions');

    console.log(`[CD Portal] Fetching requisitions for program ${programId}`);

    try {
      // Get current program details to get its code for matching
      const currentProgramRef = doc(this.db, 'organizations/default/advisory_programs', programId);
      const currentProgramDoc = await getDoc(currentProgramRef);
      const currentProgramCode = currentProgramDoc.exists() ? currentProgramDoc.data().code : null;
      console.log(`[CD Portal] Current program code: ${currentProgramCode || 'N/A'}`);

      // Also check old programs collection for migration purposes
      // Build a map of program codes to IDs from both old and new locations
      const oldProgramsRef = collection(this.db, 'programs');
      const oldProgramsSnapshot = await getDocs(oldProgramsRef);
      const oldProgramIdsByCode = new Map<string, string>();
      oldProgramsSnapshot.docs.forEach((doc) => {
        const code = doc.data().code;
        if (code) {
          oldProgramIdsByCode.set(code, doc.id);
        }
      });
      console.log(`[CD Portal] Found ${oldProgramIdsByCode.size} programs in old location`);

      // Get the corresponding old program ID if it exists (for matching requisitions linked to old IDs)
      const matchingOldProgramId = currentProgramCode ? oldProgramIdsByCode.get(currentProgramCode) : null;
      console.log(`[CD Portal] Matching old program ID: ${matchingOldProgramId || 'N/A'}`);

      // Step 1: Get all projects for this program to build a lookup
      const projectsRef = collection(this.db, 'organizations/default/advisory_projects');

      // Get ALL projects to check their programId associations
      const allProjectsQuery = query(projectsRef);
      const allProjectsSnapshot = await getDocs(allProjectsQuery);
      console.log(`[CD Portal] Total projects in system: ${allProjectsSnapshot.docs.length}`);

      // Build set of project IDs that belong to this program
      // Include projects linked to either the new ID or the matching old ID
      const programProjectIds = new Set<string>();
      const projectIdToData = new Map<string, any>();

      for (const projectDoc of allProjectsSnapshot.docs) {
        const data = projectDoc.data();
        projectIdToData.set(projectDoc.id, data);

        // Check if project belongs to this program (new ID or matching old ID)
        if (data.programId === programId) {
          programProjectIds.add(projectDoc.id);
        } else if (matchingOldProgramId && data.programId === matchingOldProgramId) {
          programProjectIds.add(projectDoc.id);
          console.log(`[CD Portal] Project ${data.name} matched via old program ID`);
        }
      }
      console.log(`[CD Portal] Found ${programProjectIds.size} projects for program ${programId}`);

      // Step 2: Fetch ALL linked requisitions
      const allLinkedQuery = query(
        requisitionsRef,
        where('linkStatus', '==', 'linked'),
        orderBy('requisitionDate', 'desc')
      );
      const allLinkedSnapshot = await getDocs(allLinkedQuery);
      console.log(`[CD Portal] Total linked requisitions in system: ${allLinkedSnapshot.docs.length}`);

      // Step 3: Filter to only those that belong to this program
      // A requisition belongs to the program if:
      // - linkedProgramId matches the new program ID, OR
      // - linkedProgramId matches the old program ID (if migrating), OR
      // - linkedProjectId is in the program's projects
      const filteredRequisitions = allLinkedSnapshot.docs
        .filter((docSnap) => {
          const data = docSnap.data();

          // Check direct program link (new ID)
          if (data.linkedProgramId === programId) {
            return true;
          }

          // Check direct program link (old ID - for migration compatibility)
          if (matchingOldProgramId && data.linkedProgramId === matchingOldProgramId) {
            console.log(`[CD Portal] Requisition ${data.referenceNumber} matched via old program ID`);
            return true;
          }

          // Check if linked project belongs to program
          if (data.linkedProjectId && programProjectIds.has(data.linkedProjectId)) {
            return true;
          }

          return false;
        })
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as ManualRequisition[];

      console.log(`[CD Portal] Found ${filteredRequisitions.length} requisitions for this program`);

      return filteredRequisitions;
    } catch (error) {
      console.error('[CD Portal] Error fetching requisitions:', error);
      return [];
    }
  }

  private mapToPortalDetail(req: ManualRequisition): PortalRequisitionDetail {
    return {
      id: req.id,
      source: 'manual',
      referenceNumber: req.referenceNumber,
      description: req.description,
      amount: req.amount,
      currency: req.currency,
      accountabilityStatus: req.accountabilityStatus,
      totalAccountedAmount: req.totalAccountedAmount,
      unaccountedAmount: req.unaccountedAmount,
      accountabilityDueDate: req.accountabilityDueDate
        ? this.toDate(req.accountabilityDueDate)
        : undefined,
      varianceStatus: req.variance?.varianceStatus,
      varianceAmount: req.variance?.varianceAmount,
      variancePercentage: req.variance?.variancePercentage,
      hasActiveInvestigation: req.requiresInvestigation,
      reconciliationStatus: req.reconciliationStatus,
      projectId: req.linkedProjectId,
      projectName: req.linkedProjectName,
      programId: req.linkedProgramId,
      programName: req.linkedProgramName,
      requisitionDate: this.toDate(req.requisitionDate),
      paidDate: req.paidDate ? this.toDate(req.paidDate) : undefined,
      purpose: req.purpose,
      advanceType: req.advanceType,
      accountabilities: req.accountabilities.map((acc) => this.mapAccountabilityEntry(acc)),
      acknowledgementDocumentUrl: req.acknowledgement?.documentUrl,
      activityReportUrl: req.activityReport?.documentUrl,
      notes: req.notes,
    };
  }

  private mapAccountabilityEntry(entry: ManualAccountabilityEntry): PortalAccountabilityEntry {
    return {
      id: entry.id,
      date: entry.date instanceof Date ? entry.date : new Date(),
      description: entry.description,
      category: entry.category,
      vendor: entry.vendor,
      amount: entry.amount,
      receiptNumber: entry.receiptNumber,
      invoiceNumber: entry.invoiceNumber,
      documents: entry.documents.map((doc) => ({
        id: doc.id || '',
        name: doc.fileName,
        url: doc.fileUrl,
        type: doc.mimeType || 'application/octet-stream',
        size: doc.fileSize,
        uploadedAt: doc.uploadedAt instanceof Date ? doc.uploadedAt : new Date(),
        category: this.inferDocumentCategory(doc.fileName),
      })),
      activityReportUrl: entry.activityReport?.documentUrl,
      paymentMethod: entry.paymentMethod,
      contractOrPONumber: entry.contractOrPONumber,
      contractOrPODocument: entry.contractOrPODocument ? {
        id: entry.contractOrPODocument.id || '',
        name: entry.contractOrPODocument.fileName,
        url: entry.contractOrPODocument.fileUrl,
        type: entry.contractOrPODocument.mimeType || 'application/octet-stream',
        size: entry.contractOrPODocument.fileSize,
        uploadedAt: entry.contractOrPODocument.uploadedAt instanceof Date ? entry.contractOrPODocument.uploadedAt : new Date(),
        category: 'other',
      } : undefined,
    };
  }

  private inferDocumentCategory(
    filename: string
  ): 'receipt' | 'invoice' | 'activity_report' | 'photo' | 'other' {
    const lower = filename.toLowerCase();
    if (lower.includes('receipt')) return 'receipt';
    if (lower.includes('invoice')) return 'invoice';
    if (lower.includes('activity') || lower.includes('report')) return 'activity_report';
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(lower)) return 'photo';
    return 'other';
  }

  private toDate(value: Date | Timestamp): Date {
    if (value instanceof Date) return value;
    return value.toDate();
  }
}
