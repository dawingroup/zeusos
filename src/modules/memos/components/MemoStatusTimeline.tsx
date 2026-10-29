import type { MemoStatusEvent } from '../types/memo';
import { MEMO_STATUS_LABELS } from '../constants/memoTemplates';
import { formatMemoDate } from './memoUi';

export function MemoStatusTimeline({ history }: { history: MemoStatusEvent[] }) {
  if (!history?.length) return null;
  return (
    <ol className="space-y-2 text-sm">
      {[...history].reverse().map((e, i) => (
        <li key={i} className="flex gap-3">
          <span className="w-28 shrink-0 text-xs" style={{ color: 'var(--fg-tertiary)' }}>{formatMemoDate(e.at)}</span>
          <span>
            <span className="font-medium" style={{ color: 'var(--fg-primary)' }}>{MEMO_STATUS_LABELS[e.to]}</span>
            <span style={{ color: 'var(--fg-secondary)' }}> · {e.byName}</span>
            {e.note && <span className="block text-xs" style={{ color: 'var(--fg-tertiary)' }}>{e.note}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
