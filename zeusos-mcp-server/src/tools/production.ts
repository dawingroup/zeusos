/**
 * Production tools (Phase 5.A).
 *
 * Reads `production_jobs` (top-level). One ProductionJob models the
 * lifecycle of a TVC shoot / radio recording / photography session / print
 * run / exhibition build through the 10-stage workflow defined in
 * src/modules/production/types/production-job.types.ts.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  queryCollection,
  getDocument,
  formatTimestamp,
  truncateIfNeeded,
} from '../services/firebase.js';
import type { QueryFilter } from '../services/firebase.js';
import {
  MARKETING_COLLECTIONS,
  PRODUCTION_STAGES,
  PRODUCTION_JOB_TYPES,
  ZEUS_SUBSIDIARY_IDS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../constants.js';
import type { ProductionStage } from '../constants.js';

interface ProductionJobDoc {
  id: string;
  title?: string;
  type?: string;
  masterJobId?: string;
  campaignId?: string;
  iwoId?: string;
  stage?: ProductionStage;
  subsidiaryOrgId?: string;
  producerId?: string;
  scheduledShootDate?: string;
  callSheetStorageRef?: string;
  stageHistory?: Array<{ fromStage: string; toStage: string; transitionedAt: unknown; transitionedBy: string; notes?: string }>;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export function registerProductionTools(server: McpServer): void {

  // ─── zeusos_list_productions ────────────────────────────────────────────────
  server.registerTool('zeusos_list_productions', {
    title: 'List Production Jobs',
    description: `List physical production jobs (TVC shoot, radio recording, photo shoot, print run, exhibition build). Filter by master job, type, stage, or owning sub-brand.

The 10 stages: BRIEF → PRE_PRODUCTION → TALENT_BOOKING → LOCATION_LOCK → EQUIPMENT → SHOOT → POST_PRODUCTION → CLIENT_REVIEW → MASTER_DELIVERY → COMPLETE.`,
    inputSchema: {
      master_job_id: z.string().optional()
        .describe('Filter to one master job'),
      type: z.enum(PRODUCTION_JOB_TYPES).optional()
        .describe('Filter by production type'),
      stage: z.enum(PRODUCTION_STAGES).optional()
        .describe('Filter by current stage'),
      subsidiary_org_id: z.enum(ZEUS_SUBSIDIARY_IDS).optional()
        .describe('Filter by owning sub-brand'),
      limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional()
        .describe(`Max records (default: ${DEFAULT_PAGE_SIZE})`),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const filters: QueryFilter[] = [];
      if (params.master_job_id) filters.push({ field: 'masterJobId', op: '==', value: params.master_job_id });
      if (params.type) filters.push({ field: 'type', op: '==', value: params.type });
      if (params.stage) filters.push({ field: 'stage', op: '==', value: params.stage });
      if (params.subsidiary_org_id) filters.push({ field: 'subsidiaryOrgId', op: '==', value: params.subsidiary_org_id });

      const { items, total } = await queryCollection<ProductionJobDoc>(
        MARKETING_COLLECTIONS.PRODUCTION_JOBS,
        {
          filters,
          orderByField: 'updatedAt',
          orderByDirection: 'desc',
          limit: params.limit ?? DEFAULT_PAGE_SIZE,
        },
      );

      if (!items.length) {
        return { content: [{ type: 'text' as const, text: 'No production jobs match these filters.' }] };
      }

      const lines = [
        `**Production Jobs** (${items.length} of ${total})`,
        '',
        '| Title | Type | Stage | Master Job | Sub-brand | Shoot | Producer |',
        '|-------|------|-------|-----------|-----------|-------|----------|',
      ];

      for (const p of items) {
        lines.push(
          `| ${(p.title ?? '(untitled)').slice(0, 26)} | ${p.type ?? '—'} | ${p.stage ?? '—'} | ${(p.masterJobId ?? '—').slice(0, 14)} | ${p.subsidiaryOrgId ?? '—'} | ${p.scheduledShootDate ?? '—'} | ${(p.producerId ?? '—').slice(0, 14)} |`,
        );
      }

      lines.push('', `_IDs: ${items.map(p => p.id).join(', ')}_`);
      return { content: [{ type: 'text' as const, text: truncateIfNeeded(lines.join('\n')) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── zeusos_get_production ──────────────────────────────────────────────────
  server.registerTool('zeusos_get_production', {
    title: 'Get Production Job Detail',
    description: `Full production job detail including stage history and the call-sheet reference. Use after \`zeusos_list_productions\` to drill into a specific shoot.`,
    inputSchema: {
      production_id: z.string().describe('Production job document ID'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const p = await getDocument<ProductionJobDoc>(MARKETING_COLLECTIONS.PRODUCTION_JOBS, params.production_id);
      if (!p) {
        return { content: [{ type: 'text' as const, text: `Production job ${params.production_id} not found.` }] };
      }

      const lines: string[] = [
        `# ${p.title ?? p.id}`,
        '',
        `**Type:** ${p.type ?? '—'}  |  **Stage:** ${p.stage ?? '—'}  |  **Sub-brand:** ${p.subsidiaryOrgId ?? '—'}`,
        `**Master Job:** ${p.masterJobId ?? '—'}  |  **IWO:** ${p.iwoId ?? '—'}  |  **Campaign:** ${p.campaignId ?? '—'}`,
        `**Producer:** ${p.producerId ?? '—'}`,
        p.scheduledShootDate ? `**Scheduled shoot:** ${p.scheduledShootDate}` : '',
        p.callSheetStorageRef ? `**Call sheet:** \`${p.callSheetStorageRef}\`` : '',
        p.notes ? `\n${p.notes}` : '',
      ].filter(Boolean);

      if (p.stageHistory?.length) {
        lines.push('', '## Stage History', '', '| When | From → To | By | Notes |', '|------|-----------|-----|-------|');
        for (const h of p.stageHistory.slice(-15)) {
          lines.push(`| ${formatTimestamp(h.transitionedAt)} | ${h.fromStage} → ${h.toStage} | ${h.transitionedBy.slice(0, 14)} | ${(h.notes ?? '').slice(0, 30)} |`);
        }
      }

      lines.push('', `_Created ${formatTimestamp(p.createdAt)} | Updated ${formatTimestamp(p.updatedAt)}_`);
      return { content: [{ type: 'text' as const, text: truncateIfNeeded(lines.join('\n')) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── zeusos_production_summary ──────────────────────────────────────────────
  server.registerTool('zeusos_production_summary', {
    title: 'Production Throughput Summary',
    description: `Across all production jobs (optionally scoped by sub-brand or master job), show the distribution of jobs across the 10 stages plus a per-type breakdown. Highlights stages with unusual queue depth so the studio director can rebalance.`,
    inputSchema: {
      subsidiary_org_id: z.enum(ZEUS_SUBSIDIARY_IDS).optional()
        .describe('Limit to one sub-brand'),
      master_job_id: z.string().optional()
        .describe('Limit to one master job'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const filters: QueryFilter[] = [];
      if (params.subsidiary_org_id) filters.push({ field: 'subsidiaryOrgId', op: '==', value: params.subsidiary_org_id });
      if (params.master_job_id) filters.push({ field: 'masterJobId', op: '==', value: params.master_job_id });

      const { items, total } = await queryCollection<ProductionJobDoc>(
        MARKETING_COLLECTIONS.PRODUCTION_JOBS,
        { filters, limit: MAX_PAGE_SIZE },
      );

      if (!items.length) {
        return { content: [{ type: 'text' as const, text: 'No production jobs in scope.' }] };
      }

      const byStage: Record<string, number> = {};
      const byType: Record<string, number> = {};
      let completeCount = 0;
      for (const p of items) {
        const s = p.stage ?? '—';
        byStage[s] = (byStage[s] ?? 0) + 1;
        const t = p.type ?? '—';
        byType[t] = (byType[t] ?? 0) + 1;
        if (p.stage === 'COMPLETE') completeCount++;
      }

      const completionPct = items.length ? ((completeCount / items.length) * 100).toFixed(0) : '0';

      const lines = [
        `**Production Summary** — ${items.length} of ${total} jobs in scope`,
        params.subsidiary_org_id ? `Sub-brand: ${params.subsidiary_org_id}` : '',
        params.master_job_id ? `Master job: ${params.master_job_id}` : '',
        '',
        `**Completion:** ${completeCount} of ${items.length} jobs at COMPLETE (${completionPct}%)`,
        '',
        '## By stage',
        '',
        '| Stage | Count |',
        '|-------|-------|',
      ];
      // Preserve canonical 10-stage order
      for (const s of PRODUCTION_STAGES) {
        if (byStage[s]) lines.push(`| ${s} | ${byStage[s]} |`);
      }
      // Any non-canonical residues
      for (const s of Object.keys(byStage)) {
        if (!(PRODUCTION_STAGES as readonly string[]).includes(s)) {
          lines.push(`| ${s} _(unknown)_ | ${byStage[s]} |`);
        }
      }

      lines.push('', '## By type', '', '| Type | Count |', '|------|-------|');
      for (const [t, n] of Object.entries(byType)) lines.push(`| ${t} | ${n} |`);

      return { content: [{ type: 'text' as const, text: lines.filter(Boolean).join('\n') }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });
}
