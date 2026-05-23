/**
 * LeadCard — compact card for a Lead, used by the Kanban view and as
 * a fallback in dense list contexts.
 */

import { Link } from 'react-router-dom';
import type { Lead } from '../types/lead.types';
import { LeadStageBadge } from './LeadStageBadge';

function formatMoney(minor: number | undefined, currency: string): string {
  if (typeof minor !== 'number') return '—';
  return `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  if (typeof value === 'string') return value.slice(0, 10);
  const ts = value as { seconds?: number; toDate?: () => Date };
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString().slice(0, 10);
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toISOString().slice(0, 10);
  return '—';
}

export function LeadCard({ lead }: { lead: Lead }) {
  return (
    <Link
      to={`/crm/${lead.id}`}
      className="block rounded border bg-card p-3 hover:border-primary"
      data-lead-id={lead.id}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium" data-testid="lead-card-name">{lead.name}</h3>
        <LeadStageBadge stage={lead.stage} />
      </div>
      {lead.contactName && (
        <p className="mt-1 text-xs text-muted-foreground">{lead.contactName}</p>
      )}
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{lead.source}</span>
        <span className="font-medium">
          {formatMoney(lead.estimatedValueMinor, lead.currency)}
        </span>
      </div>
      {lead.nextActionLabel && (
        <div className="mt-2 rounded bg-muted/40 p-2 text-xs">
          <span className="font-medium">Next:</span> {lead.nextActionLabel}
          {lead.nextActionDate && (
            <span className="ml-1 text-muted-foreground">· {formatDate(lead.nextActionDate)}</span>
          )}
        </div>
      )}
    </Link>
  );
}
