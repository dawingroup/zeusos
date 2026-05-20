/**
 * Compliance Module Constants
 * Uganda-specific templates, labels, and configuration.
 */

import type {
  ComplianceDocumentStatus,
  ComplianceDocumentCategory,
  RegulatoryBody,
  RenewalFrequency,
  ObligationStatus,
  ObligationPriority,
  DocumentTemplate,
  ObligationTemplate,
} from './index';

// ── Status Labels & Colors ─────────────────────────────────────────────────

export const DOCUMENT_STATUS_LABELS: Record<ComplianceDocumentStatus, string> = {
  valid: 'Valid',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
  missing: 'Missing',
  not_applicable: 'N/A',
  pending_verification: 'Pending Verification',
};

export const DOCUMENT_STATUS_COLORS: Record<ComplianceDocumentStatus, string> = {
  valid: 'bg-green-100 text-green-800 border-green-200',
  expiring_soon: 'bg-amber-100 text-amber-800 border-amber-200',
  expired: 'bg-red-100 text-red-800 border-red-200',
  missing: 'bg-gray-100 text-gray-800 border-gray-200',
  not_applicable: 'bg-slate-100 text-slate-600 border-slate-200',
  pending_verification: 'bg-blue-100 text-blue-800 border-blue-200',
};

export const DOCUMENT_STATUS_DOT_COLORS: Record<ComplianceDocumentStatus, string> = {
  valid: 'bg-green-500',
  expiring_soon: 'bg-amber-500',
  expired: 'bg-red-500',
  missing: 'bg-gray-400',
  not_applicable: 'bg-slate-400',
  pending_verification: 'bg-blue-500',
};

// ── Category Labels ────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<ComplianceDocumentCategory, string> = {
  financial: 'Financial',
  legal: 'Legal',
  tax: 'Tax',
  statutory: 'Statutory',
  licensing: 'Licensing',
  regulatory: 'Regulatory',
  business: 'Business',
  insurance: 'Insurance',
  employment: 'Employment',
};

// ── Regulatory Body Labels ─────────────────────────────────────────────────

export const REGULATORY_BODY_LABELS: Record<RegulatoryBody, string> = {
  URA: 'Uganda Revenue Authority',
  NSSF: 'National Social Security Fund',
  KCCA: 'Kampala Capital City Authority',
  URSB: 'Uganda Registration Services Bureau',
  NEMA: 'National Environment Management Authority',
  MoFPED: 'Ministry of Finance',
  BoU: 'Bank of Uganda',
  UIA: 'Uganda Investment Authority',
  LOCAL_COUNCIL: 'Local Council',
  OTHER: 'Other',
};

// ── Frequency Labels ───────────────────────────────────────────────────────

export const FREQUENCY_LABELS: Record<RenewalFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annually: 'Semi-Annually',
  annually: 'Annually',
  biennial: 'Every 2 Years',
  one_time: 'One-Time',
  ad_hoc: 'Ad Hoc',
};

// ── Obligation Labels ──────────────────────────────────────────────────────

export const OBLIGATION_STATUS_LABELS: Record<ObligationStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
};

export const OBLIGATION_PRIORITY_LABELS: Record<ObligationPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const OBLIGATION_PRIORITY_COLORS: Record<ObligationPriority, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

// ── History Action Labels ──────────────────────────────────────────────────

export const HISTORY_ACTION_LABELS: Record<string, string> = {
  uploaded: 'File Uploaded',
  verified: 'Verified',
  expired: 'Expired',
  renewed: 'Renewed',
  status_changed: 'Status Changed',
  checklist_updated: 'Checklist Updated',
  note_added: 'Note Added',
};

// ── Uganda Document Templates (22) ────────────────────────────────────────

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  // ── TAX ──────────────────────────────────────────────────────────────────
  {
    name: 'Tax Clearance Certificate',
    documentType: 'tax_clearance',
    category: 'tax',
    regulatoryBody: 'URA',
    renewalFrequency: 'annually',
    alertDaysBefore: 30,
    description: 'Annual tax clearance certificate from URA confirming the company has no outstanding tax obligations. Required for government tenders, bank facilities, and regulatory submissions.',
    requirements: [
      'Up-to-date PAYE returns for all months',
      'Up-to-date VAT returns',
      'No outstanding tax assessments or penalties',
      'Valid TIN certificate',
      'Audited financial statements (if applicable)',
    ],
    checklistSteps: [
      { title: 'Verify all PAYE returns are filed and up to date', isRequired: true },
      { title: 'Verify all VAT returns are filed and up to date', isRequired: true },
      { title: 'Clear any outstanding tax assessments or penalties', isRequired: true },
      { title: 'Apply online via URA e-services portal', isRequired: true },
      { title: 'Pay any applicable processing fees', isRequired: false },
      { title: 'Download issued certificate from URA portal', isRequired: true },
      { title: 'Upload certificate to system', isRequired: true },
      { title: 'Set expiry date (12 months from issue)', isRequired: true },
    ],
  },
  {
    name: 'TIN Certificate',
    documentType: 'tin_certificate',
    category: 'tax',
    regulatoryBody: 'URA',
    renewalFrequency: 'one_time',
    alertDaysBefore: 0,
    description: 'Tax Identification Number certificate issued by URA. This is a one-time registration that identifies the company for all tax purposes in Uganda.',
    requirements: [
      'Certificate of Incorporation',
      'Memorandum & Articles of Association',
      'National IDs of directors',
      'Proof of business address',
    ],
    checklistSteps: [
      { title: 'Register on URA e-services portal', isRequired: true },
      { title: 'Submit company registration documents', isRequired: true },
      { title: 'Submit directors\' identification documents', isRequired: true },
      { title: 'Receive TIN from URA', isRequired: true },
      { title: 'Download and upload TIN certificate', isRequired: true },
    ],
  },
  {
    name: 'PAYE Returns',
    documentType: 'paye_returns',
    category: 'tax',
    regulatoryBody: 'URA',
    renewalFrequency: 'monthly',
    alertDaysBefore: 5,
    description: 'Monthly Pay-As-You-Earn tax returns. Employers must deduct PAYE from employee salaries and remit to URA by the 15th of the following month.',
    requirements: [
      'Employee payroll register for the month',
      'PAYE computation schedule',
      'Valid TIN certificate',
      'URA e-filing portal access',
    ],
    checklistSteps: [
      { title: 'Finalize monthly payroll', isRequired: true },
      { title: 'Compute PAYE deductions per employee', isRequired: true },
      { title: 'File return on URA e-filing portal', isRequired: true },
      { title: 'Generate payment reference number (PRN)', isRequired: true },
      { title: 'Remit PAYE to URA via bank', isRequired: true },
      { title: 'Upload proof of filing and payment receipt', isRequired: true },
    ],
  },
  {
    name: 'VAT Returns',
    documentType: 'vat_returns',
    category: 'tax',
    regulatoryBody: 'URA',
    renewalFrequency: 'monthly',
    alertDaysBefore: 5,
    description: 'Monthly Value Added Tax returns. Registered businesses must file and remit VAT collected on taxable supplies by the 15th of the following month.',
    requirements: [
      'Sales invoices and VAT output schedule',
      'Purchase invoices and VAT input schedule',
      'EFRIS-generated invoices (mandatory for VAT-registered businesses)',
      'URA e-filing portal access',
    ],
    checklistSteps: [
      { title: 'Reconcile VAT output (sales) for the month', isRequired: true },
      { title: 'Reconcile VAT input (purchases) for the month', isRequired: true },
      { title: 'Ensure all invoices are EFRIS-compliant', isRequired: true },
      { title: 'File return on URA e-filing portal', isRequired: true },
      { title: 'Generate PRN and remit net VAT to URA', isRequired: true },
      { title: 'Upload proof of filing and payment receipt', isRequired: true },
    ],
  },
  {
    name: 'Corporate Tax Return',
    documentType: 'corporate_tax_return',
    category: 'tax',
    regulatoryBody: 'URA',
    renewalFrequency: 'annually',
    alertDaysBefore: 30,
    description: 'Annual corporate income tax return. Must be filed within 6 months of the end of the accounting period. Corporate tax rate is 30% of chargeable income.',
    requirements: [
      'Audited financial statements',
      'Tax computation schedule',
      'Capital allowances schedule',
      'Related party transaction disclosures',
      'Withholding tax certificates received',
    ],
    checklistSteps: [
      { title: 'Obtain audited financial statements', isRequired: true },
      { title: 'Prepare tax computation with adjustments', isRequired: true },
      { title: 'Calculate capital allowances', isRequired: true },
      { title: 'Compile withholding tax credit certificates', isRequired: false },
      { title: 'File return on URA e-filing portal', isRequired: true },
      { title: 'Pay any balance of tax due', isRequired: true },
      { title: 'Upload proof of filing and acknowledgement', isRequired: true },
    ],
  },
  {
    name: 'Withholding Tax Certificate',
    documentType: 'withholding_tax',
    category: 'tax',
    regulatoryBody: 'URA',
    renewalFrequency: 'monthly',
    alertDaysBefore: 5,
    description: 'Monthly withholding tax deductions on payments to suppliers (6% on goods, 6% on services for residents). Must be remitted to URA by the 15th of the following month.',
    requirements: [
      'Supplier payment register for the month',
      'WHT computation schedule',
      'Supplier TIN details',
      'URA e-filing portal access',
    ],
    checklistSteps: [
      { title: 'Identify all payments subject to WHT', isRequired: true },
      { title: 'Compute WHT at applicable rates (6% goods/services)', isRequired: true },
      { title: 'File WHT return on URA portal', isRequired: true },
      { title: 'Generate PRN and remit WHT to URA', isRequired: true },
      { title: 'Issue WHT certificates to suppliers', isRequired: true },
      { title: 'Upload proof of filing and payment', isRequired: true },
    ],
  },
  {
    name: 'Local Service Tax Certificate',
    documentType: 'lst_certificate',
    category: 'tax',
    regulatoryBody: 'KCCA',
    renewalFrequency: 'annually',
    alertDaysBefore: 30,
    description: 'Local Service Tax payable by employees and employers to KCCA or local authority. Employers must deduct LST from employees and remit to the local authority.',
    requirements: [
      'Employee payroll register',
      'LST computation per employee based on income brackets',
      'Previous year\'s LST certificate',
    ],
    checklistSteps: [
      { title: 'Compute LST per employee per income bracket', isRequired: true },
      { title: 'Deduct LST from employee salaries', isRequired: true },
      { title: 'Remit LST to KCCA/local authority', isRequired: true },
      { title: 'Obtain LST compliance certificate', isRequired: true },
      { title: 'Upload certificate to system', isRequired: true },
    ],
  },

  // ── EMPLOYMENT ───────────────────────────────────────────────────────────
  {
    name: 'NSSF Compliance Certificate',
    documentType: 'nssf_compliance',
    category: 'employment',
    regulatoryBody: 'NSSF',
    renewalFrequency: 'quarterly',
    alertDaysBefore: 14,
    description: 'Quarterly NSSF compliance certificate confirming employer contributions are up to date. Employer contributes 10% and employee contributes 5% of gross salary.',
    requirements: [
      'Employee payroll register for the quarter',
      'NSSF contribution schedule (10% employer + 5% employee)',
      'Previous quarter\'s compliance certificate',
      'NSSF employer registration number',
    ],
    checklistSteps: [
      { title: 'Prepare NSSF contribution schedule for all employees', isRequired: true },
      { title: 'Compute 10% employer + 5% employee contributions', isRequired: true },
      { title: 'File contributions on NSSF portal', isRequired: true },
      { title: 'Remit total contributions to NSSF', isRequired: true },
      { title: 'Obtain compliance certificate from NSSF', isRequired: true },
      { title: 'Upload certificate to system', isRequired: true },
    ],
  },

  // ── LICENSING ────────────────────────────────────────────────────────────
  {
    name: 'Trading License',
    documentType: 'trading_license',
    category: 'licensing',
    regulatoryBody: 'KCCA',
    renewalFrequency: 'annually',
    alertDaysBefore: 30,
    description: 'Annual trading license from KCCA or local authority permitting the business to operate at its registered premises. Required for all businesses operating in Uganda.',
    requirements: [
      'Certificate of Incorporation',
      'TIN Certificate',
      'Previous year\'s trading license',
      'Premises lease agreement or title',
      'Tax clearance certificate',
    ],
    checklistSteps: [
      { title: 'Obtain current tax clearance certificate', isRequired: true },
      { title: 'Complete trading license application form', isRequired: true },
      { title: 'Submit application to KCCA/local authority', isRequired: true },
      { title: 'Pay trading license fees', isRequired: true },
      { title: 'Collect issued trading license', isRequired: true },
      { title: 'Display license at business premises', isRequired: true },
      { title: 'Upload license to system', isRequired: true },
    ],
  },

  // ── LEGAL ────────────────────────────────────────────────────────────────
  {
    name: 'Certificate of Incorporation',
    documentType: 'certificate_of_incorporation',
    category: 'legal',
    regulatoryBody: 'URSB',
    renewalFrequency: 'one_time',
    alertDaysBefore: 0,
    description: 'Company registration certificate from URSB proving legal existence as a company. This is a one-time document obtained at company formation.',
    requirements: [
      'Memorandum & Articles of Association',
      'Form 1 - Application for registration',
      'Form A1 - Statement of nominal share capital',
      'Directors\' and secretary\'s consent forms',
      'National IDs of directors',
    ],
    checklistSteps: [
      { title: 'Prepare Memorandum & Articles of Association', isRequired: true },
      { title: 'Complete URSB registration forms', isRequired: true },
      { title: 'Submit to URSB with required fees', isRequired: true },
      { title: 'Receive Certificate of Incorporation', isRequired: true },
      { title: 'Upload certificate to system', isRequired: true },
    ],
  },
  {
    name: 'Memorandum & Articles of Association',
    documentType: 'mem_arts',
    category: 'legal',
    regulatoryBody: 'URSB',
    renewalFrequency: 'one_time',
    alertDaysBefore: 0,
    description: 'Company constitutional documents filed with URSB defining the company\'s purpose, powers, and internal governance rules.',
    requirements: [
      'Approved draft by company lawyers',
      'Directors\' resolution approving the documents',
      'Company seal (if applicable)',
    ],
    checklistSteps: [
      { title: 'Draft Memorandum & Articles with legal counsel', isRequired: true },
      { title: 'Obtain directors\' approval', isRequired: true },
      { title: 'File with URSB', isRequired: true },
      { title: 'Upload filed copy to system', isRequired: true },
    ],
  },
  {
    name: 'Directors\' Resolution Register',
    documentType: 'directors_register',
    category: 'legal',
    regulatoryBody: 'URSB',
    renewalFrequency: 'ad_hoc',
    alertDaysBefore: 0,
    description: 'Register of directors\' resolutions and board minutes. Must be maintained and any changes in directors filed with URSB within 28 days.',
    requirements: [
      'Board meeting minutes',
      'Directors\' consent forms for new appointments',
      'Resignation letters for departing directors',
      'Form 20 (Return of change of directors)',
    ],
    checklistSteps: [
      { title: 'Maintain up-to-date register of directors', isRequired: true },
      { title: 'File Form 20 with URSB for any changes within 28 days', isRequired: true },
      { title: 'Upload current register to system', isRequired: true },
    ],
  },

  // ── STATUTORY ────────────────────────────────────────────────────────────
  {
    name: 'Company Annual Return (URSB)',
    documentType: 'company_annual_return',
    category: 'statutory',
    regulatoryBody: 'URSB',
    renewalFrequency: 'annually',
    alertDaysBefore: 30,
    description: 'Annual return filed with URSB confirming company details, directors, shareholding, and registered office. Due within 42 days of the annual general meeting.',
    requirements: [
      'Current list of directors and secretary',
      'Current shareholding structure',
      'Registered office address confirmation',
      'Audited financial statements',
    ],
    checklistSteps: [
      { title: 'Confirm current director and secretary details', isRequired: true },
      { title: 'Confirm current shareholding structure', isRequired: true },
      { title: 'Prepare annual return form', isRequired: true },
      { title: 'File annual return with URSB', isRequired: true },
      { title: 'Pay filing fees', isRequired: true },
      { title: 'Upload filed return acknowledgement', isRequired: true },
    ],
  },
  {
    name: 'Share Allotment Return',
    documentType: 'share_allotment',
    category: 'statutory',
    regulatoryBody: 'URSB',
    renewalFrequency: 'ad_hoc',
    alertDaysBefore: 0,
    description: 'Return filed with URSB within 28 days of any allotment of shares. Required whenever new shares are issued or share capital changes.',
    requirements: [
      'Board/shareholder resolution approving share allotment',
      'Share subscription agreements',
      'Updated register of members',
      'Form 3 (Return of allotment)',
    ],
    checklistSteps: [
      { title: 'Obtain board/shareholder resolution for allotment', isRequired: true },
      { title: 'Complete Form 3 (Return of allotment)', isRequired: true },
      { title: 'File with URSB within 28 days', isRequired: true },
      { title: 'Update register of members', isRequired: true },
      { title: 'Upload filed return to system', isRequired: true },
    ],
  },

  // ── REGULATORY ───────────────────────────────────────────────────────────
  {
    name: 'Environmental Compliance Certificate',
    documentType: 'environmental_compliance',
    category: 'regulatory',
    regulatoryBody: 'NEMA',
    renewalFrequency: 'annually',
    alertDaysBefore: 30,
    description: 'Environmental impact assessment and compliance certificate from NEMA. Required for manufacturing, construction, and businesses with environmental impact.',
    requirements: [
      'Environmental Impact Assessment (EIA) report',
      'Environmental audit report',
      'Waste management plan',
      'Previous year\'s compliance certificate',
    ],
    checklistSteps: [
      { title: 'Conduct environmental audit', isRequired: true },
      { title: 'Prepare environmental compliance report', isRequired: true },
      { title: 'Submit application to NEMA', isRequired: true },
      { title: 'Pay assessment and certification fees', isRequired: true },
      { title: 'Facilitate NEMA inspection if required', isRequired: false },
      { title: 'Receive compliance certificate', isRequired: true },
      { title: 'Upload certificate to system', isRequired: true },
    ],
  },
  {
    name: 'Fire Safety Certificate',
    documentType: 'fire_safety',
    category: 'regulatory',
    regulatoryBody: 'LOCAL_COUNCIL',
    renewalFrequency: 'annually',
    alertDaysBefore: 30,
    description: 'Fire safety inspection and compliance certificate. Required for business premises to confirm fire safety equipment, exits, and procedures are adequate.',
    requirements: [
      'Fire extinguishers (serviced and valid)',
      'Emergency exit signs and routes',
      'Fire alarm system (if applicable)',
      'Staff fire safety training records',
    ],
    checklistSteps: [
      { title: 'Service all fire extinguishers', isRequired: true },
      { title: 'Verify emergency exits are clear and marked', isRequired: true },
      { title: 'Test fire alarm systems', isRequired: true },
      { title: 'Conduct staff fire drill', isRequired: false },
      { title: 'Apply for fire safety inspection', isRequired: true },
      { title: 'Facilitate inspector visit', isRequired: true },
      { title: 'Receive and upload certificate', isRequired: true },
    ],
  },
  {
    name: 'Occupational Health & Safety Compliance',
    documentType: 'ohs_compliance',
    category: 'regulatory',
    regulatoryBody: 'MoFPED',
    renewalFrequency: 'annually',
    alertDaysBefore: 30,
    description: 'Compliance with the Occupational Safety and Health Act. Required for workplaces to ensure safe working conditions, especially manufacturing and construction.',
    requirements: [
      'Workplace risk assessment report',
      'PPE inventory and issuance records',
      'Accident/incident register',
      'First aid kit and trained first aiders',
      'Safety signage at workplace',
    ],
    checklistSteps: [
      { title: 'Conduct annual workplace risk assessment', isRequired: true },
      { title: 'Ensure PPE is available and issued to staff', isRequired: true },
      { title: 'Maintain accident and incident register', isRequired: true },
      { title: 'Verify first aid provisions are adequate', isRequired: true },
      { title: 'Train safety officers and first aiders', isRequired: false },
      { title: 'Submit compliance report to inspector', isRequired: true },
      { title: 'Upload compliance evidence to system', isRequired: true },
    ],
  },
  {
    name: 'Data Protection Registration',
    documentType: 'data_protection',
    category: 'regulatory',
    regulatoryBody: 'OTHER',
    renewalFrequency: 'annually',
    alertDaysBefore: 30,
    description: 'Registration with the Personal Data Protection Office under the Data Protection and Privacy Act, 2019. Required for businesses that collect and process personal data.',
    requirements: [
      'Data protection impact assessment',
      'Privacy policy (published)',
      'Data processing agreement templates',
      'Record of processing activities',
      'Data protection officer appointment (if applicable)',
    ],
    checklistSteps: [
      { title: 'Review and update privacy policy', isRequired: true },
      { title: 'Update record of processing activities', isRequired: true },
      { title: 'Register/renew with Personal Data Protection Office', isRequired: true },
      { title: 'Pay registration fees', isRequired: true },
      { title: 'Upload registration certificate', isRequired: true },
    ],
  },

  // ── FINANCIAL ────────────────────────────────────────────────────────────
  {
    name: 'Bank Statements',
    documentType: 'bank_statements',
    category: 'financial',
    regulatoryBody: 'OTHER',
    renewalFrequency: 'monthly',
    alertDaysBefore: 5,
    description: 'Monthly bank account statements for all business accounts. Required for financial record-keeping, reconciliation, and audit purposes.',
    requirements: [
      'Access to online banking portal',
      'All business bank account details',
    ],
    checklistSteps: [
      { title: 'Download statements for all business accounts', isRequired: true },
      { title: 'Reconcile with accounting records', isRequired: true },
      { title: 'Upload statements to system', isRequired: true },
    ],
  },
  {
    name: 'Audited Financial Statements',
    documentType: 'audited_financials',
    category: 'financial',
    regulatoryBody: 'URA',
    renewalFrequency: 'annually',
    alertDaysBefore: 30,
    description: 'Annual audited financial statements prepared by an approved auditor. Required by URA for tax filing, banks for credit facilities, and URSB for annual returns.',
    requirements: [
      'Complete trial balance and general ledger',
      'Bank statements for the full year',
      'Fixed asset register',
      'Accounts receivable and payable aging',
      'Inventory valuation',
      'Payroll summary for the year',
    ],
    checklistSteps: [
      { title: 'Close year-end accounts', isRequired: true },
      { title: 'Prepare management accounts package', isRequired: true },
      { title: 'Engage approved external auditor', isRequired: true },
      { title: 'Facilitate audit fieldwork', isRequired: true },
      { title: 'Review draft audit report', isRequired: true },
      { title: 'Obtain signed audited financial statements', isRequired: true },
      { title: 'Upload audited statements to system', isRequired: true },
    ],
  },

  // ── INSURANCE ────────────────────────────────────────────────────────────
  {
    name: 'Insurance Certificates',
    documentType: 'insurance_certificates',
    category: 'insurance',
    regulatoryBody: 'OTHER',
    renewalFrequency: 'annually',
    alertDaysBefore: 30,
    description: 'Business insurance policies and certificates of coverage including general liability, property, professional indemnity, and any sector-specific insurance.',
    requirements: [
      'Current asset register for property insurance',
      'Employee headcount for group cover',
      'Previous year\'s claims history',
      'Risk assessment report',
    ],
    checklistSteps: [
      { title: 'Review current coverage and identify gaps', isRequired: true },
      { title: 'Obtain insurance quotations', isRequired: false },
      { title: 'Negotiate and renew policies', isRequired: true },
      { title: 'Pay insurance premiums', isRequired: true },
      { title: 'Receive policy documents and certificates', isRequired: true },
      { title: 'Upload certificates to system', isRequired: true },
    ],
  },
  {
    name: 'Workers\' Compensation Policy',
    documentType: 'workers_comp',
    category: 'insurance',
    regulatoryBody: 'OTHER',
    renewalFrequency: 'annually',
    alertDaysBefore: 30,
    description: 'Workers\' compensation insurance covering employees against work-related injuries and illnesses. Required under the Workers\' Compensation Act for all employers.',
    requirements: [
      'Employee register with job classifications',
      'Payroll summary for premium calculation',
      'Previous year\'s claims history',
      'Workplace risk assessment',
    ],
    checklistSteps: [
      { title: 'Update employee register with current headcount', isRequired: true },
      { title: 'Obtain premium quotation from insurer', isRequired: true },
      { title: 'Pay workers\' compensation premium', isRequired: true },
      { title: 'Receive policy certificate', isRequired: true },
      { title: 'Upload policy to system', isRequired: true },
    ],
  },
];

// ── Uganda Obligation Templates (10) ───────────────────────────────────────

export const OBLIGATION_TEMPLATES: ObligationTemplate[] = [
  {
    title: 'Monthly PAYE Filing',
    description: 'File PAYE returns and remit deducted taxes to URA by the 15th of each month',
    category: 'tax',
    regulatoryBody: 'URA',
    frequency: 'monthly',
    dayOfMonthDue: 15,
    requiredDocumentTypes: ['paye_returns'],
    priority: 'critical',
  },
  {
    title: 'Monthly VAT Filing',
    description: 'File VAT returns and remit collected VAT to URA by the 15th of each month',
    category: 'tax',
    regulatoryBody: 'URA',
    frequency: 'monthly',
    dayOfMonthDue: 15,
    requiredDocumentTypes: ['vat_returns'],
    priority: 'critical',
  },
  {
    title: 'Monthly WHT Remittance',
    description: 'File withholding tax return and remit WHT deductions to URA by the 15th of each month',
    category: 'tax',
    regulatoryBody: 'URA',
    frequency: 'monthly',
    dayOfMonthDue: 15,
    requiredDocumentTypes: ['withholding_tax'],
    priority: 'high',
  },
  {
    title: 'Quarterly NSSF Remittance',
    description: 'Remit NSSF contributions for all employees and obtain compliance certificate',
    category: 'employment',
    regulatoryBody: 'NSSF',
    frequency: 'quarterly',
    dayOfMonthDue: 15,
    requiredDocumentTypes: ['nssf_compliance'],
    priority: 'high',
  },
  {
    title: 'Annual Corporate Tax Return',
    description: 'File annual corporate income tax return with URA within 6 months of financial year end',
    category: 'tax',
    regulatoryBody: 'URA',
    frequency: 'annually',
    requiredDocumentTypes: ['corporate_tax_return', 'audited_financials'],
    priority: 'critical',
  },
  {
    title: 'Annual Trading License Renewal',
    description: 'Renew trading license with KCCA or local authority before expiry',
    category: 'licensing',
    regulatoryBody: 'KCCA',
    frequency: 'annually',
    requiredDocumentTypes: ['trading_license'],
    priority: 'high',
  },
  {
    title: 'Annual URSB Returns',
    description: 'File annual returns with Uganda Registration Services Bureau within 42 days of AGM',
    category: 'statutory',
    regulatoryBody: 'URSB',
    frequency: 'annually',
    requiredDocumentTypes: ['company_annual_return'],
    priority: 'medium',
  },
  {
    title: 'Annual NEMA Compliance Renewal',
    description: 'Renew environmental compliance certificate with NEMA including audit and assessment',
    category: 'regulatory',
    regulatoryBody: 'NEMA',
    frequency: 'annually',
    requiredDocumentTypes: ['environmental_compliance'],
    priority: 'medium',
  },
  {
    title: 'Annual Insurance Policy Renewal',
    description: 'Renew all business insurance policies including general liability, property, and workers\' compensation',
    category: 'insurance',
    regulatoryBody: 'OTHER',
    frequency: 'annually',
    requiredDocumentTypes: ['insurance_certificates', 'workers_comp'],
    priority: 'high',
  },
  {
    title: 'Annual LST / Local Rates Payment',
    description: 'Pay Local Service Tax and local government rates for business premises',
    category: 'tax',
    regulatoryBody: 'KCCA',
    frequency: 'annually',
    requiredDocumentTypes: ['lst_certificate'],
    priority: 'medium',
  },
];
