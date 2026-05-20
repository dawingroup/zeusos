import {
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  QueryConstraint,
  DocumentSnapshot,
  Firestore,
  collectionGroup,
} from 'firebase/firestore';
import {
  engagementsCollection,
  clientsCollection,
  fundersCollection,
  fundingSourcesCollection,
  approvalRequestsCollection,
  covenantsCollection,
  reportSubmissionsCollection,
  disbursementsCollection,
} from './collections';
import {
  engagementConverter,
  clientConverter,
  funderConverter,
  fundingSourceConverter,
  approvalRequestConverter,
  covenantConverter,
  reportSubmissionConverter,
  disbursementConverter,
} from './converters';
import {
  Engagement,
  EngagementDomain,
  EngagementStatus,
  Client,
  ClientType,
  ClientRelationshipStatus,
  Funder,
  FunderType,
  FundingSource,
  FundingSourceStatus,
  ApprovalRequest,
  ApprovalStatus,
  Covenant,
  CovenantStatus,
  ReportSubmission,
  ReportSubmissionStatus,
  Disbursement,
  DisbursementStatus,
} from '../types';

// ─────────────────────────────────────────────────────────────────
// PAGINATION OPTIONS
// ─────────────────────────────────────────────────────────────────

export interface PaginationOptions {
  pageSize?: number;
  startAfterDoc?: DocumentSnapshot;
}

export interface PaginatedResult<T> {
  items: T[];
  lastDoc?: DocumentSnapshot;
  hasMore: boolean;
}

// ─────────────────────────────────────────────────────────────────
// ENGAGEMENT QUERIES
// ─────────────────────────────────────────────────────────────────

export interface EngagementQueryFilters {
  domain?: EngagementDomain;
  status?: EngagementStatus | EngagementStatus[];
  clientId?: string;
  country?: string;
  leadId?: string;
  activeOnly?: boolean;
}

/**
 * Query engagements with filters
 */
export async function queryEngagements(
  db: Firestore,
  filters: EngagementQueryFilters = {},
  pagination: PaginationOptions = {}
): Promise<PaginatedResult<Engagement>> {
  const constraints: QueryConstraint[] = [];
  
  if (filters.domain) {
    constraints.push(where('domain', '==', filters.domain));
  }
  
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      constraints.push(where('status', 'in', filters.status));
    } else {
      constraints.push(where('status', '==', filters.status));
    }
  }
  
  if (filters.activeOnly) {
    constraints.push(where('status', 'in', ['onboarding', 'active', 'on_hold']));
  }
  
  if (filters.clientId) {
    constraints.push(where('clientId', '==', filters.clientId));
  }
  
  if (filters.country) {
    constraints.push(where('country', '==', filters.country));
  }
  
  if (filters.leadId) {
    constraints.push(where('team.leadId', '==', filters.leadId));
  }
  
  // Order by updated date
  constraints.push(orderBy('updatedAt', 'desc'));
  
  // Pagination
  const pageSize = pagination.pageSize || 20;
  constraints.push(limit(pageSize + 1)); // +1 to check if there's more
  
  if (pagination.startAfterDoc) {
    constraints.push(startAfter(pagination.startAfterDoc));
  }
  
  const q = query(
    engagementsCollection(db).withConverter(engagementConverter),
    ...constraints
  );
  
  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  const hasMore = docs.length > pageSize;
  const items = docs.slice(0, pageSize).map(doc => doc.data());
  const lastDoc = items.length > 0 ? docs[items.length - 1] : undefined;
  
  return { items, lastDoc, hasMore };
}

/**
 * Get engagements by client
 */
export async function getEngagementsByClient(
  db: Firestore,
  clientId: string
): Promise<Engagement[]> {
  const q = query(
    engagementsCollection(db).withConverter(engagementConverter),
    where('clientId', '==', clientId),
    orderBy('updatedAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

/**
 * Get active engagements count
 */
export async function getActiveEngagementsCount(
  db: Firestore
): Promise<number> {
  const q = query(
    engagementsCollection(db),
    where('status', 'in', ['onboarding', 'active', 'on_hold'])
  );
  
  const snapshot = await getDocs(q);
  return snapshot.size;
}

// ─────────────────────────────────────────────────────────────────
// CLIENT QUERIES
// ─────────────────────────────────────────────────────────────────

export interface ClientQueryFilters {
  type?: ClientType | ClientType[];
  relationshipStatus?: ClientRelationshipStatus | ClientRelationshipStatus[];
  country?: string;
  relationshipManagerId?: string;
  search?: string;
}

/**
 * Query clients with filters
 */
export async function queryClients(
  db: Firestore,
  filters: ClientQueryFilters = {},
  pagination: PaginationOptions = {}
): Promise<PaginatedResult<Client>> {
  const constraints: QueryConstraint[] = [];
  
  if (filters.type) {
    if (Array.isArray(filters.type)) {
      constraints.push(where('type', 'in', filters.type));
    } else {
      constraints.push(where('type', '==', filters.type));
    }
  }
  
  if (filters.relationshipStatus) {
    if (Array.isArray(filters.relationshipStatus)) {
      constraints.push(where('relationshipStatus', 'in', filters.relationshipStatus));
    } else {
      constraints.push(where('relationshipStatus', '==', filters.relationshipStatus));
    }
  }
  
  if (filters.relationshipManagerId) {
    constraints.push(where('relationshipManagerId', '==', filters.relationshipManagerId));
  }
  
  constraints.push(orderBy('displayName', 'asc'));
  
  const pageSize = pagination.pageSize || 20;
  constraints.push(limit(pageSize + 1));
  
  if (pagination.startAfterDoc) {
    constraints.push(startAfter(pagination.startAfterDoc));
  }
  
  const q = query(
    clientsCollection(db).withConverter(clientConverter),
    ...constraints
  );
  
  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  const hasMore = docs.length > pageSize;
  const items = docs.slice(0, pageSize).map(doc => doc.data());
  const lastDoc = items.length > 0 ? docs[items.length - 1] : undefined;
  
  return { items, lastDoc, hasMore };
}

/**
 * Get clients by relationship manager
 */
export async function getClientsByRelationshipManager(
  db: Firestore,
  managerId: string
): Promise<Client[]> {
  const q = query(
    clientsCollection(db).withConverter(clientConverter),
    where('relationshipManagerId', '==', managerId),
    where('relationshipStatus', '==', 'active'),
    orderBy('displayName', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// ─────────────────────────────────────────────────────────────────
// FUNDER QUERIES
// ─────────────────────────────────────────────────────────────────

export interface FunderQueryFilters {
  type?: FunderType | FunderType[];
  relationshipStatus?: string;
  country?: string;
}

/**
 * Query funders with filters
 */
export async function queryFunders(
  db: Firestore,
  filters: FunderQueryFilters = {},
  pagination: PaginationOptions = {}
): Promise<PaginatedResult<Funder>> {
  const constraints: QueryConstraint[] = [];
  
  if (filters.type) {
    if (Array.isArray(filters.type)) {
      constraints.push(where('type', 'in', filters.type));
    } else {
      constraints.push(where('type', '==', filters.type));
    }
  }
  
  if (filters.relationshipStatus) {
    constraints.push(where('relationshipStatus', '==', filters.relationshipStatus));
  }
  
  if (filters.country) {
    constraints.push(where('country', '==', filters.country));
  }
  
  constraints.push(orderBy('name', 'asc'));
  
  const pageSize = pagination.pageSize || 20;
  constraints.push(limit(pageSize + 1));
  
  if (pagination.startAfterDoc) {
    constraints.push(startAfter(pagination.startAfterDoc));
  }
  
  const q = query(
    fundersCollection(db).withConverter(funderConverter),
    ...constraints
  );
  
  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  const hasMore = docs.length > pageSize;
  const items = docs.slice(0, pageSize).map(doc => doc.data());
  const lastDoc = items.length > 0 ? docs[items.length - 1] : undefined;
  
  return { items, lastDoc, hasMore };
}

/**
 * Get active funders
 */
export async function getActiveFunders(
  db: Firestore
): Promise<Funder[]> {
  const q = query(
    fundersCollection(db).withConverter(funderConverter),
    where('relationshipStatus', '==', 'active'),
    orderBy('name', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// ─────────────────────────────────────────────────────────────────
// FUNDING SOURCE QUERIES
// ─────────────────────────────────────────────────────────────────

export interface FundingSourceQueryFilters {
  status?: FundingSourceStatus | FundingSourceStatus[];
  funderId?: string;
  category?: string;
}

/**
 * Get funding sources for engagement
 */
export async function getFundingSources(
  db: Firestore,
  engagementId: string,
  filters: FundingSourceQueryFilters = {}
): Promise<FundingSource[]> {
  const constraints: QueryConstraint[] = [];
  
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      constraints.push(where('status', 'in', filters.status));
    } else {
      constraints.push(where('status', '==', filters.status));
    }
  }
  
  if (filters.funderId) {
    constraints.push(where('funderId', '==', filters.funderId));
  }
  
  if (filters.category) {
    constraints.push(where('category', '==', filters.category));
  }
  
  const q = query(
    fundingSourcesCollection(db, engagementId).withConverter(fundingSourceConverter),
    ...constraints
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

/**
 * Get active funding sources
 */
export async function getActiveFundingSources(
  db: Firestore,
  engagementId: string
): Promise<FundingSource[]> {
  return getFundingSources(db, engagementId, {
    status: ['disbursing', 'fully_disbursed', 'repaying'],
  });
}

// ─────────────────────────────────────────────────────────────────
// DISBURSEMENT QUERIES
// ─────────────────────────────────────────────────────────────────

/**
 * Get disbursements for funding source
 */
export async function getDisbursements(
  db: Firestore,
  engagementId: string,
  fundingSourceId: string,
  status?: DisbursementStatus | DisbursementStatus[]
): Promise<Disbursement[]> {
  const constraints: QueryConstraint[] = [];
  
  if (status) {
    if (Array.isArray(status)) {
      constraints.push(where('status', 'in', status));
    } else {
      constraints.push(where('status', '==', status));
    }
  }
  
  constraints.push(orderBy('disbursementNumber', 'desc'));
  
  const q = query(
    disbursementsCollection(db, engagementId, fundingSourceId).withConverter(disbursementConverter),
    ...constraints
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// ─────────────────────────────────────────────────────────────────
// APPROVAL QUERIES
// ─────────────────────────────────────────────────────────────────

/**
 * Get approval requests by status
 */
export async function getApprovalsByStatus(
  db: Firestore,
  engagementId: string,
  status: ApprovalStatus | ApprovalStatus[]
): Promise<ApprovalRequest[]> {
  const statusArray = Array.isArray(status) ? status : [status];
  
  const q = query(
    approvalRequestsCollection(db, engagementId).withConverter(approvalRequestConverter),
    where('status', 'in', statusArray),
    orderBy('requestedAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

/**
 * Get pending approvals for engagement
 */
export async function getPendingApprovals(
  db: Firestore,
  engagementId: string
): Promise<ApprovalRequest[]> {
  return getApprovalsByStatus(db, engagementId, ['pending', 'in_review']);
}

/**
 * Get all pending approvals across engagements (collection group query)
 */
export async function getAllPendingApprovals(
  db: Firestore
): Promise<ApprovalRequest[]> {
  const q = query(
    collectionGroup(db, 'approvalRequests'),
    where('status', 'in', ['pending', 'in_review']),
    orderBy('requestedAt', 'desc'),
    limit(100)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as ApprovalRequest[];
}

// ─────────────────────────────────────────────────────────────────
// COVENANT QUERIES
// ─────────────────────────────────────────────────────────────────

/**
 * Get active covenants for engagement
 */
export async function getActiveCovenants(
  db: Firestore,
  engagementId: string
): Promise<Covenant[]> {
  const q = query(
    covenantsCollection(db, engagementId).withConverter(covenantConverter),
    where('isActive', '==', true),
    orderBy('name', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

/**
 * Get covenants by status
 */
export async function getCovenantsByStatus(
  db: Firestore,
  engagementId: string,
  status: CovenantStatus | CovenantStatus[]
): Promise<Covenant[]> {
  const statusArray = Array.isArray(status) ? status : [status];
  
  const q = query(
    covenantsCollection(db, engagementId).withConverter(covenantConverter),
    where('currentStatus', 'in', statusArray),
    where('isActive', '==', true)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

/**
 * Get covenants at risk or breached
 */
export async function getCovenantsAtRiskOrBreached(
  db: Firestore,
  engagementId: string
): Promise<Covenant[]> {
  return getCovenantsByStatus(db, engagementId, [
    'at_risk',
    'in_grace_period',
    'in_cure_period',
    'breached',
  ]);
}

// ─────────────────────────────────────────────────────────────────
// REPORT SUBMISSION QUERIES
// ─────────────────────────────────────────────────────────────────

/**
 * Get report submissions by status
 */
export async function getReportSubmissionsByStatus(
  db: Firestore,
  engagementId: string,
  status: ReportSubmissionStatus | ReportSubmissionStatus[]
): Promise<ReportSubmission[]> {
  const statusArray = Array.isArray(status) ? status : [status];
  
  const q = query(
    reportSubmissionsCollection(db, engagementId).withConverter(reportSubmissionConverter),
    where('status', 'in', statusArray),
    orderBy('dueDate', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

/**
 * Get overdue report submissions
 */
export async function getOverdueReportSubmissions(
  db: Firestore,
  engagementId: string
): Promise<ReportSubmission[]> {
  return getReportSubmissionsByStatus(db, engagementId, 'overdue');
}

/**
 * Get pending report submissions
 */
export async function getPendingReportSubmissions(
  db: Firestore,
  engagementId: string
): Promise<ReportSubmission[]> {
  return getReportSubmissionsByStatus(db, engagementId, ['not_started', 'in_progress']);
}
