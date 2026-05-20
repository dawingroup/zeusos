/**
 * Deal stages and pipeline configuration
 * 
 * Stages represent the lifecycle of a deal from screening to exit.
 * Each stage has configurable gate criteria that must be met to progress.
 */

import { Timestamp } from 'firebase/firestore';

export type DealStage = 
  | 'screening'         // Initial evaluation
  | 'preliminary'       // Preliminary assessment
  | 'due_diligence'     // Detailed investigation
  | 'negotiation'       // Terms negotiation
  | 'documentation'     // Legal documentation
  | 'closing'           // Transaction closing
  | 'post_closing'      // Post-close integration
  | 'asset_management'  // Ongoing management
  | 'exit_planning'     // Exit preparation
  | 'exit';             // Exit execution

export interface StageHistory {
  stage: DealStage;
  enteredAt: Timestamp;
  exitedAt?: Timestamp;
  exitReason?: StageExitReason;
  gateApprover?: string;
  notes?: string;
}

export type StageExitReason =
  | 'approved'          // Gate criteria met
  | 'rejected'          // Did not meet criteria
  | 'withdrawn'         // Deal withdrawn
  | 'on_hold'           // Paused
  | 'skipped';          // Stage skipped (with approval)

// Stage configuration for pipeline management
export interface StageConfig {
  stage: DealStage;
  name: string;
  description: string;
  order: number;
  color: string;
  gateCriteria: GateCriterion[];
  requiredDocuments: RequiredDocument[];
  requiredApprovals: RequiredApproval[];
  typicalDuration: number;  // Days
  isExitable: boolean;      // Can move to closed_lost from this stage
}

export interface GateCriterion {
  id: string;
  name: string;
  description: string;
  type: 'checklist' | 'approval' | 'document' | 'metric';
  required: boolean;
  validationRule?: string;  // For metric type
}

export interface RequiredDocument {
  documentType: string;
  name: string;
  description: string;
  required: boolean;
}

export interface RequiredApproval {
  approvalType: string;
  approverRole: string;
  description: string;
}

// Default stage configurations
export const DEFAULT_STAGE_CONFIGS: StageConfig[] = [
  {
    stage: 'screening',
    name: 'Screening',
    description: 'Initial evaluation of investment opportunity',
    order: 1,
    color: '#6366f1',
    gateCriteria: [
      { id: 'sc-1', name: 'Sector fit', description: 'Deal aligns with investment thesis', type: 'checklist', required: true },
      { id: 'sc-2', name: 'Size appropriate', description: 'Deal size within mandate', type: 'checklist', required: true },
      { id: 'sc-3', name: 'Preliminary IRR', description: 'Target IRR achievable', type: 'metric', required: true, validationRule: '>= 15%' },
    ],
    requiredDocuments: [
      { documentType: 'teaser', name: 'Deal Teaser', description: 'Initial deal summary', required: true },
    ],
    requiredApprovals: [],
    typicalDuration: 14,
    isExitable: true,
  },
  {
    stage: 'preliminary',
    name: 'Preliminary Assessment',
    description: 'Initial analysis and investment committee approval to proceed',
    order: 2,
    color: '#8b5cf6',
    gateCriteria: [
      { id: 'pr-1', name: 'IC approval', description: 'Investment Committee approval to proceed', type: 'approval', required: true },
      { id: 'pr-2', name: 'NDA executed', description: 'Non-disclosure agreement in place', type: 'document', required: true },
      { id: 'pr-3', name: 'Preliminary model', description: 'Base case financial model', type: 'document', required: true },
    ],
    requiredDocuments: [
      { documentType: 'nda', name: 'NDA', description: 'Signed non-disclosure agreement', required: true },
      { documentType: 'ic_memo', name: 'IC Memo', description: 'Investment committee memorandum', required: true },
      { documentType: 'preliminary_model', name: 'Preliminary Model', description: 'Initial financial model', required: true },
    ],
    requiredApprovals: [
      { approvalType: 'ic_screening', approverRole: 'investment_committee', description: 'IC approval to proceed to DD' },
    ],
    typicalDuration: 21,
    isExitable: true,
  },
  {
    stage: 'due_diligence',
    name: 'Due Diligence',
    description: 'Comprehensive investigation across all workstreams',
    order: 3,
    color: '#0ea5e9',
    gateCriteria: [
      { id: 'dd-1', name: 'Commercial DD complete', description: 'Commercial due diligence completed', type: 'checklist', required: true },
      { id: 'dd-2', name: 'Financial DD complete', description: 'Financial due diligence completed', type: 'checklist', required: true },
      { id: 'dd-3', name: 'Legal DD complete', description: 'Legal due diligence completed', type: 'checklist', required: true },
      { id: 'dd-4', name: 'Technical DD complete', description: 'Technical due diligence completed', type: 'checklist', required: true },
      { id: 'dd-5', name: 'No red flags', description: 'No unresolved red flags', type: 'checklist', required: true },
    ],
    requiredDocuments: [
      { documentType: 'dd_report', name: 'DD Report', description: 'Consolidated due diligence report', required: true },
    ],
    requiredApprovals: [
      { approvalType: 'dd_completion', approverRole: 'deal_lead', description: 'Deal lead sign-off on DD completion' },
    ],
    typicalDuration: 60,
    isExitable: true,
  },
  {
    stage: 'negotiation',
    name: 'Negotiation',
    description: 'Term sheet negotiation and IC final approval',
    order: 4,
    color: '#f59e0b',
    gateCriteria: [
      { id: 'ng-1', name: 'Term sheet agreed', description: 'Key terms agreed with counterparty', type: 'document', required: true },
      { id: 'ng-2', name: 'Final IC approval', description: 'Investment Committee final approval', type: 'approval', required: true },
      { id: 'ng-3', name: 'Board approval', description: 'Board approval (if required)', type: 'approval', required: false },
    ],
    requiredDocuments: [
      { documentType: 'term_sheet', name: 'Term Sheet', description: 'Agreed term sheet', required: true },
      { documentType: 'ic_final_memo', name: 'Final IC Memo', description: 'Final IC approval memorandum', required: true },
    ],
    requiredApprovals: [
      { approvalType: 'ic_final', approverRole: 'investment_committee', description: 'Final IC approval' },
    ],
    typicalDuration: 30,
    isExitable: true,
  },
  {
    stage: 'documentation',
    name: 'Documentation',
    description: 'Legal documentation drafting and negotiation',
    order: 5,
    color: '#10b981',
    gateCriteria: [
      { id: 'dc-1', name: 'SPA executed', description: 'Share Purchase Agreement signed', type: 'document', required: true },
      { id: 'dc-2', name: 'SHA executed', description: 'Shareholder Agreement signed', type: 'document', required: true },
      { id: 'dc-3', name: 'CPs satisfied', description: 'Conditions precedent satisfied', type: 'checklist', required: true },
    ],
    requiredDocuments: [
      { documentType: 'spa', name: 'SPA', description: 'Share Purchase Agreement', required: true },
      { documentType: 'sha', name: 'SHA', description: 'Shareholder Agreement', required: true },
      { documentType: 'cp_checklist', name: 'CP Checklist', description: 'Conditions precedent checklist', required: true },
    ],
    requiredApprovals: [],
    typicalDuration: 45,
    isExitable: true,
  },
  {
    stage: 'closing',
    name: 'Closing',
    description: 'Transaction closing and fund disbursement',
    order: 6,
    color: '#22c55e',
    gateCriteria: [
      { id: 'cl-1', name: 'Funds disbursed', description: 'Investment funds transferred', type: 'checklist', required: true },
      { id: 'cl-2', name: 'Shares transferred', description: 'Share certificates received', type: 'checklist', required: true },
      { id: 'cl-3', name: 'Board representation', description: 'Board seat confirmed', type: 'checklist', required: false },
    ],
    requiredDocuments: [
      { documentType: 'closing_memo', name: 'Closing Memo', description: 'Transaction closing memorandum', required: true },
      { documentType: 'share_certificate', name: 'Share Certificate', description: 'Share certificate', required: true },
    ],
    requiredApprovals: [],
    typicalDuration: 7,
    isExitable: false,
  },
  {
    stage: 'post_closing',
    name: 'Post-Closing',
    description: 'Post-transaction integration and initial monitoring',
    order: 7,
    color: '#0d9488',
    gateCriteria: [
      { id: 'pc-1', name: 'First board meeting', description: 'Attended first board meeting', type: 'checklist', required: true },
      { id: 'pc-2', name: 'Reporting established', description: 'Reporting framework established', type: 'checklist', required: true },
    ],
    requiredDocuments: [],
    requiredApprovals: [],
    typicalDuration: 90,
    isExitable: false,
  },
  {
    stage: 'asset_management',
    name: 'Asset Management',
    description: 'Ongoing portfolio company management',
    order: 8,
    color: '#0891b2',
    gateCriteria: [],
    requiredDocuments: [],
    requiredApprovals: [],
    typicalDuration: 1825,  // 5 years typical hold
    isExitable: false,
  },
  {
    stage: 'exit_planning',
    name: 'Exit Planning',
    description: 'Exit strategy development and execution preparation',
    order: 9,
    color: '#7c3aed',
    gateCriteria: [
      { id: 'ex-1', name: 'Exit strategy approved', description: 'IC approved exit strategy', type: 'approval', required: true },
      { id: 'ex-2', name: 'Valuation complete', description: 'Current valuation completed', type: 'document', required: true },
    ],
    requiredDocuments: [
      { documentType: 'exit_memo', name: 'Exit Memo', description: 'Exit strategy memorandum', required: true },
    ],
    requiredApprovals: [
      { approvalType: 'exit_approval', approverRole: 'investment_committee', description: 'IC exit approval' },
    ],
    typicalDuration: 180,
    isExitable: false,
  },
  {
    stage: 'exit',
    name: 'Exit',
    description: 'Exit execution and fund return',
    order: 10,
    color: '#dc2626',
    gateCriteria: [
      { id: 'xt-1', name: 'Exit completed', description: 'Exit transaction completed', type: 'checklist', required: true },
      { id: 'xt-2', name: 'Funds received', description: 'Exit proceeds received', type: 'checklist', required: true },
    ],
    requiredDocuments: [
      { documentType: 'exit_report', name: 'Exit Report', description: 'Final exit report with returns', required: true },
    ],
    requiredApprovals: [],
    typicalDuration: 30,
    isExitable: false,
  },
];

// Stage transition validation
export interface StageTransition {
  fromStage: DealStage;
  toStage: DealStage;
  allowed: boolean;
  requiresApproval: boolean;
  approverRole?: string;
}

export const ALLOWED_TRANSITIONS: StageTransition[] = [
  // Forward transitions
  { fromStage: 'screening', toStage: 'preliminary', allowed: true, requiresApproval: false },
  { fromStage: 'preliminary', toStage: 'due_diligence', allowed: true, requiresApproval: true, approverRole: 'investment_committee' },
  { fromStage: 'due_diligence', toStage: 'negotiation', allowed: true, requiresApproval: true, approverRole: 'deal_lead' },
  { fromStage: 'negotiation', toStage: 'documentation', allowed: true, requiresApproval: true, approverRole: 'investment_committee' },
  { fromStage: 'documentation', toStage: 'closing', allowed: true, requiresApproval: false },
  { fromStage: 'closing', toStage: 'post_closing', allowed: true, requiresApproval: false },
  { fromStage: 'post_closing', toStage: 'asset_management', allowed: true, requiresApproval: false },
  { fromStage: 'asset_management', toStage: 'exit_planning', allowed: true, requiresApproval: true, approverRole: 'investment_committee' },
  { fromStage: 'exit_planning', toStage: 'exit', allowed: true, requiresApproval: true, approverRole: 'investment_committee' },
  // Backward transitions (with approval)
  { fromStage: 'preliminary', toStage: 'screening', allowed: true, requiresApproval: true, approverRole: 'deal_lead' },
  { fromStage: 'due_diligence', toStage: 'preliminary', allowed: true, requiresApproval: true, approverRole: 'deal_lead' },
  { fromStage: 'negotiation', toStage: 'due_diligence', allowed: true, requiresApproval: true, approverRole: 'deal_lead' },
];

// Helper functions
export function getStageConfig(stage: DealStage): StageConfig | undefined {
  return DEFAULT_STAGE_CONFIGS.find(c => c.stage === stage);
}

export function getStageDisplayName(stage: DealStage): string {
  const config = getStageConfig(stage);
  return config?.name || stage;
}

export function getStageColor(stage: DealStage): string {
  const config = getStageConfig(stage);
  return config?.color || '#6b7280';
}

export function getStageOrder(stage: DealStage): number {
  const config = getStageConfig(stage);
  return config?.order || 0;
}

export function isTransitionAllowed(fromStage: DealStage, toStage: DealStage): boolean {
  const transition = ALLOWED_TRANSITIONS.find(
    t => t.fromStage === fromStage && t.toStage === toStage
  );
  return transition?.allowed || false;
}

export function transitionRequiresApproval(fromStage: DealStage, toStage: DealStage): boolean {
  const transition = ALLOWED_TRANSITIONS.find(
    t => t.fromStage === fromStage && t.toStage === toStage
  );
  return transition?.requiresApproval || false;
}

export function getNextStage(currentStage: DealStage): DealStage | null {
  const currentOrder = getStageOrder(currentStage);
  const nextConfig = DEFAULT_STAGE_CONFIGS.find(c => c.order === currentOrder + 1);
  return nextConfig?.stage || null;
}

export function getPreviousStage(currentStage: DealStage): DealStage | null {
  const currentOrder = getStageOrder(currentStage);
  const prevConfig = DEFAULT_STAGE_CONFIGS.find(c => c.order === currentOrder - 1);
  return prevConfig?.stage || null;
}

// Get all stages in order
export function getOrderedStages(): DealStage[] {
  return DEFAULT_STAGE_CONFIGS
    .sort((a, b) => a.order - b.order)
    .map(c => c.stage);
}

// Get active deal stages (excluding exit)
export function getActiveDealStages(): DealStage[] {
  return DEFAULT_STAGE_CONFIGS
    .filter(c => c.stage !== 'exit')
    .sort((a, b) => a.order - b.order)
    .map(c => c.stage);
}
