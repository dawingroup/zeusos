/**
 * MicroForecastPanel
 * Slide-over panel for managing Phase 2 micro-forecasts:
 *  - CapEx Schedule (asset purchases + depreciation)
 *  - Loan Amortisation (debt + interest)
 *  - Capital Events (equity raise / buyback)
 *  - Dividend Schedule (cash distributions)
 *
 * Includes a visual "roadmap" timeline showing events across the forecast horizon.
 */

import { useState } from 'react';
import {
  X, Plus, Trash2, Wrench, Landmark, TrendingUp, Coins,
  CalendarClock, ChevronRight,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import type {
  CapExItem,
  LoanScheduleItem,
  CapitalEvent,
  DividendSchedule,
  MicroForecastInputs,
} from '../../types/forecast.types';
import { periodLabel, periodRange } from '../../types/forecast.types';

// ── Types ─────────────────────────────────────────────────────────────────────

type MicroTab = 'capex' | 'loans' | 'capital' | 'dividends';

interface Props {
  forecastId: string;
  micro: MicroForecastInputs;
  firstForecastPeriod: string;
  horizon: number;
  onSaveCapEx: (item: Omit<CapExItem, 'id' | 'forecastId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDeleteCapEx: (id: string) => Promise<void>;
  onSaveLoan: (item: Omit<LoanScheduleItem, 'id' | 'forecastId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDeleteLoan: (id: string) => Promise<void>;
  onSaveCapitalEvent: (item: Omit<CapitalEvent, 'id' | 'forecastId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDeleteCapitalEvent: (id: string) => Promise<void>;
  onSaveDividend: (item: Omit<DividendSchedule, 'id' | 'forecastId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDeleteDividend: (id: string) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtK(v: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
}

const TAB_CONFIG: Array<{ id: MicroTab; label: string; icon: typeof Wrench; color: string }> = [
  { id: 'capex',     label: 'CapEx',          icon: Wrench,       color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { id: 'loans',     label: 'Loans',          icon: Landmark,     color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'capital',   label: 'Capital Events', icon: TrendingUp,   color: 'text-green-600 bg-green-50 border-green-200' },
  { id: 'dividends', label: 'Dividends',      icon: Coins,        color: 'text-purple-600 bg-purple-50 border-purple-200' },
];

// ── Roadmap Timeline ──────────────────────────────────────────────────────────

export function RoadmapTimeline({
  micro,
  firstForecastPeriod,
  horizon,
}: {
  micro: MicroForecastInputs;
  firstForecastPeriod: string;
  horizon: number;
}) {
  const periods = periodRange(firstForecastPeriod, horizon);

  // Collect all events into a flat timeline
  type TimelineEvent = { period: string; type: MicroTab; label: string; amount: number };
  const events: TimelineEvent[] = [];

  for (const c of micro.capex) {
    events.push({ period: c.period, type: 'capex', label: c.name, amount: c.amount });
  }
  for (const l of micro.loans) {
    events.push({ period: l.startPeriod, type: 'loans', label: l.name, amount: l.principal });
  }
  for (const e of micro.capitalEvents) {
    events.push({ period: e.period, type: 'capital', label: e.name, amount: e.amount });
  }
  for (const d of micro.dividends) {
    events.push({ period: d.startPeriod, type: 'dividends', label: d.name, amount: d.amount });
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--fg-tertiary)] text-xs">
        <CalendarClock className="h-8 w-8 mx-auto mb-2 text-[var(--fg-tertiary)]" />
        No micro-forecast events yet. Add items below to see them on the timeline.
      </div>
    );
  }

  const colorMap: Record<MicroTab, string> = {
    capex: 'bg-orange-400', loans: 'bg-blue-400', capital: 'bg-green-400', dividends: 'bg-purple-400',
  };

  return (
    <div className="overflow-x-auto pb-2">
      <div className="relative min-w-[600px]">
        {/* Timeline bar */}
        <div className="h-1 bg-[var(--bg-sunken)] rounded-full mx-4 mt-4" />

        {/* Period markers */}
        <div className="flex justify-between px-4 mt-1 mb-6">
          {periods.filter((_, i) => i % 3 === 0).map(p => (
            <span key={p} className="text-[9px] text-[var(--fg-tertiary)]">{periodLabel(p)}</span>
          ))}
        </div>

        {/* Events positioned on the timeline */}
        <div className="space-y-1.5 px-2">
          {events
            .filter(e => e.period >= periods[0] && e.period <= periods[periods.length - 1])
            .sort((a, b) => a.period.localeCompare(b.period))
            .map((e, i) => {
              const idx = periods.indexOf(e.period);
              const pct = idx >= 0 ? (idx / (periods.length - 1)) * 100 : 0;
              return (
                <div key={`${e.type}_${i}`} className="relative h-6 flex items-center">
                  <div
                    className="absolute flex items-center gap-1"
                    style={{ left: `${Math.min(85, pct)}%` }}
                  >
                    <div className={`w-2 h-2 rounded-full ${colorMap[e.type]} shrink-0`} />
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {e.label} <span className="text-[var(--fg-tertiary)]">{fmtK(e.amount)}</span>
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

// ── CapEx Form ────────────────────────────────────────────────────────────────

function CapExForm({
  onSave,
  periods,
  saving,
}: {
  onSave: Props['onSaveCapEx'];
  periods: string[];
  saving: boolean;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [period, setPeriod] = useState(periods[0] ?? '');
  const [usefulLife, setUsefulLife] = useState(60);
  const [residual, setResidual] = useState(0);
  const [deprMethod, setDeprMethod] = useState<'straight_line' | 'none'>('straight_line');

  const handleSubmit = async () => {
    if (!name || amount <= 0) return;
    await onSave({
      name, amount, period,
      usefulLifeMonths: usefulLife,
      depreciationMethod: deprMethod,
      residualValue: residual,
    });
    setName(''); setAmount(0); setResidual(0);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Asset Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="mt-1 w-full border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs"
            placeholder="e.g. CNC Machine"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Purchase Amount</label>
          <input
            type="number"
            value={amount || ''}
            onChange={e => setAmount(parseFloat(e.target.value) || 0)}
            className="mt-1 w-full border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs"
            placeholder="50000"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Purchase Month</label>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="mt-1 w-full border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs bg-card"
          >
            {periods.map(p => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Useful Life (months)</label>
          <input
            type="number"
            value={usefulLife}
            onChange={e => setUsefulLife(parseInt(e.target.value) || 60)}
            className="mt-1 w-full border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Residual Value</label>
          <input
            type="number"
            value={residual || ''}
            onChange={e => setResidual(parseFloat(e.target.value) || 0)}
            className="mt-1 w-full border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs"
            placeholder="0"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Depreciation</label>
          <select
            value={deprMethod}
            onChange={e => setDeprMethod(e.target.value as 'straight_line' | 'none')}
            className="mt-1 w-full border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs bg-card"
          >
            <option value="straight_line">Straight Line</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>
      <Button size="sm" onClick={handleSubmit} disabled={saving || !name || amount <= 0}>
        <Plus className="h-3 w-3 mr-1" />Add CapEx Item
      </Button>
    </div>
  );
}

// ── Loan Form ─────────────────────────────────────────────────────────────────

function LoanForm({
  onSave,
  periods,
  saving,
}: {
  onSave: Props['onSaveLoan'];
  periods: string[];
  saving: boolean;
}) {
  const [name, setName] = useState('');
  const [principal, setPrincipal] = useState(0);
  const [rate, setRate] = useState(8);
  const [term, setTerm] = useState(60);
  const [start, setStart] = useState(periods[0] ?? '');
  const [type, setType] = useState<'new_loan' | 'existing'>('new_loan');
  const [paymentType, setPaymentType] = useState<'amortising' | 'interest_only' | 'bullet'>('amortising');

  const handleSubmit = async () => {
    if (!name || principal <= 0) return;
    await onSave({
      name, principal, annualRate: rate / 100, termMonths: term,
      startPeriod: start, type, paymentType,
    });
    setName(''); setPrincipal(0);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Loan Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="mt-1 w-full border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs"
            placeholder="e.g. Equipment Loan"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Principal</label>
          <input
            type="number"
            value={principal || ''}
            onChange={e => setPrincipal(parseFloat(e.target.value) || 0)}
            className="mt-1 w-full border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs"
            placeholder="100000"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Annual Rate (%)</label>
          <input
            type="number"
            value={rate}
            step={0.25}
            onChange={e => setRate(parseFloat(e.target.value) || 0)}
            className="mt-1 w-full border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Term (months)</label>
          <input
            type="number"
            value={term}
            onChange={e => setTerm(parseInt(e.target.value) || 60)}
            className="mt-1 w-full border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Start Month</label>
          <select
            value={start}
            onChange={e => setStart(e.target.value)}
            className="mt-1 w-full border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs bg-card"
          >
            {periods.map(p => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Type</label>
          <select
            value={type}
            onChange={e => setType(e.target.value as 'new_loan' | 'existing')}
            className="mt-1 w-full border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs bg-card"
          >
            <option value="new_loan">New Loan</option>
            <option value="existing">Existing Loan</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Repayment Structure</label>
          <div className="flex gap-2 mt-1">
            {(['amortising', 'interest_only', 'bullet'] as const).map(pt => (
              <button
                key={pt}
                onClick={() => setPaymentType(pt)}
                className={`flex-1 text-xs py-1.5 px-2 rounded border transition-colors ${
                  paymentType === pt
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-[var(--border-subtle)] text-muted-foreground hover:border-[var(--border-default)]'
                }`}
              >
                {pt === 'amortising' ? 'Amortising' : pt === 'interest_only' ? 'Interest Only' : 'Bullet'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Button size="sm" onClick={handleSubmit} disabled={saving || !name || principal <= 0}>
        <Plus className="h-3 w-3 mr-1" />Add Loan
      </Button>
    </div>
  );
}

// ── Capital Event Form ────────────────────────────────────────────────────────

function CapitalEventForm({
  onSave,
  periods,
  saving,
}: {
  onSave: Props['onSaveCapitalEvent'];
  periods: string[];
  saving: boolean;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [period, setPeriod] = useState(periods[0] ?? '');
  const [type, setType] = useState<'equity_raise' | 'equity_buyback'>('equity_raise');

  const handleSubmit = async () => {
    if (!name || amount <= 0) return;
    await onSave({ name, amount, period, type });
    setName(''); setAmount(0);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Event Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="mt-1 w-full border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs"
            placeholder="e.g. Series A"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Amount</label>
          <input
            type="number"
            value={amount || ''}
            onChange={e => setAmount(parseFloat(e.target.value) || 0)}
            className="mt-1 w-full border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs"
            placeholder="500000"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Month</label>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="mt-1 w-full border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs bg-card"
          >
            {periods.map(p => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Type</label>
          <select
            value={type}
            onChange={e => setType(e.target.value as 'equity_raise' | 'equity_buyback')}
            className="mt-1 w-full border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs bg-card"
          >
            <option value="equity_raise">Equity Raise</option>
            <option value="equity_buyback">Share Buyback</option>
          </select>
        </div>
      </div>
      <Button size="sm" onClick={handleSubmit} disabled={saving || !name || amount <= 0}>
        <Plus className="h-3 w-3 mr-1" />Add Capital Event
      </Button>
    </div>
  );
}

// ── Dividend Form ─────────────────────────────────────────────────────────────

function DividendForm({
  onSave,
  periods,
  saving,
}: {
  onSave: Props['onSaveDividend'];
  periods: string[];
  saving: boolean;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [start, setStart] = useState(periods[0] ?? '');
  const [frequency, setFrequency] = useState<DividendSchedule['frequency']>('quarterly');

  const handleSubmit = async () => {
    if (!name || amount <= 0) return;
    await onSave({ name, amount, startPeriod: start, frequency, endPeriod: null });
    setName(''); setAmount(0);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="mt-1 w-full border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs"
            placeholder="e.g. Shareholder Dividend"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Amount per Payment</label>
          <input
            type="number"
            value={amount || ''}
            onChange={e => setAmount(parseFloat(e.target.value) || 0)}
            className="mt-1 w-full border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs"
            placeholder="25000"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Start Month</label>
          <select
            value={start}
            onChange={e => setStart(e.target.value)}
            className="mt-1 w-full border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs bg-card"
          >
            {periods.map(p => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Frequency</label>
          <select
            value={frequency}
            onChange={e => setFrequency(e.target.value as DividendSchedule['frequency'])}
            className="mt-1 w-full border border-[var(--border-default)] rounded-md px-2 py-1.5 text-xs bg-card"
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="semi_annual">Semi-Annual</option>
            <option value="annual">Annual</option>
            <option value="once">One-Off</option>
          </select>
        </div>
      </div>
      <Button size="sm" onClick={handleSubmit} disabled={saving || !name || amount <= 0}>
        <Plus className="h-3 w-3 mr-1" />Add Dividend
      </Button>
    </div>
  );
}

// ── Item list row ─────────────────────────────────────────────────────────────

function ItemRow({
  label,
  sublabel,
  amount,
  onDelete,
  color,
}: {
  label: string;
  sublabel: string;
  amount: number;
  onDelete: () => void;
  color: string;
}) {
  return (
    <div className={`flex items-center justify-between py-2 px-3 rounded-lg border ${color} text-xs`}>
      <div className="flex items-center gap-2 min-w-0">
        <ChevronRight className="h-3 w-3 shrink-0 opacity-40" />
        <div className="min-w-0">
          <p className="font-medium truncate">{label}</p>
          <p className="text-[10px] opacity-60">{sublabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-semibold">{fmtK(amount)}</span>
        <button
          onClick={onDelete}
          className="text-[var(--fg-tertiary)] hover:text-red-500 transition-colors p-0.5"
          title="Remove"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INLINE CONTENT — for embedding in a tab (no slide-over wrapper)
// ═══════════════════════════════════════════════════════════════════════════════

export function MicroForecastContent({
  micro,
  firstForecastPeriod,
  horizon,
  onSaveCapEx,
  onDeleteCapEx,
  onSaveLoan,
  onDeleteLoan,
  onSaveCapitalEvent,
  onDeleteCapitalEvent,
  onSaveDividend,
  onDeleteDividend,
  saving,
}: Omit<Props, 'onClose' | 'forecastId'>) {
  const [activeTab, setActiveTab] = useState<MicroTab>('capex');
  const periods = periodRange(firstForecastPeriod, horizon);

  const totalCount = micro.capex.length + micro.loans.length
    + micro.capitalEvents.length + micro.dividends.length;

  return (
    <div className="p-5 space-y-5">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {totalCount} scheduled event{totalCount !== 1 ? 's' : ''} across the forecast horizon
        </p>
      </div>

      {/* Tab Pills */}
      <div className="flex gap-1.5 bg-[var(--bg-sunken)] rounded-full p-1 w-fit">
        {TAB_CONFIG.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-muted-foreground'
              }`}
            >
              <Icon className="h-3 w-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'capex' && (
          <>
            {micro.capex.length > 0 && (
              <div className="space-y-1.5">
                {micro.capex.map(item => (
                  <ItemRow
                    key={item.id}
                    label={item.name}
                    sublabel={`${periodLabel(item.period)} · ${item.usefulLifeMonths}mo life · ${item.depreciationMethod === 'straight_line' ? 'SL D&A' : 'No D&A'}`}
                    amount={item.amount}
                    onDelete={() => onDeleteCapEx(item.id)}
                    color="bg-orange-50 border-orange-200 text-orange-800"
                  />
                ))}
              </div>
            )}
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Add Capital Expenditure</p>
              <CapExForm onSave={onSaveCapEx} periods={periods} saving={saving} />
            </div>
          </>
        )}

        {activeTab === 'loans' && (
          <>
            {micro.loans.length > 0 && (
              <div className="space-y-1.5">
                {micro.loans.map(item => (
                  <ItemRow
                    key={item.id}
                    label={item.name}
                    sublabel={`${periodLabel(item.startPeriod)} · ${(item.annualRate * 100).toFixed(1)}% · ${item.termMonths}mo · ${item.paymentType}`}
                    amount={item.principal}
                    onDelete={() => onDeleteLoan(item.id)}
                    color="bg-blue-50 border-blue-200 text-blue-800"
                  />
                ))}
              </div>
            )}
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Add Loan / Debt</p>
              <LoanForm onSave={onSaveLoan} periods={periods} saving={saving} />
            </div>
          </>
        )}

        {activeTab === 'capital' && (
          <>
            {micro.capitalEvents.length > 0 && (
              <div className="space-y-1.5">
                {micro.capitalEvents.map(item => (
                  <ItemRow
                    key={item.id}
                    label={item.name}
                    sublabel={`${periodLabel(item.period)} · ${item.type === 'equity_raise' ? 'Raise' : 'Buyback'}`}
                    amount={item.amount}
                    onDelete={() => onDeleteCapitalEvent(item.id)}
                    color="bg-green-50 border-green-200 text-green-800"
                  />
                ))}
              </div>
            )}
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Add Capital Event</p>
              <CapitalEventForm onSave={onSaveCapitalEvent} periods={periods} saving={saving} />
            </div>
          </>
        )}

        {activeTab === 'dividends' && (
          <>
            {micro.dividends.length > 0 && (
              <div className="space-y-1.5">
                {micro.dividends.map(item => (
                  <ItemRow
                    key={item.id}
                    label={item.name}
                    sublabel={`From ${periodLabel(item.startPeriod)} · ${item.frequency}`}
                    amount={item.amount}
                    onDelete={() => onDeleteDividend(item.id)}
                    color="bg-purple-50 border-purple-200 text-purple-800"
                  />
                ))}
              </div>
            )}
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Add Dividend Schedule</p>
              <DividendForm onSave={onSaveDividend} periods={periods} saving={saving} />
            </div>
          </>
        )}
      </div>

      <p className="text-[10px] text-[var(--fg-tertiary)] pt-2 border-t">
        Changes trigger automatic three-way recalculation
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE-OVER PANEL (legacy — kept for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

export function MicroForecastPanel({
  micro,
  firstForecastPeriod,
  horizon,
  onSaveCapEx,
  onDeleteCapEx,
  onSaveLoan,
  onDeleteLoan,
  onSaveCapitalEvent,
  onDeleteCapitalEvent,
  onSaveDividend,
  onDeleteDividend,
  onClose,
  saving,
}: Props) {
  const [activeTab, setActiveTab] = useState<MicroTab>('capex');
  const periods = periodRange(firstForecastPeriod, horizon);

  const totalCount = micro.capex.length + micro.loans.length
    + micro.capitalEvents.length + micro.dividends.length;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-2xl bg-card shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div>
            <h3 className="font-semibold text-foreground text-sm">Micro Forecasts & Roadmap</h3>
            <p className="text-xs text-[var(--fg-tertiary)] mt-0.5">
              {totalCount} scheduled event{totalCount !== 1 ? 's' : ''} across the forecast horizon
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--fg-tertiary)] hover:text-muted-foreground rounded-md p-1 hover:bg-[var(--bg-sunken)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Roadmap Timeline */}
          <div className="px-5 pt-4 pb-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Forecast Roadmap
            </p>
            <div className="bg-[var(--bg-sunken)] rounded-lg p-3 border border-[var(--border-subtle)]">
              <RoadmapTimeline
                micro={micro}
                firstForecastPeriod={firstForecastPeriod}
                horizon={horizon}
              />
            </div>
          </div>

          {/* Tab Pills */}
          <div className="px-5 pt-3 pb-2">
            <div className="flex gap-1.5 bg-[var(--bg-sunken)] rounded-full p-1 w-fit">
              {TAB_CONFIG.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-card shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="px-5 py-3 space-y-4">
            {/* Existing items */}
            {activeTab === 'capex' && (
              <>
                {micro.capex.length > 0 && (
                  <div className="space-y-1.5">
                    {micro.capex.map(item => (
                      <ItemRow
                        key={item.id}
                        label={item.name}
                        sublabel={`${periodLabel(item.period)} · ${item.usefulLifeMonths}mo life · ${item.depreciationMethod === 'straight_line' ? 'SL D&A' : 'No D&A'}`}
                        amount={item.amount}
                        onDelete={() => onDeleteCapEx(item.id)}
                        color="bg-orange-50 border-orange-200 text-orange-800"
                      />
                    ))}
                  </div>
                )}
                <div className="border-t pt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Add Capital Expenditure</p>
                  <CapExForm onSave={onSaveCapEx} periods={periods} saving={saving} />
                </div>
              </>
            )}

            {activeTab === 'loans' && (
              <>
                {micro.loans.length > 0 && (
                  <div className="space-y-1.5">
                    {micro.loans.map(item => (
                      <ItemRow
                        key={item.id}
                        label={item.name}
                        sublabel={`${periodLabel(item.startPeriod)} · ${(item.annualRate * 100).toFixed(1)}% · ${item.termMonths}mo · ${item.paymentType}`}
                        amount={item.principal}
                        onDelete={() => onDeleteLoan(item.id)}
                        color="bg-blue-50 border-blue-200 text-blue-800"
                      />
                    ))}
                  </div>
                )}
                <div className="border-t pt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Add Loan / Debt</p>
                  <LoanForm onSave={onSaveLoan} periods={periods} saving={saving} />
                </div>
              </>
            )}

            {activeTab === 'capital' && (
              <>
                {micro.capitalEvents.length > 0 && (
                  <div className="space-y-1.5">
                    {micro.capitalEvents.map(item => (
                      <ItemRow
                        key={item.id}
                        label={item.name}
                        sublabel={`${periodLabel(item.period)} · ${item.type === 'equity_raise' ? 'Raise' : 'Buyback'}`}
                        amount={item.amount}
                        onDelete={() => onDeleteCapitalEvent(item.id)}
                        color="bg-green-50 border-green-200 text-green-800"
                      />
                    ))}
                  </div>
                )}
                <div className="border-t pt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Add Capital Event</p>
                  <CapitalEventForm onSave={onSaveCapitalEvent} periods={periods} saving={saving} />
                </div>
              </>
            )}

            {activeTab === 'dividends' && (
              <>
                {micro.dividends.length > 0 && (
                  <div className="space-y-1.5">
                    {micro.dividends.map(item => (
                      <ItemRow
                        key={item.id}
                        label={item.name}
                        sublabel={`From ${periodLabel(item.startPeriod)} · ${item.frequency}`}
                        amount={item.amount}
                        onDelete={() => onDeleteDividend(item.id)}
                        color="bg-purple-50 border-purple-200 text-purple-800"
                      />
                    ))}
                  </div>
                )}
                <div className="border-t pt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Add Dividend Schedule</p>
                  <DividendForm onSave={onSaveDividend} periods={periods} saving={saving} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t bg-[var(--bg-sunken)] shrink-0">
          <p className="text-[10px] text-[var(--fg-tertiary)]">
            Changes trigger automatic three-way recalculation
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
