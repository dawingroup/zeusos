/**
 * Approval Workflow Service
 *
 * Multi-level approval workflow for manufacturing orders:
 * - Amount-based approval thresholds
 * - Role-based approval routing
 * - Approval chain management
 * - SLA tracking and escalation
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { ManufacturingOrder } from '@/modules/manufacturing/types';

const MO_COLLECTION = 'manufacturingOrders';
const APPROVAL_CONFIG_COLLECTION = 'moApprovalConfigurations';
const APPROVAL_REQUESTS_COLLECTION = 'moApprovalRequests';
const BUSINESS_EVENTS_COLLECTION = 'businessEvents';

// ============================================
// Types
// ============================================

export interface ApprovalThreshold {
  id: string;
  minAmount: number;
  maxAmount: number | null; // null = no upper limit
  currency: string;
  requiredApprovals: ApprovalLevel[];
}

export interface ApprovalLevel {
  level: number;
  name: string;
  requiredRole: string;
  slaHours: number;
  canSkip: boolean;
  skipConditions?: SkipCondition[];
}

export interface SkipCondition {
  type: 'priority' | 'project_type' | 'repeat_order';
  operator: 'eq' | 'neq' | 'in';
  value: string | string[];
}

export interface ApprovalConfiguration {
  id: string;
  name: string;
  description: string;
  subsidiaryId: string;
  isActive: boolean;
  isDefault: boolean;
  thresholds: ApprovalThreshold[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ApprovalRequest {
  id: string;
  moId: string;
  moNumber: string;
  configurationId: string;
  thresholdId: string;
  totalAmount: number;
  currency: string;
  currentLevel: number;
  totalLevels: number;
  status: 'pending' | 'approved' | 'rejected' | 'escalated' | 'expired';
  approvalChain: ApprovalChainEntry[];
  requestedAt: Date;
  requestedBy: string;
  completedAt?: Date;
  expiresAt?: Date;
  subsidiaryId: string;
}

export interface ApprovalChainEntry {
  level: number;
  levelName: string;
  requiredRole: string;
  approverId?: string;
  approverName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'escalated';
  respondedAt?: Date;
  notes?: string;
  slaHours: number;
  slaDueAt: Date;
  escalatedTo?: string;
}

export interface ApprovalAction {
  action: 'approve' | 'reject' | 'escalate' | 'delegate';
  notes?: string;
  delegateTo?: string;
}

// ============================================
// Configuration Management
// ============================================

/**
 * Get active approval configuration for a subsidiary
 */
export async function getApprovalConfiguration(
  subsidiaryId: string,
): Promise<ApprovalConfiguration | null> {
  const q = query(
    collection(db, APPROVAL_CONFIG_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
    where('isActive', '==', true),
    where('isDefault', '==', true),
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    // Return default configuration
    return getDefaultApprovalConfiguration(subsidiaryId);
  }

  return { id: snap.docs[0].id, ...snap.docs[0].data() } as ApprovalConfiguration;
}

/**
 * Default approval configuration if none exists
 */
function getDefaultApprovalConfiguration(subsidiaryId: string): ApprovalConfiguration {
  return {
    id: 'default',
    name: 'Default Manufacturing Approval',
    description: 'Standard multi-level approval based on material cost',
    subsidiaryId,
    isActive: true,
    isDefault: true,
    thresholds: [
      {
        id: 'tier-1',
        minAmount: 0,
        maxAmount: 5000000, // Up to 5M UGX
        currency: 'UGX',
        requiredApprovals: [
          {
            level: 1,
            name: 'Production Supervisor',
            requiredRole: 'PRODUCTION_SUPERVISOR',
            slaHours: 24,
            canSkip: true,
            skipConditions: [
              { type: 'priority', operator: 'eq', value: 'urgent' },
            ],
          },
        ],
      },
      {
        id: 'tier-2',
        minAmount: 5000000,
        maxAmount: 20000000, // 5M - 20M UGX
        currency: 'UGX',
        requiredApprovals: [
          {
            level: 1,
            name: 'Production Supervisor',
            requiredRole: 'PRODUCTION_SUPERVISOR',
            slaHours: 24,
            canSkip: false,
          },
          {
            level: 2,
            name: 'Production Manager',
            requiredRole: 'PRODUCTION_MANAGER',
            slaHours: 48,
            canSkip: false,
          },
        ],
      },
      {
        id: 'tier-3',
        minAmount: 20000000,
        maxAmount: null, // 20M+ UGX
        currency: 'UGX',
        requiredApprovals: [
          {
            level: 1,
            name: 'Production Supervisor',
            requiredRole: 'PRODUCTION_SUPERVISOR',
            slaHours: 24,
            canSkip: false,
          },
          {
            level: 2,
            name: 'Production Manager',
            requiredRole: 'PRODUCTION_MANAGER',
            slaHours: 48,
            canSkip: false,
          },
          {
            level: 3,
            name: 'Operations Director',
            requiredRole: 'OPERATIONS_DIRECTOR',
            slaHours: 72,
            canSkip: false,
          },
        ],
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
  };
}

/**
 * Save or update approval configuration
 */
export async function saveApprovalConfiguration(
  config: Omit<ApprovalConfiguration, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string,
): Promise<string> {
  const data = {
    ...config,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };

  // Check if default config exists
  const q = query(
    collection(db, APPROVAL_CONFIG_COLLECTION),
    where('subsidiaryId', '==', config.subsidiaryId),
    where('isDefault', '==', true),
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    const docRef = await addDoc(collection(db, APPROVAL_CONFIG_COLLECTION), {
      ...data,
      createdAt: serverTimestamp(),
      createdBy: userId,
    });
    return docRef.id;
  } else {
    const existingId = snap.docs[0].id;
    await updateDoc(doc(db, APPROVAL_CONFIG_COLLECTION, existingId), data);
    return existingId;
  }
}

// ============================================
// Approval Request Management
// ============================================

/**
 * Initiate approval workflow for a manufacturing order
 */
export async function initiateApproval(
  moId: string,
  userId: string,
): Promise<ApprovalRequest> {
  const moRef = doc(db, MO_COLLECTION, moId);
  const moSnap = await getDoc(moRef);

  if (!moSnap.exists()) {
    throw new Error('Manufacturing order not found');
  }

  const mo = { id: moId, ...moSnap.data() } as ManufacturingOrder;

  if (mo.status !== 'draft') {
    throw new Error('MO must be in draft status to initiate approval');
  }

  // Get approval configuration
  const config = await getApprovalConfiguration(mo.subsidiaryId);
  if (!config) {
    throw new Error('No approval configuration found');
  }

  // Determine applicable threshold
  const totalAmount = mo.costSummary.totalCost;
  const threshold = config.thresholds.find(
    t => totalAmount >= t.minAmount && (t.maxAmount === null || totalAmount < t.maxAmount),
  );

  if (!threshold) {
    throw new Error('No applicable approval threshold found');
  }

  // Build approval chain
  const now = new Date();
  const approvalChain: ApprovalChainEntry[] = threshold.requiredApprovals.map((level, idx) => {
    const slaDueAt = new Date(now.getTime() + level.slaHours * 60 * 60 * 1000);

    // Check skip conditions
    const shouldSkip = level.canSkip && level.skipConditions?.some(condition => {
      if (condition.type === 'priority') {
        return evaluateCondition(mo.priority, condition.operator, condition.value);
      }
      return false;
    });

    return {
      level: level.level,
      levelName: level.name,
      requiredRole: level.requiredRole,
      status: shouldSkip ? 'skipped' : (idx === 0 ? 'pending' : 'pending'),
      slaHours: level.slaHours,
      slaDueAt,
    };
  });

  // Find first non-skipped level
  const firstPendingLevel = approvalChain.find(e => e.status !== 'skipped')?.level ?? 1;

  const approvalRequest: Omit<ApprovalRequest, 'id'> = {
    moId,
    moNumber: mo.moNumber,
    configurationId: config.id,
    thresholdId: threshold.id,
    totalAmount,
    currency: mo.costSummary.currency,
    currentLevel: firstPendingLevel,
    totalLevels: approvalChain.filter(e => e.status !== 'skipped').length,
    status: 'pending',
    approvalChain,
    requestedAt: now,
    requestedBy: userId,
    expiresAt: approvalChain[approvalChain.length - 1]?.slaDueAt,
    subsidiaryId: mo.subsidiaryId,
  };

  const requestRef = await addDoc(collection(db, APPROVAL_REQUESTS_COLLECTION), approvalRequest);

  // Update MO status
  await updateDoc(moRef, {
    status: 'pending-approval',
    approvalRequestId: requestRef.id,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  await emitBusinessEvent('mo_approval_initiated', mo, userId, {
    thresholdId: threshold.id,
    totalLevels: approvalRequest.totalLevels,
    totalAmount,
  });

  return { id: requestRef.id, ...approvalRequest };
}

/**
 * Process an approval action (approve, reject, escalate, delegate)
 */
export async function processApprovalAction(
  requestId: string,
  userId: string,
  userName: string,
  userRole: string,
  action: ApprovalAction,
): Promise<ApprovalRequest> {
  const requestRef = doc(db, APPROVAL_REQUESTS_COLLECTION, requestId);
  const requestSnap = await getDoc(requestRef);

  if (!requestSnap.exists()) {
    throw new Error('Approval request not found');
  }

  const request = { id: requestId, ...requestSnap.data() } as ApprovalRequest;

  if (request.status !== 'pending') {
    throw new Error(`Cannot process action on ${request.status} request`);
  }

  // Find current level entry
  const currentEntry = request.approvalChain.find(
    e => e.level === request.currentLevel && e.status === 'pending',
  );

  if (!currentEntry) {
    throw new Error('No pending approval level found');
  }

  // Verify user has required role
  if (currentEntry.requiredRole !== userRole && action.action !== 'delegate') {
    throw new Error(`User role ${userRole} does not match required role ${currentEntry.requiredRole}`);
  }

  // Update chain entry
  const updatedChain = request.approvalChain.map(entry => {
    if (entry.level !== request.currentLevel) return entry;

    switch (action.action) {
      case 'approve':
        return {
          ...entry,
          status: 'approved' as const,
          approverId: userId,
          approverName: userName,
          respondedAt: new Date(),
          notes: action.notes,
        };
      case 'reject':
        return {
          ...entry,
          status: 'rejected' as const,
          approverId: userId,
          approverName: userName,
          respondedAt: new Date(),
          notes: action.notes,
        };
      case 'escalate':
        return {
          ...entry,
          status: 'escalated' as const,
          approverId: userId,
          approverName: userName,
          respondedAt: new Date(),
          notes: action.notes,
          escalatedTo: action.delegateTo,
        };
      case 'delegate':
        return {
          ...entry,
          notes: `Delegated by ${userName}: ${action.notes ?? ''}`,
          escalatedTo: action.delegateTo,
        };
      default:
        return entry;
    }
  });

  // Determine new status and level
  let newStatus: ApprovalRequest['status'] = request.status;
  let newLevel = request.currentLevel;

  if (action.action === 'approve') {
    // Check if all levels are complete
    const remainingPending = updatedChain.filter(
      e => e.status === 'pending' && e.level > request.currentLevel,
    );

    if (remainingPending.length === 0) {
      newStatus = 'approved';
    } else {
      newLevel = remainingPending[0].level;
    }
  } else if (action.action === 'reject') {
    newStatus = 'rejected';
  } else if (action.action === 'escalate') {
    newStatus = 'escalated';
  }

  const updatedRequest: Partial<ApprovalRequest> = {
    currentLevel: newLevel,
    status: newStatus,
    approvalChain: updatedChain,
    completedAt: ['approved', 'rejected'].includes(newStatus) ? new Date() : undefined,
  };

  await updateDoc(requestRef, updatedRequest);

  // Update MO status based on final result
  if (newStatus === 'approved') {
    const moRef = doc(db, MO_COLLECTION, request.moId);
    await updateDoc(moRef, {
      status: 'approved',
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    const moSnap = await getDoc(moRef);
    if (moSnap.exists()) {
      await emitBusinessEvent(
        'manufacturing_order_approved',
        { id: request.moId, ...moSnap.data() } as ManufacturingOrder,
        userId,
        { approvalLevels: request.totalLevels },
      );
    }
  } else if (newStatus === 'rejected') {
    const moRef = doc(db, MO_COLLECTION, request.moId);
    await updateDoc(moRef, {
      status: 'draft',
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    const moSnap = await getDoc(moRef);
    if (moSnap.exists()) {
      await emitBusinessEvent(
        'mo_approval_rejected',
        { id: request.moId, ...moSnap.data() } as ManufacturingOrder,
        userId,
        { rejectedAt: request.currentLevel, reason: action.notes },
      );
    }
  }

  return { ...request, ...updatedRequest } as ApprovalRequest;
}

/**
 * Get pending approval requests for a user based on their role
 */
export async function getPendingApprovalsForRole(
  userRole: string,
  subsidiaryId: string,
): Promise<ApprovalRequest[]> {
  const q = query(
    collection(db, APPROVAL_REQUESTS_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
    where('status', '==', 'pending'),
    orderBy('requestedAt', 'asc'),
  );

  const snap = await getDocs(q);
  const requests = snap.docs.map(d => ({ id: d.id, ...d.data() } as ApprovalRequest));

  // Filter to only those where current level matches user's role
  return requests.filter(req => {
    const currentEntry = req.approvalChain.find(e => e.level === req.currentLevel);
    return currentEntry?.requiredRole === userRole;
  });
}

/**
 * Get approval request for an MO
 */
export async function getApprovalRequestForMO(
  moId: string,
): Promise<ApprovalRequest | null> {
  const q = query(
    collection(db, APPROVAL_REQUESTS_COLLECTION),
    where('moId', '==', moId),
    orderBy('requestedAt', 'desc'),
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  return { id: snap.docs[0].id, ...snap.docs[0].data() } as ApprovalRequest;
}

/**
 * Check for overdue approvals and escalate
 */
export async function checkAndEscalateOverdueApprovals(
  subsidiaryId: string,
): Promise<number> {
  const now = new Date();
  const q = query(
    collection(db, APPROVAL_REQUESTS_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
    where('status', '==', 'pending'),
  );

  const snap = await getDocs(q);
  let escalatedCount = 0;

  for (const reqDoc of snap.docs) {
    const request = { id: reqDoc.id, ...reqDoc.data() } as ApprovalRequest;
    const currentEntry = request.approvalChain.find(e => e.level === request.currentLevel);

    if (currentEntry && new Date(currentEntry.slaDueAt) < now) {
      // Mark as escalated
      const updatedChain = request.approvalChain.map(e =>
        e.level === request.currentLevel
          ? { ...e, status: 'escalated' as const, notes: 'Auto-escalated due to SLA breach' }
          : e,
      );

      await updateDoc(doc(db, APPROVAL_REQUESTS_COLLECTION, request.id), {
        approvalChain: updatedChain,
        status: 'escalated',
      });

      // Emit escalation event
      await addDoc(collection(db, BUSINESS_EVENTS_COLLECTION), {
        eventType: 'mo_approval_escalated',
        category: 'sla_breach',
        severity: 'high',
        sourceModule: 'manufacturing',
        subsidiary: 'finishes',
        entityType: 'approval_request',
        entityId: request.id,
        entityName: request.moNumber,
        title: `Approval escalated for ${request.moNumber}`,
        description: `SLA breached at level ${request.currentLevel}`,
        triggeredBy: 'system',
        triggeredAt: serverTimestamp(),
        status: 'pending',
        metadata: {
          moId: request.moId,
          level: request.currentLevel,
          slaDueAt: currentEntry.slaDueAt,
        },
        createdAt: serverTimestamp(),
      });

      escalatedCount++;
    }
  }

  return escalatedCount;
}

// ============================================
// Helper Functions
// ============================================

function evaluateCondition(
  value: string,
  operator: 'eq' | 'neq' | 'in',
  target: string | string[],
): boolean {
  switch (operator) {
    case 'eq':
      return value === target;
    case 'neq':
      return value !== target;
    case 'in':
      return Array.isArray(target) ? target.includes(value) : false;
    default:
      return false;
  }
}

async function emitBusinessEvent(
  eventType: string,
  mo: ManufacturingOrder,
  userId: string,
  extraData?: Record<string, unknown>,
): Promise<void> {
  await addDoc(collection(db, BUSINESS_EVENTS_COLLECTION), {
    eventType,
    category: 'workflow_transition',
    severity: 'medium',
    sourceModule: 'manufacturing',
    subsidiary: 'finishes',
    entityType: 'manufacturing_order',
    entityId: mo.id,
    entityName: mo.moNumber,
    projectId: mo.projectId,
    projectName: mo.projectCode,
    title: `Manufacturing order ${eventType.replace(/_/g, ' ')}`,
    description: `MO ${mo.moNumber} for ${mo.designItemName}`,
    triggeredBy: userId,
    triggeredAt: serverTimestamp(),
    status: 'pending',
    metadata: extraData ?? {},
    createdAt: serverTimestamp(),
  });
}
