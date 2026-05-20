import { 
  collection, 
  doc, 
  CollectionReference, 
  DocumentReference,
  Firestore 
} from 'firebase/firestore';
import { 
  Engagement, 
  Client, 
  Contact,
  Funder,
  FundingSource,
  Disbursement,
  ReportingRequirement,
  ReportSubmission,
  Covenant,
  CovenantMeasurement,
  ApprovalRequest,
} from '../types';

/**
 * COLLECTION PATHS
 * Centralized collection path definitions
 */
export const COLLECTION_PATHS = {
  // Root collections
  ENGAGEMENTS: 'engagements',
  CLIENTS: 'clients',
  FUNDERS: 'funders',
  USERS: 'users',
  
  // Engagement subcollections
  FUNDING_SOURCES: 'fundingSources',
  REPORTING_REQUIREMENTS: 'reportingRequirements',
  REPORT_SUBMISSIONS: 'reportSubmissions',
  COVENANTS: 'covenants',
  COVENANT_MEASUREMENTS: 'measurements',
  APPROVAL_REQUESTS: 'approvalRequests',
  DOCUMENTS: 'documents',
  ACTIVITY_LOG: 'activityLog',
  
  // Client subcollections
  CONTACTS: 'contacts',
  KYC_DOCUMENTS: 'kycDocuments',
  
  // Disbursement (under funding source)
  DISBURSEMENTS: 'disbursements',
} as const;

/**
 * Get typed collection reference
 */
export function getCollection<T>(
  db: Firestore,
  path: string
): CollectionReference<T> {
  return collection(db, path) as CollectionReference<T>;
}

/**
 * Get typed document reference
 */
export function getDoc<T>(
  db: Firestore,
  path: string,
  id: string
): DocumentReference<T> {
  return doc(db, path, id) as DocumentReference<T>;
}

// ─────────────────────────────────────────────────────────────────
// ENGAGEMENT COLLECTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Engagements collection
 */
export function engagementsCollection(db: Firestore): CollectionReference<Engagement> {
  return getCollection<Engagement>(db, COLLECTION_PATHS.ENGAGEMENTS);
}

/**
 * Engagement document
 */
export function engagementDoc(db: Firestore, id: string): DocumentReference<Engagement> {
  return getDoc<Engagement>(db, COLLECTION_PATHS.ENGAGEMENTS, id);
}

/**
 * Funding sources subcollection
 */
export function fundingSourcesCollection(
  db: Firestore, 
  engagementId: string
): CollectionReference<FundingSource> {
  return getCollection<FundingSource>(
    db, 
    `${COLLECTION_PATHS.ENGAGEMENTS}/${engagementId}/${COLLECTION_PATHS.FUNDING_SOURCES}` 
  );
}

/**
 * Funding source document
 */
export function fundingSourceDoc(
  db: Firestore,
  engagementId: string,
  fundingSourceId: string
): DocumentReference<FundingSource> {
  return doc(
    db,
    COLLECTION_PATHS.ENGAGEMENTS,
    engagementId,
    COLLECTION_PATHS.FUNDING_SOURCES,
    fundingSourceId
  ) as DocumentReference<FundingSource>;
}

/**
 * Disbursements subcollection (under funding source)
 */
export function disbursementsCollection(
  db: Firestore,
  engagementId: string,
  fundingSourceId: string
): CollectionReference<Disbursement> {
  return getCollection<Disbursement>(
    db,
    `${COLLECTION_PATHS.ENGAGEMENTS}/${engagementId}/${COLLECTION_PATHS.FUNDING_SOURCES}/${fundingSourceId}/${COLLECTION_PATHS.DISBURSEMENTS}` 
  );
}

/**
 * Reporting requirements subcollection
 */
export function reportingRequirementsCollection(
  db: Firestore,
  engagementId: string
): CollectionReference<ReportingRequirement> {
  return getCollection<ReportingRequirement>(
    db,
    `${COLLECTION_PATHS.ENGAGEMENTS}/${engagementId}/${COLLECTION_PATHS.REPORTING_REQUIREMENTS}` 
  );
}

/**
 * Report submissions subcollection
 */
export function reportSubmissionsCollection(
  db: Firestore,
  engagementId: string
): CollectionReference<ReportSubmission> {
  return getCollection<ReportSubmission>(
    db,
    `${COLLECTION_PATHS.ENGAGEMENTS}/${engagementId}/${COLLECTION_PATHS.REPORT_SUBMISSIONS}` 
  );
}

/**
 * Covenants subcollection
 */
export function covenantsCollection(
  db: Firestore,
  engagementId: string
): CollectionReference<Covenant> {
  return getCollection<Covenant>(
    db,
    `${COLLECTION_PATHS.ENGAGEMENTS}/${engagementId}/${COLLECTION_PATHS.COVENANTS}` 
  );
}

/**
 * Covenant document
 */
export function covenantDoc(
  db: Firestore,
  engagementId: string,
  covenantId: string
): DocumentReference<Covenant> {
  return doc(
    db,
    COLLECTION_PATHS.ENGAGEMENTS,
    engagementId,
    COLLECTION_PATHS.COVENANTS,
    covenantId
  ) as DocumentReference<Covenant>;
}

/**
 * Covenant measurements subcollection
 */
export function covenantMeasurementsCollection(
  db: Firestore,
  engagementId: string,
  covenantId: string
): CollectionReference<CovenantMeasurement> {
  return getCollection<CovenantMeasurement>(
    db,
    `${COLLECTION_PATHS.ENGAGEMENTS}/${engagementId}/${COLLECTION_PATHS.COVENANTS}/${covenantId}/${COLLECTION_PATHS.COVENANT_MEASUREMENTS}` 
  );
}

/**
 * Approval requests subcollection
 */
export function approvalRequestsCollection(
  db: Firestore,
  engagementId: string
): CollectionReference<ApprovalRequest> {
  return getCollection<ApprovalRequest>(
    db,
    `${COLLECTION_PATHS.ENGAGEMENTS}/${engagementId}/${COLLECTION_PATHS.APPROVAL_REQUESTS}` 
  );
}

/**
 * Approval request document
 */
export function approvalRequestDoc(
  db: Firestore,
  engagementId: string,
  requestId: string
): DocumentReference<ApprovalRequest> {
  return doc(
    db,
    COLLECTION_PATHS.ENGAGEMENTS,
    engagementId,
    COLLECTION_PATHS.APPROVAL_REQUESTS,
    requestId
  ) as DocumentReference<ApprovalRequest>;
}

// ─────────────────────────────────────────────────────────────────
// CLIENT COLLECTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Clients collection
 */
export function clientsCollection(db: Firestore): CollectionReference<Client> {
  return getCollection<Client>(db, COLLECTION_PATHS.CLIENTS);
}

/**
 * Client document
 */
export function clientDoc(db: Firestore, id: string): DocumentReference<Client> {
  return getDoc<Client>(db, COLLECTION_PATHS.CLIENTS, id);
}

/**
 * Contacts subcollection
 */
export function contactsCollection(
  db: Firestore,
  clientId: string
): CollectionReference<Contact> {
  return getCollection<Contact>(
    db,
    `${COLLECTION_PATHS.CLIENTS}/${clientId}/${COLLECTION_PATHS.CONTACTS}` 
  );
}

/**
 * Contact document
 */
export function contactDoc(
  db: Firestore,
  clientId: string,
  contactId: string
): DocumentReference<Contact> {
  return doc(
    db,
    COLLECTION_PATHS.CLIENTS,
    clientId,
    COLLECTION_PATHS.CONTACTS,
    contactId
  ) as DocumentReference<Contact>;
}

// ─────────────────────────────────────────────────────────────────
// FUNDER COLLECTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Funders collection
 */
export function fundersCollection(db: Firestore): CollectionReference<Funder> {
  return getCollection<Funder>(db, COLLECTION_PATHS.FUNDERS);
}

/**
 * Funder document
 */
export function funderDoc(db: Firestore, id: string): DocumentReference<Funder> {
  return getDoc<Funder>(db, COLLECTION_PATHS.FUNDERS, id);
}

// ─────────────────────────────────────────────────────────────────
// PATH BUILDER
// ─────────────────────────────────────────────────────────────────

/**
 * Collection path builder type
 */
export interface CollectionPathBuilder {
  engagement: (id: string) => {
    root: string;
    fundingSources: string;
    reportingRequirements: string;
    reportSubmissions: string;
    covenants: string;
    approvalRequests: string;
    documents: string;
    fundingSource: (fundingSourceId: string) => {
      root: string;
      disbursements: string;
    };
    covenant: (covenantId: string) => {
      root: string;
      measurements: string;
    };
  };
  client: (id: string) => {
    root: string;
    contacts: string;
    kycDocuments: string;
  };
  funder: (id: string) => {
    root: string;
  };
}

/**
 * Build collection paths
 */
export const paths: CollectionPathBuilder = {
  engagement: (id: string) => ({
    root: `${COLLECTION_PATHS.ENGAGEMENTS}/${id}`,
    fundingSources: `${COLLECTION_PATHS.ENGAGEMENTS}/${id}/${COLLECTION_PATHS.FUNDING_SOURCES}`,
    reportingRequirements: `${COLLECTION_PATHS.ENGAGEMENTS}/${id}/${COLLECTION_PATHS.REPORTING_REQUIREMENTS}`,
    reportSubmissions: `${COLLECTION_PATHS.ENGAGEMENTS}/${id}/${COLLECTION_PATHS.REPORT_SUBMISSIONS}`,
    covenants: `${COLLECTION_PATHS.ENGAGEMENTS}/${id}/${COLLECTION_PATHS.COVENANTS}`,
    approvalRequests: `${COLLECTION_PATHS.ENGAGEMENTS}/${id}/${COLLECTION_PATHS.APPROVAL_REQUESTS}`,
    documents: `${COLLECTION_PATHS.ENGAGEMENTS}/${id}/${COLLECTION_PATHS.DOCUMENTS}`,
    fundingSource: (fundingSourceId: string) => ({
      root: `${COLLECTION_PATHS.ENGAGEMENTS}/${id}/${COLLECTION_PATHS.FUNDING_SOURCES}/${fundingSourceId}`,
      disbursements: `${COLLECTION_PATHS.ENGAGEMENTS}/${id}/${COLLECTION_PATHS.FUNDING_SOURCES}/${fundingSourceId}/${COLLECTION_PATHS.DISBURSEMENTS}`,
    }),
    covenant: (covenantId: string) => ({
      root: `${COLLECTION_PATHS.ENGAGEMENTS}/${id}/${COLLECTION_PATHS.COVENANTS}/${covenantId}`,
      measurements: `${COLLECTION_PATHS.ENGAGEMENTS}/${id}/${COLLECTION_PATHS.COVENANTS}/${covenantId}/${COLLECTION_PATHS.COVENANT_MEASUREMENTS}`,
    }),
  }),
  client: (id: string) => ({
    root: `${COLLECTION_PATHS.CLIENTS}/${id}`,
    contacts: `${COLLECTION_PATHS.CLIENTS}/${id}/${COLLECTION_PATHS.CONTACTS}`,
    kycDocuments: `${COLLECTION_PATHS.CLIENTS}/${id}/${COLLECTION_PATHS.KYC_DOCUMENTS}`,
  }),
  funder: (id: string) => ({
    root: `${COLLECTION_PATHS.FUNDERS}/${id}`,
  }),
};
