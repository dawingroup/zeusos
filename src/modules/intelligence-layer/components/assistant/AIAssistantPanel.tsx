/**
 * The assistant: inline in the shell's context rail, or embedded as the full
 * page. The conversation lives in useAssistantChat; this is only its surface.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Brain, History, Plus } from 'lucide-react';

import { ASSISTANT_MODES, type AssistantModeId } from '../../constants';
import { AssistantMessageView } from './AssistantMessageView';
import { useAssistantChat } from './useAssistantChat';
import './assistant.css';

const SUGGESTIONS = [
  'Which IWOs are overheating this week?',
  'Summarise the deals pipeline by stage',
  'Draft a task to chase the overdue client invoices',
];

interface AIAssistantPanelProps {
  open: boolean;
  onClose: () => void;
  initialMode?: AssistantModeId;
  context?: Record<string, unknown>;
  companyId?: string;
  /** 'rail' = inline in the shell's context rail (default); 'full' = the page. */
  variant?: 'rail' | 'full';
}

export const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
  open,
  initialMode = 'cross_module',
  context,
  // The group brain by default: the assistant spans all brands.
  companyId = 'zeus-group',
  variant = 'rail',
}) => {
  const [mode, setMode] = useState<AssistantModeId>(initialMode);
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, isTyping, memoryCount, conversationId, recentConversations, send, executeAction, newChat, openThread } =
    useAssistantChat({ companyId, mode, context, autoLoad: open });

  // Follow the tail.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (open && variant === 'rail') inputRef.current?.focus();
  }, [open, variant]);

  if (!open) return null;

  const submit = () => {
    const text = input;
    if (!text.trim() || isTyping) return;
    setInput('');
    void send(text);
  };

  return (
    <div className="ai-panel" data-variant={variant} data-testid="ai-panel">
      <div className="ai-head">
        <select className="ai-mode" aria-label="Assistant mode" value={mode} onChange={(e) => setMode(e.target.value as AssistantModeId)}>
          {ASSISTANT_MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        {memoryCount > 0 && (
          <span className="ai-mem" title={`${memoryCount} business memories in use`}>
            <Brain className="h-3 w-3" aria-hidden="true" />
            {memoryCount}
          </span>
        )}
        <button
          type="button"
          className="ai-iconbtn"
          title="Past conversations"
          aria-label="Past conversations"
          aria-expanded={showHistory}
          onClick={() => setShowHistory((s) => !s)}
        >
          <History className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="ai-iconbtn"
          title="New conversation"
          aria-label="New conversation"
          onClick={() => {
            setShowHistory(false);
            void newChat();
          }}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {showHistory && (
        <div className="ai-history">
          {recentConversations.length === 0 && <div className="ai-history-empty">No past conversations yet.</div>}
          {recentConversations.map((c) => (
            <button
              key={c.id}
              type="button"
              className="ai-history-row"
              data-active={c.id === conversationId || undefined}
              title={c.title}
              onClick={() => {
                openThread(c.id);
                setShowHistory(false);
              }}
            >
              {c.title}
            </button>
          ))}
        </div>
      )}

      <div ref={threadRef} className="ai-thread" aria-live="polite">
        {messages.length === 0 && (
          <div className="ai-empty">
            <div className="ai-empty-title">Ask ZeusOS</div>
            Answers come from live data where a tool reaches it.
            <div className="ai-suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <AssistantMessageView
            key={m.id}
            message={m}
            workingLabel={mode === 'cross_module' ? 'Querying across modules' : 'Thinking'}
            onRunAction={(id, i) => void executeAction(id, i)}
          />
        ))}
      </div>

      <div className="ai-composer">
        <textarea
          ref={inputRef}
          placeholder="Ask anything…"
          aria-label="Message the assistant"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="ai-composer-row">
          <span className="ai-composer-hint">Enter to send · Shift+Enter for a new line</span>
          <button type="button" className="ai-send" onClick={submit} disabled={!input.trim() || isTyping}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantPanel;
