/**
 * AI usage & cost — reads for the page, and the policy write.
 *
 * Reads the ROLLUPS, never the raw `ai_usage_events` collection: a busy day is
 * thousands of rows and the hourly job has already answered the question. The
 * one exception is the waste drill-down, a bounded, indexed slice of raw rows.
 */
import { collection, doc, getDoc, getDocs, limit as fsLimit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import { setDoc } from '@/shared/services/firebase/firestore-writes';
import { withTimeout } from '@/shared/utils/withTimeout';
import type { AiPolicy, AiUsageBreakdown, AiUsageBucket, AiUsageDaily, AiUsageMonthly, AiUsageRow, AiWasteFinding } from '../types/aiUsage';

export const DAILY_COLLECTION = 'ai_usage_daily';
export const MONTHLY_COLLECTION = 'ai_usage_monthly';
export const EVENTS_COLLECTION = 'ai_usage_events';
export const POLICY_COLLECTION = 'ai_policy';
export const POLICY_DOC = 'global';

/** yyyy-mm-dd in UTC — the rollup's key space. */
export function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
export function toMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export const EMPTY_BUCKET: AiUsageBucket = {
  calls: 0, okCalls: 0, wasteCalls: 0,
  inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
  thoughtTokens: 0, searches: 0, costUsd: 0, costUgx: 0, wasteCostUsd: 0,
};

/** The last `days` daily documents, oldest first. A missing day is absent, not zero. */
export async function getRecentDays(days = 30): Promise<AiUsageDaily[]> {
  const from = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
  const snap = await withTimeout(getDocs(query(collection(db, DAILY_COLLECTION), where('date', '>=', toDayKey(from)), orderBy('date', 'asc'))), 'getRecentDays', 15000);
  return snap.docs.map((d) => d.data() as AiUsageDaily);
}

export async function getMonth(monthKey: string): Promise<AiUsageMonthly | null> {
  const snap = await withTimeout(getDoc(doc(db, MONTHLY_COLLECTION, monthKey)), 'getMonth', 15000);
  return snap.exists() ? (snap.data() as AiUsageMonthly) : null;
}

export async function getPolicy(): Promise<AiPolicy> {
  const snap = await withTimeout(getDoc(doc(db, POLICY_COLLECTION, POLICY_DOC)), 'getPolicy', 15000);
  const d = (snap.exists() ? snap.data() : {}) as Partial<AiPolicy>;
  return {
    monthlyBudgetUsd: typeof d.monthlyBudgetUsd === 'number' ? d.monthlyBudgetUsd : null,
    dailyBudgetUsd: typeof d.dailyBudgetUsd === 'number' ? d.dailyBudgetUsd : null,
    alertThresholds: Array.isArray(d.alertThresholds) && d.alertThresholds.length ? d.alertThresholds : [0.5, 0.8, 1.0],
    ugxPerUsd: typeof d.ugxPerUsd === 'number' ? d.ugxPerUsd : null,
    features: d.features ?? {},
    agents: d.agents ?? {},
  };
}

/** Merged, never replaced: two admins editing different halves must not erase each other. Admin-only by the rules. */
export async function savePolicy(patch: Partial<AiPolicy>): Promise<void> {
  await setDoc(doc(db, POLICY_COLLECTION, POLICY_DOC), patch, { merge: true });
}

/** Pause or resume one feature without touching the rest of the policy. */
export async function setFeatureEnabled(feature: string, enabled: boolean, note?: string): Promise<void> {
  await setDoc(doc(db, POLICY_COLLECTION, POLICY_DOC), { features: { [feature]: { enabled, ...(note ? { note } : {}) } } }, { merge: true });
}

/** The most recent wasted calls — the one read that touches raw rows. */
export async function getRecentWaste(max = 50) {
  const snap = await withTimeout(getDocs(query(collection(db, EVENTS_COLLECTION), where('isWaste', '==', true), orderBy('createdAt', 'desc'), fsLimit(max))), 'getRecentWaste', 15000);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown> & { id: string });
}

// ── derivations — pure ────────────────────────────────────────────────────────

function mergeInto(a: AiUsageBucket, b: Partial<AiUsageBucket>) {
  for (const k of Object.keys(EMPTY_BUCKET) as (keyof AiUsageBucket)[]) a[k] += Number(b[k]) || 0;
}

export function sumDays(days: AiUsageDaily[]): AiUsageBucket {
  const out = { ...EMPTY_BUCKET };
  for (const d of days) mergeInto(out, d);
  return out;
}

export function mergeBreakdown(days: AiUsageDaily[], dimension: keyof AiUsageDaily): AiUsageBreakdown {
  const out: AiUsageBreakdown = {};
  for (const day of days) {
    const group = day[dimension] as AiUsageBreakdown | undefined;
    if (!group) continue;
    for (const [key, bucket] of Object.entries(group)) {
      if (!out[key]) out[key] = { ...EMPTY_BUCKET };
      mergeInto(out[key], bucket);
    }
  }
  return out;
}

/** Table rows, most expensive first. Cost per successful call is what compares two features. */
export function toRows(breakdown: AiUsageBreakdown): AiUsageRow[] {
  const totalCost = Object.values(breakdown).reduce((a, b) => a + (b.costUsd || 0), 0);
  return Object.entries(breakdown)
    .map(([key, b]) => ({
      ...b,
      key,
      successRate: b.calls > 0 ? b.okCalls / b.calls : 0,
      costPerOkCallUsd: b.okCalls > 0 ? b.costUsd / b.okCalls : b.costUsd,
      shareOfCost: totalCost > 0 ? b.costUsd / totalCost : 0,
    }))
    .sort((a, b) => b.costUsd - a.costUsd);
}

/** Straight-line projection of the month from the days so far. */
export function projectMonth(month: AiUsageMonthly | null, now = new Date()): number | null {
  if (!month || !month.days) return null;
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  return (month.costUsd / month.days) * daysInMonth;
}

/** The waste finder: known failure patterns ranked by what they cost. A pattern with no cost is omitted. */
export function findWaste(days: AiUsageDaily[]): AiWasteFinding[] {
  const totals = sumDays(days);
  const findings: AiWasteFinding[] = [];
  if (totals.wasteCostUsd > 0) {
    findings.push({
      id: 'failed-calls',
      title: 'Calls billed that produced nothing usable',
      detail: 'Empty responses, unparseable answers, refusals and provider errors. Each one was charged for its tokens and threw the answer away.',
      calls: totals.wasteCalls,
      costUsd: totals.wasteCostUsd,
      severity: totals.wasteCostUsd > totals.costUsd * 0.1 ? 'critical' : 'warning',
    });
  }
  const retryCalls = days.reduce((a, d) => a + (d.retryCalls || 0), 0);
  if (retryCalls > 0) {
    findings.push({ id: 'retries', title: 'Repeat attempts at the same call', detail: 'A retried call is billed for every attempt. A high count points at a failing prompt or a struggling provider.', calls: retryCalls, costUsd: 0, severity: 'info' });
  }
  const unpricedCalls = days.reduce((a, d) => a + (d.unpricedCalls || 0), 0);
  if (unpricedCalls > 0) {
    findings.push({ id: 'unpriced', title: 'Calls to a model with no published rate', detail: 'Counted but costed at zero, so the totals on this page understate the real bill until the model is added to the pricing registry.', calls: unpricedCalls, costUsd: 0, severity: 'critical' });
  }
  const cacheable = totals.inputTokens + totals.cacheReadTokens;
  const hitRate = cacheable > 0 ? totals.cacheReadTokens / cacheable : 0;
  if (cacheable > 0 && hitRate < 0.2) {
    findings.push({ id: 'cold-cache', title: 'Prompts being re-read at full price', detail: `Only ${(hitRate * 100).toFixed(1)}% of promptable tokens came from cache. Repeated system prompts and tool schemas are being charged in full on every call.`, calls: totals.calls, costUsd: 0, severity: hitRate < 0.05 ? 'warning' : 'info' });
  }
  return findings.sort((a, b) => b.costUsd - a.costUsd);
}
