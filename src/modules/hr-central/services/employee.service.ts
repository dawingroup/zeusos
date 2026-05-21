/**
 * Employee Service - ZeusOS v2.0
 * Complete employee CRUD and lifecycle operations
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
  runTransaction,
  writeBatch,
  Timestamp,
  QueryConstraint,
  increment,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import {
  Employee,
  EmployeeSummary,
  EmployeeId,
  EmployeeNumber,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  ChangeEmployeeStatusInput,
  TransferEmployeeInput,
  EmployeeFilters,
  EmployeeSort,
  EmployeeListResult,
  EmployeeStats,
  EmploymentStatus,
  LeaveEntitlement,
  EmployeeAuditEntry,
} from '../types/employee.types';
import {
  EMPLOYEE_NUMBER_CONFIG,
  DEFAULT_LEAVE_ENTITLEMENTS,
  VALID_STATUS_TRANSITIONS,
  HR_CENTRAL_CONFIG,
  PROBATION_CONFIG,
  NOTICE_PERIOD_CONFIG,
} from '../config/employee.constants';
import {
  validateCreateEmployee,
  validateUpdateEmployee,
  validateStatusChange,
  validateTransfer,
} from '../validation/employee.validation';
import { SubsidiaryId, DepartmentId } from '../../intelligence/config/constants';

// ============================================
// Collection References
// ============================================

const EMPLOYEES_COLLECTION = 'employees';
const COUNTERS_COLLECTION = 'counters';
const EMPLOYEE_NUMBERS_DOC = 'employeeNumbers';
const BUSINESS_EVENTS_COLLECTION = 'businessEvents'; // Changed from 'intelligence/business_events' (invalid 2-segment path)

const employeesRef = collection(db, EMPLOYEES_COLLECTION);

// ============================================
// Helper Functions
// ============================================

/**
 * Safely convert a Timestamp, Date, or string to a Date object
 * Handles both Firestore Timestamps and serialized date strings
 */
function toDate(value: any): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'string') return new Date(value);
  if (value.seconds !== undefined) return new Date(value.seconds * 1000);
  return new Date();
}

// ============================================
// Business Event Emission (stub for integration)
// ============================================

interface BusinessEventPayload {
  eventType: string;
  eventCategory: string;
  source: {
    type: string;
    id: string;
    name: string;
  };
  trigger: {
    type: string;
    id: string;
  };
  payload: Record<string, any>;
  metadata: {
    subsidiaryId: SubsidiaryId;
    departmentId: DepartmentId;
    priority: 'low' | 'medium' | 'high' | 'critical';
    isInternal: boolean;
  };
}

/**
 * Emit business event for Intelligence Layer processing
 */
async function emitBusinessEvent(event: BusinessEventPayload): Promise<void> {
  try {
    const eventsRef = collection(db, BUSINESS_EVENTS_COLLECTION);
    const eventDoc = doc(eventsRef);
    
    await setDoc(eventDoc, {
      id: eventDoc.id,
      ...event,
      processing: {
        status: 'pending',
        tasksGenerated: [],
        notificationsSent: [],
        retryCount: 0,
      },
      createdAt: Timestamp.now(),
    });
  } catch (error) {
    console.warn('Failed to emit business event:', error);
    // Don't throw - business events are non-critical
  }
}

// ============================================
// Employee Number Generation
// ============================================

/**
 * Generate unique employee number using atomic counter
 */
async function generateEmployeeNumber(subsidiaryId: SubsidiaryId): Promise<EmployeeNumber> {
  const counterRef = doc(
    db,
    COUNTERS_COLLECTION,
    `${EMPLOYEE_NUMBERS_DOC}_${subsidiaryId}`
  );

  return runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    
    let nextNumber = 1;
    if (counterDoc.exists()) {
      nextNumber = (counterDoc.data().current || 0) + 1;
    }
    
    transaction.set(counterRef, { current: nextNumber }, { merge: true });
    
    // Format: EMP-DAWIN-0001
    const { prefix, separator, sequenceLength } = EMPLOYEE_NUMBER_CONFIG;
    const paddedNumber = String(nextNumber).padStart(sequenceLength, '0');
    
    // Get subsidiary short code (first 5 chars uppercase)
    const subsidiaryCode = subsidiaryId.toUpperCase().substring(0, 5);
    
    return `${prefix}${separator}${subsidiaryCode}${separator}${paddedNumber}`;
  });
}

/**
 * Generate employee ID
 */
function generateEmployeeId(): EmployeeId {
  return doc(employeesRef).id;
}

/**
 * Generate search terms for employee
 */
function generateSearchTerms(employee: Partial<Employee>): string[] {
  const terms: string[] = [];
  
  // Name variations
  if (employee.firstName) {
    terms.push(employee.firstName.toLowerCase());
  }
  if (employee.lastName) {
    terms.push(employee.lastName.toLowerCase());
  }
  if (employee.middleName) {
    terms.push(employee.middleName.toLowerCase());
  }
  if (employee.firstName && employee.lastName) {
    terms.push(`${employee.firstName} ${employee.lastName}`.toLowerCase());
    terms.push(`${employee.lastName} ${employee.firstName}`.toLowerCase());
  }
  if (employee.preferredName) {
    terms.push(employee.preferredName.toLowerCase());
  }
  
  // Email
  if (employee.email) {
    terms.push(employee.email.toLowerCase());
    // Email username
    terms.push(employee.email.split('@')[0].toLowerCase());
  }
  
  // Employee number
  if (employee.employeeNumber) {
    terms.push(employee.employeeNumber.toLowerCase());
  }
  
  // Position
  if (employee.position?.title) {
    terms.push(employee.position.title.toLowerCase());
  }
  
  // Phone (last 4 digits for quick search)
  if (employee.phoneNumbers?.length) {
    employee.phoneNumbers.forEach(p => {
      const digits = p.number.replace(/\D/g, '');
      if (digits.length >= 4) {
        terms.push(digits.slice(-4));
      }
    });
  }
  
  // Remove duplicates
  return [...new Set(terms)];
}

function formatDepartmentLabel(departmentId: string): string {
  if (!departmentId) return '';
  return departmentId
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ============================================
// CRUD Operations
// ============================================

/**
 * Create new employee
 */
export async function createEmployee(
  input: CreateEmployeeInput,
  createdBy: string
): Promise<Employee> {
  // Validate input
  const validatedInput = validateCreateEmployee(input);
  
  // Generate IDs
  const employeeId = generateEmployeeId();
  const employeeNumber = await generateEmployeeNumber(validatedInput.subsidiaryId as SubsidiaryId);
  
  // Determine initial status
  const initialStatus: EmploymentStatus = 
    validatedInput.employmentType === 'probation' ? 'probation' : 'active';
  
  // Calculate probation dates if applicable
  const now = Timestamp.now();
  const joiningDate = Timestamp.fromDate(new Date(validatedInput.joiningDate));
  
  let probationStartDate: Timestamp | undefined;
  let probationEndDate: Timestamp | undefined;
  
  if (initialStatus === 'probation' || validatedInput.employmentType === 'permanent') {
    probationStartDate = joiningDate;
    const endDate = new Date(validatedInput.joiningDate);
    endDate.setMonth(endDate.getMonth() + PROBATION_CONFIG.defaultDurationMonths);
    probationEndDate = Timestamp.fromDate(endDate);
  }
  
  // Build employee object
  const employee: Employee = {
    id: employeeId,
    employeeNumber,
    subsidiaryId: validatedInput.subsidiaryId as SubsidiaryId,
    
    // Personal
    firstName: validatedInput.firstName,
    middleName: validatedInput.middleName,
    lastName: validatedInput.lastName,
    preferredName: undefined,
    dateOfBirth: Timestamp.fromDate(new Date(validatedInput.dateOfBirth)),
    gender: validatedInput.gender,
    maritalStatus: validatedInput.maritalStatus || 'single',
    nationality: validatedInput.nationality,
    religion: validatedInput.religion,
    photoUrl: validatedInput.photoUrl,
    
    // Contact
    email: validatedInput.email,
    personalEmail: validatedInput.personalEmail,
    phoneNumbers: validatedInput.phoneNumbers.map((p, i) => ({
      ...p,
      isPrimary: i === 0,
      countryCode: p.countryCode || '+256',
    })),
    addresses: (validatedInput.addresses || []).map((a, i) => ({
      ...a,
      isResidential: true,
      isPermanent: i === 0,
      country: a.country || 'Uganda',
    })),
    emergencyContacts: validatedInput.emergencyContacts || [],
    
    // Identification
    nationalIds: (validatedInput.nationalIds || []).map(n => ({
      type: n.type,
      number: n.number,
      issuingAuthority: n.issuingAuthority,
      issueDate: n.issueDate ? Timestamp.fromDate(new Date(n.issueDate)) : undefined,
      expiryDate: n.expiryDate ? Timestamp.fromDate(new Date(n.expiryDate)) : undefined,
      documentUrl: undefined,
    })),
    
    // Employment
    employmentStatus: initialStatus,
    employmentType: validatedInput.employmentType,
    position: {
      title: validatedInput.position.title,
      jobCode: undefined,
      gradeLevel: undefined,
      departmentId: validatedInput.position.departmentId as DepartmentId,
      reportingTo: validatedInput.position.reportingTo,
      location: validatedInput.position.location,
      isManagement: validatedInput.position.isManagement,
      directReports: 0,
    },
    employmentDates: {
      joiningDate,
      probationStartDate,
      probationEndDate,
    },
    workSchedule: {
      type: 'full_time',
      workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      startTime: '08:00',
      endTime: '17:00',
      breakDuration: 60,
      weeklyHours: 40,
      isRemoteEligible: false,
    },
    
    // Statutory (Uganda)
    nssf: validatedInput.nssfNumber ? {
      memberNumber: validatedInput.nssfNumber,
      registrationDate: now,
      employeeContribution: 5,
      employerContribution: 10,
      isActive: true,
    } : undefined,
    tax: {
      tinNumber: validatedInput.tinNumber || '',
      registrationDate: validatedInput.tinNumber ? now : undefined,
      taxExempt: false,
    },
    localServiceTax: {
      isApplicable: true,
      district: validatedInput.addresses?.[0]?.district || 'Kampala',
      annualAmount: 0,
      monthlyDeduction: 0,
    },
    
    // Financial
    bankAccounts: (validatedInput.bankAccounts || []).map((b, i) => ({
      ...b,
      isPrimary: i === 0,
      isVerified: false,
    })),
    mobileMoneyAccounts: (validatedInput.mobileMoneyAccounts || []).map((m, i) => ({
      ...m,
      isPrimary: i === 0,
      isVerified: false,
    })),
    preferredPaymentMethod: validatedInput.preferredPaymentMethod || 'bank',
    
    // Professional (empty initially)
    education: [],
    certifications: [],
    workExperience: [],
    skills: [],
    
    // Family
    dependents: [],
    
    // Leave
    leaveEntitlements: calculateInitialLeaveEntitlements(validatedInput.employmentType),
    leaveBalance: {
      annual: 0,
      sick: DEFAULT_LEAVE_ENTITLEMENTS.sickLeave,
      compassionate: DEFAULT_LEAVE_ENTITLEMENTS.compassionateLeave,
      carriedOver: 0,
      unpaidTaken: 0,
      asOfDate: now,
    },
    
    // System Access
    systemAccess: validatedInput.createSystemAccess ? {
      userId: '',
      email: validatedInput.email,
      isActive: false,
      mfaEnabled: false,
      accessRoles: validatedInput.accessRoles || [],
      permissions: [],
    } : undefined,
    
    // Documents
    documents: [],
    
    // Metadata
    tags: [],
    notes: validatedInput.notes,
    customFields: validatedInput.customFields,
    
    // System
    createdBy,
    createdAt: now,
    updatedBy: createdBy,
    updatedAt: now,
    isDeleted: false,
    
    // Search
    searchTerms: [],
  };
  
  // Generate search terms
  employee.searchTerms = generateSearchTerms(employee);
  
  // Remove undefined values before saving to Firestore (Firestore doesn't accept undefined)
  const cleanEmployee = JSON.parse(JSON.stringify(employee));
  
  // Save to Firestore
  const employeeRef = doc(employeesRef, employeeId);
  await setDoc(employeeRef, cleanEmployee);
  
  // Create initial audit entry
  await addAuditEntry(employeeId, {
    action: 'created',
    changedBy: createdBy,
    changedAt: now,
    newValue: { employeeNumber, status: initialStatus },
  });
  
  // Update manager's direct reports count if applicable
  if (validatedInput.position.reportingTo) {
    await updateManagerDirectReports(validatedInput.position.reportingTo, 1);
  }
  
  // Emit business event
  await emitBusinessEvent({
    eventType: 'hr.employee.created',
    eventCategory: 'hr',
    source: {
      type: 'module',
      id: 'hr-central',
      name: 'HR Central',
    },
    trigger: {
      type: 'user',
      id: createdBy,
    },
    payload: {
      employeeId,
      employeeNumber,
      subsidiaryId: validatedInput.subsidiaryId,
      departmentId: validatedInput.position.departmentId,
      employmentType: validatedInput.employmentType,
      position: validatedInput.position.title,
      joiningDate: validatedInput.joiningDate,
      requiresProbation: initialStatus === 'probation',
      probationEndDate: probationEndDate?.toDate().toISOString(),
    },
    metadata: {
      subsidiaryId: validatedInput.subsidiaryId as SubsidiaryId,
      departmentId: validatedInput.position.departmentId as DepartmentId,
      priority: 'medium',
      isInternal: false,
    },
  });
  
  return employee;
}

/**
 * Get employee by ID
 */
export async function getEmployee(employeeId: EmployeeId): Promise<Employee | null> {
  const employeeRef = doc(employeesRef, employeeId);
  const employeeDoc = await getDoc(employeeRef);
  
  if (!employeeDoc.exists()) {
    return null;
  }
  
  const data = employeeDoc.data();
  if (data.isDeleted) {
    return null;
  }
  
  return data as Employee;
}

/**
 * Get employee by employee number
 */
export async function getEmployeeByNumber(
  employeeNumber: EmployeeNumber
): Promise<Employee | null> {
  const q = query(
    employeesRef,
    where('employeeNumber', '==', employeeNumber),
    where('isDeleted', '==', false),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  
  return snapshot.docs[0].data() as Employee;
}

/**
 * Get employee by email
 */
export async function getEmployeeByEmail(email: string): Promise<Employee | null> {
  const q = query(
    employeesRef,
    where('email', '==', email.toLowerCase()),
    where('isDeleted', '==', false),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  
  return snapshot.docs[0].data() as Employee;
}

/**
 * Update employee
 */
/**
 * Replace an employee's subsidiary allocations. Validates the array
 * sums to 100% and updates the primary `subsidiaryId` to the largest
 * allocation (so single-tenant code paths keep behaving sensibly).
 * Pass an empty array to clear the split — the employee then defaults
 * to 100% on the existing primary subsidiaryId.
 */
export async function setEmployeeSubsidiaryAllocations(
  employeeId: EmployeeId,
  allocations: Array<{ subsidiaryId: string; allocationPercent: number }>,
  updatedBy: string,
): Promise<void> {
  if (allocations.length > 0) {
    const total = allocations.reduce((sum, a) => sum + (Number(a.allocationPercent) || 0), 0);
    // Allow ±0.5 tolerance for hand-typed rounding.
    if (Math.abs(total - 100) > 0.5) {
      throw new Error(`Allocations must sum to 100% (got ${total.toFixed(1)}%)`);
    }
    for (const a of allocations) {
      if (a.allocationPercent < 0 || a.allocationPercent > 100) {
        throw new Error(`Allocation percent out of range: ${a.allocationPercent}`);
      }
      if (!a.subsidiaryId) {
        throw new Error('Each allocation must reference a subsidiary');
      }
    }
  }

  const ref = doc(employeesRef, employeeId);
  const update: Record<string, unknown> = {
    updatedBy,
    updatedAt: Timestamp.now(),
  };

  if (allocations.length === 0) {
    // Clear the split entirely.
    update.subsidiaryAllocations = [];
  } else {
    update.subsidiaryAllocations = allocations.map((a) => ({
      subsidiaryId: a.subsidiaryId,
      allocationPercent: Number(a.allocationPercent),
    }));
    // Keep the primary in sync with the largest share so single-tenant
    // queries and the employee number prefix still make sense.
    const primary = [...allocations].sort((a, b) => b.allocationPercent - a.allocationPercent)[0];
    update.subsidiaryId = primary.subsidiaryId;
  }

  await updateDoc(ref, update);
}

/**
 * Bulk-set the subsidiaryId on a list of employees in a single
 * Firestore writeBatch. Used by the employee list bulk-tag UI to
 * fix records that were created before subsidiary tagging was wired
 * in (or assigned to the wrong company). Chunks at 400 ops/commit
 * to stay under Firestore's 500-op batch limit.
 */
export async function bulkSetEmployeeSubsidiary(
  employeeIds: EmployeeId[],
  subsidiaryId: string,
  updatedBy: string,
): Promise<{ updated: number }> {
  if (employeeIds.length === 0) return { updated: 0 };

  const CHUNK = 400;
  let updated = 0;

  for (let i = 0; i < employeeIds.length; i += CHUNK) {
    const slice = employeeIds.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    for (const id of slice) {
      const ref = doc(employeesRef, id);
      batch.update(ref, {
        subsidiaryId,
        updatedBy,
        updatedAt: Timestamp.now(),
      });
      updated++;
    }
    await batch.commit();
  }

  return { updated };
}

export async function updateEmployee(
  employeeId: EmployeeId,
  input: UpdateEmployeeInput,
  updatedBy: string
): Promise<Employee> {
  // Validate input
  const validatedInput = validateUpdateEmployee(input);
  
  // Get current employee
  const employee = await getEmployee(employeeId);
  if (!employee) {
    throw new Error(`Employee ${employeeId} not found`);
  }
  
  const now = Timestamp.now();
  
  // Build update object
  const updates: Partial<Employee> = {
    updatedBy,
    updatedAt: now,
  };
  
  // Track changes for audit
  const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
  
  // Apply each field update
  const updateableFields = [
    'firstName', 'middleName', 'lastName', 'preferredName',
    'gender', 'maritalStatus', 'nationality',
    'religion', 'photoUrl', 'email', 'personalEmail',
    'phoneNumbers', 'addresses', 'emergencyContacts',
    'nationalIds', 'bankAccounts', 'mobileMoneyAccounts',
    'preferredPaymentMethod', 'education', 'certifications',
    'workExperience', 'skills', 'dependents', 'tags', 'notes',
    'customFields', 'workSchedule', 'position',
  ];
  
  for (const field of updateableFields) {
    if (field in validatedInput && validatedInput[field as keyof typeof validatedInput] !== undefined) {
      const newValue = validatedInput[field as keyof typeof validatedInput];
      const oldValue = employee[field as keyof Employee];
      
      if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
        (updates as any)[field] = newValue;
        changes.push({ field, oldValue, newValue });
      }
    }
  }
  
  // Handle date fields
  if (validatedInput.dateOfBirth) {
    updates.dateOfBirth = Timestamp.fromDate(new Date(validatedInput.dateOfBirth));
  }
  
  // Regenerate search terms
  const updatedEmployee = { ...employee, ...updates };
  updates.searchTerms = generateSearchTerms(updatedEmployee);
  
  // Update Firestore
  const employeeRef = doc(employeesRef, employeeId);
  await updateDoc(employeeRef, updates);
  
  // Add audit entries
  for (const change of changes) {
    await addAuditEntry(employeeId, {
      action: 'updated',
      field: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      changedBy: updatedBy,
      changedAt: now,
      ...(validatedInput.updateReason && { reason: validatedInput.updateReason }),
    });
  }
  
  // Emit business event if significant changes
  if (changes.length > 0) {
    await emitBusinessEvent({
      eventType: 'hr.employee.updated',
      eventCategory: 'hr',
      source: {
        type: 'module',
        id: 'hr-central',
        name: 'HR Central',
      },
      trigger: {
        type: 'user',
        id: updatedBy,
      },
      payload: {
        employeeId,
        employeeNumber: employee.employeeNumber,
        changedFields: changes.map(c => c.field),
        changeCount: changes.length,
      },
      metadata: {
        subsidiaryId: employee.subsidiaryId,
        departmentId: employee.position.departmentId,
        priority: 'low',
        isInternal: true,
      },
    });
  }
  
  return { ...employee, ...updates } as Employee;
}

/**
 * Soft delete employee
 */
export async function deleteEmployee(
  employeeId: EmployeeId,
  deletedBy: string,
  reason: string
): Promise<void> {
  const employee = await getEmployee(employeeId);
  if (!employee) {
    throw new Error(`Employee ${employeeId} not found`);
  }
  
  const now = Timestamp.now();
  
  const employeeRef = doc(employeesRef, employeeId);
  await updateDoc(employeeRef, {
    isDeleted: true,
    deletedAt: now,
    deletedBy,
    updatedBy: deletedBy,
    updatedAt: now,
  });
  
  // Update manager's direct reports
  if (employee.position.reportingTo) {
    await updateManagerDirectReports(employee.position.reportingTo, -1);
  }
  
  // Add audit entry
  await addAuditEntry(employeeId, {
    action: 'status_changed',
    field: 'isDeleted',
    oldValue: false,
    newValue: true,
    changedBy: deletedBy,
    changedAt: now,
    reason,
  });
  
  // Emit business event
  await emitBusinessEvent({
    eventType: 'hr.employee.deleted',
    eventCategory: 'hr',
    source: {
      type: 'module',
      id: 'hr-central',
      name: 'HR Central',
    },
    trigger: {
      type: 'user',
      id: deletedBy,
    },
    payload: {
      employeeId,
      employeeNumber: employee.employeeNumber,
      reason,
    },
    metadata: {
      subsidiaryId: employee.subsidiaryId,
      departmentId: employee.position.departmentId,
      priority: 'medium',
      isInternal: false,
    },
  });
}

// ============================================
// Status Management
// ============================================

/**
 * Change employee status
 */
export async function changeEmployeeStatus(
  input: ChangeEmployeeStatusInput,
  changedBy: string
): Promise<Employee> {
  // Validate input
  const validatedInput = validateStatusChange(input);
  
  const employee = await getEmployee(validatedInput.employeeId);
  if (!employee) {
    throw new Error(`Employee ${validatedInput.employeeId} not found`);
  }
  
  // Validate status transition
  const allowedTransitions = VALID_STATUS_TRANSITIONS[employee.employmentStatus];
  if (!allowedTransitions || !allowedTransitions.includes(validatedInput.newStatus)) {
    throw new Error(
      `Invalid status transition from ${employee.employmentStatus} to ${validatedInput.newStatus}` 
    );
  }
  
  const now = Timestamp.now();
  const effectiveDate = Timestamp.fromDate(new Date(validatedInput.effectiveDate));
  
  // Build update object
  const updates: Partial<Employee> = {
    employmentStatus: validatedInput.newStatus,
    updatedBy: changedBy,
    updatedAt: now,
  };
  
  // Handle status-specific updates
  switch (validatedInput.newStatus) {
    case 'active':
      if (employee.employmentStatus === 'probation') {
        updates.employmentType = 'permanent';
        updates.employmentDates = {
          ...employee.employmentDates,
          confirmationDate: effectiveDate,
        };
      }
      break;
      
    case 'notice_period':
      const noticeDays = validatedInput.noticePeriodDays ||
        NOTICE_PERIOD_CONFIG.byEmploymentType[employee.employmentType as keyof typeof NOTICE_PERIOD_CONFIG.byEmploymentType] || 30;
      const exitDate = new Date(validatedInput.effectiveDate);
      exitDate.setDate(exitDate.getDate() + noticeDays);
      
      updates.employmentDates = {
        ...employee.employmentDates,
        noticeDate: effectiveDate,
        exitDate: Timestamp.fromDate(exitDate),
      };
      break;
      
    case 'terminated':
    case 'resigned':
    case 'retired':
      updates.terminationReason = validatedInput.terminationReason;
      updates.terminationNotes = validatedInput.notes;
      updates.employmentDates = {
        ...employee.employmentDates,
        exitDate: effectiveDate,
        lastWorkingDate: validatedInput.lastWorkingDate
          ? Timestamp.fromDate(new Date(validatedInput.lastWorkingDate))
          : effectiveDate,
      };
      
      // Deactivate system access
      if (employee.systemAccess) {
        updates.systemAccess = {
          ...employee.systemAccess,
          isActive: false,
        };
      }
      break;
      
    case 'suspended':
      // Deactivate system access temporarily
      if (employee.systemAccess) {
        updates.systemAccess = {
          ...employee.systemAccess,
          isActive: false,
        };
      }
      break;
  }
  
  // Update Firestore
  const employeeRef = doc(employeesRef, validatedInput.employeeId);
  await updateDoc(employeeRef, updates);
  
  // Add audit entry
  await addAuditEntry(validatedInput.employeeId, {
    action: 'status_changed',
    field: 'employmentStatus',
    oldValue: employee.employmentStatus,
    newValue: validatedInput.newStatus,
    changedBy,
    changedAt: now,
    reason: validatedInput.reason,
  });
  
  // Emit business event
  await emitBusinessEvent({
    eventType: `hr.employee.status.${validatedInput.newStatus}`,
    eventCategory: 'hr',
    source: {
      type: 'module',
      id: 'hr-central',
      name: 'HR Central',
    },
    trigger: {
      type: 'user',
      id: changedBy,
    },
    payload: {
      employeeId: validatedInput.employeeId,
      employeeNumber: employee.employeeNumber,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      previousStatus: employee.employmentStatus,
      newStatus: validatedInput.newStatus,
      effectiveDate: validatedInput.effectiveDate,
      reason: validatedInput.reason,
      terminationReason: validatedInput.terminationReason,
      lastWorkingDate: validatedInput.lastWorkingDate,
    },
    metadata: {
      subsidiaryId: employee.subsidiaryId,
      departmentId: employee.position.departmentId,
      priority: ['terminated', 'resigned', 'retired'].includes(validatedInput.newStatus)
        ? 'high'
        : 'medium',
      isInternal: false,
    },
  });
  
  return { ...employee, ...updates } as Employee;
}

/**
 * Confirm employee (end probation)
 */
export async function confirmEmployee(
  employeeId: EmployeeId,
  confirmedBy: string,
  notes?: string
): Promise<Employee> {
  return changeEmployeeStatus(
    {
      employeeId,
      newStatus: 'active',
      effectiveDate: new Date().toISOString(),
      reason: notes || 'Probation period completed successfully',
    },
    confirmedBy
  );
}

// ============================================
// Transfer & Promotion
// ============================================

/**
 * Transfer or promote employee
 */
export async function transferEmployee(
  input: TransferEmployeeInput,
  transferredBy: string
): Promise<Employee> {
  // Validate input
  const validatedInput = validateTransfer(input);
  
  const employee = await getEmployee(validatedInput.employeeId);
  if (!employee) {
    throw new Error(`Employee ${validatedInput.employeeId} not found`);
  }
  
  const now = Timestamp.now();
  const effectiveDate = Timestamp.fromDate(new Date(validatedInput.effectiveDate));
  
  // Track old values for audit
  const oldPosition = { ...employee.position };
  const oldSubsidiary = employee.subsidiaryId;
  
  // Build update object
  const updates: Partial<Employee> = {
    updatedBy: transferredBy,
    updatedAt: now,
    employmentDates: {
      ...employee.employmentDates,
      lastPromotionDate: validatedInput.transferType === 'promotion' ? effectiveDate : employee.employmentDates.lastPromotionDate,
    },
  };
  
  // Update position
  const newPosition = { ...employee.position };
  if (validatedInput.newTitle) newPosition.title = validatedInput.newTitle;
  if (validatedInput.newDepartmentId) newPosition.departmentId = validatedInput.newDepartmentId as DepartmentId;
  if (validatedInput.newReportingTo !== undefined) newPosition.reportingTo = validatedInput.newReportingTo;
  if (validatedInput.newLocation) newPosition.location = validatedInput.newLocation;
  if (validatedInput.newGradeLevel) newPosition.gradeLevel = validatedInput.newGradeLevel;
  
  updates.position = newPosition;
  
  // Update subsidiary if changing
  if (validatedInput.newSubsidiaryId) {
    updates.subsidiaryId = validatedInput.newSubsidiaryId as SubsidiaryId;
  }
  
  // Update manager direct reports
  if (oldPosition.reportingTo !== newPosition.reportingTo) {
    if (oldPosition.reportingTo) {
      await updateManagerDirectReports(oldPosition.reportingTo, -1);
    }
    if (newPosition.reportingTo) {
      await updateManagerDirectReports(newPosition.reportingTo, 1);
    }
  }
  
  // Regenerate search terms
  const updatedEmployee = { ...employee, ...updates };
  updates.searchTerms = generateSearchTerms(updatedEmployee);
  
  // Update Firestore
  const employeeRef = doc(employeesRef, validatedInput.employeeId);
  await updateDoc(employeeRef, updates);
  
  // Add audit entry
  await addAuditEntry(validatedInput.employeeId, {
    action: 'updated',
    field: 'position',
    oldValue: oldPosition,
    newValue: newPosition,
    changedBy: transferredBy,
    changedAt: now,
    reason: `${validatedInput.transferType}: ${validatedInput.reason}`,
  });
  
  // Emit business event
  await emitBusinessEvent({
    eventType: `hr.employee.${validatedInput.transferType}`,
    eventCategory: 'hr',
    source: {
      type: 'module',
      id: 'hr-central',
      name: 'HR Central',
    },
    trigger: {
      type: 'user',
      id: transferredBy,
    },
    payload: {
      employeeId: validatedInput.employeeId,
      employeeNumber: employee.employeeNumber,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      transferType: validatedInput.transferType,
      effectiveDate: validatedInput.effectiveDate,
      oldTitle: oldPosition.title,
      oldDepartment: oldPosition.departmentId,
      oldSubsidiary,
      oldReportingTo: oldPosition.reportingTo,
      newTitle: newPosition.title,
      newDepartment: newPosition.departmentId,
      newSubsidiary: validatedInput.newSubsidiaryId || oldSubsidiary,
      newReportingTo: newPosition.reportingTo,
      salaryChange: validatedInput.salaryChange,
      reason: validatedInput.reason,
    },
    metadata: {
      subsidiaryId: (validatedInput.newSubsidiaryId || employee.subsidiaryId) as SubsidiaryId,
      departmentId: newPosition.departmentId,
      priority: validatedInput.transferType === 'promotion' ? 'medium' : 'low',
      isInternal: false,
    },
  });
  
  return { ...employee, ...updates } as Employee;
}

// ============================================
// Role Assignment
// ============================================

/**
 * Update employee role assignments
 * Assigns role profiles for task routing via Intelligence Layer
 */
export async function updateEmployeeRoles(
  employeeId: EmployeeId,
  accessRoles: string[],
  updatedBy: string
): Promise<Employee> {
  const employee = await getEmployee(employeeId);
  if (!employee) {
    throw new Error(`Employee ${employeeId} not found`);
  }

  const now = Timestamp.now();
  const oldRoles = employee.systemAccess?.accessRoles || [];

  // Ensure systemAccess object exists
  const systemAccess = employee.systemAccess || {
    userId: employee.id,
    email: employee.email,
    isActive: true,
    mfaEnabled: false,
    permissions: [],
    accessRoles: [],
  };

  // Build update object
  const updates: Partial<Employee> = {
    systemAccess: {
      ...systemAccess,
      accessRoles,
    },
    updatedBy,
    updatedAt: now,
  };

  // Update Firestore
  const employeeRef = doc(employeesRef, employeeId);
  await updateDoc(employeeRef, updates);

  // Add audit entry
  const rolesAdded = accessRoles.filter(r => !oldRoles.includes(r));
  const rolesRemoved = oldRoles.filter(r => !accessRoles.includes(r));

  await addAuditEntry(employeeId, {
    action: 'updated',
    field: 'systemAccess.accessRoles',
    oldValue: oldRoles,
    newValue: accessRoles,
    changedBy: updatedBy,
    changedAt: now,
    reason: `Roles added: [${rolesAdded.join(', ')}], Roles removed: [${rolesRemoved.join(', ')}]`,
  });

  // Emit business event
  await emitBusinessEvent({
    eventType: 'hr.employee.roles_updated',
    eventCategory: 'hr',
    source: {
      type: 'module',
      id: 'hr-central',
      name: 'HR Central',
    },
    trigger: {
      type: 'user',
      id: updatedBy,
    },
    payload: {
      employeeId,
      employeeNumber: employee.employeeNumber,
      employeeName: employee.fullName,
      oldRoles,
      newRoles: accessRoles,
      rolesAdded,
      rolesRemoved,
    },
    metadata: {
      subsidiaryId: employee.subsidiaryId,
      departmentId: employee.position.departmentId,
      priority: 'medium',
      isInternal: true,
    },
  });

  return { ...employee, ...updates } as Employee;
}

// ============================================
// Query Operations
// ============================================

/**
 * List employees with filters and pagination
 */
export async function listEmployees(
  filters: EmployeeFilters = {},
  sort: EmployeeSort = { field: 'fullName', direction: 'asc' },
  pageSize: number = HR_CENTRAL_CONFIG.defaultPageSize,
  pageNumber: number = 1
): Promise<EmployeeListResult> {
  const constraints: QueryConstraint[] = [
    where('isDeleted', '==', false),
  ];
  
  // Apply filters
  if (filters.subsidiaryIds?.length) {
    constraints.push(where('subsidiaryId', 'in', filters.subsidiaryIds.slice(0, 10)));
  }
  
  if (filters.departmentIds?.length) {
    constraints.push(where('position.departmentId', 'in', filters.departmentIds.slice(0, 10)));
  }
  
  if (filters.employmentStatuses?.length) {
    constraints.push(where('employmentStatus', 'in', filters.employmentStatuses));
  }
  
  if (filters.employmentTypes?.length) {
    constraints.push(where('employmentType', 'in', filters.employmentTypes));
  }
  
  if (filters.reportingTo) {
    constraints.push(where('position.reportingTo', '==', filters.reportingTo));
  }
  
  if (filters.isManagement !== undefined) {
    constraints.push(where('position.isManagement', '==', filters.isManagement));
  }
  
  // Apply sorting
  const sortField = getSortField(sort.field);
  constraints.push(orderBy(sortField, sort.direction));
  
  // Pagination
  const actualPageSize = Math.min(pageSize, HR_CENTRAL_CONFIG.maxPageSize);
  constraints.push(limit(actualPageSize + 1));
  
  // Execute query
  const q = query(employeesRef, ...constraints);
  const snapshot = await getDocs(q);
  
  // Process results
  const employees: EmployeeSummary[] = [];
  let hasMore = false;
  
  snapshot.docs.forEach((docSnapshot, index) => {
    if (index < actualPageSize) {
      const data = docSnapshot.data() as Employee;
      
      // Apply search filter in memory
      if (filters.searchQuery) {
        const searchTerms = filters.searchQuery.toLowerCase().split(/\s+/);
        const matches = searchTerms.every(term =>
          data.searchTerms.some(st => st.includes(term))
        );
        if (!matches) return;
      }
      
      employees.push(employeeToSummary(data));
    } else {
      hasMore = true;
    }
  });
  
  return {
    employees,
    totalCount: employees.length,
    pageSize: actualPageSize,
    pageNumber,
    hasMore,
    filters,
    sort,
  };
}

/**
 * Search employees by query string
 */
export async function searchEmployees(
  searchQuery: string,
  subsidiaryId?: SubsidiaryId,
  maxResults: number = HR_CENTRAL_CONFIG.maxSearchResults
): Promise<EmployeeSummary[]> {
  if (searchQuery.length < HR_CENTRAL_CONFIG.minSearchLength) {
    return [];
  }
  
  const searchTerms = searchQuery.toLowerCase().split(/\s+/);
  
  const constraints: QueryConstraint[] = [
    where('isDeleted', '==', false),
    where('searchTerms', 'array-contains', searchTerms[0]),
    limit(maxResults * 2),
  ];
  
  if (subsidiaryId) {
    constraints.push(where('subsidiaryId', '==', subsidiaryId));
  }
  
  const q = query(employeesRef, ...constraints);
  const snapshot = await getDocs(q);
  
  const results: EmployeeSummary[] = [];
  
  for (const docSnapshot of snapshot.docs) {
    if (results.length >= maxResults) break;
    
    const data = docSnapshot.data() as Employee;
    
    // Check all search terms match
    const allTermsMatch = searchTerms.every(term =>
      data.searchTerms.some(st => st.includes(term))
    );
    
    if (allTermsMatch) {
      results.push(employeeToSummary(data));
    }
  }
  
  return results;
}

/**
 * Get employees by department
 */
export async function getEmployeesByDepartment(
  departmentId: string,
  includeInactive: boolean = false
): Promise<EmployeeSummary[]> {
  const constraints: QueryConstraint[] = [
    where('position.departmentId', '==', departmentId),
    where('isDeleted', '==', false),
  ];
  
  if (!includeInactive) {
    constraints.push(where('employmentStatus', 'in', ['active', 'probation', 'on_leave']));
  }
  
  const q = query(employeesRef, ...constraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(docSnapshot => employeeToSummary(docSnapshot.data() as Employee));
}

/**
 * Get direct reports for a manager
 */
export async function getDirectReports(managerId: EmployeeId): Promise<EmployeeSummary[]> {
  const q = query(
    employeesRef,
    where('position.reportingTo', '==', managerId),
    where('isDeleted', '==', false),
    where('employmentStatus', 'in', ['active', 'probation', 'on_leave']),
    orderBy('lastName', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnapshot => employeeToSummary(docSnapshot.data() as Employee));
}

/**
 * Get employees with expiring probation
 */
export async function getExpiringProbations(
  daysAhead: number = 30
): Promise<Employee[]> {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  const q = query(
    employeesRef,
    where('employmentStatus', '==', 'probation'),
    where('isDeleted', '==', false),
    where('employmentDates.probationEndDate', '<=', Timestamp.fromDate(futureDate)),
    orderBy('employmentDates.probationEndDate', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnapshot => docSnapshot.data() as Employee);
}

/**
 * Get employees with expiring contracts
 * Note: Contract expiry dates are stored in the contracts collection
 * This function returns contract employees for further filtering
 */
export async function getExpiringContracts(
  _daysAhead: number = 60
): Promise<Employee[]> {
  // Note: Full contract expiry checking requires contracts collection
  const q = query(
    employeesRef,
    where('employmentType', '==', 'contract'),
    where('employmentStatus', '==', 'active'),
    where('isDeleted', '==', false)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnapshot => docSnapshot.data() as Employee);
}

// ============================================
// Statistics
// ============================================

/**
 * Get employee statistics
 */
export async function getEmployeeStats(
  subsidiaryId?: SubsidiaryId
): Promise<EmployeeStats> {
  const constraints: QueryConstraint[] = [
    where('isDeleted', '==', false),
  ];
  
  if (subsidiaryId) {
    constraints.push(where('subsidiaryId', '==', subsidiaryId));
  }
  
  const q = query(employeesRef, ...constraints);
  const snapshot = await getDocs(q);
  
  const stats: EmployeeStats = {
    totalEmployees: 0,
    byStatus: {} as Record<EmploymentStatus, number>,
    byType: {} as Record<string, number>,
    byDepartment: {} as Record<string, number>,
    bySubsidiary: {} as Record<string, number>,
    avgTenureYears: 0,
    turnoverRate: 0,
    newHiresCount: 0,
    exitCount: 0,
    genderDistribution: {} as Record<string, number>,
    ageDistribution: {
      under25: 0,
      age25to34: 0,
      age35to44: 0,
      age45to54: 0,
      age55plus: 0,
    },
  };
  
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  let totalTenure = 0;
  let activeAtYearStart = 0;
  let exitedThisYear = 0;
  
  snapshot.docs.forEach(docSnapshot => {
    const emp = docSnapshot.data() as Employee;
    stats.totalEmployees++;
    
    // By status
    stats.byStatus[emp.employmentStatus] = (stats.byStatus[emp.employmentStatus] || 0) + 1;
    
    // By type
    stats.byType[emp.employmentType] = (stats.byType[emp.employmentType] || 0) + 1;
    
    // By department
    stats.byDepartment[emp.position.departmentId] = 
      (stats.byDepartment[emp.position.departmentId] || 0) + 1;
    
    // By subsidiary
    stats.bySubsidiary[emp.subsidiaryId] = (stats.bySubsidiary[emp.subsidiaryId] || 0) + 1;
    
    // Gender
    stats.genderDistribution[emp.gender] = (stats.genderDistribution[emp.gender] || 0) + 1;
    
    // Age distribution
    const birthDate = toDate(emp.dateOfBirth);
    const age = now.getFullYear() - birthDate.getFullYear();
    if (age < 25) stats.ageDistribution.under25++;
    else if (age < 35) stats.ageDistribution.age25to34++;
    else if (age < 45) stats.ageDistribution.age35to44++;
    else if (age < 55) stats.ageDistribution.age45to54++;
    else stats.ageDistribution.age55plus++;
    
    // Tenure calculation (for active employees)
    if (['active', 'probation', 'on_leave'].includes(emp.employmentStatus)) {
      const joinDate = toDate(emp.employmentDates.joiningDate);
      const tenureYears = (now.getTime() - joinDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      totalTenure += tenureYears;
    }
    
    // New hires (last 30 days)
    const joiningDate = toDate(emp.employmentDates.joiningDate);
    if (joiningDate >= thirtyDaysAgo) {
      stats.newHiresCount++;
    }
    
    // Exits (last 30 days)
    if (['terminated', 'resigned', 'retired'].includes(emp.employmentStatus)) {
      const exitDate = emp.employmentDates.exitDate ? toDate(emp.employmentDates.exitDate) : null;
      if (exitDate && exitDate >= thirtyDaysAgo) {
        stats.exitCount++;
      }
    }
    
    // Turnover calculation
    if (joiningDate < oneYearAgo) {
      activeAtYearStart++;
    }
    if (['terminated', 'resigned', 'retired'].includes(emp.employmentStatus)) {
      const exitDate = emp.employmentDates.exitDate?.toDate();
      if (exitDate && exitDate >= oneYearAgo) {
        exitedThisYear++;
      }
    }
  });
  
  // Calculate averages
  const activeCount = (stats.byStatus['active'] || 0) + 
                      (stats.byStatus['probation'] || 0) + 
                      (stats.byStatus['on_leave'] || 0);
  
  stats.avgTenureYears = activeCount > 0 ? Math.round((totalTenure / activeCount) * 10) / 10 : 0;
  
  // Turnover rate
  const avgHeadcount = (activeAtYearStart + activeCount) / 2;
  stats.turnoverRate = avgHeadcount > 0 
    ? Math.round((exitedThisYear / avgHeadcount) * 1000) / 10 
    : 0;
  
  return stats;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Convert Employee to EmployeeSummary
 */
export function employeeToSummary(employee: Employee): EmployeeSummary {
  const now = new Date();
  const joiningDate = toDate(employee.employmentDates.joiningDate);
  const yearsOfService = Math.floor(
    (now.getTime() - joiningDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
  
  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    subsidiaryId: employee.subsidiaryId,
    subsidiaryAllocations: employee.subsidiaryAllocations,
    fullName: `${employee.firstName} ${employee.lastName}`,
    photoUrl: employee.photoUrl,
    email: employee.email,
    phone: employee.phoneNumbers.find(p => p.isPrimary)?.number,
    title: employee.position.title,
    departmentId: employee.position.departmentId,
    departmentName: formatDepartmentLabel(String(employee.position.departmentId || '')),
    reportingTo: employee.position.reportingTo,
    employmentStatus: employee.employmentStatus,
    employmentType: employee.employmentType,
    joiningDate: employee.employmentDates.joiningDate,
    yearsOfService,
    directReports: employee.position.directReports || 0,
    activeTaskCount: 0,
    hasSystemAccess: employee.systemAccess?.isActive || false,
    lastLogin: employee.systemAccess?.lastLogin,
    customFields: employee.customFields,
  };
}

/**
 * Get sort field path
 */
function getSortField(field: EmployeeSort['field']): string {
  const fieldMap: Record<string, string> = {
    fullName: 'lastName',
    employeeNumber: 'employeeNumber',
    joiningDate: 'employmentDates.joiningDate',
    department: 'position.departmentId',
    title: 'position.title',
    status: 'employmentStatus',
  };
  return fieldMap[field] || 'lastName';
}

/**
 * Update manager's direct reports count
 */
async function updateManagerDirectReports(
  managerId: EmployeeId,
  delta: number
): Promise<void> {
  try {
    const managerRef = doc(employeesRef, managerId);
    await updateDoc(managerRef, {
      'position.directReports': increment(delta),
    });
  } catch (error) {
    console.warn('Failed to update manager direct reports:', error);
  }
}

/**
 * Add audit entry
 */
async function addAuditEntry(
  employeeId: EmployeeId,
  entry: Omit<EmployeeAuditEntry, 'id'>
): Promise<void> {
  try {
    const auditRef = collection(db, EMPLOYEES_COLLECTION, employeeId, 'audit');
    const auditDoc = doc(auditRef);
    
    // Clean entry to remove undefined values (Firestore doesn't accept undefined)
    const cleanedEntry = JSON.parse(JSON.stringify({
      id: auditDoc.id,
      ...entry,
    }));
    
    await setDoc(auditDoc, cleanedEntry);
  } catch (error) {
    console.warn('Failed to add audit entry:', error);
  }
}

/**
 * Calculate initial leave entitlements based on employment type
 */
function calculateInitialLeaveEntitlements(
  employmentType: string
): LeaveEntitlement {
  // Start with Uganda defaults
  let annualLeave = DEFAULT_LEAVE_ENTITLEMENTS.annualLeave as number;
  let sickLeave = DEFAULT_LEAVE_ENTITLEMENTS.sickLeave as number;
  let studyLeave: number | undefined = DEFAULT_LEAVE_ENTITLEMENTS.studyLeave as number;
  let carryOverMax = DEFAULT_LEAVE_ENTITLEMENTS.carryOverMax as number;
  
  // Adjust based on employment type
  switch (employmentType) {
    case 'part_time':
      annualLeave = Math.floor(annualLeave / 2);
      sickLeave = Math.floor(sickLeave / 2);
      break;
    case 'intern':
      annualLeave = 5;
      sickLeave = 5;
      studyLeave = 0;
      break;
    case 'casual':
      annualLeave = 0;
      sickLeave = 0;
      studyLeave = 0;
      carryOverMax = 0;
      break;
  }
  
  return {
    annualLeave,
    sickLeave,
    maternityLeave: DEFAULT_LEAVE_ENTITLEMENTS.maternityLeave,
    paternityLeave: DEFAULT_LEAVE_ENTITLEMENTS.paternityLeave,
    compassionateLeave: DEFAULT_LEAVE_ENTITLEMENTS.compassionateLeave,
    studyLeave,
    unpaidLeaveMax: DEFAULT_LEAVE_ENTITLEMENTS.unpaidLeaveMax,
    carryOverMax,
    carryOverExpiry: DEFAULT_LEAVE_ENTITLEMENTS.carryOverExpiry,
  };
}

// ============================================
// Export Module
// ============================================

export const employeeService = {
  // CRUD
  createEmployee,
  getEmployee,
  getEmployeeByNumber,
  getEmployeeByEmail,
  updateEmployee,
  bulkSetEmployeeSubsidiary,
  setEmployeeSubsidiaryAllocations,
  deleteEmployee,
  
  // Status
  changeEmployeeStatus,
  confirmEmployee,
  
  // Transfer
  transferEmployee,
  
  // Queries
  listEmployees,
  searchEmployees,
  getEmployeesByDepartment,
  getDirectReports,
  getExpiringProbations,
  getExpiringContracts,

  // Stats
  getEmployeeStats,

  // Role Assignment
  updateEmployeeRoles,

  // Utilities
  employeeToSummary,
};
