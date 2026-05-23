/**
 * Internal Work Order (IWO) tools (Phase 5.A).
 *
 * IWOs are the cross-entity work mechanism — every unit of work that moves
 * from the parent to a subsidiary is one IWO (spec §1.1 / §6.1 / plan §14.4).
 *
 * Reads `internal_work_orders` (top-level) plus the four subcollections:
 *   handoff_packet/packet, time_entries, cost_entries, deliverables
 *
 * State machine reference: src/modules/assignment/constants/iwo-states.ts.
 *
 * RBAC: subsidiary principals already see only IWOs targeting their org via
 * firestore.rules; the MCP service account inherits parent visibility.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  queryCollection,
  getDocument,
  getSubDocument,
  getSubcollection,
  formatCurrency,
  formatTimestamp,
  truncateIfNeeded,
} from '../services/firebase.js';
import type { QueryFilter } from '../services/firebase.js';
import {
  MARKETING_COLLECTIONS,
  IWO_SUBCOLLECTIONS,
  IWO_STATES,
  ZEUS_SUBSIDIARY_IDS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../constants.js';
import type { IWOState } from '../constants.js';

interface IwoDoc {
  id: string;
  masterJobId?: string;
  subsidiaryOrgId?: string;
  code?: string;
  state?: IWOState;
  budgetMinor?: number;
  transferPriceMinor?: number;
  cumulativeCostMinor?: number;
  currency?: string;
  budgetHoldId?: string;
  issuedByUserId?: string;
  issuedAt?: unknown;
  acceptedByUserId?: string;
  acceptedAt?: unknown;
  rejectedByUserId?: string;
  rejectedAt?: unknown;
  rejectionReason?: string;
  deliveredAt?: unknown;
  acceptedInternallyByUserId?: string;
  acceptedInternallyAt?: unknown;
  closedAt?: unknown;
  cancelledAt?: unknown;
  cancelReason?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

interface HandoffPacket {
  iwoId?: string;
  briefSummary?: string;
  milestones?: Array<{ id?: string; title: string; dueDate?: string; done?: boolean }>;
  acceptanceCriteria?: Array<{ id?: string; criterion: string; required?: boolean; signed?: boolean }>;
  commsOwnerUserId?: string;
  attachments?: Array<{ storageRef: string; description?: string }>;
}

interface TimeEntry { id: string; minutes?: number; amountMinor?: number; createdAt?: unknown }
interface CostEntry { id: string; amountMinor?: number; description?: string; createdAt?: unknown }
interface DeliverableDoc {
  id: string;
  title?: string;
  status?: string;
  storageRef?: string;
  submittedAt?: unknown;
}

function burnPct(cost: number, budget: number): string {
  if (!budget) return '—';
  return `${((cost / budget) * 100).toFixed(0)}%`;
}

function thresholdFlag(cost: number, budget: number): string {
  if (!budget) return '';
  const pct = (cost / budget) * 100;
  if (pct >= 100) return ' ⛔ 100% — BUDGET_EXCEEDED';
  if (pct >= 80) return ' ⚠ 80% threshold crossed';
  return '';
}

export function registerIwoTools(server: McpServer): void {

  // ─── zeusos_list_iwos ───────────────────────────────────────────────────────
  server.registerTool('zeusos_list_iwos', {
    title: 'List Internal Work Orders',
    description: `List IWOs — the cross-entity work unit between the Zeus parent and the 5 sub-brands. Filter by master job, receiving subsidiary, or state. Returns IWO code, state, budget vs cumulative cost (burn), and transfer price.

State legend: DRAFT → ISSUED → ACCEPTED → IN_PROGRESS → DELIVERED → ACCEPTED_INTERNALLY → CLOSED.  REJECTED / CANCELLED are off-ramps.`,
    inputSchema: {
      master_job_id: z.string().optional().describe('Filter to one master job'),
      subsidiary_org_id: z.enum(ZEUS_SUBSIDIARY_IDS).optional()
        .describe('Filter by receiving sub-brand'),
      state: z.enum(IWO_STATES).optional().describe('Filter by IWO state'),
      active_only: z.boolean().optional()
        .describe('Only ISSUED / ACCEPTED / IN_PROGRESS / DELIVERED / ACCEPTED_INTERNALLY (default: false)'),
      limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional()
        .describe(`Max records (default: ${DEFAULT_PAGE_SIZE})`),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const filters: QueryFilter[] = [];
      if (params.master_job_id) filters.push({ field: 'masterJobId', op: '==', value: params.master_job_id });
      if (params.subsidiary_org_id) filters.push({ field: 'subsidiaryOrgId', op: '==', value: params.subsidiary_org_id });
      if (params.state) {
        filters.push({ field: 'state', op: '==', value: params.state });
      } else if (params.active_only) {
        filters.push({ field: 'state', op: 'in', value: ['ISSUED', 'ACCEPTED', 'IN_PROGRESS', 'DELIVERED', 'ACCEPTED_INTERNALLY'] });
      }

      const { items, total } = await queryCollection<IwoDoc>(
        MARKETING_COLLECTIONS.INTERNAL_WORK_ORDERS,
        {
          filters,
          orderByField: 'updatedAt',
          orderByDirection: 'desc',
          limit: params.limit ?? DEFAULT_PAGE_SIZE,
        },
      );

      if (!items.length) {
        return { content: [{ type: 'text' as const, text: 'No IWOs match these filters.' }] };
      }

      const cur = items[0]?.currency ?? 'UGX';
      const budgetSum = items.reduce((s, i) => s + (i.budgetMinor ?? 0), 0);
      const costSum = items.reduce((s, i) => s + (i.cumulativeCostMinor ?? 0), 0);

      const lines = [
        `**Internal Work Orders** (${items.length} of ${total})`,
        `Budget total: ${formatCurrency(budgetSum, cur)}  |  Cost posted: ${formatCurrency(costSum, cur)}  |  Burn: ${burnPct(costSum, budgetSum)}`,
        '',
        '| Code | Master Job | Subsidiary | State | Budget | Cost | Burn |',
        '|------|-----------|-----------|-------|--------|------|------|',
      ];

      for (const i of items) {
        const budget = i.budgetMinor ?? 0;
        const cost = i.cumulativeCostMinor ?? 0;
        const c = i.currency ?? cur;
        lines.push(
          `| ${i.code ?? i.id.slice(0, 12)} | ${(i.masterJobId ?? '—').slice(0, 14)} | ${i.subsidiaryOrgId ?? '—'} | ${i.state ?? '—'} | ${formatCurrency(budget, c)} | ${formatCurrency(cost, c)} | ${burnPct(cost, budget)}${thresholdFlag(cost, budget)} |`,
        );
      }

      lines.push('', `_IDs: ${items.map(i => i.id).join(', ')}_`);
      return { content: [{ type: 'text' as const, text: truncateIfNeeded(lines.join('\n')) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── zeusos_get_iwo ─────────────────────────────────────────────────────────
  server.registerTool('zeusos_get_iwo', {
    title: 'Get IWO Detail',
    description: `Full IWO detail: state, budget vs cost burn, transfer price, handoff packet (brief summary + milestones + acceptance criteria + comms owner), and counts of time entries / cost entries / deliverables.

The handoff packet lives at the singleton subcollection \`handoff_packet/packet\`.`,
    inputSchema: {
      iwo_id: z.string().describe('IWO document ID'),
      include_packet: z.boolean().optional()
        .describe('Include the full handoff_packet payload (default: true)'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const i = await getDocument<IwoDoc>(MARKETING_COLLECTIONS.INTERNAL_WORK_ORDERS, params.iwo_id);
      if (!i) {
        return { content: [{ type: 'text' as const, text: `IWO ${params.iwo_id} not found.` }] };
      }

      const cur = i.currency ?? 'UGX';
      const budget = i.budgetMinor ?? 0;
      const cost = i.cumulativeCostMinor ?? 0;

      const lines: string[] = [
        `# IWO ${i.code ?? i.id}`,
        '',
        `**State:** ${i.state ?? '—'}${thresholdFlag(cost, budget)}`,
        `**Master Job:** ${i.masterJobId ?? '—'}`,
        `**Receiving sub-brand:** ${i.subsidiaryOrgId ?? '—'}`,
        '',
        '**Commercials**',
        `- Budget: ${formatCurrency(budget, cur)}`,
        `- Cost posted: ${formatCurrency(cost, cur)} (${burnPct(cost, budget)})`,
        `- Transfer price: ${formatCurrency(i.transferPriceMinor ?? 0, cur)}  _(governed inter-company price, decoupled from client markup)_`,
        `- Budget hold: ${i.budgetHoldId ?? '—'}`,
        '',
        '**Lifecycle**',
        i.issuedAt ? `- Issued ${formatTimestamp(i.issuedAt)} by ${i.issuedByUserId ?? '—'}` : '',
        i.acceptedAt ? `- Accepted ${formatTimestamp(i.acceptedAt)} by ${i.acceptedByUserId ?? '—'}` : '',
        i.rejectedAt ? `- Rejected ${formatTimestamp(i.rejectedAt)} by ${i.rejectedByUserId ?? '—'} — ${i.rejectionReason ?? '(no reason)'}` : '',
        i.deliveredAt ? `- Delivered ${formatTimestamp(i.deliveredAt)}` : '',
        i.acceptedInternallyAt ? `- Internally accepted ${formatTimestamp(i.acceptedInternallyAt)} by ${i.acceptedInternallyByUserId ?? '—'}` : '',
        i.closedAt ? `- Closed ${formatTimestamp(i.closedAt)} _(IC invoice raised, hold SETTLED)_` : '',
        i.cancelledAt ? `- Cancelled ${formatTimestamp(i.cancelledAt)} — ${i.cancelReason ?? '(no reason)'}` : '',
      ].filter(Boolean);

      // Handoff packet
      if (params.include_packet !== false) {
        const packet = await getSubDocument<HandoffPacket & { id: string }>(
          MARKETING_COLLECTIONS.INTERNAL_WORK_ORDERS,
          i.id,
          IWO_SUBCOLLECTIONS.HANDOFF_PACKET,
          'packet',
        );
        if (packet) {
          lines.push('', '## Handoff Packet');
          if (packet.briefSummary) lines.push(`**Brief summary:** ${packet.briefSummary}`);
          if (packet.commsOwnerUserId) lines.push(`**Comms owner:** ${packet.commsOwnerUserId}`);
          if (packet.milestones?.length) {
            lines.push('', '**Milestones:**');
            for (const m of packet.milestones) {
              lines.push(`- ${m.done ? '✓' : '○'} ${m.title}${m.dueDate ? ` _(due ${m.dueDate})_` : ''}`);
            }
          }
          if (packet.acceptanceCriteria?.length) {
            lines.push('', '**Acceptance criteria:**');
            for (const a of packet.acceptanceCriteria) {
              lines.push(`- ${a.signed ? '✓' : '○'} ${a.criterion}${a.required ? ' _(required)_' : ''}`);
            }
          }
          if (packet.attachments?.length) {
            lines.push('', `**Attachments:** ${packet.attachments.length} file(s)`);
          }
        } else {
          lines.push('', '_No handoff packet attached. IWO cannot ISSUE without one._');
        }
      }

      // Counts of time / cost / deliverables
      const [{ total: timeCount }, { total: costCount }, deliverables] = await Promise.all([
        queryCollection<TimeEntry>(`${MARKETING_COLLECTIONS.INTERNAL_WORK_ORDERS}/${i.id}/${IWO_SUBCOLLECTIONS.TIME_ENTRIES}`, { limit: 1 }),
        queryCollection<CostEntry>(`${MARKETING_COLLECTIONS.INTERNAL_WORK_ORDERS}/${i.id}/${IWO_SUBCOLLECTIONS.COST_ENTRIES}`, { limit: 1 }),
        getSubcollection<DeliverableDoc>(MARKETING_COLLECTIONS.INTERNAL_WORK_ORDERS, i.id, IWO_SUBCOLLECTIONS.DELIVERABLES, { limit: 50 }),
      ]);

      lines.push('', '## Subcollection counts');
      lines.push(`- Time entries: ${timeCount}`);
      lines.push(`- Cost entries: ${costCount}`);
      lines.push(`- Deliverables: ${deliverables.length}`);

      if (deliverables.length) {
        lines.push('', '**Recent deliverables:**');
        for (const d of deliverables.slice(0, 10)) {
          lines.push(`- ${d.title ?? d.id} _(${d.status ?? 'pending'})_${d.submittedAt ? `, submitted ${formatTimestamp(d.submittedAt)}` : ''}`);
        }
      }

      lines.push('', `_Created ${formatTimestamp(i.createdAt)} | Updated ${formatTimestamp(i.updatedAt)}_`);

      return { content: [{ type: 'text' as const, text: truncateIfNeeded(lines.join('\n')) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── zeusos_iwo_burn_report ─────────────────────────────────────────────────
  server.registerTool('zeusos_iwo_burn_report', {
    title: 'IWO Burn Report (per Master Job)',
    description: `Cumulative cost vs locked budget across all IWOs of a master job. Highlights any IWO at ≥80% burn (the soft \`BudgetThresholdCrossed\` event per spec §11.2) or ≥100% (hard \`422 BUDGET_EXCEEDED\`).

Use this on the Executive Dashboard's Master-Job row or as the entry point when a budget alarm fires.`,
    inputSchema: {
      master_job_id: z.string().describe('Master job document ID'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const { items: iwos } = await queryCollection<IwoDoc>(
        MARKETING_COLLECTIONS.INTERNAL_WORK_ORDERS,
        {
          filters: [{ field: 'masterJobId', op: '==', value: params.master_job_id }],
          orderByField: 'createdAt',
          orderByDirection: 'asc',
          limit: 200,
        },
      );

      if (!iwos.length) {
        return { content: [{ type: 'text' as const, text: `No IWOs found for master job ${params.master_job_id}.` }] };
      }

      const cur = iwos[0]?.currency ?? 'UGX';
      let budgetSum = 0;
      let costSum = 0;
      let breachedCount = 0;
      let warningCount = 0;

      const rows: string[] = [];
      for (const i of iwos) {
        const budget = i.budgetMinor ?? 0;
        const cost = i.cumulativeCostMinor ?? 0;
        budgetSum += budget;
        costSum += cost;
        const pct = budget ? (cost / budget) * 100 : 0;
        const status = pct >= 100 ? '⛔ BREACHED' : pct >= 80 ? '⚠ WARNING' : '✓ OK';
        if (pct >= 100) breachedCount++;
        else if (pct >= 80) warningCount++;
        rows.push(`| ${i.code ?? i.id.slice(0, 12)} | ${i.subsidiaryOrgId ?? '—'} | ${i.state ?? '—'} | ${formatCurrency(budget, i.currency ?? cur)} | ${formatCurrency(cost, i.currency ?? cur)} | ${pct.toFixed(0)}% | ${status} |`);
      }

      const lines = [
        `**Burn Report — Master Job ${params.master_job_id}**`,
        `IWOs: ${iwos.length}  |  Budget total: ${formatCurrency(budgetSum, cur)}  |  Cost posted: ${formatCurrency(costSum, cur)}  |  Roll-up burn: ${burnPct(costSum, budgetSum)}`,
        '',
        breachedCount ? `⛔ **${breachedCount} IWO(s) breached** the 100% budget cap. Hard block on further cost postings until change-order approved.` : '',
        warningCount ? `⚠ **${warningCount} IWO(s) at 80%+ burn** — soft threshold per spec §11.2.` : '',
        '',
        '| IWO | Subsidiary | State | Budget | Cost | Burn | Status |',
        '|-----|-----------|-------|--------|------|------|--------|',
        ...rows,
      ].filter(Boolean);

      return { content: [{ type: 'text' as const, text: truncateIfNeeded(lines.join('\n')) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });
}
