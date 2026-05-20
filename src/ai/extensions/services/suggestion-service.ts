/**
 * Intelligent Suggestion Service
 * Generates context-aware suggestions using Gemini
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import {
  AISuggestion,
  SuggestionContext,
  SuggestionType,
  SuggestionPriority,
} from '../types/ai-extensions';
import { ModuleType } from '../../../subsidiaries/advisory/cross-module/types/cross-module';

// System prompts by module
const MODULE_SUGGESTION_PROMPTS: Record<ModuleType, string> = {
  infrastructure: `You are an AI assistant for infrastructure project management in Uganda.
Generate intelligent suggestions for:
- Linking projects to relevant deals or programs
- Identifying schedule or budget risks
- Suggesting next actions based on project status
- Finding similar past projects for reference
- Highlighting approval bottlenecks

Focus on East African construction context with offline-first considerations.`,

  investment: `You are an AI assistant for infrastructure investment deals.
Generate intelligent suggestions for:
- Linking deals to execution projects
- Identifying due diligence gaps
- Suggesting comparable transactions
- Risk factors based on deal structure
- Timeline optimization for deal closure

Consider Uganda/Kenya market dynamics and regulatory requirements.`,

  advisory: `You are an AI assistant for investment advisory services.
Generate intelligent suggestions for:
- Portfolio rebalancing opportunities
- Holdings linked to infrastructure deals
- Client reporting needs
- Performance attribution insights
- Risk concentration warnings

Focus on institutional advisory context with infrastructure focus.`,

  matflow: `You are an AI assistant for construction material management.
Generate intelligent suggestions for:
- BOQ optimization opportunities
- Material substitution recommendations
- Bulk procurement opportunities
- Variance alerts and cost overruns
- Supplier recommendations

Consider Uganda market availability and pricing.`,
};

export class SuggestionService {
  private suggestionsRef = collection(db, 'aiSuggestions');

  /**
   * Generate suggestions for an entity using AI
   */
  async generateSuggestions(context: SuggestionContext): Promise<AISuggestion[]> {
    const systemPrompt = MODULE_SUGGESTION_PROMPTS[context.module];

    const prompt = `${systemPrompt}

CURRENT CONTEXT:
- Module: ${context.module}
- Entity Type: ${context.entityType}
- User Role: ${context.userRole}

ENTITY DATA:
${JSON.stringify(context.entityData, null, 2)}

RECENT USER ACTIONS:
${context.recentActions.map(a => `- ${a.action} on ${a.entityType} at ${a.timestamp}`).join('\n')}

RELATED ENTITIES:
${context.relatedEntities.map(e => `- ${e.relationship}: ${e.entityType} (${e.entityId})`).join('\n')}

Generate 3-5 intelligent, actionable suggestions based on this context.
Prioritize suggestions that would save time, reduce risk, or improve outcomes.
Include confidence scores based on available data quality.

Return as JSON array with format:
[{
  "type": "entity_link|next_action|risk_alert|optimization|anomaly|completion|similar_entity|trend_insight",
  "priority": "critical|high|medium|low|info",
  "title": "Short actionable title",
  "description": "Detailed description",
  "reasoning": "Why this suggestion",
  "confidence": 0.0-1.0,
  "actionType": "navigate|create|update|link|alert|review",
  "actionPayload": {},
  "targetModule": "optional target module",
  "targetEntityType": "optional target entity type",
  "targetEntityId": "optional target entity id"
}]`;

    try {
      // Call Gemini via Cloud Function or direct API
      const response = await this.callGeminiAPI(prompt);
      const parsedSuggestions = this.parseSuggestions(response);

      const suggestions: AISuggestion[] = parsedSuggestions.map((s, index) => ({
        id: `suggestion_${Date.now()}_${index}`,
        type: s.type as SuggestionType,
        priority: s.priority as SuggestionPriority,
        title: s.title,
        description: s.description,
        reasoning: s.reasoning,
        confidence: s.confidence,
        actionType: s.actionType,
        actionPayload: s.actionPayload || {},
        sourceModule: context.module,
        sourceEntityType: context.entityType,
        sourceEntityId: context.entityId,
        targetModule: s.targetModule as ModuleType | undefined,
        targetEntityType: s.targetEntityType,
        targetEntityId: s.targetEntityId,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        userId: context.userRole,
      }));

      // Store suggestions
      for (const suggestion of suggestions) {
        await this.storeSuggestion(suggestion);
      }

      return suggestions;
    } catch (error) {
      console.error('Error generating suggestions:', error);
      return this.generateFallbackSuggestions(context);
    }
  }

  /**
   * Call Gemini API (placeholder - integrate with actual Genkit setup)
   */
  private async callGeminiAPI(prompt: string): Promise<string> {
    // This would call the actual Gemini API via Cloud Function
    // For now, return mock response for development
    console.log('Calling Gemini with prompt:', prompt.substring(0, 200));
    
    // In production, this would be:
    // const response = await fetch('/api/ai/suggestions', {
    //   method: 'POST',
    //   body: JSON.stringify({ prompt })
    // });
    // return response.json();
    
    return JSON.stringify([
      {
        type: 'next_action',
        priority: 'high',
        title: 'Review pending approvals',
        description: 'There are items waiting for your approval that may be blocking progress.',
        reasoning: 'Based on workflow analysis, pending approvals are causing delays.',
        confidence: 0.85,
        actionType: 'navigate',
        actionPayload: { route: '/approvals' }
      },
      {
        type: 'risk_alert',
        priority: 'medium',
        title: 'Budget threshold approaching',
        description: 'Current spending is at 85% of allocated budget.',
        reasoning: 'Historical data shows projects at this level often exceed budget.',
        confidence: 0.78,
        actionType: 'alert',
        actionPayload: { metric: 'budget', threshold: 0.85 }
      }
    ]);
  }

  /**
   * Parse suggestions from AI response
   */
  private parseSuggestions(response: string): any[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      console.error('Failed to parse suggestions response');
      return [];
    }
  }

  /**
   * Generate fallback suggestions when AI fails
   */
  private generateFallbackSuggestions(context: SuggestionContext): AISuggestion[] {
    const suggestions: AISuggestion[] = [];

    // Generic suggestions based on module
    if (context.module === 'infrastructure') {
      suggestions.push({
        id: `suggestion_${Date.now()}_fallback_0`,
        type: 'next_action',
        priority: 'medium',
        title: 'Update project progress',
        description: 'Consider updating the project progress to reflect current status.',
        reasoning: 'Regular progress updates help maintain accurate project tracking.',
        confidence: 0.6,
        actionType: 'update',
        actionPayload: { field: 'progress' },
        sourceModule: context.module,
        sourceEntityType: context.entityType,
        sourceEntityId: context.entityId,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        userId: context.userRole,
      });
    }

    return suggestions;
  }

  /**
   * Store suggestion in Firestore
   */
  private async storeSuggestion(suggestion: AISuggestion): Promise<string> {
    const docRef = await addDoc(this.suggestionsRef, {
      ...suggestion,
      generatedAt: serverTimestamp(),
      expiresAt: suggestion.expiresAt ? Timestamp.fromDate(suggestion.expiresAt) : null,
    });
    return docRef.id;
  }

  /**
   * Get active suggestions for user
   */
  async getSuggestions(
    userId: string,
    module?: ModuleType,
    entityId?: string
  ): Promise<AISuggestion[]> {
    try {
      let q = query(
        this.suggestionsRef,
        where('userId', '==', userId),
        where('dismissedAt', '==', null),
        where('appliedAt', '==', null),
        orderBy('priority'),
        limit(20)
      );

      if (module) {
        q = query(
          this.suggestionsRef,
          where('userId', '==', userId),
          where('sourceModule', '==', module),
          where('dismissedAt', '==', null),
          where('appliedAt', '==', null),
          orderBy('priority'),
          limit(20)
        );
      }

      if (entityId) {
        q = query(
          this.suggestionsRef,
          where('userId', '==', userId),
          where('sourceEntityId', '==', entityId),
          where('dismissedAt', '==', null),
          where('appliedAt', '==', null),
          orderBy('priority'),
          limit(20)
        );
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        generatedAt: doc.data().generatedAt?.toDate() || new Date(),
        expiresAt: doc.data().expiresAt?.toDate(),
      })) as AISuggestion[];
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      return [];
    }
  }

  /**
   * Dismiss a suggestion
   */
  async dismissSuggestion(
    suggestionId: string,
    feedback?: 'not_helpful' | 'incorrect',
    note?: string
  ): Promise<void> {
    await updateDoc(doc(this.suggestionsRef, suggestionId), {
      dismissedAt: serverTimestamp(),
      feedback,
      feedbackNote: note,
    });
  }

  /**
   * Apply a suggestion
   */
  async applySuggestion(suggestionId: string): Promise<void> {
    await updateDoc(doc(this.suggestionsRef, suggestionId), {
      appliedAt: serverTimestamp(),
      feedback: 'helpful',
    });
  }

  /**
   * Subscribe to suggestions
   */
  subscribeSuggestions(
    userId: string,
    module: ModuleType,
    callback: (suggestions: AISuggestion[]) => void
  ): () => void {
    const q = query(
      this.suggestionsRef,
      where('userId', '==', userId),
      where('sourceModule', '==', module),
      where('dismissedAt', '==', null),
      where('appliedAt', '==', null),
      orderBy('priority'),
      limit(10)
    );

    return onSnapshot(q, (snapshot) => {
      const suggestions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        generatedAt: doc.data().generatedAt?.toDate() || new Date(),
        expiresAt: doc.data().expiresAt?.toDate(),
      })) as AISuggestion[];
      callback(suggestions);
    }, (error) => {
      console.error('Suggestion subscription error:', error);
      callback([]);
    });
  }
}

export const suggestionService = new SuggestionService();
