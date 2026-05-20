/**
 * CoInvestmentTracker - Donor & client co-investment tracking
 *
 * Displays a summary stats table, a stacked bar showing funding source breakdown,
 * a table of individual entries linked to projects, and an inline form to add new entries.
 */

import { useState, useMemo } from 'react';
import {
  HeartHandshake,
  Plus,
  ChevronUp,
  Trash2,
  CheckCircle2,
  Circle,
  Edit3,
  X,
  Save,
} from 'lucide-react';
import type {
  CoInvestmentEntry,
  CoInvestmentSummary,
  CoInvestmentSourceType,
} from '../../types/program-budget';
import { CO_INVESTMENT_SOURCE_CONFIG } from '../../types/program-budget';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface ProjectOption {
  id: string;
  name: string;
  projectCode: string;
}

// ─────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────

interface CoInvestmentTrackerProps {
  summary: CoInvestmentSummary;
  projects: ProjectOption[];
  loading?: boolean;
  onAddEntry?: (data: {
    projectId: string;
    projectName: string;
    sourceType: CoInvestmentSourceType;
    sourceName: string;
    pledgedAmount: number;
    currency: string;
    conditions?: string;
    isConfirmed?: boolean;
    notes?: string;
  }) => void;
  onUpdateEntry?: (entryId: string, updates: {
    disbursedAmount?: number;
    spentAmount?: number;
    pledgedAmount?: number;
    isConfirmed?: boolean;
    notes?: string;
  }) => void;
  onDeleteEntry?: (entryId: string) => void;
  currency?: string;
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function fmtMoney(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function pctLabel(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const SOURCE_BAR_COLORS: Record<CoInvestmentSourceType, string> = {
  donor: 'bg-blue-500',
  client: 'bg-emerald-500',
  government: 'bg-purple-500',
  other: 'bg-gray-400',
};

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function CoInvestmentTracker({
  summary,
  projects,
  loading = false,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  currency = 'USD',
}: CoInvestmentTrackerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Compute bar segments from the summary
  const barSegments = useMemo(() => {
    const total = summary.totalPledged.amount;
    if (total <= 0) return [];

    const types: CoInvestmentSourceType[] = ['donor', 'client', 'government', 'other'];
    return types
      .map(type => {
        const amount =
          type === 'donor' ? summary.donorTotal.amount :
          type === 'client' ? summary.clientTotal.amount :
          type === 'government' ? summary.governmentTotal.amount :
          summary.otherTotal.amount;
        return {
          type,
          amount,
          pct: (amount / total) * 100,
          color: SOURCE_BAR_COLORS[type],
          label: CO_INVESTMENT_SOURCE_CONFIG[type].label,
        };
      })
      .filter(s => s.amount > 0);
  }, [summary]);

  // ── Loading skeleton ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
          <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
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
          <HeartHandshake className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-semibold text-gray-900">
            Co-Investment Tracker
          </h3>
          {summary.entries.length > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
              {summary.entries.length}
            </span>
          )}
        </div>

        {onAddEntry && (
          <button
            onClick={() => setShowAddForm(prev => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            {showAddForm ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Close
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add Source
              </>
            )}
          </button>
        )}
      </div>

      {/* Summary stats table */}
      {summary.entries.length > 0 && (
        <div className="px-6 py-4 border-b border-gray-100">
          {/* Key metrics table */}
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Total Pledged</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Disbursed</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Co-Invest Ratio</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Leverage</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3 py-2 font-semibold text-gray-900">
                  {fmtMoney(summary.totalPledged.amount, currency)}
                </td>
                <td className="px-3 py-2 font-semibold text-green-600">
                  {fmtMoney(summary.totalDisbursed.amount, currency)}
                </td>
                <td className="px-3 py-2 font-semibold text-emerald-600">
                  {pctLabel(summary.coInvestmentRatio)}
                </td>
                <td className="px-3 py-2 font-semibold text-blue-600">
                  {summary.leverageRatio.toFixed(2)}x
                </td>
              </tr>
            </tbody>
          </table>

          {/* Stacked bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>Funding Sources</span>
              <span>{fmtMoney(summary.totalPledged.amount, currency)}</span>
            </div>
            <div className="flex h-6 rounded-lg overflow-hidden bg-gray-100">
              {barSegments.map(seg => (
                <div
                  key={seg.type}
                  className={`${seg.color} transition-all relative group`}
                  style={{ width: `${seg.pct}%` }}
                  title={`${seg.label}: ${fmtMoney(seg.amount, currency)} (${seg.pct.toFixed(1)}%)`}
                >
                  {seg.pct > 12 && (
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                      {seg.pct.toFixed(0)}%
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-2">
              {barSegments.map(seg => (
                <div key={seg.type} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded ${seg.color}`} />
                  <span className="text-xs text-gray-600">
                    {seg.label} ({fmtMoney(seg.amount, currency)})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Disbursement progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>Disbursement Progress</span>
              <span>{summary.disbursementRate.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${Math.min(summary.disbursementRate, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Entries table */}
      {summary.entries.length === 0 && !showAddForm ? (
        <div className="text-center py-10 px-6">
          <HeartHandshake className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h4 className="text-base font-medium text-gray-900 mb-1">
            No co-investment sources
          </h4>
          <p className="text-sm text-gray-500 mb-4">
            Track donor and client funding contributions here.
          </p>
          {onAddEntry && (
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add First Source
            </button>
          )}
        </div>
      ) : summary.entries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pledged
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Disbursed
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Spent
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                {(onUpdateEntry || onDeleteEntry) && (
                  <th className="w-20 px-4 py-3" />
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.entries.map(entry => (
                <CoInvestmentRow
                  key={entry.id}
                  entry={entry}
                  projects={projects}
                  currency={currency}
                  isEditing={editingId === entry.id}
                  onEdit={onUpdateEntry ? () => setEditingId(entry.id) : undefined}
                  onCancelEdit={() => setEditingId(null)}
                  onSaveEdit={onUpdateEntry ? (updates) => {
                    onUpdateEntry(entry.id, updates);
                    setEditingId(null);
                  } : undefined}
                  onDelete={onDeleteEntry ? () => onDeleteEntry(entry.id) : undefined}
                />
              ))}
            </tbody>
            {/* Totals footer */}
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr className="font-semibold text-gray-900">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right">
                  {fmtMoney(summary.totalPledged.amount, currency)}
                </td>
                <td className="px-4 py-3 text-right">
                  {fmtMoney(summary.totalDisbursed.amount, currency)}
                </td>
                <td className="px-4 py-3 text-right">
                  {fmtMoney(summary.totalSpent.amount, currency)}
                </td>
                <td className="px-4 py-3" />
                {(onUpdateEntry || onDeleteEntry) && <td className="px-4 py-3" />}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}

      {/* Add entry inline form */}
      {showAddForm && onAddEntry && (
        <AddCoInvestmentForm
          projects={projects}
          currency={currency}
          onSubmit={(data) => {
            onAddEntry(data);
            setShowAddForm(false);
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ROW COMPONENT (internal)
// ─────────────────────────────────────────────────────────────────

interface CoInvestmentRowProps {
  entry: CoInvestmentEntry;
  projects: ProjectOption[];
  currency: string;
  isEditing: boolean;
  onEdit?: () => void;
  onCancelEdit: () => void;
  onSaveEdit?: (updates: {
    disbursedAmount?: number;
    spentAmount?: number;
    pledgedAmount?: number;
    isConfirmed?: boolean;
    projectId?: string;
    projectName?: string;
  }) => void;
  onDelete?: () => void;
}

function CoInvestmentRow({
  entry,
  projects,
  currency,
  isEditing,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: CoInvestmentRowProps) {
  const [editDisbursed, setEditDisbursed] = useState(entry.disbursed.amount);
  const [editSpent, setEditSpent] = useState(entry.spent.amount);
  const [editPledged, setEditPledged] = useState(entry.pledged.amount);
  const [editProjectId, setEditProjectId] = useState(entry.projectId || '');

  const sourceConfig = CO_INVESTMENT_SOURCE_CONFIG[entry.sourceType];
  const disbursePct = entry.pledged.amount > 0
    ? (entry.disbursed.amount / entry.pledged.amount) * 100
    : 0;

  if (isEditing) {
    const selectedProject = projects.find(p => p.id === editProjectId);

    return (
      <tr className="bg-blue-50">
        <td className="px-4 py-3">
          <div className="font-medium text-gray-900">{entry.sourceName}</div>
        </td>
        <td className="px-4 py-3">
          <select
            value={editProjectId}
            onChange={e => setEditProjectId(e.target.value)}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No project</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.projectCode} — {p.name}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3 text-center">
          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${sourceConfig.color} ${sourceConfig.bgColor}`}>
            {sourceConfig.label}
          </span>
        </td>
        <td className="px-4 py-3">
          <input
            type="number"
            value={editPledged}
            onChange={e => setEditPledged(Number(e.target.value))}
            min={0}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="number"
            value={editDisbursed}
            onChange={e => setEditDisbursed(Number(e.target.value))}
            min={0}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="number"
            value={editSpent}
            onChange={e => setEditSpent(Number(e.target.value))}
            min={0}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </td>
        <td className="px-4 py-3" />
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onSaveEdit?.({
                pledgedAmount: editPledged,
                disbursedAmount: editDisbursed,
                spentAmount: editSpent,
                projectId: editProjectId || undefined,
                projectName: selectedProject?.name || undefined,
              })}
              className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
              title="Save"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={onCancelEdit}
              className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900">{entry.sourceName}</div>
        {entry.conditions && (
          <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">
            {entry.conditions}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {entry.projectName || '—'}
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${sourceConfig.color} ${sourceConfig.bgColor}`}>
          {sourceConfig.label}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-mono text-gray-900">
        {fmtMoney(entry.pledged.amount, currency)}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="font-mono text-gray-900">
          {fmtMoney(entry.disbursed.amount, currency)}
        </div>
        <div className="text-xs text-gray-400">{disbursePct.toFixed(0)}%</div>
      </td>
      <td className="px-4 py-3 text-right font-mono text-gray-900">
        {fmtMoney(entry.spent.amount, currency)}
      </td>
      <td className="px-4 py-3 text-center">
        {entry.isConfirmed ? (
          <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
        ) : (
          <Circle className="w-4 h-4 text-gray-300 mx-auto" />
        )}
      </td>
      {(onEdit || onDelete) && (
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Edit amounts"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete entry"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────
// ADD FORM (internal)
// ─────────────────────────────────────────────────────────────────

interface AddCoInvestmentFormProps {
  projects: ProjectOption[];
  currency: string;
  onSubmit: (data: {
    projectId: string;
    projectName: string;
    sourceType: CoInvestmentSourceType;
    sourceName: string;
    pledgedAmount: number;
    currency: string;
    conditions?: string;
    isConfirmed?: boolean;
    notes?: string;
  }) => void;
  onCancel: () => void;
}

function AddCoInvestmentForm({ projects, currency, onSubmit, onCancel }: AddCoInvestmentFormProps) {
  const [projectId, setProjectId] = useState('');
  const [sourceType, setSourceType] = useState<CoInvestmentSourceType>('donor');
  const [sourceName, setSourceName] = useState('');
  const [pledgedAmount, setPledgedAmount] = useState<number | ''>('');
  const [conditions, setConditions] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);

    if (!projectId) {
      setError('Please select a project.');
      return;
    }
    if (!sourceName.trim()) {
      setError('Source name is required.');
      return;
    }
    if (!pledgedAmount || Number(pledgedAmount) <= 0) {
      setError('Pledged amount must be greater than zero.');
      return;
    }

    const selectedProject = projects.find(p => p.id === projectId);

    onSubmit({
      projectId,
      projectName: selectedProject?.name ?? '',
      sourceType,
      sourceName: sourceName.trim(),
      pledgedAmount: Number(pledgedAmount),
      currency,
      conditions: conditions.trim() || undefined,
      isConfirmed,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 rounded-b-xl">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Add Co-Investment Source</h4>

      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Project picker */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Project</label>
          <select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select project...</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.projectCode} — {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Source type */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
          <select
            value={sourceType}
            onChange={e => setSourceType(e.target.value as CoInvestmentSourceType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="donor">Donor</option>
            <option value="client">Client</option>
            <option value="government">Government</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Source name */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
          <input
            type="text"
            value={sourceName}
            onChange={e => setSourceName(e.target.value)}
            placeholder="e.g. World Bank"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Pledged amount */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Pledged ({currency})
          </label>
          <input
            type="number"
            value={pledgedAmount}
            onChange={e => setPledgedAmount(e.target.value === '' ? '' : Number(e.target.value))}
            min={0}
            step={1000}
            placeholder="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Conditions */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Conditions</label>
          <input
            type="text"
            value={conditions}
            onChange={e => setConditions(e.target.value)}
            placeholder="Optional conditions"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Confirmed toggle + Actions */}
      <div className="flex items-center justify-between mt-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isConfirmed}
            onChange={e => setIsConfirmed(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">Confirmed</span>
        </label>

        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Source
          </button>
        </div>
      </div>
    </div>
  );
}
