/**
 * Default ZeusOS agents — seeded into `agents/{id}` and used as the admin
 * empty-state fallback before the collection is populated.
 *
 * Kept in lockstep with `functions/data/defaultAgents.json` (the backend
 * dispatcher's seed fallback) via `scripts/seed-zeus-agents.cjs`.
 *
 * Posture: the three watchers ship `draft_only` + `active` (read/observe/draft
 * only — they never mutate live data). The two mutating advisors ship `gated`
 * + `paused` until phase E wires their propose-then-approve flow.
 */
import type { Agent } from '../types/agent';

type SeedAgent = Omit<Agent, 'metrics' | 'createdAt' | 'updatedAt'>;

const ZERO_METRICS = {
  tasks30d: 0,
  acceptanceRate: 0,
  latencyMsP50: 0,
  latencyMsP95: 0,
  estMonthlyCostMinor: 0,
  falsePositiveRate: 0,
  lastActedAt: null,
};

const SEED: SeedAgent[] = [
  {
    id: 'ZA-002',
    name: 'Burn & SLA Watcher',
    description:
      'Watches in-flight IWO burn rates and SLA clocks across the five brands; raises a finding and drafts a task when a job is overheating or about to breach.',
    scope: 'delivery',
    icon: 'Flame',
    tone: 'rag-amber',
    sourceModule: 'delivery',
    status: 'active',
    model: 'claude-haiku-4-5',
    fallbackModel: 'claude-haiku-4-5',
    temperature: 0.2,
    maxOutputTokens: 2048,
    confidenceFloor: 0.7,
    autoActMode: 'draft_only',
    systemPrompt:
      'You watch internal work orders. Flag any IWO whose cumulative cost exceeds 90% of budget, or whose SLA is due within 24h, as a finding. Draft a concise task for the assigned delivery lead. Never mutate live data.',
    promptVersion: 1,
    promptUpdatedAt: null,
    enabledTools: [
      'read.internal_work_orders',
      'read.master_jobs',
      'write.create_task',
      'write.create_alert',
      'notify.subsidiary_lead',
    ],
    skillDocIds: [],
  },
  {
    id: 'ZA-003',
    name: 'ECD Cycle-Time Watcher',
    description:
      'Tracks the creative approval ladder; surfaces stalled ECD reviews and long cycle times so Traffic can unblock them.',
    scope: 'delivery',
    icon: 'Clock',
    tone: 'rag-blue',
    sourceModule: 'delivery',
    status: 'active',
    model: 'claude-haiku-4-5',
    fallbackModel: 'claude-haiku-4-5',
    temperature: 0.2,
    maxOutputTokens: 2048,
    confidenceFloor: 0.7,
    autoActMode: 'draft_only',
    systemPrompt:
      'You watch the creative approval ladder. Surface any review stage that has been pending longer than its tier SLA. Draft a nudge task for the owner. Never mutate live data.',
    promptVersion: 1,
    promptUpdatedAt: null,
    enabledTools: [
      'read.internal_work_orders',
      'read.business_events',
      'write.create_task',
      'notify.user',
    ],
    skillDocIds: [],
  },
  {
    id: 'ZA-005',
    name: 'Finance Sentinel',
    description:
      'Monitors client AR aging and inter-company settlement; drafts collection nudges and flags overdue inter-co invoices.',
    scope: 'finance',
    icon: 'DollarSign',
    tone: 'pesto',
    sourceModule: 'finance',
    status: 'active',
    model: 'claude-sonnet-4-6',
    fallbackModel: 'claude-haiku-4-5',
    temperature: 0.2,
    maxOutputTokens: 2048,
    confidenceFloor: 0.75,
    autoActMode: 'draft_only',
    systemPrompt:
      'You watch receivables and inter-company settlement. Flag client invoices past their due date and inter-co invoices unsettled beyond terms. Draft a collection task; escalate balances over the threshold. Never post journals or mutate ledgers.',
    promptVersion: 1,
    promptUpdatedAt: null,
    enabledTools: [
      'read.client_invoices',
      'read.intercompany_invoices',
      'read.finance_journals',
      'write.create_task',
      'write.create_alert',
      'notify.team',
    ],
    skillDocIds: [],
  },
  {
    id: 'ZA-001',
    name: 'Routing Advisor',
    description:
      'Proposes which sibling brand should serve an open master job (tier, capability, capacity, conflict). Gated — Traffic confirms before an IWO issues.',
    scope: 'commercial',
    icon: 'Workflow',
    tone: 'boysenberry',
    sourceModule: 'traffic',
    status: 'paused',
    model: 'claude-sonnet-4-6',
    fallbackModel: 'claude-haiku-4-5',
    temperature: 0.2,
    maxOutputTokens: 2048,
    confidenceFloor: 0.8,
    autoActMode: 'gated',
    systemPrompt:
      'You propose a serving brand for an open master job using tier, brand capability, current capacity, and conflict walls. Output a ranked recommendation with reasons. A human in Traffic confirms before anything issues.',
    promptVersion: 1,
    promptUpdatedAt: null,
    enabledTools: [
      'read.master_jobs',
      'read.internal_work_orders',
      'read.clients',
      'read.employees',
      'notify.escalate',
    ],
    skillDocIds: [],
  },
  {
    id: 'ZA-004',
    name: 'Conflict Sentinel',
    description:
      'Scans for client-competitor conflicts before a brand is assigned; raises an exclusivity-risk finding. Gated — a human resolves the wall.',
    scope: 'commercial',
    icon: 'Shield',
    tone: 'rag-blue',
    sourceModule: 'conflict-firewall',
    status: 'paused',
    model: 'claude-sonnet-4-6',
    fallbackModel: 'claude-haiku-4-5',
    temperature: 0.1,
    maxOutputTokens: 2048,
    confidenceFloor: 0.85,
    autoActMode: 'gated',
    systemPrompt:
      'You check whether assigning a brand to a client would breach a named-competitor wall. Raise an exclusivity-risk finding with the conflicting client and brand. A human resolves it.',
    promptVersion: 1,
    promptUpdatedAt: null,
    enabledTools: [
      'read.clients',
      'read.master_jobs',
      'read.internal_work_orders',
      'write.create_alert',
      'notify.escalate',
    ],
    skillDocIds: [],
  },
];

export const DEFAULT_AGENTS: Agent[] = SEED.map((a) => ({
  ...a,
  metrics: { ...ZERO_METRICS },
  createdAt: null,
  updatedAt: null,
}));

export const SAMPLE_AGENTS = DEFAULT_AGENTS;
