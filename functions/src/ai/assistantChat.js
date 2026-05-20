/**
 * AI Assistant Chat - DawinOS v2.0
 * Cloud Function to power the Intelligence Layer AI assistant
 * Uses Gemini 1.5 Flash for conversational AI responses
 * 
 * Enhanced with:
 * - Server-side conversation persistence (ai_conversations collection)
 * - Business memory injection from ai_memory collection
 * - Auto memory extraction after conversation milestones
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const admin = require('firebase-admin');
const { getMemoryContext } = require('../utils/memoryLoader');

const db = admin.firestore();

// Secrets
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// Collections
const MEMORY_COLLECTION = 'ai_memory';
const CONVERSATION_COLLECTION = 'ai_conversations';

// Memory extraction triggers after this many messages (user+assistant pairs)
const MEMORY_EXTRACTION_THRESHOLD = 6;

// ============================================
// Input Sanitization & Rate Limiting
// ============================================

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_LENGTH = 20;
const MAX_HISTORY_ENTRY_LENGTH = 3000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

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

async function checkRateLimit(userId) {
  const rateLimitRef = db.collection('rateLimits').doc(userId);
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

// ============================================
// System Prompts by Mode
// ============================================

const SYSTEM_PROMPTS = {
  general: `You are DawinOS Assistant, an AI helper for Dawin Group — a custom millwork and furniture manufacturing company in East Africa.
You help employees navigate the DawinOS platform, answer questions about workflows, and provide general business guidance.
Keep responses concise, professional, and actionable. If you don't know something specific about the company's data, say so honestly.
Focus on being helpful with: task management, design workflow questions, project status, and general business operations.`,

  data_analyst: `You are DawinOS Data Analyst, specialized in analyzing business metrics for Dawin Group.
You help interpret data trends, identify patterns, and provide data-driven recommendations.
When analyzing, consider: production efficiency, project timelines, resource utilization, financial metrics, and quality indicators.
Present insights clearly with specific numbers when possible. Suggest actionable next steps based on the data.`,

  strategic_advisor: `You are DawinOS Strategic Advisor for Dawin Group, a custom millwork and furniture manufacturing company in East Africa.
You provide strategic guidance on: market positioning, operational efficiency, growth opportunities, competitive analysis, and long-term planning.
Consider the East African market context, manufacturing industry trends, and the company's focus on custom millwork.
Give balanced perspectives with clear pros and cons for any strategic recommendation.`,

  document_expert: `You are DawinOS Document Expert, specialized in document review and creation for Dawin Group.
You help with: design documentation, technical specifications, project proposals, reports, and process documentation.
Focus on clarity, completeness, and adherence to industry standards for furniture manufacturing.
Provide specific suggestions for improvement and flag any missing critical information.`,
};

// ============================================
// Mode-to-module mapping for shared memory loader
// ============================================

const MODE_TO_MODULE = {
  general: 'assistant',
  data_analyst: 'assistant',
  strategic_advisor: 'strategy_review',
  document_expert: 'assistant',
};

// ============================================
// Conversation Persistence Helpers
// ============================================

async function persistConversation(conversationId, companyId, userId, mode, userMessage, assistantResponse) {
  try {
    const now = admin.firestore.Timestamp.now();
    const userMsgId = `msg-${Date.now()}-u`;
    const asstMsgId = `msg-${Date.now()}-a`;

    let convId = conversationId;
    let newCount = 0;

    if (convId) {
      // Update existing conversation
      const convRef = db.collection(CONVERSATION_COLLECTION).doc(convId);
      const convDoc = await convRef.get();

      if (convDoc.exists) {
        const batch = db.batch();

        // Write messages to subcollection
        batch.set(convRef.collection('messages').doc(userMsgId), {
          id: userMsgId, role: 'user', content: userMessage, mode, timestamp: now,
        });
        batch.set(convRef.collection('messages').doc(asstMsgId), {
          id: asstMsgId, role: 'assistant', content: assistantResponse, mode, timestamp: now,
        });

        newCount = (convDoc.data().messageCount || 0) + 2;
        batch.update(convRef, {
          messageCount: newCount,
          updatedAt: now,
          lastMessageAt: now,
        });

        await batch.commit();
        return { conversationId: convId, messageCount: newCount };
      }
    }

    // Create new conversation
    const convRef = await db.collection(CONVERSATION_COLLECTION).add({
      userId,
      companyId,
      module: 'assistant',
      mode,
      title: `AI Assistant - ${mode}`,
      memoryExtractionDone: false,
      messageCount: 2,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
    });

    // Write messages to subcollection
    const batch = db.batch();
    batch.set(convRef.collection('messages').doc(userMsgId), {
      id: userMsgId, role: 'user', content: userMessage, mode, timestamp: now,
    });
    batch.set(convRef.collection('messages').doc(asstMsgId), {
      id: asstMsgId, role: 'assistant', content: assistantResponse, mode, timestamp: now,
    });
    await batch.commit();

    return { conversationId: convRef.id, messageCount: 2 };
  } catch (err) {
    console.warn('Failed to persist conversation (non-blocking):', err.message);
    return { conversationId: null, messageCount: 0 };
  }
}

// ============================================
// Memory Extraction Trigger
// ============================================

const EXTRACTION_SYSTEM_PROMPT = `You are a business knowledge extraction system for Dawin Group, a custom millwork and furniture manufacturing company in East Africa.

Analyze the conversation and extract persistent business knowledge that would be valuable to remember for future interactions.

Extract ONLY facts, decisions, preferences, and insights — NOT opinions or casual remarks.

For each extracted memory, provide:
- category: One of: business_fact, user_preference, project_insight, customer_intel, process_knowledge, decision_record, market_intel, financial_insight
- content: The specific knowledge to remember (1-3 sentences)
- summary: A one-line summary (max 100 chars)
- tags: 2-5 relevant tags
- importance: critical, high, medium, or low

Do NOT extract: greetings, questions without answers, vague statements, or info only relevant to the current conversation.

Respond with JSON: { "memories": [...], "conversationSummary": "...", "keyTopics": [...] }
If nothing to extract: { "memories": [], "conversationSummary": "...", "keyTopics": [] }`;

/**
 * Normalized token-overlap similarity (0-1).
 * Compares two strings by splitting into lowercase word tokens.
 */
function textSimilarity(a, b) {
  if (!a || !b) return 0;
  const tokenize = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const tokensA = tokenize(a);
  const tokensB = new Set(tokenize(b));
  if (tokensA.length === 0 || tokensB.size === 0) return 0;
  const overlap = tokensA.filter(t => tokensB.has(t)).length;
  return overlap / Math.max(tokensA.length, tokensB.size);
}

const DEDUP_SIMILARITY_THRESHOLD = 0.75;

async function triggerMemoryExtraction(conversationId, companyId, userId, messages) {
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    });

    const conversationText = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const result = await model.generateContent([
      { text: EXTRACTION_SYSTEM_PROMPT },
      { text: `Analyze this conversation and extract business knowledge:\n\n${conversationText}` },
    ]);

    const responseText = result.response.text();
    let extracted;
    try {
      extracted = JSON.parse(responseText);
    } catch {
      console.warn('Memory extraction: failed to parse JSON response');
      return;
    }

    if (!extracted.memories || extracted.memories.length === 0) {
      await db.collection(CONVERSATION_COLLECTION).doc(conversationId).update({
        memoryExtractionDone: true,
        updatedAt: admin.firestore.Timestamp.now(),
      });
      return;
    }

    // Deduplication: load existing memories and skip near-duplicates
    let existingTexts = [];
    try {
      const existingSnap = await db.collection(MEMORY_COLLECTION)
        .where('companyId', '==', companyId)
        .where('isArchived', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      existingTexts = existingSnap.docs.map(d => (d.data().summary || d.data().content || ''));
    } catch (err) {
      console.warn('Dedup: failed to load existing memories, proceeding without dedup:', err.message);
    }

    const uniqueMemories = extracted.memories.filter(candidate => {
      const candidateText = candidate.summary || candidate.content || '';
      for (const existing of existingTexts) {
        if (textSimilarity(candidateText, existing) >= DEDUP_SIMILARITY_THRESHOLD) {
          console.log(`Dedup: skipping duplicate memory: "${candidateText.substring(0, 60)}..."`);
          return false;
        }
      }
      return true;
    });

    // Generate embeddings for unique memories (best-effort)
    let embeddingMap = {};
    try {
      const embModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
      const embResults = await Promise.all(
        uniqueMemories.map(async (m, i) => {
          const text = `${m.summary || ''} ${m.content}`.trim();
          const res = await embModel.embedContent(text);
          return { idx: i, embedding: res.embedding.values };
        })
      );
      for (const r of embResults) {
        embeddingMap[r.idx] = r.embedding;
      }
    } catch (embErr) {
      console.warn('Embedding generation failed (non-blocking):', embErr.message);
    }

    // Store unique extracted memories
    const batch = db.batch();
    const now = admin.firestore.Timestamp.now();
    const TTL_DAYS_MAP = { low: 90, medium: 180, high: 365 };

    for (let i = 0; i < uniqueMemories.length; i++) {
      const memory = uniqueMemories[i];
      const imp = memory.importance || 'medium';
      const ttlDays = TTL_DAYS_MAP[imp];
      const expiresAt = ttlDays
        ? admin.firestore.Timestamp.fromDate(new Date(now.toDate().getTime() + ttlDays * 86400000))
        : null; // critical = no expiry

      const memRef = db.collection(MEMORY_COLLECTION).doc();
      batch.set(memRef, {
        category: memory.category,
        content: memory.content,
        summary: memory.summary || memory.content.substring(0, 100),
        tags: memory.tags || [],
        importance: imp,
        source: {
          type: 'ai_extracted',
          refId: conversationId,
          module: 'assistant_chat',
          extractedFrom: `Conversation with ${messages.length} messages`,
        },
        companyId,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        accessCount: 0,
        lastAccessedAt: now,
        isArchived: false,
        relatedEntityIds: [],
        ...(expiresAt && { expiresAt }),
        ...(embeddingMap[i] && { embedding: embeddingMap[i] }),
      });
    }

    // Mark conversation as extracted
    batch.update(db.collection(CONVERSATION_COLLECTION).doc(conversationId), {
      memoryExtractionDone: true,
      updatedAt: now,
    });

    await batch.commit();
    const skipped = extracted.memories.length - uniqueMemories.length;
    console.log(`Memory extraction: saved ${uniqueMemories.length} memories, skipped ${skipped} duplicates from conversation ${conversationId}`);
  } catch (err) {
    console.warn('Memory extraction failed (non-blocking):', err.message);
  }
}

// ============================================
// Cloud Function
// ============================================

const assistantChat = onCall(
  {
    secrets: [GEMINI_API_KEY],
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 45,
  },
  async (request) => {
    // Validate authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Rate limiting
    await checkRateLimit(request.auth.uid);

    // Input sanitization
    const VALID_MODES = Object.keys(SYSTEM_PROMPTS);
    const message = sanitizeMessage(request.data.message);
    const conversationHistory = sanitizeHistory(request.data.conversationHistory);
    const companyId = request.data.companyId || 'default';
    const conversationId = request.data.conversationId || null;

    if (!message) {
      throw new HttpsError('invalid-argument', 'Message is required and must be a non-empty string');
    }

    const assistantMode = VALID_MODES.includes(request.data.mode)
      ? request.data.mode
      : 'general';
    let systemPrompt = SYSTEM_PROMPTS[assistantMode];

    // Load and inject business memory into system prompt (using shared loader)
    const memModule = MODE_TO_MODULE[assistantMode] || 'assistant';
    const memCtx = await getMemoryContext(companyId, memModule, 12);
    if (memCtx.prompt) {
      systemPrompt += memCtx.prompt;
    }

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
        },
      });

      // Build conversation history for context
      // Gemini requires history to start with 'user' role — drop leading assistant messages
      const trimmedHistory = conversationHistory.slice();
      while (trimmedHistory.length > 0 && trimmedHistory[0].role === 'assistant') {
        trimmedHistory.shift();
      }
      const history = trimmedHistory
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

      const chat = model.startChat({
        history,
        systemInstruction: systemPrompt,
      });

      const result = await chat.sendMessage(message);
      const responseText = result.response.text();

      // Persist conversation server-side (fire and forget)
      const persistResult = persistConversation(
        conversationId,
        companyId,
        request.auth.uid,
        assistantMode,
        message,
        responseText
      );

      // Wait briefly for persistence but don't block the response
      const { conversationId: savedConvId, messageCount } = await Promise.race([
        persistResult,
        new Promise((resolve) => setTimeout(() => resolve({ conversationId: null, messageCount: 0 }), 3000)),
      ]);

      // Trigger memory extraction if threshold reached (fire and forget)
      if (savedConvId && messageCount >= MEMORY_EXTRACTION_THRESHOLD) {
        // Check if extraction already done for this conversation
        try {
          const convDoc = await db.collection(CONVERSATION_COLLECTION).doc(savedConvId).get();
          if (convDoc.exists && !convDoc.data().memoryExtractionDone) {
            // Load messages from subcollection (with inline fallback)
            let allMessages = [];
            const msgsSnap = await db.collection(CONVERSATION_COLLECTION)
              .doc(savedConvId).collection('messages')
              .orderBy('timestamp', 'asc').get();
            if (!msgsSnap.empty) {
              allMessages = msgsSnap.docs.map(d => d.data());
            } else {
              allMessages = convDoc.data().messages || [];
            }
            // Fire and forget — don't block the response
            triggerMemoryExtraction(savedConvId, companyId, request.auth.uid, allMessages)
              .catch(err => console.warn('Background extraction failed:', err.message));
          }
        } catch (err) {
          console.warn('Extraction check failed (non-blocking):', err.message);
        }
      }

      return {
        response: responseText,
        mode: assistantMode,
        conversationId: savedConvId || conversationId,
        hasMemoryContext: memCtx.count > 0,
        memoryCount: memCtx.count,
      };
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new HttpsError(
        'internal',
        'Failed to generate AI response. Please try again.'
      );
    }
  }
);

module.exports = { assistantChat };
