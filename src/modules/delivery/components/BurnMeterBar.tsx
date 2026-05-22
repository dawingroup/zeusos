/**
 * BurnMeterBar — visual rendering of `computeBurnMeter` output. Pure
 * presentation; the calculation lives in `services/burnMeter.ts` so it
 * can be unit-tested without a DOM.
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
  const fillColor =
    meter.status === 'BLOCKED' ? '#b91c1c' :
    meter.status === 'WARN'    ? '#b45309' :
                                  '#15803d';
  return (
    <div>
      <div style={{
        position: 'relative',
        height: 16,
        background: '#f1f5f9',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          width: `${meter.percentage}%`,
          background: fillColor,
          transition: 'width 200ms ease-out',
        }} />
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginTop: 6, fontSize: 12, color: '#475569',
      }}>
        <span>{meter.percentage.toFixed(1)}% used</span>
        <span>{formatMinor(meter.cumulativeMinor, currency)} of {formatMinor(meter.budgetMinor, currency)}</span>
      </div>
      {meter.status === 'WARN' && (
        <div role="alert" style={{
          marginTop: 12, padding: 12, borderRadius: 6,
          background: '#fef2f2', color: '#7f1d1d', border: '1px solid #fecaca',
          fontSize: 13,
        }}>
          ≥ 90 % of budget consumed — request a change order before the hard 100 % block kicks in.
        </div>
      )}
      {meter.status === 'BLOCKED' && (
        <div role="alert" style={{
          marginTop: 12, padding: 12, borderRadius: 6,
          background: '#7f1d1d', color: '#fff',
          fontSize: 13,
        }}>
          Budget exhausted. Further time and cost posts will be rejected by the server.
          Raise a change order with account management to continue.
        </div>
      )}
    </div>
  );
}
