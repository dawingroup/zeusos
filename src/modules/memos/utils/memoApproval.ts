/**
 * Memo approval tier — TypeScript mirror of
 * functions/src/memos/lib/memoApprovalRouting.js, the copy the callable runs.
 * __tests__/memoLockstep.test.ts pins the two; change both or neither.
 *
 * The most senior of three inputs decides:
 *   band    the amount ladder for `memo_<category>` on systemSettings/
 *           approvalRouting (a v2 module; ships absent = off)
 *   impact  low → none, medium → manager, high → admin
 *   type    decision / request → manager, directive → admin, info / record → none
 * so impact and type can only RAISE the band's answer, never lower it.
 */

import type { GlobalRole } from '@/core/settings/types';
import type { MemoCategory, MemoImpact, MemoRoutingEntityType, MemoType } from '../types/memo';

/** GlobalRole, most senior first. */
export const ROLE_SENIORITY: GlobalRole[] = ['owner', 'admin', 'manager', 'member', 'viewer'];

export const ROLE_LABELS: Record<GlobalRole, string> = {
  owner: 'Group CEO / owner',
  admin: 'Brand MD / director',
  manager: 'Manager',
  member: 'Member',
  viewer: 'Viewer',
};

export function isAtLeastAsSenior(role: string | null | undefined, minimum: string | null | undefined): boolean {
  const r = ROLE_SENIORITY.indexOf(role as GlobalRole);
  const m = ROLE_SENIORITY.indexOf(minimum as GlobalRole);
  if (r < 0 || m < 0) return false;
  return r <= m;
}

export function escalationChainFor(role: GlobalRole): GlobalRole[] {
  const i = ROLE_SENIORITY.indexOf(role);
  if (i < 0) return ['manager', 'admin', 'owner'];
  return ROLE_SENIORITY.slice(0, i + 1).reverse();
}

export const IMPACT_MINIMUM_ROLE: Record<MemoImpact, GlobalRole | null> = { low: null, medium: 'manager', high: 'admin' };

export const TYPE_MINIMUM_ROLE: Record<MemoType, GlobalRole | null> = {
  decision: 'manager',
  request: 'manager',
  information: null,
  directive: 'admin',
  record: null,
};

const MEMO_CATEGORY_SET: ReadonlySet<string> = new Set(['finance', 'admin', 'operations']);

export function memoRoutingEntityType(category: MemoCategory | string | undefined): MemoRoutingEntityType {
  const c = category && MEMO_CATEGORY_SET.has(category) ? category : 'operations';
  return `memo_${c}` as MemoRoutingEntityType;
}

export function mostSeniorRole(roles: Array<GlobalRole | string | null | undefined>): GlobalRole | null {
  let best: GlobalRole | null = null;
  let bestIndex = Infinity;
  for (const role of roles) {
    if (!role) continue;
    const index = ROLE_SENIORITY.indexOf(role as GlobalRole);
    if (index < 0) continue;
    if (index < bestIndex) {
      bestIndex = index;
      best = role as GlobalRole;
    }
  }
  return best;
}

/** The slice of `systemSettings/approvalRouting` the memo tier reads. */
export interface MemoBandSignature { approverRole: GlobalRole | string; level?: number; label?: string }
export interface MemoBand { id?: string; label?: string; maxAmountMinor: number | null; signatures?: MemoBandSignature[]; approverRole?: string }
export interface MemoRoutingModule { enabled?: boolean; currency?: string; bands?: MemoBand[] }
export interface MemoRoutingConfig { version: number; modules: Record<string, MemoRoutingModule | undefined> }

export const EMPTY_MEMO_ROUTING: MemoRoutingConfig = { version: 0, modules: {} };

export function memoBandFor(entityType: string, amountMinor: number, config: MemoRoutingConfig) {
  const mod = config?.modules?.[entityType];
  if (!mod || mod.enabled !== true || !Array.isArray(mod.bands) || !mod.bands.length) {
    return { enabled: false, band: null as MemoBand | null, approverRole: null as GlobalRole | null, currency: null as string | null };
  }
  const amount = Number(amountMinor) || 0;
  const sorted = [...mod.bands].sort((a, b) => {
    const am = a.maxAmountMinor == null ? Infinity : Number(a.maxAmountMinor);
    const bm = b.maxAmountMinor == null ? Infinity : Number(b.maxAmountMinor);
    return am - bm;
  });
  const band = sorted.find((b) => b.maxAmountMinor == null || amount <= Number(b.maxAmountMinor)) ?? sorted[sorted.length - 1];
  const roles = Array.isArray(band.signatures) ? band.signatures.map((s) => s?.approverRole) : [band.approverRole];
  return { enabled: true, band, approverRole: mostSeniorRole(roles), currency: mod.currency ?? null };
}

export interface MemoApprovalResolution {
  required: boolean;
  entityType: MemoRoutingEntityType;
  bandEnabled: boolean;
  bandId: string | null;
  bandLabel: string | null;
  bandRole: GlobalRole | null;
  impactMinimumRole: GlobalRole | null;
  typeMinimumRole: GlobalRole | null;
  effectiveRole: GlobalRole | null;
  roleChain: GlobalRole[] | null;
  raisedBy: 'band' | 'impact' | 'type' | null;
  currencyMismatch: boolean;
}

export interface MemoApprovalInput {
  type?: MemoType | string;
  category?: MemoCategory | string;
  impact?: MemoImpact | string;
  amountMinor?: number | null;
  currency?: string | null;
}

export function resolveMemoApproval(memo: MemoApprovalInput, config: MemoRoutingConfig = EMPTY_MEMO_ROUTING): MemoApprovalResolution {
  const entityType = memoRoutingEntityType(memo.category);
  const amount = Number(memo.amountMinor) || 0;
  const band = memoBandFor(entityType, amount, config ?? EMPTY_MEMO_ROUTING);
  const hasAmount = amount > 0;
  const bandRole = hasAmount && band.enabled ? band.approverRole : null;
  const impactRole =
    memo.impact && Object.prototype.hasOwnProperty.call(IMPACT_MINIMUM_ROLE, memo.impact) ? IMPACT_MINIMUM_ROLE[memo.impact as MemoImpact] : null;
  const typeRole =
    memo.type && Object.prototype.hasOwnProperty.call(TYPE_MINIMUM_ROLE, memo.type) ? TYPE_MINIMUM_ROLE[memo.type as MemoType] : null;

  const effectiveRole = mostSeniorRole([bandRole, impactRole, typeRole]);
  const required = effectiveRole != null;

  let raisedBy: MemoApprovalResolution['raisedBy'] = null;
  if (required) {
    if (bandRole === effectiveRole) raisedBy = 'band';
    else if (impactRole === effectiveRole) raisedBy = 'impact';
    else raisedBy = 'type';
  }

  return {
    required,
    entityType,
    bandEnabled: band.enabled === true,
    bandId: hasAmount && band.band ? band.band.id ?? null : null,
    bandLabel: hasAmount && band.band ? band.band.label ?? null : null,
    bandRole,
    impactMinimumRole: impactRole,
    typeMinimumRole: typeRole,
    effectiveRole,
    roleChain: required && effectiveRole ? escalationChainFor(effectiveRole) : null,
    raisedBy,
    currencyMismatch: Boolean(hasAmount && band.enabled && band.currency && memo.currency && band.currency !== memo.currency),
  };
}

/** Human line for the editor: "Brand MD / director approval (raised by impact)". */
export function describeMemoApproval(r: MemoApprovalResolution): string {
  if (!r.required) return 'No approval required — issues on submit';
  const who = ROLE_LABELS[r.effectiveRole as GlobalRole] ?? r.effectiveRole;
  const why = r.raisedBy === 'band' ? `amount band: ${r.bandLabel ?? r.bandId}` : r.raisedBy === 'impact' ? 'raised by impact' : 'set by memo type';
  return `${who} approval (${why})`;
}
