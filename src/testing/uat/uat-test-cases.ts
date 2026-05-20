/**
 * UAT Test Cases
 * User Acceptance Testing test case definitions
 */

export type UATCategory =
  | 'engagement_management'
  | 'project_management'
  | 'payment_processing'
  | 'deal_pipeline'
  | 'portfolio_management'
  | 'matflow_boq'
  | 'ai_features'
  | 'offline_functionality'
  | 'data_migration'
  | 'cross_module';

export interface UATStep {
  stepNumber: number;
  action: string;
  data?: string;
  expectedOutcome: string;
}

export interface UATTestCase {
  id: string;
  category: UATCategory;
  title: string;
  description: string;
  preconditions: string[];
  steps: UATStep[];
  expectedResults: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  roles: string[];
  automatable: boolean;
}

export const uatTestCases: UATTestCase[] = [
  // ============================================================================
  // Engagement Management
  // ============================================================================
  {
    id: 'UAT-ENG-001',
    category: 'engagement_management',
    title: 'Create Infrastructure Engagement',
    description: 'Verify that users can create a new infrastructure engagement with grant funding',
    preconditions: [
      'User is logged in as Project Manager',
      'Client exists in the system',
    ],
    steps: [
      {
        stepNumber: 1,
        action: 'Navigate to Engagements > New Engagement',
        expectedOutcome: 'New engagement form is displayed',
      },
      {
        stepNumber: 2,
        action: 'Select Client from dropdown',
        data: 'AMH Uganda',
        expectedOutcome: 'Client is selected and address populated',
      },
      {
        stepNumber: 3,
        action: 'Enter engagement details',
        data: 'Name: Rushoroza Hospital Expansion, Type: Infrastructure',
        expectedOutcome: 'Form fields are populated',
      },
      {
        stepNumber: 4,
        action: 'Configure funding as Grant',
        data: 'Funder: AMH Foundation, Amount: 5,000,000,000 UGX',
        expectedOutcome: 'Funding section shows grant configuration',
      },
      {
        stepNumber: 5,
        action: 'Click Create Engagement',
        expectedOutcome: 'Engagement is created and user is redirected to engagement detail page',
      },
    ],
    expectedResults: [
      'Engagement appears in engagement list',
      'Engagement type is "Infrastructure"',
      'Funding shows as Grant with correct amount',
      'Audit trail shows creation event',
    ],
    priority: 'critical',
    roles: ['project_manager', 'admin'],
    automatable: true,
  },

  {
    id: 'UAT-ENG-002',
    category: 'engagement_management',
    title: 'Update Engagement Status',
    description: 'Verify that engagement status can be updated with proper workflow',
    preconditions: [
      'User is logged in as Project Manager',
      'Active engagement exists',
    ],
    steps: [
      {
        stepNumber: 1,
        action: 'Navigate to engagement detail page',
        expectedOutcome: 'Engagement details displayed',
      },
      {
        stepNumber: 2,
        action: 'Click "Change Status" button',
        expectedOutcome: 'Status change dialog opens',
      },
      {
        stepNumber: 3,
        action: 'Select new status "On Hold"',
        data: 'Reason: Awaiting funding release',
        expectedOutcome: 'Status and reason fields populated',
      },
      {
        stepNumber: 4,
        action: 'Confirm status change',
        expectedOutcome: 'Status updated successfully',
      },
    ],
    expectedResults: [
      'Engagement status shows "On Hold"',
      'Status change recorded in audit trail',
      'Related projects notified of status change',
    ],
    priority: 'high',
    roles: ['project_manager', 'admin'],
    automatable: true,
  },

  // ============================================================================
  // Payment Processing
  // ============================================================================
  {
    id: 'UAT-PAY-001',
    category: 'payment_processing',
    title: 'IPC Submission and Approval Workflow',
    description: 'Verify complete IPC workflow from creation to approval',
    preconditions: [
      'Infrastructure engagement exists',
      'Project is in construction phase',
      'User has PM role',
    ],
    steps: [
      {
        stepNumber: 1,
        action: 'Navigate to Project > Payments > New Payment',
        expectedOutcome: 'Payment creation form displayed',
      },
      {
        stepNumber: 2,
        action: 'Select payment type as IPC',
        expectedOutcome: 'IPC-specific fields are shown',
      },
      {
        stepNumber: 3,
        action: 'Enter IPC details',
        data: 'Certificate Number: IPC/5/2026, Period: Dec 2025',
        expectedOutcome: 'Form populated with IPC data',
      },
      {
        stepNumber: 4,
        action: 'Enter financial values',
        data: 'Gross: 150,000,000 UGX, Retention: 7,500,000 UGX',
        expectedOutcome: 'Net amount calculated automatically',
      },
      {
        stepNumber: 5,
        action: 'Upload supporting documents',
        data: 'Valuation details Excel, Site photos',
        expectedOutcome: 'Documents attached to payment',
      },
      {
        stepNumber: 6,
        action: 'Submit for review',
        expectedOutcome: 'Status changes to "Submitted", notification sent to QS',
      },
      {
        stepNumber: 7,
        action: 'Login as QS and approve',
        expectedOutcome: 'QS approval recorded, moves to PM approval',
      },
      {
        stepNumber: 8,
        action: 'Login as Country Coordinator and give final approval',
        expectedOutcome: 'Payment status changes to "Approved"',
      },
    ],
    expectedResults: [
      'Payment is in "Approved" status',
      'All approval stages are recorded in audit trail',
      'Notifications sent at each stage',
      'Project financial summary updated',
      'Engagement financials reflect new payment',
    ],
    priority: 'critical',
    roles: ['project_manager', 'quantity_surveyor', 'country_coordinator'],
    automatable: true,
  },

  {
    id: 'UAT-PAY-002',
    category: 'payment_processing',
    title: 'Payment Rejection Workflow',
    description: 'Verify that payments can be rejected with comments',
    preconditions: [
      'Submitted payment exists',
      'User has QS role',
    ],
    steps: [
      {
        stepNumber: 1,
        action: 'Navigate to payment awaiting review',
        expectedOutcome: 'Payment details displayed',
      },
      {
        stepNumber: 2,
        action: 'Click "Reject" button',
        expectedOutcome: 'Rejection dialog opens',
      },
      {
        stepNumber: 3,
        action: 'Enter rejection reason',
        data: 'Quantities do not match site measurements',
        expectedOutcome: 'Reason field populated',
      },
      {
        stepNumber: 4,
        action: 'Confirm rejection',
        expectedOutcome: 'Payment rejected successfully',
      },
    ],
    expectedResults: [
      'Payment status shows "Rejected"',
      'Rejection reason recorded',
      'Creator notified of rejection',
      'Payment can be revised and resubmitted',
    ],
    priority: 'high',
    roles: ['quantity_surveyor', 'project_manager'],
    automatable: true,
  },

  // ============================================================================
  // MatFlow BOQ
  // ============================================================================
  {
    id: 'UAT-BOQ-001',
    category: 'matflow_boq',
    title: 'AI BOQ Parsing and Review',
    description: 'Verify AI-powered BOQ parsing from Excel file',
    preconditions: [
      'Infrastructure engagement exists',
      'Project exists under engagement',
      'User has QS role',
      'BOQ Excel file available',
    ],
    steps: [
      {
        stepNumber: 1,
        action: 'Navigate to MatFlow > BOQ Management > Import',
        expectedOutcome: 'BOQ import interface displayed',
      },
      {
        stepNumber: 2,
        action: 'Select project for BOQ import',
        data: 'Rushoroza Hospital OR Expansion',
        expectedOutcome: 'Project selected and linked',
      },
      {
        stepNumber: 3,
        action: 'Upload BOQ Excel file',
        data: 'rushoroza_boq_structural.xlsx',
        expectedOutcome: 'File uploaded and AI parsing initiated',
      },
      {
        stepNumber: 4,
        action: 'Wait for AI parsing to complete',
        expectedOutcome: 'Parsed items displayed with confidence scores',
      },
      {
        stepNumber: 5,
        action: 'Review low-confidence items',
        expectedOutcome: 'Items flagged for review are highlighted',
      },
      {
        stepNumber: 6,
        action: 'Correct any parsing errors',
        data: 'Fix unit from "m2" to "m³" for concrete item',
        expectedOutcome: 'Item updated and confidence recalculated',
      },
      {
        stepNumber: 7,
        action: 'Approve BOQ',
        expectedOutcome: 'BOQ status changes to "Approved"',
      },
    ],
    expectedResults: [
      'BOQ contains all items from Excel file',
      'Categories are correctly identified',
      'Totals match source document',
      'BOQ linked to project',
      'Project financials updated with BOQ total',
    ],
    priority: 'high',
    roles: ['quantity_surveyor'],
    automatable: true,
  },

  // ============================================================================
  // Offline Functionality
  // ============================================================================
  {
    id: 'UAT-OFF-001',
    category: 'offline_functionality',
    title: 'Offline Data Entry and Sync',
    description: 'Verify that data can be entered offline and synced when online',
    preconditions: [
      'User is logged in',
      'Project data is cached locally',
      'User is at rural site with intermittent connectivity',
    ],
    steps: [
      {
        stepNumber: 1,
        action: 'Disconnect from internet',
        expectedOutcome: 'App shows offline indicator',
      },
      {
        stepNumber: 2,
        action: 'Navigate to existing project',
        expectedOutcome: 'Cached project data is displayed',
      },
      {
        stepNumber: 3,
        action: 'Update physical progress',
        data: 'Progress: 65%',
        expectedOutcome: 'Update saved locally, pending sync indicator shown',
      },
      {
        stepNumber: 4,
        action: 'Add site visit note',
        data: 'Completed foundation inspection, ready for structure',
        expectedOutcome: 'Note saved locally with pending sync',
      },
      {
        stepNumber: 5,
        action: 'Reconnect to internet',
        expectedOutcome: 'Sync initiated automatically',
      },
      {
        stepNumber: 6,
        action: 'Wait for sync to complete',
        expectedOutcome: 'All pending changes synced, indicators cleared',
      },
    ],
    expectedResults: [
      'All offline changes synced to server',
      'Timestamps reflect original entry time',
      'No data loss during sync',
      'Conflict resolution handled correctly',
      'Audit trail shows offline entries',
    ],
    priority: 'critical',
    roles: ['project_manager', 'site_engineer'],
    automatable: false,
  },

  // ============================================================================
  // Data Migration
  // ============================================================================
  {
    id: 'UAT-MIG-001',
    category: 'data_migration',
    title: 'Verify Migrated Program Data',
    description: 'Verify that v5.0 program data is correctly migrated to v6.0 engagements',
    preconditions: [
      'v5.0 to v6.0 migration completed',
      'Program existed in v5.0 with projects and payments',
    ],
    steps: [
      {
        stepNumber: 1,
        action: 'Login to v6.0 system',
        expectedOutcome: 'Dashboard displayed',
      },
      {
        stepNumber: 2,
        action: 'Search for migrated engagement by v5 program name',
        data: 'AMH Uganda 2024',
        expectedOutcome: 'Engagement found in search results',
      },
      {
        stepNumber: 3,
        action: 'Open engagement details',
        expectedOutcome: 'Engagement detail page displayed',
      },
      {
        stepNumber: 4,
        action: 'Verify engagement type is "Infrastructure"',
        expectedOutcome: 'Type field shows "Infrastructure"',
      },
      {
        stepNumber: 5,
        action: 'Verify funding is configured as "Grant"',
        expectedOutcome: 'Funding section shows grant configuration',
      },
      {
        stepNumber: 6,
        action: 'Check project count matches v5.0',
        data: 'Expected: 12 projects',
        expectedOutcome: 'Projects tab shows 12 projects',
      },
      {
        stepNumber: 7,
        action: 'Verify a sample payment was migrated correctly',
        data: 'IPC/3/2025 for Rushoroza project',
        expectedOutcome: 'Payment exists with correct values',
      },
      {
        stepNumber: 8,
        action: 'Check historical audit trail',
        expectedOutcome: 'Original v5.0 timestamps preserved',
      },
    ],
    expectedResults: [
      'All programs migrated as engagements',
      'Project relationships preserved',
      'Payment data matches v5.0 values',
      'Document links functional',
      'User assignments preserved',
      'Historical data intact',
    ],
    priority: 'critical',
    roles: ['admin', 'project_manager'],
    automatable: true,
  },

  {
    id: 'UAT-MIG-002',
    category: 'data_migration',
    title: 'Verify API Compatibility',
    description: 'Verify that v5 API endpoints still work with v6 backend',
    preconditions: [
      'Migration completed',
      'API compatibility layer deployed',
    ],
    steps: [
      {
        stepNumber: 1,
        action: 'Call GET /api/v5/programs',
        expectedOutcome: 'Returns list of programs in v5 format',
      },
      {
        stepNumber: 2,
        action: 'Verify response includes deprecation warning',
        expectedOutcome: 'Deprecation header present',
      },
      {
        stepNumber: 3,
        action: 'Call POST /api/v5/programs with v5 payload',
        data: '{ name: "Test Program", funder: "Test Funder" }',
        expectedOutcome: 'Program created successfully',
      },
      {
        stepNumber: 4,
        action: 'Verify program exists in v6 engagements',
        expectedOutcome: 'Engagement created with correct mapping',
      },
    ],
    expectedResults: [
      'V5 endpoints return data in v5 format',
      'V5 create/update operations work correctly',
      'Data is stored in v6 format internally',
      'Deprecation warnings included in responses',
    ],
    priority: 'critical',
    roles: ['developer', 'admin'],
    automatable: true,
  },

  // ============================================================================
  // Cross-Module
  // ============================================================================
  {
    id: 'UAT-XMD-001',
    category: 'cross_module',
    title: 'Portfolio to Infrastructure Deal Linking',
    description: 'Verify that portfolio holdings can link to infrastructure investment deals',
    preconditions: [
      'Advisory engagement with portfolio exists',
      'Investment engagement with closed deal exists',
      'User has Advisor role',
    ],
    steps: [
      {
        stepNumber: 1,
        action: 'Navigate to Portfolio > Holdings',
        expectedOutcome: 'Holdings list displayed',
      },
      {
        stepNumber: 2,
        action: 'Click Add Holding',
        expectedOutcome: 'New holding form displayed',
      },
      {
        stepNumber: 3,
        action: 'Select "Link to Existing Deal"',
        expectedOutcome: 'Deal search interface shown',
      },
      {
        stepNumber: 4,
        action: 'Search for infrastructure deal',
        data: 'Kampala Solar Farm',
        expectedOutcome: 'Deal found in search results',
      },
      {
        stepNumber: 5,
        action: 'Select deal and enter investment details',
        data: 'Investment: $2,000,000, Current Value: $2,400,000',
        expectedOutcome: 'Holding details populated',
      },
      {
        stepNumber: 6,
        action: 'Save holding',
        expectedOutcome: 'Holding created with deal link',
      },
      {
        stepNumber: 7,
        action: 'Navigate to linked deal from holding',
        expectedOutcome: 'Deal detail page opens',
      },
      {
        stepNumber: 8,
        action: 'On deal page, verify portfolio link is shown',
        expectedOutcome: 'Related Portfolios section shows the portfolio',
      },
    ],
    expectedResults: [
      'Holding shows linked deal name',
      'Deal shows related portfolios',
      'Bidirectional navigation works',
      'Portfolio metrics updated',
      'Entity link created in database',
    ],
    priority: 'high',
    roles: ['advisor'],
    automatable: true,
  },

  // ============================================================================
  // Deal Pipeline
  // ============================================================================
  {
    id: 'UAT-DEAL-001',
    category: 'deal_pipeline',
    title: 'Progress Deal Through Pipeline Stages',
    description: 'Verify that deals can progress through all pipeline stages',
    preconditions: [
      'Investment engagement exists',
      'User has Deal Lead role',
    ],
    steps: [
      {
        stepNumber: 1,
        action: 'Create new deal in Origination stage',
        data: 'Deal Name: Tech Startup Investment',
        expectedOutcome: 'Deal created in Origination stage',
      },
      {
        stepNumber: 2,
        action: 'Move deal to Screening',
        expectedOutcome: 'Deal status updated to Screening',
      },
      {
        stepNumber: 3,
        action: 'Add screening notes',
        data: 'Initial review passed, recommend DD',
        expectedOutcome: 'Notes saved to deal',
      },
      {
        stepNumber: 4,
        action: 'Move deal to Due Diligence',
        expectedOutcome: 'Deal status updated, DD checklist displayed',
      },
      {
        stepNumber: 5,
        action: 'Complete DD items',
        data: 'Financial review, Legal review, Technical review',
        expectedOutcome: 'DD checklist items marked complete',
      },
      {
        stepNumber: 6,
        action: 'Move to Investment Committee',
        expectedOutcome: 'Deal ready for IC review',
      },
    ],
    expectedResults: [
      'Deal progresses through all stages',
      'Stage history is recorded',
      'Time in each stage is tracked',
      'Required checklist items enforced',
      'Notifications sent at stage changes',
    ],
    priority: 'high',
    roles: ['deal_lead', 'investment_manager'],
    automatable: true,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get test cases by category
 */
export function getUATTestCasesByCategory(category: UATCategory): UATTestCase[] {
  return uatTestCases.filter(tc => tc.category === category);
}

/**
 * Get test cases by priority
 */
export function getUATTestCasesByPriority(
  priority: UATTestCase['priority']
): UATTestCase[] {
  return uatTestCases.filter(tc => tc.priority === priority);
}

/**
 * Get test cases by role
 */
export function getUATTestCasesByRole(role: string): UATTestCase[] {
  return uatTestCases.filter(tc => tc.roles.includes(role));
}

/**
 * Get critical test cases
 */
export function getCriticalTestCases(): UATTestCase[] {
  return uatTestCases.filter(tc => tc.priority === 'critical');
}

/**
 * Get automatable test cases
 */
export function getAutomatableTestCases(): UATTestCase[] {
  return uatTestCases.filter(tc => tc.automatable);
}

/**
 * Get test case by ID
 */
export function getUATTestCaseById(id: string): UATTestCase | undefined {
  return uatTestCases.find(tc => tc.id === id);
}

/**
 * Get test case summary
 */
export function getUATTestCaseSummary(): {
  total: number;
  byCategory: Record<UATCategory, number>;
  byPriority: Record<string, number>;
  automatable: number;
} {
  const byCategory: Record<string, number> = {};
  const byPriority: Record<string, number> = {};

  for (const tc of uatTestCases) {
    byCategory[tc.category] = (byCategory[tc.category] || 0) + 1;
    byPriority[tc.priority] = (byPriority[tc.priority] || 0) + 1;
  }

  return {
    total: uatTestCases.length,
    byCategory: byCategory as Record<UATCategory, number>,
    byPriority,
    automatable: uatTestCases.filter(tc => tc.automatable).length,
  };
}
