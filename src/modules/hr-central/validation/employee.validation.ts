/**
 * Employee Validation - DawinOS v2.0
 * Zod schemas for employee data validation
 */

import { z } from 'zod';

// ============================================
// Common Validations
// ============================================

export const phoneNumberSchema = z.object({
  type: z.enum(['mobile', 'work', 'home', 'emergency']),
  number: z.string()
    .min(9, 'Phone number too short')
    .max(15, 'Phone number too long')
    .regex(/^[+]?[0-9\s-]+$/, 'Invalid phone number format'),
  isPrimary: z.boolean().default(false),
  isWhatsApp: z.boolean().optional(),
  countryCode: z.string().default('+256'),
});

export const addressSchema = z.object({
  addressLine1: z.string().min(1, 'Address is required').max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(1, 'City is required').max(100),
  district: z.string().min(1, 'District is required').max(100),
  region: z.string().max(50).optional(),
  country: z.string().default('Uganda'),
  postalCode: z.string().max(20).optional(),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
  isResidential: z.boolean().default(true),
  isPermanent: z.boolean().default(false),
});

export const emergencyContactSchema = z.object({
  name: z.string().min(2, 'Name is required').max(100),
  relationship: z.string().min(1, 'Relationship is required').max(50),
  phoneNumbers: z.array(phoneNumberSchema).min(1, 'At least one phone number required'),
  email: z.string().email().optional(),
  address: addressSchema.optional(),
  isPrimary: z.boolean().default(false),
});

export const nationalIdSchema = z.object({
  type: z.enum(['national_id', 'passport', 'driving_license', 'refugee_id']),
  number: z.string().min(1, 'ID number is required').max(50),
  issueDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
  issuingAuthority: z.string().min(1, 'Issuing authority is required'),
  documentUrl: z.string().url().optional(),
});

export const bankAccountSchema = z.object({
  bankName: z.string().min(1, 'Bank name is required').max(100),
  bankCode: z.string().max(20).optional(),
  branchName: z.string().min(1, 'Branch name is required').max(100),
  branchCode: z.string().max(20).optional(),
  accountNumber: z.string().min(5, 'Invalid account number').max(30),
  accountName: z.string().min(1, 'Account name is required').max(100),
  accountType: z.enum(['savings', 'current', 'salary']),
  swiftCode: z.string().max(15).optional(),
  isPrimary: z.boolean().default(false),
  isVerified: z.boolean().default(false),
});

export const mobileMoneySchema = z.object({
  provider: z.enum(['mtn', 'airtel', 'other']),
  phoneNumber: z.string()
    .regex(/^(\+256|0)[0-9]{9}$/, 'Invalid Uganda mobile number'),
  accountName: z.string().min(1).max(100),
  isPrimary: z.boolean().default(false),
  isVerified: z.boolean().default(false),
});

export const educationSchema = z.object({
  id: z.string().uuid(),
  institution: z.string().min(2).max(200),
  qualification: z.string().min(1).max(100),
  fieldOfStudy: z.string().min(1).max(100),
  grade: z.string().max(50).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  isCompleted: z.boolean(),
  certificateUrl: z.string().url().optional(),
});

export const dependentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(100),
  relationship: z.enum(['spouse', 'child', 'parent', 'sibling', 'other']),
  dateOfBirth: z.string().datetime(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
  isDisabled: z.boolean().optional(),
  nationalId: z.string().max(50).optional(),
  documentUrl: z.string().url().optional(),
});

export const skillSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  category: z.enum(['technical', 'soft', 'language', 'certification', 'other']),
  proficiencyLevel: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  yearsOfExperience: z.number().min(0).max(50).optional(),
  isVerified: z.boolean().default(false),
});

export const workExperienceSchema = z.object({
  id: z.string().uuid(),
  company: z.string().min(1).max(200),
  position: z.string().min(1).max(100),
  department: z.string().max(100).optional(),
  location: z.string().max(100).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  isCurrent: z.boolean(),
  responsibilities: z.array(z.string().max(500)).optional(),
  referenceContact: z.object({
    name: z.string().max(100),
    phone: z.string().max(20),
    email: z.string().email().optional(),
  }).optional(),
});

export const certificationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  issuingBody: z.string().min(1).max(200),
  issueDate: z.string().datetime(),
  expiryDate: z.string().datetime().optional(),
  certificateNumber: z.string().max(50).optional(),
  certificateUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
});

// ============================================
// Employee Creation Schema
// ============================================

export const createEmployeeSchema = z.object({
  subsidiaryId: z.string().min(1, 'Subsidiary is required'),
  
  // Personal (required)
  firstName: z.string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name too long')
    .regex(/^[a-zA-Z\s'-]+$/, 'Invalid characters in first name'),
  middleName: z.string().max(50).optional(),
  lastName: z.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name too long')
    .regex(/^[a-zA-Z\s'-]+$/, 'Invalid characters in last name'),
  dateOfBirth: z.string()
    .refine((date) => {
      const dob = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      return !isNaN(dob.getTime()) && age >= 16 && age <= 100;
    }, 'Employee must be between 16 and 100 years old'),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
  nationality: z.string().min(2).max(50),
  
  // Contact (required)
  email: z.string()
    .email('Invalid email address')
    .toLowerCase(),
  phoneNumbers: z.array(phoneNumberSchema)
    .min(1, 'At least one phone number is required')
    .max(5, 'Maximum 5 phone numbers allowed'),
  
  // Employment (required)
  employmentType: z.enum([
    'permanent', 'contract', 'probation', 'part_time', 
    'casual', 'intern', 'consultant'
  ]),
  position: z.object({
    title: z.string().min(2).max(100),
    departmentId: z.string().min(1, 'Department is required'),
    reportingTo: z.string().optional(),
    location: z.string().min(1).max(100),
    isManagement: z.boolean().default(false),
  }),
  joiningDate: z.string().datetime(),
  
  // Optional fields
  personalEmail: z.string().email().optional(),
  maritalStatus: z.enum([
    'single', 'married', 'divorced', 'widowed', 'separated'
  ]).optional(),
  religion: z.string().max(50).optional(),
  photoUrl: z.string().url().optional(),
  addresses: z.array(addressSchema).max(3).optional(),
  emergencyContacts: z.array(emergencyContactSchema).max(3).optional(),
  nationalIds: z.array(nationalIdSchema).max(4).optional(),
  bankAccounts: z.array(bankAccountSchema).max(3).optional(),
  mobileMoneyAccounts: z.array(mobileMoneySchema).max(3).optional(),
  preferredPaymentMethod: z.enum(['bank', 'mobile_money', 'cash', 'check']).optional(),
  
  // Statutory (Uganda)
  nssfNumber: z.string()
    .regex(/^[A-Z]{2}[0-9]+$/, 'Invalid NSSF number format')
    .optional(),
  tinNumber: z.string()
    .regex(/^[0-9]{10}$/, 'TIN must be 10 digits')
    .optional(),
  
  // System access
  createSystemAccess: z.boolean().default(false),
  accessRoles: z.array(z.string()).optional(),
  
  // Notes
  notes: z.string().max(2000).optional(),
  customFields: z.record(z.string(), z.any()).optional(),
}).refine((data) => {
  // Ensure at least one primary phone
  const hasPrimaryPhone = data.phoneNumbers.some(p => p.isPrimary);
  if (!hasPrimaryPhone && data.phoneNumbers.length > 0) {
    data.phoneNumbers[0].isPrimary = true;
  }
  return true;
});

// ============================================
// Employee Update Schema
// ============================================

export const updateEmployeeSchema = z.object({
  firstName: z.string().min(2).max(50).optional(),
  middleName: z.string().max(50).optional().nullable(),
  lastName: z.string().min(2).max(50).optional(),
  preferredName: z.string().max(50).optional().nullable(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  maritalStatus: z.enum([
    'single', 'married', 'divorced', 'widowed', 'separated'
  ]).optional(),
  nationality: z.string().min(2).max(50).optional(),
  religion: z.string().max(50).optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
  
  email: z.string().email().toLowerCase().optional(),
  personalEmail: z.string().email().optional().nullable(),
  phoneNumbers: z.array(phoneNumberSchema).optional(),
  addresses: z.array(addressSchema).optional(),
  emergencyContacts: z.array(emergencyContactSchema).optional(),
  
  nationalIds: z.array(nationalIdSchema).optional(),
  
  bankAccounts: z.array(bankAccountSchema).optional(),
  mobileMoneyAccounts: z.array(mobileMoneySchema).optional(),
  preferredPaymentMethod: z.enum(['bank', 'mobile_money', 'cash', 'check']).optional(),
  
  education: z.array(educationSchema).optional(),
  certifications: z.array(certificationSchema).optional(),
  workExperience: z.array(workExperienceSchema).optional(),
  skills: z.array(skillSchema).optional(),
  dependents: z.array(dependentSchema).optional(),
  
  tags: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional().nullable(),
  customFields: z.record(z.string(), z.any()).optional(),
  
  // Position updates (including reportingTo for org structure)
  position: z.object({
    title: z.string().min(2).max(100).optional(),
    departmentId: z.string().optional(),
    reportingTo: z.string().optional().nullable(),
    location: z.string().max(100).optional(),
    isManagement: z.boolean().optional(),
  }).optional(),
  
  updateReason: z.string().max(500).optional(),
});

// ============================================
// Status Change Schema
// ============================================

export const changeStatusSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  newStatus: z.enum([
    'active', 'probation', 'suspended', 'notice_period',
    'on_leave', 'terminated', 'resigned', 'retired'
  ]),
  effectiveDate: z.string().datetime(),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500),
  
  terminationReason: z.enum([
    'resignation', 'dismissal', 'redundancy', 'contract_end',
    'retirement', 'death', 'mutual_agreement', 'abandonment',
    'medical', 'other'
  ]).optional(),
  lastWorkingDate: z.string().datetime().optional(),
  exitInterviewDate: z.string().datetime().optional(),
  
  suspensionEndDate: z.string().datetime().optional(),
  noticePeriodDays: z.number().min(0).max(180).optional(),
  
  notes: z.string().max(2000).optional(),
}).refine((data) => {
  // Require termination reason if status is terminated/resigned
  if (['terminated', 'resigned', 'retired'].includes(data.newStatus)) {
    return !!data.terminationReason;
  }
  return true;
}, {
  message: 'Termination reason is required for termination/resignation/retirement',
  path: ['terminationReason'],
});

// ============================================
// Transfer Schema
// ============================================

export const transferEmployeeSchema = z.object({
  employeeId: z.string().min(1),
  transferType: z.enum(['promotion', 'lateral_move', 'demotion', 'relocation']),
  effectiveDate: z.string().datetime(),
  
  newTitle: z.string().min(2).max(100).optional(),
  newDepartmentId: z.string().optional(),
  newSubsidiaryId: z.string().optional(),
  newReportingTo: z.string().optional(),
  newLocation: z.string().max(100).optional(),
  newGradeLevel: z.string().max(20).optional(),
  
  salaryChange: z.object({
    newBaseSalary: z.number().positive(),
    changeReason: z.string().min(10).max(500),
  }).optional(),
  
  reason: z.string().min(10).max(500),
  notes: z.string().max(2000).optional(),
}).refine((data) => {
  // At least one change must be specified
  return !!(
    data.newTitle ||
    data.newDepartmentId ||
    data.newSubsidiaryId ||
    data.newReportingTo ||
    data.newLocation ||
    data.newGradeLevel ||
    data.salaryChange
  );
}, {
  message: 'At least one change must be specified for transfer',
});

// ============================================
// Work Schedule Schema
// ============================================

export const workScheduleSchema = z.object({
  type: z.enum(['full_time', 'part_time', 'shift', 'flexible']),
  workDays: z.array(z.enum([
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ])).min(1, 'At least one work day required'),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
  breakDuration: z.number().min(0).max(180),
  weeklyHours: z.number().min(1).max(84),
  isRemoteEligible: z.boolean().default(false),
  remoteWorkDays: z.number().min(0).max(7).optional(),
});

// ============================================
// NSSF Details Schema
// ============================================

export const nssfDetailsSchema = z.object({
  memberNumber: z.string()
    .min(1, 'NSSF member number is required')
    .regex(/^[A-Z]{2}[0-9]+$/, 'Invalid NSSF number format'),
  registrationDate: z.string().datetime().optional(),
  employeeContribution: z.number().min(0).max(100).default(5),
  employerContribution: z.number().min(0).max(100).default(10),
  isActive: z.boolean().default(true),
  documentUrl: z.string().url().optional(),
});

// ============================================
// Tax Details Schema
// ============================================

export const taxDetailsSchema = z.object({
  tinNumber: z.string()
    .regex(/^[0-9]{10}$/, 'TIN must be exactly 10 digits'),
  registrationDate: z.string().datetime().optional(),
  taxExempt: z.boolean().default(false),
  exemptionReason: z.string().max(500).optional(),
  exemptionDocumentUrl: z.string().url().optional(),
}).refine((data) => {
  // If tax exempt, reason is required
  if (data.taxExempt && !data.exemptionReason) {
    return false;
  }
  return true;
}, {
  message: 'Exemption reason is required when tax exempt',
  path: ['exemptionReason'],
});

// ============================================
// Leave Entitlement Schema
// ============================================

export const leaveEntitlementSchema = z.object({
  annualLeave: z.number().min(0).max(60).default(21),
  sickLeave: z.number().min(0).max(60).default(14),
  maternityLeave: z.number().min(0).max(120).optional(),
  paternityLeave: z.number().min(0).max(30).optional(),
  compassionateLeave: z.number().min(0).max(30).default(4),
  studyLeave: z.number().min(0).max(60).optional(),
  unpaidLeaveMax: z.number().min(0).max(365).default(30),
  carryOverMax: z.number().min(0).max(30).default(10),
  carryOverExpiry: z.number().min(1).max(12).optional(),
});

// ============================================
// Export validation functions
// ============================================

export type CreateEmployeeInputSchema = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInputSchema = z.infer<typeof updateEmployeeSchema>;
export type ChangeStatusInputSchema = z.infer<typeof changeStatusSchema>;
export type TransferEmployeeInputSchema = z.infer<typeof transferEmployeeSchema>;

export const validateCreateEmployee = (data: unknown) => 
  createEmployeeSchema.parse(data);

export const validateUpdateEmployee = (data: unknown) =>
  updateEmployeeSchema.parse(data);

export const validateStatusChange = (data: unknown) =>
  changeStatusSchema.parse(data);

export const validateTransfer = (data: unknown) =>
  transferEmployeeSchema.parse(data);

export const validateWorkSchedule = (data: unknown) =>
  workScheduleSchema.parse(data);

export const validateNssfDetails = (data: unknown) =>
  nssfDetailsSchema.parse(data);

export const validateTaxDetails = (data: unknown) =>
  taxDetailsSchema.parse(data);

export const validateLeaveEntitlement = (data: unknown) =>
  leaveEntitlementSchema.parse(data);

/**
 * Safe validation that returns result instead of throwing
 */
export const safeValidateCreateEmployee = (data: unknown) => 
  createEmployeeSchema.safeParse(data);

export const safeValidateUpdateEmployee = (data: unknown) =>
  updateEmployeeSchema.safeParse(data);

export const safeValidateStatusChange = (data: unknown) =>
  changeStatusSchema.safeParse(data);

export const safeValidateTransfer = (data: unknown) =>
  transferEmployeeSchema.safeParse(data);
