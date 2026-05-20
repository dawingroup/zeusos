/**
 * Role Profile Constants - DawinOS v2.0
 * Pre-defined role profiles and templates
 */

import { 
  RoleProfile, 
  RoleTemplate, 
  SkillCategory, 
  AuthorityType,
} from '../types/role-profile.types';

// ============================================
// Standard Role Profiles
// ============================================

/**
 * CEO Role Profile
 */
export const CEO_PROFILE: Partial<RoleProfile> = {
  title: 'Chief Executive Officer',
  slug: 'ceo',
  description: 'Group CEO responsible for overall strategy and performance across all subsidiaries',
  shortDescription: 'Group CEO',
  subsidiaryId: 'all',
  jobLevel: 'EXECUTIVE',
  employmentTypes: ['full-time'],
  reportsTo: [],
  supervises: ['coo', 'cfo', 'cto', 'subsidiary-md'],
  skills: [
    { category: 'strategic', name: 'Strategic Planning', requiredLevel: 'expert', isCore: true },
    { category: 'management', name: 'Executive Leadership', requiredLevel: 'expert', isCore: true },
    { category: 'financial', name: 'Financial Acumen', requiredLevel: 'advanced', isCore: true },
  ],
  approvalAuthorities: [
    { type: 'financial', canApproveFor: 'all' },
    { type: 'hr', canApproveFor: 'all' },
    { type: 'contract', canApproveFor: 'all' },
    { type: 'policy', canApproveFor: 'all' },
  ],
  taskCapabilities: [
    {
      eventType: 'strategic.market_change',
      taskTypes: ['analyze_impact', 'executive_briefing'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
    {
      eventType: 'strategic.opportunity_identified',
      taskTypes: ['evaluate_opportunity'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
  ],
  typicalTaskLoad: { daily: 15, weekly: 50, maxConcurrent: 20 },
  aiContext: {
    briefingPriorities: ['strategic-updates', 'financial-metrics', 'risk-alerts', 'key-decisions'],
    taskSortingWeights: { 'strategic': 1.5, 'financial': 1.3, 'urgent': 1.4 },
    communicationStyle: 'formal',
  },
};

/**
 * CFO Role Profile
 */
export const CFO_PROFILE: Partial<RoleProfile> = {
  title: 'Chief Financial Officer',
  slug: 'cfo',
  description: 'Group CFO responsible for financial strategy, capital management, and reporting',
  shortDescription: 'Group CFO',
  subsidiaryId: 'all',
  jobLevel: 'EXECUTIVE',
  employmentTypes: ['full-time'],
  reportsTo: ['ceo'],
  supervises: ['finance-manager', 'accountant', 'accounts-payable-clerk'],
  skills: [
    { category: 'financial', name: 'Financial Management', requiredLevel: 'expert', isCore: true },
    { category: 'strategic', name: 'Financial Strategy', requiredLevel: 'expert', isCore: true },
    { category: 'compliance', name: 'Financial Compliance', requiredLevel: 'advanced', isCore: true },
  ],
  approvalAuthorities: [
    { type: 'financial', canApproveFor: 'all' },
    { type: 'expense', canApproveFor: 'all' },
    { type: 'procurement', canApproveFor: 'all', maxAmount: { amount: 100000000, currency: 'UGX' } },
  ],
  taskCapabilities: [
    {
      eventType: 'financial.payment_received',
      taskTypes: ['reconcile_payment', 'send_receipt'],
      canInitiate: false,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
    {
      eventType: 'financial.invoice_overdue',
      taskTypes: ['send_reminder', 'escalate_debt'],
      canInitiate: false,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
    {
      eventType: 'financial.budget_exceeded',
      taskTypes: ['review_budget_variance', 'approve_budget_increase'],
      canInitiate: false,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
  ],
  typicalTaskLoad: { daily: 20, weekly: 80, maxConcurrent: 25 },
  aiContext: {
    briefingPriorities: ['cash-flow', 'budget-variance', 'pending-approvals', 'capital-updates'],
    taskSortingWeights: { 'financial': 1.5, 'compliance': 1.3, 'deadline': 1.4 },
    communicationStyle: 'formal',
  },
};

/**
 * HR Manager Role Profile
 */
export const HR_MANAGER_PROFILE: Partial<RoleProfile> = {
  title: 'HR Manager',
  slug: 'hr-manager',
  description: 'Manages all human resources functions including recruitment, payroll, and employee relations',
  shortDescription: 'HR Manager',
  subsidiaryId: 'all',
  jobLevel: 'MANAGER',
  employmentTypes: ['full-time'],
  reportsTo: ['coo', 'ceo'],
  supervises: ['hr-officer', 'payroll-officer'],
  skills: [
    { category: 'management', name: 'People Management', requiredLevel: 'advanced', isCore: true },
    { category: 'administrative', name: 'HR Administration', requiredLevel: 'advanced', isCore: true },
    { category: 'compliance', name: 'Labor Law Compliance', requiredLevel: 'advanced', isCore: true },
  ],
  approvalAuthorities: [
    { type: 'hr', canApproveFor: 'all' },
    { type: 'leave', canApproveFor: 'all' },
    { type: 'expense', canApproveFor: 'department', maxAmount: { amount: 5000000, currency: 'UGX' } },
  ],
  taskCapabilities: [
    {
      eventType: 'hr.leave_requested',
      taskTypes: ['approve_leave'],
      canInitiate: false,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
    {
      eventType: 'hr.contract_expiring',
      taskTypes: ['review_contract_renewal', 'prepare_renewal'],
      canInitiate: false,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
    {
      eventType: 'hr.performance_review_due',
      taskTypes: ['conduct_review', 'self_assessment'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
  ],
  typicalTaskLoad: { daily: 25, weekly: 100, maxConcurrent: 30 },
  aiContext: {
    briefingPriorities: ['pending-leave', 'contract-renewals', 'payroll-deadlines', 'grievances'],
    taskSortingWeights: { 'deadline': 1.5, 'employee-welfare': 1.4, 'compliance': 1.3 },
    communicationStyle: 'formal',
  },
};

/**
 * Project Manager Role Profile
 */
export const PROJECT_MANAGER_PROFILE: Partial<RoleProfile> = {
  title: 'Project Manager',
  slug: 'project-manager',
  description: 'Manages project execution, client relationships, and team coordination',
  shortDescription: 'Project Manager',
  jobLevel: 'MANAGER',
  employmentTypes: ['full-time', 'contract'],
  reportsTo: ['operations-manager', 'subsidiary-md'],
  supervises: ['site-supervisor', 'team-lead'],
  skills: [
    { category: 'management', name: 'Project Management', requiredLevel: 'advanced', isCore: true },
    { category: 'customer', name: 'Client Relations', requiredLevel: 'advanced', isCore: true },
    { category: 'operational', name: 'Operations Coordination', requiredLevel: 'intermediate', isCore: true },
  ],
  approvalAuthorities: [
    { type: 'operational', canApproveFor: 'team' },
    { type: 'expense', canApproveFor: 'team', maxAmount: { amount: 2000000, currency: 'UGX' } },
    { type: 'leave', canApproveFor: 'team' },
  ],
  taskCapabilities: [
    {
      eventType: 'production.job_started',
      taskTypes: ['verify_materials', 'update_customer'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
    {
      eventType: 'production.milestone_reached',
      taskTypes: ['update_customer_milestone'],
      canInitiate: false,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
    {
      eventType: 'production.quality_issue',
      taskTypes: ['investigate_issue', 'resolve_issue'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
    {
      eventType: 'customer.order_placed',
      taskTypes: ['confirm_order', 'schedule_production'],
      canInitiate: false,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
  ],
  typicalTaskLoad: { daily: 30, weekly: 120, maxConcurrent: 40 },
  aiContext: {
    briefingPriorities: ['project-deadlines', 'client-communications', 'team-blockers', 'milestones'],
    taskSortingWeights: { 'client': 1.5, 'deadline': 1.4, 'team': 1.3 },
    communicationStyle: 'casual',
  },
};

/**
 * Finance Officer Role Profile
 */
export const FINANCE_OFFICER_PROFILE: Partial<RoleProfile> = {
  title: 'Finance Officer',
  slug: 'finance-officer',
  description: 'Handles day-to-day financial operations, transaction processing, and reconciliation',
  shortDescription: 'Finance Officer',
  jobLevel: 'SENIOR',
  employmentTypes: ['full-time'],
  reportsTo: ['finance-manager', 'cfo'],
  supervises: [],
  skills: [
    { category: 'financial', name: 'Bookkeeping', requiredLevel: 'advanced', isCore: true },
    { category: 'financial', name: 'Reconciliation', requiredLevel: 'advanced', isCore: true },
    { category: 'administrative', name: 'Documentation', requiredLevel: 'intermediate', isCore: true },
  ],
  approvalAuthorities: [
    { type: 'expense', canApproveFor: 'self', maxAmount: { amount: 500000, currency: 'UGX' } },
  ],
  taskCapabilities: [
    {
      eventType: 'financial.payment_received',
      taskTypes: ['reconcile_payment', 'send_receipt'],
      canInitiate: false,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
    {
      eventType: 'customer.order_placed',
      taskTypes: ['create_invoice'],
      canInitiate: false,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 40, weekly: 160, maxConcurrent: 50 },
  aiContext: {
    briefingPriorities: ['pending-reconciliations', 'payment-deadlines', 'discrepancies', 'bank-updates'],
    taskSortingWeights: { 'deadline': 1.5, 'accuracy': 1.4, 'amount': 1.2 },
    communicationStyle: 'formal',
  },
};

/**
 * Sales Representative Role Profile
 */
export const SALES_REP_PROFILE: Partial<RoleProfile> = {
  title: 'Sales Representative',
  slug: 'sales-rep',
  description: 'Handles customer inquiries, quotes, and sales activities',
  shortDescription: 'Sales Rep',
  jobLevel: 'SENIOR',
  employmentTypes: ['full-time', 'contract'],
  reportsTo: ['sales-manager'],
  supervises: [],
  skills: [
    { category: 'customer', name: 'Customer Service', requiredLevel: 'advanced', isCore: true },
    { category: 'customer', name: 'Sales Techniques', requiredLevel: 'intermediate', isCore: true },
    { category: 'administrative', name: 'Documentation', requiredLevel: 'intermediate', isCore: false },
  ],
  approvalAuthorities: [],
  taskCapabilities: [
    {
      eventType: 'customer.inquiry_received',
      taskTypes: ['respond_inquiry', 'create_lead'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
    {
      eventType: 'customer.quote_requested',
      taskTypes: ['prepare_quote'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
    {
      eventType: 'customer.order_placed',
      taskTypes: ['confirm_order'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 35, weekly: 140, maxConcurrent: 45 },
  aiContext: {
    briefingPriorities: ['pending-inquiries', 'quote-follow-ups', 'customer-callbacks', 'targets'],
    taskSortingWeights: { 'customer': 1.5, 'deadline': 1.4, 'value': 1.3 },
    communicationStyle: 'casual',
  },
};

/**
 * Production Supervisor Role Profile
 */
export const PRODUCTION_SUPERVISOR_PROFILE: Partial<RoleProfile> = {
  title: 'Production Supervisor',
  slug: 'production-supervisor',
  description: 'Supervises production activities, quality control, and team coordination on the floor',
  shortDescription: 'Production Supervisor',
  jobLevel: 'LEAD',
  employmentTypes: ['full-time'],
  reportsTo: ['production-manager', 'project-manager'],
  supervises: ['production-staff'],
  skills: [
    { category: 'operational', name: 'Production Management', requiredLevel: 'advanced', isCore: true },
    { category: 'technical', name: 'Quality Control', requiredLevel: 'advanced', isCore: true },
    { category: 'management', name: 'Team Leadership', requiredLevel: 'intermediate', isCore: true },
  ],
  approvalAuthorities: [
    { type: 'operational', canApproveFor: 'team' },
  ],
  taskCapabilities: [
    {
      eventType: 'production.job_started',
      taskTypes: ['verify_materials'],
      canInitiate: false,
      canExecute: true,
      canApprove: false,
      canDelegate: true,
    },
    {
      eventType: 'production.quality_issue',
      taskTypes: ['resolve_issue'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: true,
    },
  ],
  typicalTaskLoad: { daily: 40, weekly: 160, maxConcurrent: 50 },
  aiContext: {
    briefingPriorities: ['daily-production-schedule', 'quality-alerts', 'material-status', 'team-attendance'],
    taskSortingWeights: { 'quality': 1.5, 'deadline': 1.4, 'safety': 1.3 },
    communicationStyle: 'casual',
  },
};

// ============================================
// Dawin Finishes Role Profiles
// ============================================

/**
 * Designer Role Profile
 */
export const DESIGNER_PROFILE: Partial<RoleProfile> = {
  title: 'Designer',
  slug: 'designer',
  description: 'Creates and manages design items including CAD models, technical drawings, and specifications',
  shortDescription: 'Designer',
  subsidiaryId: 'finishes',
  departmentId: 'design',
  jobLevel: 'SENIOR',
  employmentTypes: ['full-time', 'contract'],
  reportsTo: ['design-manager'],
  supervises: [],
  skills: [
    { category: 'creative', name: 'CAD Modeling', requiredLevel: 'advanced', isCore: true },
    { category: 'technical', name: 'Technical Drawing', requiredLevel: 'advanced', isCore: true },
    { category: 'technical', name: 'Material Knowledge', requiredLevel: 'intermediate', isCore: true },
    { category: 'creative', name: '3D Visualization', requiredLevel: 'intermediate', isCore: false },
  ],
  approvalAuthorities: [],
  taskCapabilities: [
    {
      eventType: 'finishes.design_item_created',
      taskTypes: ['review_new_design_item'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
    {
      eventType: 'finishes.design_stage_changed',
      taskTypes: ['complete_stage_requirements'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
    {
      eventType: 'finishes.rag_status_critical',
      taskTypes: ['resolve_design_issue'],
      canInitiate: false,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 15, weekly: 60, maxConcurrent: 20 },
  aiContext: {
    briefingPriorities: ['design-deadlines', 'pending-reviews', 'stage-progress', 'rag-issues'],
    taskSortingWeights: { 'deadline': 1.5, 'client-approval': 1.4, 'stage': 1.3 },
    communicationStyle: 'casual',
  },
};

/**
 * Design Manager Role Profile
 */
export const DESIGN_MANAGER_PROFILE: Partial<RoleProfile> = {
  title: 'Design Manager',
  slug: 'design-manager',
  description: 'Leads the design team, manages design workflow, and ensures quality standards',
  shortDescription: 'Design Manager',
  subsidiaryId: 'finishes',
  departmentId: 'design',
  jobLevel: 'MANAGER',
  employmentTypes: ['full-time'],
  reportsTo: ['operations-manager', 'subsidiary-md'],
  supervises: ['designer'],
  skills: [
    { category: 'creative', name: 'Design Leadership', requiredLevel: 'expert', isCore: true },
    { category: 'management', name: 'Team Management', requiredLevel: 'advanced', isCore: true },
    { category: 'technical', name: 'Quality Assurance', requiredLevel: 'advanced', isCore: true },
    { category: 'customer', name: 'Client Relations', requiredLevel: 'intermediate', isCore: false },
  ],
  approvalAuthorities: [
    { type: 'operational', canApproveFor: 'department' },
    { type: 'expense', canApproveFor: 'department', maxAmount: { amount: 3000000, currency: 'UGX' } },
  ],
  taskCapabilities: [
    {
      eventType: 'finishes.design_item_created',
      taskTypes: ['review_new_design_item', 'assign_design_ownership'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
    {
      eventType: 'finishes.design_approval_requested',
      taskTypes: ['approve_design_internal'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
    {
      eventType: 'finishes.rag_status_critical',
      taskTypes: ['resolve_design_issue', 'resolve_manufacturing_issue'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
  ],
  typicalTaskLoad: { daily: 25, weekly: 100, maxConcurrent: 30 },
  aiContext: {
    briefingPriorities: ['pending-approvals', 'team-workload', 'design-deadlines', 'quality-issues'],
    taskSortingWeights: { 'approval': 1.5, 'team': 1.4, 'deadline': 1.3 },
    communicationStyle: 'casual',
  },
};

/**
 * Production Planner Role Profile
 */
export const PRODUCTION_PLANNER_PROFILE: Partial<RoleProfile> = {
  title: 'Production Planner',
  slug: 'production-planner',
  description: 'Plans and schedules production activities, manages capacity, and optimizes workflow',
  shortDescription: 'Production Planner',
  subsidiaryId: 'finishes',
  departmentId: 'production',
  jobLevel: 'SENIOR',
  employmentTypes: ['full-time'],
  reportsTo: ['production-manager'],
  supervises: [],
  skills: [
    { category: 'operational', name: 'Production Planning', requiredLevel: 'advanced', isCore: true },
    { category: 'technical', name: 'Capacity Management', requiredLevel: 'advanced', isCore: true },
    { category: 'operational', name: 'Material Planning', requiredLevel: 'intermediate', isCore: true },
  ],
  approvalAuthorities: [
    { type: 'operational', canApproveFor: 'self' },
  ],
  taskCapabilities: [
    {
      eventType: 'finishes.design_stage_changed',
      taskTypes: ['validate_manufacturing_readiness'],
      canInitiate: false,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
    {
      eventType: 'finishes.design_production_ready',
      taskTypes: ['schedule_production'],
      canInitiate: false,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
    {
      eventType: 'finishes.cutlist_optimization_complete',
      taskTypes: ['review_cutlist_optimization'],
      canInitiate: false,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
    {
      eventType: 'finishes.rag_status_critical',
      taskTypes: ['resolve_manufacturing_issue'],
      canInitiate: false,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 30, weekly: 120, maxConcurrent: 40 },
  aiContext: {
    briefingPriorities: ['production-schedule', 'capacity-alerts', 'material-availability', 'deadline-risks'],
    taskSortingWeights: { 'deadline': 1.5, 'capacity': 1.4, 'material': 1.3 },
    communicationStyle: 'casual',
  },
};

/**
 * Production Manager Role Profile
 */
export const PRODUCTION_MANAGER_PROFILE: Partial<RoleProfile> = {
  title: 'Production Manager',
  slug: 'production-manager',
  description: 'Manages overall production operations, team performance, and manufacturing quality',
  shortDescription: 'Production Manager',
  subsidiaryId: 'finishes',
  departmentId: 'production',
  jobLevel: 'MANAGER',
  employmentTypes: ['full-time'],
  reportsTo: ['operations-manager', 'subsidiary-md'],
  supervises: ['production-planner', 'production-supervisor', 'cnc-programmer', 'maintenance-technician'],
  skills: [
    { category: 'management', name: 'Production Management', requiredLevel: 'expert', isCore: true },
    { category: 'operational', name: 'Quality Management', requiredLevel: 'advanced', isCore: true },
    { category: 'management', name: 'Team Leadership', requiredLevel: 'advanced', isCore: true },
    { category: 'technical', name: 'Manufacturing Processes', requiredLevel: 'advanced', isCore: true },
  ],
  approvalAuthorities: [
    { type: 'operational', canApproveFor: 'department' },
    { type: 'expense', canApproveFor: 'department', maxAmount: { amount: 5000000, currency: 'UGX' } },
    { type: 'leave', canApproveFor: 'department' },
  ],
  taskCapabilities: [
    {
      eventType: 'finishes.design_approval_requested',
      taskTypes: ['approve_design_manufacturing'],
      canInitiate: false,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
    {
      eventType: 'finishes.design_production_ready',
      taskTypes: ['schedule_production', 'prepare_materials', 'create_work_order'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
    {
      eventType: 'production.job_started',
      taskTypes: ['verify_materials', 'update_customer'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
    {
      eventType: 'production.quality_issue',
      taskTypes: ['investigate_issue', 'resolve_issue'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
    {
      eventType: 'finishes.asset_maintenance_required',
      taskTypes: ['perform_scheduled_maintenance', 'repair_asset'],
      canInitiate: true,
      canExecute: false,
      canApprove: true,
      canDelegate: true,
    },
  ],
  typicalTaskLoad: { daily: 25, weekly: 100, maxConcurrent: 35 },
  aiContext: {
    briefingPriorities: ['production-schedule', 'quality-alerts', 'team-attendance', 'equipment-status'],
    taskSortingWeights: { 'quality': 1.5, 'deadline': 1.4, 'team': 1.3 },
    communicationStyle: 'casual',
  },
};

/**
 * CNC Programmer Role Profile
 */
export const CNC_PROGRAMMER_PROFILE: Partial<RoleProfile> = {
  title: 'CNC Programmer',
  slug: 'cnc-programmer',
  description: 'Creates CNC programs, work instructions, and optimizes cutting layouts',
  shortDescription: 'CNC Programmer',
  subsidiaryId: 'finishes',
  departmentId: 'production',
  jobLevel: 'SENIOR',
  employmentTypes: ['full-time'],
  reportsTo: ['production-manager'],
  supervises: [],
  skills: [
    { category: 'technical', name: 'CNC Programming', requiredLevel: 'expert', isCore: true },
    { category: 'technical', name: 'CAD/CAM Software', requiredLevel: 'advanced', isCore: true },
    { category: 'technical', name: 'Material Optimization', requiredLevel: 'advanced', isCore: true },
    { category: 'operational', name: 'Process Documentation', requiredLevel: 'intermediate', isCore: false },
  ],
  approvalAuthorities: [],
  taskCapabilities: [
    {
      eventType: 'finishes.design_production_ready',
      taskTypes: ['create_work_order'],
      canInitiate: false,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
    {
      eventType: 'finishes.cutlist_optimization_complete',
      taskTypes: ['review_cutlist_optimization'],
      canInitiate: false,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 20, weekly: 80, maxConcurrent: 25 },
  aiContext: {
    briefingPriorities: ['pending-programs', 'optimization-tasks', 'machine-queue', 'material-status'],
    taskSortingWeights: { 'deadline': 1.5, 'complexity': 1.3, 'material': 1.2 },
    communicationStyle: 'technical',
  },
};

/**
 * Quality Manager Role Profile
 */
export const QUALITY_MANAGER_PROFILE: Partial<RoleProfile> = {
  title: 'Quality Manager',
  slug: 'quality-manager',
  description: 'Ensures quality standards across all production and design processes',
  shortDescription: 'Quality Manager',
  subsidiaryId: 'finishes',
  departmentId: 'production',
  jobLevel: 'MANAGER',
  employmentTypes: ['full-time'],
  reportsTo: ['production-manager', 'subsidiary-md'],
  supervises: ['quality-inspector'],
  skills: [
    { category: 'technical', name: 'Quality Assurance', requiredLevel: 'expert', isCore: true },
    { category: 'technical', name: 'Process Improvement', requiredLevel: 'advanced', isCore: true },
    { category: 'compliance', name: 'Standards Compliance', requiredLevel: 'advanced', isCore: true },
    { category: 'management', name: 'Audit Management', requiredLevel: 'intermediate', isCore: false },
  ],
  approvalAuthorities: [
    { type: 'operational', canApproveFor: 'subsidiary' },
  ],
  taskCapabilities: [
    {
      eventType: 'finishes.rag_status_critical',
      taskTypes: ['escalate_quality_issue'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
    {
      eventType: 'production.quality_issue',
      taskTypes: ['investigate_issue', 'resolve_issue'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
  ],
  typicalTaskLoad: { daily: 20, weekly: 80, maxConcurrent: 25 },
  aiContext: {
    briefingPriorities: ['quality-alerts', 'inspection-queue', 'defect-trends', 'audit-schedule'],
    taskSortingWeights: { 'severity': 1.5, 'deadline': 1.4, 'compliance': 1.3 },
    communicationStyle: 'formal',
  },
};

/**
 * Procurement Coordinator Role Profile
 */
export const PROCUREMENT_COORDINATOR_PROFILE: Partial<RoleProfile> = {
  title: 'Procurement Coordinator',
  slug: 'procurement-coordinator',
  description: 'Manages procurement of materials, hardware, and external services',
  shortDescription: 'Procurement Coordinator',
  subsidiaryId: 'finishes',
  departmentId: 'procurement',
  jobLevel: 'SENIOR',
  employmentTypes: ['full-time'],
  reportsTo: ['operations-manager'],
  supervises: [],
  skills: [
    { category: 'operational', name: 'Procurement', requiredLevel: 'advanced', isCore: true },
    { category: 'financial', name: 'Cost Management', requiredLevel: 'intermediate', isCore: true },
    { category: 'operational', name: 'Vendor Management', requiredLevel: 'advanced', isCore: true },
    { category: 'administrative', name: 'Documentation', requiredLevel: 'intermediate', isCore: false },
  ],
  approvalAuthorities: [
    { type: 'procurement', canApproveFor: 'self', maxAmount: { amount: 2000000, currency: 'UGX' } },
  ],
  taskCapabilities: [
    {
      eventType: 'finishes.design_stage_changed',
      taskTypes: ['initiate_procurement'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
    {
      eventType: 'finishes.cutlist_optimization_complete',
      taskTypes: ['order_sheet_materials'],
      canInitiate: false,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 35, weekly: 140, maxConcurrent: 45 },
  aiContext: {
    briefingPriorities: ['pending-orders', 'delivery-tracking', 'stock-alerts', 'vendor-issues'],
    taskSortingWeights: { 'deadline': 1.5, 'cost': 1.3, 'urgency': 1.4 },
    communicationStyle: 'casual',
  },
};

/**
 * Store Manager Role Profile
 */
export const STORE_MANAGER_PROFILE: Partial<RoleProfile> = {
  title: 'Store Manager',
  slug: 'store-manager',
  description: 'Manages inventory, materials storage, and stock control',
  shortDescription: 'Store Manager',
  subsidiaryId: 'finishes',
  departmentId: 'logistics',
  jobLevel: 'LEAD',
  employmentTypes: ['full-time'],
  reportsTo: ['operations-manager'],
  supervises: ['store-assistant'],
  skills: [
    { category: 'operational', name: 'Inventory Management', requiredLevel: 'advanced', isCore: true },
    { category: 'operational', name: 'Stock Control', requiredLevel: 'advanced', isCore: true },
    { category: 'administrative', name: 'Documentation', requiredLevel: 'intermediate', isCore: true },
  ],
  approvalAuthorities: [
    { type: 'operational', canApproveFor: 'team' },
  ],
  taskCapabilities: [
    {
      eventType: 'production.job_started',
      taskTypes: ['verify_materials'],
      canInitiate: false,
      canExecute: true,
      canApprove: false,
      canDelegate: true,
    },
    {
      eventType: 'finishes.design_production_ready',
      taskTypes: ['prepare_materials'],
      canInitiate: false,
      canExecute: true,
      canApprove: false,
      canDelegate: true,
    },
  ],
  typicalTaskLoad: { daily: 40, weekly: 160, maxConcurrent: 50 },
  aiContext: {
    briefingPriorities: ['material-requests', 'stock-levels', 'deliveries', 'discrepancies'],
    taskSortingWeights: { 'urgency': 1.5, 'project': 1.4, 'deadline': 1.3 },
    communicationStyle: 'casual',
  },
};

/**
 * Maintenance Technician Role Profile
 */
export const MAINTENANCE_TECHNICIAN_PROFILE: Partial<RoleProfile> = {
  title: 'Maintenance Technician',
  slug: 'maintenance-technician',
  description: 'Maintains and repairs workshop equipment and machinery',
  shortDescription: 'Maintenance Technician',
  subsidiaryId: 'finishes',
  departmentId: 'production',
  jobLevel: 'SENIOR',
  employmentTypes: ['full-time'],
  reportsTo: ['production-manager'],
  supervises: [],
  skills: [
    { category: 'technical', name: 'Equipment Maintenance', requiredLevel: 'advanced', isCore: true },
    { category: 'technical', name: 'Mechanical Repair', requiredLevel: 'advanced', isCore: true },
    { category: 'technical', name: 'Electrical Systems', requiredLevel: 'intermediate', isCore: false },
    { category: 'operational', name: 'Preventive Maintenance', requiredLevel: 'advanced', isCore: true },
  ],
  approvalAuthorities: [],
  taskCapabilities: [
    {
      eventType: 'finishes.asset_maintenance_required',
      taskTypes: ['perform_scheduled_maintenance', 'repair_asset'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 15, weekly: 60, maxConcurrent: 20 },
  aiContext: {
    briefingPriorities: ['scheduled-maintenance', 'repair-requests', 'parts-status', 'equipment-alerts'],
    taskSortingWeights: { 'urgency': 1.5, 'production-impact': 1.4, 'safety': 1.3 },
    communicationStyle: 'casual',
  },
};

/**
 * E-commerce Coordinator Role Profile
 */
export const ECOMMERCE_COORDINATOR_PROFILE: Partial<RoleProfile> = {
  title: 'E-commerce Coordinator',
  slug: 'ecommerce-coordinator',
  description: 'Manages Shopify store, product listings, and online sales operations',
  shortDescription: 'E-commerce Coordinator',
  subsidiaryId: 'finishes',
  departmentId: 'operations',
  jobLevel: 'SENIOR',
  employmentTypes: ['full-time'],
  reportsTo: ['sales-manager'],
  supervises: [],
  skills: [
    { category: 'technical', name: 'E-commerce Platforms', requiredLevel: 'advanced', isCore: true },
    { category: 'creative', name: 'Product Content', requiredLevel: 'intermediate', isCore: true },
    { category: 'customer', name: 'Online Customer Service', requiredLevel: 'intermediate', isCore: true },
    { category: 'technical', name: 'SEO/SEM', requiredLevel: 'intermediate', isCore: false },
  ],
  approvalAuthorities: [],
  taskCapabilities: [
    {
      eventType: 'finishes.product_ready_for_shopify',
      taskTypes: ['sync_to_shopify', 'verify_shopify_listing'],
      canInitiate: false,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 30, weekly: 120, maxConcurrent: 40 },
  aiContext: {
    briefingPriorities: ['pending-listings', 'inventory-sync', 'order-issues', 'reviews'],
    taskSortingWeights: { 'deadline': 1.5, 'customer': 1.4, 'revenue': 1.3 },
    communicationStyle: 'casual',
  },
};

/**
 * Product Manager Role Profile
 */
export const PRODUCT_MANAGER_PROFILE: Partial<RoleProfile> = {
  title: 'Product Manager',
  slug: 'product-manager',
  description: 'Manages product development, launch pipeline, and product strategy',
  shortDescription: 'Product Manager',
  subsidiaryId: 'finishes',
  departmentId: 'operations',
  jobLevel: 'MANAGER',
  employmentTypes: ['full-time'],
  reportsTo: ['subsidiary-md'],
  supervises: ['ecommerce-coordinator', 'content-creator'],
  skills: [
    { category: 'strategic', name: 'Product Strategy', requiredLevel: 'advanced', isCore: true },
    { category: 'management', name: 'Product Development', requiredLevel: 'advanced', isCore: true },
    { category: 'customer', name: 'Market Research', requiredLevel: 'intermediate', isCore: true },
    { category: 'operational', name: 'Launch Management', requiredLevel: 'advanced', isCore: true },
  ],
  approvalAuthorities: [
    { type: 'operational', canApproveFor: 'team' },
    { type: 'expense', canApproveFor: 'team', maxAmount: { amount: 3000000, currency: 'UGX' } },
  ],
  taskCapabilities: [
    {
      eventType: 'finishes.product_added_to_pipeline',
      taskTypes: ['complete_product_setup', 'create_product_content'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
    {
      eventType: 'finishes.product_ready_for_shopify',
      taskTypes: ['sync_to_shopify', 'verify_shopify_listing'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
  ],
  typicalTaskLoad: { daily: 20, weekly: 80, maxConcurrent: 25 },
  aiContext: {
    briefingPriorities: ['pipeline-status', 'launch-deadlines', 'market-feedback', 'competitor-activity'],
    taskSortingWeights: { 'deadline': 1.5, 'strategic': 1.4, 'revenue': 1.3 },
    communicationStyle: 'casual',
  },
};

/**
 * Project Coordinator Role Profile
 */
export const PROJECT_COORDINATOR_PROFILE: Partial<RoleProfile> = {
  title: 'Project Coordinator',
  slug: 'project-coordinator',
  description: 'Coordinates project activities, client communications, and milestone tracking',
  shortDescription: 'Project Coordinator',
  subsidiaryId: 'finishes',
  departmentId: 'operations',
  jobLevel: 'SENIOR',
  employmentTypes: ['full-time', 'contract'],
  reportsTo: ['project-manager'],
  supervises: [],
  skills: [
    { category: 'operational', name: 'Project Coordination', requiredLevel: 'advanced', isCore: true },
    { category: 'customer', name: 'Client Communication', requiredLevel: 'advanced', isCore: true },
    { category: 'administrative', name: 'Documentation', requiredLevel: 'intermediate', isCore: true },
  ],
  approvalAuthorities: [],
  taskCapabilities: [
    {
      eventType: 'finishes.design_approval_requested',
      taskTypes: ['obtain_client_approval'],
      canInitiate: false,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
    {
      eventType: 'production.milestone_reached',
      taskTypes: ['update_customer_milestone'],
      canInitiate: false,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
    {
      eventType: 'production.job_started',
      taskTypes: ['update_customer'],
      canInitiate: false,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 35, weekly: 140, maxConcurrent: 45 },
  aiContext: {
    briefingPriorities: ['client-updates', 'milestone-tracking', 'approvals-pending', 'schedule-changes'],
    taskSortingWeights: { 'client': 1.5, 'deadline': 1.4, 'milestone': 1.3 },
    communicationStyle: 'casual',
  },
};

/**
 * Interior Designer Role Profile
 */
export const INTERIOR_DESIGNER_PROFILE: Partial<RoleProfile> = {
  title: 'Interior Designer',
  slug: 'interior-designer',
  description: 'Leads interior design projects with client consultation and aesthetic direction',
  shortDescription: 'Interior Designer',
  subsidiaryId: 'finishes',
  departmentId: 'design',
  jobLevel: 'SENIOR',
  employmentTypes: ['full-time', 'contract'],
  reportsTo: ['design-manager'],
  supervises: [],
  skills: [
    { category: 'creative', name: 'Design Concepts', requiredLevel: 'advanced', isCore: true },
    { category: 'customer', name: 'Client Relations', requiredLevel: 'advanced', isCore: true },
    { category: 'creative', name: 'Space Planning', requiredLevel: 'advanced', isCore: true },
    { category: 'technical', name: 'Material Knowledge', requiredLevel: 'advanced', isCore: true },
    { category: 'creative', name: 'Color Theory', requiredLevel: 'intermediate', isCore: true },
    { category: 'creative', name: 'CAD Modeling', requiredLevel: 'intermediate', isCore: false },
    { category: 'creative', name: '3D Visualization', requiredLevel: 'advanced', isCore: true },
  ],
  approvalAuthorities: [],
  taskCapabilities: [
    {
      eventType: 'finishes.client_consultation_scheduled',
      taskTypes: ['prepare_consultation', 'conduct_consultation', 'document_requirements'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: true,
    },
    {
      eventType: 'finishes.design_concepts_created',
      taskTypes: ['create_concepts', 'prepare_presentation', 'present_to_client'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
    {
      eventType: 'finishes.client_feedback_received',
      taskTypes: ['review_feedback', 'revise_design', 'update_client'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: true,
    },
  ],
  typicalTaskLoad: { daily: 20, weekly: 80, maxConcurrent: 25 },
  aiContext: {
    briefingPriorities: ['consultations', 'client-feedback', 'design-reviews', 'presentations'],
    taskSortingWeights: { 'client': 1.5, 'deadline': 1.4, 'creative': 1.3 },
    communicationStyle: 'casual',
  },
};

/**
 * Space Planner Role Profile
 */
export const SPACE_PLANNER_PROFILE: Partial<RoleProfile> = {
  title: 'Space Planner',
  slug: 'space-planner',
  description: 'Analyzes space constraints and creates functional layouts',
  shortDescription: 'Space Planner',
  subsidiaryId: 'finishes',
  departmentId: 'design',
  jobLevel: 'SENIOR',
  employmentTypes: ['full-time', 'contract'],
  reportsTo: ['design-manager'],
  supervises: [],
  skills: [
    { category: 'creative', name: 'Space Planning', requiredLevel: 'expert', isCore: true },
    { category: 'compliance', name: 'Building Code Knowledge', requiredLevel: 'advanced', isCore: true },
    { category: 'creative', name: 'CAD Modeling', requiredLevel: 'advanced', isCore: true },
    { category: 'technical', name: 'Site Analysis', requiredLevel: 'advanced', isCore: true },
    { category: 'creative', name: 'Technical Drawing', requiredLevel: 'intermediate', isCore: true },
  ],
  approvalAuthorities: [],
  taskCapabilities: [
    {
      eventType: 'finishes.space_planning_requested',
      taskTypes: ['analyze_space', 'create_floor_plan', 'identify_constraints'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 25, weekly: 100, maxConcurrent: 30 },
  aiContext: {
    briefingPriorities: ['space-analysis', 'code-compliance', 'layout-optimization', 'constraints'],
    taskSortingWeights: { 'deadline': 1.5, 'complexity': 1.4, 'compliance': 1.3 },
    communicationStyle: 'technical',
  },
};

/**
 * Client Liaison Role Profile
 */
export const CLIENT_LIAISON_PROFILE: Partial<RoleProfile> = {
  title: 'Client Liaison',
  slug: 'client-liaison',
  description: 'Manages client relationships and project communication',
  shortDescription: 'Client Liaison',
  subsidiaryId: 'finishes',
  departmentId: 'operations',
  jobLevel: 'LEAD',
  employmentTypes: ['full-time'],
  reportsTo: ['project-manager'],
  supervises: [],
  skills: [
    { category: 'customer', name: 'Client Relations', requiredLevel: 'expert', isCore: true },
    { category: 'operational', name: 'Project Coordination', requiredLevel: 'advanced', isCore: true },
    { category: 'customer', name: 'Active Listening', requiredLevel: 'advanced', isCore: true },
    { category: 'customer', name: 'Conflict Resolution', requiredLevel: 'advanced', isCore: true },
    { category: 'administrative', name: 'Documentation', requiredLevel: 'advanced', isCore: true },
  ],
  approvalAuthorities: [
    { type: 'operational', canApproveFor: 'self', maxAmount: { amount: 5000000, currency: 'UGX' } },
  ],
  taskCapabilities: [
    {
      eventType: 'finishes.client_consultation_scheduled',
      taskTypes: ['send_consultation_details', 'confirm_attendance'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: true,
    },
    {
      eventType: 'finishes.client_approval_pending',
      taskTypes: ['obtain_client_approval', 'document_decision'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 25, weekly: 100, maxConcurrent: 30 },
  aiContext: {
    briefingPriorities: ['client-communications', 'approval-requests', 'schedule-confirmations', 'feedback'],
    taskSortingWeights: { 'client': 1.5, 'deadline': 1.4, 'urgency': 1.3 },
    communicationStyle: 'casual',
  },
};

/**
 * Material Specialist Role Profile
 */
export const MATERIAL_SPECIALIST_PROFILE: Partial<RoleProfile> = {
  title: 'Material Specialist',
  slug: 'material-specialist',
  description: 'Expert in material sourcing, specifications, and vendor management',
  shortDescription: 'Material Specialist',
  subsidiaryId: 'finishes',
  departmentId: 'procurement',
  jobLevel: 'SENIOR',
  employmentTypes: ['full-time'],
  reportsTo: ['design-manager'],
  supervises: [],
  skills: [
    { category: 'technical', name: 'Material Knowledge', requiredLevel: 'expert', isCore: true },
    { category: 'operational', name: 'Vendor Management', requiredLevel: 'advanced', isCore: true },
    { category: 'operational', name: 'Procurement', requiredLevel: 'advanced', isCore: true },
    { category: 'technical', name: 'Sustainability Knowledge', requiredLevel: 'advanced', isCore: true },
    { category: 'financial', name: 'Cost Management', requiredLevel: 'advanced', isCore: true },
  ],
  approvalAuthorities: [
    { type: 'procurement', canApproveFor: 'self', maxAmount: { amount: 10000000, currency: 'UGX' } },
  ],
  taskCapabilities: [
    {
      eventType: 'finishes.material_samples_requested',
      taskTypes: ['source_samples', 'coordinate_delivery', 'document_specifications'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: true,
    },
    {
      eventType: 'finishes.material_specification_needed',
      taskTypes: ['specify_materials', 'evaluate_suppliers', 'provide_cost_analysis'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 30, weekly: 120, maxConcurrent: 40 },
  aiContext: {
    briefingPriorities: ['sample-requests', 'vendor-quotes', 'sustainability', 'cost-analysis'],
    taskSortingWeights: { 'deadline': 1.5, 'cost': 1.4, 'quality': 1.3 },
    communicationStyle: 'casual',
  },
};

/**
 * Installation Coordinator Role Profile
 */
export const INSTALLATION_COORDINATOR_PROFILE: Partial<RoleProfile> = {
  title: 'Installation Coordinator',
  slug: 'installation-coordinator',
  description: 'Manages on-site installation and project completion',
  shortDescription: 'Installation Coordinator',
  subsidiaryId: 'finishes',
  departmentId: 'operations',
  jobLevel: 'LEAD',
  employmentTypes: ['full-time'],
  reportsTo: ['project-manager'],
  supervises: [],
  skills: [
    { category: 'operational', name: 'Project Coordination', requiredLevel: 'advanced', isCore: true },
    { category: 'technical', name: 'Quality Assurance', requiredLevel: 'advanced', isCore: true },
    { category: 'operational', name: 'Site Safety', requiredLevel: 'advanced', isCore: true },
    { category: 'operational', name: 'Problem Solving', requiredLevel: 'advanced', isCore: true },
    { category: 'operational', name: 'Logistics Management', requiredLevel: 'advanced', isCore: true },
  ],
  approvalAuthorities: [],
  taskCapabilities: [
    {
      eventType: 'finishes.installation_scheduled',
      taskTypes: ['prepare_site', 'coordinate_installation', 'verify_quality'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
    {
      eventType: 'finishes.installation_complete',
      taskTypes: ['conduct_walkthrough', 'document_punchlist', 'obtain_signoff'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 20, weekly: 80, maxConcurrent: 25 },
  aiContext: {
    briefingPriorities: ['installation-schedule', 'site-prep', 'quality-checks', 'client-signoff'],
    taskSortingWeights: { 'deadline': 1.5, 'safety': 1.4, 'quality': 1.3 },
    communicationStyle: 'casual',
  },
};

/**
 * Sales Manager Role Profile
 */
export const SALES_MANAGER_PROFILE: Partial<RoleProfile> = {
  title: 'Sales Manager',
  slug: 'sales-manager',
  description: 'Manages sales team and oversees revenue generation activities',
  shortDescription: 'Sales Manager',
  subsidiaryId: 'all',
  departmentId: 'business-development',
  jobLevel: 'MANAGER',
  employmentTypes: ['full-time'],
  reportsTo: ['coo'],
  supervises: ['sales-rep', 'sales-admin'],
  skills: [
    { category: 'sales', name: 'Sales Strategy', requiredLevel: 'expert', isCore: true },
    { category: 'management', name: 'Team Management', requiredLevel: 'advanced', isCore: true },
    { category: 'sales', name: 'Negotiation', requiredLevel: 'expert', isCore: true },
    { category: 'analytical', name: 'Sales Analytics', requiredLevel: 'advanced', isCore: true },
    { category: 'customer', name: 'Relationship Building', requiredLevel: 'advanced', isCore: true },
  ],
  approvalAuthorities: [
    { type: 'financial', canApproveFor: 'department', maxAmount: { currency: 'UGX', amount: 50000000 } },
    { type: 'contract', canApproveFor: 'department', maxAmount: { currency: 'UGX', amount: 100000000 } },
  ],
  taskCapabilities: [
    {
      eventType: 'customer.quote_requested',
      taskTypes: ['review_quote', 'approve_quote', 'negotiate_terms'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
  ],
  typicalTaskLoad: { daily: 25, weekly: 100, maxConcurrent: 30 },
  aiContext: {
    briefingPriorities: ['sales-pipeline', 'team-performance', 'quote-approvals'],
    taskSortingWeights: { 'revenue': 1.5, 'deadline': 1.4, 'strategic': 1.3 },
    communicationStyle: 'professional',
  },
};

/**
 * Sales Admin Role Profile
 */
export const SALES_ADMIN_PROFILE: Partial<RoleProfile> = {
  title: 'Sales Administrator',
  slug: 'sales-admin',
  description: 'Supports sales operations with administrative and CRM management',
  shortDescription: 'Sales Admin',
  subsidiaryId: 'all',
  departmentId: 'business-development',
  jobLevel: 'PROFESSIONAL',
  employmentTypes: ['full-time'],
  reportsTo: ['sales-manager'],
  supervises: [],
  skills: [
    { category: 'administrative', name: 'CRM Management', requiredLevel: 'advanced', isCore: true },
    { category: 'administrative', name: 'Data Entry', requiredLevel: 'advanced', isCore: true },
    { category: 'administrative', name: 'Document Preparation', requiredLevel: 'advanced', isCore: true },
    { category: 'sales', name: 'Lead Qualification', requiredLevel: 'intermediate', isCore: true },
  ],
  approvalAuthorities: [],
  taskCapabilities: [
    {
      eventType: 'customer.inquiry_received',
      taskTypes: ['create_lead', 'update_crm', 'schedule_followup'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 40, weekly: 160, maxConcurrent: 50 },
  aiContext: {
    briefingPriorities: ['new-leads', 'data-updates', 'follow-ups'],
    taskSortingWeights: { 'deadline': 1.4, 'priority': 1.3 },
    communicationStyle: 'casual',
  },
};

/**
 * Estimator Role Profile
 */
export const ESTIMATOR_PROFILE: Partial<RoleProfile> = {
  title: 'Estimator',
  slug: 'estimator',
  description: 'Prepares detailed cost estimates and quotations for projects',
  shortDescription: 'Estimator',
  subsidiaryId: 'finishes',
  departmentId: 'operations',
  jobLevel: 'PROFESSIONAL',
  employmentTypes: ['full-time'],
  reportsTo: ['project-manager'],
  supervises: [],
  skills: [
    { category: 'analytical', name: 'Cost Analysis', requiredLevel: 'expert', isCore: true },
    { category: 'technical', name: 'Technical Drawings', requiredLevel: 'advanced', isCore: true },
    { category: 'technical', name: 'Material Knowledge', requiredLevel: 'advanced', isCore: true },
    { category: 'analytical', name: 'Quantity Takeoff', requiredLevel: 'expert', isCore: true },
  ],
  approvalAuthorities: [],
  taskCapabilities: [
    {
      eventType: 'customer.quote_requested',
      taskTypes: ['prepare_quote', 'calculate_costs', 'review_specifications'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 20, weekly: 80, maxConcurrent: 25 },
  aiContext: {
    briefingPriorities: ['quote-requests', 'cost-updates', 'material-pricing'],
    taskSortingWeights: { 'deadline': 1.5, 'complexity': 1.4 },
    communicationStyle: 'professional',
  },
};

/**
 * Finance Manager Role Profile
 */
export const FINANCE_MANAGER_PROFILE: Partial<RoleProfile> = {
  title: 'Finance Manager',
  slug: 'finance-manager',
  description: 'Manages financial operations and reporting for subsidiary',
  shortDescription: 'Finance Manager',
  subsidiaryId: 'all',
  departmentId: 'finance',
  jobLevel: 'MANAGER',
  employmentTypes: ['full-time'],
  reportsTo: ['cfo'],
  supervises: ['accountant', 'credit-controller', 'finance-officer'],
  skills: [
    { category: 'financial', name: 'Financial Management', requiredLevel: 'expert', isCore: true },
    { category: 'financial', name: 'Financial Reporting', requiredLevel: 'expert', isCore: true },
    { category: 'financial', name: 'Budgeting', requiredLevel: 'advanced', isCore: true },
    { category: 'compliance', name: 'Financial Compliance', requiredLevel: 'advanced', isCore: true },
  ],
  approvalAuthorities: [
    { type: 'financial', canApproveFor: 'department', maxAmount: { currency: 'UGX', amount: 100000000 } },
    { type: 'expense', canApproveFor: 'department', maxAmount: { currency: 'UGX', amount: 10000000 } },
  ],
  taskCapabilities: [
    {
      eventType: 'financial.invoice_overdue',
      taskTypes: ['escalate_debt', 'review_collection', 'approve_writeoff'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
    {
      eventType: 'financial.budget_exceeded',
      taskTypes: ['approve_budget_increase', 'review_variance', 'adjust_forecast'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 25, weekly: 100, maxConcurrent: 30 },
  aiContext: {
    briefingPriorities: ['cash-flow', 'budget-variances', 'approvals', 'compliance'],
    taskSortingWeights: { 'financial-impact': 1.5, 'urgency': 1.4, 'compliance': 1.3 },
    communicationStyle: 'formal',
  },
};

/**
 * Accountant Role Profile
 */
export const ACCOUNTANT_PROFILE: Partial<RoleProfile> = {
  title: 'Accountant',
  slug: 'accountant',
  description: 'Handles accounting transactions and financial record-keeping',
  shortDescription: 'Accountant',
  subsidiaryId: 'all',
  departmentId: 'finance',
  jobLevel: 'PROFESSIONAL',
  employmentTypes: ['full-time'],
  reportsTo: ['finance-manager'],
  supervises: [],
  skills: [
    { category: 'financial', name: 'Accounting', requiredLevel: 'expert', isCore: true },
    { category: 'financial', name: 'Journal Entries', requiredLevel: 'advanced', isCore: true },
    { category: 'financial', name: 'Reconciliation', requiredLevel: 'advanced', isCore: true },
    { category: 'compliance', name: 'Tax Compliance', requiredLevel: 'advanced', isCore: true },
  ],
  approvalAuthorities: [],
  taskCapabilities: [
    {
      eventType: 'financial.payment_received',
      taskTypes: ['reconcile_payment', 'update_ledger', 'send_receipt'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 35, weekly: 140, maxConcurrent: 45 },
  aiContext: {
    briefingPriorities: ['transactions', 'reconciliations', 'month-end'],
    taskSortingWeights: { 'deadline': 1.4, 'accuracy': 1.5 },
    communicationStyle: 'professional',
  },
};

/**
 * Credit Controller Role Profile
 */
export const CREDIT_CONTROLLER_PROFILE: Partial<RoleProfile> = {
  title: 'Credit Controller',
  slug: 'credit-controller',
  description: 'Manages customer credit and collections',
  shortDescription: 'Credit Controller',
  subsidiaryId: 'all',
  departmentId: 'finance',
  jobLevel: 'PROFESSIONAL',
  employmentTypes: ['full-time'],
  reportsTo: ['finance-manager'],
  supervises: [],
  skills: [
    { category: 'financial', name: 'Credit Management', requiredLevel: 'expert', isCore: true },
    { category: 'financial', name: 'Collections', requiredLevel: 'advanced', isCore: true },
    { category: 'customer', name: 'Negotiation', requiredLevel: 'advanced', isCore: true },
    { category: 'analytical', name: 'Risk Assessment', requiredLevel: 'advanced', isCore: true },
  ],
  approvalAuthorities: [
    { type: 'financial', canApproveFor: 'specific', maxAmount: { currency: 'UGX', amount: 5000000 } },
  ],
  taskCapabilities: [
    {
      eventType: 'financial.invoice_overdue',
      taskTypes: ['send_reminder', 'call_customer', 'negotiate_payment_plan'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 30, weekly: 120, maxConcurrent: 40 },
  aiContext: {
    briefingPriorities: ['overdue-invoices', 'payment-plans', 'credit-reviews'],
    taskSortingWeights: { 'days-overdue': 1.5, 'amount': 1.4 },
    communicationStyle: 'professional',
  },
};

/**
 * Order Coordinator Role Profile
 */
export const ORDER_COORDINATOR_PROFILE: Partial<RoleProfile> = {
  title: 'Order Coordinator',
  slug: 'order-coordinator',
  description: 'Coordinates order processing and fulfillment',
  shortDescription: 'Order Coordinator',
  subsidiaryId: 'all',
  departmentId: 'operations',
  jobLevel: 'PROFESSIONAL',
  employmentTypes: ['full-time'],
  reportsTo: ['project-coordinator'],
  supervises: [],
  skills: [
    { category: 'operational', name: 'Order Processing', requiredLevel: 'advanced', isCore: true },
    { category: 'operational', name: 'Logistics Coordination', requiredLevel: 'advanced', isCore: true },
    { category: 'customer', name: 'Customer Service', requiredLevel: 'advanced', isCore: true },
    { category: 'administrative', name: 'Documentation', requiredLevel: 'advanced', isCore: true },
  ],
  approvalAuthorities: [],
  taskCapabilities: [
    {
      eventType: 'customer.order_confirmed',
      taskTypes: ['process_order', 'confirm_delivery', 'update_inventory'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 35, weekly: 140, maxConcurrent: 45 },
  aiContext: {
    briefingPriorities: ['new-orders', 'delivery-schedules', 'customer-updates'],
    taskSortingWeights: { 'deadline': 1.5, 'priority': 1.4 },
    communicationStyle: 'casual',
  },
};

/**
 * Department Head Role Profile
 */
export const DEPARTMENT_HEAD_PROFILE: Partial<RoleProfile> = {
  title: 'Department Head',
  slug: 'department-head',
  description: 'Leads department operations and manages team performance',
  shortDescription: 'Department Head',
  subsidiaryId: 'all',
  jobLevel: 'MANAGER',
  employmentTypes: ['full-time'],
  reportsTo: ['coo'],
  supervises: ['manager', 'team-lead'],
  skills: [
    { category: 'management', name: 'Team Leadership', requiredLevel: 'expert', isCore: true },
    { category: 'strategic', name: 'Strategic Planning', requiredLevel: 'advanced', isCore: true },
    { category: 'financial', name: 'Budget Management', requiredLevel: 'advanced', isCore: true },
    { category: 'operational', name: 'Performance Management', requiredLevel: 'advanced', isCore: true },
  ],
  approvalAuthorities: [
    { type: 'financial', canApproveFor: 'department', maxAmount: { currency: 'UGX', amount: 75000000 } },
    { type: 'hr', canApproveFor: 'department' },
    { type: 'leave', canApproveFor: 'department' },
  ],
  taskCapabilities: [
    {
      eventType: 'financial.budget_exceeded',
      taskTypes: ['review_budget', 'justify_variance', 'approve_increase'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
  ],
  typicalTaskLoad: { daily: 20, weekly: 80, maxConcurrent: 25 },
  aiContext: {
    briefingPriorities: ['team-performance', 'budget', 'strategic-initiatives'],
    taskSortingWeights: { 'strategic': 1.5, 'team': 1.4, 'budget': 1.3 },
    communicationStyle: 'professional',
  },
};

/**
 * Content Creator Role Profile
 */
export const CONTENT_CREATOR_PROFILE: Partial<RoleProfile> = {
  title: 'Content Creator',
  slug: 'content-creator',
  description: 'Creates marketing and product content',
  shortDescription: 'Content Creator',
  subsidiaryId: 'all',
  departmentId: 'marketing',
  jobLevel: 'PROFESSIONAL',
  employmentTypes: ['full-time', 'contract'],
  reportsTo: ['product-manager'],
  supervises: [],
  skills: [
    { category: 'creative', name: 'Copywriting', requiredLevel: 'advanced', isCore: true },
    { category: 'creative', name: 'Visual Design', requiredLevel: 'intermediate', isCore: true },
    { category: 'technical', name: 'SEO', requiredLevel: 'intermediate', isCore: false },
    { category: 'creative', name: 'Photography', requiredLevel: 'intermediate', isCore: false },
  ],
  approvalAuthorities: [],
  taskCapabilities: [
    {
      eventType: 'finishes.product_added_to_pipeline',
      taskTypes: ['create_product_content', 'write_description', 'create_visuals'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 25, weekly: 100, maxConcurrent: 30 },
  aiContext: {
    briefingPriorities: ['content-requests', 'product-launches', 'campaigns'],
    taskSortingWeights: { 'deadline': 1.5, 'priority': 1.4 },
    communicationStyle: 'casual',
  },
};

/**
 * Strategy Analyst Role Profile
 */
export const STRATEGY_ANALYST_PROFILE: Partial<RoleProfile> = {
  title: 'Strategy Analyst',
  slug: 'strategy-analyst',
  description: 'Analyzes business data and provides strategic insights',
  shortDescription: 'Strategy Analyst',
  subsidiaryId: 'all',
  departmentId: 'strategy',
  jobLevel: 'PROFESSIONAL',
  employmentTypes: ['full-time'],
  reportsTo: ['strategy-manager'],
  supervises: [],
  skills: [
    { category: 'analytical', name: 'Data Analysis', requiredLevel: 'expert', isCore: true },
    { category: 'strategic', name: 'Market Research', requiredLevel: 'advanced', isCore: true },
    { category: 'analytical', name: 'Business Intelligence', requiredLevel: 'advanced', isCore: true },
    { category: 'strategic', name: 'Competitive Analysis', requiredLevel: 'advanced', isCore: true },
  ],
  approvalAuthorities: [],
  taskCapabilities: [
    {
      eventType: 'strategic.market_intelligence',
      taskTypes: ['analyze_market_data', 'prepare_report', 'identify_trends'],
      canInitiate: true,
      canExecute: true,
      canApprove: false,
      canDelegate: false,
    },
  ],
  typicalTaskLoad: { daily: 20, weekly: 80, maxConcurrent: 25 },
  aiContext: {
    briefingPriorities: ['market-data', 'competitor-updates', 'analysis-requests'],
    taskSortingWeights: { 'strategic-value': 1.5, 'deadline': 1.4 },
    communicationStyle: 'professional',
  },
};

/**
 * Strategy Manager Role Profile
 */
export const STRATEGY_MANAGER_PROFILE: Partial<RoleProfile> = {
  title: 'Strategy Manager',
  slug: 'strategy-manager',
  description: 'Leads strategic planning and business development initiatives',
  shortDescription: 'Strategy Manager',
  subsidiaryId: 'all',
  departmentId: 'strategy',
  jobLevel: 'MANAGER',
  employmentTypes: ['full-time'],
  reportsTo: ['ceo'],
  supervises: ['strategy-analyst'],
  skills: [
    { category: 'strategic', name: 'Strategic Planning', requiredLevel: 'expert', isCore: true },
    { category: 'strategic', name: 'Business Development', requiredLevel: 'expert', isCore: true },
    { category: 'management', name: 'Stakeholder Management', requiredLevel: 'advanced', isCore: true },
    { category: 'analytical', name: 'Scenario Planning', requiredLevel: 'advanced', isCore: true },
  ],
  approvalAuthorities: [
    { type: 'strategic', canApproveFor: 'subsidiary' },
  ],
  taskCapabilities: [
    {
      eventType: 'strategic.market_intelligence',
      taskTypes: ['review_analysis', 'develop_strategy', 'present_recommendations'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
  ],
  typicalTaskLoad: { daily: 20, weekly: 80, maxConcurrent: 25 },
  aiContext: {
    briefingPriorities: ['strategic-initiatives', 'market-opportunities', 'executive-updates'],
    taskSortingWeights: { 'strategic-impact': 1.5, 'urgency': 1.4 },
    communicationStyle: 'formal',
  },
};

/**
 * Executive Role Profile (generic executive/board member)
 */
export const EXECUTIVE_PROFILE: Partial<RoleProfile> = {
  title: 'Executive',
  slug: 'executive',
  description: 'Senior executive or board member',
  shortDescription: 'Executive',
  subsidiaryId: 'all',
  jobLevel: 'EXECUTIVE',
  employmentTypes: ['full-time'],
  reportsTo: [],
  supervises: [],
  skills: [
    { category: 'strategic', name: 'Strategic Thinking', requiredLevel: 'expert', isCore: true },
    { category: 'management', name: 'Executive Leadership', requiredLevel: 'expert', isCore: true },
    { category: 'financial', name: 'Financial Acumen', requiredLevel: 'advanced', isCore: true },
  ],
  approvalAuthorities: [
    { type: 'financial', canApproveFor: 'all' },
    { type: 'strategic', canApproveFor: 'all' },
  ],
  taskCapabilities: [
    {
      eventType: 'strategic.market_intelligence',
      taskTypes: ['review_strategy', 'approve_initiatives', 'provide_guidance'],
      canInitiate: true,
      canExecute: true,
      canApprove: true,
      canDelegate: true,
    },
  ],
  typicalTaskLoad: { daily: 15, weekly: 50, maxConcurrent: 20 },
  aiContext: {
    briefingPriorities: ['strategic-decisions', 'key-approvals', 'board-matters'],
    taskSortingWeights: { 'strategic': 1.5, 'urgency': 1.4 },
    communicationStyle: 'formal',
  },
};

// ============================================
// All Standard Profiles Map
// ============================================

export const STANDARD_ROLE_PROFILES: Record<string, Partial<RoleProfile>> = {
  // Executive & Shared Roles
  'ceo': CEO_PROFILE,
  'cfo': CFO_PROFILE,
  'hr-manager': HR_MANAGER_PROFILE,
  'project-manager': PROJECT_MANAGER_PROFILE,
  'finance-officer': FINANCE_OFFICER_PROFILE,
  'sales-rep': SALES_REP_PROFILE,
  'production-supervisor': PRODUCTION_SUPERVISOR_PROFILE,
  'executive': EXECUTIVE_PROFILE,
  'department-head': DEPARTMENT_HEAD_PROFILE,

  // Sales & Business Development
  'sales-manager': SALES_MANAGER_PROFILE,
  'sales-admin': SALES_ADMIN_PROFILE,
  'estimator': ESTIMATOR_PROFILE,

  // Finance Roles
  'finance-manager': FINANCE_MANAGER_PROFILE,
  'accountant': ACCOUNTANT_PROFILE,
  'credit-controller': CREDIT_CONTROLLER_PROFILE,

  // Strategy Roles
  'strategy-manager': STRATEGY_MANAGER_PROFILE,
  'strategy-analyst': STRATEGY_ANALYST_PROFILE,

  // Operations
  'order-coordinator': ORDER_COORDINATOR_PROFILE,

  // Marketing & Content
  'content-creator': CONTENT_CREATOR_PROFILE,

  // Dawin Finishes Roles
  'designer': DESIGNER_PROFILE,
  'design-manager': DESIGN_MANAGER_PROFILE,
  'production-planner': PRODUCTION_PLANNER_PROFILE,
  'production-manager': PRODUCTION_MANAGER_PROFILE,
  'cnc-programmer': CNC_PROGRAMMER_PROFILE,
  'quality-manager': QUALITY_MANAGER_PROFILE,
  'procurement-coordinator': PROCUREMENT_COORDINATOR_PROFILE,
  'store-manager': STORE_MANAGER_PROFILE,
  'maintenance-technician': MAINTENANCE_TECHNICIAN_PROFILE,
  'ecommerce-coordinator': ECOMMERCE_COORDINATOR_PROFILE,
  'product-manager': PRODUCT_MANAGER_PROFILE,
  'project-coordinator': PROJECT_COORDINATOR_PROFILE,

  // Interior Design & Custom Furniture Roles
  'interior-designer': INTERIOR_DESIGNER_PROFILE,
  'space-planner': SPACE_PLANNER_PROFILE,
  'client-liaison': CLIENT_LIAISON_PROFILE,
  'material-specialist': MATERIAL_SPECIALIST_PROFILE,
  'installation-coordinator': INSTALLATION_COORDINATOR_PROFILE,
};

// ============================================
// Role Templates by Category
// ============================================

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    id: 'template-executive',
    name: 'Executive Role',
    category: 'executive',
    description: 'Template for C-suite and executive positions',
    baseProfile: {
      jobLevel: 'EXECUTIVE',
      subsidiaryId: 'all',
      typicalTaskLoad: { daily: 15, weekly: 50, maxConcurrent: 20 },
      aiContext: {
        briefingPriorities: ['strategic-updates', 'key-decisions'],
        taskSortingWeights: { 'strategic': 1.5, 'urgent': 1.4 },
        communicationStyle: 'formal',
      },
    },
    customizations: [
      { field: 'title', label: 'Role Title', description: 'Executive title', type: 'text' },
      { field: 'approvalAuthorities', label: 'Approval Authority', description: 'Financial approval limits', type: 'select', options: [
        { value: 'unlimited', label: 'Unlimited' },
        { value: 'high', label: 'Up to UGX 100M' },
        { value: 'medium', label: 'Up to UGX 50M' },
      ]},
    ],
  },
  {
    id: 'template-manager',
    name: 'Manager Role',
    category: 'management',
    description: 'Template for departmental and team managers',
    baseProfile: {
      jobLevel: 'MANAGER',
      typicalTaskLoad: { daily: 25, weekly: 100, maxConcurrent: 35 },
      aiContext: {
        briefingPriorities: ['team-tasks', 'approvals-pending', 'deadlines'],
        taskSortingWeights: { 'team': 1.4, 'deadline': 1.3 },
        communicationStyle: 'casual',
      },
    },
    customizations: [
      { field: 'title', label: 'Role Title', description: 'Manager title', type: 'text' },
      { field: 'departmentId', label: 'Department', description: 'Primary department', type: 'select' },
    ],
  },
  {
    id: 'template-professional',
    name: 'Professional Role',
    category: 'professional',
    description: 'Template for skilled professional positions',
    baseProfile: {
      jobLevel: 'SENIOR',
      typicalTaskLoad: { daily: 35, weekly: 140, maxConcurrent: 45 },
      aiContext: {
        briefingPriorities: ['assigned-tasks', 'deadlines'],
        taskSortingWeights: { 'deadline': 1.4, 'priority': 1.3 },
        communicationStyle: 'casual',
      },
    },
    customizations: [
      { field: 'title', label: 'Role Title', description: 'Professional title', type: 'text' },
      { field: 'skills', label: 'Core Skills', description: 'Required skill categories', type: 'multi-select', options: [
        { value: 'technical', label: 'Technical' },
        { value: 'financial', label: 'Financial' },
        { value: 'customer', label: 'Customer Service' },
        { value: 'operational', label: 'Operations' },
      ]},
    ],
  },
  {
    id: 'template-operational',
    name: 'Operational Role',
    category: 'operational',
    description: 'Template for operational and production roles',
    baseProfile: {
      jobLevel: 'LEAD',
      typicalTaskLoad: { daily: 40, weekly: 160, maxConcurrent: 50 },
      aiContext: {
        briefingPriorities: ['daily-schedule', 'urgent-tasks'],
        taskSortingWeights: { 'deadline': 1.5, 'priority': 1.3 },
        communicationStyle: 'casual',
      },
    },
    customizations: [
      { field: 'title', label: 'Role Title', description: 'Operational role title', type: 'text' },
      { field: 'departmentId', label: 'Department', description: 'Primary department', type: 'select' },
    ],
  },
  {
    id: 'template-support',
    name: 'Support Role',
    category: 'support',
    description: 'Template for administrative and support positions',
    baseProfile: {
      jobLevel: 'JUNIOR',
      typicalTaskLoad: { daily: 45, weekly: 180, maxConcurrent: 60 },
      aiContext: {
        briefingPriorities: ['assigned-tasks', 'deadlines'],
        taskSortingWeights: { 'deadline': 1.4, 'priority': 1.3 },
        communicationStyle: 'casual',
      },
    },
    customizations: [
      { field: 'title', label: 'Role Title', description: 'Support role title', type: 'text' },
      { field: 'departmentId', label: 'Department', description: 'Primary department', type: 'select' },
    ],
  },
];

// ============================================
// Skill Definitions
// ============================================

export const SKILL_CATEGORIES: Record<SkillCategory, { label: string; description: string }> = {
  technical: { label: 'Technical', description: 'Technical and domain-specific expertise' },
  management: { label: 'Management', description: 'People and team management skills' },
  financial: { label: 'Financial', description: 'Financial handling and analysis' },
  customer: { label: 'Customer', description: 'Customer-facing and relationship skills' },
  operational: { label: 'Operational', description: 'Operations and logistics management' },
  strategic: { label: 'Strategic', description: 'Strategy and planning capabilities' },
  compliance: { label: 'Compliance', description: 'Legal and regulatory compliance' },
  administrative: { label: 'Administrative', description: 'Administrative and organizational' },
  creative: { label: 'Creative', description: 'Creative and design capabilities' },
  sales: { label: 'Sales', description: 'Sales and business development skills' },
  analytical: { label: 'Analytical', description: 'Data analysis and research capabilities' },
};

export const AUTHORITY_TYPES: Record<AuthorityType, { label: string; description: string }> = {
  financial: { label: 'Financial', description: 'Approve financial transactions' },
  procurement: { label: 'Procurement', description: 'Approve procurement requests' },
  hr: { label: 'HR', description: 'Approve HR actions' },
  leave: { label: 'Leave', description: 'Approve leave requests' },
  expense: { label: 'Expense', description: 'Approve expense claims' },
  contract: { label: 'Contract', description: 'Approve contracts' },
  policy: { label: 'Policy', description: 'Approve policies' },
  operational: { label: 'Operational', description: 'Approve operational decisions' },
  strategic: { label: 'Strategic', description: 'Approve strategic initiatives' },
};

// ============================================
// Default Escalation Paths
// ============================================

export const DEFAULT_ESCALATION_PATHS: Record<string, string[]> = {
  'staff': ['team-lead', 'manager', 'department-head'],
  'team-lead': ['manager', 'department-head', 'director'],
  'manager': ['department-head', 'director', 'coo'],
  'department-head': ['director', 'coo', 'ceo'],
  'director': ['coo', 'ceo'],
  'coo': ['ceo'],
  'cfo': ['ceo'],
  'cto': ['ceo'],
};

// ============================================
// Job Level Hierarchy
// ============================================

export const JOB_LEVEL_HIERARCHY: Record<string, number> = {
  'intern': 1,
  'associate': 2,
  'professional': 3,
  'team-lead': 4,
  'manager': 5,
  'department-head': 6,
  'director': 7,
  'vp': 8,
  'c-suite': 9,
  'ceo': 10,
};
