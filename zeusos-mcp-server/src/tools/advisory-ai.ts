import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { callCloudFunction } from '../services/callFunction.js';
import { getRequiredCompanyId } from '../constants.js';
import { redactMessageArray, redactSensitiveText } from '../services/redaction.js';

export function registerAdvisoryAiTools(server: McpServer): void {
  const companyId = getRequiredCompanyId();

  // ─── zeusos_procurement_advisor ─────────────────────────────────────────────
  server.registerTool('zeusos_procurement_advisor', {
    title: 'Procurement Advisor',
    description: `AI-powered supplier intelligence and procurement analysis. Enriches supplier profiles from web sources, analyses performance against historical POs, and provides risk alerts and recommendations.

Actions:
- enrich: Research a supplier online and populate their profile with contact details, capabilities, and market position
- analyze: Analyse purchase history for a supplier and highlight trends, risks, and opportunities
- full-analysis: Run both enrichment and analysis in a single call`,
    inputSchema: {
      action: z.enum(['enrich', 'analyze', 'full-analysis'])
        .describe('What to do with the supplier'),
      supplier_name: z.string().describe('Supplier name (required)'),
      supplier_id: z.string().optional().describe('Supplier/contact document ID if known'),
      categories: z.array(z.string()).optional()
        .describe('Material categories the supplier provides (e.g. ["timber", "hardware"])'),
      materials: z.array(z.string()).optional()
        .describe('Specific materials supplied'),
      website: z.string().optional().describe('Supplier website URL'),
      country: z.string().optional().describe('Supplier country (default: Uganda)'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const result = await callCloudFunction<unknown, {
        enrichment?: {
          description?: string;
          contactEmail?: string;
          contactPhone?: string;
          address?: string;
          capabilities?: string[];
          certifications?: string[];
          leadTimeDays?: number;
          paymentTerms?: string;
        };
        analysis?: {
          totalSpend?: number;
          currency?: string;
          orderCount?: number;
          avgOrderValue?: number;
          onTimeDeliveryRate?: number;
          trends?: string[];
        };
        recommendations?: string[];
        riskAlerts?: string[];
        marketInsights?: string[];
      }>('procurementAdvisor', {
        action: params.action,
        supplierName: params.supplier_name,
        supplierId: params.supplier_id,
        categories: params.categories ?? [],
        materials: params.materials ?? [],
        website: params.website,
        country: params.country ?? 'Uganda',
        companyId,
      });

      const lines = [`**Procurement Advisor — ${params.supplier_name}** (${params.action})`, ''];

      if (result.enrichment) {
        const e = result.enrichment;
        lines.push('**Supplier Profile:**');
        if (e.description) lines.push(e.description);
        if (e.contactEmail) lines.push(`Email: ${e.contactEmail}`);
        if (e.contactPhone) lines.push(`Phone: ${e.contactPhone}`);
        if (e.address) lines.push(`Address: ${e.address}`);
        if (e.capabilities?.length) lines.push(`Capabilities: ${e.capabilities.join(', ')}`);
        if (e.leadTimeDays) lines.push(`Lead time: ${e.leadTimeDays} days`);
        if (e.paymentTerms) lines.push(`Payment terms: ${e.paymentTerms}`);
        lines.push('');
      }

      if (result.analysis) {
        const a = result.analysis;
        lines.push('**Purchase History Analysis:**');
        if (a.totalSpend != null) lines.push(`Total spend: ${a.currency ?? 'UGX'} ${a.totalSpend?.toLocaleString()}`);
        if (a.orderCount != null) lines.push(`Orders: ${a.orderCount}`);
        if (a.avgOrderValue != null) lines.push(`Avg order: ${a.currency ?? 'UGX'} ${a.avgOrderValue?.toLocaleString()}`);
        if (a.onTimeDeliveryRate != null) lines.push(`On-time delivery: ${(a.onTimeDeliveryRate * 100).toFixed(0)}%`);
        if (a.trends?.length) lines.push('Trends:\n' + a.trends.map(t => `  - ${t}`).join('\n'));
        lines.push('');
      }

      if (result.riskAlerts?.length) {
        lines.push('**Risk Alerts:**');
        lines.push(...result.riskAlerts.map(r => `⚠ ${r}`));
        lines.push('');
      }

      if (result.recommendations?.length) {
        lines.push('**Recommendations:**');
        lines.push(...result.recommendations.map(r => `• ${r}`));
        lines.push('');
      }

      if (result.marketInsights?.length) {
        lines.push('**Market Insights:**');
        lines.push(...result.marketInsights.map(i => `• ${i}`));
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── zeusos_cfo_briefing ─────────────────────────────────────────────────────
  server.registerTool('zeusos_cfo_briefing', {
    title: 'CFO Briefing',
    description: `Generate a comprehensive CFO-level financial briefing for ZeusOS. Analyses cash position, committed expenditure, revenue pipeline, risk exposure, and provides strategic recommendations.

Returns: executive summary, key decisions needed, risk alerts, actionable recommendations, and a cash outlook narrative.`,
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false },
  }, async (_params) => {
    try {
      const result = await callCloudFunction<unknown, {
        executiveSummary: string;
        keyDecisions: string[];
        riskAlerts: string[];
        recommendations: string[];
        cashOutlookNarrative: string;
        contextSnapshot?: {
          activePOs?: number;
          activeMOs?: number;
          pendingApprovals?: number;
          totalCommitted?: number;
          currency?: string;
        };
      }>('generateCFOBriefing', { companyId });

      const lines = ['# CFO Briefing', ''];

      if (result.executiveSummary) {
        lines.push('## Executive Summary', result.executiveSummary, '');
      }

      if (result.cashOutlookNarrative) {
        lines.push('## Cash Outlook', result.cashOutlookNarrative, '');
      }

      const ctx = result.contextSnapshot;
      if (ctx) {
        lines.push('## Snapshot');
        if (ctx.activePOs != null) lines.push(`- Active POs: ${ctx.activePOs}`);
        if (ctx.activeMOs != null) lines.push(`- Active Manufacturing Orders: ${ctx.activeMOs}`);
        if (ctx.pendingApprovals != null) lines.push(`- Pending Approvals: ${ctx.pendingApprovals}`);
        if (ctx.totalCommitted != null) {
          lines.push(`- Total Committed: ${ctx.currency ?? 'UGX'} ${ctx.totalCommitted.toLocaleString()}`);
        }
        lines.push('');
      }

      if (result.keyDecisions?.length) {
        lines.push('## Key Decisions Required');
        lines.push(...result.keyDecisions.map(d => `- ${d}`));
        lines.push('');
      }

      if (result.riskAlerts?.length) {
        lines.push('## Risk Alerts');
        lines.push(...result.riskAlerts.map(r => `⚠ ${r}`));
        lines.push('');
      }

      if (result.recommendations?.length) {
        lines.push('## Recommendations');
        lines.push(...result.recommendations.map(r => `• ${r}`));
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── zeusos_process_receipt ──────────────────────────────────────────────────
  server.registerTool('zeusos_process_receipt', {
    title: 'Process Receipt / Document OCR',
    description: `Extract structured data from a receipt, mobile money confirmation, or EFRIS invoice image using AI OCR.

Modes:
- receipt: General purchase receipt — extracts vendor, items, amounts, date
- mobileMoney: MTN/Airtel mobile money confirmation — extracts sender, amount, reference, balance
- efris: Uganda Revenue Authority EFRIS invoice — extracts tax fields, TIN, invoice number`,
    inputSchema: {
      image_url: z.string().describe('URL of the image to process (GCS gs:// or HTTPS)'),
      mode: z.enum(['receipt', 'mobileMoney', 'efris']).describe('Document type to extract'),
      include_raw_text: z.boolean().optional().default(false)
        .describe('If true, include OCR raw text with sensitive patterns redacted'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const result = await callCloudFunction<unknown, {
        vendor?: string;
        amount?: number;
        currency?: string;
        date?: string;
        items?: Array<{ description: string; quantity?: number; unitPrice?: number; total?: number }>;
        referenceNumber?: string;
        tin?: string;
        invoiceNumber?: string;
        confidence: number;
        rawText?: string;
        extractedFields: Record<string, unknown>;
      }>('processReceiptOCR', {
        imageUrl: params.image_url,
        mode: params.mode,
        companyId,
      });

      const lines = [`**Receipt OCR — ${params.mode}**`, ''];
      lines.push(`Confidence: ${(result.confidence * 100).toFixed(0)}%`, '');

      if (result.vendor) lines.push(`Vendor: ${result.vendor}`);
      if (result.amount != null) lines.push(`Amount: ${result.currency ?? 'UGX'} ${result.amount.toLocaleString()}`);
      if (result.date) lines.push(`Date: ${result.date}`);
      if (result.referenceNumber) lines.push(`Reference: ${result.referenceNumber}`);
      if (result.invoiceNumber) lines.push(`Invoice #: ${result.invoiceNumber}`);
      if (result.tin) lines.push(`TIN: ${result.tin}`);

      if (result.items?.length) {
        lines.push('', '**Line Items:**');
        for (const item of result.items) {
          const price = item.total != null ? ` — ${result.currency ?? 'UGX'} ${item.total.toLocaleString()}` : '';
          lines.push(`- ${item.description}${price}`);
        }
      }

      if (result.rawText && params.include_raw_text) {
        const redacted = redactSensitiveText(result.rawText).slice(0, 3000);
        lines.push('', '**Raw Text (redacted):**', '```', redacted, '```');
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── zeusos_assistant_chat ───────────────────────────────────────────────────
  server.registerTool('zeusos_assistant_chat', {
    title: 'ZeusOS Assistant Chat',
    description: `Chat with the ZeusOS AI assistant. The assistant has access to business memory and can answer questions in different expert modes.

Modes:
- general: General business assistant with memory context
- data_analyst: Deep data analysis and reporting on Firestore collections
- strategic_advisor: Strategy, planning, and executive decision support
- document_expert: Document analysis, drafting, and review`,
    inputSchema: {
      message: z.string().describe('Your message to the assistant'),
      mode: z.enum(['general', 'data_analyst', 'strategic_advisor', 'document_expert'])
        .optional()
        .describe('Assistant persona/expertise mode (default: general)'),
      conversation_history: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })).optional().describe('Prior turns for context'),
      conversation_id: z.string().optional().describe('Continue an existing conversation'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const result = await callCloudFunction<unknown, {
        response: string;
        conversationId: string;
        memoryCount?: number;
        mode?: string;
      }>('assistantChat', {
        message: redactSensitiveText(params.message),
        mode: params.mode ?? 'general',
        conversationHistory: redactMessageArray(params.conversation_history ?? []),
        conversationId: params.conversation_id,
        companyId,
      });

      const meta: string[] = [];
      if (result.memoryCount) meta.push(`${result.memoryCount} memories loaded`);
      if (result.mode) meta.push(`mode: ${result.mode}`);
      if (result.conversationId) meta.push(`conv: ${result.conversationId}`);

      const footer = meta.length ? `\n\n_${meta.join(' | ')}_` : '';

      return {
        content: [{ type: 'text' as const, text: `${result.response}${footer}` }],
      };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });
}
