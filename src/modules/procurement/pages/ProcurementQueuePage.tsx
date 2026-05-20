/**
 * Unified Procurement Queue Page
 * Shows both material-driven procurement requests (from Materials Library)
 * and MO-driven procurement requirements (from Manufacturing Orders)
 * in a single merged view.
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search,
  ArrowLeft,
  ShoppingCart,
  Package,
  XCircle,
  ExternalLink,
  User,
  Factory,
  Palette,
} from 'lucide-react';
import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { RagBadge } from '@/shared/components/data-display';
import { Input } from '@/core/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { subscribeToUnifiedQueue } from '../services/unifiedProcurementService';
import { cancelRequest } from '../services/procurementRequestService';
import { cancelRequirement } from '../services/procurementRequirementService';
import { getRequirementsWithDemandScore } from '../services/procurementRequirementService';
import { PROCUREMENT_URGENCY_LABELS } from '../types/procurementRequest';
import type { ProcurementUrgency } from '../types/procurementRequest';
import type {
  UnifiedProcurementItem,
  UnifiedProcurementStatus,
  ProcurementSource,
  UnifiedQueueFilters,
} from '../types/procurement';
import { UNIFIED_STATUS_LABELS } from '../types/procurement';
import type { DemandScoredRequirement } from '../services/demandScoringService';
import { useAuth } from '@/shared/hooks/useAuth';

const SUBSIDIARY_ID = 'finishes';

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'na';

const STATUS_TONE: Record<UnifiedProcurementStatus, Tone> = {
  pending: 'amber',
  'in-progress': 'blue',
  'added-to-po': 'blue',
  ordered: 'green',
  received: 'green',
  cancelled: 'na',
};

const URGENCY_TONE: Record<ProcurementUrgency, Tone> = {
  low: 'na',
  normal: 'blue',
  high: 'amber',
  urgent: 'red',
};

const DEMAND_TONE: Record<string, Tone> = {
  critical: 'red',
  high: 'amber',
  medium: 'blue',
  low: 'na',
};

const SOURCE_TONE: Record<ProcurementSource, Tone> = {
  material: 'blue',
  manufacturing: 'amber',
};

/** Statuses that can be selected for PO creation */
const SELECTABLE_STATUSES: UnifiedProcurementStatus[] = ['pending', 'in-progress'];

/** Status filter presets */
const STATUS_PRESETS: Record<string, UnifiedProcurementStatus[] | undefined> = {
  active: ['pending', 'in-progress'],
  all: undefined,
};

export default function ProcurementQueuePage() {
  const navigate = useNavigate();
  const { user: _user } = useAuth();
  const [items, setItems] = useState<UnifiedProcurementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [demandScores, setDemandScores] = useState<DemandScoredRequirement[]>([]);

  // Fetch demand scores for MO-driven items
  useEffect(() => {
    getRequirementsWithDemandScore(SUBSIDIARY_ID)
      .then(setDemandScores)
      .catch(() => setDemandScores([]));
  }, [items]);

  // Subscribe to unified queue
  useEffect(() => {
    const filters: UnifiedQueueFilters = {
      status: STATUS_PRESETS[statusFilter] ?? (statusFilter !== 'all' ? [statusFilter as UnifiedProcurementStatus] : undefined),
      source: sourceFilter !== 'all' ? (sourceFilter as ProcurementSource) : undefined,
      urgency: urgencyFilter !== 'all' ? (urgencyFilter as ProcurementUrgency) : undefined,
      search: search || undefined,
    };

    const unsub = subscribeToUnifiedQueue(
      SUBSIDIARY_ID,
      (data) => {
        setItems(data);
        setLoading(false);
      },
      (err) => {
        console.error('Procurement queue error:', err);
        setLoading(false);
      },
      filters,
    );

    return unsub;
  }, [statusFilter, sourceFilter, urgencyFilter, search]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeSelectable = items.filter((item) => SELECTABLE_STATUSES.includes(item.status));

  const toggleSelectAll = () => {
    if (selectedIds.size === activeSelectable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeSelectable.map((item) => item.id)));
    }
  };

  const handleCancel = async (item: UnifiedProcurementItem) => {
    if (!confirm('Cancel this procurement item?')) return;
    if (item.source === 'material') {
      await cancelRequest(item.originalId, 'Cancelled by user');
    } else {
      await cancelRequirement(item.originalId);
    }
  };

  const handleCreatePO = () => {
    const selected = items.filter((item) => selectedIds.has(item.id));
    const materialIds = selected.filter((i) => i.source === 'material').map((i) => i.originalId);
    const moIds = selected.filter((i) => i.source === 'manufacturing').map((i) => i.originalId);

    const params = new URLSearchParams();
    if (materialIds.length > 0) params.set('fromRequests', materialIds.join(','));
    if (moIds.length > 0) params.set('fromRequirements', moIds.join(','));

    navigate(`/procurement/orders?${params.toString()}`);
  };

  const formatCurrency = (amount: number, currency: string) =>
    `${currency} ${amount.toLocaleString()}`;

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDemandScore = (item: UnifiedProcurementItem) => {
    if (item.source !== 'manufacturing') return null;
    return demandScores.find(
      (ds) => ds.requirement.id === item.originalId,
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/procurement"
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Procurement Queue</h1>
            <p className="text-sm text-muted-foreground">
              Material requests and manufacturing requirements — review and convert to purchase orders
            </p>
          </div>
        </div>
        {selectedIds.size > 0 && (
          <Button onClick={handleCreatePO} className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Create PO ({selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''})
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search item, code, supplier, MO..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="min-w-[150px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="material">Material Requests</SelectItem>
                <SelectItem value="manufacturing">MO Requirements</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="min-w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(UNIFIED_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger className="min-w-[130px]">
                <SelectValue placeholder="Urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Urgency</SelectItem>
                {Object.entries(PROCUREMENT_URGENCY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
        {selectedIds.size > 0 && (
          <span className="text-primary font-medium">
            ({selectedIds.size} selected)
          </span>
        )}
      </div>

      {/* Loading / Empty / Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <h3 className="text-lg font-medium">No procurement items</h3>
            <p className="text-muted-foreground mt-1 max-w-md">
              Items appear here when the design team flags materials for procurement,
              or when manufacturing orders generate outsourced requirements.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border table-sticky-first-col">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === activeSelectable.length && activeSelectable.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-primary focus:ring-primary/20"
                    />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-12">
                    Pri
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Urgency / Demand
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Est. Cost
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Requested By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => {
                  const canSelect = SELECTABLE_STATUSES.includes(item.status);
                  const demand = getDemandScore(item);
                  return (
                    <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelection(item.id)}
                          disabled={!canSelect}
                          className="rounded border-gray-300 text-primary focus:ring-primary/20 disabled:opacity-40"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.purchasePriority != null ? (
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                              item.prioritySource === 'procurement'
                                ? 'bg-blue-100 text-blue-700'
                                : item.prioritySource === 'manufacturing'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-gray-100 text-gray-600'
                            }`}
                            title={`Source: ${item.prioritySource ?? 'design'}`}
                          >
                            {item.purchasePriority + 1}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <RagBadge tone={SOURCE_TONE[item.source]}>
                          {item.source === 'material' ? (
                            <><Palette className="h-3 w-3" /> Material</>
                          ) : (
                            <><Factory className="h-3 w-3" /> MO</>
                          )}
                        </RagBadge>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium text-sm">{item.itemName}</span>
                          {item.itemCode && (
                            <span className="text-xs text-muted-foreground ml-2 font-mono">
                              {item.itemCode}
                            </span>
                          )}
                        </div>
                        {(item.projectRef || item.designItemName) && (
                          <div className="text-xs text-muted-foreground">
                            {item.designItemName && <span>{item.designItemName}</span>}
                            {item.designItemName && item.projectRef && <span> · </span>}
                            {item.projectRef && <span>{item.projectRef}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.urgency ? (
                          <RagBadge tone={URGENCY_TONE[item.urgency]}>
                            {PROCUREMENT_URGENCY_LABELS[item.urgency]}
                          </RagBadge>
                        ) : demand ? (
                          <span title={`Score: ${demand.demandScore}/100`}>
                            <RagBadge tone={DEMAND_TONE[demand.demandUrgency] ?? 'na'}>
                              D{demand.demandScore}
                            </RagBadge>
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--fg-tertiary)' }}>
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                        {formatCurrency(item.estimatedTotalCost, item.currency)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {item.supplierName || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          {item.requestedByName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(item.requestedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <RagBadge tone={STATUS_TONE[item.status]}>
                          {UNIFIED_STATUS_LABELS[item.status]}
                        </RagBadge>
                        {item.poNumber && (
                          <Link
                            to={`/procurement/orders/${item.poId}`}
                            className="text-xs hover:underline ml-2"
                            style={{ color: 'var(--accent)' }}
                          >
                            {item.poNumber}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {item.sourceUrl && (
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted"
                              title="View source"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          {canSelect && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleCancel(item)}
                              title="Cancel"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
