/**
 * One turn: the person's bubble, or the answer with its proposed actions.
 * Only what works is on it: there is no feedback or save button that goes nowhere.
 */
import { useEffect, useState } from 'react';
import { Check, CheckCircle2, ChevronRight, Copy, Loader2 } from 'lucide-react';

import { ActionInputPreview } from './ActionInputPreview';
import { AssistantRichText } from './AssistantRichText';
import type { ProposedAction } from './assistantActions';
import type { ActionExecution, ChatMessage } from './useAssistantChat';

function ActionChip({
  action,
  execution,
  historical,
  onRun,
}: {
  action: ProposedAction;
  execution?: ActionExecution;
  historical?: boolean;
  onRun: () => void;
}) {
  if (execution?.status === 'ok') {
    return (
      <div className="ai-chip-ok">
        <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        <span>{execution.resultSummary}</span>
      </div>
    );
  }
  const running = execution?.status === 'running';
  return (
    <div className="ai-chip-card">
      <div className="ai-chip-kind">{historical ? 'Proposed earlier' : 'Proposed action'}</div>
      <div className="ai-chip-title">{action.summary}</div>
      <ActionInputPreview input={action.input} />
      {execution?.status === 'error' && (
        <div className="ai-chip-bad" role="alert">
          {execution.errorMessage}
        </div>
      )}
      <div className="ai-chip-row">
        <span className="ai-chip-via">
          {action.agentId} · {action.toolId}
        </span>
        {historical ? null : (
          <button type="button" className="ai-chip-run" onClick={onRun} disabled={running}>
            {running ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <ChevronRight className="h-3 w-3" aria-hidden="true" />}
            {running ? 'Running…' : execution?.status === 'error' ? 'Retry' : 'Confirm & run'}
          </button>
        )}
      </div>
    </div>
  );
}

function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    setSeconds(0);
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return seconds;
}

export interface AssistantMessageViewProps {
  message: ChatMessage;
  workingLabel?: string;
  onRunAction: (messageId: string, index: number) => void;
}

export function AssistantMessageView({ message, workingLabel = 'Thinking', onRunAction }: AssistantMessageViewProps) {
  const [copied, setCopied] = useState(false);
  const seconds = useElapsedSeconds(!!message.running);

  if (message.role === 'user') return <div className="ai-msg-me">{message.content}</div>;

  if (message.running) {
    return (
      <div className="ai-working" role="status">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        {workingLabel}…{seconds > 2 ? ` ${seconds}s` : ''}
      </div>
    );
  }

  if (message.failed) {
    return (
      <div className="ai-msg-err" role="alert">
        {message.displayText}
      </div>
    );
  }

  const body = message.displayText ?? message.content;
  const copy = () => {
    navigator.clipboard?.writeText(body).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  };

  return (
    <div className="ai-msg-ai">
      {body && <AssistantRichText text={body} />}
      {message.actions?.map((action, i) => (
        <ActionChip
          key={`${message.id}-${i}`}
          action={action}
          execution={message.executions?.[i]}
          historical={message.historical}
          onRun={() => onRunAction(message.id, i)}
        />
      ))}
      {body && (
        <div className="ai-foot">
          <span className="ai-foot-note">AI answer · verify before acting</span>
          <button type="button" className="ai-iconbtn" title="Copy" aria-label="Copy answer" onClick={copy}>
            {copied ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
          </button>
        </div>
      )}
    </div>
  );
}

export default AssistantMessageView;
