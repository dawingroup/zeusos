/**
 * Contract Service - DawinOS v2.0
 * 
 * Service layer for contract management operations:
 * - CRUD operations
 * - Status lifecycle management
 * - Amendments and renewals
 * - Template processing
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
  limit,
  startAfter,
  Timestamp,
  runTransaction,
  DocumentSnapshot,
} from 'firebase/firestore';
import { addMonths, addDays, differenceInDays } from 'date-fns';

import { db } from '../../../shared/services/firebase/firestore';
import { getEmployee } from './employee.service';

import {
  Contract,
  ContractSummary,
  ContractAmendment,
  ContractStatus,
  ContractFilters,
  ContractSort,
  ContractListResult,
  ContractStats,
  CreateContractInput,
  UpdateContractInput,
  CreateAmendmentInput,
  RenewContractInput,
  TerminateContractInput,
  ContractAuditEntry,
  ContractSignatory,
  ContractType,
  CONTRACT_NUMBER_CONFIG,
  AMENDMENT_NUMBER_CONFIG,
  DEFAULT_NOTICE_PERIODS,
  DEFAULT_LEAVE_ENTITLEMENTS,
  DEFAULT_PROBATION_CONFIG,
  VALID_CONTRACT_STATUS_TRANSITIONS,
} from '../types/contract.types';

const CONTRACTS_COLLECTION = 'contracts';
const AMENDMENTS_COLLECTION = 'contract_amendments';
const COUNTERS_COLLECTION = 'counters';

// ============================================================================
// Contract Number Generation
// ============================================================================

/**
 * Generate unique contract number
 * Format: CTR-{SUBSIDIARY}-{YEAR}-{SEQ}
 */
async function generateContractNumber(subsidiaryId: string): Promise<string> {
  const year = new Date().getFullYear();
  const counterId = `contract_${subsidiaryId}_${year}`;
  const counterRef = doc(db, COUNTERS_COLLECTION, counterId);

  const newNumber = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    
    let sequence = 1;
    if (counterDoc.exists()) {
      sequence = (counterDoc.data().value || 0) + 1;
    }
    
    transaction.set(counterRef, { value: sequence }, { merge: true });
    
    return sequence;
  });

  const sequenceStr = String(newNumber).padStart(CONTRACT_NUMBER_CONFIG.sequenceLength, '0');
  const subsidiaryCode = subsidiaryId.substring(0, 3).toUpperCase();
  
  return `${CONTRACT_NUMBER_CONFIG.prefix}${CONTRACT_NUMBER_CONFIG.separator}${subsidiaryCode}${CONTRACT_NUMBER_CONFIG.separator}${year}${CONTRACT_NUMBER_CONFIG.separator}${sequenceStr}`;
}

/**
 * Generate amendment number
 * Format: AMD-{CONTRACT_NUMBER}-{SEQ}
 */
async function generateAmendmentNumber(contractNumber: string): Promise<string> {
  const counterId = `amendment_${contractNumber}`;
  const counterRef = doc(db, COUNTERS_COLLECTION, counterId);

  const newNumber = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    
    let sequence = 1;
    if (counterDoc.exists()) {
      sequence = (counterDoc.data().value || 0) + 1;
    }
    
    transaction.set(counterRef, { value: sequence }, { merge: true });
    
    return sequence;
  });

  const sequenceStr = String(newNumber).padStart(AMENDMENT_NUMBER_CONFIG.sequenceLength, '0');
  
  return `${AMENDMENT_NUMBER_CONFIG.prefix}${AMENDMENT_NUMBER_CONFIG.separator}${contractNumber}${AMENDMENT_NUMBER_CONFIG.separator}${sequenceStr}`;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new contract
 */
export async function createContract(
  input: CreateContractInput,
  userId: string,
  userName: string
): Promise<Contract> {
  // Get employee details
  const employee = await getEmployee(input.employeeId);
  if (!employee) throw new Error('Employee not found');

  // Generate contract number
  const contractNumber = await generateContractNumber(input.subsidiaryId);
  const contractId = doc(collection(db, CONTRACTS_COLLECTION)).id;
  const now = Timestamp.now();

  // Calculate probation dates if applicable
  let probation = undefined;
  if (input.probation) {
    const probationStart = Timestamp.fromDate(input.startDate);
    const probationEnd = Timestamp.fromDate(
      addMonths(input.startDate, input.probation.duration)
    );
    probation = {
      duration: input.probation.duration,
      startDate: probationStart,
      endDate: probationEnd,
      reviewDates: [
        Timestamp.fromDate(addMonths(input.startDate, Math.floor(input.probation.duration / 2))),
        Timestamp.fromDate(addDays(probationEnd.toDate(), -7)),
      ],
      extendable: input.probation.extendable ?? true,
      maxExtensions: DEFAULT_PROBATION_CONFIG.maxExtensions,
      extensionDuration: DEFAULT_PROBATION_CONFIG.extensionDurationMonths,
      currentExtension: 0,
    };
  }

  // Build contract object
  const contract: Contract = {
    id: contractId,
    contractNumber,
    subsidiaryId: input.subsidiaryId,
    
    employeeId: input.employeeId,
    employeeNumber: employee.employeeNumber,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    
    contractType: input.contractType,
    status: 'draft',
    
    effectiveDate: Timestamp.fromDate(input.effectiveDate),
    startDate: Timestamp.fromDate(input.startDate),
    endDate: input.endDate ? Timestamp.fromDate(input.endDate) : undefined,
    
    position: input.position,
    
    compensation: {
      baseSalary: input.compensation.baseSalary,
      currency: input.compensation.currency || 'UGX',
      paymentFrequency: input.compensation.paymentFrequency || 'monthly',
      paymentMethod: input.compensation.paymentMethod,
      allowances: input.compensation.allowances,
    },
    
    schedule: {
      type: input.schedule.type,
      hoursPerWeek: input.schedule.hoursPerWeek,
      workDays: input.schedule.workDays,
      overtimeEligible: input.schedule.overtimeEligible ?? false,
      remoteWorkAllowed: input.schedule.remoteWorkAllowed ?? false,
    },
    
    leaveEntitlements: {
      ...DEFAULT_LEAVE_ENTITLEMENTS,
      ...input.leaveEntitlements,
    },
    
    noticePeriod: {
      ...DEFAULT_NOTICE_PERIODS[input.contractType],
      ...input.noticePeriod,
    },
    
    probation,
    
    specialClauses: input.specialClauses?.map(clause => ({
      ...clause,
      isStandard: false,
    })),
    
    signatories: [
      {
        role: 'employee',
        name: `${employee.firstName} ${employee.lastName}`,
        email: employee.email,
        signatureMethod: 'pending',
      },
      {
        role: 'hr_manager',
        name: userName,
        signatureMethod: 'pending',
      },
    ],
    
    documents: [],
    templateId: input.templateId,
    
    version: 1,
    createdBy: userId,
    createdAt: now,
    updatedBy: userId,
    updatedAt: now,
  };

  // Save to Firestore
  await setDoc(doc(db, CONTRACTS_COLLECTION, contractId), contract);

  // Add audit entry
  await addContractAuditEntry(contractId, {
    action: 'created',
    description: `Contract ${contractNumber} created for ${contract.employeeName}`,
    newValue: { contractType: input.contractType, baseSalary: input.compensation.baseSalary },
    performedBy: userId,
    performedByName: userName,
  });

  return contract;
}

/**
 * Get contract by ID
 */
export async function getContract(contractId: string): Promise<Contract | null> {
  const docRef = doc(db, CONTRACTS_COLLECTION, contractId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return docSnap.data() as Contract;
}

/**
 * Get contract by contract number
 */
export async function getContractByNumber(contractNumber: string): Promise<Contract | null> {
  const q = query(
    collection(db, CONTRACTS_COLLECTION),
    where('contractNumber', '==', contractNumber),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  return snapshot.docs[0].data() as Contract;
}

/**
 * Get active contract for employee
 */
export async function getActiveContractForEmployee(employeeId: string): Promise<Contract | null> {
  const q = query(
    collection(db, CONTRACTS_COLLECTION),
    where('employeeId', '==', employeeId),
    where('status', '==', 'active'),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  return snapshot.docs[0].data() as Contract;
}

/**
 * Get all contracts for employee
 */
export async function getContractsForEmployee(employeeId: string): Promise<Contract[]> {
  const q = query(
    collection(db, CONTRACTS_COLLECTION),
    where('employeeId', '==', employeeId),
    orderBy('effectiveDate', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Contract);
}

/**
 * Update contract
 */
export async function updateContract(
  contractId: string,
  input: UpdateContractInput,
  userId: string,
  userName: string
): Promise<Contract> {
  const existing = await getContract(contractId);
  if (!existing) throw new Error('Contract not found');

  // Can only update draft or pending contracts
  if (!['draft', 'pending_approval'].includes(existing.status)) {
    throw new Error('Cannot update contract in current status. Create an amendment instead.');
  }

  const updates: Record<string, any> = {
    version: existing.version + 1,
    updatedBy: userId,
    updatedAt: Timestamp.now(),
  };

  if (input.contractType) updates.contractType = input.contractType;
  if (input.effectiveDate) updates.effectiveDate = Timestamp.fromDate(input.effectiveDate);
  if (input.endDate) updates.endDate = Timestamp.fromDate(input.endDate);
  if (input.position) updates.position = { ...existing.position, ...input.position };
  if (input.compensation) updates.compensation = { ...existing.compensation, ...input.compensation };
  if (input.schedule) updates.schedule = { ...existing.schedule, ...input.schedule };
  if (input.leaveEntitlements) updates.leaveEntitlements = { ...existing.leaveEntitlements, ...input.leaveEntitlements };
  if (input.benefits) updates.benefits = { ...existing.benefits, ...input.benefits };
  if (input.noticePeriod) updates.noticePeriod = { ...existing.noticePeriod, ...input.noticePeriod };
  if (input.restrictiveCovenants) updates.restrictiveCovenants = { ...existing.restrictiveCovenants, ...input.restrictiveCovenants };
  if (input.specialClauses) updates.specialClauses = input.specialClauses.map(c => ({ ...c, isStandard: c.isStandard ?? false }));

  await updateDoc(doc(db, CONTRACTS_COLLECTION, contractId), updates);

  // Add audit entry
  await addContractAuditEntry(contractId, {
    action: 'updated',
    description: 'Contract details updated',
    previousValue: input,
    newValue: updates,
    performedBy: userId,
    performedByName: userName,
  });

  return { ...existing, ...updates } as Contract;
}

/**
 * List contracts with filters and pagination
 */
export async function listContracts(
  filters: ContractFilters = {},
  sort: ContractSort = { field: 'updatedAt', direction: 'desc' },
  pageSize: number = 20,
  cursor?: DocumentSnapshot
): Promise<ContractListResult> {
  let q = query(collection(db, CONTRACTS_COLLECTION));

  // Apply filters
  if (filters.subsidiaryId) {
    q = query(q, where('subsidiaryId', '==', filters.subsidiaryId));
  }
  if (filters.employeeId) {
    q = query(q, where('employeeId', '==', filters.employeeId));
  }
  if (filters.departmentId) {
    q = query(q, where('position.departmentId', '==', filters.departmentId));
  }
  if (filters.contractType?.length) {
    q = query(q, where('contractType', 'in', filters.contractType));
  }
  if (filters.status?.length) {
    q = query(q, where('status', 'in', filters.status));
  }

  // Apply sorting
  const sortField = getSortField(sort.field);
  q = query(q, orderBy(sortField, sort.direction));

  // Apply pagination
  q = query(q, limit(pageSize + 1));
  if (cursor) {
    q = query(q, startAfter(cursor));
  }

  const snapshot = await getDocs(q);
  const hasMore = snapshot.docs.length > pageSize;
  const docs = hasMore ? snapshot.docs.slice(0, -1) : snapshot.docs;

  const contracts: ContractSummary[] = docs.map(doc => {
    const data = doc.data() as Contract;
    return contractToSummary(data);
  });

  // Apply client-side filters for complex queries
  let filteredContracts = contracts;
  
  if (filters.expiringWithinDays !== undefined) {
    const threshold = addDays(new Date(), filters.expiringWithinDays);
    filteredContracts = filteredContracts.filter(c => {
      if (!c.endDate) return false;
      const endDate = c.endDate.toDate();
      return endDate <= threshold && endDate >= new Date();
    });
  }

  if (filters.salaryMin !== undefined) {
    filteredContracts = filteredContracts.filter(c => c.baseSalary >= filters.salaryMin!);
  }

  if (filters.salaryMax !== undefined) {
    filteredContracts = filteredContracts.filter(c => c.baseSalary <= filters.salaryMax!);
  }

  return {
    contracts: filteredContracts,
    total: filteredContracts.length,
    hasMore,
    nextCursor: hasMore ? docs[docs.length - 1].id : undefined,
  };
}

// ============================================================================
// Status Management
// ============================================================================

/**
 * Change contract status
 */
export async function changeContractStatus(
  contractId: string,
  newStatus: ContractStatus,
  userId: string,
  userName: string,
  reason?: string
): Promise<Contract> {
  const contract = await getContract(contractId);
  if (!contract) throw new Error('Contract not found');

  // Validate transition
  const validTransitions = VALID_CONTRACT_STATUS_TRANSITIONS[contract.status];
  if (!validTransitions.includes(newStatus)) {
    throw new Error(`Invalid status transition from ${contract.status} to ${newStatus}`);
  }

  const updates: Partial<Contract> = {
    status: newStatus,
    updatedBy: userId,
    updatedAt: Timestamp.now(),
  };

  // Handle specific status changes
  if (newStatus === 'active') {
    updates.signedDate = Timestamp.now();
  }

  if (newStatus === 'pending_approval') {
    // Validate all required fields are present
    if (!contract.signatories?.length) {
      throw new Error('Contract must have signatories before submitting for approval');
    }
  }

  await updateDoc(doc(db, CONTRACTS_COLLECTION, contractId), updates);

  // Add audit entry
  await addContractAuditEntry(contractId, {
    action: 'status_changed',
    description: `Contract status changed from ${contract.status} to ${newStatus}${reason ? `: ${reason}` : ''}`,
    previousValue: { status: contract.status },
    newValue: { status: newStatus },
    performedBy: userId,
    performedByName: userName,
  });

  return { ...contract, ...updates } as Contract;
}

/**
 * Approve contract
 */
export async function approveContract(
  contractId: string,
  userId: string,
  userName: string
): Promise<Contract> {
  const contract = await getContract(contractId);
  if (!contract) throw new Error('Contract not found');

  if (contract.status !== 'pending_approval') {
    throw new Error('Contract is not pending approval');
  }

  const updates: Partial<Contract> = {
    status: 'pending_signature',
    approvedBy: userId,
    approvedAt: Timestamp.now(),
    updatedBy: userId,
    updatedAt: Timestamp.now(),
  };

  await updateDoc(doc(db, CONTRACTS_COLLECTION, contractId), updates);

  // Add audit entry
  await addContractAuditEntry(contractId, {
    action: 'approved',
    description: 'Contract approved',
    performedBy: userId,
    performedByName: userName,
  });

  return { ...contract, ...updates } as Contract;
}

/**
 * Sign contract
 */
export async function signContract(
  contractId: string,
  signatoryRole: ContractSignatory['role'],
  userId: string,
  userName: string,
  signature?: string
): Promise<Contract> {
  const contract = await getContract(contractId);
  if (!contract) throw new Error('Contract not found');

  if (contract.status !== 'pending_signature') {
    throw new Error('Contract is not pending signature');
  }

  // Find and update signatory
  const signatories = contract.signatories.map(s => {
    if (s.role === signatoryRole && s.signatureMethod === 'pending') {
      return {
        ...s,
        signedAt: Timestamp.now(),
        signature: signature || 'electronic',
        signatureMethod: 'electronic' as const,
      };
    }
    return s;
  });

  // Check if all required signatures are complete
  const allSigned = signatories.every(s => s.signatureMethod !== 'pending');
  const newStatus = allSigned ? 'active' : 'pending_signature';

  const updates: Partial<Contract> = {
    signatories,
    status: newStatus,
    signedDate: allSigned ? Timestamp.now() : undefined,
    updatedBy: userId,
    updatedAt: Timestamp.now(),
  };

  await updateDoc(doc(db, CONTRACTS_COLLECTION, contractId), updates);

  // Add audit entry
  await addContractAuditEntry(contractId, {
    action: 'signed',
    description: `Contract signed by ${signatoryRole}`,
    performedBy: userId,
    performedByName: userName,
  });

  return { ...contract, ...updates } as Contract;
}

// ============================================================================
// Amendments
// ============================================================================

/**
 * Create contract amendment
 */
export async function createAmendment(
  input: CreateAmendmentInput,
  userId: string,
  userName: string
): Promise<ContractAmendment> {
  const contract = await getContract(input.contractId);
  if (!contract) throw new Error('Contract not found');

  if (contract.status !== 'active') {
    throw new Error('Can only amend active contracts');
  }

  const amendmentNumber = await generateAmendmentNumber(contract.contractNumber);
  const amendmentId = doc(collection(db, AMENDMENTS_COLLECTION)).id;
  const now = Timestamp.now();

  const amendment: ContractAmendment = {
    id: amendmentId,
    amendmentNumber,
    contractId: input.contractId,
    contractNumber: contract.contractNumber,
    employeeId: contract.employeeId,
    employeeName: contract.employeeName,
    
    amendmentType: input.amendmentType,
    title: input.title,
    description: input.description,
    effectiveDate: Timestamp.fromDate(input.effectiveDate),
    
    changes: input.changes,
    
    status: 'draft',
    
    signatories: [
      {
        role: 'employee',
        name: contract.employeeName,
        signatureMethod: 'pending',
      },
      {
        role: 'hr_manager',
        name: userName,
        signatureMethod: 'pending',
      },
    ],
    
    documents: [],
    
    createdBy: userId,
    createdAt: now,
  };

  await setDoc(doc(db, AMENDMENTS_COLLECTION, amendmentId), amendment);

  // Update contract with amendment reference
  await updateDoc(doc(db, CONTRACTS_COLLECTION, input.contractId), {
    amendmentIds: [...(contract.amendmentIds || []), amendmentId],
    updatedAt: now,
  });

  return amendment;
}

/**
 * Get amendment by ID
 */
export async function getAmendment(amendmentId: string): Promise<ContractAmendment | null> {
  const docRef = doc(db, AMENDMENTS_COLLECTION, amendmentId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return docSnap.data() as ContractAmendment;
}

/**
 * Get amendments for contract
 */
export async function getAmendmentsForContract(contractId: string): Promise<ContractAmendment[]> {
  const q = query(
    collection(db, AMENDMENTS_COLLECTION),
    where('contractId', '==', contractId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as ContractAmendment);
}

/**
 * Activate amendment (apply changes to contract)
 */
export async function activateAmendment(
  amendmentId: string,
  userId: string,
  userName: string
): Promise<ContractAmendment> {
  const amendmentRef = doc(db, AMENDMENTS_COLLECTION, amendmentId);
  const amendmentSnap = await getDoc(amendmentRef);
  
  if (!amendmentSnap.exists()) throw new Error('Amendment not found');
  const amendment = amendmentSnap.data() as ContractAmendment;

  if (amendment.status !== 'pending_signature') {
    throw new Error('Amendment must be fully signed before activation');
  }

  // Check all signatures
  const allSigned = amendment.signatories.every(s => s.signatureMethod !== 'pending');
  if (!allSigned) {
    throw new Error('All parties must sign the amendment');
  }

  // Get contract and apply changes
  const contract = await getContract(amendment.contractId);
  if (!contract) throw new Error('Contract not found');

  // Build contract updates from amendment changes
  const contractUpdates: Record<string, any> = {
    updatedBy: userId,
    updatedAt: Timestamp.now(),
    version: contract.version + 1,
  };

  for (const change of amendment.changes) {
    // Handle nested fields like compensation.baseSalary
    const pathParts = change.field.split('.');
    if (pathParts.length === 1) {
      contractUpdates[change.field] = change.newValue;
    } else {
      // For nested updates, we need to update the whole parent object
      const parentField = pathParts[0];
      const childField = pathParts.slice(1).join('.');
      if (!contractUpdates[parentField]) {
        contractUpdates[parentField] = { ...(contract as any)[parentField] };
      }
      setNestedValue(contractUpdates[parentField], childField, change.newValue);
    }
  }

  // Update amendment status
  await updateDoc(amendmentRef, {
    status: 'active',
    approvedAt: Timestamp.now(),
    approvedBy: userId,
  });

  // Update contract
  await updateDoc(doc(db, CONTRACTS_COLLECTION, amendment.contractId), contractUpdates);

  // Add audit entry to contract
  await addContractAuditEntry(amendment.contractId, {
    action: 'updated',
    description: `Amendment ${amendment.amendmentNumber} applied: ${amendment.title}`,
    previousValue: Object.fromEntries(
      amendment.changes.map(c => [c.field, c.previousValue])
    ),
    newValue: Object.fromEntries(
      amendment.changes.map(c => [c.field, c.newValue])
    ),
    performedBy: userId,
    performedByName: userName,
  });

  return { ...amendment, status: 'active' };
}

// ============================================================================
// Renewals & Termination
// ============================================================================

/**
 * Renew contract
 */
export async function renewContract(
  input: RenewContractInput,
  userId: string,
  userName: string
): Promise<Contract> {
  const oldContract = await getContract(input.contractId);
  if (!oldContract) throw new Error('Contract not found');

  if (!['active', 'expired'].includes(oldContract.status)) {
    throw new Error('Can only renew active or expired contracts');
  }

  // Mark old contract as renewed
  await updateDoc(doc(db, CONTRACTS_COLLECTION, input.contractId), {
    status: 'renewed',
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  // Create new contract based on old one
  const newContractInput: CreateContractInput = {
    subsidiaryId: oldContract.subsidiaryId,
    employeeId: oldContract.employeeId,
    contractType: oldContract.contractType,
    effectiveDate: input.newEffectiveDate,
    startDate: input.newEffectiveDate,
    endDate: input.newEndDate,
    position: {
      ...oldContract.position,
      ...input.changes?.position,
    },
    compensation: {
      baseSalary: input.changes?.compensation?.baseSalary || oldContract.compensation.baseSalary,
      paymentMethod: oldContract.compensation.paymentMethod,
      allowances: input.keepAllowances ? oldContract.compensation.allowances : undefined,
    },
    schedule: {
      ...oldContract.schedule,
      ...input.changes?.schedule,
    },
  };

  const newContract = await createContract(newContractInput, userId, userName);

  // Update new contract with reference to old
  await updateDoc(doc(db, CONTRACTS_COLLECTION, newContract.id), {
    previousContractId: input.contractId,
  });

  // Copy benefits if requested
  if (input.keepBenefits && oldContract.benefits) {
    await updateDoc(doc(db, CONTRACTS_COLLECTION, newContract.id), {
      benefits: oldContract.benefits,
    });
  }

  // Add audit entry to old contract
  await addContractAuditEntry(input.contractId, {
    action: 'renewed',
    description: `Contract renewed. New contract: ${newContract.contractNumber}`,
    newValue: { newContractId: newContract.id, newContractNumber: newContract.contractNumber },
    performedBy: userId,
    performedByName: userName,
  });

  return newContract;
}

/**
 * Terminate contract
 */
export async function terminateContract(
  input: TerminateContractInput,
  userId: string,
  userName: string
): Promise<Contract> {
  const contract = await getContract(input.contractId);
  if (!contract) throw new Error('Contract not found');

  if (contract.status !== 'active') {
    throw new Error('Can only terminate active contracts');
  }

  const updates: Partial<Contract> = {
    status: 'terminated',
    terminationDate: Timestamp.fromDate(input.terminationDate),
    termination: {
      type: input.terminationType,
      reason: input.reason,
      initiatedBy: input.initiatedBy,
      noticePeriodServed: input.noticePeriodServed,
      finalSettlementAmount: input.finalSettlementAmount,
      exitInterviewCompleted: false,
      handoverCompleted: false,
    },
    updatedBy: userId,
    updatedAt: Timestamp.now(),
  };

  await updateDoc(doc(db, CONTRACTS_COLLECTION, input.contractId), updates);

  // Add audit entry
  await addContractAuditEntry(input.contractId, {
    action: 'terminated',
    description: `Contract terminated: ${input.terminationType} - ${input.reason}`,
    newValue: updates.termination,
    performedBy: userId,
    performedByName: userName,
  });

  return { ...contract, ...updates } as Contract;
}

// ============================================================================
// Statistics & Queries
// ============================================================================

/**
 * Get contract statistics
 */
export async function getContractStats(subsidiaryId?: string): Promise<ContractStats> {
  let q = query(collection(db, CONTRACTS_COLLECTION));
  
  if (subsidiaryId) {
    q = query(q, where('subsidiaryId', '==', subsidiaryId));
  }

  const snapshot = await getDocs(q);
  const contracts = snapshot.docs.map(d => d.data() as Contract);

  const now = new Date();
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  const stats: ContractStats = {
    total: contracts.length,
    byType: {} as Record<ContractType, number>,
    byStatus: {} as Record<ContractStatus, number>,
    expiringThisMonth: 0,
    expiringNextMonth: 0,
    pendingSignature: 0,
    recentlyRenewed: 0,
    averageSalary: 0,
    totalPayroll: 0,
  };

  let totalSalary = 0;
  let activeCount = 0;

  for (const contract of contracts) {
    // By type
    stats.byType[contract.contractType] = (stats.byType[contract.contractType] || 0) + 1;
    
    // By status
    stats.byStatus[contract.status] = (stats.byStatus[contract.status] || 0) + 1;

    // Expiring counts
    if (contract.endDate && contract.status === 'active') {
      const endDate = contract.endDate.toDate();
      if (endDate <= thisMonthEnd && endDate >= now) {
        stats.expiringThisMonth++;
      } else if (endDate <= nextMonthEnd && endDate > thisMonthEnd) {
        stats.expiringNextMonth++;
      }
    }

    // Pending signature
    if (contract.status === 'pending_signature') {
      stats.pendingSignature++;
    }

    // Salary calculations for active contracts
    if (contract.status === 'active') {
      totalSalary += contract.compensation.baseSalary;
      activeCount++;
      stats.totalPayroll += contract.compensation.baseSalary;
      
      // Add allowances to payroll
      if (contract.compensation.allowances) {
        for (const allowance of contract.compensation.allowances) {
          if (allowance.frequency === 'monthly') {
            stats.totalPayroll += allowance.amount;
          } else if (allowance.frequency === 'annual') {
            stats.totalPayroll += allowance.amount / 12;
          }
        }
      }
    }
  }

  stats.averageSalary = activeCount > 0 ? Math.round(totalSalary / activeCount) : 0;
  stats.recentlyRenewed = contracts.filter(c => c.status === 'renewed').length;

  return stats;
}

/**
 * Get expiring contracts
 */
export async function getExpiringContracts(
  withinDays: number,
  subsidiaryId?: string
): Promise<ContractSummary[]> {
  const threshold = addDays(new Date(), withinDays);
  
  let q = query(
    collection(db, CONTRACTS_COLLECTION),
    where('status', '==', 'active'),
    orderBy('endDate', 'asc')
  );

  if (subsidiaryId) {
    q = query(q, where('subsidiaryId', '==', subsidiaryId));
  }

  const snapshot = await getDocs(q);
  const contracts = snapshot.docs.map(doc => doc.data() as Contract);
  
  // Filter by end date client-side (Firestore can't do compound inequality)
  const filtered = contracts.filter(c => {
    if (!c.endDate) return false;
    const endDate = c.endDate.toDate();
    return endDate <= threshold && endDate >= new Date();
  });

  return filtered.map(contractToSummary);
}

/**
 * Search contracts
 */
export async function searchContracts(
  searchQuery: string,
  subsidiaryId?: string,
  limitCount: number = 20
): Promise<ContractSummary[]> {
  if (searchQuery.length < 2) return [];

  // Search by employee name or contract number
  const normalizedQuery = searchQuery.toLowerCase();
  
  let q = query(collection(db, CONTRACTS_COLLECTION));
  
  if (subsidiaryId) {
    q = query(q, where('subsidiaryId', '==', subsidiaryId));
  }

  const snapshot = await getDocs(q);
  const contracts = snapshot.docs.map(d => d.data() as Contract);
  
  // Client-side filtering
  const filtered = contracts.filter(c => 
    c.employeeName.toLowerCase().includes(normalizedQuery) ||
    c.contractNumber.toLowerCase().includes(normalizedQuery) ||
    c.employeeNumber.toLowerCase().includes(normalizedQuery)
  );

  return filtered.slice(0, limitCount).map(contractToSummary);
}

// ============================================================================
// Helper Functions
// ============================================================================

function contractToSummary(contract: Contract): ContractSummary {
  const daysToExpiry = contract.endDate
    ? differenceInDays(contract.endDate.toDate(), new Date())
    : undefined;

  return {
    id: contract.id,
    contractNumber: contract.contractNumber,
    employeeId: contract.employeeId,
    employeeName: contract.employeeName,
    employeeNumber: contract.employeeNumber,
    contractType: contract.contractType,
    status: contract.status,
    positionTitle: contract.position.title,
    department: contract.position.department,
    baseSalary: contract.compensation.baseSalary,
    effectiveDate: contract.effectiveDate,
    endDate: contract.endDate,
    daysToExpiry: daysToExpiry !== undefined && daysToExpiry >= 0 ? daysToExpiry : undefined,
    hasActiveAmendments: (contract.amendmentIds?.length || 0) > 0,
    lastUpdated: contract.updatedAt,
  };
}

function getSortField(field: ContractSort['field']): string {
  const fieldMap: Record<string, string> = {
    contractNumber: 'contractNumber',
    employeeName: 'employeeName',
    effectiveDate: 'effectiveDate',
    endDate: 'endDate',
    baseSalary: 'compensation.baseSalary',
    status: 'status',
    updatedAt: 'updatedAt',
  };
  return fieldMap[field] || field;
}

function setNestedValue(obj: Record<string, any>, path: string, value: any): void {
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  
  current[parts[parts.length - 1]] = value;
}

async function addContractAuditEntry(
  contractId: string,
  entry: Omit<ContractAuditEntry, 'id' | 'performedAt'>
): Promise<void> {
  const auditRef = doc(collection(db, CONTRACTS_COLLECTION, contractId, 'audit'));
  await setDoc(auditRef, {
    ...entry,
    id: auditRef.id,
    performedAt: Timestamp.now(),
  });
}
