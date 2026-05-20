/**
 * Contract Template Service - DawinOS v2.0
 * 
 * Service for managing contract templates and generating
 * contract documents with variable substitution.
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
} from 'firebase/firestore';
import { format } from 'date-fns';

import { db } from '../../../shared/services/firebase/firestore';
import { getEmployee } from './employee.service';
import { getContract } from './contract.service';

import {
  ContractTemplate,
  TemplateVariable,
  Contract,
} from '../types/contract.types';
import { Employee } from '../types/employee.types';

const TEMPLATES_COLLECTION = 'contract_templates';

// ============================================================================
// Template CRUD
// ============================================================================

/**
 * Get template by ID
 */
export async function getTemplate(templateId: string): Promise<ContractTemplate | null> {
  const docRef = doc(db, TEMPLATES_COLLECTION, templateId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return docSnap.data() as ContractTemplate;
}

/**
 * List templates for a contract type
 */
export async function listTemplates(
  contractType?: string,
  subsidiaryId?: string
): Promise<ContractTemplate[]> {
  let q = query(
    collection(db, TEMPLATES_COLLECTION),
    where('status', '==', 'active'),
    orderBy('name', 'asc')
  );

  if (contractType) {
    q = query(q, where('contractType', '==', contractType));
  }

  const snapshot = await getDocs(q);
  let templates = snapshot.docs.map(d => d.data() as ContractTemplate);

  // Filter by subsidiary (null = available to all)
  if (subsidiaryId) {
    templates = templates.filter(t => 
      !t.subsidiaryId || t.subsidiaryId === subsidiaryId
    );
  }

  return templates;
}

/**
 * Create new template
 */
export async function createTemplate(
  input: Omit<ContractTemplate, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'version' | 'status'>,
  userId: string
): Promise<ContractTemplate> {
  const templateId = doc(collection(db, TEMPLATES_COLLECTION)).id;
  const now = Timestamp.now();

  const template: ContractTemplate = {
    ...input,
    id: templateId,
    status: 'draft',
    version: 1,
    createdBy: userId,
    createdAt: now,
    updatedBy: userId,
    updatedAt: now,
  };

  await setDoc(doc(db, TEMPLATES_COLLECTION, templateId), template);

  return template;
}

/**
 * Update template
 */
export async function updateTemplate(
  templateId: string,
  input: Partial<ContractTemplate>,
  userId: string
): Promise<ContractTemplate> {
  const existing = await getTemplate(templateId);
  if (!existing) throw new Error('Template not found');

  const updates: Partial<ContractTemplate> = {
    ...input,
    version: existing.version + 1,
    updatedBy: userId,
    updatedAt: Timestamp.now(),
  };

  await updateDoc(doc(db, TEMPLATES_COLLECTION, templateId), updates);

  return { ...existing, ...updates } as ContractTemplate;
}

/**
 * Publish template (make active)
 */
export async function publishTemplate(
  templateId: string,
  userId: string
): Promise<ContractTemplate> {
  const template = await getTemplate(templateId);
  if (!template) throw new Error('Template not found');

  const updates: Partial<ContractTemplate> = {
    status: 'active',
    publishedAt: Timestamp.now(),
    updatedBy: userId,
    updatedAt: Timestamp.now(),
  };

  await updateDoc(doc(db, TEMPLATES_COLLECTION, templateId), updates);

  return { ...template, ...updates } as ContractTemplate;
}

/**
 * Deprecate template
 */
export async function deprecateTemplate(
  templateId: string,
  userId: string
): Promise<ContractTemplate> {
  const template = await getTemplate(templateId);
  if (!template) throw new Error('Template not found');

  const updates: Partial<ContractTemplate> = {
    status: 'deprecated',
    updatedBy: userId,
    updatedAt: Timestamp.now(),
  };

  await updateDoc(doc(db, TEMPLATES_COLLECTION, templateId), updates);

  return { ...template, ...updates } as ContractTemplate;
}

// ============================================================================
// Template Processing
// ============================================================================

/**
 * Get available variables for template
 */
export function getAvailableVariables(): TemplateVariable[] {
  return [
    // Employee variables
    { key: '{{employee_name}}', label: 'Employee Full Name', type: 'text', source: 'employee', sourcePath: 'fullName', required: true },
    { key: '{{employee_first_name}}', label: 'Employee First Name', type: 'text', source: 'employee', sourcePath: 'firstName', required: true },
    { key: '{{employee_last_name}}', label: 'Employee Last Name', type: 'text', source: 'employee', sourcePath: 'lastName', required: true },
    { key: '{{employee_number}}', label: 'Employee Number', type: 'text', source: 'employee', sourcePath: 'employeeNumber', required: true },
    { key: '{{employee_email}}', label: 'Employee Email', type: 'text', source: 'employee', sourcePath: 'email', required: true },
    { key: '{{employee_phone}}', label: 'Employee Phone', type: 'text', source: 'employee', sourcePath: 'phoneNumbers[0].number', required: false },
    { key: '{{employee_address}}', label: 'Employee Address', type: 'text', source: 'employee', sourcePath: 'addresses[0]', required: false },
    { key: '{{employee_national_id}}', label: 'National ID Number', type: 'text', source: 'employee', sourcePath: 'nationalIds[0].idNumber', required: false },
    { key: '{{employee_nssf}}', label: 'NSSF Number', type: 'text', source: 'employee', sourcePath: 'nssf.memberNumber', required: false },
    { key: '{{employee_tin}}', label: 'TIN Number', type: 'text', source: 'employee', sourcePath: 'tax.tinNumber', required: false },
    
    // Contract variables
    { key: '{{contract_number}}', label: 'Contract Number', type: 'text', source: 'contract', sourcePath: 'contractNumber', required: true },
    { key: '{{contract_type}}', label: 'Contract Type', type: 'text', source: 'contract', sourcePath: 'contractType', required: true },
    { key: '{{effective_date}}', label: 'Effective Date', type: 'date', source: 'contract', sourcePath: 'effectiveDate', required: true, format: 'dd MMMM yyyy' },
    { key: '{{start_date}}', label: 'Start Date', type: 'date', source: 'contract', sourcePath: 'startDate', required: true, format: 'dd MMMM yyyy' },
    { key: '{{end_date}}', label: 'End Date', type: 'date', source: 'contract', sourcePath: 'endDate', required: false, format: 'dd MMMM yyyy' },
    { key: '{{position_title}}', label: 'Position Title', type: 'text', source: 'contract', sourcePath: 'position.title', required: true },
    { key: '{{department}}', label: 'Department', type: 'text', source: 'contract', sourcePath: 'position.department', required: true },
    { key: '{{location}}', label: 'Work Location', type: 'text', source: 'contract', sourcePath: 'position.location', required: true },
    { key: '{{reporting_to}}', label: 'Reports To', type: 'text', source: 'contract', sourcePath: 'position.reportingTo', required: true },
    
    // Compensation variables
    { key: '{{base_salary}}', label: 'Base Salary', type: 'currency', source: 'contract', sourcePath: 'compensation.baseSalary', required: true },
    { key: '{{salary_words}}', label: 'Salary in Words', type: 'text', source: 'custom', required: false },
    { key: '{{payment_frequency}}', label: 'Payment Frequency', type: 'text', source: 'contract', sourcePath: 'compensation.paymentFrequency', required: true },
    { key: '{{payment_method}}', label: 'Payment Method', type: 'text', source: 'contract', sourcePath: 'compensation.paymentMethod', required: true },
    
    // Schedule variables
    { key: '{{work_hours}}', label: 'Weekly Hours', type: 'number', source: 'contract', sourcePath: 'schedule.hoursPerWeek', required: true },
    { key: '{{work_days}}', label: 'Work Days', type: 'list', source: 'contract', sourcePath: 'schedule.workDays', required: true },
    
    // Leave variables
    { key: '{{annual_leave}}', label: 'Annual Leave Days', type: 'number', source: 'contract', sourcePath: 'leaveEntitlements.annualLeave', required: true },
    { key: '{{sick_leave}}', label: 'Sick Leave Days', type: 'number', source: 'contract', sourcePath: 'leaveEntitlements.sickLeave', required: true },
    { key: '{{maternity_leave}}', label: 'Maternity Leave Days', type: 'number', source: 'contract', sourcePath: 'leaveEntitlements.maternityLeave', required: false },
    { key: '{{paternity_leave}}', label: 'Paternity Leave Days', type: 'number', source: 'contract', sourcePath: 'leaveEntitlements.paternityLeave', required: false },
    
    // Notice period variables
    { key: '{{employee_notice_days}}', label: 'Employee Notice Period (Days)', type: 'number', source: 'contract', sourcePath: 'noticePeriod.employeeNoticeDays', required: true },
    { key: '{{employer_notice_days}}', label: 'Employer Notice Period (Days)', type: 'number', source: 'contract', sourcePath: 'noticePeriod.employerNoticeDays', required: true },
    
    // Probation variables
    { key: '{{probation_duration}}', label: 'Probation Duration (Months)', type: 'number', source: 'contract', sourcePath: 'probation.duration', required: false },
    { key: '{{probation_end_date}}', label: 'Probation End Date', type: 'date', source: 'contract', sourcePath: 'probation.endDate', required: false, format: 'dd MMMM yyyy' },
    
    // Company variables
    { key: '{{company_name}}', label: 'Company Name', type: 'text', source: 'company', required: true },
    { key: '{{company_address}}', label: 'Company Address', type: 'text', source: 'company', required: true },
    { key: '{{company_registration}}', label: 'Company Registration Number', type: 'text', source: 'company', required: false },
    { key: '{{company_tin}}', label: 'Company TIN', type: 'text', source: 'company', required: false },
    
    // Date variables
    { key: '{{current_date}}', label: 'Current Date', type: 'date', source: 'custom', required: true, format: 'dd MMMM yyyy' },
    { key: '{{current_year}}', label: 'Current Year', type: 'text', source: 'custom', required: true },
  ];
}

/**
 * Process template and substitute variables
 */
export async function processTemplate(
  templateId: string,
  contractId: string,
  companyData: Record<string, any> = {}
): Promise<string> {
  const template = await getTemplate(templateId);
  if (!template) throw new Error('Template not found');

  const contract = await getContract(contractId);
  if (!contract) throw new Error('Contract not found');

  const employee = await getEmployee(contract.employeeId);
  if (!employee) throw new Error('Employee not found');

  // Build variable values map
  const values = buildVariableValues(contract, employee, companyData);

  // Process each section
  const processedSections: string[] = [];

  for (const section of template.sections.sort((a, b) => a.order - b.order)) {
    // Check conditions
    if (section.conditions?.length) {
      const conditionsMet = section.conditions.every(condition => {
        const value = getNestedValue(contract, condition.field);
        return evaluateCondition(value, condition.operator, condition.value);
      });
      
      if (!conditionsMet && !section.includeByDefault) {
        continue;
      }
    }

    // Substitute variables in content
    let content = section.content;
    for (const [key, value] of Object.entries(values)) {
      content = content.replace(new RegExp(escapeRegex(key), 'g'), value);
    }

    processedSections.push(`<h2>${section.title}</h2>\n${content}`);
  }

  // Combine with header and footer
  let document = '';
  
  if (template.headerHtml) {
    let header = template.headerHtml;
    for (const [key, value] of Object.entries(values)) {
      header = header.replace(new RegExp(escapeRegex(key), 'g'), value);
    }
    document += header;
  }

  document += processedSections.join('\n\n');

  if (template.footerHtml) {
    let footer = template.footerHtml;
    for (const [key, value] of Object.entries(values)) {
      footer = footer.replace(new RegExp(escapeRegex(key), 'g'), value);
    }
    document += footer;
  }

  return document;
}

/**
 * Preview template with sample data
 */
export async function previewTemplate(
  templateId: string,
  sampleData?: {
    employee?: Partial<Employee>;
    contract?: Partial<Contract>;
    company?: Record<string, any>;
  }
): Promise<string> {
  const template = await getTemplate(templateId);
  if (!template) throw new Error('Template not found');

  // Use sample data or defaults
  const employee = {
    firstName: 'John',
    lastName: 'Doe',
    employeeNumber: 'EMP-FIN-2026-0001',
    email: 'john.doe@example.com',
    ...sampleData?.employee,
  } as unknown as Employee;

  const contract = {
    contractNumber: 'CTR-FIN-2026-0001',
    contractType: 'permanent',
    effectiveDate: Timestamp.now(),
    startDate: Timestamp.now(),
    position: {
      title: 'Software Developer',
      department: 'Technology',
      location: 'Kampala HQ',
      reportingTo: 'Jane Manager',
    },
    compensation: {
      baseSalary: 5000000,
      paymentFrequency: 'monthly',
      paymentMethod: 'bank_transfer',
    },
    schedule: {
      hoursPerWeek: 40,
      workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    },
    leaveEntitlements: {
      annualLeave: 21,
      sickLeave: 14,
    },
    noticePeriod: {
      employeeNoticeDays: 30,
      employerNoticeDays: 30,
    },
    ...sampleData?.contract,
  } as unknown as Contract;

  const companyData = {
    company_name: 'Dawin Group Ltd',
    company_address: 'Plot 123, Kampala Road, Kampala, Uganda',
    company_registration: 'UG-2020-12345',
    company_tin: '1001234567',
    ...sampleData?.company,
  };

  // Build variable values map
  const values = buildVariableValues(contract, employee, companyData);

  // Process each section
  const processedSections: string[] = [];

  for (const section of template.sections.sort((a, b) => a.order - b.order)) {
    if (!section.includeByDefault && section.isOptional) continue;

    let content = section.content;
    for (const [key, value] of Object.entries(values)) {
      content = content.replace(new RegExp(escapeRegex(key), 'g'), value);
    }

    processedSections.push(`<h2>${section.title}</h2>\n${content}`);
  }

  // Combine
  let document = '';
  
  if (template.headerHtml) {
    let header = template.headerHtml;
    for (const [key, value] of Object.entries(values)) {
      header = header.replace(new RegExp(escapeRegex(key), 'g'), value);
    }
    document += header;
  }

  document += processedSections.join('\n\n');

  if (template.footerHtml) {
    let footer = template.footerHtml;
    for (const [key, value] of Object.entries(values)) {
      footer = footer.replace(new RegExp(escapeRegex(key), 'g'), value);
    }
    document += footer;
  }

  return document;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build variable values from contract, employee, and company data
 */
function buildVariableValues(
  contract: Contract,
  employee: Employee,
  companyData: Record<string, any>
): Record<string, string> {
  const values: Record<string, string> = {};
  const variables = getAvailableVariables();

  for (const variable of variables) {
    let value: any;

    switch (variable.source) {
      case 'employee':
        if (variable.key === '{{employee_name}}') {
          value = `${employee.firstName} ${employee.lastName}`;
        } else {
          value = getNestedValue(employee, variable.sourcePath || '');
        }
        break;
      case 'contract':
        value = getNestedValue(contract, variable.sourcePath || '');
        break;
      case 'company':
        value = companyData[variable.key.replace(/\{\{|\}\}/g, '')];
        break;
      case 'custom':
        value = getCustomValue(variable.key, contract, employee);
        break;
    }

    // Format value based on type
    if (value !== undefined && value !== null) {
      values[variable.key] = formatValue(value, variable.type, variable.format);
    } else if (!variable.required) {
      values[variable.key] = '';
    } else {
      values[variable.key] = `[${variable.label}]`;
    }
  }

  return values;
}

/**
 * Get nested value from object using dot notation path
 */
function getNestedValue(obj: any, path: string): any {
  if (!path) return obj;
  
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    // Handle array notation like phones[0]
    const arrayMatch = part.match(/(\w+)\[(\d+)\]/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      current = current?.[key]?.[parseInt(index)];
    } else {
      current = current?.[part];
    }

    if (current === undefined || current === null) {
      return undefined;
    }
  }

  return current;
}

/**
 * Format value based on type
 */
function formatValue(value: any, type: TemplateVariable['type'], formatStr?: string): string {
  switch (type) {
    case 'date':
      if (value?.toDate) {
        return format(value.toDate(), formatStr || 'dd MMMM yyyy');
      }
      if (value instanceof Date) {
        return format(value, formatStr || 'dd MMMM yyyy');
      }
      return String(value);

    case 'currency':
      return new Intl.NumberFormat('en-UG', {
        style: 'currency',
        currency: 'UGX',
        minimumFractionDigits: 0,
      }).format(value);

    case 'number':
      return new Intl.NumberFormat('en-UG').format(value);

    case 'list':
      if (Array.isArray(value)) {
        return value.map(v => capitalizeFirst(v)).join(', ');
      }
      return String(value);

    default:
      return String(value);
  }
}

/**
 * Get custom calculated values
 */
function getCustomValue(key: string, contract: Contract, _employee: Employee): any {
  switch (key) {
    case '{{current_date}}':
      return new Date();
    case '{{current_year}}':
      return new Date().getFullYear().toString();
    case '{{salary_words}}':
      return numberToWords(contract.compensation.baseSalary);
    default:
      return undefined;
  }
}

/**
 * Evaluate condition for section inclusion
 */
function evaluateCondition(value: any, operator: string, expected: any): boolean {
  switch (operator) {
    case 'equals':
      return value === expected;
    case 'not_equals':
      return value !== expected;
    case 'contains':
      return String(value).includes(String(expected));
    case 'greater_than':
      return Number(value) > Number(expected);
    case 'less_than':
      return Number(value) < Number(expected);
    default:
      return false;
  }
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert number to words (simplified for Uganda Shillings)
 */
function numberToWords(num: number): string {
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];

  if (num === 0) return 'zero Uganda Shillings';

  const convertGroup = (n: number): string => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
      return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    }
    return ones[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + convertGroup(n % 100) : '');
  };

  const groups = [
    { value: 1000000000, name: 'billion' },
    { value: 1000000, name: 'million' },
    { value: 1000, name: 'thousand' },
    { value: 1, name: '' },
  ];

  let result = '';
  let remaining = num;

  for (const group of groups) {
    if (remaining >= group.value) {
      const count = Math.floor(remaining / group.value);
      remaining = remaining % group.value;
      result += (result ? ' ' : '') + convertGroup(count) + (group.name ? ' ' + group.name : '');
    }
  }

  return result.trim() + ' Uganda Shillings only';
}

// ============================================================================
// Default Templates
// ============================================================================

/**
 * Get default template sections for a contract type
 */
export function getDefaultTemplateSections(contractType: string): ContractTemplate['sections'] {
  const commonSections = [
    {
      id: 'parties',
      title: 'PARTIES',
      order: 1,
      content: `This Employment Contract is entered into between:\n\n<strong>THE EMPLOYER:</strong> {{company_name}}, a company registered in Uganda with registration number {{company_registration}}, having its registered office at {{company_address}} (hereinafter referred to as "the Employer")\n\nAND\n\n<strong>THE EMPLOYEE:</strong> {{employee_name}}, holder of National ID Number {{employee_national_id}}, residing at {{employee_address}} (hereinafter referred to as "the Employee")`,
      isOptional: false,
      includeByDefault: true,
    },
    {
      id: 'position',
      title: 'POSITION AND DUTIES',
      order: 2,
      content: `The Employee is appointed to the position of <strong>{{position_title}}</strong> in the <strong>{{department}}</strong> department, reporting to {{reporting_to}}.\n\nThe Employee shall perform such duties as are customarily associated with the position and such other duties as may be assigned from time to time by the Employer.\n\nThe primary place of work shall be at {{location}}.`,
      isOptional: false,
      includeByDefault: true,
    },
    {
      id: 'duration',
      title: 'DURATION OF EMPLOYMENT',
      order: 3,
      content: `This contract shall commence on {{start_date}} and shall continue until terminated in accordance with the terms of this agreement.\n\nThe effective date of this contract is {{effective_date}}.`,
      isOptional: false,
      includeByDefault: true,
    },
    {
      id: 'remuneration',
      title: 'REMUNERATION',
      order: 4,
      content: `The Employee shall receive a gross monthly salary of {{base_salary}} ({{salary_words}}).\n\nPayment shall be made {{payment_frequency}} via {{payment_method}}.\n\nThe salary is subject to statutory deductions including PAYE, NSSF, and Local Service Tax as applicable under Ugandan law.`,
      isOptional: false,
      includeByDefault: true,
    },
    {
      id: 'working_hours',
      title: 'WORKING HOURS',
      order: 5,
      content: `The Employee shall work {{work_hours}} hours per week.\n\nThe normal working days are {{work_days}}.\n\nThe Employee may be required to work additional hours as necessary to fulfill job responsibilities.`,
      isOptional: false,
      includeByDefault: true,
    },
    {
      id: 'leave',
      title: 'LEAVE ENTITLEMENTS',
      order: 6,
      content: `The Employee shall be entitled to the following leave per annum:\n\n- Annual Leave: {{annual_leave}} working days\n- Sick Leave: {{sick_leave}} working days\n- Maternity Leave: {{maternity_leave}} working days (as per Uganda Employment Act 2006)\n- Paternity Leave: {{paternity_leave}} working days`,
      isOptional: false,
      includeByDefault: true,
    },
    {
      id: 'notice',
      title: 'TERMINATION AND NOTICE PERIOD',
      order: 7,
      content: `Either party may terminate this contract by giving written notice as follows:\n\n- Notice by Employee: {{employee_notice_days}} days\n- Notice by Employer: {{employer_notice_days}} days\n\nThe Employer may, at its discretion, make payment in lieu of the notice period.`,
      isOptional: false,
      includeByDefault: true,
    },
    {
      id: 'confidentiality',
      title: 'CONFIDENTIALITY',
      order: 8,
      content: `The Employee shall maintain strict confidentiality with respect to all proprietary information, trade secrets, and business affairs of the Employer, both during employment and after termination.`,
      isOptional: true,
      includeByDefault: true,
    },
    {
      id: 'signatures',
      title: 'SIGNATURES',
      order: 99,
      content: `IN WITNESS WHEREOF, the parties have executed this Agreement as of {{current_date}}.\n\n<strong>FOR THE EMPLOYER:</strong>\n\nSignature: _____________________\n\nName: _____________________\n\nTitle: _____________________\n\nDate: _____________________\n\n<strong>THE EMPLOYEE:</strong>\n\nSignature: _____________________\n\nName: {{employee_name}}\n\nDate: _____________________`,
      isOptional: false,
      includeByDefault: true,
    },
  ];

  // Add probation section for probationary contracts
  if (contractType === 'probationary' || contractType === 'permanent') {
    commonSections.splice(3, 0, {
      id: 'probation',
      title: 'PROBATIONARY PERIOD',
      order: 3.5,
      content: `The Employee shall serve a probationary period of {{probation_duration}} months, ending on {{probation_end_date}}.\n\nDuring the probationary period, either party may terminate this contract with {{employer_notice_days}} days notice.\n\nConfirmation of employment shall be subject to satisfactory performance during the probationary period.`,
      isOptional: true,
      includeByDefault: true,
    });
  }

  // Add end date section for fixed-term contracts
  if (contractType === 'fixed_term') {
    commonSections[2] = {
      ...commonSections[2],
      content: `This contract shall commence on {{start_date}} and shall terminate on {{end_date}}, unless renewed or extended by mutual agreement.\n\nThe effective date of this contract is {{effective_date}}.`,
    };
  }

  return commonSections;
}
