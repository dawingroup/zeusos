/**
 * The assistant's conversation engine, shared by the rail and the full page.
 *
 *  - The BACKEND is the sole writer of messages: `assistantChat` and
 *    `crossModuleIntelligence` persist the pair. The panel used to write them
 *    too, which made four message docs per turn and double-counted the
 *    `messageCount` that gates memory extraction.
 *  - Hydrating from Firestore happens once per thread, so a live update during a
 *    turn cannot clobber the optimistic messages or a chip's running state.
 *  - An action runs only from a person's click on this turn's chip. A chip from
 *    a past thread is shown, never runnable: replaying yesterday's proposal is
 *    not what anyone meant by opening history.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { app } from '@/core/services/firebase/config';
import { functions } from '@/shared/services/firebase';
import { useAuth } from '@/shared/hooks';
import { useAIConversation } from '@/shared/hooks/useAIMemory';
import { updateConversationTitle } from '@/shared/services/ai/aiMemory.service';
import { describeCallableError } from '@/shared/utils/callableError';
import type { AssistantModeId } from '../../constants';
import { deriveTitle, extractActions, type ProposedAction } from './assistantActions';

export interface ActionExecution {
  status: 'running' | 'ok' | 'error';
  resultSummary?: string;
  errorMessage?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  displayText?: string;
  actions?: ProposedAction[];
  executions?: Record<number, ActionExecution>;
  /** From a past thread: shown, never runnable. */
  historical?: boolean;
  running?: boolean;
  failed?: boolean;
}

interface TurnResponse {
  response: string;
  conversationId?: string;
  memoryCount?: number;
}

const agentFunctions = () => getFunctions(app, 'europe-west1');

export interface UseAssistantChatOptions {
  companyId: string;
  mode: AssistantModeId;
  context?: Record<string, unknown>;
  autoLoad?: boolean;
}

export function useAssistantChat({ companyId, mode, context, autoLoad = true }: UseAssistantChatOptions) {
  const { user } = useAuth();
  const userId = user?.uid || '';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [memoryCount, setMemoryCount] = useState(0);

  const {
    messages: persisted,
    isLoading,
    startNew,
    conversationId,
    recentConversations,
    loadConversation,
    refreshRecent,
  } = useAIConversation({
    module: 'assistant',
    companyId,
    userId,
    mode,
    title: 'Ask ZeusOS',
    autoLoad: !!userId && autoLoad,
  });

  // Set when the client could not open a thread and the backend made one.
  const serverThreadId = useRef<string | null>(null);
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading || !conversationId || persisted.length === 0) return;
    if (hydratedFor.current === conversationId) return;
    hydratedFor.current = conversationId;
    setMessages(
      persisted
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => {
          if (m.role === 'user') return { id: m.id, role: 'user' as const, content: m.content };
          const { displayText, actions } = extractActions(m.content);
          return { id: m.id, role: 'assistant' as const, content: m.content, displayText, actions, historical: true };
        }),
    );
  }, [conversationId, persisted, isLoading]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || isTyping) return;

      const threadId = conversationId || serverThreadId.current;
      const firstTurn = messages.length === 0;
      // This thread's history is already on screen from here on.
      if (threadId) hydratedFor.current = threadId;

      const stamp = Date.now();
      const placeholderId = `ai-${stamp}`;
      const conversationHistory = messages
        .filter((m) => !m.failed && !m.running)
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [
        ...prev,
        { id: `user-${stamp}`, role: 'user', content: message },
        { id: placeholderId, role: 'assistant', content: '', running: true },
      ]);
      setIsTyping(true);

      try {
        const fn = httpsCallable<Record<string, unknown>, TurnResponse>(
          functions,
          mode === 'cross_module' ? 'crossModuleIntelligence' : 'assistantChat',
          { timeout: 240000 },
        );
        const { data } = await fn({
          message,
          mode,
          companyId,
          conversationId: threadId || undefined,
          context: context || undefined,
          currentModule: context?.currentModule,
          conversationHistory,
        });
        const { displayText, actions } = extractActions(data.response || '');
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId ? { ...m, running: false, content: data.response || '', displayText, actions } : m,
          ),
        );
        if (data.memoryCount !== undefined) setMemoryCount(data.memoryCount);
        if (!threadId && data.conversationId) {
          serverThreadId.current = data.conversationId;
          hydratedFor.current = data.conversationId;
        }
        const titled = threadId || data.conversationId;
        if (firstTurn && titled) {
          updateConversationTitle(titled, deriveTitle(message)).catch(() => {});
        }
        refreshRecent().catch(() => {});
      } catch (err) {
        const words = describeCallableError(err, 'get an answer');
        setMessages((prev) =>
          prev.map((m) => (m.id === placeholderId ? { ...m, running: false, failed: true, content: words, displayText: words } : m)),
        );
      } finally {
        setIsTyping(false);
      }
    },
    [isTyping, conversationId, messages, mode, companyId, context, refreshRecent],
  );

  const executeAction = useCallback(
    async (messageId: string, index: number) => {
      const action = messages.find((m) => m.id === messageId)?.actions?.[index];
      if (!action) return;
      const patch = (exec: ActionExecution) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, executions: { ...(m.executions || {}), [index]: exec } } : m)),
        );
      patch({ status: 'running' });
      try {
        const fn = httpsCallable<Record<string, unknown>, { ok?: boolean; summary?: string }>(agentFunctions(), 'agentExecuteTool', { timeout: 120000 });
        const { data } = await fn({ agentId: action.agentId, toolId: action.toolId, input: action.input });
        patch({ status: 'ok', resultSummary: data.summary || 'Done' });
      } catch (err) {
        patch({ status: 'error', errorMessage: describeCallableError(err, 'run this action') });
      }
    },
    [messages],
  );

  const newChat = useCallback(async () => {
    await startNew();
    hydratedFor.current = null;
    serverThreadId.current = null;
    setMessages([]);
    setMemoryCount(0);
    refreshRecent().catch(() => {});
  }, [startNew, refreshRecent]);

  const openThread = useCallback(
    (id: string) => {
      if (id === conversationId) return;
      hydratedFor.current = null;
      serverThreadId.current = null;
      setMessages([]);
      loadConversation(id);
    },
    [conversationId, loadConversation],
  );

  return { messages, isTyping, memoryCount, conversationId, recentConversations, send, executeAction, newChat, openThread };
}

export default useAssistantChat;
