/**
 * Cross-Module Intelligence Hook
 * Manages conversation state and API calls to the crossModuleIntelligence Cloud Function.
 */

import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/services/firebase';

export interface CrossModuleMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
  toolCallCount?: number;
}

interface CrossModuleRequest {
  message: string;
  companyId: string;
  conversationId?: string;
  currentModule?: string;
  conversationHistory: Array<{ role: string; content: string }>;
}

interface CrossModuleResponse {
  response: string;
  mode: string;
  conversationId?: string;
  hasMemoryContext: boolean;
  memoryCount: number;
  toolsUsed: string[];
  toolCallCount: number;
  usage: { inputTokens: number; outputTokens: number };
}

// Friendly labels for tool names (displayed during "thinking" state)
const TOOL_LABELS: Record<string, string> = {
  get_project_overview: 'Querying project details',
  search_design_items: 'Searching design items',
  get_project_optimization: 'Loading optimization results',
  get_manufacturing_orders: 'Checking manufacturing orders',
  get_manufacturing_order_detail: 'Loading MO details',
  get_purchase_orders: 'Reviewing purchase orders',
  search_inventory: 'Searching inventory',
  get_inventory_item: 'Loading inventory item',
  check_material_availability: 'Checking material availability',
  get_customer_360: 'Building customer view',
  search_customers: 'Searching customers',
  get_deals_pipeline: 'Loading deals pipeline',
  get_financial_summary: 'Pulling financial data',
  get_project_costing: 'Analyzing project costs',
  search_suppliers: 'Searching suppliers',
  get_supplier_detail: 'Loading supplier info',
  get_business_events: 'Reviewing business events',
  search_business_memory: 'Searching business memory',
  cross_module_query: 'Running cross-module analysis',
};

export function useCrossModuleIntelligence(companyId: string) {
  const [messages, setMessages] = useState<CrossModuleMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [memoryCount, setMemoryCount] = useState(0);
  const [lastToolsUsed, setLastToolsUsed] = useState<string[]>([]);

  const sendMessage = useCallback(async (
    messageText: string,
    currentModule?: string,
  ) => {
    if (!messageText.trim()) return;

    // Add user message
    const userMessage: CrossModuleMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const fn = httpsCallable<CrossModuleRequest, CrossModuleResponse>(
        functions,
        'crossModuleIntelligence'
      );

      const result = await fn({
        message: messageText.trim(),
        companyId,
        conversationId: conversationId || undefined,
        currentModule,
        conversationHistory: messages.slice(-20).map(m => ({
          role: m.role,
          content: m.content,
        })),
      });

      if (result.data.conversationId) {
        setConversationId(result.data.conversationId);
      }
      if (result.data.memoryCount !== undefined) {
        setMemoryCount(result.data.memoryCount);
      }
      setLastToolsUsed(result.data.toolsUsed || []);

      const aiMessage: CrossModuleMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: result.data.response,
        timestamp: new Date(),
        toolsUsed: result.data.toolsUsed,
        toolCallCount: result.data.toolCallCount,
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Cross-module intelligence error:', error);
      const errorMessage: CrossModuleMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, conversationId, messages]);

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setMemoryCount(0);
    setLastToolsUsed([]);
  }, []);

  return {
    messages,
    isLoading,
    conversationId,
    memoryCount,
    lastToolsUsed,
    sendMessage,
    startNewConversation,
    TOOL_LABELS,
  };
}
