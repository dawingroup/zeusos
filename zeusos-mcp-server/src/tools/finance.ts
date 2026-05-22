import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  queryCollection,
  getDb,
  formatCurrency,
  formatTimestamp,
} from '../services/firebase.js';
import type { QueryFilter } from '../services/firebase.js';
import { callCloudFunction } from '../services/callFunction.js';
import { COMPANY_PATHS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, getRequiredCompanyId } from '../constants.js';

interface ExpenditureItem {
  id: string;
  amountUGX?: number;
  type?: string;
  status?: string;
  tier?: string;
  linkedDocId?: string;
  linkedDocType?: string;
  urgency?: { latestDate?: string; daysLeft?: number };
  revenueUnlock?: { enabled?: boolean; unlockMultiplier?: number };
  scores?: { composite?: number; urgency?: number; revenueUnlock?: number; risk?: number };
  createdAt?: unknown;
}

interface SpendPlan {
  id: string;
  date?: string;
  status?: string;
  generatedAt?: unknown;
  openingBankBalance?: number;
  totalOutflow?: number;
  totalInflow?: number;
  savingsAllocation?: number;
  closingBalance?: number;
  scheduledExpenditures?: Array<Record<string, unknown>>;
  deferredExpenditures?: Array<Record<string, unknown>>;
  riskFlags?: Array<Record<string, unknown>>;
  actionItems?: unknown[];
}

export function registerFinanceTools(server: McpServer): void {
  const companyId = getRequiredCompanyId();

  // ─── zeusos_expenditure_queue ────────────────────────────────────────────────
  server.registerTool('zeusos_expenditure_queue', {
    title: 'Expenditure Queue & Priority Scores',
    description: `View the prioritised expenditure queue — all pending payments scored across 6 dimensions (urgency, revenue unlock, risk, cash position, supplier relationship, operational criticality).

Shows which bills/payments should be paid today, which can be deferred, and why. Essential for cash management decisions.`,
    inputSchema: {
      status: z.enum(['pending', 'allocated', 'approved', 'paid']).optional()
        .describe('Filter by status (default: pending + allocated)'),
      tier: z.enum(['critical', 'high', 'medium', 'low']).optional()
        .describe('Filter by priority tier'),
      limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional()
        .describe(`Max records (default: ${DEFAULT_PAGE_SIZE})`),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const filters: QueryFilter[] = [];
      if (params.status) {
        filters.push({ field: 'status', op: '==', value: params.status });
      } else {
        filters.push({ field: 'status', op: 'in', value: ['pending', 'allocated'] });
      }
      if (params.tier) filters.push({ field: 'tier', op: '==', value: params.tier });

      const { items, total } = await queryCollection<ExpenditureItem>(
        COMPANY_PATHS.expenditureQueue(),
        {
          filters,
          orderByField: 'scores.composite',
          orderByDirection: 'desc',
          limit: params.limit ?? DEFAULT_PAGE_SIZE,
        }
      );

      if (!items.length) {
        return { content: [{ type: 'text' as const, text: 'No expenditures in queue.' }] };
      }

      const totalAmount = items.reduce((s, d) => s + (Number(d.amountUGX) || 0), 0);

      const lines = [
        `**Expenditure Queue** (${items.length} of ${total})  |  Total: ${formatCurrency(totalAmount, 'UGX')}`,
        '',
        '| Tier | Type | Amount (UGX) | Due | Score | Rev Unlock | Status |',
        '|------|------|-------------|-----|-------|------------|--------|',
      ];

      for (const d of items) {
        const score = d.scores?.composite?.toFixed(2) ?? '—';
        const revUnlock = d.revenueUnlock?.enabled
          ? `✓ ×${d.revenueUnlock.unlockMultiplier?.toFixed(1) ?? '?'}`
          : '—';
        const dueDate = d.urgency?.latestDate
          ? String(d.urgency.latestDate).substring(0, 10)
          : '—';

        lines.push(
          `| ${d.tier ?? '—'} | ${d.type ?? '—'} | ${formatCurrency(Number(d.amountUGX) || 0, 'UGX')} | ${dueDate} | ${score} | ${revUnlock} | ${d.status ?? '—'} |`
        );
      }

      lines.push('', '_Score 0–1: higher = pay sooner. Rev unlock ×N = paying unlocks N× revenue._');

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── zeusos_run_cash_flow_scenario ──────────────────────────────────────────
  server.registerTool('zeusos_run_cash_flow_scenario', {
    title: 'Run Cash Flow Scenario',
    description: `Model the financial impact of a decision before committing. Runs a what-if analysis against the current cash position and expenditure queue.

Modification types:
- delay_payment: Delay paying a bill (days + optional amount)
- late_receipt: A client payment comes in late
- cash_injection: An unexpected inflow (e.g. investor, sale)
- cost_increase: Material or operating cost rise

Returns: baseline vs modified cash position, risk level, insights, tradeoffs, recommendations.`,
    inputSchema: {
      scenario_name: z.string().describe('Short label (e.g. "Delay Crane Hire 30 days")'),
      description: z.string().optional().describe('What you are modelling'),
      modifications: z.array(z.object({
        type: z.enum(['delay_payment', 'late_receipt', 'cash_injection', 'cost_increase']),
        amount: z.number().optional().describe('UGX amount affected'),
        days: z.number().int().optional().describe('Days to delay/advance'),
        description: z.string().optional().describe('Which payment or receipt this applies to'),
      })).min(1),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const result = await callCloudFunction<unknown, {
        success: boolean;
        scenarioId: string;
        result: {
          scenarioName: string;
          baseline: { cashPosition: number; totalPending: number; criticalCount: number };
          modified: { cashPosition: number; totalPending: number };
          analysis: {
            impact: 'positive' | 'negative' | 'neutral';
            impactSummary: string;
            cashPositionChange: number;
            riskAssessment: 'low' | 'medium' | 'high' | 'critical';
            recommendations: string[];
            keyInsights: string[];
            tradeoffs: string[];
          };
        };
      }>('runCashFlowScenario', {
        companyId,
        scenario: {
          name: params.scenario_name,
          description: params.description,
          modifications: params.modifications,
        },
      });

      const r = result.result;
      const a = r.analysis;

      const lines = [
        `**Cash Flow Scenario: ${r.scenarioName}**`,
        `ID: ${result.scenarioId}`,
        '',
        '| | Baseline | Modified | Change |',
        '|---|---------|---------|--------|',
        `| Cash Position | ${formatCurrency(r.baseline.cashPosition, 'UGX')} | ${formatCurrency(r.modified.cashPosition, 'UGX')} | ${formatCurrency(a.cashPositionChange, 'UGX')} |`,
        `| Total Pending | ${formatCurrency(r.baseline.totalPending, 'UGX')} | ${formatCurrency(r.modified.totalPending, 'UGX')} | — |`,
        `| Critical Items | ${r.baseline.criticalCount} | — | — |`,
        '',
        `**Impact:** ${a.impact === 'negative' ? '⚠' : '✓'} ${a.impactSummary}`,
        `**Risk:** ${a.riskAssessment.toUpperCase()}`,
        '',
      ];

      if (a.keyInsights?.length) {
        lines.push('**Key Insights:**', ...a.keyInsights.map(i => `• ${i}`), '');
      }
      if (a.tradeoffs?.length) {
        lines.push('**Tradeoffs:**', ...a.tradeoffs.map(t => `↔ ${t}`), '');
      }
      if (a.recommendations?.length) {
        lines.push('**Recommendations:**', ...a.recommendations.map(r => `→ ${r}`));
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── zeusos_generate_spend_plan ──────────────────────────────────────────────
  server.registerTool('zeusos_generate_spend_plan', {
    title: 'Generate Daily Spend Plan',
    description: `Generate a prioritised payment plan: which bills to pay today given available cash, using 6-dimension scoring. Supersedes any prior plan for the same date.

After generating, use \`zeusos_get_spend_plan\` (without an ID) to see the full scheduled vs deferred breakdown.`,
    inputSchema: {
      bank_balance: z.number().optional()
        .describe('Current bank balance in UGX (blank = use last QBO sync value)'),
      savings_balance: z.number().optional()
        .describe('Current savings/reserve balance in UGX'),
      date: z.string().optional()
        .describe('Plan date YYYY-MM-DD (default: today)'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const result = await callCloudFunction<unknown, {
        success: boolean;
        planId: string;
        mandatoryCount: number;
        totalMandatory: number;
        isCrisis: boolean;
      }>('generateSpendPlan', {
        companyId,
        bankBalance: params.bank_balance,
        savingsBalance: params.savings_balance,
        date: params.date,
      });

      const crisisNote = result.isCrisis
        ? '\n⚠ **CRISIS MODE** — insufficient funds for mandatory payments.'
        : '';

      return {
        content: [{
          type: 'text' as const,
          text: [
            `**Spend Plan Generated**${crisisNote}`,
            `Plan ID: \`${result.planId}\``,
            `Mandatory payments: ${result.mandatoryCount} items — ${formatCurrency(result.totalMandatory, 'UGX')}`,
            '',
            `Run \`zeusos_get_spend_plan\` to see the full payment schedule and deferred items.`,
          ].join('\n'),
        }],
      };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── zeusos_get_spend_plan ───────────────────────────────────────────────────
  server.registerTool('zeusos_get_spend_plan', {
    title: 'Get Spend Plan Details',
    description: `Retrieve a spend plan — full scheduled payment list, deferred items, cash flow projection, risk flags, and action items. Leave plan_id blank to get the latest active plan.`,
    inputSchema: {
      plan_id: z.string().optional()
        .describe('Specific plan ID (blank = latest active plan)'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      let plan: SpendPlan | null = null;

      if (params.plan_id) {
        // Fetch by document ID directly
        const db = getDb();
        const snap = await db.collection(COMPANY_PATHS.spendPlans()).doc(params.plan_id).get();
        if (snap.exists) {
          plan = { id: snap.id, ...snap.data() } as SpendPlan;
        }
      }

      if (!plan) {
        const { items } = await queryCollection<SpendPlan>(COMPANY_PATHS.spendPlans(), {
          filters: [{ field: 'status', op: 'in', value: ['draft', 'active'] }],
          orderByField: 'generatedAt',
          orderByDirection: 'desc',
          limit: 1,
        });
        plan = items[0] ?? null;
      }

      if (!plan) {
        return { content: [{ type: 'text' as const, text: 'No spend plan found. Use `zeusos_generate_spend_plan` to create one.' }] };
      }

      const scheduled = plan.scheduledExpenditures ?? [];
      const deferred = plan.deferredExpenditures ?? [];

      const lines = [
        `**Spend Plan — ${plan.date ?? 'Unknown date'}** (${plan.status})`,
        `Generated: ${formatTimestamp(plan.generatedAt)}`,
        '',
        `Opening balance: ${formatCurrency(Number(plan.openingBankBalance) || 0, 'UGX')}`,
        `Total outflow:   ${formatCurrency(Number(plan.totalOutflow) || 0, 'UGX')}`,
        `Closing balance: **${formatCurrency(Number(plan.closingBalance) || 0, 'UGX')}**`,
        '',
      ];

      if (scheduled.length) {
        lines.push(`**Pay Today** (${scheduled.length} items):`);
        lines.push('| # | Description | Amount | Tier | Score |');
        lines.push('|---|-------------|--------|------|-------|');
        for (const [i, item] of scheduled.entries()) {
          lines.push(
            `| ${i + 1} | ${String(item['description'] ?? '').substring(0, 40)} | ${formatCurrency(Number(item['amount']) || 0, 'UGX')} | ${item['priorityTier']} | ${Number(item['compositeScore']).toFixed(2)} |`
          );
        }
        lines.push('');
      }

      if (deferred.length) {
        lines.push(`**Deferred** (${deferred.length} items):`);
        for (const item of deferred.slice(0, 10)) {
          lines.push(`- ${String(item['description'] ?? '').substring(0, 50)} — ${formatCurrency(Number(item['amount']) || 0, 'UGX')} [${item['priorityTier']}]`);
        }
        if (deferred.length > 10) lines.push(`  _...and ${deferred.length - 10} more_`);
        lines.push('');
      }

      for (const flag of (plan.riskFlags ?? [])) {
        lines.push(`${flag['severity'] === 'high' ? '⚠' : '→'} ${flag['message']}`);
      }

      const actions = plan.actionItems ?? [];
      if (actions.length) {
        lines.push('', '**Action Items:**');
        lines.push(...actions.map((a: unknown) => `• ${String(a)}`));
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── zeusos_market_intelligence ─────────────────────────────────────────────
  server.registerTool('zeusos_market_intelligence', {
    title: 'Market Intelligence Reports',
    description: `Retrieve AI-generated market intelligence reports for ZeusOS subsidiaries. Each report contains competitor analyses, threat assessments, emerging industry trends, and strategic pricing/positioning recommendations based on live web data.

Subsidiary IDs: finishes | technology | capital`,
    inputSchema: {
      subsidiary_id: z.enum(['finishes', 'technology', 'capital'])
        .describe('Which subsidiary to get intelligence for'),
      limit: z.number().int().min(1).max(10).optional()
        .describe('Number of recent reports (default: 3)'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const result = await callCloudFunction<unknown, {
        success: boolean;
        reports: Array<{
          id: string;
          reportTitle: string;
          generatedAt: string;
          subsidiaryName: string;
          executiveSummary: string;
          overallThreatLevel: string;
          marketSentiment: string;
          competitorAnalyses: Array<{
            competitorName: string;
            updatedThreatLevel: string;
            threatLevelChange: string;
            activityLevel: string;
            findings: Array<{ title: string; description: string; significance: string }>;
            overallAssessment: string;
            watchItems: string[];
          }>;
          strategicRecommendations: unknown[];
          riskAlerts: unknown[];
          metadata: { competitorsAnalyzed: number; totalFindings: number; confidenceScore: number };
        }>;
      }>('getMarketIntelligenceReports', {
        subsidiaryId: params.subsidiary_id,
        limit: params.limit ?? 3,
      });

      if (!result.reports?.length) {
        return { content: [{ type: 'text' as const, text: `No market intelligence reports found for "${params.subsidiary_id}".` }] };
      }

      const lines: string[] = [];

      for (const report of result.reports) {
        lines.push(
          `# ${report.reportTitle}`,
          `Generated: ${report.generatedAt}  |  ${report.subsidiaryName}`,
          `Threat Level: **${report.overallThreatLevel}**  |  Sentiment: ${report.marketSentiment}`,
          `${report.metadata?.competitorsAnalyzed ?? 0} competitors  |  ${report.metadata?.totalFindings ?? 0} findings  |  Confidence: ${((report.metadata?.confidenceScore ?? 0) * 100).toFixed(0)}%`,
          '',
          '## Executive Summary',
          report.executiveSummary,
          '',
        );

        if (report.competitorAnalyses?.length) {
          lines.push('## Competitors');
          for (const comp of report.competitorAnalyses) {
            const change = comp.threatLevelChange !== 'unchanged' ? ` (${comp.threatLevelChange})` : '';
            lines.push(`\n**${comp.competitorName}** — Threat: ${comp.updatedThreatLevel}${change} | Activity: ${comp.activityLevel}`);
            lines.push(comp.overallAssessment);
            for (const f of (comp.findings ?? []).slice(0, 3)) {
              lines.push(`  • **${f.title}** [${f.significance}]: ${f.description}`);
            }
            if (comp.watchItems?.length) lines.push(`  Watch: ${comp.watchItems.join(', ')}`);
          }
          lines.push('');
        }

        const recs = report.strategicRecommendations;
        if (Array.isArray(recs) && recs.length) {
          lines.push('## Strategic Recommendations');
          lines.push(...recs.map((r: unknown) => `→ ${String(r)}`));
          lines.push('');
        }

        if (result.reports.length > 1) lines.push('---', '');
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });
}
