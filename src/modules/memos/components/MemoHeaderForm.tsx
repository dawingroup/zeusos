/**
 * The memo's header: what kind of memo, who it is to / from / through / cc,
 * the amount it is about, and its subject. Everything here freezes on submit.
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Checkbox } from '@/core/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { EmployeePicker, type PickedPerson } from '@/shared/people';
import type { MemoCategory, MemoHeader, MemoImpact, MemoParty, MemoType } from '../types/memo';
import {
  MEMO_CATEGORIES,
  MEMO_CATEGORY_LABELS,
  MEMO_CURRENCIES,
  MEMO_IMPACTS,
  MEMO_IMPACT_HINTS,
  MEMO_IMPACT_LABELS,
  MEMO_TYPES,
  MEMO_TYPE_HINTS,
  MEMO_TYPE_LABELS,
} from '../constants/memoTemplates';

export interface MemoHeaderValues {
  type: MemoType;
  category: MemoCategory;
  impact: MemoImpact;
  confidential: boolean;
  subject: string;
  externalRef: string;
  /** Major units as typed; converted to minor units on save. */
  amount: string;
  currency: string;
  header: MemoHeader;
}

interface Props {
  value: MemoHeaderValues;
  onChange: (patch: Partial<MemoHeaderValues>) => void;
  disabled?: boolean;
}

/** A picked person as a header party — the uid is what lets them receive a task. */
export function partyFromPick(p: PickedPerson): MemoParty {
  const party: MemoParty = { name: p.name };
  if (p.uid) party.uid = p.uid;
  if (p.email) party.email = p.email;
  return party;
}

/**
 * Pick people from the shared directory, or type a name for someone who is
 * not a ZeusOS user (a board member, an external auditor).
 */
export function PartyListEditor({ label, parties, onChange, disabled, single, hint }: {
  label: string;
  parties: MemoParty[];
  onChange: (next: MemoParty[]) => void;
  disabled?: boolean;
  single?: boolean;
  hint?: string;
}) {
  const [text, setText] = useState('');
  const chosen = new Set(parties.map((p) => p.uid ?? p.name));
  const add = (p: MemoParty) => {
    if (chosen.has(p.uid ?? p.name)) return;
    onChange(single ? [p] : [...parties, p]);
    setText('');
  };

  return (
    <div>
      <Label className="text-xs uppercase tracking-wide" style={{ color: 'var(--fg-tertiary)' }}>{label}</Label>
      {hint && <p className="text-xs" style={{ color: 'var(--fg-tertiary)' }}>{hint}</p>}
      <div className="mt-1 flex flex-wrap gap-1.5">
        {parties.map((p, i) => (
          <span key={`${p.uid ?? p.name}-${i}`} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm" style={{ background: 'var(--bg-sunken)', color: 'var(--fg-primary)' }} data-party={p.uid ?? 'typed'}>
            {p.name}
            {p.title ? <span style={{ color: 'var(--fg-tertiary)' }}>· {p.title}</span> : null}
            {!p.uid && <span className="text-tiny" title="No ZeusOS login — cannot receive a task" style={{ color: 'var(--rag-amber)' }}>typed</span>}
            {!disabled && (
              <button type="button" aria-label={`Remove ${p.name}`} className="ml-0.5 rounded-full p-0.5 hover:bg-black/10" onClick={() => onChange(parties.filter((_, j) => j !== i))}>
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (!single || parties.length === 0) && (
        <div className="mt-1.5 flex flex-wrap gap-2">
          <div style={{ minWidth: 240 }}>
            <EmployeePicker value={null} placeholder="Pick from the directory…" onChange={(p) => { if (p) add(partyFromPick(p)); }} />
          </div>
          <Input
            className="h-9 w-64"
            placeholder="…or type a name, press Enter"
            value={text}
            aria-label={`${label} — type a name`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && text.trim()) {
                e.preventDefault();
                const [name, title] = text.split(',').map((s) => s.trim());
                add(title ? { name, title } : { name });
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

export function MemoHeaderForm({ value, onChange, disabled }: Props) {
  const setHeader = (patch: Partial<MemoHeader>) => onChange({ header: { ...value.header, ...patch } });

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="memo-type">Memo type</Label>
          <Select value={value.type} onValueChange={(v) => onChange({ type: v as MemoType })} disabled={disabled}>
            <SelectTrigger id="memo-type"><SelectValue /></SelectTrigger>
            <SelectContent>{MEMO_TYPES.map((t) => <SelectItem key={t} value={t}>{MEMO_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
          </Select>
          <p className="mt-1 text-xs" style={{ color: 'var(--fg-tertiary)' }}>{MEMO_TYPE_HINTS[value.type]}</p>
        </div>
        <div>
          <Label htmlFor="memo-category">Category</Label>
          <Select value={value.category} onValueChange={(v) => onChange({ category: v as MemoCategory })} disabled={disabled}>
            <SelectTrigger id="memo-category"><SelectValue /></SelectTrigger>
            <SelectContent>{MEMO_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{MEMO_CATEGORY_LABELS[c]}</SelectItem>)}</SelectContent>
          </Select>
          <p className="mt-1 text-xs" style={{ color: 'var(--fg-tertiary)' }}>Chooses which amount ladder applies, when one is configured.</p>
        </div>
        <div>
          <Label htmlFor="memo-impact">Impact</Label>
          <Select value={value.impact} onValueChange={(v) => onChange({ impact: v as MemoImpact })} disabled={disabled}>
            <SelectTrigger id="memo-impact"><SelectValue /></SelectTrigger>
            <SelectContent>{MEMO_IMPACTS.map((i) => <SelectItem key={i} value={i}>{MEMO_IMPACT_LABELS[i]}</SelectItem>)}</SelectContent>
          </Select>
          <p className="mt-1 text-xs" style={{ color: 'var(--fg-tertiary)' }}>{MEMO_IMPACT_HINTS[value.impact]}</p>
        </div>
      </div>

      <div>
        <Label htmlFor="memo-subject">Subject</Label>
        <Input id="memo-subject" value={value.subject} disabled={disabled} placeholder="e.g. Generator hire for the Diageo shoot — six weeks" onChange={(e) => onChange({ subject: e.target.value })} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Label htmlFor="memo-amount">Amount the memo is about</Label>
          <div className="flex gap-2">
            <Select value={value.currency} onValueChange={(v) => onChange({ currency: v })} disabled={disabled}>
              <SelectTrigger className="w-24" aria-label="Currency"><SelectValue /></SelectTrigger>
              <SelectContent>{MEMO_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Input id="memo-amount" type="number" inputMode="decimal" min={0} value={value.amount} disabled={disabled} placeholder="Leave blank if none" onChange={(e) => onChange({ amount: e.target.value })} />
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--fg-tertiary)' }}>Compared against the approval bands as entered — no currency conversion.</p>
        </div>
        <div>
          <Label htmlFor="memo-date">Date</Label>
          <Input id="memo-date" type="date" value={value.header.date} disabled={disabled} onChange={(e) => setHeader({ date: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="memo-ref">External ref</Label>
          <Input id="memo-ref" value={value.externalRef} disabled={disabled} placeholder="Optional" onChange={(e) => onChange({ externalRef: e.target.value })} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PartyListEditor label="To — decides it" parties={value.header.to} onChange={(to) => setHeader({ to })} disabled={disabled} />
        <PartyListEditor label="From" parties={[value.header.from]} onChange={(f) => f[0] && setHeader({ from: f[0] })} disabled={disabled} single />
        <PartyListEditor label="Through — clears it first, in this order" parties={value.header.through} onChange={(through) => setHeader({ through })} disabled={disabled} />
        <PartyListEditor label="Cc" parties={value.header.cc} onChange={(cc) => setHeader({ cc })} disabled={disabled} />
      </div>

      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--fg-secondary)' }}>
        <Checkbox checked={value.confidential} disabled={disabled} onCheckedChange={(c) => onChange({ confidential: c === true })} />
        Confidential — visible only to the people named on it and to admins
      </label>
    </div>
  );
}
