// ============================================================================
// FINANCE REPORT AI SERVICE
// ZeusOS v2.0 - Finance Module
// AI-powered report generation using Gemini for different stakeholder audiences
// ============================================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { HistoricalPeriodData } from './forecastService';
import type { PLAccountDetail } from '../types/forecast.types';
import { computeProfitability } from './profitabilityEngine';

// ── Gemini Setup ─────────────────────────────────────────────────────────────

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// ── Types ────────────────────────────────────────────────────────────────────

export type ReportTemplate = 'board_report' | 'investor_update' | 'management_report' | 'team_brief';

export interface ReportConfig {
  template: ReportTemplate;
  companyName: string;
  periodStart: string;  // YYYY-MM
  periodEnd: string;    // YYYY-MM
  additionalContext?: string;
}

export interface GeneratedReport {
  title: string;
  template: ReportTemplate;
  content: string;     // Markdown
  generatedAt: Date;
  periodRange: string;
}

// ── Prompt Templates ─────────────────────────────────────────────────────────

const PROMPT_TEMPLATES: Record<ReportTemplate, { title: string; instructions: string }> = {
  board_report: {
    title: 'Board Report',
    instructions: `You are writing an executive summary report for the Board of Directors.

Focus on:
- Strategic overview of the company's financial position
- Key financial highlights and notable achievements
- Risks and areas of concern that require board attention
- Forward outlook and strategic recommendations

Tone: Formal and authoritative. Use precise financial language. Structure the report with clear sections and numbered key points where appropriate. The board expects concise, decision-ready information.

Format the report with these sections:
## Executive Summary
## Financial Highlights
## Key Performance Metrics
## Risks & Areas of Concern
## Forward Outlook & Recommendations`,
  },

  investor_update: {
    title: 'Investor Update',
    instructions: `You are writing a performance update for investors and stakeholders.

Focus on:
- Revenue and growth metrics — trajectory and momentum
- Profitability trends — gross margin, operating margin, net margin
- Cash position and capital efficiency
- Forward guidance and growth drivers

Tone: Professional but concise. Investors want clear metrics and trajectory. Use data-driven language with specific numbers. Be transparent about challenges but frame them constructively.

Format the report with these sections:
## Performance Summary
## Revenue & Growth
## Profitability Analysis
## Cash Position
## Forward Guidance`,
  },

  management_report: {
    title: 'Management Report',
    instructions: `You are writing a detailed financial analysis report for internal management.

Focus on:
- Detailed P&L walkthrough — line by line analysis of major accounts
- Variance analysis — what changed and why it matters
- Departmental / account-level breakdown of costs
- Specific action items and areas needing management attention

Tone: Analytical and detailed. Management needs actionable insights, not just numbers. Identify specific accounts driving performance changes. Recommend concrete actions.

Format the report with these sections:
## P&L Overview
## Revenue Analysis
## Cost of Goods Sold
## Operating Expenses
## Margin Analysis
## Variance Highlights
## Action Items & Recommendations`,
  },

  team_brief: {
    title: 'Team Brief',
    instructions: `You are writing a financial performance summary for team members who may not have financial backgrounds.

Focus on:
- High-level performance summary — are we doing well or not?
- What the numbers mean in plain, everyday language
- Team-relevant implications — what this means for hiring, budgets, projects
- Celebrate wins and acknowledge challenges honestly

Tone: Accessible and encouraging. Avoid jargon — explain financial concepts in simple terms. Use analogies where helpful. Keep it brief and easy to scan. The team should walk away understanding how the business is performing.

Format the report with these sections:
## How Are We Doing?
## The Big Numbers
## What This Means For Us
## Wins to Celebrate
## Areas We're Working On`,
  },
};

// ── Financial Context Builder ────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function buildFinancialContext(
  periodData: Record<string, HistoricalPeriodData>,
  accounts: PLAccountDetail[],
  periodStart: string,
  periodEnd: string,
): string {
  // Filter periods within the requested range
  const filteredPeriods = Object.keys(periodData)
    .filter(p => p >= periodStart && p <= periodEnd)
    .sort();

  if (filteredPeriods.length === 0) {
    return 'No financial data available for the selected period range.';
  }

  const lines: string[] = [];
  lines.push(`=== FINANCIAL DATA: ${periodStart} to ${periodEnd} (${filteredPeriods.length} months) ===`);
  lines.push('');

  // ── Aggregate totals across the period range ──
  let totalRevenue = 0;
  let totalCOGS = 0;
  let totalOpex = 0;
  let totalDepreciation = 0;
  let totalInterest = 0;
  let totalTax = 0;

  for (const period of filteredPeriods) {
    const pd = periodData[period];
    if (!pd) continue;
    totalRevenue += pd.pl.revenue;
    totalCOGS += pd.pl.cogs;
    totalOpex += pd.pl.opex;
    totalDepreciation += pd.pl.depreciation;
    totalInterest += pd.pl.interest;
    totalTax += pd.pl.tax;
  }

  // Compute profitability metrics for the aggregated period
  const aggMetrics = computeProfitability({
    revenue: totalRevenue,
    cogs: totalCOGS,
    opex: totalOpex,
    depreciation: totalDepreciation,
    interest: totalInterest,
    tax: totalTax,
  });

  lines.push('AGGREGATE P&L (entire period):');
  lines.push(`  Revenue:           ${fmtCurrency(aggMetrics.revenue)}`);
  lines.push(`  Cost of Goods Sold: ${fmtCurrency(aggMetrics.cogs)}`);
  lines.push(`  Gross Profit:      ${fmtCurrency(aggMetrics.grossProfit)} (Gross Margin: ${fmtPct(aggMetrics.grossMargin)})`);
  lines.push(`  Operating Expenses: ${fmtCurrency(aggMetrics.opex)}`);
  lines.push(`  Operating Profit:  ${fmtCurrency(aggMetrics.operatingProfit)} (Operating Margin: ${fmtPct(aggMetrics.operatingMargin)})`);
  lines.push(`  EBITDA:            ${fmtCurrency(aggMetrics.ebitda)}`);
  lines.push(`  Depreciation:      ${fmtCurrency(aggMetrics.depreciation)}`);
  lines.push(`  EBIT:              ${fmtCurrency(aggMetrics.ebit)}`);
  lines.push(`  Interest:          ${fmtCurrency(aggMetrics.interest)}`);
  lines.push(`  EBT:               ${fmtCurrency(aggMetrics.ebt)}`);
  lines.push(`  Tax:               ${fmtCurrency(aggMetrics.tax)}`);
  lines.push(`  Net Profit:        ${fmtCurrency(aggMetrics.netProfit)} (Net Margin: ${fmtPct(aggMetrics.netMargin)})`);
  lines.push('');

  // ── Monthly breakdown ──
  lines.push('MONTHLY P&L BREAKDOWN:');
  for (const period of filteredPeriods) {
    const pd = periodData[period];
    if (!pd) continue;
    const m = computeProfitability(pd.pl);
    lines.push(`  ${period}: Revenue=${fmtCurrency(m.revenue)}, GP=${fmtCurrency(m.grossProfit)} (${fmtPct(m.grossMargin)}), Net=${fmtCurrency(m.netProfit)} (${fmtPct(m.netMargin)})`);
  }
  lines.push('');

  // ── Growth rates (month-over-month) ──
  if (filteredPeriods.length >= 2) {
    lines.push('MONTH-OVER-MONTH GROWTH RATES:');
    for (let i = 1; i < filteredPeriods.length; i++) {
      const prev = periodData[filteredPeriods[i - 1]];
      const curr = periodData[filteredPeriods[i]];
      if (!prev || !curr) continue;
      const revGrowth = prev.pl.revenue !== 0
        ? (curr.pl.revenue - prev.pl.revenue) / Math.abs(prev.pl.revenue)
        : 0;
      lines.push(`  ${filteredPeriods[i]}: Revenue growth ${fmtPct(revGrowth)}`);
    }
    lines.push('');

    // Overall period growth (first vs last)
    const firstPd = periodData[filteredPeriods[0]];
    const lastPd = periodData[filteredPeriods[filteredPeriods.length - 1]];
    if (firstPd && lastPd && firstPd.pl.revenue !== 0) {
      const periodGrowth = (lastPd.pl.revenue - firstPd.pl.revenue) / Math.abs(firstPd.pl.revenue);
      lines.push(`PERIOD GROWTH (${filteredPeriods[0]} to ${filteredPeriods[filteredPeriods.length - 1]}): Revenue ${fmtPct(periodGrowth)}`);
      lines.push('');
    }
  }

  // ── Top accounts by classification ──
  const accountsByClass: Record<string, { label: string; total: number }[]> = {};
  for (const acct of accounts) {
    let total = 0;
    for (const period of filteredPeriods) {
      total += acct.values[period] ?? 0;
    }
    if (total === 0) continue;
    if (!accountsByClass[acct.classification]) accountsByClass[acct.classification] = [];
    accountsByClass[acct.classification].push({ label: acct.label, total });
  }

  for (const [cls, accts] of Object.entries(accountsByClass)) {
    const sorted = accts.sort((a, b) => Math.abs(b.total) - Math.abs(a.total)).slice(0, 10);
    lines.push(`TOP ${cls.toUpperCase()} ACCOUNTS (period total):`);
    for (const a of sorted) {
      lines.push(`  ${a.label}: ${fmtCurrency(a.total)}`);
    }
    lines.push('');
  }

  // ── Balance Sheet snapshot (latest period) ──
  const latestPeriod = filteredPeriods[filteredPeriods.length - 1];
  const latestBS = periodData[latestPeriod]?.bs;
  if (latestBS) {
    lines.push(`BALANCE SHEET SNAPSHOT (${latestPeriod}):`);
    lines.push(`  Cash:              ${fmtCurrency(latestBS.cash)}`);
    lines.push(`  Receivables:       ${fmtCurrency(latestBS.receivables)}`);
    lines.push(`  Inventory:         ${fmtCurrency(latestBS.inventory)}`);
    lines.push(`  Total Assets:      ${fmtCurrency(latestBS.totalAssets)}`);
    lines.push(`  Payables:          ${fmtCurrency(latestBS.payables)}`);
    lines.push(`  Total Liabilities: ${fmtCurrency(latestBS.totalLiabilities)}`);
    lines.push(`  Total Equity:      ${fmtCurrency(latestBS.totalEquity)}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ── Report Generation ────────────────────────────────────────────────────────

export async function generateFinanceReport(
  config: ReportConfig,
  periodData: Record<string, HistoricalPeriodData>,
  accounts: PLAccountDetail[],
): Promise<GeneratedReport> {
  if (!genAI) {
    throw new Error('AI reports require a Gemini API key. Configure VITE_GEMINI_API_KEY in your environment.');
  }

  const template = PROMPT_TEMPLATES[config.template];
  const financialContext = buildFinancialContext(
    periodData,
    accounts,
    config.periodStart,
    config.periodEnd,
  );

  const systemInstruction = [
    `You are a senior financial analyst at ${config.companyName}.`,
    'You produce clear, professional financial reports based on real company data.',
    'Always reference specific numbers from the data provided.',
    'Format your output in clean Markdown.',
    'Do not include any disclaimers about AI-generated content.',
    'Do not fabricate or hallucinate numbers — only use the data provided below.',
  ].join(' ');

  const userPrompt = [
    `Generate a ${template.title} for ${config.companyName}.`,
    `Reporting period: ${config.periodStart} to ${config.periodEnd}.`,
    '',
    '--- FINANCIAL DATA ---',
    financialContext,
    '--- END FINANCIAL DATA ---',
    '',
    template.instructions,
    '',
    config.additionalContext
      ? `Additional context from the user: ${config.additionalContext}`
      : '',
  ].filter(Boolean).join('\n');

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction,
  });

  const result = await model.generateContent(userPrompt);
  const response = result.response;
  const content = response.text();

  const periodRange = `${config.periodStart} to ${config.periodEnd}`;

  return {
    title: `${template.title} - ${config.companyName} (${periodRange})`,
    template: config.template,
    content,
    generatedAt: new Date(),
    periodRange,
  };
}
