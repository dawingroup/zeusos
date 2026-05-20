/**
 * DATA RECONCILIATION PAGE
 *
 * Table of accountability entries with unresolved variances. Allows filtering
 * by project, category, date range, and variance severity. Supports bulk
 * actions: Mark Resolved, Request Clarification, Flag for Audit.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Receipt,
  Flag,
  MessageSquare,
  ArrowUpDown,
} from 'lucide-react';
import { collection, query, getDocs, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../../firebase/config';
import { useAuth } from '../../../../core/hooks/useAuth';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface ReconciliationEntry {
  id: string;
  accountabilityId: string;
  description: string;
  amount: number;
  budgetedAmount: number;
  variance: number;
  variancePercent: number;
  varianceSeverity: 'none' | 'minor' | 'significant' | 'critical';
  category: string;
  projectId: string;
  projectName: string;
  vendor: string;
  date: string;
  requisitionRef: string | null;
  requisitionNumber: string | null;
  hasReceipt: boolean;
  status: 'unresolved' | 'resolved' | 'flagged' | 'clarification_requested';
  resolvedBy?: string;
  resolvedAt?: string;
  notes?: string;
}

type SeverityFilter = 'all' | 'minor' | 'significant' | 'critical';
type StatusFilter = 'all' | 'unresolved' | 'resolved' | 'flagged' | 'clarification_requested';

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function DataReconciliationPage() {
  const { user } = useAuth();
  const organizationId = (user as any)?.organizationId || 'default';
  const [entries, setEntries] = useState<ReconciliationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('unresolved');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Sort
  const [sortField, setSortField] = useState<'date' | 'amount' | 'variance'>('variance');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ─────────────────────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!organizationId) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const accSnap = await getDocs(
          query(
            collection(db, `organizations/${organizationId}/accountabilities`)
          )
        );

        const reconciliationEntries: ReconciliationEntry[] = [];

        for (const accDoc of accSnap.docs) {
          const acc = accDoc.data() as Record<string, any>;
          const expenses = acc.expenses || [];

          for (const exp of expenses) {
            const amount = exp.amount || 0;
            const budgeted = exp.budgetedAmount || amount; // If no budget, no variance
            const variance = amount - budgeted;
            const variancePct = budgeted > 0 ? Math.abs(variance / budgeted) * 100 : 0;

            let severity: ReconciliationEntry['varianceSeverity'] = 'none';
            if (variancePct > 20) severity = 'critical';
            else if (variancePct > 10) severity = 'significant';
            else if (variancePct > 5) severity = 'minor';

            reconciliationEntries.push({
              id: `${accDoc.id}_${exp.lineNumber || exp.id || Math.random().toString(36).slice(2)}`,
              accountabilityId: accDoc.id,
              description: exp.description || '—',
              amount,
              budgetedAmount: budgeted,
              variance,
              variancePercent: variancePct,
              varianceSeverity: severity,
              category: exp.category || 'other',
              projectId: acc.projectId || '',
              projectName: acc.projectName || '—',
              vendor: exp.vendor || '—',
              date: exp.date?.toDate?.()?.toISOString?.()?.split('T')[0]
                || (typeof exp.date === 'string' ? exp.date : '—'),
              requisitionRef: acc.requisitionId || null,
              requisitionNumber: acc.requisitionNumber || null,
              hasReceipt: (exp.documents?.length || 0) > 0,
              status: exp.reconciliationStatus || 'unresolved',
              resolvedBy: exp.resolvedBy,
              resolvedAt: exp.resolvedAt,
              notes: exp.reconciliationNotes,
            });
          }
        }

        setEntries(reconciliationEntries);
      } catch (err) {
        console.error('Failed to load reconciliation data:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [organizationId]);

  // ─────────────────────────────────────────────────────────────
  // DERIVED DATA
  // ─────────────────────────────────────────────────────────────

  const projects = useMemo(() => {
    const set = new Map<string, string>();
    entries.forEach((e) => set.set(e.projectId, e.projectName));
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [entries]);

  const categories = useMemo(() => {
    return [...new Set(entries.map((e) => e.category))].sort();
  }, [entries]);

  const filteredEntries = useMemo(() => {
    let result = entries;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          e.vendor.toLowerCase().includes(q) ||
          e.projectName.toLowerCase().includes(q)
      );
    }

    if (projectFilter !== 'all') result = result.filter((e) => e.projectId === projectFilter);
    if (categoryFilter !== 'all') result = result.filter((e) => e.category === categoryFilter);
    if (severityFilter !== 'all') result = result.filter((e) => e.varianceSeverity === severityFilter);
    if (statusFilter !== 'all') result = result.filter((e) => e.status === statusFilter);
    if (dateFrom) result = result.filter((e) => e.date >= dateFrom);
    if (dateTo) result = result.filter((e) => e.date <= dateTo);

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = a.date.localeCompare(b.date);
      else if (sortField === 'amount') cmp = a.amount - b.amount;
      else cmp = Math.abs(a.variancePercent) - Math.abs(b.variancePercent);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [entries, searchQuery, projectFilter, categoryFilter, severityFilter, statusFilter, dateFrom, dateTo, sortField, sortDir]);

  const stats = useMemo(() => ({
    total: entries.length,
    unresolved: entries.filter((e) => e.status === 'unresolved').length,
    critical: entries.filter((e) => e.varianceSeverity === 'critical').length,
    totalVariance: entries.reduce((s, e) => s + Math.abs(e.variance), 0),
  }), [entries]);

  // ─────────────────────────────────────────────────────────────
  // BULK ACTIONS
  // ─────────────────────────────────────────────────────────────

  const handleBulkAction = useCallback(async (action: 'resolve' | 'clarify' | 'flag') => {
    if (!organizationId || selectedIds.size === 0) return;
    setBulkActionLoading(true);

    try {
      const batch = writeBatch(db);
      const statusMap = {
        resolve: 'resolved',
        clarify: 'clarification_requested',
        flag: 'flagged',
      } as const;

      // Group by accountability doc
      const byAcc = new Map<string, ReconciliationEntry[]>();
      for (const entry of entries) {
        if (!selectedIds.has(entry.id)) continue;
        const existing = byAcc.get(entry.accountabilityId) || [];
        existing.push(entry);
        byAcc.set(entry.accountabilityId, existing);
      }

      // Note: In a real implementation, we'd update specific expense items
      // within the accountability doc. For now, we update at doc level.
      for (const [accId] of byAcc) {
        const accRef = doc(db, `organizations/${organizationId}/accountabilities`, accId);
        batch.update(accRef, {
          reconciliationStatus: statusMap[action],
          reconciliationUpdatedAt: serverTimestamp(),
          reconciliationUpdatedBy: user?.uid || '',
        });
      }

      await batch.commit();

      // Update local state
      setEntries((prev) =>
        prev.map((e) =>
          selectedIds.has(e.id)
            ? { ...e, status: statusMap[action] }
            : e
        )
      );
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Bulk action failed:', err);
      setError('Bulk action failed. Please try again.');
    } finally {
      setBulkActionLoading(false);
    }
  }, [organizationId, selectedIds, entries, user?.uid]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEntries.map((e) => e.id)));
    }
  };

  const toggleSort = (field: 'date' | 'amount' | 'variance') => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  // ─────────────────────────────────────────────────────────────
  // SEVERITY BADGE
  // ─────────────────────────────────────────────────────────────

  function SeverityBadge({ severity }: { severity: string }) {
    const styles: Record<string, string> = {
      none: 'bg-gray-100 text-gray-600',
      minor: 'bg-yellow-100 text-yellow-700',
      significant: 'bg-orange-100 text-orange-700',
      critical: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[severity] || styles.none}`}>
        {severity === 'critical' && <AlertTriangle className="w-3 h-3" />}
        {severity}
      </span>
    );
  }

  function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { class: string; icon: typeof CheckCircle2 }> = {
      unresolved: { class: 'bg-gray-100 text-gray-600', icon: Clock },
      resolved: { class: 'bg-green-100 text-green-700', icon: CheckCircle2 },
      flagged: { class: 'bg-red-100 text-red-700', icon: Flag },
      clarification_requested: { class: 'bg-blue-100 text-blue-700', icon: MessageSquare },
    };
    const { class: className, icon: Icon } = config[status] || config.unresolved;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ')}
      </span>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Data Reconciliation</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review and resolve variance entries across accountability records
        </p>
      </div>

      {/* Summary Cards */}
      <div className="mb-6">
        <KPIGrid cols={4}>
          <KPICard label="Total Entries" value={stats.total} />
          <KPICard
            label="Unresolved"
            value={stats.unresolved}
            trend={stats.unresolved > 0 ? 'down' : undefined}
          />
          <KPICard
            label="Critical"
            value={stats.critical}
            trend={stats.critical > 0 ? 'down' : undefined}
          />
          <KPICard
            label="Total Variance"
            value={`UGX ${stats.totalVariance.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          />
        </KPIGrid>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-lg border mb-4">
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search description, vendor, project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 border-t pt-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Project</label>
              <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm">
                <option value="all">All Projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm">
                <option value="all">All Categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Severity</label>
              <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm">
                <option value="all">All</option>
                <option value="minor">Minor</option>
                <option value="significant">Significant</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm">
                <option value="all">All</option>
                <option value="unresolved">Unresolved</option>
                <option value="resolved">Resolved</option>
                <option value="flagged">Flagged</option>
                <option value="clarification_requested">Clarification</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date Range</label>
              <div className="flex gap-1">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="flex-1 border rounded-lg px-2 py-1.5 text-xs" />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="flex-1 border rounded-lg px-2 py-1.5 text-xs" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm font-medium text-blue-800">
            {selectedIds.size} item{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkAction('resolve')}
              disabled={bulkActionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark Resolved
            </button>
            <button
              onClick={() => handleBulkAction('clarify')}
              disabled={bulkActionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Request Clarification
            </button>
            <button
              onClick={() => handleBulkAction('flag')}
              disabled={bulkActionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50"
            >
              <Flag className="w-3.5 h-3.5" />
              Flag for Audit
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-3 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredEntries.length && filteredEntries.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-3 py-3 text-left w-8" />
                <th className="px-3 py-3 text-left cursor-pointer select-none" onClick={() => toggleSort('date')}>
                  <span className="flex items-center gap-1">Date <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="px-3 py-3 text-left">Description</th>
                <th className="px-3 py-3 text-left">Project</th>
                <th className="px-3 py-3 text-left">Category</th>
                <th className="px-3 py-3 text-right cursor-pointer select-none" onClick={() => toggleSort('amount')}>
                  <span className="flex items-center gap-1 justify-end">Amount <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="px-3 py-3 text-right cursor-pointer select-none" onClick={() => toggleSort('variance')}>
                  <span className="flex items-center gap-1 justify-end">Variance <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="px-3 py-3 text-center">Severity</th>
                <th className="px-3 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-400">
                    No entries match your filters.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <>
                    <tr
                      key={entry.id}
                      className={`border-t hover:bg-gray-50 ${selectedIds.has(entry.id) ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(entry.id)}
                          onChange={() => toggleSelect(entry.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                          className="p-0.5 hover:bg-gray-200 rounded"
                        >
                          {expandedId === entry.id
                            ? <ChevronDown className="w-4 h-4 text-gray-400" />
                            : <ChevronRight className="w-4 h-4 text-gray-400" />
                          }
                        </button>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">{entry.date}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-900 max-w-[200px] truncate">{entry.description}</td>
                      <td className="px-3 py-2.5 text-gray-600 max-w-[150px] truncate">{entry.projectName}</td>
                      <td className="px-3 py-2.5 text-gray-600">{entry.category}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-900">
                        {entry.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        <span className={entry.variance > 0 ? 'text-red-600' : entry.variance < 0 ? 'text-green-600' : 'text-gray-400'}>
                          {entry.variance > 0 ? '+' : ''}{entry.variance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center"><SeverityBadge severity={entry.varianceSeverity} /></td>
                      <td className="px-3 py-2.5 text-center"><StatusBadge status={entry.status} /></td>
                    </tr>

                    {/* Expanded detail row */}
                    {expandedId === entry.id && (
                      <tr key={`${entry.id}-detail`} className="bg-gray-50">
                        <td colSpan={10} className="px-6 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Vendor</p>
                              <p className="text-gray-900">{entry.vendor}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Requisition</p>
                              <p className="text-gray-900 flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5" />
                                {entry.requisitionNumber || 'Not linked'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Receipt</p>
                              <p className="text-gray-900 flex items-center gap-1">
                                <Receipt className="w-3.5 h-3.5" />
                                {entry.hasReceipt ? 'Attached' : 'Missing'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Budgeted Amount</p>
                              <p className="text-gray-900 font-mono">
                                UGX {entry.budgetedAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Variance %</p>
                              <p className={`font-medium ${entry.variancePercent > 10 ? 'text-red-600' : 'text-gray-900'}`}>
                                {entry.variancePercent.toFixed(1)}%
                              </p>
                            </div>
                            {entry.notes && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Notes</p>
                                <p className="text-gray-700">{entry.notes}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-500">
          Showing {filteredEntries.length} of {entries.length} entries
        </div>
      </div>
    </div>
  );
}

export default DataReconciliationPage;
