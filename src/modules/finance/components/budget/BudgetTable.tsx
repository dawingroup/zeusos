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
  manual: { label: 'Manual', color: 'bg-[var(--bg-sunken)] text-muted-foreground' },
  forecast: { label: 'Forecast', color: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]' },
  procurement: { label: 'Procure', color: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]' },
};

// ── Column Headers ──────────────────────────────────────────────────────────

interface HeaderProps {
  months: Array<{ label: string; fullLabel: string }>;
}

export function BudgetColumnHeaders({ months }: HeaderProps) {
  return (
    <tr>
      <th className="sticky left-0 z-40 bg-[var(--bg-sunken)] text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] border-b border-r border-[var(--border-subtle)] min-w-[220px] whitespace-nowrap">
        Account
      </th>
      {months.map((m, i) => (
        <th
          key={i}
          className="px-3 py-2.5 text-center font-medium text-muted-foreground text-[10px] border-b border-[var(--border-subtle)] bg-card min-w-[80px] whitespace-nowrap"
          title={m.fullLabel}
        >
          {m.label}
        </th>
      ))}
      <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground text-[10px] border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)] min-w-[88px] whitespace-nowrap">
        ANNUAL
      </th>
      <th className="px-3 py-2.5 text-center font-medium text-[var(--fg-tertiary)] text-[10px] border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)] min-w-[80px] whitespace-nowrap">
        ACTUAL
      </th>
      <th className="px-3 py-2.5 text-center font-medium text-[var(--fg-tertiary)] text-[10px] border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)] min-w-[80px] whitespace-nowrap">
        COMMIT
      </th>
      <th className="px-3 py-2.5 text-center font-medium text-[var(--fg-tertiary)] text-[10px] border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)] min-w-[80px] whitespace-nowrap">
        AVAIL
      </th>
      <th className="px-3 py-2.5 text-center font-medium text-[var(--fg-tertiary)] text-[10px] border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)] min-w-[70px] whitespace-nowrap">
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
    return <span className="tabular-nums text-muted-foreground">{fmt(value)}</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        className="w-full bg-[var(--rag-blue-soft)] border border-[var(--rag-blue)] rounded px-1 py-0.5 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--rag-blue)]"
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
      className="tabular-nums text-muted-foreground cursor-pointer hover:text-[var(--rag-blue)] hover:underline"
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
      className="bg-[var(--bg-sunken)] cursor-pointer hover:bg-[var(--bg-sunken)]/60 transition-colors"
      onClick={onToggle}
    >
      <td className="sticky left-0 z-20 px-4 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)] whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          {isExpanded
            ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
            {group.label}
          </span>
          <span className="text-[9px] text-[var(--fg-tertiary)] ml-1">({group.lines.length})</span>
        </div>
      </td>
      {/* Period totals when collapsed */}
      {!isExpanded ? (
        <SummaryValueCells totals={group.totals} bold />
      ) : (
        <>
          {group.totals.periods.map((_, i) => (
            <td key={i} className="px-3 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)]" />
          ))}
          {/* Annual, Actual, Committed, Available, Var% */}
          <td className="px-3 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)]" />
          <td className="px-3 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)]" />
          <td className="px-3 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)]" />
          <td className="px-3 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)]" />
          <td className="px-3 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)]" />
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
      className="group cursor-pointer hover:bg-[var(--rag-blue-soft)]/40 transition-colors"
      onClick={() => onRowClick(line.id)}
    >
      <td className="sticky left-0 z-20 pl-10 pr-4 py-2 border-b border-r border-[var(--border-subtle)] whitespace-nowrap bg-card text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="truncate max-w-[140px]" title={line.accountName}>
            {line.accountName}
          </span>
          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${badge.color}`}>
            {badge.label}
          </span>
          <ChevronRight className="h-3 w-3 text-[var(--fg-tertiary)] opacity-0 group-hover:opacity-100 ml-auto shrink-0" />
        </div>
      </td>
      {/* Period cells (editable) */}
      {Array.from({ length: 12 }).map((_, i) => {
        const pa = line.periodAmounts[i];
        return (
          <td
            key={i}
            className="px-2 py-2 text-right border-b border-[var(--border-subtle)] bg-card text-sm"
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
      <td className="px-3 py-2 text-right border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)] text-sm font-semibold tabular-nums text-foreground">
        {fmt(line.annualBudget)}
      </td>
      {/* Actual */}
      <td className="px-3 py-2 text-right border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)] text-sm tabular-nums text-muted-foreground">
        {fmt(line.annualActual)}
      </td>
      {/* Committed */}
      <td className="px-3 py-2 text-right border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)] text-sm tabular-nums text-muted-foreground">
        {fmt(line.annualCommitted)}
      </td>
      {/* Available */}
      <td className="px-3 py-2 text-right border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)] text-sm tabular-nums text-muted-foreground">
        {fmt(line.annualAvailable)}
      </td>
      {/* Variance % */}
      <td className="px-3 py-2 text-right border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)] text-sm tabular-nums font-medium" style={{ color: vpColor }}>
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
  const cls = bold ? 'font-semibold text-muted-foreground' : 'text-muted-foreground';
  const vpColor = totals.annualBudget > 0
    ? varianceColor((totals.annualVariance / totals.annualBudget) * 100)
    : VARIANCE_THRESHOLD_COLORS.favorable;

  return (
    <>
      {totals.periods.map((v, i) => (
        <td key={i} className={`px-3 py-2 text-right border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)] text-sm tabular-nums ${cls}`}>
          {fmt(v)}
        </td>
      ))}
      <td className={`px-3 py-2 text-right border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)] text-sm tabular-nums font-bold text-foreground`}>
        {fmt(totals.annualBudget)}
      </td>
      <td className="px-3 py-2 text-right border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)] text-sm tabular-nums text-muted-foreground">
        {fmt(totals.annualActual)}
      </td>
      <td className="px-3 py-2 text-right border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)] text-sm tabular-nums text-muted-foreground">
        {fmt(totals.annualCommitted)}
      </td>
      <td className="px-3 py-2 text-right border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)] text-sm tabular-nums text-muted-foreground">
        {fmt(totals.annualAvailable)}
      </td>
      <td className="px-3 py-2 text-right border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)] text-sm tabular-nums font-medium" style={{ color: vpColor }}>
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
    <tr className="bg-[var(--bg-sunken)] border-t-2 border-[var(--border-default)]">
      <td className="sticky left-0 z-20 px-4 py-2 bg-[var(--bg-sunken)] font-bold text-xs uppercase tracking-widest text-muted-foreground whitespace-nowrap">
        TOTAL
      </td>
      <SummaryValueCells totals={totals} bold />
    </tr>
  );
}
