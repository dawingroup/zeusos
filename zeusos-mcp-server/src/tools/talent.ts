/**
 * Talent tools (Phase 5.A).
 *
 * Reads:
 *   talent_profiles/{profileId}        — staff + freelancer roster
 *   talent_invoices/{invoiceId}        — freelancer-submitted invoices
 *   freelancer_contracts/{contractId}  — signed engagement contracts
 *
 * Sensitive field: `talent_profiles.bankDetails` is admin-write-restricted
 * per its type doc. These read tools strip it from output by default —
 * pass `include_bank_details: true` to surface it (caller's RBAC still
 * applies at the Firestore rules layer).
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
  TALENT_TYPES,
  TALENT_STATUSES,
  TALENT_INVOICE_STATUSES,
  ZEUS_SUBSIDIARY_IDS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../constants.js';

interface TalentProfileDoc {
  id: string;
  name?: string;
  email?: string;
  type?: 'STAFF' | 'FREELANCER';
  subsidiaryOrgId?: string;
  roles?: string[];
  dailyRateMinor?: number;
  currency?: string;
  ndaStorageRef?: string;
  bankDetails?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED';
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

interface TalentInvoiceDoc {
  id: string;
  talentProfileId?: string;
  contractId?: string;
  masterJobId?: string;
  orgId?: string;
  amountMinor?: number;
  currency?: string;
  status?: 'SUBMITTED' | 'APPROVED' | 'PAID' | 'REJECTED';
  linkedPoId?: string;
  approvedAt?: unknown;
  rejectedAt?: unknown;
  rejectionReason?: string;
  paidAt?: unknown;
  createdAt?: unknown;
}

interface FreelancerContractDoc {
  id: string;
  talentProfileId?: string;
  masterJobId?: string;
  projectTitle?: string;
  startDate?: string;
  endDate?: string;
  totalFeeMinor?: number;
  currency?: string;
  signedContractStorageRef?: string;
  status?: 'DRAFT' | 'SIGNED' | 'EXPIRED';
}

export function registerTalentTools(server: McpServer): void {

  // ─── zeusos_list_talent ─────────────────────────────────────────────────────
  server.registerTool('zeusos_list_talent', {
    title: 'List Talent Roster',
    description: `List Zeus staff and freelancers from the Talent Roster. Filter by type (STAFF / FREELANCER), status (ACTIVE / INACTIVE / BLACKLISTED), role tag, or sub-brand affiliation.

\`bankDetails\` is admin-write-restricted on the underlying collection and is omitted from this output by default; set \`include_bank_details: true\` to surface it.`,
    inputSchema: {
      type: z.enum(TALENT_TYPES).optional()
        .describe('STAFF or FREELANCER'),
      status: z.enum(TALENT_STATUSES).optional()
        .describe('Filter by status'),
      role: z.string().optional()
        .describe('Role tag (e.g. "director", "dop", "voice_artist", "photographer")'),
      subsidiary_org_id: z.enum(ZEUS_SUBSIDIARY_IDS).optional()
        .describe('Filter by sub-brand affiliation'),
      include_bank_details: z.boolean().optional()
        .describe('Surface bankDetails on profiles (off by default; only honoured if Firestore RBAC permits)'),
      limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional()
        .describe(`Max records (default: ${DEFAULT_PAGE_SIZE})`),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const filters: QueryFilter[] = [];
      if (params.type) filters.push({ field: 'type', op: '==', value: params.type });
      if (params.status) filters.push({ field: 'status', op: '==', value: params.status });
      if (params.subsidiary_org_id) filters.push({ field: 'subsidiaryOrgId', op: '==', value: params.subsidiary_org_id });
      if (params.role) filters.push({ field: 'roles', op: 'array-contains', value: params.role });

      const { items, total } = await queryCollection<TalentProfileDoc>(
        MARKETING_COLLECTIONS.TALENT_PROFILES,
        {
          filters,
          orderByField: 'updatedAt',
          orderByDirection: 'desc',
          limit: params.limit ?? DEFAULT_PAGE_SIZE,
        },
      );

      if (!items.length) {
        return { content: [{ type: 'text' as const, text: 'No talent profiles match these filters.' }] };
      }

      const showBank = params.include_bank_details === true;

      const lines = [
        `**Talent Roster** (${items.length} of ${total})`,
        '',
        `| Name | Type | Roles | Sub-brand | Rate | NDA | Status${showBank ? ' | Bank' : ''} |`,
        `|------|------|-------|-----------|------|-----|--------${showBank ? '|------' : ''}|`,
      ];

      for (const t of items) {
        const rate = t.dailyRateMinor !== undefined
          ? `${formatCurrency(t.dailyRateMinor, t.currency ?? 'UGX')}/day`
          : '—';
        const bankCell = showBank ? ` | ${t.bankDetails ? '✓ on file' : '—'}` : '';
        lines.push(
          `| ${(t.name ?? '—').slice(0, 26)} | ${t.type ?? '—'} | ${(t.roles ?? []).slice(0, 3).join(', ')} | ${t.subsidiaryOrgId ?? '—'} | ${rate} | ${t.ndaStorageRef ? '✓' : '—'} | ${t.status ?? '—'}${bankCell} |`,
        );
      }

      lines.push('', `_IDs: ${items.map(t => t.id).join(', ')}_`);
      return { content: [{ type: 'text' as const, text: truncateIfNeeded(lines.join('\n')) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── zeusos_talent_invoice_status ───────────────────────────────────────────
  server.registerTool('zeusos_talent_invoice_status', {
    title: 'Talent Invoice Status',
    description: `List freelancer / talent invoices with status filters (SUBMITTED / APPROVED / PAID / REJECTED). Use to find outstanding talent invoices awaiting approval or payment, or to audit recent payouts to a freelancer.`,
    inputSchema: {
      status: z.enum(TALENT_INVOICE_STATUSES).optional()
        .describe('Filter by invoice status'),
      talent_profile_id: z.string().optional()
        .describe('Filter to invoices from one talent profile'),
      master_job_id: z.string().optional()
        .describe('Filter to invoices billed against one master job'),
      limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional()
        .describe(`Max records (default: ${DEFAULT_PAGE_SIZE})`),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const filters: QueryFilter[] = [];
      if (params.status) filters.push({ field: 'status', op: '==', value: params.status });
      if (params.talent_profile_id) filters.push({ field: 'talentProfileId', op: '==', value: params.talent_profile_id });
      if (params.master_job_id) filters.push({ field: 'masterJobId', op: '==', value: params.master_job_id });

      const { items, total } = await queryCollection<TalentInvoiceDoc>(
        MARKETING_COLLECTIONS.TALENT_INVOICES,
        {
          filters,
          orderByField: 'createdAt',
          orderByDirection: 'desc',
          limit: params.limit ?? DEFAULT_PAGE_SIZE,
        },
      );

      if (!items.length) {
        return { content: [{ type: 'text' as const, text: 'No talent invoices match these filters.' }] };
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
        `**Talent Invoices** (${items.length} of ${total})`,
        '',
        '**By status:**',
        ...Object.entries(byStatus).map(([s, agg]) => `- ${s}: ${agg.count} × — ${formatCurrency(agg.total, cur)}`),
        '',
        '| Talent | Master Job | Amount | Status | PO | Created |',
        '|--------|-----------|--------|--------|-----|---------|',
      ];

      for (const i of items) {
        lines.push(
          `| ${(i.talentProfileId ?? '—').slice(0, 16)} | ${(i.masterJobId ?? '—').slice(0, 14)} | ${formatCurrency(i.amountMinor ?? 0, i.currency ?? cur)} | ${i.status ?? '—'} | ${i.linkedPoId ?? '—'} | ${formatTimestamp(i.createdAt)} |`,
        );
      }

      return { content: [{ type: 'text' as const, text: truncateIfNeeded(lines.join('\n')) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── zeusos_freelancer_cost_summary ─────────────────────────────────────────
  server.registerTool('zeusos_freelancer_cost_summary', {
    title: 'Freelancer Cost Summary',
    description: `Roll-up of total spend per freelancer over a window: invoices and signed contracts. Identifies the agency's top freelancer cost drivers, which talent has unpaid invoices, and which engagements are committed (SIGNED contract) but not yet billed.`,
    inputSchema: {
      talent_profile_id: z.string().optional()
        .describe('Limit to one freelancer; omit to roll up across the roster'),
      master_job_id: z.string().optional()
        .describe('Limit to one master job'),
      include_rejected: z.boolean().optional()
        .describe('Include REJECTED invoices in totals (default: false)'),
      limit: z.number().int().min(1).max(500).optional()
        .describe('Underlying invoice scan limit (default: 200)'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const invFilters: QueryFilter[] = [];
      if (params.talent_profile_id) invFilters.push({ field: 'talentProfileId', op: '==', value: params.talent_profile_id });
      if (params.master_job_id) invFilters.push({ field: 'masterJobId', op: '==', value: params.master_job_id });

      const { items: invoices } = await queryCollection<TalentInvoiceDoc>(
        MARKETING_COLLECTIONS.TALENT_INVOICES,
        { filters: invFilters, orderByField: 'createdAt', orderByDirection: 'desc', limit: params.limit ?? 200 },
      );

      const conFilters: QueryFilter[] = [];
      if (params.talent_profile_id) conFilters.push({ field: 'talentProfileId', op: '==', value: params.talent_profile_id });
      if (params.master_job_id) conFilters.push({ field: 'masterJobId', op: '==', value: params.master_job_id });

      const { items: contracts } = await queryCollection<FreelancerContractDoc>(
        MARKETING_COLLECTIONS.FREELANCER_CONTRACTS,
        { filters: conFilters, orderByField: 'startDate', orderByDirection: 'desc', limit: 200 },
      );

      const includeRejected = params.include_rejected === true;

      // Per-freelancer roll-up
      const perTalent: Record<string, {
        name: string;
        invoiceCount: number;
        approvedMinor: number;
        paidMinor: number;
        submittedMinor: number;
        rejectedMinor: number;
        contractedMinor: number;
        currency: string;
      }> = {};

      // Cache profile names for nicer display
      const profileNameCache: Record<string, string> = {};
      async function nameOf(id: string): Promise<string> {
        if (!id) return '—';
        if (profileNameCache[id]) return profileNameCache[id];
        const p = await getDocument<TalentProfileDoc>(MARKETING_COLLECTIONS.TALENT_PROFILES, id);
        const n = p?.name ?? id;
        profileNameCache[id] = n;
        return n;
      }

      for (const inv of invoices) {
        const tid = inv.talentProfileId ?? '_unknown';
        if (!perTalent[tid]) {
          perTalent[tid] = {
            name: await nameOf(tid),
            invoiceCount: 0,
            approvedMinor: 0,
            paidMinor: 0,
            submittedMinor: 0,
            rejectedMinor: 0,
            contractedMinor: 0,
            currency: inv.currency ?? 'UGX',
          };
        }
        const agg = perTalent[tid];
        agg.invoiceCount++;
        const amt = inv.amountMinor ?? 0;
        switch (inv.status) {
          case 'SUBMITTED': agg.submittedMinor += amt; break;
          case 'APPROVED': agg.approvedMinor += amt; break;
          case 'PAID': agg.paidMinor += amt; break;
          case 'REJECTED': if (includeRejected) agg.rejectedMinor += amt; break;
        }
      }

      for (const c of contracts) {
        const tid = c.talentProfileId ?? '_unknown';
        if (!perTalent[tid]) {
          perTalent[tid] = {
            name: await nameOf(tid),
            invoiceCount: 0,
            approvedMinor: 0,
            paidMinor: 0,
            submittedMinor: 0,
            rejectedMinor: 0,
            contractedMinor: 0,
            currency: c.currency ?? 'UGX',
          };
        }
        if (c.status === 'SIGNED') {
          perTalent[tid].contractedMinor += c.totalFeeMinor ?? 0;
        }
      }

      if (!Object.keys(perTalent).length) {
        return { content: [{ type: 'text' as const, text: 'No freelancer cost data in scope.' }] };
      }

      // Sort by total committed cost (paid + approved + submitted + contracted) desc
      const rows = Object.entries(perTalent)
        .map(([id, agg]) => ({ id, ...agg, total: agg.paidMinor + agg.approvedMinor + agg.submittedMinor + agg.contractedMinor }))
        .sort((a, b) => b.total - a.total);

      const grandTotal = rows.reduce((s, r) => s + r.total, 0);
      const cur = rows[0]?.currency ?? 'UGX';

      const lines = [
        `**Freelancer Cost Summary** (${rows.length} talent ${rows.length === 1 ? 'record' : 'records'})`,
        `Invoices scanned: ${invoices.length}  |  Contracts scanned: ${contracts.length}  |  Total committed: ${formatCurrency(grandTotal, cur)}`,
        '',
        '| Talent | Invoices | Paid | Approved | Submitted | Signed contracts | Total committed |',
        '|--------|----------|------|----------|-----------|------------------|-----------------|',
      ];

      for (const r of rows.slice(0, 50)) {
        lines.push(
          `| ${r.name.slice(0, 22)} | ${r.invoiceCount} | ${formatCurrency(r.paidMinor, r.currency)} | ${formatCurrency(r.approvedMinor, r.currency)} | ${formatCurrency(r.submittedMinor, r.currency)} | ${formatCurrency(r.contractedMinor, r.currency)} | ${formatCurrency(r.total, r.currency)} |`,
        );
      }

      if (rows.length > 50) lines.push(`_...and ${rows.length - 50} more talent records._`);
      lines.push('', '_"Total committed" = paid + approved + submitted invoices + signed contract fees._');
      if (includeRejected) lines.push('_Rejected invoices are NOT included in totals but were scanned._');

      return { content: [{ type: 'text' as const, text: truncateIfNeeded(lines.join('\n')) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });
}
