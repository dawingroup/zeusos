// ============================================================================
// NATURAL LANGUAGE QUERY SERVICE
// ZeusOS v2.0 - Intelligence Layer
// Interprets natural language queries and fetches data from modules
// ============================================================================

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from '@/shared/services/firebase/firestore';
import { functions } from '@/shared/services/firebase';
import type { NLQueryResponse } from '../types';

// ============================================================================
// QUERY INTENT PATTERNS
// ============================================================================

interface IntentPattern {
  keywords: string[];
  intent: string;
  module: string;
  collection: string;
  responseType: NLQueryResponse['type'];
}

const INTENT_PATTERNS: IntentPattern[] = [
  // Task queries
  { keywords: ['task', 'tasks', 'my tasks', 'todo', 'to do', 'assigned'], intent: 'list_tasks', module: 'intelligence', collection: 'generatedTasks', responseType: 'list' },
  { keywords: ['overdue', 'late', 'past due', 'behind'], intent: 'overdue_tasks', module: 'intelligence', collection: 'generatedTasks', responseType: 'list' },
  { keywords: ['blocked', 'stuck', 'stalled'], intent: 'blocked_tasks', module: 'intelligence', collection: 'generatedTasks', responseType: 'list' },
  { keywords: ['pending', 'waiting', 'approval', 'pending approval'], intent: 'pending_tasks', module: 'intelligence', collection: 'generatedTasks', responseType: 'list' },
  { keywords: ['completed', 'done', 'finished'], intent: 'completed_tasks', module: 'intelligence', collection: 'generatedTasks', responseType: 'list' },

  // Design + inventory intents removed in the Phase 1.E intelligence-layer
  // strip — they queried `designProjects` / `inventoryItems`, DawinOS
  // collections stripped in Phase 1.A/1.C. Unmatched queries now fall to
  // the default "I don't understand" response.

  // Event queries
  { keywords: ['event', 'events', 'recent activity', 'what happened', 'recent'], intent: 'recent_events', module: 'intelligence', collection: 'businessEvents', responseType: 'list' },

  // Analytics queries
  { keywords: ['how many', 'count', 'total', 'number of'], intent: 'count_query', module: 'intelligence', collection: 'generatedTasks', responseType: 'data' },
  { keywords: ['trend', 'performance', 'metrics', 'analytics', 'report'], intent: 'analytics', module: 'intelligence', collection: 'generatedTasks', responseType: 'summary' },
];

// ============================================================================
// SERVICE
// ============================================================================

class NaturalLanguageQueryService {
  /**
   * Process a natural language query and return structured results
   */
  async processQuery(queryText: string): Promise<NLQueryResponse> {
    const normalizedQuery = queryText.toLowerCase().trim();

    // Try AI-powered interpretation first via Cloud Function
    const aiResponse = await this.tryAIInterpretation(queryText);
    if (aiResponse) return aiResponse;

    // Fall back to pattern matching
    const intent = this.detectIntent(normalizedQuery);
    if (!intent) {
      return {
        type: 'summary',
        content: `I couldn't find a specific answer for "${queryText}". Try asking about tasks, projects, inventory, or recent activity.`,
        explanation: 'Query intent not recognized. Try using keywords like "tasks", "overdue", "stock", or "events".',
        confidence: 0.3,
        suggestedFollowUps: [
          'Show my pending tasks',
          'What tasks are overdue?',
          'Show recent events',
          'What is the inventory status?',
        ],
      };
    }

    return this.executeIntent(intent);
  }

  /**
   * Try interpreting via Gemini Cloud Function
   */
  private async tryAIInterpretation(queryText: string): Promise<NLQueryResponse | null> {
    try {
      const queryFn = httpsCallable<
        { query: string; availableModules: string[] },
        { response: string; intent: string; confidence: number }
      >(functions, 'naturalLanguageQuery');

      const result = await queryFn({
        query: queryText,
        availableModules: ['design_manager', 'inventory', 'launch_pipeline', 'intelligence'],
      });

      if (result.data.confidence > 0.7) {
        return {
          type: 'summary',
          content: result.data.response,
          explanation: `Interpreted as: ${result.data.intent}`,
          confidence: result.data.confidence,
          suggestedFollowUps: [
            'Tell me more',
            'Show related data',
            'What else should I know?',
          ],
        };
      }
    } catch {
      // Cloud Function not available — fall through to local interpretation
    }
    return null;
  }

  /**
   * Detect intent from query text using keyword matching
   */
  private detectIntent(query: string): IntentPattern | null {
    let bestMatch: IntentPattern | null = null;
    let bestScore = 0;

    for (const pattern of INTENT_PATTERNS) {
      let score = 0;
      for (const keyword of pattern.keywords) {
        if (query.includes(keyword)) {
          score += keyword.split(' ').length; // Multi-word matches score higher
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern;
      }
    }

    return bestMatch;
  }

  /**
   * Execute detected intent and return results
   */
  private async executeIntent(intent: IntentPattern): Promise<NLQueryResponse> {
    try {
      switch (intent.intent) {
        case 'list_tasks':
          return this.queryTasks('all');
        case 'overdue_tasks':
          return this.queryOverdueTasks();
        case 'blocked_tasks':
          return this.queryTasks('blocked');
        case 'pending_tasks':
          return this.queryTasks('pending');
        case 'completed_tasks':
          return this.queryTasks('completed');
        case 'recent_events':
          return this.queryRecentEvents();
        case 'count_query':
          return this.queryTaskCounts();
        case 'analytics':
          return this.queryTaskAnalytics();
        // inventory_status / list_designs / design_stages removed — see
        // the INTENT_PATTERNS strip note above.
        default:
          return {
            type: 'summary',
            content: `I understood you're asking about ${intent.module}, but I need more specifics.`,
            explanation: `Detected intent: ${intent.intent}`,
            confidence: 0.5,
            suggestedFollowUps: ['Show my tasks', 'What is overdue?', 'Recent events'],
          };
      }
    } catch (err) {
      console.error('Error executing query intent:', err);
      return {
        type: 'error',
        content: 'Sorry, I encountered an error fetching the data.',
        explanation: 'There was a problem accessing the database.',
        confidence: 0,
      };
    }
  }

  // ============================================================================
  // QUERY EXECUTORS
  // ============================================================================

  private async queryTasks(statusFilter: string): Promise<NLQueryResponse> {
    const constraints: any[] = [orderBy('dueDate', 'asc'), limit(20)];
    if (statusFilter !== 'all') {
      constraints.unshift(where('status', '==', statusFilter));
    }

    const q = query(collection(db, 'generatedTasks'), ...constraints);
    const snap = await getDocs(q);

    const tasks = snap.docs.map((d) => {
      const data = d.data();
      return {
        title: data.title,
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate?.toDate()?.toLocaleDateString() || 'No due date',
        progress: `${data.checklistProgress || 0}%`,
      };
    });

    if (tasks.length === 0) {
      return {
        type: 'summary',
        content: statusFilter === 'all'
          ? 'No tasks found.'
          : `No ${statusFilter} tasks found.`,
        explanation: 'The query returned no results.',
        confidence: 0.9,
        suggestedFollowUps: ['Show all tasks', 'Show completed tasks'],
      };
    }

    const taskList = tasks.map((t) => `- **${t.title}** (${t.status}, ${t.priority}) — Due: ${t.dueDate}, Progress: ${t.progress}`).join('\n');

    return {
      type: 'list',
      content: `Found ${tasks.length} ${statusFilter !== 'all' ? statusFilter + ' ' : ''}task${tasks.length !== 1 ? 's' : ''}:\n\n${taskList}`,
      explanation: `Showing ${statusFilter !== 'all' ? statusFilter : 'all'} tasks sorted by due date.`,
      confidence: 0.9,
      suggestedFollowUps: [
        'Which tasks are overdue?',
        'Show blocked tasks',
        'How many tasks are completed?',
      ],
    };
  }

  private async queryOverdueTasks(): Promise<NLQueryResponse> {
    const now = new Date();
    const q = query(
      collection(db, 'generatedTasks'),
      where('status', 'in', ['pending', 'in_progress']),
      where('dueDate', '<', Timestamp.fromDate(now)),
      orderBy('dueDate', 'asc'),
      limit(20)
    );

    const snap = await getDocs(q);
    const tasks = snap.docs.map((d) => {
      const data = d.data();
      const dueDate = data.dueDate?.toDate();
      const daysOverdue = dueDate ? Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      return {
        title: data.title,
        priority: data.priority,
        daysOverdue,
        assignedTo: data.assignedToName || 'Unassigned',
      };
    });

    if (tasks.length === 0) {
      return {
        type: 'summary',
        content: 'No overdue tasks found. Everything is on track!',
        explanation: 'All tasks are within their due dates.',
        confidence: 0.95,
        suggestedFollowUps: ['Show pending tasks', 'Show tasks due today'],
      };
    }

    const taskList = tasks.map((t) => `- **${t.title}** (${t.priority}) — ${t.daysOverdue} day${t.daysOverdue !== 1 ? 's' : ''} overdue, assigned to ${t.assignedTo}`).join('\n');

    return {
      type: 'list',
      content: `Found ${tasks.length} overdue task${tasks.length !== 1 ? 's' : ''}:\n\n${taskList}`,
      explanation: 'Tasks past their due date that need attention.',
      confidence: 0.92,
      suggestedFollowUps: [
        'Show blocked tasks',
        'Show all my tasks',
        'What are the high priority tasks?',
      ],
    };
  }

  private async queryRecentEvents(): Promise<NLQueryResponse> {
    const q = query(
      collection(db, 'businessEvents'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const snap = await getDocs(q);
    const events = snap.docs.map((d) => {
      const data = d.data();
      return {
        title: data.title,
        severity: data.severity,
        module: data.sourceModule,
        time: data.createdAt?.toDate()?.toLocaleString() || 'Unknown',
      };
    });

    if (events.length === 0) {
      return {
        type: 'summary',
        content: 'No recent business events found.',
        explanation: 'No events have been recorded yet.',
        confidence: 0.9,
        suggestedFollowUps: ['Show my tasks', 'What is the inventory status?'],
      };
    }

    const eventList = events.map((e) => `- **${e.title}** [${e.severity}] — ${e.module.replace('_', ' ')} at ${e.time}`).join('\n');

    return {
      type: 'list',
      content: `Recent business events:\n\n${eventList}`,
      explanation: `Showing the ${events.length} most recent events across all modules.`,
      confidence: 0.88,
      suggestedFollowUps: [
        'Show high severity events only',
        'What tasks were generated from these events?',
        'Show events for design manager',
      ],
    };
  }

  // queryInventory removed — it read the DawinOS `inventoryItems`
  // collection (stripped in Phase 1.C). See the INTENT_PATTERNS note.

  private async queryTaskCounts(): Promise<NLQueryResponse> {
    const q = query(collection(db, 'generatedTasks'), limit(200));
    const snap = await getDocs(q);

    const counts: Record<string, number> = {
      total: 0, pending: 0, in_progress: 0, completed: 0, blocked: 0, cancelled: 0,
    };

    snap.docs.forEach((d) => {
      const status = d.data().status || 'pending';
      counts.total++;
      counts[status] = (counts[status] || 0) + 1;
    });

    return {
      type: 'data',
      content: `Task Summary:\n- **Total**: ${counts.total}\n- **Pending**: ${counts.pending}\n- **In Progress**: ${counts.in_progress}\n- **Completed**: ${counts.completed}\n- **Blocked**: ${counts.blocked}${counts.cancelled ? `\n- **Cancelled**: ${counts.cancelled}` : ''}`,
      explanation: 'Counts across all generated tasks in the system.',
      confidence: 0.95,
      suggestedFollowUps: [
        'Show overdue tasks',
        'Show blocked tasks',
        'What is the completion rate?',
      ],
    };
  }

  private async queryTaskAnalytics(): Promise<NLQueryResponse> {
    const q = query(collection(db, 'generatedTasks'), limit(200));
    const snap = await getDocs(q);

    const tasks = snap.docs.map((d) => d.data());
    const total = tasks.length;

    if (total === 0) {
      return {
        type: 'summary',
        content: 'No task data available for analytics.',
        explanation: 'Tasks need to be generated before analytics are available.',
        confidence: 0.9,
        suggestedFollowUps: ['Show recent events', 'What are the pending tasks?'],
      };
    }

    const completed = tasks.filter((t) => t.status === 'completed').length;
    const completionRate = Math.round((completed / total) * 100);
    const avgProgress = Math.round(tasks.reduce((sum, t) => sum + (t.checklistProgress || 0), 0) / total);
    const blockedRate = Math.round((tasks.filter((t) => t.status === 'blocked').length / total) * 100);

    const moduleDistribution: Record<string, number> = {};
    tasks.forEach((t) => {
      const mod = t.sourceModule || 'unknown';
      moduleDistribution[mod] = (moduleDistribution[mod] || 0) + 1;
    });

    const topModules = Object.entries(moduleDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([mod, count]) => `${mod.replace('_', ' ')}: ${count}`)
      .join(', ');

    return {
      type: 'summary',
      content: `Task Analytics:\n- **Completion Rate**: ${completionRate}%\n- **Average Progress**: ${avgProgress}%\n- **Blocked Rate**: ${blockedRate}%\n- **Top Modules**: ${topModules}\n- **Total Tasks**: ${total}`,
      explanation: 'Analytics computed from all generated tasks.',
      confidence: 0.88,
      suggestedFollowUps: [
        'Show overdue tasks',
        'Which module has the most tasks?',
        'Show completion trends',
      ],
    };
  }

  // queryDesignProjects removed — it read the DawinOS `designProjects`
  // collection (stripped in Phase 1.A). See the INTENT_PATTERNS note.
}

export const naturalLanguageQueryService = new NaturalLanguageQueryService();
export default naturalLanguageQueryService;
