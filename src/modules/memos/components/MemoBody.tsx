/**
 * Read-only rendering of memo prose and the decision block — from the same
 * prose blocks the PDF draws, so what you see is what prints.
 */
import type { MemoDecision } from '../types/memo';
import { proseToBlocks } from '../utils/memoProse';
import { formatMemoDate } from './memoUi';

export function MemoProse({ content }: { content: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed" style={{ color: 'var(--fg-primary)' }}>
      {proseToBlocks(content).map((b, i) => {
        if (b.kind === 'sub') return <h4 key={i} className="mt-3 text-sm font-medium">{b.text}</h4>;
        if (b.kind === 'list') {
          const Tag = b.ordered ? 'ol' : 'ul';
          return <Tag key={i} className={`${b.ordered ? 'list-decimal' : 'list-disc'} space-y-1 pl-5`}>{b.items.map((item, j) => <li key={j}>{item}</li>)}</Tag>;
        }
        return <p key={i}>{b.text}</p>;
      })}
    </div>
  );
}

export const OUTCOME_LABEL: Record<MemoDecision['outcome'], string> = {
  approved: 'APPROVED',
  rejected: 'NOT APPROVED',
  modified: 'APPROVED WITH CONDITIONS',
};

export function MemoDecisionBlock({ decision }: { decision: MemoDecision }) {
  return (
    <div className="rounded-md border p-4" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-sunken)' }}>
      <p className="text-sm font-semibold tracking-wide" style={{ color: 'var(--fg-primary)' }}>{OUTCOME_LABEL[decision.outcome]}</p>
      {decision.conditions && (
        <div className="mt-2 space-y-1 text-sm" style={{ color: 'var(--fg-primary)' }}>
          {proseToBlocks(decision.conditions).map((b, i) => (b.kind === 'para' ? <p key={i}>{b.text}</p> : b.kind === 'list' ? <ul key={i} className="list-disc pl-5">{b.items.map((x, j) => <li key={j}>{x}</li>)}</ul> : null))}
        </div>
      )}
      {decision.notes && <p className="mt-2 text-sm" style={{ color: 'var(--fg-secondary)' }}>{decision.notes}</p>}
      <div className="mt-4 text-sm">
        <div className="font-medium" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>{decision.signedNameTyped || decision.signedByName}</div>
        <div className="text-xs" style={{ color: 'var(--fg-tertiary)' }}>
          {decision.signedByName} · signed by typed name · {formatMemoDate(decision.at)}{decision.coveredAsAdmin ? ' · as admin, in the addressee’s place' : ''}
        </div>
      </div>
    </div>
  );
}
