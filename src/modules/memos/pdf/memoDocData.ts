/**
 * The memo as a pure document model — everything the PDF draws, resolved
 * once, with no Firestore or network. The screen renders from the same memo
 * fields, so what you see is what prints; this model is what the render test
 * asserts on without rasterising anything.
 */
import { DEFAULT_SUBSIDIARIES } from '@/types/subsidiary';
import type { Memo, MemoDecision, MemoRecipient } from '../types/memo';
import { proseToBlocks, type ProseBlock } from '../utils/memoProse';
import { MEMO_CATEGORY_LABELS, MEMO_IMPACT_LABELS, MEMO_TYPE_LABELS } from '../constants/memoTemplates';
import { formatMemoAmount, formatMemoDate, partiesLine, partyLabel } from '../components/memoUi';

export interface MemoDocIssuer {
  name: string;
  groupLine?: string;
}

export interface MemoDocSection { key: string; heading: string; blocks: ProseBlock[] }

export interface MemoDocDecision {
  outcomeLabel: string;
  conditions: ProseBlock[];
  notes?: string;
  signedByName: string;
  signedNameTyped: string;
  dateLabel: string;
}

export interface MemoDocData {
  issuer: MemoDocIssuer;
  memoNumber: string;
  draft: boolean;
  versionLabel: string;
  subject: string;
  classLine: string;
  confidential: boolean;
  header: { to: string; through: string; cc: string; from: string; date: string; externalRef?: string };
  sections: MemoDocSection[];
  decision?: MemoDocDecision;
  clearance: string[];
  references: string[];
  attachments: string[];
  distribution: Array<{ name: string; role: string; acknowledged: string }>;
  contentHash?: string;
  title: string;
}

const OUTCOME_LABEL: Record<MemoDecision['outcome'], string> = {
  approved: 'APPROVED',
  rejected: 'NOT APPROVED',
  modified: 'APPROVED WITH CONDITIONS',
};

const ROLE_LABEL: Record<MemoRecipient['role'], string> = { to: 'Addressee', through: 'Clearance', cc: 'Copy', ack: 'Acknowledge' };

/** Letterhead for the memo's brand, from the subsidiary registry. */
export function resolveMemoIssuer(subsidiaryId: string): MemoDocIssuer {
  const sub = DEFAULT_SUBSIDIARIES.find((s) => s.id === subsidiaryId);
  const name = sub?.name ?? 'Zeus Group';
  return { name, groupLine: sub && sub.id !== 'zeus-group' ? 'A Zeus Group company' : undefined };
}

export function buildMemoDocData(memo: Memo, issuer: MemoDocIssuer = resolveMemoIssuer(memo.subsidiaryId)): MemoDocData {
  const snap = memo.issuedSnapshot;
  const header = snap?.header ?? memo.header;
  const sections = (snap?.sections ?? memo.sections).filter((s) => s.enabled && s.content.trim());
  const links = snap?.links ?? memo.links ?? [];
  const attachments = snap?.attachments ?? memo.attachments ?? [];
  const distribution = snap?.distribution ?? memo.distribution ?? [];
  const draft = memo.status === 'draft' || memo.status === 'submitted' || memo.status === 'rejected';
  const amountMinor = snap?.amountMinor ?? memo.amountMinor;
  const currency = snap?.currency ?? memo.currency;

  const classParts = [MEMO_TYPE_LABELS[memo.type], MEMO_CATEGORY_LABELS[memo.category], `${MEMO_IMPACT_LABELS[memo.impact]} impact`];
  if (amountMinor != null) classParts.push(formatMemoAmount(amountMinor, currency));
  if (memo.confidential) classParts.push('CONFIDENTIAL');

  const decision: MemoDocDecision | undefined = memo.decision
    ? {
        outcomeLabel: OUTCOME_LABEL[memo.decision.outcome],
        conditions: proseToBlocks(memo.decision.conditions),
        notes: memo.decision.notes,
        signedByName: memo.decision.signedByName,
        signedNameTyped: memo.decision.signedNameTyped || memo.decision.signedByName,
        dateLabel: formatMemoDate(memo.decision.at),
      }
    : undefined;

  return {
    issuer,
    memoNumber: snap?.memoNumber ?? memo.memoNumber ?? 'DRAFT',
    draft,
    versionLabel: memo.version > 0 ? `v${snap?.version ?? memo.version}` : '',
    subject: memo.subject,
    classLine: classParts.join('  ·  '),
    confidential: memo.confidential,
    header: {
      to: partiesLine(header.to),
      through: partiesLine(header.through),
      cc: partiesLine(header.cc),
      from: partyLabel(header.from),
      date: formatMemoDate(header.date),
      externalRef: memo.externalRef,
    },
    sections: sections.map((s) => ({ key: s.key, heading: s.heading, blocks: proseToBlocks(s.content) })),
    decision,
    clearance: header.through.map(partyLabel),
    references: links.map((l) => `${l.label}${l.relation === 'authorises' ? ' (authorised by this memo)' : l.relation === 'supersedes' ? ' (superseded)' : ''}`),
    attachments: attachments.map((a) => a.name),
    distribution: distribution.map((r) => ({
      name: r.name,
      role: ROLE_LABEL[r.role] ?? r.role,
      acknowledged: memo.acknowledgements?.[r.uid] ? formatMemoDate(memo.acknowledgements[r.uid].at) : r.requiresAck ? 'pending' : '',
    })),
    contentHash: snap?.contentHash,
    title: `${snap?.memoNumber ?? memo.memoNumber ?? 'Draft memo'} — ${memo.subject}`,
  };
}

export function buildMemoFilename(memo: Pick<Memo, 'memoNumber' | 'subject' | 'version'>): string {
  const safe = memo.subject.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60);
  const base = memo.memoNumber ? `${memo.memoNumber}-v${memo.version || 1}` : 'DRAFT-memo';
  return `${base}${safe ? `-${safe}` : ''}.pdf`;
}
