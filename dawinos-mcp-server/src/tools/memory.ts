import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { callCloudFunction } from '../services/callFunction.js';
import { getRequiredCompanyId } from '../constants.js';
import { redactMessageArray, redactSensitiveText } from '../services/redaction.js';

const MEMORY_CATEGORIES = [
  'business_fact',
  'user_preference',
  'project_insight',
  'customer_intel',
  'process_knowledge',
  'decision_record',
  'market_intel',
  'financial_insight',
] as const;

export function registerMemoryTools(server: McpServer): void {
  const companyId = getRequiredCompanyId();

  // ─── dawinos_get_memory_context ───────────────────────────────────────────────
  server.registerTool('dawinos_get_memory_context', {
    title: 'Get Memory Context',
    description: `Retrieve relevant memories from DawinOS's business memory store. Returns formatted context that can be injected into AI prompts. Useful for understanding historical decisions, customer preferences, and accumulated business knowledge.`,
    inputSchema: {
      categories: z.array(z.enum(MEMORY_CATEGORIES)).optional()
        .describe('Filter to specific memory categories (default: all)'),
      project_id: z.string().optional().describe('Include memories related to a specific project'),
      customer_id: z.string().optional().describe('Include memories related to a specific customer/contact'),
      max_memories: z.number().int().min(1).max(50).optional()
        .describe('Maximum memories to return (default: 15)'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const result = await callCloudFunction<unknown, {
        memories: Array<{
          id: string;
          category: string;
          content: string;
          summary: string;
          importance: number;
          tags: string[];
          createdAt: string;
        }>;
        promptText: string;
        totalMemories: number;
      }>('getMemoryContext', {
        categories: params.categories,
        projectId: params.project_id,
        customerId: params.customer_id,
        maxMemories: params.max_memories ?? 15,
        companyId,
      });

      const lines = [
        `**Business Memory Context** (${result.memories?.length ?? 0} of ${result.totalMemories ?? 0} total memories)`,
        '',
      ];

      if (result.memories?.length) {
        for (const mem of result.memories) {
          lines.push(`**[${mem.category}]** ${mem.summary ?? mem.content}`);
          if (mem.tags?.length) lines.push(`  _Tags: ${mem.tags.join(', ')}_`);
        }
      } else {
        lines.push('No memories found for the given filters.');
      }

      if (result.promptText) {
        lines.push('', '---', '_Formatted prompt text available for injection._');
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── dawinos_save_memory ──────────────────────────────────────────────────────
  server.registerTool('dawinos_save_memory', {
    title: 'Save Business Memory',
    description: `Save a piece of business knowledge to DawinOS's memory store. Use this to capture decisions, insights, customer preferences, market intelligence, or any fact that should inform future AI responses.`,
    inputSchema: {
      category: z.enum(MEMORY_CATEGORIES).describe('Memory category'),
      content: z.string().describe('Full content of the memory'),
      summary: z.string().optional().describe('Short summary (1-2 sentences) for quick retrieval'),
      tags: z.array(z.string()).optional().describe('Searchable tags'),
      importance: z.number().min(0).max(1).optional()
        .describe('Importance score 0-1 (default: 0.5)'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    try {
      const result = await callCloudFunction<unknown, {
        memoryId: string;
        success: boolean;
      }>('saveManualMemory', {
        category: params.category,
        content: redactSensitiveText(params.content),
        summary: params.summary ? redactSensitiveText(params.summary) : undefined,
        tags: params.tags ?? [],
        importance: params.importance ?? 0.5,
        companyId,
      });

      return {
        content: [{
          type: 'text' as const,
          text: result.success
            ? `Memory saved successfully. ID: ${result.memoryId}`
            : 'Memory save returned without error but success flag was false.',
        }],
      };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── dawinos_search_memory ────────────────────────────────────────────────────
  server.registerTool('dawinos_search_memory', {
    title: 'Semantic Memory Search',
    description: `Search the DawinOS business memory store using semantic similarity. Returns memories most relevant to the query, ranked by similarity score.`,
    inputSchema: {
      query: z.string().describe('Natural language search query'),
      top_k: z.number().int().min(1).max(50).optional()
        .describe('Number of results to return (default: 10)'),
      min_similarity: z.number().min(0).max(1).optional()
        .describe('Minimum similarity threshold 0-1 (default: 0.45)'),
      categories: z.array(z.enum(MEMORY_CATEGORIES)).optional()
        .describe('Filter to specific categories'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const result = await callCloudFunction<unknown, {
        results: Array<{
          id: string;
          category: string;
          content: string;
          summary: string;
          similarity: number;
          tags: string[];
        }>;
      }>('semanticMemorySearch', {
        query: params.query,
        topK: params.top_k ?? 10,
        minSimilarity: params.min_similarity ?? 0.45,
        categories: params.categories,
        companyId,
      });

      if (!result.results?.length) {
        return { content: [{ type: 'text' as const, text: 'No memories found matching the query.' }] };
      }

      const lines = [`**Memory Search Results** for: "${params.query}"`, ''];
      for (const r of result.results) {
        lines.push(`**${(r.similarity * 100).toFixed(0)}% match** [${r.category}]`);
        lines.push(r.summary ?? r.content);
        if (r.tags?.length) lines.push(`_Tags: ${r.tags.join(', ')}_`);
        lines.push('');
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── dawinos_extract_memories ─────────────────────────────────────────────────
  server.registerTool('dawinos_extract_memories', {
    title: 'Extract Memories from Conversation',
    description: `Analyse a conversation and automatically extract business memories worth saving. The AI identifies facts, decisions, preferences, and insights that should be retained for future reference.`,
    inputSchema: {
      messages: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })).min(1).describe('Conversation messages to analyse'),
      conversation_id: z.string().optional().describe('ID of the source conversation'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const result = await callCloudFunction<unknown, {
        memories: Array<{
          category: string;
          content: string;
          summary: string;
        }>;
        memoryIds: string[];
        conversationSummary: string;
      }>('extractMemories', {
        messages: redactMessageArray(params.messages),
        conversationId: params.conversation_id,
        companyId,
      });

      const lines = [
        `**Extracted ${result.memories?.length ?? 0} memories** from conversation`,
        '',
      ];

      if (result.conversationSummary) {
        lines.push(`**Summary:** ${result.conversationSummary}`, '');
      }

      for (let i = 0; i < (result.memories?.length ?? 0); i++) {
        const m = result.memories[i];
        lines.push(`${i + 1}. **[${m.category}]** ${m.summary ?? m.content}`);
        if (result.memoryIds?.[i]) lines.push(`   _ID: ${result.memoryIds[i]}_`);
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });
}
