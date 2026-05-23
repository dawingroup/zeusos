/**
 * Campaigns / Master Jobs tools (Phase 5.A).
 *
 * Reads `master_jobs` (top-level collection — Phase 3.A.5 rename from
 * `campaigns`). The marketing-domain detail (Brief, IMC team, 14-stage
 * workflow, ARAAM, performanceReview) lives at `master_job.campaign` per
 * `src/modules/campaigns/types/campaign.types.ts` and plan §14.4 / §14.14.
 *
 * All tools are read-only. Writes (Brief create, stage advance) need
 * Cloud Function callables with the state-machine + SLA guards; deferred
 * to Phase 5.A.2 — see TODO_MCP_SERVER.md.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  queryCollection,
  getDocument,
  formatCurrency,
  formatTimestamp,
  truncateIfNeeded,
} from '../services/firebase.js';
import type { QueryFilter } from '../services/firebase.js';
import {
  MARKETING_COLLECTIONS,
  MASTER_JOB_STATUSES,
  IWO_STATES,
  IWO_ACTIVE_STATES,
  ZEUS_SUBSIDIARY_IDS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../constants.js';
import type { IWOState } from '../constants.js';

interface MasterJobDoc {
  id: string;
  code?: string;
  status?: string;
  sowId?: string;
  quoteId?: string;
  clientId?: string;
  allocatedMinor?: number;
  ceilingMinor?: number;
  clientTotalMinor?: number;
  currency?: string;
  accountManagerUserId?: string;
  openedAt?: unknown;
  closedAt?: unknown;
  cancelledAt?: unknown;
  cancelReason?: string;
  campaign?: {
    name?: string;
    subsidiaryId?: string;
    brandId?: string;
    brandName?: string;
    clientName?: string;
    serviceLines?: string[];
    bigIdea?: string;
    stage?: string;
    progressPct?: number;
    launchDate?: unknown;
    endDate?: unknown;
    brief?: {
      tier?: 1 | 2 | 3;
      objectives?: string;
      targetAudience?: string;
      kpis?: Array<{ name: string; target?: string; source?: string }>;
      budgetUGX?: number;
      deadline?: unknown;
      briefedAt?: unknown;
      expectedRevertBy?: unknown;
      revertSubmittedAt?: unknown;
      expectedFeedbackBy?: unknown;
      signOffByUserId?: string;
      signedOffAt?: unknown;
    };
    imcTeam?: Array<{ userId: string; role: string; streamLead?: boolean; subsidiaryId: string }>;
    araam?: { analyze?: boolean; research?: boolean; approach?: boolean; action?: boolean; measure?: boolean };
    performanceReview?: {
      challenge?: string;
      strategy?: string;
      results?: string;
      metrics?: Array<{ name: string; value: number; unit: string; source?: string }>;
    };
    stageHistory?: Array<{ fromStage: string; toStage: string; transitionedAt: unknown; transitionedBy: string }>;
  };
  createdAt?: unknown;
  updatedAt?: unknown;
}

interface IwoStub {
  id: string;
  masterJobId?: string;
  state?: IWOState;
  budgetMinor?: number;
  cumulativeCostMinor?: number;
  subsidiaryOrgId?: string;
  code?: string;
}

interface DeliverableStub { id: string }

function progressBar(pct: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const filled = Math.round(clamped / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function burnPct(allocated: number, ceiling: number): string {
  if (!ceiling) return '—';
  return `${((allocated / ceiling) * 100).toFixed(0)}%`;
}

export function registerCampaignTools(server: McpServer): void {

  // ─── zeusos_list_master_jobs ────────────────────────────────────────────────
  server.registerTool('zeusos_list_master_jobs', {
    title: 'List Master Jobs (Campaigns)',
    description: `List Zeus master jobs — the engagement-level entity that replaces the legacy "campaign" record (Phase 3.A.5 rename). One row per client engagement increment. Each can carry the marketing-facing Campaign detail (Brief, IMC team, 14-stage workflow) at \`campaign.*\`.

Filters by client, status (OPEN | DELIVERING | CLOSED | CANCELLED), subsidiary, or 14-stage workflow position. Use \`zeusos_get_master_job\` for full detail and \`zeusos_master_job_summary\` for the cost-vs-ceiling roll-up.`,
    inputSchema: {
      client_id: z.string().optional()
        .describe('Filter by client (e.g. KCB, Diageo, KFC) — clientId'),
      status: z.enum(MASTER_JOB_STATUSES).optional()
        .describe('Filter by master-job lifecycle status'),
      subsidiary_id: z.enum(ZEUS_SUBSIDIARY_IDS).optional()
        .describe('Filter by owning sub-brand (campaign.subsidiaryId)'),
      stage: z.string().optional()
        .describe('Filter by 14-stage workflow position (campaign.stage)'),
      limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional()
        .describe(`Max records (default: ${DEFAULT_PAGE_SIZE})`),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const filters: QueryFilter[] = [];
      if (params.client_id) filters.push({ field: 'clientId', op: '==', value: params.client_id });
      if (params.status) filters.push({ field: 'status', op: '==', value: params.status });
      if (params.subsidiary_id) filters.push({ field: 'campaign.subsidiaryId', op: '==', value: params.subsidiary_id });
      if (params.stage) filters.push({ field: 'campaign.stage', op: '==', value: params.stage });

      const { items, total } = await queryCollection<MasterJobDoc>(
        MARKETING_COLLECTIONS.MASTER_JOBS,
        {
          filters,
          orderByField: 'updatedAt',
          orderByDirection: 'desc',
          limit: params.limit ?? DEFAULT_PAGE_SIZE,
        },
      );

      if (!items.length) {
        return { content: [{ type: 'text' as const, text: 'No master jobs match these filters.' }] };
      }

      const ceilingTotal = items.reduce((s, m) => s + (m.ceilingMinor ?? 0), 0);
      const allocatedTotal = items.reduce((s, m) => s + (m.allocatedMinor ?? 0), 0);
      const currency = items[0]?.currency ?? 'UGX';

      const lines = [
        `**Master Jobs** (${items.length} of ${total})`,
        `Ceiling total: ${formatCurrency(ceilingTotal, currency)}  |  Allocated: ${formatCurrency(allocatedTotal, currency)}  |  Burn: ${burnPct(allocatedTotal, ceilingTotal)}`,
        '',
        '| Code | Client | Sub-brand | Stage | Status | Allocated / Ceiling | Currency |',
        '|------|--------|-----------|-------|--------|--------------------|----------|',
      ];

      for (const m of items) {
        const allocated = m.allocatedMinor ?? 0;
        const ceiling = m.ceilingMinor ?? 0;
        const sub = m.campaign?.subsidiaryId ?? '—';
        const stage = m.campaign?.stage ?? '—';
        const client = m.campaign?.clientName ?? m.clientId ?? '—';
        const cur = m.currency ?? 'UGX';
        lines.push(
          `| ${m.code ?? m.id.slice(0, 8)} | ${client.slice(0, 24)} | ${sub} | ${stage} | ${m.status ?? '—'} | ${formatCurrency(allocated, cur)} / ${formatCurrency(ceiling, cur)} (${burnPct(allocated, ceiling)}) | ${cur} |`,
        );
      }

      lines.push('', `_IDs: ${items.map(m => m.id).join(', ')}_`);
      return { content: [{ type: 'text' as const, text: truncateIfNeeded(lines.join('\n')) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── zeusos_get_master_job ──────────────────────────────────────────────────
  server.registerTool('zeusos_get_master_job', {
    title: 'Get Master Job (Campaign) Detail',
    description: `Full master-job detail including the embedded marketing Campaign view: Brief (with Tier + SLA timestamps), IMC team, BIG IDEA, 14-stage workflow position + stage history, ARAAM phase ticks, and Performance Review if the campaign has closed out. Also rolls up attached IWOs by state.`,
    inputSchema: {
      master_job_id: z.string().describe('Master job document ID'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const m = await getDocument<MasterJobDoc>(MARKETING_COLLECTIONS.MASTER_JOBS, params.master_job_id);
      if (!m) {
        return { content: [{ type: 'text' as const, text: `Master job ${params.master_job_id} not found.` }] };
      }

      const cur = m.currency ?? 'UGX';
      const c = m.campaign ?? {};
      const allocated = m.allocatedMinor ?? 0;
      const ceiling = m.ceilingMinor ?? 0;

      const lines: string[] = [
        `# ${c.name ?? m.code ?? m.id}`,
        c.bigIdea ? `_BIG IDEA — ${c.bigIdea}_` : '',
        '',
        `**Code:** ${m.code ?? '—'}  |  **Status:** ${m.status ?? '—'}  |  **Stage:** ${c.stage ?? '—'}`,
        `**Client:** ${c.clientName ?? m.clientId ?? '—'}  |  **Brand:** ${c.brandName ?? c.brandId ?? '—'}  |  **Sub-brand:** ${c.subsidiaryId ?? '—'}`,
        `**Account Manager:** ${m.accountManagerUserId ?? '—'}`,
        '',
        '**Commercials**',
        `- Ceiling: ${formatCurrency(ceiling, cur)}`,
        `- Allocated to IWOs: ${formatCurrency(allocated, cur)} (${burnPct(allocated, ceiling)})`,
        `- Client total (Quote): ${formatCurrency(m.clientTotalMinor ?? 0, cur)}`,
        `- SOW: ${m.sowId ?? '—'}  |  Quote: ${m.quoteId ?? '—'}`,
        '',
        c.progressPct !== undefined
          ? `**Progress:** ${c.progressPct}% ${progressBar(c.progressPct)}`
          : '',
      ];

      // Service lines
      if (c.serviceLines?.length) {
        lines.push('', `**Service lines:** ${c.serviceLines.join(', ')}`);
      }

      // ARAAM
      if (c.araam) {
        const phases: Array<[string, boolean | undefined]> = [
          ['Analyze', c.araam.analyze],
          ['Research', c.araam.research],
          ['Approach', c.araam.approach],
          ['Action', c.araam.action],
          ['Measure', c.araam.measure],
        ];
        lines.push('', `**ARAAM:** ${phases.map(([n, on]) => `${on ? '✓' : '○'} ${n}`).join('  ')}`);
      }

      // Brief
      const b = c.brief;
      if (b) {
        lines.push(
          '',
          '## Brief',
          `**Tier:** ${b.tier ?? '—'}  |  **Briefed:** ${formatTimestamp(b.briefedAt)}  |  **Expected revert by:** ${formatTimestamp(b.expectedRevertBy)}`,
          b.revertSubmittedAt ? `**Revert sent:** ${formatTimestamp(b.revertSubmittedAt)}  |  **Expected client feedback by:** ${formatTimestamp(b.expectedFeedbackBy)}` : '',
          b.objectives ? `**Objectives:** ${b.objectives}` : '',
          b.targetAudience ? `**Target audience:** ${b.targetAudience}` : '',
          b.budgetUGX !== undefined ? `**Brief budget:** ${formatCurrency(b.budgetUGX, 'UGX')}` : '',
          b.deadline ? `**Deadline:** ${formatTimestamp(b.deadline)}` : '',
          b.signedOffAt ? `**Signed off:** ${formatTimestamp(b.signedOffAt)} by ${b.signOffByUserId ?? '—'}` : '_Brief not yet signed off._',
        );
        if (b.kpis?.length) {
          lines.push('', '**KPIs:**');
          for (const k of b.kpis) lines.push(`- **${k.name}**${k.target ? ` → ${k.target}` : ''}${k.source ? ` _(${k.source})_` : ''}`);
        }
      }

      // IMC team
      if (c.imcTeam?.length) {
        lines.push('', `## IMC Team (${c.imcTeam.length})`, '', '| User | Role | Sub-brand | Stream lead |', '|------|------|-----------|-------------|');
        for (const t of c.imcTeam) {
          lines.push(`| ${t.userId.slice(0, 12)} | ${t.role} | ${t.subsidiaryId} | ${t.streamLead ? '✓' : '—'} |`);
        }
      }

      // Roll up IWOs
      try {
        const { items: iwos } = await queryCollection<IwoStub>(
          MARKETING_COLLECTIONS.INTERNAL_WORK_ORDERS,
          {
            filters: [{ field: 'masterJobId', op: '==', value: m.id }],
            orderByField: 'createdAt',
            orderByDirection: 'asc',
            limit: 100,
          },
        );
        if (iwos.length) {
          const byState: Record<string, number> = {};
          let costSum = 0;
          let budgetSum = 0;
          for (const i of iwos) {
            const st = i.state ?? 'UNKNOWN';
            byState[st] = (byState[st] ?? 0) + 1;
            costSum += i.cumulativeCostMinor ?? 0;
            budgetSum += i.budgetMinor ?? 0;
          }
          lines.push('', `## IWO Roll-Up (${iwos.length})`);
          const stateBreakdown = Object.entries(byState)
            .map(([s, n]) => `${s}: ${n}`)
            .join('  |  ');
          lines.push(stateBreakdown);
          lines.push(`Cost posted: ${formatCurrency(costSum, cur)} of ${formatCurrency(budgetSum, cur)} budget (${burnPct(costSum, budgetSum)})`);
          lines.push('', '_Use `zeusos_list_iwos` and `zeusos_iwo_burn_report` for per-IWO detail._');
        } else {
          lines.push('', '_No IWOs issued yet against this master job._');
        }
      } catch {
        lines.push('', '_(IWO roll-up unavailable — check `internal_work_orders` index.)_');
      }

      // Stage history
      if (c.stageHistory?.length) {
        lines.push('', '## Stage History', '', '| When | From → To | By |', '|------|-----------|-----|');
        for (const h of c.stageHistory.slice(-10)) {
          lines.push(`| ${formatTimestamp(h.transitionedAt)} | ${h.fromStage} → ${h.toStage} | ${h.transitionedBy.slice(0, 14)} |`);
        }
      }

      // Performance review (post-launch)
      const pr = c.performanceReview;
      if (pr && (pr.challenge || pr.strategy || pr.results || pr.metrics?.length)) {
        lines.push('', '## Performance Review');
        if (pr.challenge) lines.push('', `**Challenge:** ${pr.challenge}`);
        if (pr.strategy) lines.push('', `**Strategy:** ${pr.strategy}`);
        if (pr.results) lines.push('', `**Results:** ${pr.results}`);
        if (pr.metrics?.length) {
          lines.push('', '**Metrics:**', '', '| Metric | Value | Unit | Source |', '|--------|-------|------|--------|');
          for (const k of pr.metrics) {
            lines.push(`| ${k.name} | ${k.value} | ${k.unit} | ${k.source ?? '—'} |`);
          }
        }
      }

      lines.push('', `_Opened: ${formatTimestamp(m.openedAt)}  |  Updated: ${formatTimestamp(m.updatedAt)}_`);

      return { content: [{ type: 'text' as const, text: truncateIfNeeded(lines.filter(Boolean).join('\n')) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── zeusos_master_job_summary ──────────────────────────────────────────────
  server.registerTool('zeusos_master_job_summary', {
    title: 'Master Job Cost vs Ceiling Summary',
    description: `Concise summary for a master job: cost vs ceiling, IWO state breakdown, deliverable count, and Brief SLA position. Designed for dashboards (Phase 5.B Executive Dashboard) — output is short and structured.`,
    inputSchema: {
      master_job_id: z.string().describe('Master job document ID'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const m = await getDocument<MasterJobDoc>(MARKETING_COLLECTIONS.MASTER_JOBS, params.master_job_id);
      if (!m) {
        return { content: [{ type: 'text' as const, text: `Master job ${params.master_job_id} not found.` }] };
      }

      const cur = m.currency ?? 'UGX';
      const allocated = m.allocatedMinor ?? 0;
      const ceiling = m.ceilingMinor ?? 0;

      // IWO roll-up
      const { items: iwos } = await queryCollection<IwoStub>(
        MARKETING_COLLECTIONS.INTERNAL_WORK_ORDERS,
        { filters: [{ field: 'masterJobId', op: '==', value: m.id }], limit: 200 },
      );
      const byState: Record<string, number> = {};
      let cumulativeCost = 0;
      let budgetTotal = 0;
      const activeIwoIds: string[] = [];
      for (const i of iwos) {
        const st = i.state ?? 'UNKNOWN';
        byState[st] = (byState[st] ?? 0) + 1;
        cumulativeCost += i.cumulativeCostMinor ?? 0;
        budgetTotal += i.budgetMinor ?? 0;
        if (i.state && (IWO_ACTIVE_STATES as readonly string[]).includes(i.state)) {
          activeIwoIds.push(i.id);
        }
      }

      // Deliverable count across active IWOs (best-effort — sum subcollection
      // counts; capped to avoid runaway reads in this summary path)
      let deliverableCount = 0;
      for (const id of activeIwoIds.slice(0, 25)) {
        try {
          const path = `${MARKETING_COLLECTIONS.INTERNAL_WORK_ORDERS}/${id}/deliverables`;
          const { total } = await queryCollection<DeliverableStub>(path, { limit: 1 });
          deliverableCount += total;
        } catch {
          // index missing or no docs — ignore
        }
      }

      const c = m.campaign ?? {};
      const b = c.brief;

      const lines = [
        `**${m.code ?? m.id}** — ${c.name ?? '(unnamed campaign)'}`,
        `Client: ${c.clientName ?? m.clientId ?? '—'}  |  Sub-brand: ${c.subsidiaryId ?? '—'}  |  Stage: ${c.stage ?? '—'}  |  Status: ${m.status ?? '—'}`,
        '',
        '**Commercials**',
        `- Ceiling: ${formatCurrency(ceiling, cur)}`,
        `- Allocated to IWOs: ${formatCurrency(allocated, cur)} (${burnPct(allocated, ceiling)})`,
        `- Cost posted (sum of IWO cumulative): ${formatCurrency(cumulativeCost, cur)} of ${formatCurrency(budgetTotal, cur)} IWO budget`,
        '',
        '**IWO state**',
        Object.keys(byState).length
          ? Object.entries(byState).map(([s, n]) => `- ${s}: ${n}`).join('\n')
          : '- No IWOs issued',
        '',
        `**Deliverables attached** (active IWOs sampled): ${deliverableCount}`,
      ];

      if (b) {
        lines.push('', '**Brief SLA**');
        lines.push(`- Tier: ${b.tier ?? '—'}`);
        lines.push(`- Briefed: ${formatTimestamp(b.briefedAt)}`);
        lines.push(`- Expected revert by: ${formatTimestamp(b.expectedRevertBy)}`);
        if (b.revertSubmittedAt) {
          lines.push(`- Revert sent: ${formatTimestamp(b.revertSubmittedAt)}`);
          lines.push(`- Expected client feedback by: ${formatTimestamp(b.expectedFeedbackBy)}`);
        }
        if (b.signedOffAt) {
          lines.push(`- Signed off: ${formatTimestamp(b.signedOffAt)}`);
        } else {
          lines.push('- _Brief not yet signed off_');
        }
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // Silence unused-import lint when IWO_STATES is exported only for the type
  void IWO_STATES;
}
