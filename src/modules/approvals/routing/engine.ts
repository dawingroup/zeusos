/**
 * Approval routing v2 — pure decision logic, TypeScript mirror of
 * `functions/src/approvals/routing.js` (the copy that actually signs).
 *
 * Keeping a twin lets the settings page validate and preview a ladder
 * before it is saved, using exactly the rules the Cloud Function applies.
 * `__tests__/routingLockstep.test.ts` loads both and asserts they agree on
 * a grid of inputs and on every validation case, so the two cannot drift.
 */

import type { GlobalRole } from '@/core/settings/types';
import {
  AGGREGATE_KINDS,
  DEFAULT_APPROVAL_ROUTING,
  PURPOSES,
  ROLE_SENIORITY,
  SUPPLIER_SPEND,
  type AggregateRule,
  type ApprovalBandV2,
  type ApprovalModuleRoutingV2,
  type ApprovalPlan,
  type ApprovalPurpose,
  type ApprovalRoutingConfig,
  type ApprovalSignatureSpec,
  type ApprovalSigner,
  type PurposeRule,
  type RoutedSignature,
  type RoutingDecision,
  type RoutingInput,
  type SignatureVerdict,
} from './types';

// ── seniority ─────────────────────────────────────────────────────────────

export function escalationChainFor(role: string): GlobalRole[] | null {
  const index = ROLE_SENIORITY.indexOf(role as GlobalRole);
  if (index < 0) return null;
  return ROLE_SENIORITY.slice(0, index + 1).reverse();
}

export function isAtLeastAsSenior(role: string | undefined | null, minimumRole: string): boolean {
  const roleIndex = ROLE_SENIORITY.indexOf(role as GlobalRole);
  const minIndex = ROLE_SENIORITY.indexOf(minimumRole as GlobalRole);
  if (roleIndex < 0 || minIndex < 0) return false;
  return roleIndex <= minIndex;
}

/** The purpose (`b`) names level 1 unless the band's floor (`a`) is STRICTLY more senior. */
function moreSeniorSignature<T extends ApprovalSigner>(a: T, b: T): T {
  return isAtLeastAsSenior(b.approverRole, a.approverRole) ? b : a;
}

// ── validation ────────────────────────────────────────────────────────────

function validateSignature(sig: Partial<ApprovalSignatureSpec> | null | undefined, where: string): string[] {
  const errors: string[] = [];
  if (!sig || typeof sig !== 'object') return [`${where}: not an object.`];
  if (!Number.isInteger(sig.level) || (sig.level as number) < 1) errors.push(`${where}: level must be a positive integer.`);
  if (!sig.approverRole || ROLE_SENIORITY.indexOf(sig.approverRole) < 0) {
    errors.push(`${where}: '${sig.approverRole}' is not a valid role.`);
  }
  if (sig.approverEmail != null && typeof sig.approverEmail !== 'string') errors.push(`${where}: approverEmail must be a string.`);
  if (sig.roleProfileId != null && typeof sig.roleProfileId !== 'string') errors.push(`${where}: roleProfileId must be a string.`);
  return errors;
}

function level1Of(band: ApprovalBandV2): ApprovalSignatureSpec | null {
  if (!band || !Array.isArray(band.signatures)) return null;
  return band.signatures.find((s) => s && s.level === 1) ?? null;
}

export function validateBands(bands: ApprovalBandV2[]): string[] {
  const errors: string[] = [];
  if (!Array.isArray(bands) || bands.length === 0) return ['At least one approval band is required.'];

  bands.forEach((band, i) => {
    const where = `Band ${i + 1}${band?.label ? ` (${band.label})` : ''}`;
    if (!band || typeof band !== 'object') {
      errors.push(`${where}: not an object.`);
      return;
    }
    const isLast = i === bands.length - 1;
    if (isLast) {
      if (band.maxAmountMinor !== null && band.maxAmountMinor !== undefined) {
        errors.push(`${where}: the highest band must be unbounded (no upper limit).`);
      }
    } else if (typeof band.maxAmountMinor !== 'number' || !Number.isFinite(band.maxAmountMinor) || band.maxAmountMinor < 0) {
      errors.push(`${where}: needs a non-negative upper limit.`);
    }
    if (!Array.isArray(band.signatures) || band.signatures.length === 0) {
      errors.push(`${where}: needs at least one signature.`);
      return;
    }
    band.signatures.forEach((s, j) => errors.push(...validateSignature(s, `${where}, signature ${j + 1}`)));
    const sorted = band.signatures.map((s) => s?.level).sort((a, b) => a - b);
    if (sorted.some((l, j) => l !== j + 1)) {
      errors.push(`${where}: signature levels must be 1..${band.signatures.length} with no gaps.`);
    }
  });

  for (let i = 1; i < bands.length; i += 1) {
    const prev = bands[i - 1];
    const curr = bands[i];
    if (typeof prev.maxAmountMinor === 'number' && typeof curr.maxAmountMinor === 'number' && curr.maxAmountMinor <= prev.maxAmountMinor) {
      errors.push(`Band ${i + 1} (${curr.label || curr.id}): upper limit must be greater than the band below it.`);
    }
  }

  for (let i = 1; i < bands.length; i += 1) {
    const prev = bands[i - 1];
    const curr = bands[i];
    const prevL1 = level1Of(prev);
    const currL1 = level1Of(curr);
    if (prevL1 && currL1 && !isAtLeastAsSenior(currL1.approverRole, prevL1.approverRole)) {
      errors.push(
        `Band ${i + 1} (${curr.label || curr.id}): level-1 role '${currL1.approverRole}' is more junior than ` +
          `'${prevL1.approverRole}' on the band below it — approval authority cannot decrease as value rises.`,
      );
    }
    if (Array.isArray(prev.signatures) && Array.isArray(curr.signatures) && curr.signatures.length < prev.signatures.length) {
      errors.push(`Band ${i + 1} (${curr.label || curr.id}): needs at least as many signatures as the band below it.`);
    }
  }

  return errors;
}

export function validatePurposeRules(rules: PurposeRule[] | null | undefined): string[] {
  if (rules == null) return [];
  if (!Array.isArray(rules)) return ['purposeRules must be a list.'];
  const errors: string[] = [];
  const seen = new Set<string>();
  rules.forEach((r, i) => {
    const where = `Purpose rule ${i + 1}${r?.label ? ` (${r.label})` : ''}`;
    if (!r || typeof r !== 'object') {
      errors.push(`${where}: not an object.`);
      return;
    }
    if (PURPOSES.indexOf(r.purpose) < 0) errors.push(`${where}: '${r.purpose}' is not a purpose (${PURPOSES.join(', ')}).`);
    if (seen.has(r.purpose)) errors.push(`${where}: purpose '${r.purpose}' has more than one rule.`);
    seen.add(r.purpose);
    if (!r.primary || ROLE_SENIORITY.indexOf(r.primary.approverRole) < 0) errors.push(`${where}: primary signer needs a valid role.`);
    if (r.escalateAboveMinor != null && (typeof r.escalateAboveMinor !== 'number' || r.escalateAboveMinor < 0)) {
      errors.push(`${where}: escalateAboveMinor must be a non-negative amount.`);
    }
    if ((r.escalateAboveMinor != null || r.requireAnyLink) && (!r.escalateTo || ROLE_SENIORITY.indexOf(r.escalateTo.approverRole) < 0)) {
      errors.push(`${where}: escalation needs an 'escalateTo' signer with a valid role.`);
    }
    if (r.escalateTo && r.primary && !isAtLeastAsSenior(r.escalateTo.approverRole, r.primary.approverRole)) {
      errors.push(`${where}: 'escalateTo' must be at least as senior as the primary signer.`);
    }
  });
  return errors;
}

export function validateAggregateRules(rules: AggregateRule[] | null | undefined): string[] {
  if (rules == null) return [];
  if (!Array.isArray(rules)) return ['aggregateRules must be a list.'];
  const errors: string[] = [];
  rules.forEach((r, i) => {
    const where = `Aggregate rule ${i + 1}${r?.label ? ` (${r.label})` : ''}`;
    if (!r || typeof r !== 'object') {
      errors.push(`${where}: not an object.`);
      return;
    }
    if (AGGREGATE_KINDS.indexOf(r.kind) < 0) errors.push(`${where}: '${r.kind}' is not an aggregate kind.`);
    if (r.kind === 'master_job_budget_pct') {
      if (typeof r.thresholdPct !== 'number' || r.thresholdPct <= 0 || r.thresholdPct > 100) errors.push(`${where}: thresholdPct must be 1–100.`);
    } else if (typeof r.thresholdMinor !== 'number' || r.thresholdMinor < 0) {
      errors.push(`${where}: thresholdMinor must be a non-negative amount.`);
    }
    if (r.kind === 'supplier_rolling' && (!Number.isInteger(r.windowDays) || (r.windowDays as number) < 1)) {
      errors.push(`${where}: windowDays must be a positive whole number.`);
    }
    if (!r.adds || ROLE_SENIORITY.indexOf(r.adds.approverRole) < 0) errors.push(`${where}: 'adds' needs a signer with a valid role.`);
  });
  return errors;
}

export function validateTierBandRaise(raise: Record<string, number> | null | undefined): string[] {
  if (raise == null) return [];
  if (typeof raise !== 'object') return ['tierBandRaise must be a map of tier → steps.'];
  return Object.entries(raise)
    .filter(([, steps]) => !Number.isInteger(steps) || steps < 0)
    .map(([tier]) => `tierBandRaise.${tier}: must be a whole number of bands (0 or more).`);
}

export function validateModule(module: ApprovalModuleRoutingV2 | null | undefined): string[] {
  if (!module || typeof module !== 'object') return ['Module is not an object.'];
  return [
    ...validateBands(module.bands),
    ...validatePurposeRules(module.purposeRules),
    ...validateAggregateRules(module.aggregateRules),
    ...validateTierBandRaise(module.tierBandRaise),
  ];
}

export function validateApprovalRouting(config: ApprovalRoutingConfig): Record<string, string[]> {
  const byModule: Record<string, string[]> = {};
  for (const [entityType, module] of Object.entries(config?.modules ?? {})) {
    const errors = validateModule(module);
    if (errors.length) byModule[entityType] = errors;
  }
  return byModule;
}

// ── routing ───────────────────────────────────────────────────────────────

export function moduleFor(config: ApprovalRoutingConfig | null | undefined, entityType: string = SUPPLIER_SPEND): ApprovalModuleRoutingV2 | null {
  const stored = config?.modules?.[entityType];
  const fallback = DEFAULT_APPROVAL_ROUTING.modules[entityType];
  if (stored && stored.enabled !== false && Array.isArray(stored.bands) && stored.bands.length > 0) return stored;
  return fallback ?? null;
}

export function bandIndexForAmount(bands: ApprovalBandV2[], amountMinor: number): number {
  const value = typeof amountMinor === 'number' && Number.isFinite(amountMinor) ? amountMinor : 0;
  const idx = bands.findIndex((b) => b.maxAmountMinor === null || b.maxAmountMinor === undefined || value <= b.maxAmountMinor);
  return idx < 0 ? bands.length - 1 : idx;
}

export function bandForAmount(bands: ApprovalBandV2[], amountMinor: number): ApprovalBandV2 {
  return bands[bandIndexForAmount(bands, amountMinor)];
}

export function aggregateTrips(rule: AggregateRule, amountMinor: number, aggregates: RoutingInput['aggregates']): boolean {
  const agg = aggregates ?? {};
  const amount = Number.isFinite(amountMinor) ? amountMinor : 0;
  switch (rule.kind) {
    case 'supplier_rolling':
      return agg.supplierRollingMinor != null && agg.supplierRollingMinor + amount > (rule.thresholdMinor as number);
    case 'weekly_cash':
      return agg.weeklyCashMinor != null && agg.weeklyCashMinor + amount > (rule.thresholdMinor as number);
    case 'master_job_budget_pct':
      if (agg.masterJobBudgetPct === undefined) return false;
      if (agg.masterJobBudgetPct === null) return true;
      return agg.masterJobBudgetPct >= (rule.thresholdPct as number);
    default:
      return false;
  }
}

const signerKey = (s: ApprovalSigner): string =>
  s.approverEmail ? `email:${String(s.approverEmail).toLowerCase()}` : s.roleProfileId ? `profile:${s.roleProfileId}` : `role:${s.approverRole}:${s.label || ''}`;

export function routingDecisionFor(input: RoutingInput, config: ApprovalRoutingConfig = DEFAULT_APPROVAL_ROUTING): RoutingDecision {
  const module = moduleFor(config, SUPPLIER_SPEND);
  if (!module) return { enabled: false };
  const { amountMinor } = input;
  const purpose = PURPOSES.indexOf(input.purpose as ApprovalPurpose) >= 0 ? (input.purpose as ApprovalPurpose) : null;
  if (!purpose && module.requirePurpose) return { enabled: true, refusal: 'purpose_required', purpose: null };

  const bands = module.bands;
  let bandIndex = bandIndexForAmount(bands, amountMinor);
  const raise = module.tierBandRaise && input.tier && Number.isInteger(module.tierBandRaise[input.tier]) ? module.tierBandRaise[input.tier] : 0;
  const raisedByTier = Math.min(bandIndex + raise, bands.length - 1) - bandIndex;
  bandIndex += raisedByTier;
  const band = bands[bandIndex];

  let sigs: Array<ApprovalSignatureSpec> = band.signatures.map((s) => ({ ...s })).sort((a, b) => a.level - b.level);

  const rule = purpose ? (module.purposeRules ?? []).find((r) => r.purpose === purpose) : undefined;
  let purposeRuleId: string | null = null;
  if (rule) {
    purposeRuleId = rule.id || rule.purpose;
    let primary: ApprovalSigner = rule.primary;
    const links = input.links ?? {};
    if (rule.requireAnyLink && !links.masterJobId) primary = rule.escalateTo ?? primary;
    if (rule.escalateAboveMinor != null && amountMinor > rule.escalateAboveMinor) primary = rule.escalateTo ?? primary;
    const winner = moreSeniorSignature<ApprovalSignatureSpec>({ ...sigs[0] }, { level: 1, ...primary });
    sigs[0] = { ...winner, level: 1 };
  }

  const aggregateRuleIds: string[] = [];
  for (const agg of module.aggregateRules ?? []) {
    if (!aggregateTrips(agg, amountMinor, input.aggregates)) continue;
    aggregateRuleIds.push(agg.id || agg.kind);
    const level = agg.adds && Number.isInteger(agg.adds.level) ? (agg.adds.level as number) : 2;
    const candidate: ApprovalSignatureSpec = { ...agg.adds, level };
    const covered = sigs.some((s) => signerKey(s) === signerKey(candidate) && s.level <= level);
    if (!covered) sigs.push(candidate);
  }

  const byKey = new Map<string, ApprovalSignatureSpec>();
  for (const s of sigs) {
    const k = signerKey(s);
    const prev = byKey.get(k);
    if (!prev || s.level < prev.level) byKey.set(k, s);
  }
  const signatures: RoutedSignature[] = [...byKey.values()]
    .sort((a, b) => a.level - b.level)
    .map((s, i) => ({
      level: i + 1,
      label: s.label,
      approverRole: s.approverRole,
      approverEmail: s.approverEmail || null,
      roleProfileId: s.roleProfileId || null,
      roleChain: (escalationChainFor(s.approverRole) ?? escalationChainFor('owner')) as GlobalRole[],
    }));

  const currency = module.currency || null;
  const recordCurrency = input.currency ? String(input.currency).toUpperCase() : null;
  return {
    enabled: true,
    band,
    bandIndex,
    raisedByTier,
    purpose,
    purposeRuleId,
    aggregateRuleIds,
    signatures,
    currency,
    currencyMismatch: !!(currency && recordCurrency && recordCurrency !== String(currency).toUpperCase()),
    forbidSelfApproval: module.forbidSelfApproval !== false,
    planVersion: config?.version ?? DEFAULT_APPROVAL_ROUTING.version,
  };
}

export function planFromDecision(decision: RoutingDecision, now: string): ApprovalPlan {
  return {
    planVersion: decision.planVersion as number,
    bandId: (decision.band as ApprovalBandV2).id,
    purpose: decision.purpose ?? null,
    purposeRuleId: decision.purposeRuleId ?? null,
    aggregateRuleIds: decision.aggregateRuleIds ?? [],
    raisedByTier: decision.raisedByTier ?? 0,
    currency: decision.currency ?? null,
    currencyMismatch: !!decision.currencyMismatch,
    forbidSelfApproval: decision.forbidSelfApproval !== false,
    pendingLevel: 1,
    signatures: (decision.signatures ?? []).map((s) => ({
      level: s.level,
      label: s.label,
      approverRole: s.approverRole,
      approverEmail: s.approverEmail ?? null,
      roleProfileId: s.roleProfileId ?? null,
      approvedBy: null,
      approvedByName: null,
      approvedAt: null,
      via: null,
    })),
    plannedAt: now,
  };
}

export function planSignature(args: {
  plan: ApprovalPlan;
  caller: { uid: string; role?: string | null; email?: string | null } | null | undefined;
  raiserUid?: string | null;
  pinnedUids?: string[];
}): SignatureVerdict {
  const { plan, caller, raiserUid, pinnedUids } = args;
  const signatures = [...(plan?.signatures ?? [])].sort((a, b) => a.level - b.level);
  if (!caller || !caller.uid) return { ok: false, code: 'unauthenticated', reason: 'Sign in first.' };
  const pending = signatures.filter((s) => !s.approvedBy);
  if (pending.length === 0) return { ok: false, code: 'already_complete', reason: 'This record already has every signature it needs.' };
  const next = pending[0];

  if (plan.forbidSelfApproval !== false && raiserUid && caller.uid === raiserUid) {
    return { ok: false, code: 'self_approval', reason: 'You raised this — someone else has to approve it.', level: next.level };
  }
  if (signatures.some((s) => s.approvedBy === caller.uid)) {
    return { ok: false, code: 'already_signed', reason: 'You have already signed this at another level; a different person signs the next one.', level: next.level };
  }

  const email = caller.email ? String(caller.email).toLowerCase() : null;
  const pinnedByEmail = !!(next.approverEmail && email && String(next.approverEmail).toLowerCase() === email);
  const pinnedByProfile = Array.isArray(pinnedUids) && pinnedUids.includes(caller.uid);
  if (pinnedByEmail || pinnedByProfile) return { ok: true, level: next.level, complete: pending.length === 1, via: 'pinned' };
  if (isAtLeastAsSenior(caller.role, next.approverRole)) return { ok: true, level: next.level, complete: pending.length === 1, via: 'role' };
  return {
    ok: false,
    code: 'under_tier',
    reason: `Level ${next.level} (${next.label}) needs ${next.approverRole} approval.`,
    requiredRole: next.approverRole,
    level: next.level,
  };
}

// ── display ───────────────────────────────────────────────────────────────

export function lowerBoundOf(bands: ApprovalBandV2[], index: number): number {
  if (index === 0) return 0;
  const prev = bands[index - 1]?.maxAmountMinor;
  return typeof prev === 'number' ? prev : 0;
}

/** "0 – 100,000 KES" / "Above 5,000,000 KES" — the band's range in whole units. */
export function describeRange(bands: ApprovalBandV2[], index: number, currency: string): string {
  const band = bands[index];
  const from = lowerBoundOf(bands, index) / 100;
  const fmt = (n: number) => n.toLocaleString('en-US');
  if (band.maxAmountMinor === null || band.maxAmountMinor === undefined) return `Above ${fmt(from)} ${currency}`;
  return `${fmt(from)} – ${fmt(band.maxAmountMinor / 100)} ${currency}`;
}
