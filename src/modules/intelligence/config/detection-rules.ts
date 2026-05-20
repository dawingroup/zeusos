/**
 * Detection Rules Catalog - DawinOS v2.0
 * Pre-defined rules for grey area detection
 */

import { Timestamp } from 'firebase/firestore';
import { DetectionRule } from '../types/grey-area.types';

/**
 * Helper: Current Timestamp
 */
function now(): Timestamp {
  return Timestamp.now();
}

/**
 * Detection rules catalog
 */
export const DETECTION_RULES: DetectionRule[] = [
  // ============================================
  // Financial Grey Areas
  // ============================================
  {
    id: 'fin_large_transaction',
    name: 'Large Transaction Review',
    description: 'Flags transactions exceeding standard approval thresholds',
    enabled: true,
    entityTypes: ['transaction', 'request'],
    conditionLogic: 'and',
    conditions: [
      { field: 'amount.amount', operator: 'gt', value: 10_000_000 }, // 10M UGX
      { field: 'type', operator: 'in', value: ['payment', 'transfer', 'expense'] },
    ],
    greyAreaType: 'approval-required',
    severity: 'high',
    titleTemplate: 'Large {{type}} requires review: {{amount.amount}} UGX',
    descriptionTemplate: 'Transaction of {{amount.amount}} UGX ({{amount.currency}}) exceeds standard approval threshold. Vendor: {{vendor}}. Purpose: {{purpose}}.',
    assignToRoles: ['finance-manager', 'cfo'],
    slaHours: 4,
    priority: 100,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'fin_unusual_vendor',
    name: 'Unusual Vendor Payment',
    description: 'Flags payments to new or unusual vendors',
    enabled: true,
    entityTypes: ['transaction'],
    conditionLogic: 'and',
    conditions: [
      { field: 'vendor.isNew', operator: 'eq', value: true },
      { field: 'amount.amount', operator: 'gt', value: 1_000_000 }, // 1M UGX
    ],
    greyAreaType: 'policy-exception',
    severity: 'medium',
    titleTemplate: 'First payment to new vendor: {{vendor.name}}',
    descriptionTemplate: 'First payment of {{amount.amount}} UGX to {{vendor.name}}. Vendor registration date: {{vendor.registeredAt}}. Verify vendor legitimacy before approval.',
    assignToRoles: ['finance-officer', 'procurement-manager'],
    slaHours: 8,
    priority: 80,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'fin_budget_deviation',
    name: 'Budget Deviation Alert',
    description: 'Flags expenses deviating significantly from budget',
    enabled: true,
    entityTypes: ['transaction', 'request'],
    conditionLogic: 'and',
    conditions: [
      { field: 'budgetDeviation', operator: 'gt', value: 20 }, // 20% over budget
    ],
    greyAreaType: 'compliance-issue',
    severity: 'medium',
    titleTemplate: 'Budget deviation: {{category}} at {{budgetDeviation}}% over',
    descriptionTemplate: 'Expense category {{category}} has exceeded budget by {{budgetDeviation}}%. Current spend: {{currentSpend}} UGX. Budget: {{budgetAmount}} UGX.',
    assignToRoles: ['department-head', 'finance-manager'],
    slaHours: 12,
    priority: 70,
    createdAt: now(),
    updatedAt: now(),
  },
  
  // ============================================
  // HR Grey Areas
  // ============================================
  {
    id: 'hr_leave_conflict',
    name: 'Leave Coverage Conflict',
    description: 'Flags leave requests that create coverage gaps',
    enabled: true,
    entityTypes: ['request'],
    eventTypes: ['hr.leave_requested'],
    conditionLogic: 'and',
    conditions: [
      { field: 'coverageGap', operator: 'eq', value: true },
      { field: 'leaveDays', operator: 'gt', value: 3 },
    ],
    greyAreaType: 'conflict-resolution',
    severity: 'medium',
    titleTemplate: 'Leave creates coverage gap: {{employee.name}}',
    descriptionTemplate: '{{employee.name}} requested {{leaveDays}} days leave ({{startDate}} to {{endDate}}). This creates a coverage gap in {{department}}. {{conflictingEmployees}} also on leave during this period.',
    assignToRoles: ['hr-manager', 'department-head'],
    slaHours: 24,
    priority: 60,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'hr_salary_anomaly',
    name: 'Salary Anomaly Detection',
    description: 'Flags unusual salary variations',
    enabled: true,
    entityTypes: ['employee'],
    conditionLogic: 'or',
    conditions: [
      { field: 'salaryChange', operator: 'gt', value: 30 }, // 30% increase
      { field: 'salaryBelowBand', operator: 'eq', value: true },
      { field: 'salaryAboveBand', operator: 'eq', value: true },
    ],
    greyAreaType: 'data-inconsistency',
    severity: 'high',
    titleTemplate: 'Salary anomaly for {{employee.name}}',
    descriptionTemplate: 'Salary for {{employee.name}} ({{employee.position}}) appears unusual. Current: {{currentSalary}} UGX. Band range: {{bandMin}} - {{bandMax}} UGX. Reason flagged: {{anomalyReason}}.',
    assignToRoles: ['hr-manager', 'cfo'],
    slaHours: 8,
    priority: 90,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'hr_probation_ending',
    name: 'Probation Review Due',
    description: 'Flags employees whose probation is ending without review',
    enabled: true,
    entityTypes: ['employee'],
    conditionLogic: 'and',
    conditions: [
      { field: 'probationEndsInDays', operator: 'lte', value: 14 },
      { field: 'probationReviewCompleted', operator: 'eq', value: false },
    ],
    greyAreaType: 'pending-decision',
    severity: 'high',
    titleTemplate: 'Probation review needed: {{employee.name}}',
    descriptionTemplate: '{{employee.name}}\'s probation ends on {{probationEndDate}}. No probation review has been completed. Manager: {{manager.name}}.',
    assignToRoles: ['hr-officer', 'department-head'],
    slaHours: 48,
    priority: 85,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'hr_contract_expiring',
    name: 'Contract Expiration Alert',
    description: 'Flags contracts expiring without renewal decision',
    enabled: true,
    entityTypes: ['employee'],
    eventTypes: ['hr.contract_expiring'],
    conditionLogic: 'and',
    conditions: [
      { field: 'contractExpiresInDays', operator: 'lte', value: 30 },
      { field: 'renewalDecisionMade', operator: 'eq', value: false },
    ],
    greyAreaType: 'pending-decision',
    severity: 'high',
    titleTemplate: 'Contract renewal decision needed: {{employee.name}}',
    descriptionTemplate: '{{employee.name}}\'s contract expires on {{contractEndDate}}. No renewal decision has been recorded. Position: {{employee.position}}. Department: {{department}}.',
    assignToRoles: ['hr-manager'],
    slaHours: 72,
    priority: 80,
    createdAt: now(),
    updatedAt: now(),
  },
  
  // ============================================
  // Customer Grey Areas
  // ============================================
  {
    id: 'cust_vip_complaint',
    name: 'VIP Customer Complaint',
    description: 'Flags complaints from high-value customers',
    enabled: true,
    entityTypes: ['event'],
    eventTypes: ['customer.inquiry_received'],
    conditionLogic: 'and',
    conditions: [
      { field: 'customer.tier', operator: 'in', value: ['vip', 'premium'] },
      { field: 'isComplaint', operator: 'eq', value: true },
    ],
    greyAreaType: 'escalation-needed',
    severity: 'critical',
    titleTemplate: 'VIP complaint: {{customer.name}}',
    descriptionTemplate: '{{customer.tier}} customer {{customer.name}} has filed a complaint. Subject: {{subject}}. Customer lifetime value: {{customer.ltv}} UGX.',
    assignToRoles: ['sales-manager', 'operations-director'],
    slaHours: 2,
    priority: 100,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'cust_credit_limit',
    name: 'Credit Limit Request',
    description: 'Flags requests to exceed credit limits',
    enabled: true,
    entityTypes: ['request'],
    conditionLogic: 'and',
    conditions: [
      { field: 'type', operator: 'eq', value: 'credit_extension' },
      { field: 'requestedAmount', operator: 'gt', value: 5_000_000 }, // 5M UGX
    ],
    greyAreaType: 'approval-required',
    severity: 'high',
    titleTemplate: 'Credit extension request: {{customer.name}}',
    descriptionTemplate: '{{customer.name}} requests credit extension of {{requestedAmount}} UGX. Current limit: {{currentLimit}} UGX. Outstanding: {{outstanding}} UGX. Payment history: {{paymentScore}}/100.',
    assignToRoles: ['credit-manager', 'finance-director'],
    slaHours: 4,
    priority: 85,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'cust_large_order_discount',
    name: 'Large Order Discount Request',
    description: 'Flags discount requests above standard rates',
    enabled: true,
    entityTypes: ['request', 'event'],
    eventTypes: ['customer.quote_requested'],
    conditionLogic: 'and',
    conditions: [
      { field: 'discountPercentage', operator: 'gt', value: 15 }, // >15% discount
      { field: 'orderValue', operator: 'gt', value: 10_000_000 }, // 10M UGX
    ],
    greyAreaType: 'approval-required',
    severity: 'medium',
    titleTemplate: 'Discount approval: {{discountPercentage}}% for {{customer.name}}',
    descriptionTemplate: 'Discount of {{discountPercentage}}% requested on order of {{orderValue}} UGX for {{customer.name}}. Standard max is 15%. Discount amount: {{discountAmount}} UGX.',
    assignToRoles: ['sales-manager', 'finance-manager'],
    slaHours: 8,
    priority: 75,
    createdAt: now(),
    updatedAt: now(),
  },
  
  // ============================================
  // Operational Grey Areas
  // ============================================
  {
    id: 'ops_quality_failure',
    name: 'Quality Failure',
    description: 'Flags quality issues in production',
    enabled: true,
    entityTypes: ['event'],
    eventTypes: ['production.quality_issue'],
    conditionLogic: 'or',
    conditions: [
      { field: 'severity', operator: 'in', value: ['critical', 'major'] },
      { field: 'affectedUnits', operator: 'gt', value: 10 },
    ],
    greyAreaType: 'escalation-needed',
    severity: 'critical',
    titleTemplate: 'Quality issue: {{product}} - {{issue}}',
    descriptionTemplate: '{{severity}} quality issue detected in {{product}}. Issue: {{issue}}. Affected units: {{affectedUnits}}. Production line: {{productionLine}}. Root cause analysis needed.',
    assignToRoles: ['quality-manager', 'production-manager'],
    slaHours: 2,
    priority: 95,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'ops_delivery_delay',
    name: 'Delivery Delay Risk',
    description: 'Flags orders at risk of missing delivery date',
    enabled: true,
    entityTypes: ['task', 'event'],
    conditionLogic: 'and',
    conditions: [
      { field: 'deliveryRiskScore', operator: 'gt', value: 70 },
      { field: 'orderValue', operator: 'gt', value: 5_000_000 }, // 5M UGX
    ],
    greyAreaType: 'risk-identified',
    severity: 'high',
    titleTemplate: 'Delivery at risk: Order {{orderId}}',
    descriptionTemplate: 'Order {{orderId}} for {{customer.name}} is at risk of missing delivery date {{deliveryDate}}. Risk score: {{deliveryRiskScore}}%. Order value: {{orderValue}} UGX. Delay reason: {{delayReason}}.',
    assignToRoles: ['operations-manager', 'project-manager'],
    slaHours: 4,
    priority: 80,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'ops_material_shortage',
    name: 'Material Shortage Alert',
    description: 'Flags materials running below safety stock',
    enabled: true,
    entityTypes: ['event'],
    conditionLogic: 'and',
    conditions: [
      { field: 'stockLevel', operator: 'lt', value: 20 }, // Below 20% of safety stock
      { field: 'hasActiveOrders', operator: 'eq', value: true },
    ],
    greyAreaType: 'risk-identified',
    severity: 'high',
    titleTemplate: 'Material shortage: {{material.name}}',
    descriptionTemplate: '{{material.name}} stock at {{stockLevel}}% of safety level. Active orders requiring this material: {{activeOrderCount}}. Lead time for reorder: {{leadTimeDays}} days.',
    assignToRoles: ['procurement-manager', 'production-manager'],
    slaHours: 8,
    priority: 85,
    createdAt: now(),
    updatedAt: now(),
  },
  
  // ============================================
  // Compliance Grey Areas
  // ============================================
  {
    id: 'comp_missing_docs',
    name: 'Missing Compliance Documents',
    description: 'Flags missing required documents',
    enabled: true,
    entityTypes: ['employee', 'transaction'],
    conditionLogic: 'and',
    conditions: [
      { field: 'missingDocuments', operator: 'gt', value: 0 },
      { field: 'documentsDueInDays', operator: 'lte', value: 30 },
    ],
    greyAreaType: 'compliance-issue',
    severity: 'high',
    titleTemplate: 'Missing compliance documents: {{entityName}}',
    descriptionTemplate: '{{missingDocumentCount}} required documents missing for {{entityName}}. Documents: {{missingDocuments}}. Due date: {{documentsDueDate}}.',
    assignToRoles: ['compliance-officer', 'hr-manager'],
    slaHours: 48,
    priority: 75,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'comp_tax_anomaly',
    name: 'Tax Calculation Anomaly',
    description: 'Flags unusual tax calculation results',
    enabled: true,
    entityTypes: ['transaction'],
    conditionLogic: 'or',
    conditions: [
      { field: 'taxDeviation', operator: 'gt', value: 5 }, // 5% deviation from expected
      { field: 'taxExemptionUsed', operator: 'eq', value: true },
    ],
    greyAreaType: 'data-inconsistency',
    severity: 'medium',
    titleTemplate: 'Tax calculation review needed',
    descriptionTemplate: 'Tax calculation for {{transactionType}} shows {{taxDeviation}}% deviation from expected. Amount: {{amount}} UGX. Calculated tax: {{calculatedTax}} UGX. Expected: {{expectedTax}} UGX.',
    assignToRoles: ['finance-officer', 'tax-accountant'],
    slaHours: 24,
    priority: 70,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'comp_regulatory_deadline',
    name: 'Regulatory Deadline Approaching',
    description: 'Flags upcoming regulatory deadlines',
    enabled: true,
    entityTypes: ['task', 'document'],
    conditionLogic: 'and',
    conditions: [
      { field: 'isRegulatoryDeadline', operator: 'eq', value: true },
      { field: 'daysUntilDeadline', operator: 'lte', value: 14 },
      { field: 'completionPercentage', operator: 'lt', value: 80 },
    ],
    greyAreaType: 'compliance-issue',
    severity: 'critical',
    titleTemplate: 'Regulatory deadline: {{deadlineName}}',
    descriptionTemplate: 'Regulatory deadline "{{deadlineName}}" is due in {{daysUntilDeadline}} days. Current completion: {{completionPercentage}}%. Regulatory body: {{regulatoryBody}}. Penalty risk: {{penaltyRisk}}.',
    assignToRoles: ['compliance-officer', 'cfo'],
    slaHours: 4,
    priority: 100,
    createdAt: now(),
    updatedAt: now(),
  },
  
  // ============================================
  // AI Confidence Grey Areas
  // ============================================
  {
    id: 'ai_low_confidence',
    name: 'AI Low Confidence Decision',
    description: 'Flags AI decisions below confidence threshold',
    enabled: true,
    entityTypes: ['task', 'event', 'transaction'],
    conditionLogic: 'and',
    conditions: [
      { field: 'aiConfidence', operator: 'lt', value: 0.7 },
      { field: 'requiresAiDecision', operator: 'eq', value: true },
    ],
    greyAreaType: 'unclear-requirement',
    severity: 'medium',
    titleTemplate: 'AI uncertain: {{aiDecisionType}}',
    descriptionTemplate: 'AI confidence for {{aiDecisionType}} is {{aiConfidence}}% (below 70% threshold). Input: {{aiInput}}. Suggested action: {{aiSuggestion}}. Human review required.',
    assignToRoles: [], // Will be assigned based on decision type
    slaHours: 8,
    priority: 65,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'ai_conflicting_suggestions',
    name: 'Conflicting AI Suggestions',
    description: 'Flags when AI models give conflicting suggestions',
    enabled: true,
    entityTypes: ['task', 'event'],
    conditionLogic: 'and',
    conditions: [
      { field: 'hasConflictingSuggestions', operator: 'eq', value: true },
    ],
    greyAreaType: 'conflict-resolution',
    severity: 'medium',
    titleTemplate: 'Conflicting AI suggestions for {{entityType}}',
    descriptionTemplate: 'Multiple AI analyses have produced conflicting recommendations. Primary suggestion: {{primarySuggestion}}. Alternative: {{alternativeSuggestion}}. Confidence spread: {{confidenceSpread}}%.',
    assignToRoles: [],
    slaHours: 12,
    priority: 60,
    createdAt: now(),
    updatedAt: now(),
  },
  
  // ============================================
  // Workflow Grey Areas
  // ============================================
  {
    id: 'wf_stalled_approval',
    name: 'Stalled Approval',
    description: 'Flags approvals stuck without action',
    enabled: true,
    entityTypes: ['task', 'request'],
    conditionLogic: 'and',
    conditions: [
      { field: 'status', operator: 'eq', value: 'pending_approval' },
      { field: 'pendingHours', operator: 'gt', value: 48 },
    ],
    greyAreaType: 'escalation-needed',
    severity: 'medium',
    titleTemplate: 'Stalled approval: {{title}}',
    descriptionTemplate: 'Approval for "{{title}}" has been pending for {{pendingHours}} hours. Approver: {{approver.name}}. Original requester: {{requester.name}}. Impact: {{impactDescription}}.',
    assignToRoles: [],
    slaHours: 4,
    priority: 70,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'wf_ownership_unclear',
    name: 'Unclear Task Ownership',
    description: 'Flags tasks with no clear owner or multiple owners',
    enabled: true,
    entityTypes: ['task'],
    conditionLogic: 'or',
    conditions: [
      { field: 'hasNoOwner', operator: 'eq', value: true },
      { field: 'hasMultipleOwners', operator: 'eq', value: true },
    ],
    greyAreaType: 'ownership-gap',
    severity: 'medium',
    titleTemplate: 'Ownership unclear: {{title}}',
    descriptionTemplate: 'Task "{{title}}" has {{ownershipIssue}}. This may cause delays or duplicated effort. Related department: {{department}}. Task priority: {{priority}}.',
    assignToRoles: ['department-head'],
    slaHours: 12,
    priority: 65,
    createdAt: now(),
    updatedAt: now(),
  },
];

/**
 * Get all enabled detection rules
 */
export function getEnabledRules(): DetectionRule[] {
  return DETECTION_RULES.filter(rule => rule.enabled);
}

/**
 * Get rules for specific entity type
 */
export function getRulesForEntityType(
  entityType: 'task' | 'event' | 'employee' | 'transaction' | 'request' | 'document'
): DetectionRule[] {
  return DETECTION_RULES.filter(
    rule => rule.enabled && rule.entityTypes.includes(entityType)
  );
}

/**
 * Get rule by ID
 */
export function getDetectionRule(ruleId: string): DetectionRule | undefined {
  return DETECTION_RULES.find(rule => rule.id === ruleId);
}

/**
 * Get rules by grey area type
 */
export function getRulesByGreyAreaType(type: string): DetectionRule[] {
  return DETECTION_RULES.filter(rule => rule.enabled && rule.greyAreaType === type);
}

/**
 * Get rules by severity
 */
export function getRulesBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): DetectionRule[] {
  return DETECTION_RULES.filter(rule => rule.enabled && rule.severity === severity);
}
