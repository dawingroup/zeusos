/**
 * Client Service - Advisory client management
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
  limit,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  AdvisoryClient,
  ClientSummary,
  ClientStatus,
  ClientTier,
  KYCStatus,
  AMLStatus,
  ComplianceIssue,
  ClientContact
} from '../types';
import type { InvestmentMandate, MandateStatus } from '../types';
import type { RiskAssessment } from '../types';
import type { ComplianceStatus } from '../types';

// Use root-level collections to match Firestore rules
const CLIENTS_COLLECTION = 'clients';
const MANDATES_COLLECTION = 'mandates';
const RISK_ASSESSMENTS_COLLECTION = 'riskAssessments';

// ==================== Client CRUD ====================

export async function createClient(
  data: Omit<AdvisoryClient, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const clientCode = await generateClientCode(data.clientType);
  
  const clientData = {
    ...data,
    clientCode,
    totalCommitments: { amount: 0, currency: 'USD' },
    totalDeployed: { amount: 0, currency: 'USD' },
    unrealizedValue: { amount: 0, currency: 'USD' },
    realizedValue: { amount: 0, currency: 'USD' },
    portfolioIds: [],
    holdingIds: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  const docRef = await addDoc(collection(db, CLIENTS_COLLECTION), clientData);
  return docRef.id;
}

export async function getClient(clientId: string): Promise<AdvisoryClient | null> {
  const docRef = doc(db, CLIENTS_COLLECTION, clientId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return {
    id: docSnap.id,
    ...docSnap.data()
  } as AdvisoryClient;
}

export async function updateClient(
  clientId: string,
  updates: Partial<AdvisoryClient>
): Promise<void> {
  const docRef = doc(db, CLIENTS_COLLECTION, clientId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now()
  });
}

export async function getClients(options: {
  engagementId?: string;
  status?: ClientStatus[];
  tier?: ClientTier[];
  relationshipManagerId?: string;
  searchTerm?: string;
  limit?: number;
} = {}): Promise<ClientSummary[]> {
  let q = query(collection(db, CLIENTS_COLLECTION));

  if (options.engagementId) {
    q = query(q, where('engagementId', '==', options.engagementId));
  }

  if (options.status?.length) {
    q = query(q, where('status', 'in', options.status));
  }

  if (options.tier?.length) {
    q = query(q, where('tier', 'in', options.tier));
  }

  if (options.relationshipManagerId) {
    q = query(q, where('relationshipManager.userId', '==', options.relationshipManagerId));
  }

  q = query(q, orderBy('legalName'));

  if (options.limit) {
    q = query(q, limit(options.limit));
  }

  const snapshot = await getDocs(q);
  
  let clients = snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    clientCode: docSnap.data().clientCode,
    legalName: docSnap.data().legalName,
    tradingName: docSnap.data().tradingName,
    clientType: docSnap.data().clientType,
    tier: docSnap.data().tier,
    status: docSnap.data().status,
    jurisdiction: docSnap.data().jurisdiction.country,
    totalCommitments: docSnap.data().totalCommitments,
    activePortfolios: docSnap.data().portfolioIds?.length || 0,
    complianceStatus: docSnap.data().compliance.status,
    relationshipManager: docSnap.data().relationshipManager?.name,
    lastActivityAt: docSnap.data().lastActivityAt
  } as ClientSummary));

  // Client-side search filtering
  if (options.searchTerm) {
    const term = options.searchTerm.toLowerCase();
    clients = clients.filter(c => 
      c.legalName.toLowerCase().includes(term) ||
      c.tradingName?.toLowerCase().includes(term) ||
      c.clientCode.toLowerCase().includes(term)
    );
  }

  return clients;
}

// ==================== Client Status Management ====================

export async function updateClientStatus(
  clientId: string,
  newStatus: ClientStatus,
  reason?: string
): Promise<void> {
  const client = await getClient(clientId);
  if (!client) throw new Error('Client not found');

  const updates: Partial<AdvisoryClient> = {
    status: newStatus,
    updatedAt: Timestamp.now(),
    lastActivityAt: Timestamp.now()
  };

  if (newStatus === 'active' && !client.activatedAt) {
    updates.activatedAt = Timestamp.now();
  }

  await updateClient(clientId, updates);

  // Create status change audit record
  await addDoc(collection(db, `${CLIENTS_COLLECTION}/${clientId}/statusHistory`), {
    previousStatus: client.status,
    newStatus,
    reason,
    changedAt: Timestamp.now(),
    changedBy: 'system'
  });
}

// ==================== Compliance Management ====================

export async function updateKYCStatus(
  clientId: string,
  kycUpdate: Partial<KYCStatus>
): Promise<void> {
  const client = await getClient(clientId);
  if (!client) throw new Error('Client not found');

  const updatedKYC: KYCStatus = {
    ...client.compliance.kyc,
    ...kycUpdate
  };

  const overallStatus = calculateComplianceStatus(
    updatedKYC,
    client.compliance.aml,
    client.compliance.taxCompliance
  );

  await updateClient(clientId, {
    compliance: {
      ...client.compliance,
      kyc: updatedKYC,
      status: overallStatus
    }
  });

  // Auto-activate if all compliance complete
  if (
    client.status === 'onboarding' &&
    overallStatus === 'compliant' &&
    updatedKYC.status === 'approved'
  ) {
    await updateClientStatus(clientId, 'active', 'Compliance requirements met');
  }
}

export async function updateAMLStatus(
  clientId: string,
  amlUpdate: Partial<AMLStatus>
): Promise<void> {
  const client = await getClient(clientId);
  if (!client) throw new Error('Client not found');

  const updatedAML: AMLStatus = {
    ...client.compliance.aml,
    ...amlUpdate
  };

  const overallStatus = calculateComplianceStatus(
    client.compliance.kyc,
    updatedAML,
    client.compliance.taxCompliance
  );

  await updateClient(clientId, {
    compliance: {
      ...client.compliance,
      aml: updatedAML,
      status: overallStatus
    }
  });

  // Suspend if AML flagged
  if (updatedAML.status === 'flagged' || updatedAML.status === 'blocked') {
    await updateClientStatus(clientId, 'suspended', 'AML compliance issue');
  }
}

export async function raiseComplianceIssue(
  clientId: string,
  issue: Omit<ComplianceIssue, 'id' | 'raisedAt'>
): Promise<string> {
  const client = await getClient(clientId);
  if (!client) throw new Error('Client not found');

  const newIssue: ComplianceIssue = {
    ...issue,
    id: generateId(),
    raisedAt: Timestamp.now()
  };

  const issues = [...(client.compliance.issues || []), newIssue];

  await updateClient(clientId, {
    compliance: {
      ...client.compliance,
      issues,
      status: issue.severity === 'critical' ? 'non_compliant' : client.compliance.status
    }
  });

  return newIssue.id;
}

function calculateComplianceStatus(
  kyc: KYCStatus,
  aml: AMLStatus,
  _tax: unknown
): ComplianceStatus {
  if (aml.status === 'blocked') return 'non_compliant';
  if (aml.status === 'flagged') return 'review_required';
  if (kyc.status === 'rejected') return 'non_compliant';
  if (kyc.status === 'expired') return 'review_required';
  if (kyc.status !== 'approved') return 'pending';
  if (aml.status !== 'cleared') return 'pending';
  return 'compliant';
}

// ==================== Mandate Management ====================

export async function createMandate(
  data: Omit<InvestmentMandate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const client = await getClient(data.clientId);
  if (!client) throw new Error('Client not found');

  const mandateCode = `MAN-${client.clientCode}-${(client.mandates?.length || 0) + 1}`;

  const mandateData = {
    ...data,
    mandateCode,
    deployedAmount: { amount: 0, currency: data.commitmentAmount.currency },
    remainingCommitment: { ...data.commitmentAmount },
    portfolioIds: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  const docRef = await addDoc(collection(db, MANDATES_COLLECTION), mandateData);

  // Update client with new mandate reference
  await updateClient(data.clientId, {
    mandates: [...(client.mandates || []), { ...mandateData, id: docRef.id } as InvestmentMandate]
  });

  return docRef.id;
}

export async function getMandate(mandateId: string): Promise<InvestmentMandate | null> {
  const docRef = doc(db, MANDATES_COLLECTION, mandateId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return {
    id: docSnap.id,
    ...docSnap.data()
  } as InvestmentMandate;
}

export async function getClientMandates(
  clientId: string,
  status?: MandateStatus[]
): Promise<InvestmentMandate[]> {
  let q = query(
    collection(db, MANDATES_COLLECTION),
    where('clientId', '==', clientId)
  );

  if (status?.length) {
    q = query(q, where('status', 'in', status));
  }

  q = query(q, orderBy('createdAt', 'desc'));

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  } as InvestmentMandate));
}

export async function updateMandateStatus(
  mandateId: string,
  newStatus: MandateStatus,
  approvedBy?: string
): Promise<void> {
  const updates: Partial<InvestmentMandate> = {
    status: newStatus,
    updatedAt: Timestamp.now()
  };

  if (newStatus === 'active' && approvedBy) {
    updates.approvedAt = Timestamp.now();
    updates.approvedBy = approvedBy;
  }

  const mandateRef = doc(db, MANDATES_COLLECTION, mandateId);
  await updateDoc(mandateRef, updates);
}

// ==================== Risk Assessment ====================

export async function createRiskAssessment(
  clientId: string,
  assessment: Omit<RiskAssessment, 'assessmentId'>
): Promise<string> {
  const assessmentData = {
    ...assessment,
    clientId,
    completedAt: Timestamp.now()
  };

  const docRef = await addDoc(collection(db, RISK_ASSESSMENTS_COLLECTION), assessmentData);

  // Update client with new risk profile
  await updateClient(clientId, {
    riskProfile: assessment.profile
  });

  return docRef.id;
}

export async function getRiskAssessmentHistory(
  clientId: string
): Promise<RiskAssessment[]> {
  const q = query(
    collection(db, RISK_ASSESSMENTS_COLLECTION),
    where('clientId', '==', clientId),
    orderBy('completedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => ({
    assessmentId: docSnap.id,
    ...docSnap.data()
  } as RiskAssessment));
}

// ==================== Contact Management ====================

export async function addClientContact(
  clientId: string,
  contact: Omit<ClientContact, 'id' | 'createdAt'>
): Promise<string> {
  const client = await getClient(clientId);
  if (!client) throw new Error('Client not found');

  const newContact: ClientContact = {
    ...contact,
    id: generateId(),
    createdAt: Timestamp.now()
  };

  const contacts = [...client.contacts, newContact];

  // Set as primary if first contact or explicitly requested
  let primaryContactId = client.primaryContactId;
  if (contacts.length === 1 || contact.isPrimary) {
    primaryContactId = newContact.id;
  }

  await updateClient(clientId, { contacts, primaryContactId });

  return newContact.id;
}

export async function updateClientContact(
  clientId: string,
  contactId: string,
  updates: Partial<ClientContact>
): Promise<void> {
  const client = await getClient(clientId);
  if (!client) throw new Error('Client not found');

  const contacts = client.contacts.map(c => 
    c.id === contactId ? { ...c, ...updates } : c
  );

  await updateClient(clientId, { contacts });
}

export async function removeClientContact(
  clientId: string,
  contactId: string
): Promise<void> {
  const client = await getClient(clientId);
  if (!client) throw new Error('Client not found');

  const contacts = client.contacts.filter(c => c.id !== contactId);
  
  let primaryContactId = client.primaryContactId;
  if (primaryContactId === contactId) {
    primaryContactId = contacts[0]?.id;
  }

  await updateClient(clientId, { contacts, primaryContactId });
}

// ==================== Subscriptions ====================

export function subscribeToClient(
  clientId: string,
  callback: (client: AdvisoryClient | null) => void
): () => void {
  const docRef = doc(db, CLIENTS_COLLECTION, clientId);
  
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({
        id: docSnap.id,
        ...docSnap.data()
      } as AdvisoryClient);
    } else {
      callback(null);
    }
  });
}

export function subscribeToClients(
  options: {
    engagementId?: string;
    status?: ClientStatus[];
    relationshipManagerId?: string;
  },
  callback: (clients: ClientSummary[]) => void
): () => void {
  let q = query(collection(db, CLIENTS_COLLECTION));

  if (options.engagementId) {
    q = query(q, where('engagementId', '==', options.engagementId));
  }

  if (options.status?.length) {
    q = query(q, where('status', 'in', options.status));
  }

  if (options.relationshipManagerId) {
    q = query(q, where('relationshipManager.userId', '==', options.relationshipManagerId));
  }

  q = query(q, orderBy('legalName'));

  return onSnapshot(q, (snapshot) => {
    const clients = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      clientCode: docSnap.data().clientCode,
      legalName: docSnap.data().legalName,
      tradingName: docSnap.data().tradingName,
      clientType: docSnap.data().clientType,
      tier: docSnap.data().tier,
      status: docSnap.data().status,
      jurisdiction: docSnap.data().jurisdiction.country,
      totalCommitments: docSnap.data().totalCommitments,
      activePortfolios: docSnap.data().portfolioIds?.length || 0,
      complianceStatus: docSnap.data().compliance.status,
      relationshipManager: docSnap.data().relationshipManager?.name,
      lastActivityAt: docSnap.data().lastActivityAt
    } as ClientSummary));

    callback(clients);
  });
}

// ==================== Helpers ====================

async function generateClientCode(clientType: string): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const typePrefix = clientType.slice(0, 3).toUpperCase();
  
  // Get count for sequence
  const q = query(
    collection(db, CLIENTS_COLLECTION),
    where('clientCode', '>=', `AC-${typePrefix}-${year}`),
    where('clientCode', '<', `AC-${typePrefix}-${year}~`)
  );
  const snapshot = await getDocs(q);
  const sequence = (snapshot.size + 1).toString().padStart(4, '0');
  
  return `AC-${typePrefix}-${year}-${sequence}`;
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}
