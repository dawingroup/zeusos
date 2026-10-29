/**
 * Tiny dependency-free toast bus.
 *
 * A module-level pub/sub so ANY code — services, hooks, the optimistic-write
 * reporter — can surface an ephemeral toast without threading a context through
 * every call site. `<ToastHost>` (mounted once in AppShell) subscribes and
 * renders. Kept deliberately minimal: no external dependency, no portal library.
 */

export type ToastTone = 'error' | 'success' | 'info';

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
  /** Auto-dismiss after this many ms (0 = sticky until dismissed). */
  durationMs: number;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();
let seq = 0;

function emit(): void {
  for (const l of listeners) l(toasts);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
}

export function dismissToast(id: string): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export interface PushToastOptions {
  tone?: ToastTone;
  /** ms before auto-dismiss; defaults: errors 8000, others 4000. 0 = sticky. */
  durationMs?: number;
  /**
   * Collapse into an existing toast with the same message+tone (default true).
   * Pass false for a toast you intend to drive with {@link updateToast} — a
   * progress toast must own its id, not inherit one from an earlier run.
   */
  dedupe?: boolean;
}

export function pushToast(message: string, opts: PushToastOptions = {}): string {
  const tone: ToastTone = opts.tone ?? 'info';
  const durationMs = opts.durationMs ?? (tone === 'error' ? 8000 : 4000);
  // Collapse a burst of identical messages (e.g. a rejected bulk write firing
  // many failures) into one toast so the corner isn't flooded.
  if (opts.dedupe !== false) {
    const existing = toasts.find((t) => t.message === message && t.tone === tone);
    if (existing) return existing.id;
  }
  const id = `toast-${++seq}`;
  toasts = [...toasts, { id, message, tone, durationMs }];
  emit();
  return id;
}

/**
 * Rewrite a live toast in place — for long jobs that report progress through
 * one toast instead of stacking a new card per step.
 *
 * Returns false when the id is gone (the user dismissed it, or it auto-
 * expired) and nothing was written. Progress ticks can ignore that; a final
 * outcome the user still needs to see should use {@link upsertToast}.
 */
export function updateToast(
  id: string,
  patch: { message?: string; tone?: ToastTone; durationMs?: number },
): boolean {
  const idx = toasts.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  toasts = toasts.map((t, i) => (i === idx ? { ...t, ...patch } : t));
  emit();
  return true;
}

/**
 * Rewrite a live toast, or raise a fresh one if it is already gone.
 *
 * For the FINAL outcome of a long job: dismissing the progress card should
 * not mean never being told the job failed.
 */
export function upsertToast(
  id: string,
  message: string,
  opts: PushToastOptions = {},
): string {
  if (updateToast(id, { message, tone: opts.tone, durationMs: opts.durationMs })) {
    return id;
  }
  return pushToast(message, { ...opts, dedupe: false });
}
