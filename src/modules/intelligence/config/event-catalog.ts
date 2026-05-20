/**
 * Event Catalog - DawinOS v2.0
 * Defines all business events, their schemas, and associated actions
 */

import { EventDefinition } from '../types/business-event.types';
import { EVENT_CATEGORIES } from './constants';

// ============================================
// Customer Events
// ============================================

const customerEvents: EventDefinition[] = [
  {
    eventType: 'customer.inquiry_received',
    name: 'Customer Inquiry Received',
    description: 'A potential customer has submitted an inquiry',
    category: EVENT_CATEGORIES.CUSTOMER,
    source: {
      allowedSources: ['integration', 'user', 'system'],
      allowedModules: ['website', 'crm', 'email'],
    },
    schema: {
      required: ['customerName', 'customerEmail', 'inquiryType', 'subject'],
      properties: {
        customerId: { type: 'string', description: 'Existing customer ID if known' },
        customerName: { type: 'string' },
        customerEmail: { type: 'string' },
        customerPhone: { type: 'string' },
        inquiryType: { type: 'string' },
        subject: { type: 'string' },
        message: { type: 'string' },
        source: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'respond_inquiry',
        title: 'Respond to inquiry from {{payload.customerName}}',
        description: 'Review and respond to customer inquiry: {{payload.subject}}',
        priority: 'P1',
        dueInDays: 1,
        assignTo: {
          type: 'role',
          value: 'sales-rep',
          fallback: {
            type: 'department',
            value: 'business-development',
          },
        },
      },
      {
        taskType: 'create_lead',
        title: 'Create lead for {{payload.customerName}}',
        description: 'Add new lead to CRM from inquiry',
        priority: 'P2',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'sales-admin' },
        conditions: [
          { field: 'customerId', operator: 'exists', value: false },
        ],
      },
    ],
    notifications: [
      {
        channels: ['email', 'in-app'],
        recipients: [
          { type: 'role', value: 'sales-manager' },
          { type: 'role', value: 'sales-rep' },
        ],
        template: 'new_inquiry',
      },
    ],
    retention: { keepDays: 365, archive: true },
    enabled: true,
  },
  {
    eventType: 'customer.quote_requested',
    name: 'Quote Requested',
    description: 'Customer has requested a quotation',
    category: EVENT_CATEGORIES.CUSTOMER,
    source: {
      allowedSources: ['user', 'integration'],
      allowedModules: ['sales', 'website'],
    },
    schema: {
      required: ['quoteId', 'customerId', 'projectDescription'],
      properties: {
        quoteId: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        projectDescription: { type: 'string' },
        estimatedValue: { type: 'number' },
        deadline: { type: 'string' },
        items: { type: 'array' },
      },
    },
    tasks: [
      {
        taskType: 'prepare_quote',
        title: 'Prepare quote for {{payload.customerName}}',
        description: 'Prepare detailed quotation: {{payload.projectDescription}}',
        priority: 'P1',
        dueInDays: 3,
        assignTo: {
          type: 'role',
          value: 'estimator',
          fallback: { type: 'role', value: 'project-manager' },
        },
      },
      {
        taskType: 'review_quote',
        title: 'Review quote for {{payload.customerName}}',
        description: 'Review and approve quote before sending to customer',
        priority: 'P2',
        dueInDays: 4,
        assignTo: { type: 'role', value: 'sales-manager' },
        conditions: [
          { field: 'estimatedValue', operator: 'gt', value: 10000000 }, // > 10M UGX
        ],
      },
    ],
    notifications: [
      {
        channels: ['email', 'in-app'],
        recipients: [{ type: 'role', value: 'estimator' }],
        template: 'quote_request',
      },
    ],
    retention: { keepDays: 730, archive: true },
    enabled: true,
  },
  {
    eventType: 'customer.order_placed',
    name: 'Order Placed',
    description: 'Customer has placed an order',
    category: EVENT_CATEGORIES.CUSTOMER,
    source: {
      allowedSources: ['user', 'integration'],
      allowedModules: ['sales', 'orders'],
    },
    schema: {
      required: ['orderId', 'customerId', 'orderValue', 'items'],
      properties: {
        orderId: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        orderValue: { type: 'number' },
        currency: { type: 'string' },
        items: { type: 'array' },
        deliveryAddress: { type: 'string' },
        deliveryDate: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'confirm_order',
        title: 'Confirm order {{payload.orderId}} with {{payload.customerName}}',
        priority: 'P1',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'order-coordinator' },
      },
      {
        taskType: 'create_invoice',
        title: 'Create invoice for order {{payload.orderId}}',
        priority: 'P1',
        dueInDays: 1,
        assignTo: { type: 'department', value: 'finance' },
      },
      {
        taskType: 'schedule_production',
        title: 'Schedule production for order {{payload.orderId}}',
        priority: 'P1',
        dueInDays: 2,
        assignTo: { type: 'role', value: 'production-planner' },
      },
    ],
    notifications: [
      {
        channels: ['email', 'sms'],
        recipients: [
          { type: 'role', value: 'order-coordinator' },
          { type: 'role', value: 'production-manager' },
        ],
        template: 'new_order',
      },
    ],
    retention: { keepDays: 1095, archive: true },
    enabled: true,
  },
];

// ============================================
// Financial Events
// ============================================

const financialEvents: EventDefinition[] = [
  {
    eventType: 'financial.payment_received',
    name: 'Payment Received',
    description: 'Payment has been received from a customer',
    category: EVENT_CATEGORIES.FINANCIAL,
    source: {
      allowedSources: ['integration', 'user'],
      allowedModules: ['finance', 'banking'],
    },
    schema: {
      required: ['paymentId', 'customerId', 'amount', 'currency'],
      properties: {
        paymentId: { type: 'string' },
        invoiceId: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        amount: { type: 'number' },
        currency: { type: 'string' },
        paymentMethod: { type: 'string' },
        reference: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'reconcile_payment',
        title: 'Reconcile payment {{payload.reference}}',
        description: 'Match payment to invoice and update records',
        priority: 'P2',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'accountant' },
      },
      {
        taskType: 'send_receipt',
        title: 'Send receipt to {{payload.customerName}}',
        priority: 'P2',
        dueInDays: 1,
        assignTo: { type: 'department', value: 'finance' },
      },
    ],
    notifications: [
      {
        channels: ['in-app'],
        recipients: [{ type: 'role', value: 'finance-manager' }],
        template: 'payment_received',
      },
    ],
    retention: { keepDays: 2555, archive: true }, // 7 years
    enabled: true,
  },
  {
    eventType: 'financial.invoice_overdue',
    name: 'Invoice Overdue',
    description: 'An invoice has passed its due date without full payment',
    category: EVENT_CATEGORIES.FINANCIAL,
    source: {
      allowedSources: ['system', 'schedule'],
      allowedModules: ['finance'],
    },
    schema: {
      required: ['invoiceId', 'customerId', 'outstandingAmount', 'daysOverdue'],
      properties: {
        invoiceId: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        invoiceAmount: { type: 'number' },
        paidAmount: { type: 'number' },
        outstandingAmount: { type: 'number' },
        currency: { type: 'string' },
        dueDate: { type: 'string' },
        daysOverdue: { type: 'number' },
        previousReminders: { type: 'number' },
      },
    },
    tasks: [
      {
        taskType: 'send_reminder',
        title: 'Send payment reminder to {{payload.customerName}}',
        description: 'Invoice {{payload.invoiceId}} is {{payload.daysOverdue}} days overdue',
        priority: 'P1',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'credit-controller' },
        conditions: [
          { field: 'daysOverdue', operator: 'lte', value: 30 },
        ],
      },
      {
        taskType: 'escalate_debt',
        title: 'Escalate overdue account: {{payload.customerName}}',
        description: 'Invoice {{payload.invoiceId}} is {{payload.daysOverdue}} days overdue - escalate',
        priority: 'P0',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'finance-manager' },
        conditions: [
          { field: 'daysOverdue', operator: 'gt', value: 30 },
        ],
      },
    ],
    notifications: [
      {
        channels: ['email', 'in-app'],
        recipients: [
          { type: 'role', value: 'credit-controller' },
          { type: 'role', value: 'finance-manager' },
        ],
        template: 'invoice_overdue',
      },
    ],
    retention: { keepDays: 2555, archive: true },
    enabled: true,
  },
  {
    eventType: 'financial.budget_exceeded',
    name: 'Budget Exceeded',
    description: 'A budget threshold has been exceeded',
    category: EVENT_CATEGORIES.FINANCIAL,
    source: {
      allowedSources: ['system'],
      allowedModules: ['finance'],
    },
    schema: {
      required: ['budgetId', 'budgetAmount', 'spentAmount', 'departmentId'],
      properties: {
        budgetId: { type: 'string' },
        budgetName: { type: 'string' },
        budgetAmount: { type: 'number' },
        spentAmount: { type: 'number' },
        exceededBy: { type: 'number' },
        exceededByPercent: { type: 'number' },
        currency: { type: 'string' },
        period: { type: 'string' },
        departmentId: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'review_budget_variance',
        title: 'Review budget variance: {{payload.budgetName}}',
        description: 'Budget exceeded by {{payload.exceededByPercent}}%',
        priority: 'P1',
        dueInDays: 2,
        assignTo: { type: 'role', value: 'department-head' },
      },
      {
        taskType: 'approve_budget_increase',
        title: 'Approve budget increase for {{payload.budgetName}}',
        priority: 'P1',
        dueInDays: 3,
        assignTo: { type: 'role', value: 'finance-manager' },
        conditions: [
          { field: 'exceededByPercent', operator: 'gt', value: 10 },
        ],
      },
    ],
    notifications: [
      {
        channels: ['email', 'in-app', 'push'],
        recipients: [
          { type: 'role', value: 'finance-manager' },
          { type: 'department' },
        ],
        template: 'budget_exceeded',
      },
    ],
    retention: { keepDays: 1825, archive: true },
    enabled: true,
  },
];

// ============================================
// HR Events
// ============================================

const hrEvents: EventDefinition[] = [
  {
    eventType: 'hr.leave_requested',
    name: 'Leave Requested',
    description: 'An employee has requested leave',
    category: EVENT_CATEGORIES.HR,
    source: {
      allowedSources: ['user'],
      allowedModules: ['hr'],
    },
    schema: {
      required: ['requestId', 'employeeId', 'leaveType', 'startDate', 'endDate', 'days'],
      properties: {
        requestId: { type: 'string' },
        employeeId: { type: 'string' },
        employeeName: { type: 'string' },
        leaveType: { type: 'string' },
        startDate: { type: 'string' },
        endDate: { type: 'string' },
        days: { type: 'number' },
        reason: { type: 'string' },
        managerId: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'approve_leave',
        title: 'Approve leave request from {{payload.employeeName}}',
        description: '{{payload.days}} days {{payload.leaveType}} from {{payload.startDate}}',
        priority: 'P2',
        dueInDays: 2,
        assignTo: { type: 'manager' },
      },
    ],
    notifications: [
      {
        channels: ['email', 'in-app'],
        recipients: [{ type: 'manager' }],
        template: 'leave_request',
      },
    ],
    retention: { keepDays: 730, archive: true },
    enabled: true,
  },
  {
    eventType: 'hr.contract_expiring',
    name: 'Contract Expiring',
    description: 'An employment contract is approaching expiry',
    category: EVENT_CATEGORIES.HR,
    source: {
      allowedSources: ['system', 'schedule'],
      allowedModules: ['hr'],
    },
    schema: {
      required: ['contractId', 'employeeId', 'expiryDate', 'daysUntilExpiry'],
      properties: {
        contractId: { type: 'string' },
        employeeId: { type: 'string' },
        employeeName: { type: 'string' },
        contractType: { type: 'string' },
        expiryDate: { type: 'string' },
        daysUntilExpiry: { type: 'number' },
        managerId: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'review_contract_renewal',
        title: 'Review contract renewal for {{payload.employeeName}}',
        description: 'Contract expires in {{payload.daysUntilExpiry}} days',
        priority: 'P1',
        dueInDays: 7,
        assignTo: { type: 'manager' },
        conditions: [
          { field: 'daysUntilExpiry', operator: 'lte', value: 30 },
        ],
      },
      {
        taskType: 'prepare_renewal',
        title: 'Prepare contract renewal for {{payload.employeeName}}',
        priority: 'P2',
        dueInDays: 14,
        assignTo: { type: 'role', value: 'hr-manager' },
      },
    ],
    notifications: [
      {
        channels: ['email', 'in-app'],
        recipients: [
          { type: 'manager' },
          { type: 'role', value: 'hr-manager' },
        ],
        template: 'contract_expiring',
      },
    ],
    retention: { keepDays: 365, archive: true },
    enabled: true,
  },
  {
    eventType: 'hr.performance_review_due',
    name: 'Performance Review Due',
    description: 'A performance review is due for an employee',
    category: EVENT_CATEGORIES.HR,
    source: {
      allowedSources: ['system', 'schedule'],
      allowedModules: ['hr'],
    },
    schema: {
      required: ['employeeId', 'reviewType', 'dueDate', 'reviewerId'],
      properties: {
        employeeId: { type: 'string' },
        employeeName: { type: 'string' },
        reviewType: { type: 'string' },
        dueDate: { type: 'string' },
        lastReviewDate: { type: 'string' },
        reviewerId: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'conduct_review',
        title: 'Conduct {{payload.reviewType}} review for {{payload.employeeName}}',
        priority: 'P2',
        dueInDays: 7,
        assignTo: { type: 'user', value: '{{payload.reviewerId}}' },
      },
      {
        taskType: 'self_assessment',
        title: 'Complete self-assessment for {{payload.reviewType}} review',
        priority: 'P2',
        dueInDays: 5,
        assignTo: { type: 'user', value: '{{payload.employeeId}}' },
      },
    ],
    notifications: [
      {
        channels: ['email', 'in-app'],
        recipients: [
          { type: 'user', value: 'reviewerId' },
          { type: 'user', value: 'employeeId' },
        ],
        template: 'performance_review_due',
      },
    ],
    retention: { keepDays: 365, archive: true },
    enabled: true,
  },
];

// ============================================
// Production Events (Finishes)
// ============================================

const productionEvents: EventDefinition[] = [
  {
    eventType: 'production.job_started',
    name: 'Job Started',
    description: 'Production job has been initiated',
    category: EVENT_CATEGORIES.PRODUCTION,
    source: {
      allowedSources: ['user'],
      allowedModules: ['production', 'projects'],
    },
    schema: {
      required: ['jobId', 'projectId', 'startDate'],
      properties: {
        jobId: { type: 'string' },
        projectId: { type: 'string' },
        projectName: { type: 'string' },
        customerId: { type: 'string' },
        startDate: { type: 'string' },
        estimatedEndDate: { type: 'string' },
        assignedTeam: { type: 'array' },
        materials: { type: 'array' },
      },
    },
    tasks: [
      {
        taskType: 'verify_materials',
        title: 'Verify materials for {{payload.projectName}}',
        priority: 'P1',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'store-manager' },
      },
      {
        taskType: 'update_customer',
        title: 'Notify customer of job start: {{payload.projectName}}',
        priority: 'P2',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'project-coordinator' },
      },
    ],
    notifications: [
      {
        channels: ['in-app', 'push'],
        recipients: [{ type: 'role', value: 'production-manager' }],
        template: 'job_started',
      },
    ],
    retention: { keepDays: 365, archive: true },
    enabled: true,
  },
  {
    eventType: 'production.milestone_reached',
    name: 'Milestone Reached',
    description: 'A project milestone has been completed',
    category: EVENT_CATEGORIES.PRODUCTION,
    source: {
      allowedSources: ['user', 'system'],
      allowedModules: ['production', 'projects'],
    },
    schema: {
      required: ['projectId', 'milestoneId', 'milestoneName', 'completedAt'],
      properties: {
        projectId: { type: 'string' },
        projectName: { type: 'string' },
        milestoneId: { type: 'string' },
        milestoneName: { type: 'string' },
        completedAt: { type: 'string' },
        completedBy: { type: 'string' },
        nextMilestone: { type: 'object' },
      },
    },
    tasks: [
      {
        taskType: 'update_customer_milestone',
        title: 'Update customer on milestone: {{payload.milestoneName}}',
        priority: 'P2',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'project-coordinator' },
      },
    ],
    notifications: [
      {
        channels: ['in-app'],
        recipients: [
          { type: 'role', value: 'project-manager' },
          { type: 'creator' },
        ],
        template: 'milestone_reached',
      },
    ],
    retention: { keepDays: 365, archive: true },
    enabled: true,
  },
  {
    eventType: 'production.quality_issue',
    name: 'Quality Issue Detected',
    description: 'A quality issue has been identified during production',
    category: EVENT_CATEGORIES.PRODUCTION,
    source: {
      allowedSources: ['user'],
      allowedModules: ['production', 'quality'],
    },
    schema: {
      required: ['issueId', 'projectId', 'issueType', 'severity', 'description'],
      properties: {
        issueId: { type: 'string' },
        projectId: { type: 'string' },
        projectName: { type: 'string' },
        issueType: { type: 'string' },
        severity: { type: 'string' },
        description: { type: 'string' },
        detectedBy: { type: 'string' },
        location: { type: 'string' },
        photos: { type: 'array' },
      },
    },
    tasks: [
      {
        taskType: 'investigate_issue',
        title: 'Investigate quality issue on {{payload.projectName}}',
        description: '{{payload.severity}} {{payload.issueType}}: {{payload.description}}',
        priority: 'P0',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'quality-manager' },
        conditions: [
          { field: 'severity', operator: 'in', value: ['critical', 'major'] },
        ],
      },
      {
        taskType: 'resolve_issue',
        title: 'Resolve quality issue on {{payload.projectName}}',
        priority: 'P1',
        dueInDays: 2,
        assignTo: { type: 'role', value: 'production-supervisor' },
      },
    ],
    notifications: [
      {
        channels: ['email', 'in-app', 'push'],
        recipients: [
          { type: 'role', value: 'quality-manager' },
          { type: 'role', value: 'production-manager' },
        ],
        template: 'quality_issue',
      },
    ],
    retention: { keepDays: 1095, archive: true },
    enabled: true,
  },
];

// ============================================
// Dawin Finishes Events
// ============================================

const finishesEvents: EventDefinition[] = [
  // ----------------------------------------
  // Design Manager Events
  // ----------------------------------------
  {
    eventType: 'finishes.design_item_created',
    name: 'Design Item Created',
    description: 'A new design item has been added to a project',
    category: EVENT_CATEGORIES.PRODUCTION,
    source: {
      allowedSources: ['user', 'integration'],
      allowedModules: ['design_manager'],
    },
    schema: {
      required: ['projectId', 'designItemId', 'itemName', 'category'],
      properties: {
        projectId: { type: 'string' },
        projectCode: { type: 'string' },
        projectName: { type: 'string' },
        designItemId: { type: 'string' },
        itemName: { type: 'string' },
        itemCode: { type: 'string' },
        category: { type: 'string' },
        initialStage: { type: 'string' },
        createdBy: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'review_new_design_item',
        title: 'Review new design item: {{payload.itemName}}',
        description: 'Review and set initial RAG status for {{payload.itemName}} in project {{payload.projectCode}}',
        priority: 'P2',
        dueInDays: 2,
        assignTo: {
          type: 'role',
          value: 'designer',
          fallback: { type: 'role', value: 'design-manager' },
        },
      },
      {
        taskType: 'assign_design_ownership',
        title: 'Assign design ownership for {{payload.itemName}}',
        description: 'Assign a designer to take ownership of {{payload.itemName}}',
        priority: 'P1',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'design-manager' },
      },
    ],
    notifications: [
      {
        channels: ['in-app'],
        recipients: [
          { type: 'role', value: 'design-manager' },
          { type: 'role', value: 'project-manager' },
        ],
        template: 'new_design_item',
      },
    ],
    retention: { keepDays: 365, archive: true },
    enabled: true,
  },
  {
    eventType: 'finishes.design_stage_changed',
    name: 'Design Stage Changed',
    description: 'A design item has moved to a new workflow stage',
    category: EVENT_CATEGORIES.PRODUCTION,
    source: {
      allowedSources: ['user', 'system'],
      allowedModules: ['design_manager'],
    },
    schema: {
      required: ['projectId', 'designItemId', 'itemName', 'previousStage', 'newStage'],
      properties: {
        projectId: { type: 'string' },
        projectCode: { type: 'string' },
        designItemId: { type: 'string' },
        itemName: { type: 'string' },
        itemCode: { type: 'string' },
        previousStage: { type: 'string' },
        newStage: { type: 'string' },
        changedBy: { type: 'string' },
        notes: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'complete_stage_requirements',
        title: 'Complete {{payload.newStage}} requirements for {{payload.itemName}}',
        description: 'Ensure all {{payload.newStage}} stage deliverables are complete',
        priority: 'P1',
        dueInDays: 5,
        assignTo: { type: 'role', value: 'designer' },
        conditions: [
          { field: 'newStage', operator: 'in', value: ['preliminary', 'technical', 'pre-production'] },
        ],
      },
      {
        taskType: 'validate_manufacturing_readiness',
        title: 'Validate manufacturing readiness for {{payload.itemName}}',
        description: 'Verify all manufacturing requirements are met before production',
        priority: 'P0',
        dueInDays: 2,
        assignTo: { type: 'role', value: 'production-planner' },
        conditions: [
          { field: 'newStage', operator: 'eq', value: 'production-ready' },
        ],
      },
      {
        taskType: 'initiate_procurement',
        title: 'Initiate procurement for {{payload.itemName}}',
        description: 'Start procurement process for item entering procurement workflow',
        priority: 'P1',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'procurement-coordinator' },
        conditions: [
          { field: 'newStage', operator: 'eq', value: 'procure-identify' },
        ],
      },
    ],
    notifications: [
      {
        channels: ['in-app'],
        recipients: [
          { type: 'role', value: 'project-manager' },
          { type: 'creator' },
        ],
        template: 'design_stage_changed',
      },
    ],
    retention: { keepDays: 365, archive: true },
    enabled: true,
  },
  {
    eventType: 'finishes.design_approval_requested',
    name: 'Design Approval Requested',
    description: 'An approval has been requested for a design item',
    category: EVENT_CATEGORIES.PRODUCTION,
    source: {
      allowedSources: ['user'],
      allowedModules: ['design_manager'],
    },
    schema: {
      required: ['projectId', 'designItemId', 'itemName', 'approvalType', 'requestedBy'],
      properties: {
        projectId: { type: 'string' },
        projectCode: { type: 'string' },
        designItemId: { type: 'string' },
        itemName: { type: 'string' },
        approvalType: { type: 'string' }, // 'internal_review', 'client_approval', 'manufacturing_review'
        requestedBy: { type: 'string' },
        requestedByName: { type: 'string' },
        deadline: { type: 'string' },
        notes: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'approve_design_internal',
        title: 'Review design approval request: {{payload.itemName}}',
        description: 'Review and approve internal design for {{payload.itemName}}',
        priority: 'P1',
        dueInDays: 2,
        assignTo: { type: 'role', value: 'design-manager' },
        conditions: [
          { field: 'approvalType', operator: 'eq', value: 'internal_review' },
        ],
      },
      {
        taskType: 'approve_design_manufacturing',
        title: 'Manufacturing review for {{payload.itemName}}',
        description: 'Review design from manufacturing perspective',
        priority: 'P1',
        dueInDays: 2,
        assignTo: { type: 'role', value: 'production-manager' },
        conditions: [
          { field: 'approvalType', operator: 'eq', value: 'manufacturing_review' },
        ],
      },
      {
        taskType: 'obtain_client_approval',
        title: 'Obtain client approval for {{payload.itemName}}',
        description: 'Present design to client and obtain approval',
        priority: 'P1',
        dueInDays: 3,
        assignTo: { type: 'role', value: 'project-coordinator' },
        conditions: [
          { field: 'approvalType', operator: 'eq', value: 'client_approval' },
        ],
      },
    ],
    notifications: [
      {
        channels: ['email', 'in-app'],
        recipients: [
          { type: 'role', value: 'design-manager' },
        ],
        template: 'design_approval_requested',
      },
    ],
    retention: { keepDays: 730, archive: true },
    enabled: true,
  },
  {
    eventType: 'finishes.rag_status_critical',
    name: 'RAG Status Critical',
    description: 'A design item has critical (red) RAG status requiring attention',
    category: EVENT_CATEGORIES.PRODUCTION,
    source: {
      allowedSources: ['user', 'system'],
      allowedModules: ['design_manager'],
    },
    schema: {
      required: ['projectId', 'designItemId', 'itemName', 'category', 'aspect', 'previousStatus', 'newStatus'],
      properties: {
        projectId: { type: 'string' },
        projectCode: { type: 'string' },
        designItemId: { type: 'string' },
        itemName: { type: 'string' },
        category: { type: 'string' }, // 'designCompleteness', 'manufacturingReadiness', 'qualityGates'
        aspect: { type: 'string' },
        previousStatus: { type: 'string' },
        newStatus: { type: 'string' },
        notes: { type: 'string' },
        changedBy: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'resolve_design_issue',
        title: 'Resolve {{payload.aspect}} issue on {{payload.itemName}}',
        description: 'Address critical design issue: {{payload.notes}}',
        priority: 'P0',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'designer' },
        conditions: [
          { field: 'category', operator: 'eq', value: 'designCompleteness' },
        ],
      },
      {
        taskType: 'resolve_manufacturing_issue',
        title: 'Resolve {{payload.aspect}} manufacturing issue on {{payload.itemName}}',
        description: 'Address manufacturing readiness issue: {{payload.notes}}',
        priority: 'P0',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'production-planner' },
        conditions: [
          { field: 'category', operator: 'eq', value: 'manufacturingReadiness' },
        ],
      },
      {
        taskType: 'escalate_quality_issue',
        title: 'Escalate quality gate issue on {{payload.itemName}}',
        description: 'Quality gate {{payload.aspect}} is critical and needs escalation',
        priority: 'P0',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'quality-manager' },
        conditions: [
          { field: 'category', operator: 'eq', value: 'qualityGates' },
        ],
      },
    ],
    notifications: [
      {
        channels: ['email', 'in-app', 'push'],
        recipients: [
          { type: 'role', value: 'project-manager' },
          { type: 'role', value: 'design-manager' },
        ],
        template: 'rag_status_critical',
      },
    ],
    retention: { keepDays: 365, archive: true },
    enabled: true,
  },
  {
    eventType: 'finishes.design_production_ready',
    name: 'Design Production Ready',
    description: 'A design item is fully approved and ready for manufacturing',
    category: EVENT_CATEGORIES.PRODUCTION,
    source: {
      allowedSources: ['user', 'system'],
      allowedModules: ['design_manager'],
    },
    schema: {
      required: ['projectId', 'designItemId', 'itemName', 'itemCode'],
      properties: {
        projectId: { type: 'string' },
        projectCode: { type: 'string' },
        designItemId: { type: 'string' },
        itemName: { type: 'string' },
        itemCode: { type: 'string' },
        category: { type: 'string' },
        overallReadiness: { type: 'number' },
        approvedBy: { type: 'string' },
        approvedByName: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'schedule_production',
        title: 'Schedule production for {{payload.itemName}}',
        description: 'Add {{payload.itemCode}} to production schedule',
        priority: 'P1',
        dueInDays: 2,
        assignTo: { type: 'role', value: 'production-planner' },
      },
      {
        taskType: 'prepare_materials',
        title: 'Prepare materials for {{payload.itemName}}',
        description: 'Verify and stage materials for {{payload.itemCode}}',
        priority: 'P1',
        dueInDays: 3,
        assignTo: { type: 'role', value: 'store-manager' },
      },
      {
        taskType: 'create_work_order',
        title: 'Create work order for {{payload.itemName}}',
        description: 'Generate CNC programs and work instructions for {{payload.itemCode}}',
        priority: 'P1',
        dueInDays: 2,
        assignTo: { type: 'role', value: 'cnc-programmer' },
      },
    ],
    notifications: [
      {
        channels: ['in-app', 'push'],
        recipients: [
          { type: 'role', value: 'production-manager' },
          { type: 'role', value: 'store-manager' },
        ],
        template: 'design_production_ready',
      },
    ],
    retention: { keepDays: 365, archive: true },
    enabled: true,
  },

  // ----------------------------------------
  // Interior Design & Custom Furniture Events
  // ----------------------------------------
  {
    eventType: 'finishes.client_consultation_scheduled',
    name: 'Client Consultation Scheduled',
    description: 'A design consultation has been scheduled with a client',
    category: EVENT_CATEGORIES.CUSTOMER,
    source: {
      allowedSources: ['user', 'integration'],
      allowedModules: ['design_manager', 'customer_hub'],
    },
    schema: {
      required: ['consultationId', 'projectId', 'customerId', 'consultationDate'],
      properties: {
        consultationId: { type: 'string' },
        projectId: { type: 'string' },
        projectName: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        consultationDate: { type: 'string' },
        consultationType: { type: 'string' }, // 'initial', 'follow-up', 'material-review', 'final'
        designerId: { type: 'string' },
        location: { type: 'string' },
        scope: { type: 'string' },
        budgetEstimate: { type: 'number' },
      },
    },
    tasks: [
      {
        taskType: 'prepare_consultation',
        title: 'Prepare consultation for {{payload.customerName}}',
        description: 'Prepare materials and concepts for {{payload.consultationType}} consultation',
        priority: 'P1',
        dueInDays: 2,
        assignTo: {
          type: 'role',
          value: 'interior-designer',
          fallback: { type: 'role', value: 'designer' },
        },
      },
      {
        taskType: 'send_consultation_details',
        title: 'Send consultation details to {{payload.customerName}}',
        description: 'Confirm date, location, and agenda with client',
        priority: 'P2',
        dueInDays: 1,
        assignTo: {
          type: 'role',
          value: 'client-liaison',
          fallback: { type: 'role', value: 'project-coordinator' },
        },
      },
    ],
    notifications: [
      {
        channels: ['email', 'in-app'],
        recipients: [
          { type: 'role', value: 'interior-designer' },
          { type: 'role', value: 'client-liaison' },
        ],
        template: 'consultation_scheduled',
      },
    ],
    retention: { keepDays: 365, archive: true },
    enabled: true,
  },
  {
    eventType: 'finishes.space_planning_requested',
    name: 'Space Planning Requested',
    description: 'Space planning analysis has been requested for a project',
    category: EVENT_CATEGORIES.PRODUCTION,
    source: {
      allowedSources: ['user'],
      allowedModules: ['design_manager'],
    },
    schema: {
      required: ['projectId', 'spaceType', 'dimensions'],
      properties: {
        projectId: { type: 'string' },
        projectName: { type: 'string' },
        spaceType: { type: 'string' }, // 'living', 'kitchen', 'bedroom', 'office', 'retail'
        dimensions: { type: 'object' }, // { length, width, height }
        constraints: { type: 'array' },  // existing features, doors, windows
        functionalRequirements: { type: 'array' },
        requestedBy: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'analyze_space',
        title: 'Analyze space for {{payload.projectName}}',
        description: 'Evaluate {{payload.spaceType}} constraints and functional requirements',
        priority: 'P1',
        dueInDays: 3,
        assignTo: {
          type: 'role',
          value: 'space-planner',
          fallback: { type: 'role', value: 'designer' },
        },
      },
    ],
    notifications: [
      {
        channels: ['in-app'],
        recipients: [{ type: 'role', value: 'space-planner' }],
        template: 'space_planning_requested',
      },
    ],
    retention: { keepDays: 730, archive: true },
    enabled: true,
  },
  {
    eventType: 'finishes.design_concepts_created',
    name: 'Design Concepts Created',
    description: 'Initial design concepts have been created for client review',
    category: EVENT_CATEGORIES.PRODUCTION,
    source: {
      allowedSources: ['user'],
      allowedModules: ['design_manager'],
    },
    schema: {
      required: ['projectId', 'conceptCount'],
      properties: {
        projectId: { type: 'string' },
        projectName: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        conceptCount: { type: 'number' },
        designerId: { type: 'string' },
        presentationDate: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'prepare_presentation',
        title: 'Prepare design presentation for {{payload.customerName}}',
        description: 'Create presentation materials for {{payload.conceptCount}} design concepts',
        priority: 'P1',
        dueInDays: 2,
        assignTo: { type: 'role', value: 'interior-designer' },
      },
      {
        taskType: 'schedule_presentation',
        title: 'Schedule design presentation with {{payload.customerName}}',
        priority: 'P2',
        dueInDays: 1,
        assignTo: {
          type: 'role',
          value: 'client-liaison',
          fallback: { type: 'role', value: 'project-coordinator' },
        },
      },
    ],
    notifications: [
      {
        channels: ['email', 'in-app'],
        recipients: [
          { type: 'role', value: 'interior-designer' },
          { type: 'role', value: 'design-manager' },
        ],
        template: 'concepts_created',
      },
    ],
    retention: { keepDays: 730, archive: true },
    enabled: true,
  },
  {
    eventType: 'finishes.client_feedback_received',
    name: 'Client Feedback Received',
    description: 'Client has provided feedback on design concepts or revisions',
    category: EVENT_CATEGORIES.CUSTOMER,
    source: {
      allowedSources: ['user', 'integration'],
      allowedModules: ['design_manager'],
    },
    schema: {
      required: ['projectId', 'feedbackType', 'feedbackSummary'],
      properties: {
        projectId: { type: 'string' },
        projectName: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        feedbackType: { type: 'string' }, // 'approval', 'revision-requested', 'rejected'
        feedbackSummary: { type: 'string' },
        designItemsAffected: { type: 'array' },
        urgency: { type: 'string' }, // 'low', 'medium', 'high'
      },
    },
    tasks: [
      {
        taskType: 'review_feedback',
        title: 'Review client feedback for {{payload.projectName}}',
        description: 'Analyze feedback and determine revision approach',
        priority: 'P1',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'interior-designer' },
        conditions: [
          { field: 'feedbackType', operator: 'eq', value: 'revision-requested' },
        ],
      },
      {
        taskType: 'implement_revisions',
        title: 'Implement design revisions for {{payload.projectName}}',
        priority: 'P0',
        dueInDays: 3,
        assignTo: { type: 'role', value: 'designer' },
        conditions: [
          { field: 'feedbackType', operator: 'eq', value: 'revision-requested' },
          { field: 'urgency', operator: 'eq', value: 'high' },
        ],
      },
    ],
    notifications: [
      {
        channels: ['email', 'in-app', 'push'],
        recipients: [
          { type: 'role', value: 'interior-designer' },
          { type: 'role', value: 'design-manager' },
        ],
        template: 'client_feedback',
      },
    ],
    retention: { keepDays: 730, archive: true },
    enabled: true,
  },
  {
    eventType: 'finishes.material_samples_requested',
    name: 'Material Samples Requested',
    description: 'Material samples have been requested for client review',
    category: EVENT_CATEGORIES.PRODUCTION,
    source: {
      allowedSources: ['user'],
      allowedModules: ['design_manager'],
    },
    schema: {
      required: ['projectId', 'materialCategories'],
      properties: {
        projectId: { type: 'string' },
        projectName: { type: 'string' },
        customerId: { type: 'string' },
        materialCategories: { type: 'array' }, // ['wood', 'fabric', 'hardware', 'finish']
        sampleCount: { type: 'number' },
        deliveryAddress: { type: 'string' },
        requiredByDate: { type: 'string' },
        requestedBy: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'source_samples',
        title: 'Source material samples for {{payload.projectName}}',
        description: 'Obtain {{payload.sampleCount}} samples from suppliers',
        priority: 'P1',
        dueInDays: 5,
        assignTo: {
          type: 'role',
          value: 'material-specialist',
          fallback: { type: 'role', value: 'procurement-coordinator' },
        },
      },
      {
        taskType: 'coordinate_delivery',
        title: 'Coordinate sample delivery for {{payload.projectName}}',
        priority: 'P2',
        dueInDays: 2,
        assignTo: { type: 'role', value: 'material-specialist' },
      },
    ],
    notifications: [
      {
        channels: ['in-app'],
        recipients: [{ type: 'role', value: 'material-specialist' }],
        template: 'samples_requested',
      },
    ],
    retention: { keepDays: 365, archive: true },
    enabled: true,
  },
  {
    eventType: 'finishes.material_specification_needed',
    name: 'Material Specification Needed',
    description: 'Detailed material specifications required for design item',
    category: EVENT_CATEGORIES.PRODUCTION,
    source: {
      allowedSources: ['user', 'system'],
      allowedModules: ['design_manager'],
    },
    schema: {
      required: ['designItemId', 'materialType'],
      properties: {
        designItemId: { type: 'string' },
        designItemName: { type: 'string' },
        projectId: { type: 'string' },
        materialType: { type: 'string' }, // 'primary', 'secondary', 'hardware', 'finish'
        urgency: { type: 'string' },
        budgetConstraint: { type: 'number' },
      },
    },
    tasks: [
      {
        taskType: 'specify_materials',
        title: 'Specify materials for {{payload.designItemName}}',
        priority: 'P1',
        dueInDays: 3,
        assignTo: {
          type: 'role',
          value: 'material-specialist',
          fallback: { type: 'role', value: 'designer' },
        },
      },
    ],
    notifications: [
      {
        channels: ['in-app'],
        recipients: [{ type: 'role', value: 'material-specialist' }],
        template: 'material_spec_needed',
      },
    ],
    retention: { keepDays: 730, archive: true },
    enabled: true,
  },
  {
    eventType: 'finishes.upholstery_specification_required',
    name: 'Upholstery Specification Required',
    description: 'Upholstery specifications needed for custom furniture',
    category: EVENT_CATEGORIES.PRODUCTION,
    source: {
      allowedSources: ['user'],
      allowedModules: ['design_manager'],
    },
    schema: {
      required: ['designItemId', 'itemName', 'projectId'],
      properties: {
        designItemId: { type: 'string' },
        itemName: { type: 'string' },
        projectId: { type: 'string' },
        projectName: { type: 'string' },
        furnitureType: { type: 'string' },
        fabricType: { type: 'string' },
        requestedBy: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'specify_upholstery',
        title: 'Specify upholstery for {{payload.itemName}}',
        description: 'Define fabric, foam, and construction details',
        priority: 'P1',
        dueInDays: 3,
        assignTo: {
          type: 'role',
          value: 'material-specialist',
          fallback: { type: 'role', value: 'designer' },
        },
      },
    ],
    notifications: [
      {
        channels: ['in-app'],
        recipients: [{ type: 'role', value: 'material-specialist' }],
        template: 'upholstery_spec_required',
      },
    ],
    retention: { keepDays: 730, archive: true },
    enabled: true,
  },
  {
    eventType: 'finishes.hardware_selection_required',
    name: 'Hardware Selection Required',
    description: 'Hardware and fittings selection needed for furniture',
    category: EVENT_CATEGORIES.PRODUCTION,
    source: {
      allowedSources: ['user'],
      allowedModules: ['design_manager'],
    },
    schema: {
      required: ['designItemId', 'itemName', 'hardwareTypes'],
      properties: {
        designItemId: { type: 'string' },
        itemName: { type: 'string' },
        projectId: { type: 'string' },
        hardwareTypes: { type: 'array' }, // ['hinges', 'handles', 'slides', 'locks']
        quantity: { type: 'number' },
        requestedBy: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'select_hardware',
        title: 'Select hardware for {{payload.itemName}}',
        description: 'Choose appropriate hardware and fittings',
        priority: 'P2',
        dueInDays: 3,
        assignTo: {
          type: 'role',
          value: 'material-specialist',
          fallback: { type: 'role', value: 'designer' },
        },
      },
    ],
    notifications: [
      {
        channels: ['in-app'],
        recipients: [{ type: 'role', value: 'material-specialist' }],
        template: 'hardware_selection_required',
      },
    ],
    retention: { keepDays: 730, archive: true },
    enabled: true,
  },
  {
    eventType: 'finishes.installation_scheduled',
    name: 'Installation Scheduled',
    description: 'Installation date has been set for project',
    category: EVENT_CATEGORIES.PRODUCTION,
    source: {
      allowedSources: ['user'],
      allowedModules: ['design_manager', 'projects'],
    },
    schema: {
      required: ['projectId', 'installationDate', 'location'],
      properties: {
        projectId: { type: 'string' },
        projectName: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        installationDate: { type: 'string' },
        location: { type: 'string' },
        estimatedDuration: { type: 'number' },
        teamSize: { type: 'number' },
        scheduledBy: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'prepare_site',
        title: 'Prepare installation site for {{payload.projectName}}',
        description: 'Verify site readiness and access',
        priority: 'P1',
        dueInDays: 2,
        assignTo: { type: 'role', value: 'installation-coordinator' },
      },
      {
        taskType: 'coordinate_installation',
        title: 'Coordinate installation for {{payload.projectName}}',
        description: 'Manage installation team and schedule',
        priority: 'P0',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'installation-coordinator' },
      },
    ],
    notifications: [
      {
        channels: ['email', 'in-app'],
        recipients: [
          { type: 'role', value: 'installation-coordinator' },
          { type: 'role', value: 'project-manager' },
        ],
        template: 'installation_scheduled',
      },
    ],
    retention: { keepDays: 365, archive: true },
    enabled: true,
  },
  {
    eventType: 'finishes.site_preparation_required',
    name: 'Site Preparation Required',
    description: 'Pre-installation site work is needed',
    category: EVENT_CATEGORIES.PRODUCTION,
    source: {
      allowedSources: ['user'],
      allowedModules: ['design_manager', 'projects'],
    },
    schema: {
      required: ['projectId', 'preparationTasks'],
      properties: {
        projectId: { type: 'string' },
        projectName: { type: 'string' },
        preparationTasks: { type: 'array' },
        location: { type: 'string' },
        requiredByDate: { type: 'string' },
        reportedBy: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'complete_site_prep',
        title: 'Complete site preparation for {{payload.projectName}}',
        description: 'Ensure site is ready for installation',
        priority: 'P1',
        dueInDays: 3,
        assignTo: {
          type: 'role',
          value: 'installation-coordinator',
          fallback: { type: 'role', value: 'project-coordinator' },
        },
      },
    ],
    notifications: [
      {
        channels: ['in-app'],
        recipients: [{ type: 'role', value: 'installation-coordinator' }],
        template: 'site_prep_required',
      },
    ],
    retention: { keepDays: 365, archive: true },
    enabled: true,
  },
  {
    eventType: 'finishes.installation_complete',
    name: 'Installation Complete',
    description: 'Installation has been completed and ready for walkthrough',
    category: EVENT_CATEGORIES.PRODUCTION,
    source: {
      allowedSources: ['user'],
      allowedModules: ['design_manager', 'projects'],
    },
    schema: {
      required: ['projectId', 'completionDate'],
      properties: {
        projectId: { type: 'string' },
        projectName: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        completionDate: { type: 'string' },
        installedBy: { type: 'string' },
        photos: { type: 'array' },
      },
    },
    tasks: [
      {
        taskType: 'conduct_walkthrough',
        title: 'Conduct client walkthrough for {{payload.projectName}}',
        description: 'Walk through installation with client',
        priority: 'P1',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'installation-coordinator' },
      },
      {
        taskType: 'document_punchlist',
        title: 'Document punch list for {{payload.projectName}}',
        description: 'Create list of any defects or incomplete items',
        priority: 'P1',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'installation-coordinator' },
      },
    ],
    notifications: [
      {
        channels: ['email', 'in-app'],
        recipients: [
          { type: 'role', value: 'project-manager' },
          { type: 'role', value: 'design-manager' },
        ],
        template: 'installation_complete',
      },
    ],
    retention: { keepDays: 730, archive: true },
    enabled: true,
  },
  {
    eventType: 'finishes.post_installation_followup',
    name: 'Post-Installation Follow-up',
    description: 'Follow-up required after project delivery',
    category: EVENT_CATEGORIES.CUSTOMER,
    source: {
      allowedSources: ['user', 'schedule'],
      allowedModules: ['design_manager', 'projects'],
    },
    schema: {
      required: ['projectId', 'followupType'],
      properties: {
        projectId: { type: 'string' },
        projectName: { type: 'string' },
        customerId: { type: 'string' },
        customerName: { type: 'string' },
        followupType: { type: 'string' }, // 'satisfaction', 'defects', 'maintenance'
        daysAfterInstall: { type: 'number' },
      },
    },
    tasks: [
      {
        taskType: 'client_satisfaction_survey',
        title: 'Client satisfaction survey for {{payload.projectName}}',
        description: 'Collect feedback on project completion',
        priority: 'P2',
        dueInDays: 3,
        assignTo: {
          type: 'role',
          value: 'client-liaison',
          fallback: { type: 'role', value: 'project-coordinator' },
        },
      },
    ],
    notifications: [
      {
        channels: ['in-app'],
        recipients: [{ type: 'role', value: 'client-liaison' }],
        template: 'post_install_followup',
      },
    ],
    retention: { keepDays: 730, archive: true },
    enabled: true,
  },

  // ----------------------------------------
  // Launch Pipeline Events
  // ----------------------------------------
  {
    eventType: 'finishes.product_added_to_pipeline',
    name: 'Product Added to Pipeline',
    description: 'A new product has been added to the launch pipeline',
    category: EVENT_CATEGORIES.CUSTOMER,
    source: {
      allowedSources: ['user'],
      allowedModules: ['launch_pipeline'],
    },
    schema: {
      required: ['productId', 'productName', 'category'],
      properties: {
        productId: { type: 'string' },
        productName: { type: 'string' },
        category: { type: 'string' },
        priority: { type: 'string' },
        targetLaunchDate: { type: 'string' },
        createdBy: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'complete_product_setup',
        title: 'Complete product setup: {{payload.productName}}',
        description: 'Add product details, images, and specifications',
        priority: 'P1',
        dueInDays: 3,
        assignTo: { type: 'role', value: 'product-manager' },
      },
      {
        taskType: 'create_product_content',
        title: 'Create content for {{payload.productName}}',
        description: 'Write product description and marketing copy',
        priority: 'P2',
        dueInDays: 5,
        assignTo: { type: 'role', value: 'content-creator' },
      },
    ],
    notifications: [
      {
        channels: ['in-app'],
        recipients: [
          { type: 'role', value: 'product-manager' },
        ],
        template: 'product_added_to_pipeline',
      },
    ],
    retention: { keepDays: 365, archive: true },
    enabled: true,
  },
  {
    eventType: 'finishes.product_ready_for_shopify',
    name: 'Product Ready for Shopify',
    description: 'A product is ready to be published to Shopify',
    category: EVENT_CATEGORIES.CUSTOMER,
    source: {
      allowedSources: ['user', 'system'],
      allowedModules: ['launch_pipeline'],
    },
    schema: {
      required: ['productId', 'productName'],
      properties: {
        productId: { type: 'string' },
        productName: { type: 'string' },
        handle: { type: 'string' },
        category: { type: 'string' },
        readinessScore: { type: 'number' },
        approvedBy: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'sync_to_shopify',
        title: 'Publish {{payload.productName}} to Shopify',
        description: 'Sync product data to Shopify store',
        priority: 'P1',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'ecommerce-coordinator' },
      },
      {
        taskType: 'verify_shopify_listing',
        title: 'Verify Shopify listing for {{payload.productName}}',
        description: 'Check product appears correctly on Shopify store',
        priority: 'P2',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'ecommerce-coordinator' },
      },
    ],
    notifications: [
      {
        channels: ['email', 'in-app'],
        recipients: [
          { type: 'role', value: 'ecommerce-coordinator' },
          { type: 'role', value: 'sales-manager' },
        ],
        template: 'product_ready_for_shopify',
      },
    ],
    retention: { keepDays: 365, archive: true },
    enabled: true,
  },

  // ----------------------------------------
  // Cutlist & Manufacturing Events
  // ----------------------------------------
  {
    eventType: 'finishes.cutlist_optimization_complete',
    name: 'Cutlist Optimization Complete',
    description: 'A cutlist optimization has been completed for a project',
    category: EVENT_CATEGORIES.PRODUCTION,
    source: {
      allowedSources: ['user', 'system'],
      allowedModules: ['cutlist'],
    },
    schema: {
      required: ['workInstanceId', 'projectId', 'totalSheets', 'averageUtilization'],
      properties: {
        workInstanceId: { type: 'string' },
        projectId: { type: 'string' },
        projectCode: { type: 'string' },
        totalSheets: { type: 'number' },
        totalPanels: { type: 'number' },
        averageUtilization: { type: 'number' },
        totalCost: { type: 'number' },
        createdBy: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'review_cutlist_optimization',
        title: 'Review cutlist for {{payload.projectCode}}',
        description: 'Review optimization results: {{payload.totalSheets}} sheets at {{payload.averageUtilization}}% utilization',
        priority: 'P2',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'production-planner' },
      },
      {
        taskType: 'order_sheet_materials',
        title: 'Order sheet materials for {{payload.projectCode}}',
        description: 'Place order for {{payload.totalSheets}} sheets',
        priority: 'P1',
        dueInDays: 2,
        assignTo: { type: 'role', value: 'procurement-coordinator' },
        conditions: [
          { field: 'totalSheets', operator: 'gt', value: 0 },
        ],
      },
    ],
    notifications: [
      {
        channels: ['in-app'],
        recipients: [
          { type: 'role', value: 'production-manager' },
          { type: 'creator' },
        ],
        template: 'cutlist_optimization_complete',
      },
    ],
    retention: { keepDays: 365, archive: true },
    enabled: true,
  },

  // ----------------------------------------
  // Asset Events
  // ----------------------------------------
  {
    eventType: 'finishes.asset_maintenance_required',
    name: 'Asset Maintenance Required',
    description: 'A workshop asset requires maintenance',
    category: EVENT_CATEGORIES.PRODUCTION,
    source: {
      allowedSources: ['user', 'system', 'schedule'],
      allowedModules: ['assets'],
    },
    schema: {
      required: ['assetId', 'assetName', 'maintenanceType'],
      properties: {
        assetId: { type: 'string' },
        assetName: { type: 'string' },
        assetCategory: { type: 'string' },
        maintenanceType: { type: 'string' }, // 'scheduled', 'corrective', 'preventive'
        hoursAtMaintenance: { type: 'number' },
        previousStatus: { type: 'string' },
        reportedBy: { type: 'string' },
        issueDescription: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'perform_scheduled_maintenance',
        title: 'Perform scheduled maintenance on {{payload.assetName}}',
        description: 'Complete scheduled maintenance at {{payload.hoursAtMaintenance}} hours',
        priority: 'P2',
        dueInDays: 3,
        assignTo: { type: 'role', value: 'maintenance-technician' },
        conditions: [
          { field: 'maintenanceType', operator: 'eq', value: 'scheduled' },
        ],
      },
      {
        taskType: 'repair_asset',
        title: 'Repair {{payload.assetName}}',
        description: 'Corrective maintenance required: {{payload.issueDescription}}',
        priority: 'P0',
        dueInDays: 1,
        assignTo: { type: 'role', value: 'maintenance-technician' },
        conditions: [
          { field: 'maintenanceType', operator: 'eq', value: 'corrective' },
        ],
      },
    ],
    notifications: [
      {
        channels: ['in-app', 'push'],
        recipients: [
          { type: 'role', value: 'production-manager' },
          { type: 'role', value: 'maintenance-technician' },
        ],
        template: 'asset_maintenance_required',
      },
    ],
    retention: { keepDays: 730, archive: true },
    enabled: true,
  },
];

// ============================================
// Strategic Events
// ============================================

const strategicEvents: EventDefinition[] = [
  {
    eventType: 'strategic.market_change',
    name: 'Market Change Detected',
    description: 'A significant market change has been identified',
    category: EVENT_CATEGORIES.STRATEGIC,
    source: {
      allowedSources: ['user', 'integration', 'system'],
      allowedModules: ['strategy', 'market_intelligence'],
    },
    schema: {
      required: ['changeId', 'changeType', 'title', 'impact'],
      properties: {
        changeId: { type: 'string' },
        changeType: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        impact: { type: 'string' },
        affectedSubsidiaries: { type: 'array' },
        sourceUrl: { type: 'string' },
        detectedAt: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'analyze_impact',
        title: 'Analyze impact of: {{payload.title}}',
        description: '{{payload.description}}',
        priority: 'P1',
        dueInDays: 3,
        assignTo: { type: 'role', value: 'strategy-analyst' },
      },
      {
        taskType: 'executive_briefing',
        title: 'Prepare executive briefing on {{payload.title}}',
        priority: 'P1',
        dueInDays: 5,
        assignTo: { type: 'role', value: 'strategy-manager' },
        conditions: [
          { field: 'impact', operator: 'in', value: ['high', 'critical'] },
        ],
      },
    ],
    notifications: [
      {
        channels: ['email', 'in-app'],
        recipients: [{ type: 'role', value: 'executive' }],
        template: 'market_change',
        conditions: [
          { field: 'impact', operator: 'in', value: ['high', 'critical'] },
        ],
      },
    ],
    retention: { keepDays: 1825, archive: true },
    enabled: true,
  },
  {
    eventType: 'strategic.opportunity_identified',
    name: 'Opportunity Identified',
    description: 'A strategic opportunity has been identified',
    category: EVENT_CATEGORIES.STRATEGIC,
    source: {
      allowedSources: ['user'],
      allowedModules: ['strategy', 'opportunities'],
    },
    schema: {
      required: ['opportunityId', 'opportunityType', 'title', 'description'],
      properties: {
        opportunityId: { type: 'string' },
        opportunityType: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        estimatedValue: { type: 'number' },
        currency: { type: 'string' },
        probability: { type: 'number' },
        source: { type: 'string' },
        expiryDate: { type: 'string' },
      },
    },
    tasks: [
      {
        taskType: 'evaluate_opportunity',
        title: 'Evaluate opportunity: {{payload.title}}',
        priority: 'P2',
        dueInDays: 7,
        assignTo: { type: 'role', value: 'strategy-manager' },
      },
    ],
    notifications: [
      {
        channels: ['in-app'],
        recipients: [{ type: 'role', value: 'executive' }],
        template: 'opportunity_identified',
      },
    ],
    retention: { keepDays: 730, archive: true },
    enabled: true,
  },
];

// ============================================
// Export Complete Catalog
// ============================================

export const EVENT_CATALOG: EventDefinition[] = [
  ...customerEvents,
  ...financialEvents,
  ...hrEvents,
  ...productionEvents,
  ...finishesEvents,
  ...strategicEvents,
];

/**
 * Get event definition by type
 */
export function getEventDefinition(eventType: string): EventDefinition | undefined {
  return EVENT_CATALOG.find(e => e.eventType === eventType);
}

/**
 * Get all event definitions for a category
 */
export function getEventsByCategory(category: string): EventDefinition[] {
  return EVENT_CATALOG.filter(e => e.category === category);
}

/**
 * Get all enabled event types
 */
export function getEnabledEventTypes(): string[] {
  return EVENT_CATALOG.filter(e => e.enabled).map(e => e.eventType);
}

/**
 * Validate event payload against schema
 */
export function validateEventPayload(
  eventType: string,
  payload: Record<string, any>
): { valid: boolean; errors: string[] } {
  const definition = getEventDefinition(eventType);
  if (!definition) {
    return { valid: false, errors: [`Unknown event type: ${eventType}`] };
  }

  const errors: string[] = [];
  
  // Check required fields
  for (const field of definition.schema.required) {
    if (!(field in payload) || payload[field] === undefined || payload[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
