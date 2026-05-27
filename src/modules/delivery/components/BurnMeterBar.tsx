/**
 * BurnMeterBar — visual rendering of `computeBurnMeter` output. Pure
 * presentation; the calculation lives in `services/burnMeter.ts` so it
 * can be unit-tested without a DOM.
 *
 * Refactored U.4 from inline-styled scaffolding to spec-aligned tokens:
 *   - .dawin-bar with .ok / .warn / .over status classes (spec §11.1)
 *   - .rag amber / .rag red alert pills for the warn/blocked banners
 *   - Token classNames throughout; no inline styles except dynamic width
 */

import type { BurnMeter } from '../services/burnMeter';

function formatMinor(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function BurnMeterBar({
  meter,
  currency,
}: {
  meter: BurnMeter;
  currency: string;
}) {
  const barClass =
    meter.status === 'BLOCKED' ? 'dawin-bar over' :
    meter.status === 'WARN'    ? 'dawin-bar warn' :
                                  'dawin-bar ok';

  return (
    <div>
      <div className={barClass} style={{ height: 16 }}>
        <span style={{ width: `${meter.percentage}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-tiny text-muted-foreground tabular">
        <span>{meter.percentage.toFixed(1)}% used</span>
        <span>{formatMinor(meter.cumulativeMinor, currency)} of {formatMinor(meter.budgetMinor, currency)}</span>
      </div>
      {meter.status === 'WARN' && (
        <div
          role="alert"
          className="mt-3 px-3 py-3 rounded-md text-small bg-[var(--rag-red-soft)] text-[var(--rag-red)] border border-[var(--rag-red)]/30"
        >
          ≥ 90 % of budget consumed — request a change order before the hard 100 % block kicks in.
        </div>
      )}
      {meter.status === 'BLOCKED' && (
        <div
          role="alert"
          className="mt-3 px-3 py-3 rounded-md text-small bg-[var(--rag-red)] text-background"
        >
          Budget exhausted. Further time and cost posts will be rejected by the server.
          Raise a change order with account management to continue.
        </div>
      )}
    </div>
  );
}
