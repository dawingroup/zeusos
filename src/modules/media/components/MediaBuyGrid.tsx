/**
 * MediaBuyGrid — tabular view of all buys within a plan.
 *
 * Columns: Vehicle (freeze left) | Type | Flight | Planned | Booked | Actual | Variance %
 */

import type { MediaBuy } from '../types/media-buy.types';
import { VehicleTypeBadge } from './VehicleTypeBadge';
import { computeVariancePct } from '../services/media-plan.service';

interface Props {
  buys: MediaBuy[];
  currency: string;
  onEditBuy?: (buy: MediaBuy) => void;
}

function fmtMinor(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

function VarianceCell({ planned, actual }: { planned: number; actual: number }) {
  const pct = computeVariancePct(planned, actual);
  if (planned === 0) return <td className="px-3 py-2 text-sm text-muted-foreground">—</td>;
  const color = pct > 10 ? 'text-destructive' : pct < -10 ? 'text-[var(--rag-green)]' : 'text-foreground';
  return (
    <td className={`px-3 py-2 text-right text-sm font-mono ${color}`}>
      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
    </td>
  );
}

export function MediaBuyGrid({ buys, currency, onEditBuy }: Props) {
  const totalPlanned = buys.reduce((s, b) => s + b.plannedMinor, 0);
  const totalBooked  = buys.reduce((s, b) => s + b.bookedMinor,  0);
  const totalActual  = buys.reduce((s, b) => s + b.actualMinor,  0);

  if (buys.length === 0) {
    return (
      <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
        No buys added yet. Use the Add Buy button to insert a channel/vehicle row.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="sticky left-0 bg-muted/40 px-3 py-2 text-left font-medium whitespace-nowrap">
              Vehicle
            </th>
            <th className="px-3 py-2 text-left font-medium">Type</th>
            <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Flight</th>
            <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Planned</th>
            <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Booked</th>
            <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Actual</th>
            <th className="px-3 py-2 text-right font-medium">Variance</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {buys.map((buy) => (
            <tr
              key={buy.id}
              className="hover:bg-muted/20 cursor-pointer"
              onClick={() => onEditBuy?.(buy)}
            >
              <td className="sticky left-0 bg-background px-3 py-2 font-medium whitespace-nowrap">
                {buy.vehicleName}
              </td>
              <td className="px-3 py-2">
                <VehicleTypeBadge type={buy.vehicleType} />
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                {buy.startDate} – {buy.endDate}
              </td>
              <td className="px-3 py-2 text-right font-mono">{fmtMinor(buy.plannedMinor, currency)}</td>
              <td className="px-3 py-2 text-right font-mono">{fmtMinor(buy.bookedMinor,  currency)}</td>
              <td className="px-3 py-2 text-right font-mono">{fmtMinor(buy.actualMinor,  currency)}</td>
              <VarianceCell planned={buy.plannedMinor} actual={buy.actualMinor} />
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t bg-muted/40 font-semibold">
          <tr>
            <td className="sticky left-0 bg-muted/40 px-3 py-2" colSpan={3}>Total</td>
            <td className="px-3 py-2 text-right font-mono">{fmtMinor(totalPlanned, currency)}</td>
            <td className="px-3 py-2 text-right font-mono">{fmtMinor(totalBooked,  currency)}</td>
            <td className="px-3 py-2 text-right font-mono">{fmtMinor(totalActual,  currency)}</td>
            <VarianceCell planned={totalPlanned} actual={totalActual} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
