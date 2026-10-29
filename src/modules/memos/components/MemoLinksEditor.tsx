/**
 * The records a memo is about: a record type from the shared route registry,
 * its id, a label the reader recognises, and whether the memo authorises it
 * or is context. `<RecordRef>` resolves the live label when the type has one.
 */
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { RECORD_TYPE_NOUN, RecordLink, resolveRecordTarget, type RecordEntityType } from '@/shared/navigation';
import type { MemoLink, MemoLinkRelation } from '../types/memo';

const RELATION_LABELS: Record<MemoLinkRelation, string> = {
  authorises: 'This memo authorises it',
  context: 'Context',
  supersedes: 'This memo supersedes it',
};

const LINKABLE: RecordEntityType[] = [
  'masterJob', 'iwo', 'client', 'msa', 'sow', 'changeOrder', 'quote', 'clientInvoice', 'intercompanyInvoice',
  'purchaseOrder', 'journalEntry', 'supplier', 'employee', 'roleProfile', 'mediaPlan', 'productionJob', 'talentProfile',
  'lead', 'asset', 'objective', 'kpi', 'memo',
];

export function memoLinkTypeLabel(type: MemoLink['type']): string {
  return type === 'other' ? 'Other' : RECORD_TYPE_NOUN[type] ?? type;
}

export function MemoLinkView({ link }: { link: MemoLink }) {
  if (link.type === 'other') {
    return link.href ? <a href={link.href} target="_blank" rel="noreferrer" className="underline">{link.label}</a> : <span>{link.label}</span>;
  }
  const target = resolveRecordTarget(link.type, { id: link.id, clientId: link.clientId, msaId: link.msaId, sowId: link.sowId });
  if (!target.path) return <span>{link.label}</span>;
  return <RecordLink type={link.type} id={link.id} clientId={link.clientId} msaId={link.msaId} sowId={link.sowId}>{link.label}</RecordLink>;
}

interface Props { links: MemoLink[]; onChange: (next: MemoLink[]) => void; disabled?: boolean }

export function MemoLinksEditor({ links, onChange, disabled }: Props) {
  const [type, setType] = useState<MemoLink['type']>('masterJob');
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [relation, setRelation] = useState<MemoLinkRelation>('context');
  const [href, setHref] = useState('');

  const add = () => {
    const cleanId = id.trim();
    const cleanLabel = label.trim() || cleanId;
    if (!cleanId || !cleanLabel) return;
    if (links.some((l) => l.type === type && l.id === cleanId)) return;
    const link: MemoLink = { type, id: cleanId, label: cleanLabel, relation };
    if (type === 'other' && href.trim()) link.href = href.trim();
    onChange([...links, link]);
    setId(''); setLabel(''); setHref('');
  };

  return (
    <div className="card space-y-3" style={{ padding: 20 }}>
      {links.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--fg-tertiary)' }}>No records linked yet.</p>
      ) : (
        <ul className="divide-y text-sm" style={{ borderColor: 'var(--border-subtle)' }}>
          {links.map((l, i) => (
            <li key={`${l.type}-${l.id}-${i}`} className="flex items-center gap-2 py-2">
              <span className="rounded px-1.5 py-0.5 text-[10.5px] uppercase tracking-wide" style={{ background: 'var(--bg-sunken)', color: 'var(--fg-tertiary)' }}>{l.relation}</span>
              <MemoLinkView link={l} />
              <span className="text-xs" style={{ color: 'var(--fg-tertiary)' }}>{memoLinkTypeLabel(l.type)}</span>
              {!disabled && (
                <button type="button" aria-label={`Remove link ${l.label}`} className="ml-auto" style={{ color: 'var(--fg-tertiary)' }} onClick={() => onChange(links.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <div className="grid gap-2 sm:grid-cols-5" data-testid="memo-link-form">
          <div>
            <Label className="text-xs">Record</Label>
            <Select value={type} onValueChange={(v) => setType(v as MemoLink['type'])}>
              <SelectTrigger className="h-9" aria-label="Record type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LINKABLE.map((t) => <SelectItem key={t} value={t}>{RECORD_TYPE_NOUN[t]}</SelectItem>)}
                <SelectItem value="other">Other (link)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs" htmlFor="memo-link-id">{type === 'other' ? 'Reference' : 'Record id / code'}</Label>
            <Input id="memo-link-id" className="h-9" value={id} onChange={(e) => setId(e.target.value)} placeholder={type === 'other' ? 'e.g. contract-2026-07' : 'Paste the id from the record page'} />
          </div>
          <div>
            <Label className="text-xs" htmlFor="memo-link-label">Label</Label>
            <Input id="memo-link-label" className="h-9" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="How the reader knows it" />
          </div>
          <div>
            <Label className="text-xs">Relation</Label>
            <Select value={relation} onValueChange={(v) => setRelation(v as MemoLinkRelation)}>
              <SelectTrigger className="h-9" aria-label="Relation"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(RELATION_LABELS) as MemoLinkRelation[]).map((r) => <SelectItem key={r} value={r}>{RELATION_LABELS[r]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            {type === 'other' && <Input className="h-9" value={href} onChange={(e) => setHref(e.target.value)} placeholder="https://…" aria-label="Link URL" />}
            <Button type="button" variant="outline" size="sm" onClick={add} disabled={!id.trim()}>Add</Button>
          </div>
        </div>
      )}
    </div>
  );
}
