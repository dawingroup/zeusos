/**
 * Billing + Inter-Company tools (Phase 5.A).
 *
 * Reads:
 *   client_invoices/{invoiceId}             — parent → external client
 *   intercompany_invoices/{icInvoiceId}     — subsidiary → parent at transfer price
 *   master_jobs/{masterJobId}               — for grouping by sub-brand
 *   internal_work_orders/{iwoId}            — for open commitment in subsidiary_pnl
 *
 * These are PARENT-ROLE tools. The `client_invoices` and
 * `intercompany_invoices` collections are gated to parent principals in
 * `firestore.rules` (plan §14.10 — three layers of "subsidiary never
 * quotes"). The MCP service account inherits parent visibility through
 * firebase-admin.
 *
 * The `cost_minor` / `transfer_price_minor` invariant (spec §14.7 / §14.8)
 * is respected: this server-side surface is for AM + Finance + Executive
 * Dashboard consumption — never client-facing. The MCP server is not
 * the client portal.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  queryCollection,
  formatCurrency,
  formatTimestamp,
  truncateIfNeeded,
} from '../services/firebase.js';
import type { QueryFilter } from '../services/firebase.js';
import {
  MARKETING_COLLECTIONS,
  CLIENT_INVOICE_STATUSES,
  IWO_ACTIVE_STATES,
  ZEUS_SUBSIDIARY_IDS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../constants.js';

interface ClientInvoiceDoc {
  id: string;
  clientId?: string;
  masterJobId?: string;
  issuerOrgId?: string;
  total?: { amountMinor?: number; currency?: string };
  status?: 'DRAFT' | 'ISSUED' | 'PART_PAID' | 'PAID' | 'VOID';
  paidMinor?: number;
  uniqueGuardKey?: string;
  issuedAt?: unknown;
  paidAt?: unknown;
  voidedAt?: unknown;
}

interface IntercompanyInvoiceDoc {
  id: string;
  iwoId?: string;
  fromOrgId?: string;
  toOrgId?: string;
  amountMinor?: number;
  currency?: string;
  status?: 'RAISED' | 'POSTED' | 'PAID';
  postedToGl?: boolean;
  postedAt?: unknown;
  paidAt?: unknown;
  createdAt?: unknown;
}

interface IwoStub {
  id: string;
  state?: string;
  subsidiaryOrgId?: string;
  masterJobId?: string;
  budgetMinor?: number;
  cumulativeCostMinor?: number;
  currency?: string;
}

// ─── Aging buckets ───────────────────────────────────────────────────────────

interface AgingBucket {
  label: string;
  count: number;
  totalMinor: number;
  outstandingMinor: number;
}

function bucketOf(daysOpen: number): string {
  if (daysOpen <= 30) return '0–30';
  if (daysOpen <= 60) return '31–60';
  if (daysOpen <= 90) return '61–90';
  return '90+';
}

function daysSince(ts: unknown): number | null {
  if (!ts) return null;
  let date: Date | null = null;
  if (typeof (ts as { toDate?: unknown }).toDate === 'function') {
    date = (ts as { toDate: () => Date }).toDate();
  } else if (typeof ts === 'string') {
    date = new Date(ts);
  }
  if (!date || isNaN(date.getTime())) return null;
  const ms = Date.now() - date.getTime();
  return Math.floor(ms / 86_400_000);
}

export function registerBillingTools(server: McpServer): void {

  // ─── zeusos_accounts_receivable_aging ───────────────────────────────────────
  server.registerTool('zeusos_accounts_receivable_aging', {
    title: 'Accounts Receivable Aging',
    description: `Outstanding client invoices bucketed by age (0–30 / 31–60 / 61–90 / 90+ days since \`issuedAt\`). Surfaces total exposure, by-client concentration, and how much sits past 60 days — the typical AR risk signal.

Only the parent (Zeus Group) issues client invoices — by spec invariant there is **at most one non-void ClientInvoice per master job**.

Parent-role tool — subsidiary principals receive a Firestore rules denial on the underlying collection.`,
    inputSchema: {
      include_statuses: z.array(z.enum(CLIENT_INVOICE_STATUSES)).optional()
        .describe('Statuses to include (default: ISSUED + PART_PAID — the outstanding set)'),
      client_id: z.string().optional()
        .describe('Limit to one client'),
      limit: z.number().int().min(1).max(500).optional()
        .describe('Underlying scan limit (default: 200)'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const statuses = params.include_statuses ?? ['ISSUED', 'PART_PAID'];

      const filters: QueryFilter[] = [
        { field: 'status', op: 'in', value: statuses },
      ];
      if (params.client_id) filters.push({ field: 'clientId', op: '==', value: params.client_id });

      const { items, total } = await queryCollection<ClientInvoiceDoc>(
        MARKETING_COLLECTIONS.CLIENT_INVOICES,
        {
          filters,
          orderByField: 'issuedAt',
          orderByDirection: 'asc',
          limit: params.limit ?? 200,
        },
      );

      if (!items.length) {
        return { content: [{ type: 'text' as const, text: 'No outstanding client invoices.' }] };
      }

      const buckets: Record<string, AgingBucket> = {
        '0–30': { label: '0–30', count: 0, totalMinor: 0, outstandingMinor: 0 },
        '31–60': { label: '31–60', count: 0, totalMinor: 0, outstandingMinor: 0 },
        '61–90': { label: '61–90', count: 0, totalMinor: 0, outstandingMinor: 0 },
        '90+': { label: '90+', count: 0, totalMinor: 0, outstandingMinor: 0 },
        unknown: { label: 'unknown', count: 0, totalMinor: 0, outstandingMinor: 0 },
      };

      const byClient: Record<string, { count: number; outstanding: number }> = {};

      const rows: Array<{ id: string; client: string; total: number; outstanding: number; days: number | null; bucket: string; status: string; currency: string }> = [];

      let totalExposure = 0;
      const currency = items[0]?.total?.currency ?? 'UGX';

      for (const inv of items) {
        const totalAmt = inv.total?.amountMinor ?? 0;
        const paid = inv.paidMinor ?? 0;
        const outstanding = Math.max(totalAmt - paid, 0);
        const d = daysSince(inv.issuedAt);
        const bucket = d == null ? 'unknown' : bucketOf(d);
        buckets[bucket].count++;
        buckets[bucket].totalMinor += totalAmt;
        buckets[bucket].outstandingMinor += outstanding;
        const cid = inv.clientId ?? '_unknown';
        if (!byClient[cid]) byClient[cid] = { count: 0, outstanding: 0 };
        byClient[cid].count++;
        byClient[cid].outstanding += outstanding;
        totalExposure += outstanding;
        rows.push({
          id: inv.id,
          client: cid,
          total: totalAmt,
          outstanding,
          days: d,
          bucket,
          status: inv.status ?? '—',
          currency: inv.total?.currency ?? currency,
        });
      }

      const lines = [
        `**AR Aging** — ${items.length} of ${total} outstanding invoice(s)  |  Total exposure: ${formatCurrency(totalExposure, currency)}`,
        '',
        '## By bucket',
        '',
        '| Bucket | Invoices | Outstanding |',
        '|--------|----------|-------------|',
      ];
      for (const b of ['0–30', '31–60', '61–90', '90+', 'unknown']) {
        const bucket = buckets[b];
        if (bucket.count) lines.push(`| ${bucket.label} days | ${bucket.count} | ${formatCurrency(bucket.outstandingMinor, currency)} |`);
      }

      const topClients = Object.entries(byClient)
        .sort((a, b) => b[1].outstanding - a[1].outstanding)
        .slice(0, 10);

      lines.push('', '## Top exposure by client', '', '| Client | Invoices | Outstanding |', '|--------|----------|-------------|');
      for (const [cid, agg] of topClients) {
        lines.push(`| ${cid.slice(0, 24)} | ${agg.count} | ${formatCurrency(agg.outstanding, currency)} |`);
      }

      lines.push('', '## Invoices', '', '| Invoice | Client | Total | Outstanding | Days open | Bucket | Status |', '|---------|--------|-------|-------------|-----------|--------|--------|');
      for (const r of rows.slice(0, 40)) {
        lines.push(
          `| ${r.id.slice(0, 12)} | ${r.client.slice(0, 20)} | ${formatCurrency(r.total, r.currency)} | ${formatCurrency(r.outstanding, r.currency)} | ${r.days ?? '—'} | ${r.bucket} | ${r.status} |`,
        );
      }
      if (rows.length > 40) lines.push(`_...and ${rows.length - 40} more invoices._`);

      return { content: [{ type: 'text' as const, text: truncateIfNeeded(lines.join('\n')) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── zeusos_subsidiary_pnl ──────────────────────────────────────────────────
  server.registerTool('zeusos_subsidiary_pnl', {
    title: 'Subsidiary P&L Roll-Up',
    description: `Per-legal-entity P&L roll-up across the 5 Zeus sub-brands. Sources:
- **Revenue (recognised):** inter-company invoices in status POSTED or PAID, summed by \`fromOrgId\`. Spec §8.3 — the IC invoice at governed transfer price is the subsidiary's revenue.
- **Open commitment:** sum of (budgetMinor − cumulativeCostMinor) on IWOs in active states, grouped by \`subsidiaryOrgId\`. Surfaces unbilled work-in-progress.
- **Headcount on issued IWOs:** count of active IWOs per sub-brand (rough delivery-load proxy).

Designed for the Phase 5.B Executive Dashboard's per-sub-brand panel. Parent-role tool.`,
    inputSchema: {
      since: z.string().optional()
        .describe('Lower bound on IC invoice createdAt — ISO date string (YYYY-MM-DD). Default: include all.'),
      include_paid_only: z.boolean().optional()
        .describe('If true, only IC invoices in PAID status count as recognised revenue (default: include POSTED + PAID)'),
      limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional()
        .describe(`Underlying IC invoice scan limit (default: ${MAX_PAGE_SIZE})`),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const recognisedStatuses = params.include_paid_only ? ['PAID'] : ['POSTED', 'PAID'];
      const icFilters: QueryFilter[] = [{ field: 'status', op: 'in', value: recognisedStatuses }];
      if (params.since) {
        icFilters.push({ field: 'createdAt', op: '>=', value: new Date(params.since) });
      }

      const { items: icInvoices } = await queryCollection<IntercompanyInvoiceDoc>(
        MARKETING_COLLECTIONS.INTERCOMPANY_INVOICES,
        {
          filters: icFilters,
          orderByField: 'createdAt',
          orderByDirection: 'desc',
          limit: params.limit ?? MAX_PAGE_SIZE,
        },
      );

      const { items: activeIwos } = await queryCollection<IwoStub>(
        MARKETING_COLLECTIONS.INTERNAL_WORK_ORDERS,
        {
          filters: [{ field: 'state', op: 'in', value: IWO_ACTIVE_STATES as readonly string[] }],
          limit: 500,
        },
      );

      // Per-sub-brand aggregates
      type SubRow = {
        revenueMinor: number;
        revenueByCurrency: Record<string, number>;
        invoiceCount: number;
        openIwoCount: number;
        openCommitmentMinor: number;
        openCommitmentByCurrency: Record<string, number>;
      };
      const empty = (): SubRow => ({
        revenueMinor: 0,
        revenueByCurrency: {},
        invoiceCount: 0,
        openIwoCount: 0,
        openCommitmentMinor: 0,
        openCommitmentByCurrency: {},
      });

      const subs: Record<string, SubRow> = {};

      for (const ic of icInvoices) {
        const from = ic.fromOrgId ?? '_unknown';
        if (!subs[from]) subs[from] = empty();
        const cur = ic.currency ?? 'UGX';
        const amt = ic.amountMinor ?? 0;
        subs[from].invoiceCount++;
        subs[from].revenueMinor += amt;
        subs[from].revenueByCurrency[cur] = (subs[from].revenueByCurrency[cur] ?? 0) + amt;
      }

      for (const iwo of activeIwos) {
        const sub = iwo.subsidiaryOrgId ?? '_unknown';
        if (!subs[sub]) subs[sub] = empty();
        const cur = iwo.currency ?? 'UGX';
        const remaining = Math.max((iwo.budgetMinor ?? 0) - (iwo.cumulativeCostMinor ?? 0), 0);
        subs[sub].openIwoCount++;
        subs[sub].openCommitmentMinor += remaining;
        subs[sub].openCommitmentByCurrency[cur] = (subs[sub].openCommitmentByCurrency[cur] ?? 0) + remaining;
      }

      if (!Object.keys(subs).length) {
        return { content: [{ type: 'text' as const, text: 'No IC invoices or active IWOs in scope.' }] };
      }

      const formatByCurrency = (m: Record<string, number>): string => {
        const entries = Object.entries(m);
        if (!entries.length) return '—';
        return entries.map(([c, v]) => formatCurrency(v, c)).join(' + ');
      };

      const rows = Object.entries(subs)
        .map(([id, row]) => ({ id, ...row }))
        .sort((a, b) => b.revenueMinor - a.revenueMinor);

      const lines = [
        `**Subsidiary P&L Roll-Up**`,
        `IC invoices in scope: ${icInvoices.length}  |  Active IWOs: ${activeIwos.length}${params.since ? `  |  Since: ${params.since}` : ''}${params.include_paid_only ? '  |  Recognised: PAID only' : '  |  Recognised: POSTED + PAID'}`,
        '',
        '| Sub-brand | IC invoices | Recognised revenue | Open IWOs | Open commitment |',
        '|-----------|-------------|--------------------|-----------|-----------------|',
      ];

      for (const r of rows) {
        const sub = (ZEUS_SUBSIDIARY_IDS as readonly string[]).includes(r.id) ? r.id : `${r.id} _(unknown)_`;
        lines.push(
          `| ${sub} | ${r.invoiceCount} | ${formatByCurrency(r.revenueByCurrency)} | ${r.openIwoCount} | ${formatByCurrency(r.openCommitmentByCurrency)} |`,
        );
      }

      lines.push(
        '',
        '_Revenue is at governed transfer price (spec §8.3); decoupled from client markup. Open commitment = sum of (budget − cumulative cost) on active IWOs — a rough WIP exposure proxy. FX is preserved at the IC-invoice currency; the consolidated client-invoice FX conversion happens at billing, not here._',
      );

      return { content: [{ type: 'text' as const, text: truncateIfNeeded(lines.join('\n')) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });
}
