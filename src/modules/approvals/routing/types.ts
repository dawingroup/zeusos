/**
 * Approval routing v2 — configuration types (client mirror).
 *
 * Stored as one document at `systemSettings/approvalRouting`, edited from
 * Settings → Approval routing, and read by the Cloud Functions that sign
 * supplier spend (`functions/src/approvals/routing.js` holds the canonical
 * decision logic; `./engine.ts` mirrors it for validation + preview in the
 * UI, and `__tests__/routingLockstep.test.ts` pins the two in lockstep).
 *
 * One module today — `supplier_spend`: money leaving the group to a third
 * party (talent invoices, media-house invoices, manual vendor POs). Each
 * record carries a PURPOSE and an amount; the decision is the ordered list
 * of SIGNATURES it needs.
 */

import type { GlobalRole } from '@/core/settings/types';

export const APPROVAL_ROUTING_COLLECTION = 'systemSettings';
export const APPROVAL_ROUTING_DOC_ID = 'approvalRouting';

/** GlobalRole, most senior first — the ordering every seniority check uses. */
export const ROLE_SENIORITY: GlobalRole[] = ['owner', 'admin', 'manager', 'member', 'viewer'];

export const ROLE_LABELS: Record<GlobalRole, string> = {
  owner: 'Owner (Group CEO / board)',
  admin: 'Admin (brand MD / group finance)',
  manager: 'Manager (delivery lead)',
  member: 'Member',
  viewer: 'Viewer',
};

export type ApprovalPurpose = 'media' | 'production' | 'talent' | 'overhead';
export const PURPOSES: ApprovalPurpose[] = ['media', 'production', 'talent', 'overhead'];
export const PURPOSE_LABELS: Record<ApprovalPurpose, string> = {
  media: 'Media buys',
  production: 'Production',
  talent: 'Talent & freelancers',
  overhead: 'Overheads & services',
};

export const SUPPLIER_SPEND = 'supplier_spend';

/** Who signs one level. Pin a person by email or by the role profile they hold. */
export interface ApprovalSigner {
  label: string;
  /** Minimum role that may sign this level. */
  approverRole: GlobalRole;
  approverEmail?: string | null;
  roleProfileId?: string | null;
}

export interface ApprovalSignatureSpec extends ApprovalSigner {
  /** 1..n within the band, no gaps. */
  level: number;
}

/**
 * One value band. `maxAmountMinor` is an INCLUSIVE upper bound in the
 * module's currency (minor units); `null` on the highest band means
 * unbounded. The lower bound is the previous band's maximum.
 */
export interface ApprovalBandV2 {
  id: string;
  label: string;
  maxAmountMinor: number | null;
  signatures: ApprovalSignatureSpec[];
}

/** Who signs level 1 for a purpose, and when that escalates. */
export interface PurposeRule {
  id: string;
  purpose: ApprovalPurpose;
  label: string;
  primary: ApprovalSigner;
  /** Above this amount level 1 goes to `escalateTo`. */
  escalateAboveMinor?: number | null;
  /** Level 1 goes to `escalateTo` when the record is not linked to an engagement. */
  requireAnyLink?: boolean;
  escalateTo?: ApprovalSigner | null;
}

export type AggregateKind = 'supplier_rolling' | 'master_job_budget_pct' | 'weekly_cash';
export const AGGREGATE_KINDS: AggregateKind[] = ['supplier_rolling', 'master_job_budget_pct', 'weekly_cash'];
export const AGGREGATE_LABELS: Record<AggregateKind, string> = {
  supplier_rolling: 'Rolling spend with one supplier',
  master_job_budget_pct: 'Share of the engagement budget',
  weekly_cash: 'Cash out this week',
};

/** Oversight that adds a signer when a running total trips. */
export interface AggregateRule {
  id: string;
  kind: AggregateKind;
  label: string;
  thresholdMinor?: number;
  thresholdPct?: number;
  windowDays?: number;
  adds: ApprovalSigner & { level?: number };
}

export interface ApprovalModuleRoutingV2 {
  entityType: string;
  label: string;
  /** The currency thresholds were authored in — a LABEL, not a conversion. */
  currency: string;
  enabled: boolean;
  bands: ApprovalBandV2[];
  purposeRules: PurposeRule[];
  aggregateRules: AggregateRule[];
  /** Brief tier → how many bands up the record climbs at the same amount. */
  tierBandRaise: Record<string, number>;
  requirePurpose: boolean;
  forbidSelfApproval: boolean;
}

export interface ApprovalRoutingConfig {
  version: number;
  modules: Record<string, ApprovalModuleRoutingV2>;
  updatedAt?: unknown;
  updatedBy?: string;
}

// ── decision shapes ───────────────────────────────────────────────────────

export interface RoutingInput {
  purpose?: ApprovalPurpose | string | null;
  amountMinor: number;
  currency?: string | null;
  tier?: string | null;
  links?: { masterJobId?: string | null };
  aggregates?: { supplierRollingMinor?: number; weeklyCashMinor?: number; masterJobBudgetPct?: number | null };
}

export interface RoutedSignature extends ApprovalSignatureSpec {
  approverEmail: string | null;
  roleProfileId: string | null;
  roleChain: GlobalRole[];
}

export interface RoutingDecision {
  enabled: boolean;
  refusal?: 'purpose_required';
  band?: ApprovalBandV2;
  bandIndex?: number;
  raisedByTier?: number;
  purpose?: ApprovalPurpose | null;
  purposeRuleId?: string | null;
  aggregateRuleIds?: string[];
  signatures?: RoutedSignature[];
  currency?: string | null;
  currencyMismatch?: boolean;
  forbidSelfApproval?: boolean;
  planVersion?: number;
}

/** The plan frozen onto a record, with each level's signature as it lands. */
export interface PlannedSignature extends ApprovalSignatureSpec {
  approverEmail: string | null;
  roleProfileId: string | null;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  via: 'pinned' | 'role' | null;
  note?: string | null;
}

export interface ApprovalPlan {
  planVersion: number;
  bandId: string;
  purpose: ApprovalPurpose | null;
  purposeRuleId: string | null;
  aggregateRuleIds: string[];
  raisedByTier: number;
  currency: string | null;
  currencyMismatch: boolean;
  forbidSelfApproval: boolean;
  pendingLevel: number | null;
  signatures: PlannedSignature[];
  plannedAt: string;
  completedAt?: string;
}

export type SignatureVerdict =
  | { ok: true; level: number; complete: boolean; via: 'pinned' | 'role' }
  | { ok: false; code: 'unauthenticated' | 'self_approval' | 'already_signed' | 'under_tier' | 'already_complete'; reason: string; requiredRole?: GlobalRole; level?: number };

// ── defaults (byte-for-byte the server's DEFAULT_APPROVAL_ROUTING) ────────

/** KES → minor units (cents). */
export const kesMinor = (amount: number): number => Math.round(amount * 100);

const SIG = (level: number, label: string, approverRole: GlobalRole): ApprovalSignatureSpec => ({ level, label, approverRole });

export const DEFAULT_SUPPLIER_SPEND_BANDS: ApprovalBandV2[] = [
  { id: 'lead', label: 'Delivery lead', maxAmountMinor: kesMinor(100_000), signatures: [SIG(1, 'Delivery lead', 'manager')] },
  { id: 'brand_md', label: 'Brand MD', maxAmountMinor: kesMinor(1_000_000), signatures: [SIG(1, 'Brand MD', 'admin')] },
  {
    id: 'group',
    label: 'Brand MD + Group CEO',
    maxAmountMinor: kesMinor(5_000_000),
    signatures: [SIG(1, 'Brand MD', 'admin'), SIG(2, 'Zeus Group CEO', 'owner')],
  },
  {
    id: 'board',
    label: 'Brand MD + Group CEO + Group Finance',
    maxAmountMinor: null,
    signatures: [SIG(1, 'Brand MD', 'admin'), SIG(2, 'Zeus Group CEO', 'owner'), SIG(3, 'Group Finance', 'owner')],
  },
];

export const DEFAULT_PURPOSE_RULES: PurposeRule[] = [
  { id: 'media', purpose: 'media', label: 'Media buys', primary: { label: 'Media lead', approverRole: 'manager' } },
  { id: 'production', purpose: 'production', label: 'Production', primary: { label: 'Production lead', approverRole: 'manager' } },
  { id: 'talent', purpose: 'talent', label: 'Talent & freelancers', primary: { label: 'Talent lead', approverRole: 'manager' } },
  { id: 'overhead', purpose: 'overhead', label: 'Overheads & services', primary: { label: 'Brand MD', approverRole: 'admin' } },
];

export const DEFAULT_APPROVAL_ROUTING: ApprovalRoutingConfig = {
  version: 2,
  modules: {
    [SUPPLIER_SPEND]: {
      entityType: SUPPLIER_SPEND,
      label: 'Supplier spend (talent, media, vendor POs)',
      currency: 'KES',
      enabled: true,
      bands: DEFAULT_SUPPLIER_SPEND_BANDS,
      purposeRules: DEFAULT_PURPOSE_RULES,
      aggregateRules: [],
      tierBandRaise: { TIER_1: 1, TIER_2: 0, TIER_3: 0 },
      requirePurpose: true,
      forbidSelfApproval: true,
    },
  },
};
