/**
 * Media tools (Phase 5.A).
 *
 * Reads:
 *   media_plans/{planId}                            — header
 *   media_plans/{planId}/media_buys/{buyId}         — buy rows per channel/vehicle
 *   media_plans/{planId}/actuals/{actualId}         — reconciliation actuals
 *   media_supplier_invoices/{invoiceId}             — supplier invoices
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  queryCollection,
  getDocument,
  getSubcollection,
  formatCurrency,
  formatTimestamp,
  truncateIfNeeded,
} from '../services/firebase.js';
import type { QueryFilter } from '../services/firebase.js';
import {
  MARKETING_COLLECTIONS,
  MEDIA_PLAN_SUBCOLLECTIONS,
  MEDIA_VEHICLE_TYPES,
  MEDIA_SUPPLIER_INVOICE_STATUSES,
  ZEUS_SUBSIDIARY_IDS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../constants.js';
import type { MediaVehicleType } from '../constants.js';

interface MediaPlanDoc {
  id: string;
  masterJobId?: string;
  campaignId?: string;
  subsidiaryOrgId?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  currency?: string;
  totalBudgetMinor?: number;
  title?: string;
  notes?: string;
  flightStartDate?: string;
  flightEndDate?: string;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

interface MediaBuyDoc {
  id: string;
  planId?: string;
  vehicleName?: string;
  vehicleType?: MediaVehicleType;
  startDate?: string;
  endDate?: string;
  plannedMinor?: number;
  bookedMinor?: number;
  actualMinor?: number;
  supplierId?: string;
  poId?: string;
  notes?: string;
}

interface MediaSupplierInvoiceDoc {
  id: string;
  orgId?: string;
  supplierOrgId?: string;
  mediaPlanId?: string;
  mediaBuyId?: string;
  masterJobId?: string;
  vehicleType?: string;
  amountMinor?: number;
  currency?: string;
  status?: 'SUBMITTED' | 'APPROVED' | 'PAID' | 'REJECTED';
  linkedPoId?: string;
  approvedAt?: unknown;
  paidAt?: unknown;
  rejectedAt?: unknown;
  rejectionReason?: string;
  createdAt?: unknown;
}

function variancePct(actual: number, planned: number): string {
  if (!planned) return '—';
  return `${(((actual - planned) / planned) * 100).toFixed(0)}%`;
}

export function registerMediaTools(server: McpServer): void {

  // ─── zeusos_list_media_plans ────────────────────────────────────────────────
  server.registerTool('zeusos_list_media_plans', {
    title: 'List Media Plans',
    description: `List media plans across the agency. Each plan holds the budget envelope and a set of buy rows per channel/vehicle (TV / RADIO / OOH / DIGITAL / etc.). Filter by master job, sub-brand, or status (DRAFT / ACTIVE / CLOSED).`,
    inputSchema: {
      master_job_id: z.string().optional()
        .describe('Filter to plans for a single master job'),
      subsidiary_org_id: z.enum(ZEUS_SUBSIDIARY_IDS).optional()
        .describe('Filter by owning sub-brand'),
      status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']).optional(),
      limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional()
        .describe(`Max records (default: ${DEFAULT_PAGE_SIZE})`),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const filters: QueryFilter[] = [];
      if (params.master_job_id) filters.push({ field: 'masterJobId', op: '==', value: params.master_job_id });
      if (params.subsidiary_org_id) filters.push({ field: 'subsidiaryOrgId', op: '==', value: params.subsidiary_org_id });
      if (params.status) filters.push({ field: 'status', op: '==', value: params.status });

      const { items, total } = await queryCollection<MediaPlanDoc>(
        MARKETING_COLLECTIONS.MEDIA_PLANS,
        {
          filters,
          orderByField: 'updatedAt',
          orderByDirection: 'desc',
          limit: params.limit ?? DEFAULT_PAGE_SIZE,
        },
      );

      if (!items.length) {
        return { content: [{ type: 'text' as const, text: 'No media plans match these filters.' }] };
      }

      const cur = items[0]?.currency ?? 'UGX';
      const budgetSum = items.reduce((s, p) => s + (p.totalBudgetMinor ?? 0), 0);

      const lines = [
        `**Media Plans** (${items.length} of ${total})  |  Total budget: ${formatCurrency(budgetSum, cur)}`,
        '',
        '| Title | Master Job | Sub-brand | Status | Budget | Flight |',
        '|-------|-----------|-----------|--------|--------|--------|',
      ];

      for (const p of items) {
        const flight = p.flightStartDate || p.flightEndDate
          ? `${p.flightStartDate ?? '?'} → ${p.flightEndDate ?? '?'}`
          : '—';
        lines.push(
          `| ${(p.title ?? '(untitled)').slice(0, 28)} | ${(p.masterJobId ?? '—').slice(0, 14)} | ${p.subsidiaryOrgId ?? '—'} | ${p.status ?? '—'} | ${formatCurrency(p.totalBudgetMinor ?? 0, p.currency ?? cur)} | ${flight} |`,
        );
      }

      lines.push('', `_IDs: ${items.map(p => p.id).join(', ')}_`);
      return { content: [{ type: 'text' as const, text: truncateIfNeeded(lines.join('\n')) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── zeusos_media_plan_summary ──────────────────────────────────────────────
  server.registerTool('zeusos_media_plan_summary', {
    title: 'Media Plan Summary',
    description: `Detailed planned vs booked vs actual roll-up for one media plan. Surfaces:
- per-vehicle spend (TV / RADIO / OOH / DIGITAL / SOCIAL / SEARCH / PROGRAMMATIC / PRINT)
- per-supplier spend
- variance (actual vs planned)
- buy rows with flight dates and link to supplier`,
    inputSchema: {
      media_plan_id: z.string().describe('Media plan document ID'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const plan = await getDocument<MediaPlanDoc>(MARKETING_COLLECTIONS.MEDIA_PLANS, params.media_plan_id);
      if (!plan) {
        return { content: [{ type: 'text' as const, text: `Media plan ${params.media_plan_id} not found.` }] };
      }

      const buys = await getSubcollection<MediaBuyDoc>(
        MARKETING_COLLECTIONS.MEDIA_PLANS,
        plan.id,
        MEDIA_PLAN_SUBCOLLECTIONS.MEDIA_BUYS,
        { orderByField: 'startDate', orderByDirection: 'asc', limit: 200 },
      );

      const cur = plan.currency ?? 'UGX';

      // Per-vehicle aggregation
      const byVehicle: Record<string, { planned: number; booked: number; actual: number; count: number }> = {};
      const bySupplier: Record<string, { planned: number; actual: number; count: number }> = {};
      let plannedSum = 0;
      let bookedSum = 0;
      let actualSum = 0;
      for (const b of buys) {
        const v = b.vehicleType ?? 'OTHER';
        if (!byVehicle[v]) byVehicle[v] = { planned: 0, booked: 0, actual: 0, count: 0 };
        byVehicle[v].planned += b.plannedMinor ?? 0;
        byVehicle[v].booked += b.bookedMinor ?? 0;
        byVehicle[v].actual += b.actualMinor ?? 0;
        byVehicle[v].count += 1;
        plannedSum += b.plannedMinor ?? 0;
        bookedSum += b.bookedMinor ?? 0;
        actualSum += b.actualMinor ?? 0;
        const sup = b.supplierId ?? '_(unassigned)_';
        if (!bySupplier[sup]) bySupplier[sup] = { planned: 0, actual: 0, count: 0 };
        bySupplier[sup].planned += b.plannedMinor ?? 0;
        bySupplier[sup].actual += b.actualMinor ?? 0;
        bySupplier[sup].count += 1;
      }

      const lines: string[] = [
        `# ${plan.title ?? plan.id}`,
        `**Master Job:** ${plan.masterJobId ?? '—'}  |  **Sub-brand:** ${plan.subsidiaryOrgId ?? '—'}  |  **Status:** ${plan.status ?? '—'}`,
        `**Budget envelope:** ${formatCurrency(plan.totalBudgetMinor ?? 0, cur)}  |  **Flight:** ${plan.flightStartDate ?? '?'} → ${plan.flightEndDate ?? '?'}`,
        '',
        '## Totals across buys',
        `- Planned: ${formatCurrency(plannedSum, cur)}`,
        `- Booked:  ${formatCurrency(bookedSum, cur)}`,
        `- Actual:  ${formatCurrency(actualSum, cur)}  _(variance vs planned: ${variancePct(actualSum, plannedSum)})_`,
        '',
        '## By vehicle',
        '',
        '| Vehicle | Buys | Planned | Booked | Actual | Variance |',
        '|---------|------|---------|--------|--------|----------|',
      ];

      for (const [v, agg] of Object.entries(byVehicle)) {
        lines.push(
          `| ${v} | ${agg.count} | ${formatCurrency(agg.planned, cur)} | ${formatCurrency(agg.booked, cur)} | ${formatCurrency(agg.actual, cur)} | ${variancePct(agg.actual, agg.planned)} |`,
        );
      }

      if (Object.keys(bySupplier).length) {
        lines.push('', '## By supplier', '', '| Supplier | Buys | Planned | Actual | Variance |', '|----------|------|---------|--------|----------|');
        for (const [sup, agg] of Object.entries(bySupplier)) {
          lines.push(`| ${sup.slice(0, 24)} | ${agg.count} | ${formatCurrency(agg.planned, cur)} | ${formatCurrency(agg.actual, cur)} | ${variancePct(agg.actual, agg.planned)} |`);
        }
      }

      if (buys.length) {
        lines.push('', `## Buys (${buys.length})`, '', '| Vehicle | Flight | Planned | Booked | Actual | Supplier | PO |', '|---------|--------|---------|--------|--------|----------|-----|');
        for (const b of buys.slice(0, 50)) {
          const flight = `${b.startDate ?? '?'} → ${b.endDate ?? '?'}`;
          lines.push(
            `| ${b.vehicleType ?? '—'} ${b.vehicleName ? `_(${b.vehicleName.slice(0, 18)})_` : ''} | ${flight} | ${formatCurrency(b.plannedMinor ?? 0, cur)} | ${formatCurrency(b.bookedMinor ?? 0, cur)} | ${formatCurrency(b.actualMinor ?? 0, cur)} | ${(b.supplierId ?? '—').slice(0, 14)} | ${b.poId ?? '—'} |`,
          );
        }
        if (buys.length > 50) lines.push(`_...and ${buys.length - 50} more buys._`);
      } else {
        lines.push('', '_No buy rows attached to this plan yet._');
      }

      lines.push('', `_Created ${formatTimestamp(plan.createdAt)} | Updated ${formatTimestamp(plan.updatedAt)}_`);

      return { content: [{ type: 'text' as const, text: truncateIfNeeded(lines.join('\n')) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── zeusos_media_supplier_invoice_status ───────────────────────────────────
  server.registerTool('zeusos_media_supplier_invoice_status', {
    title: 'Media Supplier Invoice Status',
    description: `List media supplier invoices with status filters (SUBMITTED / APPROVED / PAID / REJECTED). Use to chase outstanding supplier bills, sample paid invoices for IC reconciliation, or summarise pending media-vendor exposure across master jobs.`,
    inputSchema: {
      status: z.enum(MEDIA_SUPPLIER_INVOICE_STATUSES).optional()
        .describe('Filter by lifecycle status'),
      supplier_org_id: z.string().optional()
        .describe('Filter by supplier organisation'),
      master_job_id: z.string().optional()
        .describe('Filter by master job'),
      vehicle_type: z.enum(MEDIA_VEHICLE_TYPES).optional()
        .describe('Filter by media vehicle type'),
      limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional()
        .describe(`Max records (default: ${DEFAULT_PAGE_SIZE})`),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const filters: QueryFilter[] = [];
      if (params.status) filters.push({ field: 'status', op: '==', value: params.status });
      if (params.supplier_org_id) filters.push({ field: 'supplierOrgId', op: '==', value: params.supplier_org_id });
      if (params.master_job_id) filters.push({ field: 'masterJobId', op: '==', value: params.master_job_id });
      if (params.vehicle_type) filters.push({ field: 'vehicleType', op: '==', value: params.vehicle_type });

      const { items, total } = await queryCollection<MediaSupplierInvoiceDoc>(
        MARKETING_COLLECTIONS.MEDIA_SUPPLIER_INVOICES,
        {
          filters,
          orderByField: 'createdAt',
          orderByDirection: 'desc',
          limit: params.limit ?? DEFAULT_PAGE_SIZE,
        },
      );

      if (!items.length) {
        return { content: [{ type: 'text' as const, text: 'No media supplier invoices match these filters.' }] };
      }

      const cur = items[0]?.currency ?? 'UGX';
      const byStatus: Record<string, { count: number; total: number }> = {};
      for (const i of items) {
        const s = i.status ?? '—';
        if (!byStatus[s]) byStatus[s] = { count: 0, total: 0 };
        byStatus[s].count++;
        byStatus[s].total += i.amountMinor ?? 0;
      }

      const lines = [
        `**Media Supplier Invoices** (${items.length} of ${total})`,
        '',
        '**By status:**',
        ...Object.entries(byStatus).map(([s, agg]) => `- ${s}: ${agg.count} × — ${formatCurrency(agg.total, cur)}`),
        '',
        '| Supplier | Master Job | Vehicle | Amount | Status | PO | Created |',
        '|----------|-----------|---------|--------|--------|-----|---------|',
      ];

      for (const i of items) {
        lines.push(
          `| ${(i.supplierOrgId ?? '—').slice(0, 18)} | ${(i.masterJobId ?? '—').slice(0, 14)} | ${i.vehicleType ?? '—'} | ${formatCurrency(i.amountMinor ?? 0, i.currency ?? cur)} | ${i.status ?? '—'} | ${i.linkedPoId ?? '—'} | ${formatTimestamp(i.createdAt)} |`,
        );
      }

      return { content: [{ type: 'text' as const, text: truncateIfNeeded(lines.join('\n')) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });
}
