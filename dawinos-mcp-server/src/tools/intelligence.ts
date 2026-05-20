import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { callCloudFunction } from '../services/callFunction.js';
import { getRequiredCompanyId } from '../constants.js';
import { redactMessageArray, redactSensitiveText } from '../services/redaction.js';

export function registerIntelligenceTools(server: McpServer): void {
  const companyId = getRequiredCompanyId();

  // ─── dawinos_cross_module_query ───────────────────────────────────────────────
  server.registerTool('dawinos_cross_module_query', {
    title: 'Cross-Module Intelligence Query',
    description: `Ask a natural language question that spans multiple DawinOS modules (purchasing, manufacturing, inventory, finance, projects). The AI agent interprets your question, runs the appropriate Firestore queries, and synthesises a response with context from memory.

Use for questions like:
- "What manufacturing orders are overdue?"
- "Which suppliers have the most outstanding POs?"
- "What materials do we need to reorder?"
- "Show me the status of all active projects"`,
    inputSchema: {
      message: z.string().describe('The question or request in natural language'),
      conversation_history: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })).optional().describe('Prior conversation turns for context'),
      current_module: z.string().optional().describe('Current module context hint (e.g. "purchasing", "manufacturing")'),
      conversation_id: z.string().optional().describe('Conversation ID to continue a prior session'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const result = await callCloudFunction<unknown, {
        response: string;
        toolsUsed: string[];
        memoryCount: number;
        conversationId: string;
      }>('crossModuleIntelligence', {
        message: redactSensitiveText(params.message),
        conversationHistory: redactMessageArray(params.conversation_history ?? []),
        currentModule: params.current_module,
        conversationId: params.conversation_id,
        companyId,
      });
      const toolsNote = result.toolsUsed?.length
        ? `\n\n_Tools used: ${result.toolsUsed.join(', ')}_`
        : '';
      const memNote = result.memoryCount ? ` | ${result.memoryCount} memories loaded` : '';
      return {
        content: [{
          type: 'text' as const,
          text: `${result.response}${toolsNote}${memNote}\n\n_Conversation ID: ${result.conversationId}_`,
        }],
      };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── dawinos_strategy_research ───────────────────────────────────────────────
  server.registerTool('dawinos_strategy_research', {
    title: 'Strategy Research',
    description: `Conduct AI-powered strategy research on construction and manufacturing topics. Performs web searches and analysis to surface trends, capacity requirements, budget benchmarks, and competitor information relevant to DawinOS projects.

Research types:
- trends: Market and industry trends for a project type/location
- capacity: Capacity planning and resource requirements
- budget: Budget benchmarks and cost estimates
- competitors: Competitor landscape analysis`,
    inputSchema: {
      query: z.string().describe('Research question or topic'),
      research_type: z.enum(['trends', 'capacity', 'budget', 'competitors'])
        .optional()
        .describe('Focus area for the research'),
      project_type: z.string().optional().describe('Type of project (e.g. "hospital ward", "office block")'),
      location: z.string().optional().describe('Geographic location for localised research'),
      budget: z.number().optional().describe('Budget figure for context (UGX)'),
      project_id: z.string().optional().describe('Link findings to a specific project ID'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const result = await callCloudFunction<unknown, {
        findings: string;
        sources: string[];
        insights: string[];
        tokensUsed?: number;
        searchQueries?: string[];
      }>('strategyResearch', {
        query: params.query,
        researchType: params.research_type,
        projectType: params.project_type,
        location: params.location,
        budget: params.budget,
        projectId: params.project_id,
        companyId,
      });

      const sections: string[] = [result.findings];

      if (result.insights?.length) {
        sections.push('\n**Key Insights:**\n' + result.insights.map(i => `- ${i}`).join('\n'));
      }
      if (result.sources?.length) {
        sections.push('\n**Sources:**\n' + result.sources.map(s => `- ${s}`).join('\n'));
      }
      if (result.searchQueries?.length) {
        sections.push(`\n_Searched: ${result.searchQueries.join(' | ')}_`);
      }

      return { content: [{ type: 'text' as const, text: sections.join('\n') }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── dawinos_material_demand_forecast ────────────────────────────────────────
  server.registerTool('dawinos_material_demand_forecast', {
    title: 'Material Demand Forecast',
    description: `Forecast material demand based on active manufacturing orders and compare against current stock levels. Identifies shortages and surplus for procurement planning.`,
    inputSchema: {
      days_ahead: z.number().int().min(1).max(365).optional()
        .describe('Forecast horizon in days (default: 30)'),
      project_id: z.string().optional()
        .describe('Limit forecast to manufacturing orders for a specific project'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const result = await callCloudFunction<unknown, {
        forecast: Array<{
          materialId: string;
          materialName: string;
          required: number;
          unit: string;
          currentStock: number;
          shortage: number;
          surplus: number;
          status: 'shortage' | 'ok' | 'surplus';
        }>;
        summary: string;
        periodDays: number;
      }>('materialDemandForecast', {
        daysAhead: params.days_ahead ?? 30,
        projectId: params.project_id,
        companyId,
      });

      const lines: string[] = [
        `**Material Demand Forecast — Next ${result.periodDays ?? params.days_ahead ?? 30} days**`,
        '',
        result.summary ?? '',
        '',
        '| Material | Required | In Stock | Status |',
        '|----------|----------|----------|--------|',
      ];

      for (const item of result.forecast ?? []) {
        const status = item.status === 'shortage'
          ? `⚠ SHORT by ${item.shortage} ${item.unit}`
          : item.status === 'surplus'
            ? `✓ Surplus ${item.surplus} ${item.unit}`
            : '✓ OK';
        lines.push(`| ${item.materialName} | ${item.required} ${item.unit} | ${item.currentStock} ${item.unit} | ${status} |`);
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── dawinos_assess_strategy_section ─────────────────────────────────────────
  server.registerTool('dawinos_assess_strategy_section', {
    title: 'Assess Strategy Section',
    description: `Assess the alignment of a specific strategy document section against current business data. Returns an alignment score (1-5), identified gaps, outdated claims, and a recommendation (rewrite/minor_update/no_action/flag_for_ceo).`,
    inputSchema: {
      company_id: z.string().describe('Company ID'),
      review_id: z.string().describe('Strategy review ID'),
      section_id: z.string().describe('Document section ID to assess'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const result = await callCloudFunction<unknown, {
        score: number;
        gaps: string[];
        outdatedClaims: string[];
        recommendation: string;
        sectionHeading: string;
      }>('assessStrategySection', {
        companyId: params.company_id,
        reviewId: params.review_id,
        sectionId: params.section_id,
      });

      const lines = [
        `## Section Assessment: ${result.sectionHeading}`,
        `**Alignment Score:** ${result.score}/5`,
        `**Recommendation:** ${result.recommendation}`,
      ];

      if (result.gaps?.length) {
        lines.push('\n**Gaps:**');
        result.gaps.forEach(g => lines.push(`- ${g}`));
      }
      if (result.outdatedClaims?.length) {
        lines.push('\n**Outdated Claims:**');
        result.outdatedClaims.forEach(c => lines.push(`- ${c}`));
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── dawinos_rewrite_strategy_section ────────────────────────────────────────
  server.registerTool('dawinos_rewrite_strategy_section', {
    title: 'Rewrite Strategy Section',
    description: `Generate an AI rewrite of a strategy document section based on its assessment results and current business data. The rewrite is stored as pending approval unless auto_approve is true.`,
    inputSchema: {
      company_id: z.string().describe('Company ID'),
      review_id: z.string().describe('Strategy review ID'),
      section_id: z.string().describe('Document section ID to rewrite'),
      auto_approve: z.boolean().optional().describe('If true, apply the rewrite immediately without manual approval'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const result = await callCloudFunction<unknown, {
        sectionHeading: string;
        rewritePreview: string;
        status: string;
      }>('rewriteStrategySection', {
        companyId: params.company_id,
        reviewId: params.review_id,
        sectionId: params.section_id,
        autoApprove: params.auto_approve ?? false,
      });

      const status = result.status === 'applied'
        ? 'Rewrite applied immediately'
        : 'Rewrite stored as pending approval';

      return {
        content: [{
          type: 'text' as const,
          text: `## Section Rewrite: ${result.sectionHeading}\n**Status:** ${status}\n\n**Preview:**\n${result.rewritePreview?.substring(0, 500)}${(result.rewritePreview?.length ?? 0) > 500 ? '...' : ''}`,
        }],
      };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });
}
