/**
 * Memo register — the file of every memo in the current brand's scope, plus
 * the two personal views: what I wrote, and what is waiting on me.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { Banner, EmptyStateV2 as EmptyState } from '@/shared/components/data-display';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import { useMemos } from '../hooks/useMemos';
import { useMemoActor } from '../hooks/useMemoActor';
import type { Memo, MemoCategory, MemoFilters, MemoStatus, MemoType } from '../types/memo';
import { MEMO_CATEGORIES, MEMO_CATEGORY_LABELS, MEMO_STATUS_LABELS, MEMO_TYPES, MEMO_TYPE_LABELS } from '../constants/memoTemplates';
import { MemoImpactBadge, MemoStatusBadge, formatMemoAmount, formatMemoDate } from '../components/memoUi';
import { DeleteMemoDraftButton } from '../components/DeleteMemoDraftButton';
import { isAwaitingPerson } from '../utils/memoRoute';

export interface MemoRegisterPageProps {
  view?: 'all' | 'mine' | 'awaiting';
}

const STATUSES: MemoStatus[] = ['draft', 'submitted', 'approved', 'modified', 'rejected', 'issued', 'superseded', 'withdrawn'];

export default function MemoRegisterPage({ view = 'all' }: MemoRegisterPageProps) {
  const navigate = useNavigate();
  const { currentSubsidiary } = useSubsidiary();
  const subsidiaryId = currentSubsidiary?.id ?? 'zeus-group';
  const { actor, isAdmin } = useMemoActor();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<MemoStatus | 'all'>('all');
  const [type, setType] = useState<MemoType | 'all'>('all');
  const [category, setCategory] = useState<MemoCategory | 'all'>('all');

  const filters = useMemo<MemoFilters>(() => (view === 'mine' ? { createdBy: actor?.uid ?? '__none__' } : { subsidiaryId }), [view, actor?.uid, subsidiaryId]);
  const options = useMemo(() => ({ includeConfidential: isAdmin && view === 'all' }), [isAdmin, view]);
  const { memos, loading, error } = useMemos(filters, options);

  // A recipient sees the memos addressed to them alongside the register…
  const recipientFilters = useMemo<MemoFilters>(() => ({ recipientUid: actor?.uid ?? '__none__' }), [actor?.uid]);
  const { memos: addressed } = useMemos(recipientFilters);
  // …and the memos on whose route they sit (Through or To), brand or not.
  const routeFilters = useMemo<MemoFilters>(() => ({ routeUid: actor?.uid ?? '__none__' }), [actor?.uid]);
  const { memos: routed } = useMemos(routeFilters);

  const rows = useMemo(() => {
    let list: Memo[];
    if (view === 'awaiting') {
      list = routed.filter((m) => isAwaitingPerson(m, actor?.uid));
      const ackPending = addressed.filter(
        (m) => m.status === 'issued' && actor && m.distribution.some((r) => r.uid === actor.uid && r.requiresAck) && !m.acknowledgements?.[actor.uid],
      );
      const seen = new Set(list.map((m) => m.id));
      list = [...list, ...ackPending.filter((m) => !seen.has(m.id))];
    } else if (view === 'all') {
      const seen = new Set(memos.map((m) => m.id));
      list = [...memos];
      for (const m of [...addressed, ...routed]) {
        if (!seen.has(m.id)) { seen.add(m.id); list.push(m); }
      }
    } else {
      list = memos;
    }
    const q = search.trim().toLowerCase();
    return list.filter(
      (m) =>
        (status === 'all' || m.status === status) &&
        (type === 'all' || m.type === type) &&
        (category === 'all' || m.category === category) &&
        (!q || `${m.memoNumber ?? ''} ${m.subject} ${m.createdByName}`.toLowerCase().includes(q)),
    );
  }, [memos, addressed, routed, view, actor, search, status, type, category]);

  const title = view === 'mine' ? 'My memos' : view === 'awaiting' ? 'Awaiting me' : 'Register';

  return (
    <div className="space-y-4" data-testid="memo-register">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--fg-primary)' }}>{title}</h1>
          <p className="text-sm" style={{ color: 'var(--fg-secondary)' }}>
            {view === 'awaiting'
              ? 'Memos for you to clear, decide or acknowledge.'
              : `Written context for finance, administrative and operational decisions${currentSubsidiary ? ` — ${currentSubsidiary.name}` : ''}.`}
          </p>
        </div>
        <Button type="button" onClick={() => navigate('/memos/new')}>
          <Plus className="mr-1 h-4 w-4" /> New memo
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input className="h-9 w-64" placeholder="Search number, subject, author…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={status} onValueChange={(v) => setStatus(v as MemoStatus | 'all')}>
          <SelectTrigger className="h-9 w-44" aria-label="Status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{MEMO_STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => setType(v as MemoType | 'all')}>
          <SelectTrigger className="h-9 w-48" aria-label="Type"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {MEMO_TYPES.map((t) => <SelectItem key={t} value={t}>{MEMO_TYPE_LABELS[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => setCategory(v as MemoCategory | 'all')}>
          <SelectTrigger className="h-9 w-40" aria-label="Category"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {MEMO_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{MEMO_CATEGORY_LABELS[c]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error && <Banner tone="danger" title="Could not load memos" message={error.message} />}

      {loading ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--fg-tertiary)' }}>Loading memos…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title={view === 'awaiting' ? 'Nothing waiting on you' : 'No memos yet'}
          message={view === 'awaiting' ? 'Memos that go through you, are addressed to you for a decision, or await your acknowledgement will appear here.' : 'Draft the first memo to give a decision its written context.'}
          action={view === 'awaiting' ? undefined : <Button type="button" onClick={() => navigate('/memos/new')}>New memo</Button>}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--fg-tertiary)' }}>
                <th className="py-2 pr-3 font-normal">Ref</th>
                <th className="py-2 pr-3 font-normal">Subject</th>
                <th className="py-2 pr-3 font-normal">Type</th>
                <th className="py-2 pr-3 font-normal">Category</th>
                <th className="py-2 pr-3 font-normal">Amount</th>
                <th className="py-2 pr-3 font-normal">Impact</th>
                <th className="py-2 pr-3 font-normal">Status</th>
                <th className="py-2 pr-3 font-normal">From</th>
                <th className="py-2 pr-3 font-normal">Date</th>
                <th className="py-2 font-normal"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-t hover:bg-[var(--bg-sunken)]" style={{ borderColor: 'var(--border-default)' }} data-testid="memo-row">
                  <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">
                    <Link to={`/memos/${m.id}`} className="underline">{m.memoNumber ?? 'Draft'}</Link>
                  </td>
                  <td className="py-2 pr-3">
                    <Link to={`/memos/${m.id}`} className="font-medium" style={{ color: 'var(--fg-primary)' }}>{m.subject}</Link>
                    {m.confidential && <span className="ml-2 text-xs uppercase" style={{ color: 'var(--rag-red)' }}>Confidential</span>}
                  </td>
                  <td className="py-2 pr-3" style={{ color: 'var(--fg-secondary)' }}>{MEMO_TYPE_LABELS[m.type]}</td>
                  <td className="py-2 pr-3" style={{ color: 'var(--fg-secondary)' }}>{MEMO_CATEGORY_LABELS[m.category]}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{m.amountMinor != null ? formatMemoAmount(m.amountMinor, m.currency) : '—'}</td>
                  <td className="py-2 pr-3"><MemoImpactBadge impact={m.impact} /></td>
                  <td className="py-2 pr-3"><MemoStatusBadge status={m.status} /></td>
                  <td className="py-2 pr-3" style={{ color: 'var(--fg-secondary)' }}>{m.createdByName}</td>
                  <td className="py-2 pr-3 whitespace-nowrap" style={{ color: 'var(--fg-secondary)' }}>{formatMemoDate(m.header?.date ?? m.createdAt)}</td>
                  <td className="py-2 text-right">
                    <DeleteMemoDraftButton memo={m} actor={actor} isAdmin={isAdmin} variant="icon" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
