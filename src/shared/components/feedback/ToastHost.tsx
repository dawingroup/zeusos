/**
 * ToastHost — renders the toast bus and connects the global optimistic-write
 * reporter to it.
 *
 * Mounted once in AppShell. It:
 *  1. subscribes to {@link subscribeToasts} and renders the stack, and
 *  2. registers a {@link setOptimisticWriteReporter} that turns a genuine
 *     background-write rejection (rules denial, validation) into a visible
 *     error toast, so a failed background save never passes in silence.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { subscribeToasts, dismissToast, pushToast, type Toast, type ToastTone } from './toastBus';
import { setOptimisticWriteReporter } from '@/shared/services/firebase/optimisticWrite';

const TONE_STYLE: Record<ToastTone, { bg: string; border: string; fg: string; Icon: typeof AlertTriangle }> = {
  error: { bg: 'var(--rag-red-soft)', border: 'var(--rag-red)', fg: 'var(--fg-primary)', Icon: AlertTriangle },
  success: { bg: 'var(--rag-green-soft)', border: 'var(--rag-green)', fg: 'var(--fg-primary)', Icon: CheckCircle },
  info: { bg: 'var(--bg-surface)', border: 'var(--border-strong)', fg: 'var(--fg-primary)', Icon: Info },
};

function ToastCard({ toast }: { toast: Toast }) {
  useEffect(() => {
    if (toast.durationMs <= 0) return;
    const t = setTimeout(() => dismissToast(toast.id), toast.durationMs);
    return () => clearTimeout(t);
  }, [toast.id, toast.durationMs]);

  const s = TONE_STYLE[toast.tone];
  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        maxWidth: 380,
        padding: '10px 12px',
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
        color: s.fg,
        fontSize: 13,
        lineHeight: 1.4,
      }}
    >
      <s.Icon className="w-4 h-4" style={{ color: s.border, flexShrink: 0, marginTop: 1 }} />
      <span style={{ flex: 1, wordBreak: 'break-word' }}>{toast.message}</span>
      <button
        onClick={() => dismissToast(toast.id)}
        aria-label="Dismiss notification"
        style={{ flexShrink: 0, color: 'var(--fg-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  // Route genuine background-sync failures to a visible toast. Only real
  // rejections (rules/validation) reach the reporter — transient channel stalls
  // stay pending and retry, so this won't cry wolf on a flaky network.
  useEffect(() => {
    setOptimisticWriteReporter((err, label) => {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`[optimistic-write] background sync failed: ${label}`, err);
      pushToast(`Couldn't save (${label}). ${detail}`, { tone: 'error' });
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <ToastCard toast={t} />
        </div>
      ))}
    </div>
  );
}

export default ToastHost;
