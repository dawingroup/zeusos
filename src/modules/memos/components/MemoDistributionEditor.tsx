/**
 * Who receives the issued memo, and who must acknowledge it. Recipients need
 * no module grant — being named here is what lets them read the memo.
 */
import { Trash2 } from 'lucide-react';
import { Checkbox } from '@/core/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { EmployeePicker } from '@/shared/people';
import type { MemoRecipient, MemoRecipientRole } from '../types/memo';

export const RECIPIENT_ROLE_LABELS: Record<MemoRecipientRole, string> = {
  to: 'Addressee',
  through: 'Clearance',
  cc: 'Copy',
  ack: 'Must acknowledge',
};

interface Props {
  distribution: MemoRecipient[];
  onChange: (next: MemoRecipient[]) => void;
  disabled?: boolean;
  /** Directives default new recipients to "must acknowledge". */
  defaultRequiresAck?: boolean;
}

export function MemoDistributionEditor({ distribution, onChange, disabled, defaultRequiresAck }: Props) {
  const present = new Set(distribution.map((r) => r.uid));
  const update = (uid: string, patch: Partial<MemoRecipient>) => onChange(distribution.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      {distribution.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--fg-tertiary)' }}>
              <th className="py-1 font-normal">Recipient</th>
              <th className="py-1 font-normal">Role</th>
              <th className="py-1 font-normal">Acknowledge</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {distribution.map((r) => (
              <tr key={r.uid} className="border-t" style={{ borderColor: 'var(--border-default)' }}>
                <td className="py-1.5">{r.name}{r.email ? <span className="ml-1 text-xs" style={{ color: 'var(--fg-tertiary)' }}>{r.email}</span> : null}</td>
                <td className="py-1.5">
                  <Select value={r.role} disabled={disabled} onValueChange={(v) => update(r.uid, { role: v as MemoRecipientRole, requiresAck: v === 'ack' ? true : r.requiresAck })}>
                    <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(RECIPIENT_ROLE_LABELS) as MemoRecipientRole[]).map((k) => <SelectItem key={k} value={k}>{RECIPIENT_ROLE_LABELS[k]}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="py-1.5">
                  <Checkbox checked={r.requiresAck} disabled={disabled} aria-label={`${r.name} must acknowledge`} onCheckedChange={(c) => update(r.uid, { requiresAck: c === true })} />
                </td>
                <td className="py-1.5 text-right">
                  {!disabled && (
                    <button type="button" aria-label={`Remove ${r.name}`} style={{ color: 'var(--fg-tertiary)' }} onClick={() => onChange(distribution.filter((x) => x.uid !== r.uid))}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!disabled && (
        <div style={{ maxWidth: 320 }}>
          <EmployeePicker
            value={null}
            placeholder="Add a recipient…"
            onChange={(p) => {
              if (!p?.uid || present.has(p.uid)) return;
              onChange([...distribution, { uid: p.uid, name: p.name, email: p.email, role: defaultRequiresAck ? 'ack' : 'cc', requiresAck: Boolean(defaultRequiresAck) }]);
            }}
          />
          <p className="mt-1 text-xs" style={{ color: 'var(--fg-tertiary)' }}>Only people with a ZeusOS login can be on the distribution — they are told when the memo issues.</p>
        </div>
      )}
    </div>
  );
}
