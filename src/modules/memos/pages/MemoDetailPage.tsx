/**
 * Memo detail — the memo as filed: a page head with the status and actions,
 * the banners that say where it is, the clearance / decision panel for the
 * person whose turn it is, then the numbered document — sections, decision,
 * references, distribution, discussion and history — beside a contents rail.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Download, Eye, FilePlus2, Pencil, RotateCcw, Send, XCircle } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Banner } from '@/shared/components/data-display';
import { pushToast } from '@/shared/components/feedback';
import { describeCallableError } from '@/shared/utils/callableError';
import { useMemoDoc } from '../hooks/useMemoDoc';
import { useMemoActor } from '../hooks/useMemoActor';
import type { Memo } from '../types/memo';
import { canTransition } from '../constants/memoStatus';
import { MEMO_STATUS_LABELS, MEMO_TYPE_LABELS } from '../constants/memoTemplates';
import { draftReplacementMemo } from '../services/memoService';
import { issueMemo, reopenMemo, withdrawMemo } from '../services/memoActions';
import { MemoStatusBadge, MemoImpactBadge, formatMemoAmount, formatMemoDate, partiesLine } from '../components/memoUi';
import { MemoDecisionBlock, MemoProse } from '../components/MemoBody';
import { MemoLinkView, memoLinkTypeLabel } from '../components/MemoLinksEditor';
import { MemoDecisionPanel } from '../components/MemoDecisionPanel';
import { MemoClearancePanel, MemoRouteSteps } from '../components/MemoRoutePanel';
import { describeRoute, isClearedForIssue, memoRouteStatusLine } from '../utils/memoRoute';
import { ROLE_LABELS } from '../utils/memoApproval';
import { MemoAcknowledgementList } from '../components/MemoAcknowledgementList';
import { MemoCommentsPanel } from '../components/MemoCommentsPanel';
import { MemoStatusTimeline } from '../components/MemoStatusTimeline';
import { DeleteMemoDraftButton } from '../components/DeleteMemoDraftButton';
import { DocCard, DocHeader, DocLayout, DocSection, DocTocPanel, DocumentToc, docSectionNumber, type DocTocItem } from '../components/MemoDocShell';
import { isUnsubmittedDraft } from '../utils/memoDeletion';
import { memoWordCount } from '../utils/memoProse';

const OUTCOME_TEXT = { approved: 'Approved', rejected: 'Not approved', modified: 'Approved with conditions' } as const;

export default function MemoDetailPage() {
  const { memoId } = useParams<{ memoId: string }>();
  const navigate = useNavigate();
  const { memo, loading, error } = useMemoDoc(memoId);
  const { actor, isAdmin } = useMemoActor();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const issued = memo?.issuedSnapshot;
  const sections = useMemo(() => (issued?.sections ?? memo?.sections ?? []).filter((s) => s.enabled && s.content.trim()), [issued, memo]);
  const links = issued?.links ?? memo?.links ?? [];
  const attachments = issued?.attachments ?? memo?.attachments ?? [];
  const header = issued?.header ?? memo?.header;

  if (loading) return <p className="py-8 text-center text-sm" style={{ color: 'var(--fg-tertiary)' }}>Loading memo…</p>;
  if (!memo || !header) {
    return (
      <div className="space-y-3">
        <Banner tone="warning" title="Memo not found" message={error?.message ?? 'It may have been deleted, or you may not have access to it.'} />
        <Link to="/memos" className="text-sm underline">Back to the register</Link>
      </div>
    );
  }

  const isAuthor = actor?.uid === memo.createdBy;
  const run = async (what: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(describeCallableError(e, what));
    } finally {
      setBusy(false);
    }
  };

  /** File the PDF for an issued memo — best effort; the memo is issued either way. */
  const filePdf = async (m: Memo) => {
    try {
      const { renderAndFileIssuedMemoPdf } = await import('../pdf/memoPdf');
      await renderAndFileIssuedMemoPdf(m);
    } catch (e) {
      pushToast(`Issued, but the PDF was not filed: ${e instanceof Error ? e.message : String(e)}. Use “Render & file PDF” to retry.`, { tone: 'error' });
    }
  };
  const issueAndFile = async () => {
    await issueMemo(memo.id);
    pushToast(`${memo.memoNumber ?? 'The memo'} was issued.`, { tone: 'success' });
    await filePdf({ ...memo, status: 'issued' });
  };
  const previewPdf = async () => {
    const { openMemoPdfPreview } = await import('../pdf/memoPdf');
    await openMemoPdfPreview(memo);
  };

  const canEdit = memo.status === 'draft' && (isAuthor || isAdmin);
  const canReturn = memo.status === 'rejected' && (isAuthor || isAdmin);
  const canWithdraw = actor && (isAuthor || isAdmin) && canTransition(memo.status, 'withdrawn') && memo.status !== 'issued' && !isUnsubmittedDraft(memo);
  const canWithdrawIssued = isAdmin && memo.status === 'issued';
  const onRoute = Boolean(actor && memo.routeUids?.includes(actor.uid));
  const canIssue = actor && (memo.status === 'approved' || memo.status === 'modified' || isClearedForIssue(memo)) && (isAuthor || onRoute || isAdmin);
  const canFilePdf = actor && memo.status === 'issued' && !issued?.pdfUrl && (isAuthor || onRoute || isAdmin);

  let n = 0;
  const num = () => docSectionNumber(++n);
  const sectionNums = sections.map(() => num());
  const decisionNum = memo.decision ? num() : '';
  const refsNum = num();
  const distNum = num();
  const discNum = num();
  const histNum = num();

  const ackTotal = memo.distribution.filter((r) => r.requiresAck).length;
  const ackDone = memo.distribution.filter((r) => r.requiresAck && memo.acknowledgements?.[r.uid]).length;

  const tocItems: DocTocItem[] = [
    ...sections.map((s, i) => ({ key: s.key, n: sectionNums[i], label: s.heading })),
    ...(memo.decision ? [{ key: 'decision', n: decisionNum, label: 'Decision', tone: (memo.decision.outcome === 'rejected' ? 'red' : memo.decision.outcome === 'modified' ? 'amber' : 'green') as DocTocItem['tone'] }] : []),
    { key: 'references', n: refsNum, label: 'References', badge: String(links.length + attachments.length) },
    { key: 'distribution', n: distNum, label: 'Distribution', badge: ackTotal ? `${ackDone}/${ackTotal}` : String(memo.distribution.length) },
    { key: 'discussion', n: discNum, label: 'Discussion' },
    { key: 'history', n: histNum, label: 'History' },
  ];

  const whereLine = memo.decision
    ? `${OUTCOME_TEXT[memo.decision.outcome]} by ${memo.decision.signedByName}, ${formatMemoDate(memo.decision.at)}.`
    : memo.status === 'submitted'
      ? `${memoRouteStatusLine(memo) || 'Awaiting a decision'}.`
      : memo.status === 'rejected' && memo.returned
        ? `Sent back by ${memo.returned.byName}, ${formatMemoDate(memo.returned.at)}.`
        : memo.approval && !memo.approval.required
          ? 'No approval was required; the memo issued on submit.'
          : memo.status === 'draft'
            ? 'Draft — not yet submitted.'
            : `${MEMO_STATUS_LABELS[memo.status]}.`;

  return (
    <div style={{ paddingBottom: 64 }} data-testid="memo-detail">
      <DocHeader
        onBack={() => navigate('/memos')}
        backLabel="Back to the register"
        title={<><span>{memo.subject}</span><MemoStatusBadge status={memo.status} /></>}
        meta={[
          <span key="n" className="text-mono text-tiny">{memo.memoNumber ?? 'Draft — unnumbered'}</span>,
          MEMO_TYPE_LABELS[memo.type],
          <MemoImpactBadge key="i" impact={memo.impact} />,
          memo.confidential ? <span key="c" className="text-tiny" style={{ color: 'var(--rag-red)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Confidential</span> : null,
          memo.version > 0 ? `v${memo.version}` : null,
          issued ? `Issued ${formatMemoDate(issued.issuedAt)}` : null,
        ]}
        actions={
          <>
            {canEdit && <Button type="button" size="sm" onClick={() => navigate(`/memos/${memo.id}/edit`)}><Pencil className="mr-1 h-3 w-3" /> Edit draft</Button>}
            <DeleteMemoDraftButton memo={memo} actor={actor} isAdmin={isAdmin} onDeleted={() => navigate('/memos', { replace: true })} />
            {canReturn && actor && (
              <Button type="button" size="sm" disabled={busy} onClick={() => run('reopen the memo', () => reopenMemo(memo.id))}><RotateCcw className="mr-1 h-3 w-3" /> Reopen as draft</Button>
            )}
            {canIssue && actor && (
              <Button type="button" size="sm" disabled={busy} onClick={() => run('issue the memo', issueAndFile)}><Send className="mr-1 h-3 w-3" /> {busy ? 'Issuing…' : 'Issue memo'}</Button>
            )}
            {issued?.pdfUrl ? (
              <a href={issued.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs" style={{ borderColor: 'var(--border-default)' }}>
                <Download className="h-3 w-3" /> Download PDF
              </a>
            ) : canFilePdf ? (
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => run('file the PDF', () => filePdf(memo))}><Eye className="mr-1 h-3 w-3" /> Render & file PDF</Button>
            ) : (
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => run('render the PDF', previewPdf)}><Eye className="mr-1 h-3 w-3" /> Preview PDF</Button>
            )}
            {memo.status === 'issued' && actor && (
              <Button type="button" variant="outline" size="sm" disabled={busy} title="Start a new draft from this memo; issuing it marks this one superseded." onClick={() => run('draft a replacement', async () => { const id = await draftReplacementMemo(memo, actor); navigate(`/memos/${id}/edit`); })}>
                <FilePlus2 className="mr-1 h-3 w-3" /> Draft a replacement
              </Button>
            )}
            {(canWithdraw || canWithdrawIssued) && actor && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  const note = window.prompt('Why is this memo being withdrawn? (recorded on the file)') ?? undefined;
                  if (note === undefined) return;
                  void run('withdraw the memo', () => withdrawMemo(memo.id, note));
                }}
              >
                <XCircle className="mr-1 h-3 w-3" /> Withdraw
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-3" style={{ marginBottom: 16 }}>
        {actionError && <Banner tone="danger" title="Action failed" message={actionError} onDismiss={() => setActionError(null)} />}
        <Banner tone={memo.status === 'rejected' ? 'warning' : memo.status === 'issued' ? 'success' : 'info'} title="Where it is" message={whereLine} />
        {memo.status === 'rejected' && memo.returned ? (
          <Banner tone="warning" title={`Sent back by ${memo.returned.byName}`} message={memo.returned.note} />
        ) : memo.status === 'rejected' && memo.decision ? (
          <Banner tone="warning" title="Not approved" message={memo.decision.notes ?? memo.decision.conditions ?? 'Declined without a note.'} />
        ) : null}
        {memo.status === 'submitted' && memo.approval?.unroutable && (
          <Banner tone="warning" title="Nobody to decide this memo" message={`${memo.approval.unroutable}. Address it to a colleague, or an admin can decide it.`} />
        )}
        {(memo.status === 'approved' || memo.status === 'modified') && (
          <Banner tone="success" title="Decided — not yet issued" message="Issue the memo to freeze it, file the PDF and tell the distribution list." />
        )}
        {memo.supersedes && memo.status !== 'superseded' && (
          <Banner tone="info" title="Replacement" message={<Link to={`/memos/${memo.supersedes}`} className="underline">This memo replaces an earlier one — open it</Link>} />
        )}
        {memo.status === 'superseded' && (
          <Banner tone="info" title="Superseded" message={memo.supersededBy ? <Link to={`/memos/${memo.supersededBy}`} className="underline">Open the memo that replaces this one</Link> : 'Replaced by a later memo.'} />
        )}
        {actor && (
          <MemoClearancePanel
            memo={memo}
            actor={actor}
            onCleared={(stage) => { pushToast(stage === 'returned' ? 'Sent back to the author.' : 'Cleared.', { tone: 'success' }); }}
          />
        )}
        {actor && (
          <MemoDecisionPanel
            memo={memo}
            actor={actor}
            isAdmin={isAdmin}
            onDecided={async (outcome) => {
              if (outcome === 'rejected') { pushToast('Recorded as not approved.', { tone: 'info' }); return; }
              // Decided → issue → file, unless the author wants to hold it.
              await run('issue the memo', issueAndFile);
            }}
          />
        )}
      </div>

      <DocLayout
        toc={
          <DocumentToc items={tocItems}>
            <DocTocPanel title="Cover">
              <div style={{ color: 'var(--fg-secondary)' }}>To: {partiesLine(header.to)}</div>
              <div style={{ color: 'var(--fg-secondary)' }}>From: {header.from.name}</div>
              {header.through.length > 0 && <div style={{ color: 'var(--fg-secondary)' }}>Through: {partiesLine(header.through)}</div>}
              <div style={{ color: 'var(--fg-secondary)' }}>Date: {formatMemoDate(header.date)}</div>
              <div style={{ color: 'var(--fg-secondary)' }}>Amount: {memo.amountMinor != null ? formatMemoAmount(memo.amountMinor, memo.currency) : '—'}</div>
              {memo.externalRef && <div style={{ color: 'var(--fg-secondary)' }}>Ref: {memo.externalRef}</div>}
              <div style={{ color: 'var(--fg-tertiary)', marginTop: 4 }}>{sections.length} sections · {memoWordCount(sections).toLocaleString()} words · {links.length} records</div>
            </DocTocPanel>
            {memo.approval && (
              <DocTocPanel title="Approval">
                <MemoRouteSteps memo={memo} />
                {memo.approval.required ? (
                  <div style={{ marginTop: 6, color: 'var(--fg-tertiary)' }}>
                    Tier: {ROLE_LABELS[memo.approval.effectiveRole ?? 'manager']} or above (set by {memo.approval.raisedBy})
                    {memo.approval.tierMet === false ? ' · addressed below it' : ''}
                  </div>
                ) : (
                  <div style={{ marginTop: 6, color: 'var(--fg-tertiary)' }}>No decision required</div>
                )}
                {memo.decision && <div style={{ marginTop: 6, color: 'var(--fg-primary)' }}>{OUTCOME_TEXT[memo.decision.outcome]} · {memo.decision.signedByName}</div>}
                {issued?.contentHash && <div className="text-mono text-tiny" style={{ marginTop: 6, color: 'var(--fg-tertiary)', wordBreak: 'break-all' }}>sha256 {issued.contentHash}</div>}
              </DocTocPanel>
            )}
          </DocumentToc>
        }
      >
        {sections.length === 0 && <DocCard><span className="text-sm" style={{ color: 'var(--fg-tertiary)' }}>Nothing written yet.</span></DocCard>}
        {sections.map((s, i) => (
          <DocSection key={s.key} id={s.key} n={sectionNums[i]} title={s.heading}>
            <DocCard style={{ padding: '18px 22px' }}><MemoProse content={s.content} /></DocCard>
          </DocSection>
        ))}

        {memo.decision && (
          <DocSection id="decision" n={decisionNum} title="Decision" kicker="Recorded as taken — conditions verbatim, signature as typed.">
            <MemoDecisionBlock decision={memo.decision} />
          </DocSection>
        )}

        <DocSection id="references" n={refsNum} title="References" kicker="The records this memo is about, and what was attached.">
          <DocCard style={{ padding: 0 }}>
            {links.length + attachments.length === 0 ? (
              <div className="text-small" style={{ padding: 20, color: 'var(--fg-tertiary)' }}>No records linked and nothing attached.</div>
            ) : (
              <ul className="divide-y text-sm" style={{ borderColor: 'var(--border-subtle)' }}>
                {links.map((l, i) => (
                  <li key={`l-${i}`} className="flex items-center gap-2 px-5 py-2.5">
                    <span className="rounded px-1.5 py-0.5 text-[10.5px] uppercase tracking-wide" style={{ background: 'var(--bg-sunken)', color: 'var(--fg-tertiary)' }}>{l.relation}</span>
                    <MemoLinkView link={l} />
                    <span className="text-xs" style={{ color: 'var(--fg-tertiary)' }}>{memoLinkTypeLabel(l.type)}</span>
                  </li>
                ))}
                {attachments.map((a) => (
                  <li key={a.id} className="px-5 py-2.5"><a href={a.url} target="_blank" rel="noreferrer" className="underline">{a.name}</a></li>
                ))}
              </ul>
            )}
          </DocCard>
        </DocSection>

        <DocSection id="distribution" n={distNum} title="Distribution & acknowledgement">
          <DocCard><MemoAcknowledgementList memo={memo} actor={actor} /></DocCard>
        </DocSection>

        <DocSection id="discussion" n={discNum} title="Discussion">
          <DocCard><MemoCommentsPanel memoId={memo.id} actor={actor} /></DocCard>
        </DocSection>

        <DocSection id="history" n={histNum} title="History">
          <DocCard>
            <MemoStatusTimeline history={memo.statusHistory} />
            {memo.approval && (
              <p className="mt-3 text-xs" style={{ color: 'var(--fg-tertiary)' }}>
                Routing: {memo.approval.route ? describeRoute(memo.approval.route, memo.approval.required) : '—'}
                {memo.approval.required ? ` · tier ${memo.approval.effectiveRole} (${memo.approval.raisedBy})` : ''}
                {(memo.approval.clearances ?? []).map((c) => ` · ${c.outcome === 'cleared' ? 'cleared' : 'sent back'} by ${c.name}${c.note ? ` (“${c.note}”)` : ''}`).join('')}
              </p>
            )}
          </DocCard>
        </DocSection>
      </DocLayout>
    </div>
  );
}
