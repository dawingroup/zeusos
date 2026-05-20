/**
 * AI Memory Cloud Functions
 * DawinOS v2.0 - Backend memory extraction and context injection
 * 
 * Functions:
 * - extractMemories: Analyze conversation and extract business knowledge
 * - getMemoryContext: Retrieve relevant memories for AI prompt injection
 * - saveManualMemory: Allow users to manually save business knowledge
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');

const db = admin.firestore();
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const MEMORY_COLLECTION = 'ai_memory';
const CONVERSATION_COLLECTION = 'ai_conversations';

// ============================================================================
// Memory Extraction Prompt
// ============================================================================

const EXTRACTION_SYSTEM_PROMPT = `You are a business knowledge extraction system for Dawin Group, a custom millwork and furniture manufacturing company in East Africa.

Your job is to analyze conversations and extract persistent business knowledge that would be valuable to remember for future interactions.

Extract ONLY facts, decisions, preferences, and insights — NOT opinions or casual remarks.

For each extracted memory, provide:
- category: One of: business_fact, user_preference, project_insight, customer_intel, process_knowledge, decision_record, market_intel, financial_insight
- content: The specific knowledge to remember (1-3 sentences)
- summary: A one-line summary (max 100 chars)
- tags: 2-5 relevant tags
- importance: critical, high, medium, or low

Examples of what to extract:
- "The CEO prefers weekly financial reports on Monday mornings" → user_preference
- "Project X was delayed because the supplier in Dar es Salaam had lead time issues" → project_insight
- "Customer ABC always requests FSC-certified wood for their projects" → customer_intel
- "The standard markup for custom millwork is 35-40%" → financial_insight
- "CNC machine capacity is 200 sheets per week" → business_fact

Do NOT extract:
- Greetings or small talk
- Questions without answers
- Vague or uncertain statements
- Information that's only relevant to the current conversation

Respond with a JSON object:
{
  "memories": [
    {
      "category": "...",
      "content": "...",
      "summary": "...",
      "tags": ["..."],
      "importance": "..."
    }
  ],
  "conversationSummary": "Brief 2-3 sentence summary of the conversation",
  "keyTopics": ["topic1", "topic2"]
}

If there's nothing worth extracting, return: { "memories": [], "conversationSummary": "...", "keyTopics": [] }`;

// ============================================================================
// extractMemories — Analyze conversation and store extracted knowledge
// ============================================================================

const extractMemories = onCall(
  {
    secrets: [GEMINI_API_KEY],
    cors: true,
    maxInstances: 5,
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { conversationId, companyId, messages } = request.data;

    if (!companyId) {
      throw new HttpsError('invalid-argument', 'companyId is required');
    }

    // Use provided messages or load from conversation
    let conversationMessages = messages;
    if (!conversationMessages && conversationId) {
      const convDoc = await db.collection(CONVERSATION_COLLECTION).doc(conversationId).get();
      if (convDoc.exists) {
        conversationMessages = convDoc.data().messages || [];
      }
    }

    if (!conversationMessages || conversationMessages.length < 2) {
      return { memories: [], conversationSummary: '', keyTopics: [] };
    }

    // Format conversation for analysis
    const conversationText = conversationMessages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.3, // Low temperature for factual extraction
          responseMimeType: 'application/json',
        },
      });

      const result = await model.generateContent([
        { text: EXTRACTION_SYSTEM_PROMPT },
        { text: `Analyze this conversation and extract business knowledge:\n\n${conversationText}` },
      ]);

      const responseText = result.response.text();
      let extracted;

      try {
        extracted = JSON.parse(responseText);
      } catch {
        console.warn('Failed to parse memory extraction response:', responseText);
        return { memories: [], conversationSummary: '', keyTopics: [] };
      }

      // Store extracted memories in Firestore
      const batch = db.batch();
      const now = admin.firestore.Timestamp.now();
      const memoryIds = [];

      for (const memory of (extracted.memories || [])) {
        const memRef = db.collection(MEMORY_COLLECTION).doc();
        memoryIds.push(memRef.id);

        batch.set(memRef, {
          category: memory.category,
          content: memory.content,
          summary: memory.summary || memory.content.substring(0, 100),
          tags: memory.tags || [],
          importance: memory.importance || 'medium',
          source: {
            type: 'ai_extracted',
            refId: conversationId || null,
            module: 'memory_extraction',
            extractedFrom: `Conversation with ${conversationMessages.length} messages`,
          },
          companyId,
          createdBy: request.auth.uid,
          createdAt: now,
          updatedAt: now,
          accessCount: 0,
          lastAccessedAt: now,
          isArchived: false,
          relatedEntityIds: [],
        });
      }

      // Mark conversation as extracted (if conversationId provided)
      if (conversationId) {
        const convRef = db.collection(CONVERSATION_COLLECTION).doc(conversationId);
        batch.update(convRef, {
          memoryExtractionDone: true,
          updatedAt: now,
        });
      }

      await batch.commit();

      return {
        memories: extracted.memories || [],
        memoryIds,
        conversationSummary: extracted.conversationSummary || '',
        keyTopics: extracted.keyTopics || [],
      };
    } catch (error) {
      console.error('Memory extraction error:', error);
      throw new HttpsError('internal', 'Failed to extract memories from conversation');
    }
  }
);

// ============================================================================
// getMemoryContext — Retrieve relevant memories for prompt injection
// ============================================================================

const getMemoryContext = onCall(
  {
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 15,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const {
      companyId,
      categories,
      projectId,
      customerId,
      maxMemories = 15,
    } = request.data;

    if (!companyId) {
      throw new HttpsError('invalid-argument', 'companyId is required');
    }

    try {
      const memories = [];
      const seenIds = new Set();

      // 1. Entity-specific memories (highest priority)
      if (projectId) {
        const projectSnap = await db.collection(MEMORY_COLLECTION)
          .where('companyId', '==', companyId)
          .where('relatedEntityIds', 'array-contains', projectId)
          .where('isArchived', '==', false)
          .orderBy('importance')
          .limit(5)
          .get();

        projectSnap.docs.forEach((doc) => {
          if (!seenIds.has(doc.id)) {
            seenIds.add(doc.id);
            memories.push({ id: doc.id, ...doc.data() });
          }
        });
      }

      if (customerId) {
        const customerSnap = await db.collection(MEMORY_COLLECTION)
          .where('companyId', '==', companyId)
          .where('relatedEntityIds', 'array-contains', customerId)
          .where('isArchived', '==', false)
          .orderBy('importance')
          .limit(5)
          .get();

        customerSnap.docs.forEach((doc) => {
          if (!seenIds.has(doc.id)) {
            seenIds.add(doc.id);
            memories.push({ id: doc.id, ...doc.data() });
          }
        });
      }

      // 2. Category-specific memories
      if (categories && categories.length > 0 && memories.length < maxMemories) {
        const catSnap = await db.collection(MEMORY_COLLECTION)
          .where('companyId', '==', companyId)
          .where('category', 'in', categories.slice(0, 10))
          .where('isArchived', '==', false)
          .orderBy('lastAccessedAt', 'desc')
          .limit(maxMemories - memories.length)
          .get();

        catSnap.docs.forEach((doc) => {
          if (!seenIds.has(doc.id)) {
            seenIds.add(doc.id);
            memories.push({ id: doc.id, ...doc.data() });
          }
        });
      }

      // 3. Recent important memories to fill remaining slots
      if (memories.length < maxMemories) {
        const recentSnap = await db.collection(MEMORY_COLLECTION)
          .where('companyId', '==', companyId)
          .where('isArchived', '==', false)
          .orderBy('lastAccessedAt', 'desc')
          .limit(maxMemories - memories.length)
          .get();

        recentSnap.docs.forEach((doc) => {
          if (!seenIds.has(doc.id)) {
            seenIds.add(doc.id);
            memories.push({ id: doc.id, ...doc.data() });
          }
        });
      }

      // Update access counts (fire and forget)
      const accessBatch = db.batch();
      const now = admin.firestore.Timestamp.now();
      for (const mem of memories) {
        const memRef = db.collection(MEMORY_COLLECTION).doc(mem.id);
        accessBatch.update(memRef, {
          accessCount: admin.firestore.FieldValue.increment(1),
          lastAccessedAt: now,
        });
      }
      accessBatch.commit().catch((err) => {
        console.warn('Failed to update memory access counts:', err);
      });

      // Format for prompt injection
      const formattedMemories = memories.map((m) => ({
        category: m.category,
        content: m.content,
        summary: m.summary,
        importance: m.importance,
        tags: m.tags,
      }));

      // Build prompt text
      let promptText = '';
      if (formattedMemories.length > 0) {
        const grouped = {};
        for (const m of formattedMemories) {
          const cat = m.category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(`- ${m.summary || m.content}`);
        }

        promptText = '\n\n--- BUSINESS KNOWLEDGE (persistent memory) ---\n';
        promptText += 'Use this information from previous conversations and business data to provide informed, contextual responses:\n\n';
        for (const [cat, items] of Object.entries(grouped)) {
          promptText += `${cat}:\n${items.join('\n')}\n\n`;
        }
        promptText += '--- END BUSINESS KNOWLEDGE ---\n';
      }

      return {
        memories: formattedMemories,
        promptText,
        totalMemories: formattedMemories.length,
      };
    } catch (error) {
      console.error('Memory context retrieval error:', error);
      // Return empty context rather than failing — memory is enhancing, not critical
      return { memories: [], promptText: '', totalMemories: 0 };
    }
  }
);

// ============================================================================
// saveManualMemory — Allow users to explicitly save business knowledge
// ============================================================================

const saveManualMemory = onCall(
  {
    cors: true,
    maxInstances: 5,
    timeoutSeconds: 10,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { companyId, category, content, summary, tags, importance, relatedEntityIds } = request.data;

    if (!companyId || !content || !category) {
      throw new HttpsError('invalid-argument', 'companyId, content, and category are required');
    }

    const validCategories = [
      'business_fact', 'user_preference', 'project_insight', 'customer_intel',
      'process_knowledge', 'decision_record', 'market_intel', 'financial_insight',
    ];
    if (!validCategories.includes(category)) {
      throw new HttpsError('invalid-argument', `Invalid category. Must be one of: ${validCategories.join(', ')}`);
    }

    try {
      const now = admin.firestore.Timestamp.now();
      const memRef = await db.collection(MEMORY_COLLECTION).add({
        category,
        content: content.slice(0, 2000),
        summary: (summary || content.substring(0, 100)).slice(0, 200),
        tags: (tags || []).slice(0, 10),
        importance: importance || 'medium',
        source: { type: 'manual', module: 'user_input' },
        companyId,
        createdBy: request.auth.uid,
        createdAt: now,
        updatedAt: now,
        accessCount: 0,
        lastAccessedAt: now,
        isArchived: false,
        relatedEntityIds: relatedEntityIds || [],
      });

      return { memoryId: memRef.id, success: true };
    } catch (error) {
      console.error('Manual memory save error:', error);
      throw new HttpsError('internal', 'Failed to save memory');
    }
  }
);

// ============================================================================
// semanticMemorySearch — Vector similarity search across business memories
// ============================================================================

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const semanticMemorySearch = onCall(
  {
    secrets: [GEMINI_API_KEY],
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { companyId, query, topK = 10, minSimilarity = 0.45, categories } = request.data;

    if (!companyId || !query) {
      throw new HttpsError('invalid-argument', 'companyId and query are required');
    }

    try {
      // Generate query embedding
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const embModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
      const embResult = await embModel.embedContent(query);
      const queryEmbedding = embResult.embedding.values;

      // Load memories that have embeddings
      let memQuery = db.collection(MEMORY_COLLECTION)
        .where('companyId', '==', companyId)
        .where('isArchived', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(200);

      const snap = await memQuery.get();

      // Score by cosine similarity
      const scored = [];
      snap.docs.forEach((doc) => {
        const data = doc.data();
        if (!data.embedding) return;
        if (categories && categories.length > 0 && !categories.includes(data.category)) return;

        const sim = cosineSimilarity(queryEmbedding, data.embedding);
        if (sim >= minSimilarity) {
          scored.push({
            id: doc.id,
            category: data.category,
            content: data.content,
            summary: data.summary,
            importance: data.importance,
            tags: data.tags || [],
            similarity: Math.round(sim * 1000) / 1000,
          });
        }
      });

      scored.sort((a, b) => b.similarity - a.similarity);
      const results = scored.slice(0, topK);

      return { results, totalScanned: snap.size, totalMatched: scored.length };
    } catch (error) {
      console.error('Semantic memory search error:', error);
      throw new HttpsError('internal', 'Semantic memory search failed');
    }
  }
);

module.exports = { extractMemories, getMemoryContext, saveManualMemory, semanticMemorySearch };
