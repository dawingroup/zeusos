/**
 * APPROVAL ENGINE
 * 
 * Processes approval requests through dynamically built chains.
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
  Timestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '../../../../../firebase/config';
import {
  ApprovalRequest,
  ApprovalStep,
  ApprovalType,
  ApprovalStatus,
  ApprovalStepStatus,
  ApprovalDecisionType,
  ApprovalPriority,
} from '../../types/approval';
import { Money } from '../../types/money';
import { Engagement } from '../../types/engagement';
import { FundingSource } from '../../types/funding';
import { TeamMember } from '../../types/engagement-team';
import { COLLECTION_PATHS } from '../../firebase/collections';
import { 
  ApprovalChainBuilder, 
  ApprovalChainContext,
  createApprovalChainBuilder,
} from './approval-chain-builder';
import {
  ApprovalConfig,
  getEscalationRule,
  buildDefaultApprovalConfig,
} from './approval-config';

// ============================================================================
// Types
// ============================================================================

/**
 * Data for creating approval request
 */
export interface CreateApprovalRequestData {
  engagementId: string;
  type: ApprovalType;
  title: string;
  description?: string;
  amount?: Money;
  fundingSourceIds?: string[];
  entityType: string;
  entityId: string;
  documentIds?: string[];
  priority?: ApprovalPriority;
  metadata?: Record<string, unknown>;
}

/**
 * Approval action
 */
export interface ApprovalAction {
  requestId: string;
  engagementId: string;
  decision: ApprovalDecisionType | 'delegated';
  comments?: string;
  conditions?: string[];
  delegateToUserId?: string;
}

/**
 * Approval engine events
 */
export type ApprovalEventType = 
  | 'request_created'
  | 'step_completed'
  | 'step_rejected'
  | 'request_approved'
  | 'request_rejected'
  | 'request_returned'
  | 'request_escalated'
  | 'request_auto_approved';

export interface ApprovalEvent {
  type: ApprovalEventType;
  requestId: string;
  engagementId: string;
  timestamp: Timestamp;
  userId?: string;
  stepSequence?: number;
  details?: Record<string, unknown>;
}

export type ApprovalEventHandler = (event: ApprovalEvent) => void;

// ============================================================================
// Helper Functions
// ============================================================================

async function getCurrentUser() {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  return user;
}

function getEngagementRef(engagementId: string) {
  return doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId);
}

function getApprovalRequestsCollection(engagementId: string) {
  return collection(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'approvalRequests');
}

function getApprovalRequestRef(engagementId: string, requestId: string) {
  return doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'approvalRequests', requestId);
}

// ============================================================================
// Approval Engine Class
// ============================================================================

export class ApprovalEngine {
  private static instance: ApprovalEngine;
  private chainBuilder: ApprovalChainBuilder;
  private config: ApprovalConfig;
  private eventHandlers: Map<ApprovalEventType, ApprovalEventHandler[]> = new Map();
  private subscriptions: Map<string, Unsubscribe> = new Map();

  private constructor() {
    this.config = buildDefaultApprovalConfig();
    this.chainBuilder = createApprovalChainBuilder();
  }

  static getInstance(): ApprovalEngine {
    if (!ApprovalEngine.instance) {
      ApprovalEngine.instance = new ApprovalEngine();
    }
    return ApprovalEngine.instance;
  }

  // --------------------------------------------------------------------------
  // Request Creation
  // --------------------------------------------------------------------------

  /**
   * Create a new approval request
   */
  async createRequest(data: CreateApprovalRequestData): Promise<ApprovalRequest> {
    const user = await getCurrentUser();

    // Load engagement
    const engagement = await this.loadEngagement(data.engagementId);
    if (!engagement) throw new Error('Engagement not found');

    // Load funding sources if specified
    let fundingSources: FundingSource[] | undefined;
    if (data.fundingSourceIds && data.fundingSourceIds.length > 0) {
      fundingSources = await this.loadFundingSources(
        data.engagementId,
        data.fundingSourceIds
      );
    }

    // Build approval chain
    const chainContext: ApprovalChainContext = {
      engagementId: data.engagementId,
      engagement,
      type: data.type,
      amount: data.amount?.amount,
      currency: data.amount?.currency,
      fundingSourceIds: data.fundingSourceIds,
      fundingSources,
    };

    const chainResult = this.chainBuilder.buildChain(chainContext);

    // Create request
    const now = Timestamp.now();
    const requestRef = doc(getApprovalRequestsCollection(data.engagementId));

    const request: ApprovalRequest = {
      id: requestRef.id,
      engagementId: data.engagementId,
      entityType: data.entityType,
      entityId: data.entityId,
      
      type: data.type,
      title: data.title,
      description: data.description || '',
      amount: data.amount,
      priority: data.priority || 'normal',
      
      approvalChain: chainResult.steps,
      currentStepIndex: 0,
      isComplete: false,
      
      status: 'pending',
      
      documentIds: data.documentIds || [],
      
      requestedBy: user.uid,
      requestedAt: now,
      updatedAt: now,
    };

    // Save to Firestore
    await setDoc(requestRef, request);

    // Emit event
    this.emitEvent({
      type: 'request_created',
      requestId: request.id,
      engagementId: data.engagementId,
      timestamp: now,
      userId: user.uid,
      details: { 
        type: data.type, 
        totalSteps: chainResult.totalSteps,
        requiresNoObjection: chainResult.requiresNoObjection,
      },
    });

    // Notify first step approvers
    const firstStep = chainResult.steps[0];
    if (firstStep) {
      await this.notifyApprovers(request, firstStep);
    }

    return request;
  }

  // --------------------------------------------------------------------------
  // Approval Processing
  // --------------------------------------------------------------------------

  /**
   * Process an approval action
   */
  async processAction(action: ApprovalAction): Promise<ApprovalRequest> {
    const user = await getCurrentUser();

    // Load request
    const request = await this.loadRequest(action.engagementId, action.requestId);
    if (!request) throw new Error('Approval request not found');

    if (request.status !== 'pending' && request.status !== 'in_review') {
      throw new Error(`Cannot process action on request with status: ${request.status}`);
    }

    // Get current step
    const currentStep = request.approvalChain[request.currentStepIndex];
    if (!currentStep) throw new Error('Current step not found');

    // Validate user can approve
    const canApprove = this.canUserApproveStep(user.uid, currentStep, request);
    if (!canApprove) {
      throw new Error('User is not authorized to approve this step');
    }

    // Process based on decision
    switch (action.decision) {
      case 'approved':
        return this.processApproval(request, currentStep, user, action);
      case 'rejected':
        return this.processRejection(request, currentStep, user, action);
      case 'returned':
        return this.processReturn(request, currentStep, user, action);
      case 'delegated':
        return this.processDelegation(request, currentStep, user, action);
      default:
        throw new Error(`Unknown decision: ${action.decision}`);
    }
  }

  /**
   * Check if user can approve a step
   */
  private canUserApproveStep(
    userId: string,
    step: ApprovalStep,
    _request: ApprovalRequest
  ): boolean {
    // External steps (funder) are handled differently
    if (step.approverType === 'funder') {
      return true; // Would need funder authentication
    }

    // Specific user approval
    if (step.approverType === 'user' && step.approverId === userId) {
      return true;
    }

    // Role-based approval - would need to check user's role
    if (step.approverType === 'role') {
      // For now, allow - in production, verify role
      return true;
    }

    // Team lead approval
    if (step.approverType === 'team_lead') {
      // Would need to verify user is team lead
      return true;
    }

    return false;
  }

  /**
   * Process approval decision
   */
  private async processApproval(
    request: ApprovalRequest,
    step: ApprovalStep,
    user: { uid: string; displayName: string | null },
    action: ApprovalAction
  ): Promise<ApprovalRequest> {
    const now = Timestamp.now();

    // Update step
    const updatedStep: ApprovalStep = {
      ...step,
      status: 'approved' as ApprovalStepStatus,
      decision: 'approved',
      decisionBy: user.uid,
      decisionAt: now,
      comments: action.comments,
    };

    // Determine if we can advance
    const isLastStep = request.currentStepIndex === request.approvalChain.length - 1;
    const requestComplete = isLastStep;

    // Build updated chain
    const updatedChain = request.approvalChain.map((s, idx) =>
      idx === request.currentStepIndex ? updatedStep : s
    );

    const update: Partial<ApprovalRequest> = {
      approvalChain: updatedChain,
      status: requestComplete ? 'approved' : 'in_review',
      currentStepIndex: requestComplete ? request.currentStepIndex : request.currentStepIndex + 1,
      isComplete: requestComplete,
      updatedAt: now,
    };

    if (requestComplete) {
      update.finalDecision = 'approved';
      update.finalDecisionDate = now;
    }

    await this.updateRequest(request.engagementId, request.id, update);

    // Emit events
    this.emitEvent({
      type: 'step_completed',
      requestId: request.id,
      engagementId: request.engagementId,
      timestamp: now,
      userId: user.uid,
      stepSequence: step.sequence,
    });

    if (requestComplete) {
      this.emitEvent({
        type: 'request_approved',
        requestId: request.id,
        engagementId: request.engagementId,
        timestamp: now,
        userId: user.uid,
      });
    } else {
      // Notify next step approvers
      const nextStep = updatedChain[request.currentStepIndex + 1];
      if (nextStep) {
        await this.notifyApprovers({ ...request, ...update } as ApprovalRequest, nextStep);
      }
    }

    return { ...request, ...update } as ApprovalRequest;
  }

  /**
   * Process rejection decision
   */
  private async processRejection(
    request: ApprovalRequest,
    step: ApprovalStep,
    user: { uid: string; displayName: string | null },
    action: ApprovalAction
  ): Promise<ApprovalRequest> {
    const now = Timestamp.now();

    const updatedStep: ApprovalStep = {
      ...step,
      status: 'rejected' as ApprovalStepStatus,
      decision: 'rejected',
      decisionBy: user.uid,
      decisionAt: now,
      comments: action.comments,
    };

    const updatedChain = request.approvalChain.map((s, idx) =>
      idx === request.currentStepIndex ? updatedStep : s
    );

    const update: Partial<ApprovalRequest> = {
      status: 'rejected',
      approvalChain: updatedChain,
      isComplete: true,
      finalDecision: 'rejected',
      finalDecisionDate: now,
      updatedAt: now,
    };

    await this.updateRequest(request.engagementId, request.id, update);

    this.emitEvent({
      type: 'step_rejected',
      requestId: request.id,
      engagementId: request.engagementId,
      timestamp: now,
      userId: user.uid,
      stepSequence: step.sequence,
    });

    this.emitEvent({
      type: 'request_rejected',
      requestId: request.id,
      engagementId: request.engagementId,
      timestamp: now,
      userId: user.uid,
    });

    // Notify requester
    await this.notifyRequester(request, 'rejected', action.comments);

    return { ...request, ...update } as ApprovalRequest;
  }

  /**
   * Process return for revision
   */
  private async processReturn(
    request: ApprovalRequest,
    step: ApprovalStep,
    user: { uid: string; displayName: string | null },
    action: ApprovalAction
  ): Promise<ApprovalRequest> {
    const now = Timestamp.now();

    // Mark current step as returned
    const updatedStep: ApprovalStep = {
      ...step,
      status: 'pending' as ApprovalStepStatus,
      decision: 'returned',
      decisionBy: user.uid,
      decisionAt: now,
      comments: action.comments,
    };

    // Reset all steps to pending
    const resetChain = request.approvalChain.map((s, idx) => {
      if (idx === request.currentStepIndex) {
        return updatedStep;
      }
      return {
        ...s,
        status: 'pending' as ApprovalStepStatus,
        decision: undefined,
        decisionBy: undefined,
        decisionAt: undefined,
        comments: undefined,
      };
    });

    const update: Partial<ApprovalRequest> = {
      status: 'returned',
      approvalChain: resetChain,
      currentStepIndex: 0,
      isComplete: false,
      updatedAt: now,
    };

    await this.updateRequest(request.engagementId, request.id, update);

    this.emitEvent({
      type: 'request_returned',
      requestId: request.id,
      engagementId: request.engagementId,
      timestamp: now,
      userId: user.uid,
      stepSequence: step.sequence,
      details: { comments: action.comments },
    });

    // Notify requester
    await this.notifyRequester(request, 'returned', action.comments);

    return { ...request, ...update } as ApprovalRequest;
  }

  /**
   * Process delegation
   */
  private async processDelegation(
    request: ApprovalRequest,
    step: ApprovalStep,
    user: { uid: string; displayName: string | null },
    action: ApprovalAction
  ): Promise<ApprovalRequest> {
    if (!action.delegateToUserId) {
      throw new Error('Delegate user ID required for delegation');
    }

    const now = Timestamp.now();

    // Update step to add delegate as approver
    const updatedStep: ApprovalStep = {
      ...step,
      approverType: 'user',
      approverId: action.delegateToUserId,
      comments: `Delegated by ${user.displayName || user.uid}: ${action.comments || ''}`,
    };

    const updatedChain = request.approvalChain.map((s, idx) =>
      idx === request.currentStepIndex ? updatedStep : s
    );

    const update: Partial<ApprovalRequest> = {
      approvalChain: updatedChain,
      updatedAt: now,
    };

    await this.updateRequest(request.engagementId, request.id, update);

    // Notify delegate
    await this.notifyDelegate(request, action.delegateToUserId, user.displayName || 'Unknown');

    return { ...request, ...update } as ApprovalRequest;
  }

  // --------------------------------------------------------------------------
  // Escalation
  // --------------------------------------------------------------------------

  /**
   * Escalate a specific request
   */
  async escalateRequest(
    engagementId: string,
    requestId: string,
    reason: string
  ): Promise<ApprovalRequest> {
    const request = await this.loadRequest(engagementId, requestId);
    if (!request) throw new Error('Request not found');

    const now = Timestamp.now();
    const daysOverdue = this.calculateDaysOverdue(request);
    const escalationRule = getEscalationRule(this.config, daysOverdue);

    if (!escalationRule) {
      throw new Error('No applicable escalation rule');
    }

    // Load engagement to find escalation approver
    const engagement = await this.loadEngagement(engagementId);
    if (!engagement) throw new Error('Engagement not found');

    const escalationApprover = engagement.team?.members?.find(
      (m: TeamMember) => m.isActive && m.role === escalationRule.escalateToRole
    );

    if (escalationRule.isAutoApprove) {
      // Auto-approve the request
      return this.autoApproveRequest(request, reason);
    }

    // Add escalation approver to current step
    const currentStep = request.approvalChain[request.currentStepIndex];
    if (!currentStep) {
      throw new Error('Cannot escalate: current step not found');
    }

    const updatedStep: ApprovalStep = {
      ...currentStep,
      approverType: escalationApprover ? 'user' : 'role',
      approverId: escalationApprover?.userId,
      approverRole: escalationRule.escalateToRole,
      isPastSLA: true,
    };

    const updatedChain = request.approvalChain.map((s, idx) =>
      idx === request.currentStepIndex ? updatedStep : s
    );

    const update: Partial<ApprovalRequest> = {
      approvalChain: updatedChain,
      status: 'in_review',
      updatedAt: now,
    };

    await this.updateRequest(engagementId, requestId, update);

    this.emitEvent({
      type: 'request_escalated',
      requestId,
      engagementId,
      timestamp: now,
      details: { reason, escalateToRole: escalationRule.escalateToRole },
    });

    // Notify escalation approver
    if (escalationApprover) {
      await this.notifyEscalation(
        { ...request, ...update } as ApprovalRequest,
        escalationApprover,
        reason
      );
    }

    return { ...request, ...update } as ApprovalRequest;
  }

  /**
   * Auto-approve request (after maximum escalation)
   */
  private async autoApproveRequest(
    request: ApprovalRequest,
    reason: string
  ): Promise<ApprovalRequest> {
    const now = Timestamp.now();

    // Mark all remaining steps as approved
    const updatedChain = request.approvalChain.map(step => {
      if (step.status === 'pending' || step.status === 'in_progress') {
        return {
          ...step,
          status: 'approved' as ApprovalStepStatus,
          decisionAt: now,
          comments: `Auto-approved: ${reason}`,
        };
      }
      return step;
    });

    const update: Partial<ApprovalRequest> = {
      status: 'approved',
      approvalChain: updatedChain,
      isComplete: true,
      finalDecision: 'approved',
      finalDecisionDate: now,
      updatedAt: now,
    };

    await this.updateRequest(request.engagementId, request.id, update);

    this.emitEvent({
      type: 'request_auto_approved',
      requestId: request.id,
      engagementId: request.engagementId,
      timestamp: now,
      details: { reason },
    });

    return { ...request, ...update } as ApprovalRequest;
  }

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  /**
   * Get pending approvals for user
   */
  async getPendingApprovals(userId: string): Promise<ApprovalRequest[]> {
    // This would need collection group query or denormalized structure
    // For now, return empty array - real implementation would iterate engagements
    console.log('getPendingApprovals for:', userId);
    return [];
  }

  /**
   * Get request by ID
   */
  async getRequest(
    engagementId: string,
    requestId: string
  ): Promise<ApprovalRequest | null> {
    return this.loadRequest(engagementId, requestId);
  }

  /**
   * Get requests for engagement
   */
  async getEngagementRequests(
    engagementId: string,
    filters?: { status?: ApprovalStatus; type?: ApprovalType }
  ): Promise<ApprovalRequest[]> {
    let q = query(
      getApprovalRequestsCollection(engagementId),
      orderBy('requestedAt', 'desc')
    );

    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters?.type) {
      q = query(q, where('type', '==', filters.type));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ApprovalRequest[];
  }

  // --------------------------------------------------------------------------
  // Subscriptions
  // --------------------------------------------------------------------------

  /**
   * Subscribe to request updates
   */
  subscribeToRequest(
    engagementId: string,
    requestId: string,
    callback: (request: ApprovalRequest | null) => void
  ): Unsubscribe {
    const docRef = getApprovalRequestRef(engagementId, requestId);

    const unsubscribe = onSnapshot(docRef, snapshot => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() } as ApprovalRequest);
      } else {
        callback(null);
      }
    });

    this.subscriptions.set(`request:${requestId}`, unsubscribe);
    return unsubscribe;
  }

  /**
   * Subscribe to engagement requests
   */
  subscribeToEngagementRequests(
    engagementId: string,
    callback: (requests: ApprovalRequest[]) => void,
    filters?: { status?: ApprovalStatus }
  ): Unsubscribe {
    let q = query(
      getApprovalRequestsCollection(engagementId),
      orderBy('requestedAt', 'desc')
    );

    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }

    const unsubscribe = onSnapshot(q, snapshot => {
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ApprovalRequest[];
      callback(requests);
    });

    this.subscriptions.set(`engagement:${engagementId}`, unsubscribe);
    return unsubscribe;
  }

  /**
   * Unsubscribe all
   */
  unsubscribeAll(): void {
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions.clear();
  }

  // --------------------------------------------------------------------------
  // Event System
  // --------------------------------------------------------------------------

  /**
   * Register event handler
   */
  onEvent(type: ApprovalEventType, handler: ApprovalEventHandler): void {
    const handlers = this.eventHandlers.get(type) || [];
    handlers.push(handler);
    this.eventHandlers.set(type, handlers);
  }

  /**
   * Remove event handler
   */
  offEvent(type: ApprovalEventType, handler: ApprovalEventHandler): void {
    const handlers = this.eventHandlers.get(type) || [];
    this.eventHandlers.set(type, handlers.filter(h => h !== handler));
  }

  /**
   * Emit event
   */
  private emitEvent(event: ApprovalEvent): void {
    const handlers = this.eventHandlers.get(event.type) || [];
    handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in approval event handler:', error);
      }
    });
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private async loadEngagement(id: string): Promise<Engagement | null> {
    const docRef = getEngagementRef(id);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? (snapshot.data() as Engagement) : null;
  }

  private async loadRequest(
    engagementId: string,
    requestId: string
  ): Promise<ApprovalRequest | null> {
    const docRef = getApprovalRequestRef(engagementId, requestId);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() 
      ? { id: snapshot.id, ...snapshot.data() } as ApprovalRequest 
      : null;
  }

  private async loadFundingSources(
    engagementId: string,
    ids: string[]
  ): Promise<FundingSource[]> {
    const sources: FundingSource[] = [];
    for (const id of ids) {
      const docRef = doc(
        db,
        COLLECTION_PATHS.ENGAGEMENTS,
        engagementId,
        'fundingSources',
        id
      );
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        sources.push({ id: snapshot.id, ...snapshot.data() } as FundingSource);
      }
    }
    return sources;
  }

  private async updateRequest(
    engagementId: string,
    requestId: string,
    update: Partial<ApprovalRequest>
  ): Promise<void> {
    const docRef = getApprovalRequestRef(engagementId, requestId);
    await updateDoc(docRef, update);
  }

  private calculateDaysOverdue(request: ApprovalRequest): number {
    const now = new Date();
    const requestedAt = request.requestedAt.toDate();
    
    // Calculate expected completion based on SLA
    const currentStep = request.approvalChain[request.currentStepIndex];
    const slaHours = currentStep?.slaHours || 48;
    const deadline = new Date(requestedAt.getTime() + slaHours * 60 * 60 * 1000);
    
    const diff = now.getTime() - deadline.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }

  // --------------------------------------------------------------------------
  // Notification Stubs (Integration points)
  // --------------------------------------------------------------------------

  private async notifyApprovers(_request: ApprovalRequest, step: ApprovalStep): Promise<void> {
    // Integration point with notification service
    console.log('Notify approvers for step:', step.sequence, step.name);
  }

  private async notifyRequester(_request: ApprovalRequest, status: string, comments?: string): Promise<void> {
    console.log('Notify requester:', status, comments);
  }

  private async notifyDelegate(_request: ApprovalRequest, delegateUserId: string, delegatedBy: string): Promise<void> {
    console.log('Notify delegate:', delegateUserId, 'delegated by:', delegatedBy);
  }

  private async notifyEscalation(_request: ApprovalRequest, approver: TeamMember, reason: string): Promise<void> {
    console.log('Notify escalation:', approver.userId, reason);
  }
}

// Export singleton
export const approvalEngine = ApprovalEngine.getInstance();
