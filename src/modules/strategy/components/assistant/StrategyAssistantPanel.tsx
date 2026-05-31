// ============================================================================
// StrategyAssistantPanel
// DawinOS v2.0 - CEO Strategy Command Module
// Floating, collapsible right-side chat that talks to the Strategy Agent
// (AG-007) through assistantChat mode='strategy_agent'. Available on every
// strategy page via the DashboardLayout mount.
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MessageSquare,
  PlayCircle,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  TrendingDown,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Textarea } from '@/core/components/ui/textarea';
import { functions } from '@/shared/services/firebase';
import { STRATEGY_COMPANY_ID } from '../../constants/company';

interface ProposedAction {
  agentId: string;
  toolId: string;
  summary: string;
  input: Record<string, unknown>;
}

interface ActionExecution {
  status: 'pending' | 'running' | 'ok' | 'error';
  resultSummary?: string;
  errorMessage?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  // Actions parsed out of the assistant's response — keyed by index within
  // the message so we can render execution state per-chip.
  actions?: ProposedAction[];
  // Per-action execution state. Indices match `actions`.
  actionExecutions?: Record<number, ActionExecution>;
}

// Matches ```action\n{...}\n``` fenced blocks. The regex is intentionally
// lenient on whitespace / trailing newlines because Gemini occasionally
// pads them.
const ACTION_BLOCK_RE = /```action\s*\n([\s\S]*?)\n?```/g;

/**
 * Split a raw assistant response into displayed prose + parsed action
 * proposals. We try to parse each block as JSON; if it fails we leave the
 * raw fenced block in the displayed text rather than silently dropping
 * something the model intended to say.
 */
function extractActions(raw: string): { displayText: string; actions: ProposedAction[] } {
  const actions: ProposedAction[] = [];
  const failedBlocks: string[] = [];
  const displayText = raw.replace(ACTION_BLOCK_RE, (match, json) => {
    try {
      const parsed = JSON.parse(json);
      if (
        parsed &&
        typeof parsed.agentId === 'string' &&
        typeof parsed.toolId === 'string' &&
        typeof parsed.summary === 'string' &&
        typeof parsed.input === 'object' &&
        parsed.input !== null
      ) {
        actions.push(parsed as ProposedAction);
        return '';
      }
      failedBlocks.push(match);
      return match;
    } catch {
      failedBlocks.push(match);
      return match;
    }
  });
  // Collapse extra blank lines left behind by stripped blocks.
  const cleanText = displayText.replace(/\n{3,}/g, '\n\n').trim();
  return { displayText: cleanText, actions };
}

interface QuickAction {
  label: string;
  prompt: string;
  icon: React.ComponentType<{ className?: string }>;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Summarize active cycle',
    prompt: 'Summarize the active OKR cycle. Which objectives are on track and which need attention right now?',
    icon: Zap,
  },
  {
    label: 'What’s at risk?',
    prompt: 'List every key result and KPI that is currently off-track or stale. Order by urgency and tell me what to do about each.',
    icon: TrendingDown,
  },
  {
    label: 'Suggest next KRs',
    prompt: 'Looking at the active objectives, are there obvious gaps in the key result coverage? Suggest one new measurable KR per objective that lacks one.',
    icon: Target,
  },
  {
    label: 'Show recent findings',
    prompt: 'What has the Strategy Agent found in the most recent runs? Highlight anything I still need to act on.',
    icon: Sparkles,
  },
];

const LS_KEY = 'strategy-assistant-conversation-id';

interface StrategyAssistantPanelProps {
  // Optional inline context the page can pass — e.g. {objectiveId, kpiId} so
  // the assistant knows what "this objective" refers to without parsing
  // URLs from the chat. Sent to the backend as `context.pageContext`.
  pageContext?: Record<string, string | undefined>;
}

export const StrategyAssistantPanel: React.FC<StrategyAssistantPanelProps> = ({
  pageContext,
}) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Persist a single rolling conversation per browser session so messages
  // chain together across page transitions. Wiped only via Reset.
  const [conversationId, setConversationId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LS_KEY);
  });

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (conversationId) {
      window.localStorage.setItem(LS_KEY, conversationId);
    } else {
      window.localStorage.removeItem(LS_KEY);
    }
  }, [conversationId]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const chatFn = httpsCallable<
        {
          message: string;
          mode: string;
          companyId: string;
          conversationId?: string;
          context?: Record<string, unknown>;
          conversationHistory: { role: string; content: string }[];
        },
        { response: string; conversationId?: string }
      >(functions, 'assistantChat');

      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const result = await chatFn({
        message: trimmed,
        mode: 'strategy_agent',
        companyId: STRATEGY_COMPANY_ID,
        conversationId: conversationId || undefined,
        context: pageContext ? { pageContext } : undefined,
        conversationHistory: history,
      });

      const raw = result.data.response || '(no response)';
      const { displayText, actions } = extractActions(raw);
      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: displayText || '(no response)',
        ts: Date.now(),
        actions: actions.length > 0 ? actions : undefined,
        actionExecutions: actions.length > 0 ? {} : undefined,
      };
      setMessages((prev) => [...prev, aiMsg]);
      if (result.data.conversationId) {
        setConversationId(result.data.conversationId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach the Strategy Assistant');
    } finally {
      setSending(false);
    }
  };

  /**
   * Execute a proposed action via the deployed agentExecuteTool callable.
   * Updates the message's per-action execution state so the UI can show
   * loading / success / error per chip without re-rendering the whole
   * conversation.
   */
  const executeAction = async (messageId: string, actionIndex: number) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              actionExecutions: {
                ...(m.actionExecutions || {}),
                [actionIndex]: { status: 'running' },
              },
            }
          : m
      )
    );
    const target = messages.find((m) => m.id === messageId);
    const action = target?.actions?.[actionIndex];
    if (!action) return;

    try {
      const fn = httpsCallable<
        { agentId: string; toolId: string; input: Record<string, unknown> },
        { ok: boolean; summary?: string; auditId?: string }
      >(functions, 'agentExecuteTool');
      const result = await fn({
        agentId: action.agentId,
        toolId: action.toolId,
        input: action.input,
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                actionExecutions: {
                  ...(m.actionExecutions || {}),
                  [actionIndex]: {
                    status: 'ok',
                    resultSummary: result.data.summary || 'Done',
                  },
                },
              }
            : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                actionExecutions: {
                  ...(m.actionExecutions || {}),
                  [actionIndex]: {
                    status: 'error',
                    errorMessage:
                      err instanceof Error ? err.message : 'Action failed',
                  },
                },
              }
            : m
        )
      );
    }
  };

  const runSweep = async () => {
    if (sweeping) return;
    setSweeping(true);
    setError(null);
    try {
      const sweepFn = httpsCallable<
        Record<string, never>,
        { ok: boolean; summary: { staleOKRs: number; atRiskKRs: number; staleKPIs: number; criticalAlerts: number; tasksCreated: number; tasksReopened: number; tasksUpdated: number; errors: number } }
      >(functions, 'strategyAgentRunNow');
      const result = await sweepFn({});
      const s = result.data.summary;
      const summaryText = `Ran a Strategy Agent sweep. Findings: ${s.staleOKRs} stale OKRs, ${s.atRiskKRs} off-track KRs, ${s.staleKPIs} stale KPIs, ${s.criticalAlerts} unresolved critical alerts. Tasks ${s.tasksCreated} new, ${s.tasksReopened} reopened, ${s.tasksUpdated} touched.${s.errors ? ` (${s.errors} errors)` : ''}`;
      setMessages((prev) => [
        ...prev,
        { id: `sys-${Date.now()}`, role: 'assistant', content: summaryText, ts: Date.now() },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Strategy Agent sweep failed');
    } finally {
      setSweeping(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all"
        aria-label="Open Strategy Assistant"
      >
        <Sparkles className="h-4 w-4" />
        <span className="text-[13px] font-medium">Strategy Assistant</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 w-[400px] max-w-[calc(100vw-2.5rem)] h-[600px] max-h-[calc(100vh-2.5rem)] flex flex-col bg-white rounded-xl border border-gray-200 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center gap-2 min-w-0">
          <div className="bg-blue-600 rounded-md p-1.5">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-gray-900 truncate">Strategy Assistant</h2>
            <p className="text-[10.5px] text-gray-500 truncate">
              Powered by Strategy Agent · AG-007
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={runSweep}
            disabled={sweeping}
            className="p-1.5 rounded hover:bg-white/50 text-gray-600 hover:text-gray-900 disabled:opacity-50"
            title="Run Strategy Agent sweep now"
            aria-label="Run sweep"
          >
            {sweeping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={reset}
            className="p-1.5 rounded hover:bg-white/50 text-gray-600 hover:text-gray-900"
            title="Start a new conversation"
            aria-label="Reset conversation"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1.5 rounded hover:bg-white/50 text-gray-600 hover:text-gray-900"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-blue-50 mb-3">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="text-[13.5px] font-medium text-gray-900 mb-1">
              Ask the Strategy Assistant
            </h3>
            <p className="text-[11.5px] text-gray-500 mb-4 max-w-[280px] mx-auto">
              I have live access to your OKRs, KPIs, scorecards, and the latest findings from
              the Strategy Agent.
            </p>
            <div className="grid grid-cols-1 gap-1.5 max-w-[280px] mx-auto">
              {QUICK_ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => send(a.prompt)}
                    className="inline-flex items-center gap-2 px-2.5 py-1.5 text-[11.5px] text-left text-gray-700 bg-white border border-gray-200 rounded-md hover:border-blue-300 hover:bg-blue-50/50 transition-colors group"
                  >
                    <Icon className="h-3 w-3 text-blue-600 flex-shrink-0" />
                    <span className="flex-1">{a.label}</span>
                    <ArrowRight className="h-3 w-3 text-gray-300 group-hover:text-blue-500" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onExecuteAction={(idx) => executeAction(m.id, idx)}
            />
          ))
        )}
        {sending && (
          <div className="flex items-center gap-2 text-[12px] text-gray-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Thinking…
          </div>
        )}
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about objectives, KPIs, or findings…"
            rows={2}
            className="flex-1 resize-none text-[12.5px]"
            disabled={sending}
          />
          <Button
            variant="primary"
            size="icon"
            onClick={() => send(input)}
            disabled={sending || !input.trim()}
            aria-label="Send"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-gray-400 inline-flex items-center gap-1">
          <Activity className="h-2.5 w-2.5" />
          Live context · {messages.length} message{messages.length === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  );
};

interface MessageBubbleProps {
  message: Message;
  onExecuteAction?: (actionIndex: number) => void | Promise<void>;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onExecuteAction }) => {
  const isUser = message.role === 'user';
  const actions = message.actions || [];
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1.5`}>
      <div
        className={`max-w-[88%] px-3 py-2 rounded-lg text-[12.5px] whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-900 rounded-bl-sm'
        }`}
      >
        {message.content}
      </div>
      {actions.length > 0 && !isUser && (
        <div className="w-full max-w-[88%] flex flex-col gap-1.5">
          {actions.map((action, idx) => (
            <ActionChip
              key={`${message.id}-action-${idx}`}
              action={action}
              execution={message.actionExecutions?.[idx]}
              onExecute={() => onExecuteAction?.(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ActionChipProps {
  action: ProposedAction;
  execution?: ActionExecution;
  onExecute: () => void;
}

const ActionChip: React.FC<ActionChipProps> = ({ action, execution, onExecute }) => {
  const status = execution?.status || 'pending';

  if (status === 'ok') {
    return (
      <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-md border border-green-200 bg-green-50">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-medium text-green-800 truncate">
            {execution?.resultSummary || 'Executed'}
          </p>
          <p className="text-[10px] text-green-700/70 truncate">
            via {action.agentId} · {action.toolId}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-md border border-red-200 bg-red-50">
        <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-medium text-red-800">
            {action.summary}
          </p>
          <p className="text-[10px] text-red-700 truncate">
            {execution?.errorMessage || 'Failed'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onExecute}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-md border border-blue-200 bg-blue-50/60">
      <Sparkles className="h-3.5 w-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-medium text-gray-900">{action.summary}</p>
        <p className="text-[10px] text-gray-500 truncate">
          via {action.agentId} · {action.toolId}
        </p>
      </div>
      <Button
        variant="primary"
        size="sm"
        onClick={onExecute}
        disabled={status === 'running'}
      >
        {status === 'running' ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Running…
          </>
        ) : (
          'Execute'
        )}
      </Button>
    </div>
  );
};

export default StrategyAssistantPanel;
