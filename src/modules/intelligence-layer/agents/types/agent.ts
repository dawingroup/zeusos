/**
 * Agent type definitions for the ZeusOS Intelligence Layer.
 *
 * Ported from DawinOS and re-pointed at ZeusOS's commercial/marketing domain.
 * Describes the admin-facing shape of an AI agent ZeusOS runs on a user's
 * behalf — its model + inference settings, persona, the tools it may call, the
 * skill docs attached to it, runtime metrics, and an immutable audit trail.
 *
 * Firestore collections:
 *   - `agents/{id}`            — Agent + AgentSettings
 *   - `agentSkillDocs/{id}`    — AgentSkillDoc (one doc per file)
 *   - `agentAuditEntries/{id}` — AgentAuditEntry (immutable, CFn-write only)
 *
 * Safety model (enforced by the Cloud-Function dispatcher, not the client):
 * every action passes 4 gates (agent active → tool enabled → schema-valid →
 * autoActMode boundary) and writes an audit row even on denial. `enabledTools`
 * is the grant; `autoActMode` (draft_only → gated → autonomous) bounds it.
 */
import type { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────────────────
// Models — Claude variants ZeusOS supports (ids match the platform env).
// ─────────────────────────────────────────────────────────────────────────────

export const AGENT_MODELS = [
  'claude-haiku-4-5',
  'claude-sonnet-4-6',
  'claude-opus-4-8',
] as const;

export type AgentModel = (typeof AGENT_MODELS)[number];

export const AGENT_MODEL_LABELS: Record<AgentModel, string> = {
  'claude-haiku-4-5': 'Haiku 4.5 · fast · low cost',
  'claude-sonnet-4-6': 'Sonnet 4.6 · balanced',
  'claude-opus-4-8': 'Opus 4.8 · deep reasoning',
};

// ─────────────────────────────────────────────────────────────────────────────
// Tool registry — capabilities an agent can be granted.
//
// Tool ids follow `<scope>.<noun>`. Re-pointed at ZeusOS's live collections
// (commercial gravity + delivery + marketing). DawinOS construction/
// manufacturing/inventory/capital tools are intentionally dropped.
// ─────────────────────────────────────────────────────────────────────────────

export type AgentToolScope = 'read' | 'write' | 'search' | 'notify';

export interface AgentTool {
  /** Stable id used in the allowlist and in audit entries. */
  id: string;
  scope: AgentToolScope;
  label: string;
  description: string;
}

/**
 * Registry of capabilities every ZeusOS agent may opt into. Constant on
 * purpose — adding a tool is a code change so review confirms a matching
 * server-side handler exists. Declaring a tool here does NOT grant
 * unconditional access; the dispatcher still enforces draft/gated/autonomous.
 */
export const AGENT_TOOLS: AgentTool[] = [
  // ── READ — Commercial gravity ──────────────────────────────────────────
  {
    id: 'read.master_jobs',
    scope: 'read',
    label: 'Read master jobs',
    description: 'Engagements: stage, tier, client, budget, SLA, serving brand.',
  },
  {
    id: 'read.internal_work_orders',
    scope: 'read',
    label: 'Read internal work orders',
    description: 'IWOs: state, burn, cost, SLA due, assignees, handoff packets.',
  },
  {
    id: 'read.clients',
    scope: 'read',
    label: 'Read clients',
    description: 'Client master, primary brand, sector, contacts, competitor walls.',
  },
  {
    id: 'read.client_invoices',
    scope: 'read',
    label: 'Read client invoices',
    description: 'Client AR invoices: totals, paid, balance, status, due dates.',
  },
  {
    id: 'read.intercompany_invoices',
    scope: 'read',
    label: 'Read inter-company invoices',
    description: 'Inter-co AP/AR between brands: transfer price, markup, settle state.',
  },
  {
    id: 'read.quotes',
    scope: 'read',
    label: 'Read quotes',
    description: 'Client quotes + rate-card pricing + win/loss.',
  },
  // ── READ — Delivery / marketing ────────────────────────────────────────
  {
    id: 'read.media_plans',
    scope: 'read',
    label: 'Read media plans',
    description: 'Media plans, buys, actuals, and post-campaign reconciliation.',
  },
  {
    id: 'read.talent',
    scope: 'read',
    label: 'Read talent',
    description: 'Talent roster, contracts, invoices, influencers/models.',
  },
  {
    id: 'read.production',
    scope: 'read',
    label: 'Read production',
    description: 'Production kanban, checklists, shoot days, post phases.',
  },
  // ── READ — CRM ─────────────────────────────────────────────────────────
  {
    id: 'read.crm_deals',
    scope: 'read',
    label: 'Read CRM deals',
    description: 'Deal pipeline, stage, owners, activities.',
  },
  // ── READ — HR ──────────────────────────────────────────────────────────
  {
    id: 'read.employees',
    scope: 'read',
    label: 'Read employees',
    description: 'Employee directory, role profiles, reporting lines, capacity.',
  },
  // ── READ — CEO Strategy ────────────────────────────────────────────────
  {
    id: 'read.okrs',
    scope: 'read',
    label: 'Read OKRs',
    description: 'Objectives, key results, check-ins, cycles.',
  },
  {
    id: 'read.kpis',
    scope: 'read',
    label: 'Read KPIs',
    description: 'KPI definitions, targets, thresholds, latest data points.',
  },
  {
    id: 'read.scorecards',
    scope: 'read',
    label: 'Read scorecards',
    description: 'Balanced / strategic / operational scorecards.',
  },
  {
    id: 'read.strategy_documents',
    scope: 'read',
    label: 'Read strategy documents',
    description: 'Strategy reviews + document sections.',
  },
  // ── READ — Finance ─────────────────────────────────────────────────────
  {
    id: 'read.finance_journals',
    scope: 'read',
    label: 'Read finance journals',
    description: 'GL postings + group roll-ups + AR/AP aging.',
  },
  // ── READ — Market Intelligence / Compliance ────────────────────────────
  {
    id: 'read.competitors',
    scope: 'read',
    label: 'Read competitor intel',
    description: 'Competitor profiles, signals, win/loss.',
  },
  {
    id: 'read.regulatory_changes',
    scope: 'read',
    label: 'Read regulatory changes',
    description: 'Regulatory-change feed by sector + effective date.',
  },
  // ── READ — Cross-cutting / Intelligence layer ──────────────────────────
  {
    id: 'read.business_events',
    scope: 'read',
    label: 'Read business events',
    description: 'The domain-event stream that drives task generation.',
  },
  {
    id: 'read.audit_trail',
    scope: 'read',
    label: 'Read audit trail',
    description: 'Agent audit entries + immutable change history.',
  },

  // ── WRITE — Messaging + tasking (draftable) ────────────────────────────
  {
    id: 'write.draft_message',
    scope: 'write',
    label: 'Draft outbound messages',
    description: 'Compose email / WhatsApp / chat drafts; never auto-sends.',
  },
  {
    id: 'write.create_task',
    scope: 'write',
    label: 'Create internal tasks',
    description: 'Create generated_tasks routed via the task inbox.',
  },
  // ── WRITE — Alerts + KPIs ──────────────────────────────────────────────
  {
    id: 'write.create_alert',
    scope: 'write',
    label: 'Raise alert',
    description: 'Create a finding / escalation entry (high-severity).',
  },
  {
    id: 'write.acknowledge_alert',
    scope: 'write',
    label: 'Acknowledge alert',
    description: 'Mark an alert acknowledged once an owner is informed.',
  },
  {
    id: 'write.create_kpi_measurement',
    scope: 'write',
    label: 'Log KPI measurement',
    description: 'Record a new KPI data point (e.g. mirrored from a finance value).',
  },

  // ── SEARCH ─────────────────────────────────────────────────────────────
  {
    id: 'search.knowledge_base',
    scope: 'search',
    label: 'Search knowledge base',
    description: 'Query attached skill documents + business memory.',
  },
  {
    id: 'search.cross_module',
    scope: 'search',
    label: 'Cross-module search',
    description: 'Federated search across jobs, IWOs, clients, deals, media.',
  },
  {
    id: 'search.documents',
    scope: 'search',
    label: 'Search documents',
    description: 'Strategy docs, compliance docs, asset library.',
  },
  {
    id: 'search.contacts',
    scope: 'search',
    label: 'Search contacts',
    description: 'Client contacts + employees by name / role / email.',
  },

  // ── NOTIFY ─────────────────────────────────────────────────────────────
  {
    id: 'notify.user',
    scope: 'notify',
    label: 'Notify user',
    description: 'Push a notification or surface a banner to the operator.',
  },
  {
    id: 'notify.team',
    scope: 'notify',
    label: 'Notify team',
    description: 'Notify a whole team (e.g. finance for a CFO briefing).',
  },
  {
    id: 'notify.subsidiary_lead',
    scope: 'notify',
    label: 'Notify brand lead',
    description: 'Route a finding to the head of the affected sibling brand.',
  },
  {
    id: 'notify.escalate',
    scope: 'notify',
    label: 'Escalate to leadership',
    description: 'Escalate a finding to the group exec / Traffic.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Skill documents (knowledge base attached to an agent)
// ─────────────────────────────────────────────────────────────────────────────

export type AgentSkillDocType =
  | 'policy'
  | 'sop'
  | 'rate_card'
  | 'brand_guide'
  | 'training_note'
  | 'other';

export interface AgentSkillDoc {
  id: string;
  agentId: string;
  name: string;
  type: AgentSkillDocType;
  sizeBytes: number | null;
  sizeLabel?: string;
  storagePath?: string;
  downloadURL?: string;
  contentType?: string;
  uploadedBy?: string;
  uploadedAt?: Timestamp | Date | null;
  updatedAt: Timestamp | Date | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent settings — the editable surface area
// ─────────────────────────────────────────────────────────────────────────────

export type AgentStatus = 'active' | 'paused' | 'beta';

export type AutoActMode = 'draft_only' | 'gated' | 'autonomous';

export interface AgentSettings {
  name: string;
  description: string;
  /** Scope/domain (commercial, finance, delivery, …) — drives the icon. */
  scope: string;
  status: AgentStatus;
  model: AgentModel;
  fallbackModel: AgentModel;
  temperature: number;
  maxOutputTokens: number;
  /** Below this confidence the agent only drafts, never auto-acts. 0–1. */
  confidenceFloor: number;
  autoActMode: AutoActMode;
  systemPrompt: string;
  promptVersion: number;
  promptUpdatedAt: Timestamp | Date | null;
  /** Tool ids from {@link AGENT_TOOLS} this agent may call. */
  enabledTools: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Performance metrics (read-only, computed by a rollup job; CFn-locked)
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentMetrics {
  tasks30d: number;
  acceptanceRate: number;
  latencyMsP50: number;
  latencyMsP95: number;
  /** Estimated monthly cost in the group presentation currency (minor units). */
  estMonthlyCostMinor: number;
  falsePositiveRate: number;
  lastActedAt: Timestamp | Date | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit log entries
// ─────────────────────────────────────────────────────────────────────────────

export type AgentAuditOutcome = 'ok' | 'error' | 'denied' | 'drafted';

export interface AgentAuditEntry {
  id: string;
  agentId: string;
  toolId?: string;
  /** Free-form trigger label, e.g. "burn threshold exceeded". */
  trigger: string;
  outputSummary: string;
  outcome: AgentAuditOutcome;
  confidence?: number;
  createdAt: Timestamp | Date;
  inputSnapshot?: unknown;
  outputSnapshot?: unknown;
  errorMessage?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// The Agent itself
// ─────────────────────────────────────────────────────────────────────────────

export type AgentTone =
  | 'boysenberry'
  | 'rag-blue'
  | 'pesto'
  | 'rag-green'
  | 'rag-amber'
  | 'cashmere';

export interface Agent extends AgentSettings {
  id: string;
  /** Lucide icon name (string so the type stays serializable). */
  icon: string;
  tone: AgentTone;
  /** The task `sourceModule` this agent owns (for "why this matters" headers). */
  sourceModule?: string;
  /** Denormalised ids of attached `agentSkillDocs`. */
  skillDocIds?: string[];
  metrics: AgentMetrics;
  createdAt: Timestamp | Date | null;
  updatedAt: Timestamp | Date | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Defaults — used by "+ New agent" and the sample fallback
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  name: 'New agent',
  description: '',
  scope: 'general',
  status: 'beta',
  model: 'claude-sonnet-4-6',
  fallbackModel: 'claude-haiku-4-5',
  temperature: 0.3,
  maxOutputTokens: 4096,
  confidenceFloor: 0.75,
  autoActMode: 'draft_only',
  systemPrompt: '',
  promptVersion: 1,
  promptUpdatedAt: null,
  enabledTools: ['search.knowledge_base', 'notify.user'],
};
