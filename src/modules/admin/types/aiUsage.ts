/**
 * AI usage & cost — the shapes the AI usage page reads. They mirror what
 * `functions/src/ai-usage/rollupCore.js` writes to `ai_usage_daily/{yyyy-mm-dd}`
 * and `ai_usage_monthly/{yyyy-mm}`, and what `functions/src/utils/aiPolicy.js`
 * reads from `ai_policy/global`.
 */

/** One aggregation bucket — the totals for a day, or for one slice of it. */
export interface AiUsageBucket {
  calls: number;
  okCalls: number;
  /** Calls that were billed and produced nothing usable. */
  wasteCalls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Gemini reasoning tokens, billed at the output rate. */
  thoughtTokens: number;
  searches: number;
  costUsd: number;
  costUgx: number;
  wasteCostUsd: number;
}

export type AiUsageBreakdown = Record<string, AiUsageBucket>;

export interface AiUsageDaily extends AiUsageBucket {
  /** yyyy-mm-dd, UTC. */
  date: string;
  unpricedCalls: number;
  fallbackCalls: number;
  retryCalls: number;
  cacheHitRate: number;
  successRate: number;
  latencyMsP50: number;
  latencyMsP95: number;
  truncated?: boolean;
  rowsRead?: number;
  alertsFired?: number[];
  budgetUsd?: number;
  byFeature: AiUsageBreakdown;
  byModel: AiUsageBreakdown;
  byProvider: AiUsageBreakdown;
  byTrigger: AiUsageBreakdown;
  bySubsidiary: AiUsageBreakdown;
  byAgent: AiUsageBreakdown;
  byUser: AiUsageBreakdown;
}

export interface AiUsageMonthly extends AiUsageBucket {
  /** yyyy-mm */
  month: string;
  days: number;
  cacheHitRate: number;
  successRate: number;
  alertsFired?: number[];
  budgetUsd?: number;
  byFeature: AiUsageBreakdown;
  byModel: AiUsageBreakdown;
  byProvider: AiUsageBreakdown;
  byAgent: AiUsageBreakdown;
  bySubsidiary: AiUsageBreakdown;
}

export interface AiFeaturePolicy {
  enabled?: boolean;
  note?: string;
}

export interface AiPolicy {
  monthlyBudgetUsd: number | null;
  dailyBudgetUsd: number | null;
  /** Fractions of budget at which an alert fires, e.g. [0.5, 0.8, 1.0]. */
  alertThresholds: number[];
  ugxPerUsd: number | null;
  features: Record<string, AiFeaturePolicy>;
  agents: Record<string, AiFeaturePolicy>;
}

/** A row in one of the page's breakdown tables. */
export interface AiUsageRow extends AiUsageBucket {
  key: string;
  successRate: number;
  /** Cost divided by calls that actually produced something usable. */
  costPerOkCallUsd: number;
  shareOfCost: number;
}

export interface AiWasteFinding {
  id: string;
  title: string;
  detail: string;
  calls: number;
  costUsd: number;
  severity: 'critical' | 'warning' | 'info';
}
