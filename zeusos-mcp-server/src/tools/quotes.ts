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
import { COLLECTIONS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants.js';

const QUOTE_STATUSES = ['draft', 'approved', 'synced', 'invoiced'] as const;

interface ClientQuote {
  id: string;
  customerId?: string;
  projectId?: string;
  status?: string;
  lineItems?: Array<Record<string, unknown>>;
  totalPrice?: number;
  subtotal?: number;
  tax?: number;
  currency?: string;
  qboSalesOrderId?: string;
  qboSalesOrderDocNumber?: string;
  qboInvoiceId?: string;
  qboInvoiceDocNumber?: string;
  qboSyncStatus?: string;
  qboSyncError?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export function registerQuoteTools(server: McpServer): void {

  // ─── zeusos_list_quotes ──────────────────────────────────────────────────────
  server.registerTool('zeusos_list_quotes', {
    title: 'List Client Quotes',
    description: `List and filter client quotes. Returns quote summary including status, customer, total value, and QuickBooks sync status.

Use this to:
- See all active quotes and their pipeline value
- Find quotes for a specific customer or project
- Identify quotes pending QBO sync
- Analyse quote conversion (draft → approved → invoiced)`,
    inputSchema: {
      status: z.enum(QUOTE_STATUSES).optional()
        .describe('Filter by quote status'),
      customer_id: z.string().optional()
        .describe('Filter by customer/contact ID'),
      project_id: z.string().optional()
        .describe('Filter by linked project ID'),
      limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional()
        .describe(`Max records to return (default: ${DEFAULT_PAGE_SIZE})`),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const filters: QueryFilter[] = [];
      if (params.status) filters.push({ field: 'status', op: '==', value: params.status });
      if (params.customer_id) filters.push({ field: 'customerId', op: '==', value: params.customer_id });
      if (params.project_id) filters.push({ field: 'projectId', op: '==', value: params.project_id });

      const { items: quotes, total } = await queryCollection<ClientQuote>(COLLECTIONS.CLIENT_QUOTES, {
        filters,
        orderByField: 'createdAt',
        orderByDirection: 'desc',
        limit: params.limit ?? DEFAULT_PAGE_SIZE,
      });

      if (!quotes.length) {
        return { content: [{ type: 'text' as const, text: 'No quotes found.' }] };
      }

      const currency = quotes[0]?.currency ?? 'UGX';
      const pipelineValue = quotes.reduce((s, q) => s + (Number(q.totalPrice) || 0), 0);

      const lines = [
        `**Client Quotes** (${quotes.length} of ${total})  |  Pipeline: ${formatCurrency(pipelineValue, currency)}`,
        '',
        '| # | Customer | Status | Total | Items | QBO | Date |',
        '|---|----------|--------|-------|-------|-----|------|',
      ];

      for (const [i, q] of quotes.entries()) {
        const itemCount = Array.isArray(q.lineItems) ? q.lineItems.length : '?';
        const qbo = q.qboSalesOrderId ? '✓ SO' : q.qboInvoiceId ? '✓ INV' : '—';
        lines.push(
          `| ${i + 1} | ${(q.customerId ?? '—').substring(0, 20)} | ${q.status ?? '—'} | ${formatCurrency(Number(q.totalPrice) || 0, currency)} | ${itemCount} | ${qbo} | ${formatTimestamp(q.createdAt)} |`
        );
      }

      lines.push('', `_IDs: ${quotes.map(q => q.id).join(', ')}_`);

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── zeusos_get_quote ────────────────────────────────────────────────────────
  server.registerTool('zeusos_get_quote', {
    title: 'Get Client Quote Detail',
    description: `Get full details of a client quote including all line items, pricing breakdown, tax summary, and QuickBooks sync status.`,
    inputSchema: {
      quote_id: z.string().describe('Quote document ID'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const q = await getDocument<ClientQuote>(COLLECTIONS.CLIENT_QUOTES, params.quote_id);
      if (!q) {
        return { content: [{ type: 'text' as const, text: `Quote ${params.quote_id} not found.` }] };
      }

      const currency = q.currency ?? 'UGX';
      const lineItems = Array.isArray(q.lineItems) ? q.lineItems : [];

      const lines = [
        `**Quote: ${params.quote_id}**`,
        `Status: ${q.status ?? '—'}  |  Customer: ${q.customerId ?? '—'}  |  Project: ${q.projectId ?? '—'}`,
        `Created: ${formatTimestamp(q.createdAt)}  |  Updated: ${formatTimestamp(q.updatedAt)}`,
        '',
      ];

      if (lineItems.length) {
        lines.push('**Line Items:**', '');
        lines.push('| # | Description | Qty | Unit Price | Total | Tax |');
        lines.push('|---|-------------|-----|-----------|-------|-----|');
        for (const [i, item] of lineItems.entries()) {
          lines.push(
            `| ${i + 1} | ${String(item['description'] ?? '').substring(0, 40)} | ${item['quantity']} | ${formatCurrency(Number(item['unitPrice']) || 0, currency)} | ${formatCurrency(Number(item['totalPrice']) || 0, currency)} | ${item['taxRateId'] ?? 'no_vat'} |`
          );
        }
        lines.push('');
      }

      lines.push(
        `**Subtotal:** ${formatCurrency(Number(q.subtotal ?? q.totalPrice) || 0, currency)}`,
        `**Tax:** ${formatCurrency(Number(q.tax) || 0, currency)}`,
        `**Total: ${formatCurrency(Number(q.totalPrice) || 0, currency)}**`,
        '',
      );

      const qboLines: string[] = [];
      if (q.qboSalesOrderId) qboLines.push(`Sales Order: ${q.qboSalesOrderDocNumber ?? q.qboSalesOrderId}`);
      if (q.qboInvoiceId) qboLines.push(`Invoice: ${q.qboInvoiceDocNumber ?? q.qboInvoiceId}`);
      if (q.qboSyncStatus) qboLines.push(`Sync: ${q.qboSyncStatus}`);
      if (q.qboSyncError) qboLines.push(`Sync error: ${q.qboSyncError}`);
      if (qboLines.length) {
        lines.push('**QuickBooks:**', ...qboLines);
      }

      return { content: [{ type: 'text' as const, text: truncateIfNeeded(lines.join('\n')) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── zeusos_quote_pipeline_analysis ─────────────────────────────────────────
  server.registerTool('zeusos_quote_pipeline_analysis', {
    title: 'Quote Pipeline Analysis',
    description: `Analyse the quote pipeline: conversion rates by stage, average deal size, total pipeline value, and QuickBooks sync health. Provides a pricing and revenue snapshot.`,
    inputSchema: {
      limit: z.number().int().min(1).max(500).optional()
        .describe('Quotes to analyse (default: 100)'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const { items: quotes } = await queryCollection<ClientQuote>(COLLECTIONS.CLIENT_QUOTES, {
        orderByField: 'createdAt',
        orderByDirection: 'desc',
        limit: params.limit ?? 100,
      });

      if (!quotes.length) {
        return { content: [{ type: 'text' as const, text: 'No quotes to analyse.' }] };
      }

      const currency = quotes[0]?.currency ?? 'UGX';
      const byStatus: Record<string, { count: number; value: number }> = {};
      let totalValue = 0;
      let totalItems = 0;

      for (const q of quotes) {
        const status = q.status ?? 'draft';
        const val = Number(q.totalPrice) || 0;
        const items = Array.isArray(q.lineItems) ? q.lineItems.length : 0;
        if (!byStatus[status]) byStatus[status] = { count: 0, value: 0 };
        byStatus[status].count++;
        byStatus[status].value += val;
        totalValue += val;
        totalItems += items;
      }

      const avgDeal = quotes.length ? totalValue / quotes.length : 0;
      const avgItems = quotes.length ? totalItems / quotes.length : 0;
      const converted = (byStatus['approved']?.count ?? 0) +
        (byStatus['synced']?.count ?? 0) +
        (byStatus['invoiced']?.count ?? 0);
      const convRate = quotes.length ? (converted / quotes.length * 100).toFixed(0) : '0';

      const lines = [
        `**Quote Pipeline Analysis** (${quotes.length} quotes)`,
        '',
        `Total pipeline value: **${formatCurrency(totalValue, currency)}**`,
        `Average deal size: ${formatCurrency(avgDeal, currency)}`,
        `Average line items per quote: ${avgItems.toFixed(1)}`,
        `Conversion rate (approved+): **${convRate}%**`,
        '',
        '**By Status:**',
        '| Status | Count | Value | % Pipeline |',
        '|--------|-------|-------|------------|',
      ];

      for (const status of ['draft', 'approved', 'synced', 'invoiced']) {
        if (byStatus[status]) {
          const pct = totalValue ? (byStatus[status].value / totalValue * 100).toFixed(0) : '0';
          lines.push(`| ${status} | ${byStatus[status].count} | ${formatCurrency(byStatus[status].value, currency)} | ${pct}% |`);
        }
      }
      for (const [status, data] of Object.entries(byStatus)) {
        if (!['draft', 'approved', 'synced', 'invoiced'].includes(status)) {
          const pct = totalValue ? (data.value / totalValue * 100).toFixed(0) : '0';
          lines.push(`| ${status} | ${data.count} | ${formatCurrency(data.value, currency)} | ${pct}% |`);
        }
      }

      const qboSynced = quotes.filter(q => q.qboSalesOrderId || q.qboInvoiceId).length;
      lines.push(
        '',
        `**QBO Sync:** ${qboSynced}/${quotes.length} quotes synced (${(qboSynced / quotes.length * 100).toFixed(0)}%)`,
      );

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });
}
