/**
 * ExchangeRateManager - Exchange rate reference table
 *
 * Shows stored exchange rates for the program with columns:
 * From, To, Rate, Effective Date, Expires, Source, Notes.
 * Includes an expandable inline form to add new rates.
 */

import { useState, useMemo } from 'react';
import {
  TrendingUp,
  Plus,
  ChevronUp,
  Trash2,
  Coins,
} from 'lucide-react';
import type { ExchangeRateEntry, ExchangeRateSource } from '../../types/exchange-rate';

// ─────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────

interface ExchangeRateManagerProps {
  rates: ExchangeRateEntry[];
  loading?: boolean;
  onAddRate?: (data: {
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    effectiveDate: string;
    source: ExchangeRateSource;
    notes?: string;
  }) => void;
  onDeleteRate?: (rateId: string) => void;
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function formatDate(date: unknown): string {
  let d: Date;
  if (date instanceof Date) {
    d = date;
  } else if (date && typeof date === 'object' && 'toDate' in date && typeof (date as any).toDate === 'function') {
    d = (date as any).toDate();
  } else if (date && typeof date === 'object' && 'seconds' in date) {
    d = new Date((date as any).seconds * 1000);
  } else if (typeof date === 'string' || typeof date === 'number') {
    d = new Date(date);
  } else {
    return '--';
  }
  if (isNaN(d.getTime())) return '--';
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function formatRateNumber(rate: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(rate);
}

const SOURCE_LABELS: Record<ExchangeRateSource, { label: string; color: string }> = {
  manual: { label: 'Manual', color: 'text-gray-600 bg-gray-100' },
  reference: { label: 'Reference', color: 'text-blue-600 bg-blue-100' },
  bank_rate: { label: 'Bank Rate', color: 'text-green-600 bg-green-100' },
};

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function ExchangeRateManager({
  rates,
  loading = false,
  onAddRate,
  onDeleteRate,
}: ExchangeRateManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);

  // Sort rates by effective date descending
  const sortedRates = useMemo(
    () =>
      [...rates].sort((a, b) => {
        const toMs = (v: any): number => {
          if (v instanceof Date) return v.getTime();
          if (v && typeof v === 'object' && typeof v.toDate === 'function') return v.toDate().getTime();
          if (v && typeof v === 'object' && 'seconds' in v) return v.seconds * 1000;
          const d = new Date(v);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        return toMs(b.effectiveDate) - toMs(a.effectiveDate);
      }),
    [rates]
  );

  // ── Loading skeleton ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
          <div className="h-5 w-44 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h3 className="text-base font-semibold text-gray-900">
            Exchange Rates
          </h3>
          {rates.length > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
              {rates.length}
            </span>
          )}
        </div>

        {onAddRate && (
          <button
            onClick={() => setShowAddForm(prev => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors"
          >
            {showAddForm ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Close
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add Rate
              </>
            )}
          </button>
        )}
      </div>

      {/* Rates table */}
      {sortedRates.length === 0 && !showAddForm ? (
        <div className="text-center py-10 px-6">
          <Coins className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h4 className="text-base font-medium text-gray-900 mb-1">
            No exchange rates
          </h4>
          <p className="text-sm text-gray-500 mb-4">
            Reference exchange rates for this program will appear here.
          </p>
          {onAddRate && (
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add First Rate
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  From
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  To
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rate
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Effective
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                {onDeleteRate && (
                  <th className="w-10 px-4 py-3" />
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedRates.map(entry => {
                const sourceConfig = SOURCE_LABELS[entry.source];

                return (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {entry.fromCurrency}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {entry.toCurrency}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-900">
                      {formatRateNumber(entry.rate)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(entry.effectiveDate)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {entry.expiresDate ? formatDate(entry.expiresDate) : (
                        <span className="text-gray-300">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${sourceConfig.color}`}
                      >
                        {sourceConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">
                      {entry.notes || <span className="text-gray-300">--</span>}
                    </td>
                    {onDeleteRate && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => onDeleteRate(entry.id)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete rate"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add rate inline form */}
      {showAddForm && onAddRate && (
        <AddRateForm
          onAddRate={onAddRate}
          onCancel={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ADD RATE FORM (internal)
// ─────────────────────────────────────────────────────────────────

interface AddRateFormProps {
  onAddRate: (data: {
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    effectiveDate: string;
    source: ExchangeRateSource;
    notes?: string;
  }) => void;
  onCancel: () => void;
}

function AddRateForm({ onAddRate, onCancel }: AddRateFormProps) {
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('UGX');
  const [rate, setRate] = useState<number | ''>('');
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [source, setSource] = useState<ExchangeRateSource>('manual');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);

    if (!fromCurrency.trim()) {
      setError('From currency is required.');
      return;
    }
    if (!toCurrency.trim()) {
      setError('To currency is required.');
      return;
    }
    if (fromCurrency === toCurrency) {
      setError('From and To currencies must be different.');
      return;
    }
    if (!rate || Number(rate) <= 0) {
      setError('Rate must be greater than zero.');
      return;
    }
    if (!effectiveDate) {
      setError('Effective date is required.');
      return;
    }

    onAddRate({
      fromCurrency: fromCurrency.trim().toUpperCase(),
      toCurrency: toCurrency.trim().toUpperCase(),
      rate: Number(rate),
      effectiveDate,
      source,
      notes: notes.trim() || undefined,
    });

    // Reset form
    setRate('');
    setNotes('');
  };

  return (
    <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 rounded-b-xl">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Add New Rate</h4>

      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* From currency */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input
            type="text"
            value={fromCurrency}
            onChange={e => setFromCurrency(e.target.value)}
            maxLength={3}
            placeholder="USD"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        {/* To currency */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            type="text"
            value={toCurrency}
            onChange={e => setToCurrency(e.target.value)}
            maxLength={3}
            placeholder="UGX"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        {/* Rate */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Rate</label>
          <input
            type="number"
            value={rate}
            onChange={e => setRate(e.target.value === '' ? '' : Number(e.target.value))}
            min={0}
            step={0.01}
            placeholder="e.g. 3750"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        {/* Effective date */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Effective Date</label>
          <input
            type="date"
            value={effectiveDate}
            onChange={e => setEffectiveDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        {/* Source */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Source</label>
          <select
            value={source}
            onChange={e => setSource(e.target.value as ExchangeRateSource)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="manual">Manual</option>
            <option value="reference">Reference</option>
            <option value="bank_rate">Bank Rate</option>
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Rate preview */}
      {rate && fromCurrency && toCurrency && (
        <div className="mt-3 text-xs text-gray-500">
          Preview: 1 {fromCurrency.toUpperCase()} = {formatRateNumber(Number(rate))} {toCurrency.toUpperCase()}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mt-4">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Rate
        </button>
      </div>
    </div>
  );
}
