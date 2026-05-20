/**
 * Intelligence Domain Tools
 * Claude tool definitions and Firestore handlers for business events and AI memory.
 */

const admin = require('firebase-admin');
const db = admin.firestore();

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const definitions = [
  {
    name: 'get_business_events',
    description: 'Get recent business events across the organization. Events include workflow transitions, approvals, deadlines, anomalies, milestones, and resource constraints. Use when asking about what has been happening across the business or understanding recent activity.',
    input_schema: {
      type: 'object',
      properties: {
        sourceModule: {
          type: 'string',
          enum: [
            'design_manager', 'launch_pipeline', 'inventory', 'customer_hub',
            'feature_library', 'cutlist', 'engagements', 'funding', 'reporting',
            'matflow', 'hr_central', 'ceo_strategy', 'financial',
            'staff_performance', 'market_intelligence',
          ],
          description: 'Filter by source module',
        },
        category: {
          type: 'string',
          enum: [
            'workflow_transition', 'approval_required', 'deadline_approaching',
            'anomaly_detected', 'milestone_reached', 'resource_constraint',
            'quality_gate', 'cost_threshold', 'client_interaction',
            'document_update', 'team_assignment',
          ],
          description: 'Filter by event category',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low', 'info'],
          description: 'Filter by severity',
        },
        limit: {
          type: 'number',
          description: 'Maximum results',
          default: 20,
        },
      },
    },
  },
  {
    name: 'search_business_memory',
    description: 'Search the accumulated business knowledge from past conversations and interactions. Includes business facts, project insights, customer intelligence, process knowledge, and financial insights. Use when you need historical context or accumulated organizational knowledge.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Semantic search query describing the knowledge you need',
        },
        categories: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'business_fact', 'user_preference', 'project_insight',
              'customer_intel', 'process_knowledge', 'decision_record',
              'market_intel', 'financial_insight',
            ],
          },
          description: 'Filter by memory categories',
        },
        limit: {
          type: 'number',
          description: 'Maximum results',
          default: 10,
        },
      },
      required: ['query'],
    },
  },
];

// ============================================================================
// HANDLERS
// ============================================================================

const handlers = {
  get_business_events: async (input, context) => {
    const { sourceModule, category, severity, limit = 20 } = input;

    let query = db.collection('businessEvents')
      .orderBy('createdAt', 'desc');

    if (sourceModule) query = query.where('sourceModule', '==', sourceModule);
    if (category) query = query.where('category', '==', category);
    if (severity) query = query.where('severity', '==', severity);

    const snap = await query.limit(limit).get();

    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        eventType: data.eventType,
        category: data.category,
        severity: data.severity,
        sourceModule: data.sourceModule,
        entityType: data.entityType,
        entityId: data.entityId,
        entityName: data.entityName,
        projectId: data.projectId,
        projectName: data.projectName,
        title: data.title,
        description: data.description,
        metadata: data.metadata,
        createdAt: data.createdAt,
      };
    });
  },

  search_business_memory: async (input, context) => {
    const { query, categories, limit = 10 } = input;

    // Text-based search across ai_memory collection
    // (Semantic search would require embedding the query — for now, use keyword matching)
    let memQuery = db.collection('ai_memory')
      .where('companyId', '==', context.companyId || 'default')
      .where('isArchived', '==', false)
      .orderBy('lastAccessedAt', 'desc')
      .limit(limit * 3); // Over-fetch for filtering

    const snap = await memQuery.get();

    let memories = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        category: data.category,
        content: data.content,
        summary: data.summary,
        tags: data.tags || [],
        importance: data.importance,
        source: data.source,
        createdAt: data.createdAt,
      };
    });

    // Filter by categories
    if (categories && categories.length > 0) {
      memories = memories.filter(m => categories.includes(m.category));
    }

    // Keyword relevance scoring
    if (query) {
      const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
      memories = memories
        .map(m => {
          const text = `${m.content} ${m.summary} ${(m.tags || []).join(' ')}`.toLowerCase();
          const score = queryTerms.reduce((s, term) => s + (text.includes(term) ? 1 : 0), 0);
          return { ...m, relevanceScore: score / queryTerms.length };
        })
        .filter(m => m.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    // Update access counts in background
    const memoryIds = memories.slice(0, limit).map(m => m.id);
    if (memoryIds.length > 0) {
      const batch = db.batch();
      for (const id of memoryIds) {
        batch.update(db.collection('ai_memory').doc(id), {
          accessCount: admin.firestore.FieldValue.increment(1),
          lastAccessedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      batch.commit().catch(err => console.warn('Memory access update failed:', err.message));
    }

    return memories.slice(0, limit);
  },
};

module.exports = { definitions, handlers };
