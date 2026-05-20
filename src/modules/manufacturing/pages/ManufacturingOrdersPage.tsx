/**
 * Manufacturing Orders List Page
 * Styled to match DawinOS Finishes design system
 */

import { useMemo, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Factory, ExternalLink, ArrowLeft, ChevronDown, ChevronRight, ShoppingCart } from 'lucide-react';
import { useManufacturingOrders } from '../hooks/useManufacturingOrders';
import { MO_STAGE_LABELS, MO_STATUS_LABELS } from '../types';
import type { ManufacturingOrderStatus, MOStage } from '../types';
import { IncomingJobsSection } from '../components/IncomingJobsSection';
import MOCascadeBadge from '../components/mo/MOCascadeBadge';
import { groupManufacturingOrdersByProjectSalesOrder } from '../utils/moGrouping';
import { useProcurementRequirements } from '../hooks/useProcurementRequirements';
import type { ProcurementRequirement } from '../types/procurement';
import { useAuth } from '@/shared/hooks/useAuth';
import { RagBadge } from '@/shared/components/data-display';

const SUBSIDIARY_ID = 'finishes';

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'na';

const STATUS_TONE: Record<ManufacturingOrderStatus, Tone> = {
  draft: 'na',
  'pending-approval': 'amber',
  approved: 'blue',
  'in-progress': 'blue',
  'on-hold': 'red',
  'partially-complete': 'amber',
  completed: 'green',
  'closed-out': 'green',
  cancelled: 'na',
};

const STAGE_TONE: Record<MOStage, Tone> = {
  queued: 'na',
  cutting: 'blue',
  assembly: 'blue',
  finishing: 'blue',
  qc: 'amber',
  ready: 'green',
};

const PRIORITY_TONE: Record<'low' | 'medium' | 'high' | 'urgent', Tone> = {
  low: 'na',
  medium: 'blue',
  high: 'amber',
  urgent: 'red',
};

export default function ManufacturingOrdersPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') ?? '');
  const [stageFilter, setStageFilter] = useState<string>(searchParams.get('stage') ?? '');
  const [salesOrderFilter, setSalesOrderFilter] = useState<string>(searchParams.get('salesOrderId') ?? '');
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<Set<string>>(new Set());
  const [consolidatingSupplierKey, setConsolidatingSupplierKey] = useState<string | null>(null);

  const handleSelectMo = (moId: string) => {
    navigate(`/manufacturing/orders/${moId}`);
  };

  const filters = {
    search: search || undefined,
    status: statusFilter ? (statusFilter as ManufacturingOrderStatus) : undefined,
    currentStage: stageFilter ? (stageFilter as MOStage) : undefined,
    salesOrderId: salesOrderFilter || undefined,
  };

  const { orders, loading } = useManufacturingOrders(SUBSIDIARY_ID, filters);
  const {
    requirements: pendingRequirements,
    consolidate: consolidateRequirements,
    error: procurementError,
  } = useProcurementRequirements({
    subsidiaryId: SUBSIDIARY_ID,
    filters: { status: 'pending' },
  });
  const groupedOrders = useMemo(
    () => groupManufacturingOrdersByProjectSalesOrder(orders),
    [orders],
  );
  const pendingRequirementsByMO = useMemo(() => {
    const byMO = new Map<string, ProcurementRequirement[]>();
    for (const requirement of pendingRequirements) {
      if (!requirement.moId) continue;
      const current = byMO.get(requirement.moId) ?? [];
      current.push(requirement);
      byMO.set(requirement.moId, current);
    }
    return byMO;
  }, [pendingRequirements]);
  const orphanRequirementsByProjectCode = useMemo(() => {
    const byProject = new Map<string, ProcurementRequirement[]>();
    for (const requirement of pendingRequirements) {
      if (requirement.moId) continue;
      const projectCode = requirement.projectCode?.trim();
      if (!projectCode) continue;
      const current = byProject.get(projectCode) ?? [];
      current.push(requirement);
      byProject.set(projectCode, current);
    }
    return byProject;
  }, [pendingRequirements]);

  // Per-group rollups (bulked materials, supplier groupings, totals). Lifted
  // out of the render-time map callback so any state change (search, expand,
  // selection toggle) doesn't redo all of this for every group every time.
  const groupDerivations = useMemo(() => {
    type MaterialBucket = {
      key: string;
      materialLabel: string;
      unit: string;
      quantity: number;
      totalCost: number;
      lines: number;
    };
    type SupplierGroup = {
      supplierId: string | null;
      supplierName: string;
      requirements: ProcurementRequirement[];
    };
    const byKey = new Map<string, {
      groupRequirements: ProcurementRequirement[];
      bulkedMaterialBuckets: Map<string, MaterialBucket>;
      requirementsBySupplier: Map<string, SupplierGroup>;
      totalGroupCost: number;
      totalQuantity: number;
      pendingProcurementCost: number;
    }>();

    for (const group of groupedOrders) {
      const moLinkedRequirements = group.orders.flatMap(
        (order) => pendingRequirementsByMO.get(order.id) ?? [],
      );
      const orphanRequirements = group.projectCode
        ? orphanRequirementsByProjectCode.get(group.projectCode) ?? []
        : [];
      const groupRequirements = [...moLinkedRequirements, ...orphanRequirements];

      const bulkedMaterialBuckets = new Map<string, MaterialBucket>();
      for (const requirement of groupRequirements) {
        const bucketKey =
          requirement.materialGroupKey ??
          `${requirement.itemDescription}|${requirement.unit}|${requirement.projectCode ?? 'unlinked'}`;
        const existing = bulkedMaterialBuckets.get(bucketKey);
        if (existing) {
          existing.quantity += requirement.quantityRequired;
          existing.totalCost += requirement.estimatedTotalCost;
          existing.lines += 1;
        } else {
          bulkedMaterialBuckets.set(bucketKey, {
            key: bucketKey,
            materialLabel: requirement.itemDescription,
            unit: requirement.unit,
            quantity: requirement.quantityRequired,
            totalCost: requirement.estimatedTotalCost,
            lines: 1,
          });
        }
      }

      const requirementsBySupplier = new Map<string, SupplierGroup>();
      for (const requirement of groupRequirements) {
        const supplierKey = requirement.supplierId ?? 'unassigned';
        const existing = requirementsBySupplier.get(supplierKey);
        if (existing) {
          existing.requirements.push(requirement);
        } else {
          requirementsBySupplier.set(supplierKey, {
            supplierId: requirement.supplierId ?? null,
            supplierName: requirement.supplierName ?? 'Unassigned',
            requirements: [requirement],
          });
        }
      }

      let totalGroupCost = 0;
      let totalQuantity = 0;
      for (const order of group.orders) {
        totalGroupCost += order.costSummary?.totalCost ?? 0;
        totalQuantity += order.quantity ?? 0;
      }
      let pendingProcurementCost = 0;
      for (const requirement of groupRequirements) {
        pendingProcurementCost += requirement.estimatedTotalCost;
      }

      byKey.set(group.key, {
        groupRequirements,
        bulkedMaterialBuckets,
        requirementsBySupplier,
        totalGroupCost,
        totalQuantity,
        pendingProcurementCost,
      });
    }

    return byKey;
  }, [groupedOrders, pendingRequirementsByMO, orphanRequirementsByProjectCode]);

  const toggleGroupExpansion = (groupKey: string) => {
    setExpandedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const toggleRequirementSelection = (requirementId: string) => {
    setSelectedRequirementIds((prev) => {
      const next = new Set(prev);
      if (next.has(requirementId)) next.delete(requirementId);
      else next.add(requirementId);
      return next;
    });
  };

  const toggleSupplierSelection = (requirements: ProcurementRequirement[]) => {
    const ids = requirements.map((req) => req.id);
    setSelectedRequirementIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const handleConsolidateSupplier = async (
    groupKey: string,
    supplierId: string,
    supplierRequirements: ProcurementRequirement[],
  ) => {
    if (!user?.uid) return;
    const selectedIds = supplierRequirements
      .map((req) => req.id)
      .filter((id) => selectedRequirementIds.has(id));
    if (selectedIds.length === 0) return;

    const actionKey = `${groupKey}|${supplierId}`;
    setConsolidatingSupplierKey(actionKey);
    try {
      const poId = await consolidateRequirements(selectedIds, supplierId, user.uid);
      if (poId) {
        setSelectedRequirementIds((prev) => {
          const next = new Set(prev);
          for (const id of selectedIds) next.delete(id);
          return next;
        });
        navigate(`/manufacturing/purchase-orders/${poId}`);
      }
    } finally {
      setConsolidatingSupplierKey(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/manufacturing"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manufacturing Orders</h1>
            <p className="text-muted-foreground">Track and manage production orders</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search MO number or item name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-w-[160px]"
          >
            <option value="">All Statuses</option>
            {Object.entries(MO_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-w-[140px]"
          >
            <option value="">All Stages</option>
            {Object.entries(MO_STAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Sales order ID"
            value={salesOrderFilter}
            onChange={(e) => setSalesOrderFilter(e.target.value.trim())}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-w-[180px]"
          />
        </div>
      </div>

      {/* Incoming Jobs (pre-handover design items) */}
      <IncomingJobsSection />

      {/* Results Count */}
      <div className="text-sm text-gray-500">
        {orders.length} order{orders.length !== 1 ? 's' : ''}
        {(statusFilter || stageFilter || salesOrderFilter) && (
          <button
            onClick={() => {
              setStatusFilter('');
              setStageFilter('');
              setSalesOrderFilter('');
            }}
            className="ml-2 text-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : orders.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Factory className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No manufacturing orders found</h3>
          <p className="text-gray-500 mt-1">
            {search || statusFilter || stageFilter || salesOrderFilter
              ? 'Try adjusting your filters'
              : 'Manufacturing orders will appear here when created'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedOrders.map((group) => {
            const isExpanded = expandedGroupKeys.has(group.key);
            const derived = groupDerivations.get(group.key)!;
            const {
              groupRequirements,
              bulkedMaterialBuckets,
              requirementsBySupplier,
              totalGroupCost,
              totalQuantity,
              pendingProcurementCost,
            } = derived;

            return (
            <div key={group.key} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{group.projectName}</p>
                  <p className="text-xs text-gray-500">
                    {group.projectCode || 'No project code'} / Sales Order: {group.salesOrderId ?? 'Unlinked'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-600">
                    {group.orders.length} order{group.orders.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => toggleGroupExpansion(group.key)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    Consolidated Review
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 py-4 border-b border-gray-200 bg-gray-50/50 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Grouped MOs</p>
                      <p className="text-sm font-semibold text-gray-900">{group.orders.length}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Total Quantity</p>
                      <p className="text-sm font-semibold text-gray-900">{totalQuantity.toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">MO Cost (Est.)</p>
                      <p className="text-sm font-semibold text-gray-900">UGX {totalGroupCost.toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Pending Procurement</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {groupRequirements.length} line{groupRequirements.length !== 1 ? 's' : ''} / UGX {pendingProcurementCost.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {bulkedMaterialBuckets.size > 0 && (
                    <div className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                          Bulked Materials Preview
                        </p>
                        <span className="text-xs text-gray-500">
                          {bulkedMaterialBuckets.size} material bucket{bulkedMaterialBuckets.size !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {Array.from(bulkedMaterialBuckets.values())
                          .sort((a, b) => b.totalCost - a.totalCost)
                          .map((bucket) => (
                            <div
                              key={bucket.key}
                              className="flex items-center justify-between gap-3 px-2 py-1.5 rounded border border-gray-100"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-900 truncate">{bucket.materialLabel}</p>
                                <p className="text-[11px] text-gray-500">
                                  {bucket.lines} line{bucket.lines !== 1 ? 's' : ''} combined
                                </p>
                              </div>
                              <span className="text-xs text-gray-700 whitespace-nowrap">
                                {bucket.quantity.toLocaleString()} {bucket.unit} / UGX {bucket.totalCost.toLocaleString()}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {groupRequirements.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                          Consolidate Procurement Needs (Grouped MOs)
                        </p>
                        {procurementError && (
                          <span className="text-xs text-red-600">{procurementError}</span>
                        )}
                      </div>
                      {Array.from(requirementsBySupplier.entries()).map(([supplierKey, supplierGroup]) => {
                        const selectedCount = supplierGroup.requirements.filter((req) => selectedRequirementIds.has(req.id)).length;
                        const supplierTotal = supplierGroup.requirements.reduce((sum, req) => sum + req.estimatedTotalCost, 0);
                        const isUnassigned = !supplierGroup.supplierId;
                        const isConsolidating = consolidatingSupplierKey === `${group.key}|${supplierKey}`;

                        return (
                          <div key={supplierKey} className="rounded-lg border border-gray-200 bg-white p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{supplierGroup.supplierName}</p>
                                <p className="text-xs text-gray-500">
                                  {supplierGroup.requirements.length} line{supplierGroup.requirements.length !== 1 ? 's' : ''} / UGX {supplierTotal.toLocaleString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleSupplierSelection(supplierGroup.requirements)}
                                  className="px-2.5 py-1 text-xs rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
                                >
                                  {selectedCount === supplierGroup.requirements.length ? 'Clear' : 'Select'} all
                                </button>
                                <button
                                  onClick={() => supplierGroup.supplierId && handleConsolidateSupplier(group.key, supplierGroup.supplierId, supplierGroup.requirements)}
                                  disabled={isUnassigned || selectedCount === 0 || !user?.uid || isConsolidating}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                  title={isUnassigned ? 'Assign supplier before consolidation' : undefined}
                                >
                                  <ShoppingCart className="h-3.5 w-3.5" />
                                  {isConsolidating ? 'Consolidating...' : `Create Consolidated PO (${selectedCount})`}
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              {supplierGroup.requirements.map((requirement) => (
                                <label
                                  key={requirement.id}
                                  className="flex items-center justify-between gap-3 px-2 py-1.5 rounded border border-gray-100 hover:bg-gray-50"
                                >
                                  <span className="flex items-center gap-2 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={selectedRequirementIds.has(requirement.id)}
                                      onChange={() => toggleRequirementSelection(requirement.id)}
                                      className="rounded border-gray-300"
                                    />
                                    <span className="text-xs text-gray-900 truncate">
                                      {requirement.itemDescription} ({requirement.moNumber})
                                    </span>
                                  </span>
                                  <span className="text-xs text-gray-600 whitespace-nowrap">
                                    {requirement.quantityRequired} {requirement.unit} / UGX {requirement.estimatedTotalCost.toLocaleString()}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 table-sticky-first-col">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        MO Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Design Item
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {group.orders.map((mo) => (
                        <tr
                          key={mo.id}
                          onClick={() => handleSelectMo(mo.id)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-medium" style={{ color: 'var(--fg-primary)' }}>{mo.moNumber}</span>
                              <MOCascadeBadge
                                mo={mo}
                                childCount={mo.childMOIds?.length ?? 0}
                                salesOrderId={mo.salesOrderId ?? null}
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span style={{ color: 'var(--fg-primary)' }}>{mo.designItemName}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <RagBadge tone={STATUS_TONE[mo.status]}>
                              {MO_STATUS_LABELS[mo.status]}
                            </RagBadge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <RagBadge tone={STAGE_TONE[mo.currentStage]}>
                              {MO_STAGE_LABELS[mo.currentStage]}
                            </RagBadge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <RagBadge tone={PRIORITY_TONE[mo.priority]}>
                              {mo.priority.charAt(0).toUpperCase() + mo.priority.slice(1)}
                            </RagBadge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {(() => {
                              const d = (mo as any).orderDate || (mo as any).createdAt;
                              if (!d) return '—';
                              if (typeof d.toDate === 'function') return d.toDate().toLocaleDateString();
                              if (d.seconds) return new Date(d.seconds * 1000).toLocaleDateString();
                              return '—';
                            })()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectMo(mo.id);
                              }}
                              className="p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                              <ExternalLink className="h-4 w-4 text-gray-400" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )})}
        </div>
      )}

    </div>
  );
}
