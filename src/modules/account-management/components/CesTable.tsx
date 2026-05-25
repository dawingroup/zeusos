/**
 * CesTable — Phase 6.UI.D.3 (PR 5).
 *
 * Renders `master_job.ces.lineItems` with category badges, total,
 * signed-off banner, and the comparison against a linked Quote when
 * available (using `computeCesFloor` + `isQuoteBelowCesFloor` from
 * the 6.D ces.types pure helpers).
 *
 * Sign-off is one-click — disabled when zero line items or already
 * signed. Adding lines opens `CesLineItemDialog`.
 */

import { useMemo, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { Plus, FileLock2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import type { MasterJob } from '@/modules/assignment/types/master-job.types';
import {
  type CES,
  type CESLineItem,
  computeCesFloor,
  isQuoteBelowCesFloor,
} from '@/modules/contracts/types/ces.types';
import { formatMinor } from '../utils/money';
import { signOffCesFn } from '../services/brief-ces.service';
import { CesLineItemDialog } from './CesLineItemDialog';
import { cn } from '@/shared/lib/utils';

interface Props {
  masterJob: MasterJob;
  /** Total of the linked client-facing Quote in minor units, in the
   *  same currency as the CES. When set, the table shows a
   *  Quote-vs-Floor comparison. */
  linkedQuoteTotalMinor?: number;
  /** Default margin floor pct override — falls back to ces.marginFloorPct
   *  or the 25% helper default. */
  defaultMarginFloorPct?: number;
}

const CATEGORY_LABEL: Record<CESLineItem['category'], string> = {
  LABOR_INTERNAL:  'Internal',
  LABOR_FREELANCE: 'Freelance',
  PRODUCTION:      'Production',
  TALENT:          'Talent',
  MEDIA_BUY:       'Media',
  OTHER:           'Other',
};

const CATEGORY_TONE: Record<CESLineItem['category'], string> = {
  LABOR_INTERNAL:  'bg-[var(--accent-soft)] text-[var(--accent)]',
  LABOR_FREELANCE: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  PRODUCTION:      'bg-[var(--rag-amber-soft)] text-[var(--rag-amber-deep)]',
  TALENT:          'bg-[var(--rag-green-soft)] text-[var(--rag-green-deep)]',
  MEDIA_BUY:       'bg-[var(--bg-sunken)] text-[var(--fg-secondary)]',
  OTHER:           'bg-[var(--bg-sunken)] text-[var(--fg-tertiary)]',
};

export function CesTable({ masterJob, linkedQuoteTotalMinor, defaultMarginFloorPct = 25 }: Props) {
  const ces: CES | undefined = masterJob.ces;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const items: CESLineItem[] = ces?.lineItems ?? [];
  const total = ces?.totalMinor ?? 0;
  const currency = (ces?.currency ?? masterJob.currency) as CESLineItem['currency'];
  const signedOff = !!ces?.signedOff;
  const lockedCurrency = items.length > 0 ? currency : undefined;

  const floor = useMemo(() => computeCesFloor(ces, defaultMarginFloorPct), [ces, defaultMarginFloorPct]);
  const belowFloor = useMemo(
    () => (typeof linkedQuoteTotalMinor === 'number'
      ? isQuoteBelowCesFloor(ces, linkedQuoteTotalMinor, defaultMarginFloorPct)
      : false),
    [ces, linkedQuoteTotalMinor, defaultMarginFloorPct],
  );

  const signOff = async () => {
    if (items.length === 0 || signedOff) return;
    setBusy(true);
    setErr(null);
    try {
      await signOffCesFn({ masterJobId: masterJob.id });
    } catch (e) {
      setErr(e instanceof FirebaseError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-testid="ces-table" className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)]">
            Cost Estimate Sheet
          </p>
          <p className="text-[12.5px] text-[var(--fg-secondary)]">
            Internal cost floor under the client-facing quote.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!signedOff && (
            <Button
              size="sm"
              data-testid="add-ces-line-item-btn"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              Add line item
            </Button>
          )}
          <Button
            size="sm"
            variant={signedOff ? 'outline' : 'default'}
            data-testid="ces-sign-off-btn"
            disabled={signedOff || items.length === 0 || busy}
            onClick={signOff}
          >
            <FileLock2 className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            {signedOff ? 'Signed off' : busy ? 'Signing…' : 'Sign off CES'}
          </Button>
        </div>
      </header>

      {err && (
        <p role="alert" data-testid="ces-error" className="text-[12px] text-[var(--rag-red)]">
          {err}
        </p>
      )}

      {/* Signed-off banner */}
      {signedOff && (
        <div
          data-testid="ces-signed-off-banner"
          className="flex items-start gap-2 p-3 rounded-md border border-[var(--rag-green)] bg-[var(--rag-green-soft)] text-[var(--rag-green-deep)]"
        >
          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div className="text-[12.5px] flex-1">
            <p>
              CES signed off. Total: <strong data-testid="ces-signed-total">{formatMinor(total, currency)}</strong>
              {typeof ces?.marginFloorPct === 'number' && (
                <> · margin floor {ces.marginFloorPct}%</>
              )}
            </p>
            {floor !== null && (
              <p className="mt-0.5 text-[11.5px]">
                Floor: <span data-testid="ces-floor">{formatMinor(floor, currency)}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Linked-quote comparison */}
      {typeof linkedQuoteTotalMinor === 'number' && floor !== null && (
        <div
          data-testid="ces-quote-comparison"
          className={cn(
            'flex items-start gap-2 p-3 rounded-md border',
            belowFloor
              ? 'border-[var(--rag-red)] bg-[var(--rag-red-soft)] text-[var(--rag-red-deep)]'
              : 'border-[var(--rag-green)] bg-[var(--rag-green-soft)] text-[var(--rag-green-deep)]',
          )}
        >
          {belowFloor ? (
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
          )}
          <p className="text-[12.5px]">
            Linked quote total:{' '}
            <strong data-testid="ces-quote-total">{formatMinor(linkedQuoteTotalMinor, currency)}</strong>
            {' · '}floor {formatMinor(floor, currency)}{' · '}
            {belowFloor ? (
              <strong data-testid="ces-below-floor">Below CES floor — review pricing.</strong>
            ) : (
              <span data-testid="ces-above-floor">Above CES floor.</span>
            )}
          </p>
        </div>
      )}

      {/* Line items */}
      {items.length === 0 ? (
        <p
          data-testid="ces-empty"
          className="text-[12.5px] text-[var(--fg-tertiary)] italic p-4 rounded-md border border-dashed border-[var(--border-default)] text-center"
        >
          No CES line items yet. Add internal labour, freelance, production, and media-buy estimates as they land.
        </p>
      ) : (
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--fg-tertiary)] border-b border-[var(--border-default)]">
              <th className="py-2 pr-3 font-medium">Category</th>
              <th className="py-2 pr-3 font-medium">Description</th>
              <th className="py-2 pr-3 font-medium">Qty</th>
              <th className="py-2 pr-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((line) => (
              <tr
                key={line.id}
                data-testid={`ces-line-${line.id}`}
                className="border-b border-[var(--border-default)] hover:bg-[var(--bg-sunken)]"
              >
                <td className="py-2 pr-3">
                  <span
                    data-testid={`ces-line-${line.id}-category`}
                    className={cn(
                      'inline-block text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded',
                      CATEGORY_TONE[line.category],
                    )}
                  >
                    {CATEGORY_LABEL[line.category]}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <p className="font-medium text-[var(--fg-primary)]">{line.description}</p>
                  {line.notes && (
                    <p className="text-[11px] text-[var(--fg-tertiary)]">{line.notes}</p>
                  )}
                </td>
                <td className="py-2 pr-3 text-[var(--fg-tertiary)]">
                  {line.quantity ? `${line.quantity}${line.unit ? ` ${line.unit}` : ''}` : '—'}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {formatMinor(line.amountMinor, line.currency)}
                </td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-2 pr-3" colSpan={3}>Total</td>
              <td
                data-testid="ces-total"
                className="py-2 pr-3 text-right tabular-nums"
              >
                {formatMinor(total, currency)}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      <CesLineItemDialog
        open={dialogOpen}
        masterJobId={masterJob.id}
        lockedCurrency={lockedCurrency}
        defaultCurrency={currency}
        onClose={() => setDialogOpen(false)}
      />
    </section>
  );
}
