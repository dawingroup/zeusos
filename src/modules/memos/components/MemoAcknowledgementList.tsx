/**
 * Distribution with acknowledgement state; the current recipient gets an
 * "Acknowledge" button on an issued memo.
 */
import { useState } from 'react';
import { Button } from '@/core/components/ui/button';
import { describeCallableError } from '@/shared/utils/callableError';
import type { Memo, MemoActor } from '../types/memo';
import { acknowledgeMemo } from '../services/memoActions';
import { RECIPIENT_ROLE_LABELS } from './MemoDistributionEditor';
import { formatMemoDate } from './memoUi';

export function MemoAcknowledgementList({ memo, actor }: { memo: Memo; actor: MemoActor | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!memo.distribution.length) return <p className="text-sm" style={{ color: 'var(--fg-tertiary)' }}>No distribution list.</p>;

  const mine = actor ? memo.distribution.find((r) => r.uid === actor.uid) : undefined;
  const acked = actor ? memo.acknowledgements?.[actor.uid] : undefined;
  const pending = memo.distribution.filter((r) => r.requiresAck && !memo.acknowledgements?.[r.uid]).length;

  return (
    <div className="space-y-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--fg-tertiary)' }}>
            <th className="py-1 font-normal">Recipient</th>
            <th className="py-1 font-normal">Role</th>
            <th className="py-1 font-normal">Acknowledged</th>
          </tr>
        </thead>
        <tbody>
          {memo.distribution.map((r) => {
            const ack = memo.acknowledgements?.[r.uid];
            return (
              <tr key={r.uid} className="border-t" style={{ borderColor: 'var(--border-default)' }}>
                <td className="py-1.5">{r.name}</td>
                <td className="py-1.5" style={{ color: 'var(--fg-secondary)' }}>{RECIPIENT_ROLE_LABELS[r.role] ?? r.role}</td>
                <td className="py-1.5">{ack ? formatMemoDate(ack.at) : r.requiresAck ? <span style={{ color: 'var(--rag-amber)' }}>Pending</span> : <span style={{ color: 'var(--fg-tertiary)' }}>—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {memo.status === 'issued' && pending > 0 && <p className="text-xs" style={{ color: 'var(--fg-tertiary)' }}>{pending} acknowledgement{pending === 1 ? '' : 's'} outstanding.</p>}
      {memo.status === 'issued' && mine && !acked && actor && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try { await acknowledgeMemo(memo.id); } catch (e) { setError(describeCallableError(e, 'acknowledge the memo')); } finally { setBusy(false); }
            }}
          >
            Acknowledge this memo
          </Button>
          {error && <span className="text-xs" style={{ color: 'var(--rag-red)' }}>{error}</span>}
        </div>
      )}
    </div>
  );
}
