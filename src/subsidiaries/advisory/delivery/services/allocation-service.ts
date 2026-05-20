/**
 * ALLOCATION SERVICE
 *
 * Multi-project allocation: splits a single purchase across 2–5 projects.
 * Creates one accountability entry per project, linked by an AllocationGroup.
 *
 * Uses Firestore batch writes for atomicity — either all entries are created
 * or none are.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  Firestore,
  writeBatch,
  runTransaction,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import type {
  AllocationGroup,
  AllocationEntry,
  AllocationMethod,
  AllocationSuggestion,
  CaptureLineItem,
  MatrixAllocationEntry,
} from '../types/allocation';
import type { AccountabilityExpense } from '../types/accountability';

// ─────────────────────────────────────────────────────────────────
// COLLECTION PATHS
// ─────────────────────────────────────────────────────────────────

const PAYMENTS_PATH = 'payments';

function allocationGroupsPath(orgId: string) {
  return `organizations/${orgId}/allocation_groups`;
}

function allocationSequencePath(orgId: string) {
  return `organizations/${orgId}/allocation_sequences`;
}

// ─────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────

export interface CreateAllocationInput {
  date: Date;
  vendorName: string;
  description: string;
  totalAmount: number;
  currency: 'UGX' | 'USD';
  allocationMethod: AllocationMethod;
  rationale: string;
  sourceDocumentUrls: string[];
  allocations: {
    projectId: string;
    projectName: string;
    programId: string;
    budgetCategory: string;
    percentage: number;
    allocatedAmount: number;
    requisitionId?: string | null;
  }[];
  /** Line items from receipt (matrix mode only) */
  lineItems?: CaptureLineItem[];
  /** Per-line-item per-project detail (matrix mode only) */
  matrixAllocations?: MatrixAllocationEntry[];
}

export class AllocationService {
  private static instance: AllocationService;
  private db: Firestore;

  private constructor(db: Firestore) {
    this.db = db;
  }

  static getInstance(db: Firestore): AllocationService {
    if (!AllocationService.instance) {
      AllocationService.instance = new AllocationService(db);
    }
    return AllocationService.instance;
  }

  // ─────────────────────────────────────────────────────────────────
  // CREATE ALLOCATION GROUP
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create an allocation group with accountability entries across multiple projects.
   * Uses a Firestore batch write for atomicity.
   *
   * For each allocation entry:
   * 1. Creates an accountability record in `payments` with the allocated amount
   * 2. Sets `allocationGroupId` on the accountability record
   * 3. Links the allocation entry to the accountability ID
   *
   * Returns the allocation group ID.
   */
  async createAllocationGroup(
    data: CreateAllocationInput,
    userId: string,
    orgId: string
  ): Promise<string> {
    // 1. Generate group number atomically
    const groupNumber = await this.generateGroupNumber(orgId);

    const now = Timestamp.now();
    const batch = writeBatch(this.db);

    const uniqueReqIds = [
      ...new Set(
        data.allocations.map((a) => a.requisitionId).filter(Boolean)
      ),
    ] as string[];

    const requisitionMeta = new Map<
      string,
      { requisitionNumber: string; grossAmount: number }
    >();
    await Promise.all(
      uniqueReqIds.map(async (rid) => {
        const snap = await getDoc(doc(this.db, PAYMENTS_PATH, rid));
        if (!snap.exists()) return;
        const d = snap.data();
        requisitionMeta.set(rid, {
          requisitionNumber: d.requisitionNumber || '',
          grossAmount: typeof d.grossAmount === 'number' ? d.grossAmount : 0,
        });
      })
    );

    // 2. Create accountability entries for each allocation
    const allocationEntries: AllocationEntry[] = [];
    const accountabilityIds: string[] = [];

    for (const alloc of data.allocations) {
      // Validate project exists
      const projectRef = doc(
        this.db,
        'organizations',
        orgId,
        'advisory_projects',
        alloc.projectId
      );
      const projectDoc = await getDoc(projectRef);
      if (!projectDoc.exists()) {
        throw new Error(`Project ${alloc.projectId} not found`);
      }

      const projectData = projectDoc.data();

      const reqMeta = alloc.requisitionId
        ? requisitionMeta.get(alloc.requisitionId)
        : undefined;

      // Create accountability record in payments collection
      const expense: AccountabilityExpense = {
        id: `exp-alloc-${Date.now()}-${accountabilityIds.length}`,
        lineNumber: 1,
        date: data.date,
        description: data.description,
        category: (alloc.budgetCategory as any) || 'construction_materials',
        vendor: data.vendorName,
        amount: alloc.allocatedAmount,
        status: 'pending',
        documents: [],
        isZeroDiscrepancy: false,
      };

      const accountabilityData = {
        paymentType: 'accountability',
        projectId: alloc.projectId,
        programId: alloc.programId,
        organizationId: orgId,
        engagementId: projectData.engagementId || '',
        title: `${data.vendorName} — ${data.description} (Allocation ${groupNumber})`,
        description: `Allocated share: ${alloc.percentage.toFixed(1)}% of ${data.currency} ${data.totalAmount.toLocaleString()}`,
        totalAmount: alloc.allocatedAmount,
        currency: data.currency,
        expenses: [expense],
        status: 'pending',
        captureMode: 'quick_capture' as const,
        capturedAt: now,
        allocationGroupId: '', // Will be set after group is created
        requisitionId: alloc.requisitionId || '',
        requisitionNumber: reqMeta?.requisitionNumber || '',
        requisitionAmount: reqMeta?.grossAmount ?? 0,
        requisitionLinkStatus: alloc.requisitionId ? 'linked' : 'pending',
        linkedRequisitionId: alloc.requisitionId || null,
        linkDeadline: alloc.requisitionId
          ? null
          : Timestamp.fromMillis(now.toMillis() + 48 * 60 * 60 * 1000),
        createdAt: now,
        createdBy: userId,
        updatedAt: now,
      };

      // Use addDoc for auto-ID, then update in batch
      const accRef = doc(collection(this.db, PAYMENTS_PATH));
      batch.set(accRef, accountabilityData);
      accountabilityIds.push(accRef.id);

      allocationEntries.push({
        projectId: alloc.projectId,
        projectName: alloc.projectName,
        programId: alloc.programId,
        budgetCategory: alloc.budgetCategory,
        percentage: alloc.percentage,
        allocatedAmount: alloc.allocatedAmount,
        accountabilityId: accRef.id,
        requisitionId: alloc.requisitionId || null,
      });
    }

    // 3. Create the allocation group document
    const groupRef = doc(collection(this.db, allocationGroupsPath(orgId)));
    const groupData: Omit<AllocationGroup, 'id'> & { id: string } = {
      id: groupRef.id,
      organizationId: orgId,
      groupNumber,
      date: Timestamp.fromDate(data.date),
      vendorName: data.vendorName,
      description: data.description,
      totalAmount: data.totalAmount,
      currency: data.currency,
      allocations: allocationEntries,
      allocationMethod: data.allocationMethod,
      rationale: data.rationale,
      sourceDocumentUrls: data.sourceDocumentUrls,
      memoUrl: null,
      status: 'Finalized',
      projectIds: data.allocations.map((a) => a.projectId),
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      // Matrix allocation detail (optional)
      ...(data.lineItems && { lineItems: data.lineItems }),
      ...(data.matrixAllocations && { matrixAllocations: data.matrixAllocations }),
    };

    batch.set(groupRef, groupData);

    // 4. Update each accountability record with the group ID
    for (const accId of accountabilityIds) {
      const accRef = doc(this.db, PAYMENTS_PATH, accId);
      batch.update(accRef, { allocationGroupId: groupRef.id });
    }

    // 5. Create quick_capture_index entries for unlinked allocations
    for (let i = 0; i < allocationEntries.length; i++) {
      const entry = allocationEntries[i];
      if (!entry.requisitionId) {
        const indexRef = doc(
          collection(this.db, `organizations/${orgId}/quick_capture_index`)
        );
        batch.set(indexRef, {
          id: indexRef.id,
          projectId: entry.projectId,
          projectName: entry.projectName,
          programId: entry.programId,
          vendorName: data.vendorName,
          amount: entry.allocatedAmount,
          currency: data.currency,
          capturedAt: now,
          linkDeadline: Timestamp.fromMillis(now.toMillis() + 48 * 60 * 60 * 1000),
          requisitionLinkStatus: 'pending',
          thumbnailUrl: null,
          organizationId: orgId,
          accountabilityId: accountabilityIds[i],
          allocationGroupId: groupRef.id,
        });
      }
    }

    // 5b. Register allocation accountabilities on each linked requisition (atomic)
    const linkedByReq = new Map<string, string[]>();
    for (let i = 0; i < allocationEntries.length; i++) {
      const reqId = allocationEntries[i].requisitionId;
      if (!reqId) continue;
      const list = linkedByReq.get(reqId) ?? [];
      list.push(accountabilityIds[i]);
      linkedByReq.set(reqId, list);
    }
    for (const [reqId, accIds] of linkedByReq) {
      batch.update(doc(this.db, PAYMENTS_PATH, reqId), {
        linkedAccountabilityIds: arrayUnion(...accIds),
        updatedAt: now,
        updatedBy: userId,
      });
    }

    // 6. Commit the batch
    await batch.commit();

    return groupRef.id;
  }

  // ─────────────────────────────────────────────────────────────────
  // QUERIES
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get an allocation group by ID.
   */
  async getAllocationGroup(
    groupId: string,
    orgId: string
  ): Promise<AllocationGroup | null> {
    const ref = doc(this.db, allocationGroupsPath(orgId), groupId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as AllocationGroup;
  }

  /**
   * Get all allocation groups for a specific project.
   */
  async getAllocationGroupsForProject(
    orgId: string,
    projectId: string
  ): Promise<AllocationGroup[]> {
    const q = query(
      collection(this.db, allocationGroupsPath(orgId)),
      where('projectIds', 'array-contains', projectId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AllocationGroup);
  }

  /**
   * Get vendor allocation history for smart suggestions.
   * Returns the last 5 allocations for a vendor (case-insensitive match).
   */
  async getVendorAllocationHistory(
    orgId: string,
    vendorName: string
  ): Promise<AllocationSuggestion[]> {
    // Firestore doesn't support case-insensitive queries natively,
    // so we query by exact match and let the UI handle fuzzy matching
    const q = query(
      collection(this.db, allocationGroupsPath(orgId)),
      where('vendorName', '==', vendorName),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const snap = await getDocs(q);

    // Extract allocation patterns from history
    const suggestions: AllocationSuggestion[] = [];
    const projectCounts = new Map<string, { count: number; lastUsed: Timestamp; pct: number; category: string; name: string }>();

    for (const d of snap.docs) {
      const group = d.data() as AllocationGroup;
      for (const entry of group.allocations) {
        const key = `${entry.projectId}-${entry.budgetCategory}`;
        const existing = projectCounts.get(key);
        if (existing) {
          existing.count++;
          existing.pct = (existing.pct + entry.percentage) / 2; // running average
        } else {
          projectCounts.set(key, {
            count: 1,
            lastUsed: group.createdAt,
            pct: entry.percentage,
            category: entry.budgetCategory,
            name: entry.projectName,
          });
        }
      }
    }

    for (const [key, data] of projectCounts) {
      const projectId = key.split('-')[0];
      suggestions.push({
        projectId,
        projectName: data.name,
        budgetCategory: data.category,
        percentage: Math.round(data.pct * 10) / 10,
        frequency: data.count,
        lastUsed: data.lastUsed,
      });
    }

    return suggestions.sort((a, b) => b.frequency - a.frequency);
  }

  // ─────────────────────────────────────────────────────────────────
  // VOID ALLOCATION GROUP
  // ─────────────────────────────────────────────────────────────────

  /**
   * Void an entire allocation group. Voids all linked accountability entries
   * across all projects atomically.
   */
  async voidAllocationGroup(
    groupId: string,
    reason: string,
    userId: string,
    orgId: string
  ): Promise<void> {
    const group = await this.getAllocationGroup(groupId, orgId);
    if (!group) throw new Error('Allocation group not found');

    const batch = writeBatch(this.db);

    // Void each accountability entry
    for (const entry of group.allocations) {
      if (entry.accountabilityId) {
        const accRef = doc(this.db, PAYMENTS_PATH, entry.accountabilityId);
        batch.update(accRef, {
          status: 'voided',
          voidReason: reason,
          voidedAt: Timestamp.now(),
          voidedBy: userId,
          updatedAt: Timestamp.now(),
        });
      }
    }

    // Update group status
    const groupRef = doc(this.db, allocationGroupsPath(orgId), groupId);
    batch.update(groupRef, {
      status: 'Voided',
      voidReason: reason,
      voidedAt: Timestamp.now(),
      voidedBy: userId,
      updatedAt: Timestamp.now(),
    });

    await batch.commit();
  }

  // ─────────────────────────────────────────────────────────────────
  // UPDATE MEMO URL
  // ─────────────────────────────────────────────────────────────────

  async updateMemoUrl(
    groupId: string,
    memoUrl: string,
    orgId: string
  ): Promise<void> {
    const ref = doc(this.db, allocationGroupsPath(orgId), groupId);
    await updateDoc(ref, { memoUrl, updatedAt: Timestamp.now() });
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Generate a sequential allocation group number: ALLOC-YYYY-NNNN
   * Uses Firestore transaction for atomicity (same pattern as receipt sequences).
   */
  private async generateGroupNumber(orgId: string): Promise<string> {
    const year = new Date().getFullYear();
    const seqId = `alloc-${year}`;
    const seqRef = doc(this.db, allocationSequencePath(orgId), seqId);

    const nextNumber = await runTransaction(this.db, async (transaction) => {
      const seqDoc = await transaction.get(seqRef);
      let num = 1;
      if (seqDoc.exists()) {
        num = (seqDoc.data().lastNumber || 0) + 1;
        transaction.update(seqRef, {
          lastNumber: num,
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.set(seqRef, {
          id: seqId,
          year,
          lastNumber: num,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      return num;
    });

    return `ALLOC-${year}-${nextNumber.toString().padStart(4, '0')}`;
  }
}

// Factory export (matches existing pattern)
export function getAllocationService(db: Firestore): AllocationService {
  return AllocationService.getInstance(db);
}
