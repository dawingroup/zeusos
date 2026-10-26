/**
 * Memo editor — `/memos/new` and `/memos/:memoId/edit`. A draft is created on
 * the first save and autosaved as the author writes; submitting hands it to
 * the callable, which numbers it, plans the route and (when nothing is to be
 * cleared and nobody decides) issues it at once.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, Circle, Eye, Paperclip, Save, Send, Trash2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Checkbox } from '@/core/components/ui/checkbox';
import { Textarea } from '@/core/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/core/components/ui/dialog';
import { Banner } from '@/shared/components/data-display';
import { pushToast } from '@/shared/components/feedback';
import { describeCallableError } from '@/shared/utils/callableError';
import { currencyMinorUnits } from '@/shared/utils/money';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import { useMemoDoc } from '../hooks/useMemoDoc';
import { useMemoActor } from '../hooks/useMemoActor';
import type { Memo, MemoLink, MemoRecipient, MemoSection } from '../types/memo';
import { DEFAULT_MEMO_CURRENCY, MEMO_TYPE_HINTS, MEMO_TYPE_LABELS, missingRequiredSections, retargetSections, sectionsForType, templateFor } from '../constants/memoTemplates';
import { isEditableStatus } from '../constants/memoStatus';
import { addMemoAttachment, createMemoDraft, removeMemoAttachment, updateMemoDraft } from '../services/memoService';
import { submitMemo } from '../services/memoActions';
import { MemoHeaderForm, type MemoHeaderValues } from '../components/MemoHeaderForm';
import { MemoLinksEditor } from '../components/MemoLinksEditor';
import { MemoDistributionEditor } from '../components/MemoDistributionEditor';
import { MemoApprovalPreview } from '../components/MemoApprovalPreview';
import { DeleteMemoDraftButton } from '../components/DeleteMemoDraftButton';
import { DocCard, DocHeader, DocLayout, DocSection, DocTocPanel, DocumentToc, docSectionNumber, type DocTocItem } from '../components/MemoDocShell';
import { formatMemoAmount, partiesLine } from '../components/memoUi';
import { memoWordCount } from '../utils/memoProse';
import { describeMemoApproval, resolveMemoApproval } from '../utils/memoApproval';
import { describeRoute, planMemoRoute } from '../utils/memoRoute';
import { MEMO_PREFILL_KEYS, parseMemoPrefill, type MemoPrefill } from '../utils/memoPrefill';

interface EditorState extends MemoHeaderValues {
  sections: MemoSection[];
  links: MemoLink[];
  distribution: MemoRecipient[];
}

function scaleOf(currency: string): number {
  return 10 ** currencyMinorUnits(currency);
}

/** Minor units → the major-unit string the input shows. */
export function amountInputFromMinor(amountMinor: number | null | undefined, currency: string): string {
  if (amountMinor === null || amountMinor === undefined) return '';
  return String(Number(amountMinor) / scaleOf(currency));
}

/** The input's major-unit string → minor units (null when blank or not a number). */
export function amountMinorFromInput(amount: string, currency: string): number | null {
  if (amount.trim() === '') return null;
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * scaleOf(currency));
}

function fromMemo(memo: Memo): EditorState {
  const currency = memo.currency ?? DEFAULT_MEMO_CURRENCY;
  return {
    type: memo.type,
    category: memo.category,
    impact: memo.impact,
    confidential: memo.confidential ?? false,
    subject: memo.subject,
    externalRef: memo.externalRef ?? '',
    amount: amountInputFromMinor(memo.amountMinor, currency),
    currency,
    header: memo.header,
    sections: memo.sections,
    links: memo.links ?? [],
    distribution: memo.distribution ?? [],
  };
}

function blank(actorName: string, actorUid: string, actorEmail: string | undefined, prefill: MemoPrefill | null): EditorState {
  const type = prefill?.memoType ?? 'request';
  const from = actorEmail ? { uid: actorUid, name: actorName, email: actorEmail } : { uid: actorUid, name: actorName };
  return {
    type,
    category: prefill?.category ?? 'operations',
    impact: 'low',
    confidential: false,
    subject: prefill?.subject ?? '',
    externalRef: '',
    amount: '',
    currency: DEFAULT_MEMO_CURRENCY,
    header: { to: [], from, through: [], cc: [], date: new Date().toISOString().slice(0, 10) },
    sections: sectionsForType(type),
    links: prefill ? [prefill.link] : [],
    distribution: [],
  };
}

function toPatch(s: EditorState) {
  const amountMinor = amountMinorFromInput(s.amount, s.currency);
  return {
    type: s.type,
    category: s.category,
    impact: s.impact,
    confidential: s.confidential,
    subject: s.subject,
    externalRef: s.externalRef.trim() || null,
    amountMinor,
    currency: s.currency,
    header: s.header,
    sections: s.sections,
    links: s.links,
    distribution: s.distribution,
  };
}

export default function MemoEditorPage() {
  const { memoId } = useParams<{ memoId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentSubsidiary } = useSubsidiary();
  const subsidiaryId = currentSubsidiary?.id ?? 'zeus-group';
  const { actor, isAdmin, loading: actorLoading } = useMemoActor();
  const { memo, loading } = useMemoDoc(memoId);

  // Read the record-page prefill ONCE, then strip it so a refresh does not re-seed.
  const [prefill] = useState<MemoPrefill | null>(() => (memoId ? null : parseMemoPrefill(searchParams)));
  useEffect(() => {
    if (!MEMO_PREFILL_KEYS.some((k) => searchParams.has(k))) return;
    const next = new URLSearchParams(searchParams);
    for (const k of MEMO_PREFILL_KEYS) next.delete(k);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [state, setState] = useState<EditorState | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dirtyRef = useRef(false);
  const deletingRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state) return;
    if (memoId) {
      if (memo) setState(fromMemo(memo));
    } else if (actor) {
      setState(blank(actor.name, actor.uid, actor.email, prefill));
    }
  }, [memoId, memo, actor, state, prefill]);

  const editable = !memoId || (memo ? isEditableStatus(memo.status) : false);
  const isAuthor = !memoId || (memo && actor ? memo.createdBy === actor.uid : false);

  const persist = useCallback(
    async (next: EditorState) => {
      if (!actor || deletingRef.current) return;
      setSaving(true);
      setError(null);
      try {
        if (!memoId) {
          const p = toPatch(next);
          const id = await createMemoDraft({ subsidiaryId, ...p, externalRef: p.externalRef ?? undefined }, actor);
          navigate(`/memos/${id}/edit`, { replace: true });
        } else {
          await updateMemoDraft(memoId, toPatch(next), actor);
        }
        dirtyRef.current = false;
        setSavedAt(new Date());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSaving(false);
      }
    },
    [actor, memoId, subsidiaryId, navigate],
  );

  // Autosave 1.2s after the last keystroke, only once the memo exists.
  useEffect(() => {
    if (!state || !memoId || !dirtyRef.current || !editable) return;
    const t = setTimeout(() => void persist(state), 1200);
    return () => clearTimeout(t);
  }, [state, memoId, editable, persist]);

  const patch = (p: Partial<EditorState>) => {
    dirtyRef.current = true;
    setState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...p };
      if (p.type && p.type !== prev.type) next.sections = retargetSections(prev.sections, p.type);
      return next;
    });
  };

  const setSection = (key: string, change: Partial<MemoSection>) => {
    dirtyRef.current = true;
    setState((prev) => (prev ? { ...prev, sections: prev.sections.map((s) => (s.key === key ? { ...s, ...change } : s)) } : prev));
  };

  const missing = useMemo(() => (state ? missingRequiredSections(state.type, state.sections) : []), [state]);
  const requiredTotal = useMemo(() => (state ? state.sections.filter((s) => templateFor(state.type, s.key)?.required).length : 0), [state]);
  const amountMinor = state ? amountMinorFromInput(state.amount, state.currency) : null;
  const approvalInput = useMemo(
    () => (state ? { type: state.type, category: state.category, impact: state.impact, amountMinor, currency: state.currency } : null),
    [state, amountMinor],
  );
  const routing = useMemo(() => (approvalInput ? resolveMemoApproval(approvalInput) : null), [approvalInput]);
  const authorUid = memo?.createdBy ?? actor?.uid ?? '';
  const routePlan = useMemo(() => (state ? planMemoRoute(state.header, authorUid) : null), [state, authorUid]);
  const canSubmit = Boolean(state && memoId && state.subject.trim() && state.header.to.length && missing.length === 0);

  if (!actor) {
    return actorLoading ? (
      <p className="py-8 text-center text-sm" style={{ color: 'var(--fg-tertiary)' }}>Signing in…</p>
    ) : (
      <Banner tone="warning" title="You are signed out" message="Sign in again to write a memo." />
    );
  }
  if (memoId && loading) return <p className="py-8 text-center text-sm" style={{ color: 'var(--fg-tertiary)' }}>Loading memo…</p>;
  if (memoId && !memo) {
    return (
      <div className="space-y-3">
        <Banner tone="warning" title="Memo not found" message="It may have been deleted, or you may not have access to it." />
        <Link to="/memos" className="text-sm underline">Back to the register</Link>
      </div>
    );
  }
  if (memoId && memo && !editable) {
    return (
      <div className="space-y-3">
        <Banner tone="info" title="This memo is no longer editable" message="Its content froze when it left draft. Open it to see where it is, or withdraw it and start again." />
        <Link to={`/memos/${memoId}`} className="text-sm underline">Open the memo</Link>
      </div>
    );
  }
  if (memoId && memo && !isAuthor && !isAdmin) {
    return (
      <div className="space-y-3">
        <Banner tone="info" title="Only the author edits a draft" message="Add a comment on the memo instead." />
        <Link to={`/memos/${memoId}`} className="text-sm underline">Open the memo</Link>
      </div>
    );
  }
  if (!state || !routing || !approvalInput || !routePlan) return null;

  const headerDone = Boolean(state.subject.trim() && state.header.to.length);
  const enabledSections = state.sections.filter((s) => s.enabled);
  const tocItems: DocTocItem[] = [
    { key: 'header', n: docSectionNumber(0), label: 'Header & routing', tone: headerDone ? 'green' : 'amber' },
    ...state.sections.map((s, i): DocTocItem => {
      const required = templateFor(state.type, s.key)?.required ?? false;
      const written = s.content.trim().length > 0;
      return { key: s.key, n: docSectionNumber(i + 1), label: s.heading, muted: !s.enabled, badge: s.enabled ? undefined : 'off', tone: !s.enabled ? undefined : written ? 'green' : required ? 'red' : 'na' };
    }),
    { key: 'references', n: docSectionNumber(state.sections.length + 1), label: 'References', badge: String(state.links.length) },
    { key: 'distribution', n: docSectionNumber(state.sections.length + 2), label: 'Distribution', badge: String(state.distribution.length) },
    { key: 'attachments', n: docSectionNumber(state.sections.length + 3), label: 'Attachments', badge: String(memo?.attachments?.length ?? 0) },
  ];

  const requiredDone = requiredTotal - missing.length;
  const words = memoWordCount(state.sections);
  const checklist: Array<[string, boolean]> = [
    ['Subject', Boolean(state.subject.trim())],
    ['Addressed to someone', state.header.to.length > 0],
    [`Required sections (${requiredDone}/${requiredTotal})`, missing.length === 0],
    ['Saved as a draft', Boolean(memoId)],
  ];
  const saveDisabled = saving || (!memoId && !state.subject.trim());
  const routeLine = routing.required || routePlan.route.clearance.length > 0
    ? `${describeRoute(routePlan.route, routing.required)}. ${routing.required ? `Tier: ${describeMemoApproval(routing)}.` : 'No decision needed.'}`
    : `${describeMemoApproval(routing)}. Submitting numbers and issues it at once.`;

  const previewPdf = async () => {
    if (!memo) return;
    try {
      const { openMemoPdfPreview } = await import('../pdf/memoPdf');
      await openMemoPdfPreview({ ...memo, ...toPatch(state), amountMinor: amountMinor ?? undefined, externalRef: state.externalRef || undefined } as Memo);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const submit = async () => {
    if (!memoId) return;
    setSubmitting(true);
    setError(null);
    try {
      if (dirtyRef.current) await persist(state);
      const result = await submitMemo(memoId);
      setConfirmOpen(false);
      if (result.status === 'issued') {
        pushToast(`${result.memoNumber ?? 'The memo'} was issued.`, { tone: 'success' });
        // Best effort: the memo IS issued; the page offers "Render & file PDF" if this fails.
        try {
          const { renderAndFileIssuedMemoPdf } = await import('../pdf/memoPdf');
          const fresh = { ...(memo as Memo), ...toPatch(state), memoNumber: result.memoNumber, version: result.version ?? 1, status: 'issued' as const };
          await renderAndFileIssuedMemoPdf(fresh as Memo);
        } catch (e) {
          pushToast(`Issued, but the PDF was not filed: ${e instanceof Error ? e.message : String(e)}`, { tone: 'error' });
        }
      } else {
        pushToast(`${result.memoNumber ?? 'The memo'} is on its route.`, { tone: 'success' });
      }
      navigate(`/memos/${memoId}`);
    } catch (e) {
      setError(describeCallableError(e, 'submit the memo'));
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ paddingBottom: 64 }} data-testid="memo-editor">
      <DocHeader
        onBack={() => navigate(memoId ? `/memos/${memoId}` : '/memos')}
        backLabel={memoId ? 'Back to the memo' : 'Back to the register'}
        title={<span>{state.subject.trim() || 'Untitled memo'}</span>}
        meta={[
          <span key="n" className="text-mono text-tiny">{memo?.memoNumber ?? 'Draft — unnumbered'}</span>,
          MEMO_TYPE_LABELS[state.type],
          `${requiredDone}/${requiredTotal} required sections`,
          `${words} words`,
          saving ? 'Saving…' : savedAt ? <span key="s" style={{ color: 'var(--rag-green)' }}>Saved {savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> : memoId ? 'Autosaves as you write' : 'Not saved yet',
        ]}
        actions={
          <>
            {memo && (
              <DeleteMemoDraftButton memo={memo} actor={actor} isAdmin={isAdmin} onBeforeDelete={() => { deletingRef.current = true; dirtyRef.current = false; }} onDeleted={() => navigate('/memos', { replace: true })} />
            )}
            {memo && (
              <Button type="button" variant="outline" size="sm" onClick={() => void previewPdf()}><Eye className="mr-1 h-3 w-3" /> Preview PDF</Button>
            )}
            <Button type="button" variant="outline" size="sm" disabled={saveDisabled} onClick={() => void persist(state)}><Save className="mr-1 h-3 w-3" /> {memoId ? 'Save' : 'Save draft'}</Button>
            <Button type="button" size="sm" disabled={!canSubmit || saving} onClick={() => setConfirmOpen(true)}><Send className="mr-1 h-3 w-3" /> Submit…</Button>
          </>
        }
      />

      <div className="space-y-3" style={{ marginBottom: 16 }}>
        {error && <Banner tone="danger" title="Could not save" message={error} onDismiss={() => setError(null)} />}
        {!memoId && <Banner tone="info" title="Save the draft first" message="Give the memo a subject and save it; attachments and submission unlock once it exists." />}
        <Banner tone={routing.required || routePlan.route.clearance.length ? 'info' : 'success'} title="Where it goes" message={routeLine} />
      </div>

      <DocLayout
        toc={
          <DocumentToc items={tocItems}>
            <DocTocPanel title="Before you submit">
              {checklist.map(([label, ok]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', color: ok ? 'var(--fg-primary)' : 'var(--fg-tertiary)' }}>
                  {ok ? <Check className="h-3 w-3" style={{ color: 'var(--rag-green)' }} /> : <Circle className="h-3 w-3" />}
                  {label}
                </div>
              ))}
            </DocTocPanel>
            <DocTocPanel title="Memo in numbers">
              <div style={{ color: 'var(--fg-secondary)' }}>{enabledSections.length} sections · {words.toLocaleString()} words</div>
              <div style={{ color: 'var(--fg-secondary)' }}>{state.links.length} records · {state.distribution.length} recipients</div>
              <div style={{ color: 'var(--fg-secondary)' }}>To: {partiesLine(state.header.to)}</div>
              <div style={{ color: 'var(--fg-secondary)' }}>Amount: {amountMinor != null ? formatMemoAmount(amountMinor, state.currency) : '—'}</div>
            </DocTocPanel>
          </DocumentToc>
        }
      >
        <DocSection id="header" n={docSectionNumber(0)} title="Header & routing" kicker={MEMO_TYPE_HINTS[state.type]}>
          <DocCard><MemoHeaderForm value={state} onChange={patch} /></DocCard>
        </DocSection>

        {state.sections.map((s, i) => {
          const tpl = templateFor(state.type, s.key);
          const required = tpl?.required ?? false;
          const sectionWords = s.content.trim() ? s.content.trim().split(/\s+/).length : 0;
          return (
            <DocSection
              key={s.key}
              id={s.key}
              n={docSectionNumber(i + 1)}
              title={<>{s.heading}{required && <span style={{ color: 'var(--rag-red)', marginLeft: 4 }}>*</span>}</>}
              kicker={tpl?.hint}
              muted={!s.enabled}
              action={!required ? (
                <label className="text-small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--fg-secondary)', whiteSpace: 'nowrap' }}>
                  <Checkbox checked={s.enabled} aria-label={`Include ${s.heading}`} onCheckedChange={(c) => setSection(s.key, { enabled: c === true })} />
                  Include
                </label>
              ) : undefined}
            >
              <DocCard style={{ padding: 12 }}>
                <Textarea
                  aria-label={s.heading}
                  value={s.content}
                  disabled={!s.enabled}
                  className="min-h-[7rem]"
                  placeholder={s.enabled ? 'Write in plain prose. Blank line = new paragraph; "- " = bullet; "1. " = numbered; "## " = sub-heading.' : 'Section excluded — tick Include to write it.'}
                  onChange={(e) => setSection(s.key, { content: e.target.value })}
                />
                <div className="mt-1 text-right text-xs" style={{ color: 'var(--fg-tertiary)' }}>{sectionWords} words</div>
              </DocCard>
            </DocSection>
          );
        })}

        <DocSection id="references" n={docSectionNumber(state.sections.length + 1)} title="References" kicker="The records this memo is about — and whether the memo authorises them or is context.">
          <MemoLinksEditor links={state.links} onChange={(links) => patch({ links })} />
        </DocSection>

        <DocSection id="distribution" n={docSectionNumber(state.sections.length + 2)} title="Distribution" kicker={state.type === 'directive' ? 'Who must read and acknowledge this directive once it is issued.' : 'Who receives the memo once it is issued.'}>
          <DocCard><MemoDistributionEditor distribution={state.distribution} onChange={(distribution) => patch({ distribution })} defaultRequiresAck={state.type === 'directive'} /></DocCard>
        </DocSection>

        <DocSection id="attachments" n={docSectionNumber(state.sections.length + 3)} title="Attachments" kicker="Quotes, schedules and evidence, filed with the memo.">
          <DocCard>
            {memo?.attachments?.length ? (
              <ul className="divide-y text-sm" style={{ borderColor: 'var(--border-subtle)' }}>
                {memo.attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2">
                    <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 underline"><Paperclip className="h-3.5 w-3.5" />{a.name}</a>
                    <button type="button" aria-label={`Remove ${a.name}`} style={{ color: 'var(--fg-tertiary)' }} onClick={() => memo && void removeMemoAttachment(memo, a.id, actor).catch((e) => setError(String(e)))}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm" style={{ color: 'var(--fg-tertiary)' }}>No attachments.</p>
            )}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              aria-label="Attach a file"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file || !memo) return;
                try { await addMemoAttachment(memo, file, actor); } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
              }}
            />
            <Button type="button" variant="outline" size="sm" className="mt-3" disabled={!memo} onClick={() => fileRef.current?.click()}><Paperclip className="mr-1 h-3 w-3" /> Attach a file</Button>
          </DocCard>
        </DocSection>
      </DocLayout>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit this memo?</DialogTitle>
            <DialogDescription>The memo is numbered and its content freezes. Here is where it goes.</DialogDescription>
          </DialogHeader>
          <MemoApprovalPreview memo={approvalInput} header={state.header} authorUid={authorUid} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>Keep editing</Button>
            <Button type="button" disabled={submitting || !memoId} onClick={() => void submit()}>{submitting ? 'Submitting…' : 'Submit'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
