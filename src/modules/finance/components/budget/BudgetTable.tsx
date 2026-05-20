// ============================================================================
// BUDGET TABLE COMPONENTS
// Shared table primitives for the budget spreadsheet.
// Mirrors ForecastPage patterns: frozen first column, collapsible sections,
// inline-editable value cells, variance coloring.
// ============================================================================

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { BudgetLineItem } from '../../types/budget.types';
import type { GroupedLines, PeriodTotals } from '../../hooks/useBudgetSpreadsheet';
import { VARIANCE_THRESHOLD_COLORS } from '../../constants/budget.constants';

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  if (v === 0) return '—';
  const abs = Math.abs(v);
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return v < 0 ? `(${formatted})` : formatted;
}

function varianceColor(variancePercent: number): string {
  if (variancePercent >= 0) return VARIANCE_THRESHOLD_COLORS.favorable;
  const abs = Math.abs(variancePercent);
  if (abs <= 5) return VARIANCE_THRESHOLD_COLORS.minor;
  if (abs <= 10) return VARIANCE_THRESHOLD_COLORS.moderate;
  if (abs <= 20) return VARIANCE_THRESHOLD_COLORS.significant;
  return VARIANCE_THRESHOLD_COLORS.critical;
}

const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
  manual: { label: 'Manual', color: 'bg-gray-100 text-gray-500' },
  forecast: { label: 'Forecast', color: 'bg-blue-100 text-blue-600' },
  procurement: { label: 'Procure', color: 'bg-amber-100 text-amber-700' },
};

// ── Column Headers ──────────────────────────────────────────────────────────

interface HeaderProps {
  months: Array<{ label: string; fullLabel: string }>;
}

export function BudgetColumnHeaders({ months }: HeaderProps) {
  return (
    <tr>
      <th className="sticky left-0 z-40 bg-gray-50 text-left px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px] border-b border-r border-gray-200 min-w-[220px] whitespace-nowrap">
        Account
      </th>
      {months.map((m, i) => (
        <th
          key={i}
          className="px-3 py-2.5 text-center font-medium text-gray-500 text-[10px] border-b border-gray-200 bg-white min-w-[80px] whitespace-nowrap"
          title={m.fullLabel}
        >
          {m.label}
        </th>
      ))}
      <th className="px-3 py-2.5 text-center font-semibold text-gray-600 text-[10px] border-b border-gray-200 bg-gray-50 min-w-[88px] whitespace-nowrap">
        ANNUAL
      </th>
      <th className="px-3 py-2.5 text-center font-medium text-gray-400 text-[10px] border-b border-gray-200 bg-gray-50 min-w-[80px] whitespace-nowrap">
        ACTUAL
      </th>
      <th className="px-3 py-2.5 text-center font-medium text-gray-400 text-[10px] border-b border-gray-200 bg-gray-50 min-w-[80px] whitespace-nowrap">
        COMMIT
      </th>
      <th className="px-3 py-2.5 text-center font-medium text-gray-400 text-[10px] border-b border-gray-200 bg-gray-50 min-w-[80px] whitespace-nowrap">
        AVAIL
      </th>
      <th className="px-3 py-2.5 text-center font-medium text-gray-400 text-[10px] border-b border-gray-200 bg-gray-50 min-w-[70px] whitespace-nowrap">
        VAR %
      </th>
    </tr>
  );
}

// ── Editable Cell ───────────────────────────────────────────────────────────

interface EditableCellProps {
  value: number;
  onSave: (value: number) => void;
  locked?: boolean;
}

function EditableCell({ value, onSave, locked }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (locked) {
    return <span className="tabular-nums text-gray-600">{fmt(value)}</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        className="w-full bg-blue-50 border border-blue-300 rounded px-1 py-0.5 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-400"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          const num = parseFloat(draft);
          if (!isNaN(num) && num !== value) {
            onSave(num);
          }
          setEditing(false);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            setEditing(false);
          } else if (e.key === 'Tab') {
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    );
  }

  return (
    <span
      className="tabular-nums text-gray-700 cursor-pointer hover:text-blue-600 hover:underline"
      onClick={() => {
        setDraft(String(value || ''));
        setEditing(true);
      }}
    >
      {fmt(value)}
    </span>
  );
}

// ── Section Row (collapsible group header) ─────────────────────────────────

interface SectionRowProps {
  group: GroupedLines;
  isExpanded: boolean;
  onToggle: () => void;
}

export function BudgetSectionRow({ group, isExpanded, onToggle }: SectionRowProps) {
  return (
    <tr
      className="bg-gray-100 cursor-pointer hover:bg-gray-200/60 transition-colors"
      onClick={onToggle}
    >
      <td className="sticky left-0 z-20 px-4 py-1.5 border-b border-gray-200 bg-gray-100 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          {isExpanded
            ? <ChevronDown className="h-3 w-3 text-gray-500 shrink-0" />
            : <ChevronRight className="h-3 w-3 text-gray-500 shrink-0" />}
          <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
            {group.label}
          </span>
          <span className="text-[9px] text-gray-400 ml-1">({group.lines.length})</span>
        </div>
      </td>
      {/* Period totals when collapsed */}
      {!isExpanded ? (
        <SummaryValueCells totals={group.totals} bold />
      ) : (
        <>
          {group.totals.periods.map((_, i) => (
            <td key={i} className="px-3 py-1.5 border-b border-gray-200 bg-gray-100" />
          ))}
          {/* Annual, Actual, Committed, Available, Var% */}
          <td className="px-3 py-1.5 border-b border-gray-200 bg-gray-100" />
          <td className="px-3 py-1.5 border-b border-gray-200 bg-gray-100" />
          <td className="px-3 py-1.5 border-b border-gray-200 bg-gray-100" />
          <td className="px-3 py-1.5 border-b border-gray-200 bg-gray-100" />
          <td className="px-3 py-1.5 border-b border-gray-200 bg-gray-100" />
        </>
      )}
    </tr>
  );
}

// ── Line Row ────────────────────────────────────────────────────────────────

interface LineRowProps {
  line: BudgetLineItem;
  onCellEdit: (lineId: string, periodIndex: number, value: number) => void;
  onRowClick: (lineId: string) => void;
}

export function BudgetLineRow({ line, onCellEdit, onRowClick }: LineRowProps) {
  const source = line.sourceType || 'manual';
  const badge = SOURCE_BADGES[source] || SOURCE_BADGES.manual;
  const vpColor = varianceColor(line.variancePercent);

  return (
    <tr
      className="group cursor-pointer hover:bg-blue-50/40 transition-colors"
      onClick={() => onRowClick(line.id)}
    >
      <td className="sticky left-0 z-20 pl-10 pr-4 py-2 border-b border-r border-gray-100 whitespace-nowrap bg-white text-gray-700">
        <div className="flex items-center gap-2">
          <span className="truncate max-w-[140px]" title={line.accountName}>
            {line.accountName}
          </span>
          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${badge.color}`}>
            {badge.label}
          </span>
          <ChevronRight className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 ml-auto shrink-0" />
        </div>
      </td>
      {/* Period cells (editable) */}
      {Array.from({ length: 12 }).map((_, i) => {
        const pa = line.periodAmounts[i];
        return (
          <td
            key={i}
            className="px-2 py-2 text-right border-b border-gray-100 bg-white text-sm"
            onClick={e => e.stopPropagation()}
          >
            <EditableCell
              value={pa?.budgetAmount || 0}
              onSave={val => onCellEdit(line.id, i, val)}
              locked={line.isLocked}
            />
          </td>
        );
      })}
      {/* Annual */}
      <td className="px-3 py-2 text-right border-b border-gray-100 bg-gray-50 text-sm font-semibold tabular-nums text-gray-800">
        {fmt(line.annualBudget)}
      </td>
      {/* Actual */}
      <td className="px-3 py-2 text-right border-b border-gray-100 bg-gray-50 text-sm tabular-nums text-gray-500">
        {fmt(line.annualActual)}
      </td>
      {/* Committed */}
      <td className="px-3 py-2 text-right border-b border-gray-100 bg-gray-50 text-sm tabular-nums text-gray-500">
        {fmt(line.annualCommitted)}
      </td>
      {/* Available */}
      <td className="px-3 py-2 text-right border-b border-gray-100 bg-gray-50 text-sm tabular-nums text-gray-600">
        {fmt(line.annualAvailable)}
      </td>
      {/* Variance % */}
      <td className="px-3 py-2 text-right border-b border-gray-100 bg-gray-50 text-sm tabular-nums font-medium" style={{ color: vpColor }}>
        {line.annualBudget > 0 ? `${line.variancePercent.toFixed(0)}%` : '—'}
      </td>
    </tr>
  );
}

// ── Summary Value Cells (for section totals / grand totals) ────────────────

interface SummaryValueCellsProps {
  totals: PeriodTotals;
  bold?: boolean;
}

export function SummaryValueCells({ totals, bold }: SummaryValueCellsProps) {
  const cls = bold ? 'font-semibold text-gray-700' : 'text-gray-500';
  const vpColor = totals.annualBudget > 0
    ? varianceColor((totals.annualVariance / totals.annualBudget) * 100)
    : VARIANCE_THRESHOLD_COLORS.favorable;

  return (
    <>
      {totals.periods.map((v, i) => (
        <td key={i} className={`px-3 py-2 text-right border-b border-gray-200 bg-gray-50 text-sm tabular-nums ${cls}`}>
          {fmt(v)}
        </td>
      ))}
      <td className={`px-3 py-2 text-right border-b border-gray-200 bg-gray-100 text-sm tabular-nums font-bold text-gray-800`}>
        {fmt(totals.annualBudget)}
      </td>
      <td className="px-3 py-2 text-right border-b border-gray-200 bg-gray-100 text-sm tabular-nums text-gray-500">
        {fmt(totals.annualActual)}
      </td>
      <td className="px-3 py-2 text-right border-b border-gray-200 bg-gray-100 text-sm tabular-nums text-gray-500">
        {fmt(totals.annualCommitted)}
      </td>
      <td className="px-3 py-2 text-right border-b border-gray-200 bg-gray-100 text-sm tabular-nums text-gray-600">
        {fmt(totals.annualAvailable)}
      </td>
      <td className="px-3 py-2 text-right border-b border-gray-200 bg-gray-100 text-sm tabular-nums font-medium" style={{ color: vpColor }}>
        {totals.annualBudget > 0
          ? `${((totals.annualVariance / totals.annualBudget) * 100).toFixed(0)}%`
          : '—'}
      </td>
    </>
  );
}

// ── Grand Totals Row ────────────────────────────────────────────────────────

interface GrandTotalsRowProps {
  totals: PeriodTotals;
}

export function GrandTotalsRow({ totals }: GrandTotalsRowProps) {
  return (
    <tr className="bg-gray-200 border-t-2 border-gray-300">
      <td className="sticky left-0 z-20 px-4 py-2 bg-gray-200 font-bold text-xs uppercase tracking-widest text-gray-600 whitespace-nowrap">
        TOTAL
      </td>
      <SummaryValueCells totals={totals} bold />
    </tr>
  );
}
