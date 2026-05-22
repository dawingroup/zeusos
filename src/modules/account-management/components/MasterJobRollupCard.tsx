/**
 * MasterJobRollupCard — KPI tiles for one master job. Renders the
 * allocation / ceiling, margin, and IWO state counts from a
 * `MasterJobRollup` (the §9.4 read shape).
 *
 * All math lives in `computeRollupTiles` (pure, vitest-covered).
 */

import type { MasterJobRollup } from '@/modules/assignment/hooks/useMasterJobRollup';
import { formatMinor } from '../utils/money';
import { computeRollupTiles } from '../utils/rollupTiles';

export function MasterJobRollupCard({ rollup }: { rollup: MasterJobRollup }) {
  const { allocPct, allocTone, marginTone, stateBreakdown } = computeRollupTiles(rollup);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile
        label="Allocation"
        value={`${allocPct}%`}
        sub={`${formatMinor(rollup.allocatedMinor, rollup.currency)} / ${formatMinor(rollup.ceilingMinor, rollup.currency)}`}
        tone={allocTone}
      />
      <Tile
        label="Margin"
        value={`${rollup.marginPct.toFixed(1)}%`}
        sub={`client total ${formatMinor(rollup.clientTotalMinor, rollup.currency)}`}
        tone={marginTone}
      />
      <Tile
        label="IWOs"
        value={String(rollup.workOrders.length)}
        sub={stateBreakdown || 'none yet'}
      />
      <Tile
        label="Client invoice"
        value={rollup.clientInvoice ? rollup.clientInvoice.status : '—'}
        sub={
          rollup.clientInvoice
            ? formatMinor(rollup.clientInvoice.amountMinor, rollup.clientInvoice.currency)
            : 'not yet raised'
        }
      />
    </div>
  );
}

interface TileProps {
  label: string;
  value: string;
  sub: string;
  tone?: 'green' | 'amber' | 'red';
}

function Tile({ label, value, sub, tone }: TileProps) {
  const toneClasses =
    tone === 'red' ? 'border-red-200 bg-red-50' :
    tone === 'amber' ? 'border-amber-200 bg-amber-50' :
    tone === 'green' ? 'border-emerald-200 bg-emerald-50' :
    'border-slate-200 bg-white';
  return (
    <div className={`rounded border p-3 ${toneClasses}`}>
      <div className="text-xs uppercase text-slate-600">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  );
}

export default MasterJobRollupCard;
