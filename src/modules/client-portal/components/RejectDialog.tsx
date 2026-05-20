import { useEffect, useRef, useState } from 'react';
import { Btn, Eyebrow, Mono, SignalLine } from './primitives';
import { Icon } from './Icon';

interface RejectDialogProps {
  open: boolean;
  title: string;
  /** Friendly description shown above the textarea. */
  description?: string;
  /** Heading for the confirm action ("Reject" / "Sign & approve" etc). */
  confirmLabel: string;
  /** Visual signal styling on confirm button (red). Default false. */
  confirmSignal?: boolean;
  /** Default false → confirm button is primary black. */
  confirmPrimary?: boolean;
  /** Whether a reason is required before confirming. */
  reasonRequired: boolean;
  /** Placeholder text for the reason textarea. */
  reasonPlaceholder?: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

/**
 * Minimal-but-considered confirmation dialog used for portal write
 * actions on the Approvals screen. Captures an optional/required
 * reason, surfaces async errors inline, disables itself while a
 * write is in flight.
 */
export function RejectDialog({
  open, title, description, confirmLabel, confirmSignal, confirmPrimary,
  reasonRequired, reasonPlaceholder, onClose, onConfirm,
}: RejectDialogProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Reset state on every fresh open.
  useEffect(() => {
    if (open) {
      setReason('');
      setSubmitting(false);
      setError(null);
      // Focus after the paint so the autoFocus prop actually lands.
      setTimeout(() => textareaRef.current?.focus(), 30);
    }
  }, [open]);

  // ESC to close.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const canConfirm = !submitting && (!reasonRequired || reason.trim().length >= 3);

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Something went wrong.');
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="portal-reject-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(20,18,14,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={() => { if (!submitting) onClose(); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 40px 80px -30px rgba(20,18,14,0.45)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {confirmSignal ? <SignalLine>Confirm rejection</SignalLine> : <Eyebrow>Confirm action</Eyebrow>}
            <div id="portal-reject-title" className="h-d4" style={{ marginTop: 2 }}>{title}</div>
          </div>
          <button
            onClick={() => { if (!submitting) onClose(); }}
            style={{
              background: 'transparent',
              border: 0,
              cursor: submitting ? 'not-allowed' : 'pointer',
              color: 'var(--ink-3)',
              padding: 4,
              display: 'flex',
            }}
            aria-label="Close"
          ><Icon name="x" size={20} /></button>
        </div>

        {description ? (
          <div className="h-p is-dim" style={{ fontSize: 13 }}>{description}</div>
        ) : null}

        <div>
          <Eyebrow style={{ marginBottom: 8 }}>
            {reasonRequired ? 'Reason (required)' : 'Note for the team (optional)'}
          </Eyebrow>
          <textarea
            ref={textareaRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder || (reasonRequired
              ? 'Help the team understand what needs to change…'
              : 'Anything you\'d like the team to know…')}
            rows={4}
            disabled={submitting}
            style={{
              width: '100%',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: '12px 14px',
              font: '400 13px/1.45 var(--font-sans)',
              color: 'var(--ink)',
              background: 'var(--paper)',
              resize: 'vertical',
              minHeight: 92,
              outline: 'none',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--ink-2)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--line)'; }}
          />
          <Mono style={{ color: 'var(--ink-3)', display: 'block', marginTop: 6 }}>
            {reasonRequired
              ? `${reason.trim().length}/3+ characters · captured in the audit trail`
              : 'Captured in the audit trail if provided.'}
          </Mono>
        </div>

        {error ? (
          <div style={{
            background: 'var(--signal-bg)',
            border: '1px solid var(--signal-tint)',
            borderRadius: 10,
            padding: '10px 14px',
            color: 'var(--signal)',
            font: '500 12px/1.45 var(--font-sans)',
          }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <Btn sm onClick={onClose} disabled={submitting}>Cancel</Btn>
          <Btn
            sm
            signal={confirmSignal}
            primary={confirmPrimary && !confirmSignal}
            onClick={handleConfirm}
            disabled={!canConfirm}
            iconRight={confirmSignal ? undefined : 'check'}
          >
            {submitting ? 'Working…' : confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
}
