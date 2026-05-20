/**
 * Cross-Module Intelligence - DawinOS
 * Cloud Function that orchestrates Claude with Tool Use for cross-module data queries.
 * Enables AI to autonomously query design, manufacturing, inventory, CRM, finance,
 * and supplier data to surface insights across module boundaries.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

const { createMessageWithTools } = require('../utils/claudeClient');
const { getMemoryContext } = require('../utils/memoryLoader');
const { allDefinitions, allHandlers } = require('../tools');
const { executeToolCalls, selectRelevantTools } = require('../tools/toolExecutor');

const db = admin.firestore();

// Secrets
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// Collections
const CONVERSATION_COLLECTION = 'ai_conversations';

// ============================================================================
// Rate Limiting (mirrors assistantChat.js pattern)
// ============================================================================

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 8; // Slightly lower than general assistant due to higher cost

async function checkRateLimit(userId) {
  const rateLimitRef = db.collection('rateLimits').doc(`${userId}_crossmodule`);
  const now = Date.now();

  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(rateLimitRef);

    if (doc.exists) {
      const data = doc.data();
      if (now - data.windowStart < RATE_LIMIT_WINDOW_MS) {
        if (data.count >= MAX_REQUESTS_PER_WINDOW) {
          throw new HttpsError(
            'resource-exhausted',
            'Too many requests. Please wait before trying again.'
          );
        }
        transaction.update(rateLimitRef, {
          count: admin.firestore.FieldValue.increment(1),
        });
      } else {
        transaction.set(rateLimitRef, { windowStart: now, count: 1 });
      }
    } else {
      transaction.set(rateLimitRef, { windowStart: now, count: 1 });
    }
  });
}

// ============================================================================
// Input Sanitization
// ============================================================================

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_LENGTH = 20;
const MAX_HISTORY_ENTRY_LENGTH = 3000;

function sanitizeMessage(msg) {
  if (typeof msg !== 'string') return '';
  return msg.slice(0, MAX_MESSAGE_LENGTH).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-MAX_HISTORY_LENGTH)
    .filter(
      (m) =>
        m &&
        typeof m.content === 'string' &&
        ['user', 'assistant'].includes(m.role)
    )
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_HISTORY_ENTRY_LENGTH),
    }));
}

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are DawinOS Intelligence, the cross-module AI analyst for Dawin Group — a custom millwork and furniture manufacturing company based in East Africa.

You have real-time access to query data across all DawinOS modules through tools. Use them proactively to gather data before answering questions. Never guess when you can look up actual data.

## Your Capabilities
- **Design**: Query projects, design items, material palettes, optimization results
- **Manufacturing**: Query manufacturing orders, BOMs, stage status, material consumption
- **Inventory**: Search items, check stock levels, identify shortages
- **CRM**: Look up customers, deals pipeline, sales forecasts
- **Finance**: Financial summaries, project costing, budget analysis
- **Suppliers**: Search suppliers, analyze spend, check PO history
- **Intelligence**: Business events, accumulated organizational memory

## How to Respond
1. When a question involves data, ALWAYS use tools first to get real numbers
2. Identify cross-module connections (e.g., "this MO's material shortage is because PO-2024-015 from SupplierX is delayed")
3. Provide specific numbers, dates, and references — not vague summaries
4. Flag risks and opportunities that span module boundaries
5. If you discover something concerning (overdue MOs, stock shortages, budget overruns), proactively mention it
6. Keep responses professional, concise, and actionable
7. When presenting data from multiple modules, organize it clearly

## Company Context
- Dawin Finishes specializes in custom furniture and millwork manufacturing
- Dawin Advisory provides construction consulting services
- The company operates in East Africa (consider currency, timezone, market context)
- Design items flow: Design → Manufacturing → Inventory → Delivery
- Key currencies: KES (primary), USD (procurement)`;

// ============================================================================
// Conversation Persistence
// ============================================================================

async function persistConversation(conversationId, companyId, userId, userMessage, assistantResponse) {
  try {
    const now = admin.firestore.Timestamp.now();
    const userMsgId = `msg-${Date.now()}-u`;
    const asstMsgId = `msg-${Date.now()}-a`;

    if (conversationId) {
      const convRef = db.collection(CONVERSATION_COLLECTION).doc(conversationId);
      const convDoc = await convRef.get();

      if (convDoc.exists) {
        const batch = db.batch();
        batch.set(convRef.collection('messages').doc(userMsgId), {
          id: userMsgId, role: 'user', content: userMessage, mode: 'cross_module', timestamp: now,
        });
        batch.set(convRef.collection('messages').doc(asstMsgId), {
          id: asstMsgId, role: 'assistant', content: assistantResponse, mode: 'cross_module', timestamp: now,
        });

        const newCount = (convDoc.data().messageCount || 0) + 2;
        batch.update(convRef, {
          messageCount: newCount,
          updatedAt: now,
          lastMessageAt: now,
        });

        await batch.commit();
        return { conversationId, messageCount: newCount };
      }
    }

    // Create new conversation
    const convRef = await db.collection(CONVERSATION_COLLECTION).add({
      userId,
      companyId,
      module: 'cross_module_intelligence',
      mode: 'cross_module',
      title: 'Cross-Module Intelligence',
      memoryExtractionDone: false,
      messageCount: 2,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
    });

    const batch = db.batch();
    batch.set(convRef.collection('messages').doc(userMsgId), {
      id: userMsgId, role: 'user', content: userMessage, mode: 'cross_module', timestamp: now,
    });
    batch.set(convRef.collection('messages').doc(asstMsgId), {
      id: asstMsgId, role: 'assistant', content: assistantResponse, mode: 'cross_module', timestamp: now,
    });
    await batch.commit();

    return { conversationId: convRef.id, messageCount: 2 };
  } catch (err) {
    console.warn('Failed to persist conversation (non-blocking):', err.message);
    return { conversationId: null, messageCount: 0 };
  }
}

// ============================================================================
// Cloud Function
// ============================================================================

const crossModuleIntelligence = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    cors: true,
    maxInstances: 10,
    memory: '2GiB',
    timeoutSeconds: 120,
  },
  async (request) => {
    // Validate authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Rate limiting
    await checkRateLimit(request.auth.uid);

    // Input
    const message = sanitizeMessage(request.data.message);
    const conversationHistory = sanitizeHistory(request.data.conversationHistory);
    const companyId = request.data.companyId || 'default';
    const conversationId = request.data.conversationId || null;
    const currentModule = request.data.currentModule || null;

    if (!message) {
      throw new HttpsError('invalid-argument', 'Message is required');
    }

    // Build system prompt with business memory
    const memCtx = await getMemoryContext(companyId, 'assistant', 12);
    const fullSystemPrompt = SYSTEM_PROMPT + (memCtx.prompt || '');

    // Select relevant tools based on module context
    const tools = selectRelevantTools(currentModule, allDefinitions);

    // Build messages array
    const messages = [
      ...conversationHistory.map(m => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    // Prepare request context for tool execution
    const requestContext = {
      userId: request.auth.uid,
      companyId,
    };

    // Track which tools are being called (for frontend progress display)
    const toolsUsed = [];

    try {
      const result = await createMessageWithTools(
        ANTHROPIC_API_KEY.value(),
        {
          systemPrompt: fullSystemPrompt,
          tools,
          messages,
          preset: 'standard',
          executeToolCalls: (toolUseBlocks) => {
            // Track tool names for response metadata
            for (const block of toolUseBlocks) {
              toolsUsed.push(block.name);
            }
            return executeToolCalls(toolUseBlocks, allHandlers, requestContext);
          },
          onToolUse: (round, toolNames) => {
            console.log(`Tool use round ${round}: ${toolNames.join(', ')}`);
          },
        }
      );

      // Persist conversation (non-blocking)
      const persistResult = persistConversation(
        conversationId,
        companyId,
        request.auth.uid,
        message,
        result.text
      );

      const { conversationId: savedConvId } = await Promise.race([
        persistResult,
        new Promise((resolve) => setTimeout(() => resolve({ conversationId: null, messageCount: 0 }), 3000)),
      ]);

      return {
        response: result.text,
        mode: 'cross_module',
        conversationId: savedConvId || conversationId,
        hasMemoryContext: memCtx.count > 0,
        memoryCount: memCtx.count,
        toolsUsed,
        toolCallCount: result.toolCallCount,
        usage: result.usage,
      };
    } catch (error) {
      console.error('Cross-module intelligence error:', error);
      throw new HttpsError(
        'internal',
        'Failed to generate AI response. Please try again.'
      );
    }
  }
);

module.exports = { crossModuleIntelligence };
