/**
 * Manufacturing Dashboard Page
 * Overview of MOs by stage, PO status, and key metrics
 * Styled to match DawinOS Finishes design system
 */

import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Factory,
  ShoppingCart,
  CheckCircle,
  ArrowRight,
  Pause,
  FileText,
  FolderOpen,
  LayoutList,
} from 'lucide-react';
import { useManufacturingOrders } from '../hooks/useManufacturingOrders';
import { usePurchaseOrders } from '@/modules/procurement/hooks/usePurchaseOrders';
import { getPendingRequestCount } from '@/modules/procurement/services/procurementRequestService';
import { MO_STAGE_LABELS, MO_STATUS_LABELS, type MOStage } from '../types';
import { PO_STATUS_LABELS, type PurchaseOrderStatus } from '@/modules/procurement/types/purchaseOrder';
import { groupManufacturingOrdersByProjectSalesOrder } from '../utils/moGrouping';
import { KPICard, RagBadge } from '@/shared/components/data-display';
import { Button } from '@/core/components/ui/button';

const SUBSIDIARY_ID = 'finishes';

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'na';

const STAGE_TONE: Record<MOStage, Tone> = {
  queued: 'na',
  cutting: 'blue',
  assembly: 'blue',
  finishing: 'blue',
  qc: 'amber',
  ready: 'green',
};

const STAGE_FG_VAR: Record<MOStage, string> = {
  queued: 'var(--fg-secondary)',
  cutting: 'var(--rag-blue)',
  assembly: 'var(--rag-blue)',
  finishing: 'var(--boysenberry)',
  qc: 'var(--rag-amber)',
  ready: 'var(--rag-green)',
};

const STATUS_TONE: Record<'draft' | 'in-progress' | 'on-hold' | 'completed', Tone> = {
  draft: 'na',
  'in-progress': 'blue',
  'on-hold': 'red',
  completed: 'green',
};

const STATUS_ICON = {
  draft: FileText,
  'in-progress': Factory,
  'on-hold': Pause,
  completed: CheckCircle,
} as const;

const PO_STATUS_TONE: Record<PurchaseOrderStatus, Tone> = {
  draft: 'na',
  'pending-approval': 'amber',
  approved: 'blue',
  rejected: 'red',
  sent: 'blue',
  'partially-received': 'amber',
  received: 'green',
  closed: 'na',
  cancelled: 'na',
};

export default function ManufacturingDashboardPage() {
  const navigate = useNavigate();
  const { orders, stats: moStats, loading: moLoading } = useManufacturingOrders(SUBSIDIARY_ID);
  const { stats: poStats, loading: poLoading } = usePurchaseOrders(SUBSIDIARY_ID);
  const [procurementQueueCount, setProcurementQueueCount] = useState(0);
  const [pipelineView, setPipelineView] = useState<'stage' | 'project'>('stage');

  // Group active MOs by project + sales order
  const projectGroups = useMemo(() => {
    const active = orders.filter(o => !['completed', 'cancelled'].includes(o.status));
    return groupManufacturingOrdersByProjectSalesOrder(active);
  }, [orders]);

  useEffect(() => {
    getPendingRequestCount(SUBSIDIARY_ID).then(setProcurementQueueCount).catch(() => {});
  }, []);

  const loading = moLoading || poLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const totalActive = (moStats.byStatus['in-progress'] ?? 0) + (moStats.byStatus['approved'] ?? 0);
  const totalPendingPO = (poStats.byStatus['sent'] ?? 0) + (poStats.byStatus['partially-received'] ?? 0);

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-6 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1>Manufacturing Dashboard</h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
            Monitor production pipeline and procurement status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/manufacturing/orders">
            <Button variant="outline" size="sm">
              <Factory className="h-3.5 w-3.5" /> Manufacturing Orders
            </Button>
          </Link>
          <Link to="/procurement/orders">
            <Button variant="primary" size="sm">
              <ShoppingCart className="h-3.5 w-3.5" /> Purchase Orders
            </Button>
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard label="Active Production" value={totalActive} sparkColor="var(--rag-blue)" />
        <KPICard
          label="On Hold"
          value={moStats.byStatus['on-hold'] ?? 0}
          trend={(moStats.byStatus['on-hold'] ?? 0) > 0 ? 'down' : 'flat'}
          sparkColor="var(--rag-amber)"
        />
        <KPICard
          label="Completed (Month)"
          value={moStats.byStatus['completed'] ?? 0}
          trend="up"
          sparkColor="var(--rag-green)"
        />
        <KPICard
          label="Pending Deliveries"
          value={totalPendingPO}
          sparkColor="var(--boysenberry)"
        />
        <KPICard
          label="Procurement Queue"
          value={procurementQueueCount}
          sparkColor="var(--seafoam)"
        />
      </div>

      {/* Production Pipeline */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Production Pipeline</h2>
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setPipelineView('stage')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    pipelineView === 'stage'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <LayoutList className="h-3.5 w-3.5" />
                  By Stage
                </button>
                <button
                  onClick={() => setPipelineView('project')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    pipelineView === 'project'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  By Project + SO
                </button>
              </div>
              <Link
                to="/manufacturing/orders"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
        <div className="p-6">
          {pipelineView === 'stage' ? (
            /* Stage Pipeline View */
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {(Object.entries(MO_STAGE_LABELS) as [MOStage, string][]).map(([stage, label]) => {
                const count = moStats.byStage[stage] ?? 0;
                const hasItems = count > 0;
                const fg = STAGE_FG_VAR[stage];

                return (
                  <button
                    key={stage}
                    onClick={() => hasItems && navigate(`/manufacturing/orders?stage=${stage}`)}
                    disabled={!hasItems}
                    className="relative rounded-[10px] border p-4 text-center transition-all"
                    style={{
                      borderColor: hasItems ? fg : 'var(--border-default)',
                      backgroundColor: 'var(--bg-surface)',
                      opacity: hasItems ? 1 : 0.6,
                      cursor: hasItems ? 'pointer' : 'default',
                    }}
                  >
                    <div
                      className="text-[28px] font-semibold leading-none mb-1 tabular-nums"
                      style={{
                        color: hasItems ? fg : 'var(--fg-quaternary)',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {count}
                    </div>
                    <div
                      className="text-[12px] font-medium"
                      style={{ color: 'var(--fg-secondary)' }}
                    >
                      {label}
                    </div>
                    {stage !== 'ready' && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 hidden lg:block">
                        <ArrowRight
                          className="h-3.5 w-3.5"
                          style={{ color: 'var(--fg-quaternary)' }}
                        />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Project Grouping View */
            <div className="space-y-4">
              {projectGroups.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FolderOpen className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No active manufacturing orders</p>
                </div>
              ) : (
                projectGroups.map((group) => {
                  const inProgress = group.orders.filter(o => o.status === 'in-progress').length;
                  const draft = group.orders.filter(o => o.status === 'draft' || o.status === 'approved').length;
                  const onHold = group.orders.filter(o => o.status === 'on-hold').length;

                  return (
                    <div key={group.key} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Project Header */}
                      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <FolderOpen className="h-4 w-4 text-gray-400" />
                            <span className="font-semibold text-gray-900">{group.projectName}</span>
                            {group.projectCode && (
                              <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                                {group.projectCode}
                              </span>
                            )}
                          </div>
                          {group.customerName && (
                            <p className="text-xs text-gray-500 mt-0.5 ml-6">{group.customerName}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-0.5 ml-6">
                            Sales Order: {group.salesOrderId ?? 'Unlinked'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-gray-700">{group.orders.length} MO{group.orders.length !== 1 ? 's' : ''}</span>
                          {inProgress > 0 && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                              {inProgress} active
                            </span>
                          )}
                          {draft > 0 && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">
                              {draft} draft
                            </span>
                          )}
                          {onHold > 0 && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">
                              {onHold} held
                            </span>
                          )}
                        </div>
                      </div>
                      {/* MO List */}
                      <div>
                        {group.orders.map((mo) => (
                          <button
                            key={mo.id}
                            onClick={() => navigate(`/manufacturing/orders/${mo.id}`)}
                            className="w-full flex items-center justify-between px-4 py-2.5 border-b last:border-b-0 transition-colors text-left"
                            style={{ borderColor: 'var(--border-subtle)' }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor = 'var(--bg-sunken)')
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor = 'transparent')
                            }
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className="font-medium text-[13px]"
                                style={{ color: 'var(--fg-primary)' }}
                              >
                                {mo.moNumber}
                              </span>
                              <span
                                className="text-[13px]"
                                style={{ color: 'var(--fg-secondary)' }}
                              >
                                {mo.designItemName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <RagBadge tone={STAGE_TONE[mo.currentStage]}>
                                {MO_STAGE_LABELS[mo.currentStage]}
                              </RagBadge>
                              <RagBadge
                                tone={
                                  STATUS_TONE[
                                    mo.status as keyof typeof STATUS_TONE
                                  ] ?? 'na'
                                }
                              >
                                {MO_STATUS_LABELS[mo.status]}
                              </RagBadge>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* MO Status Summary */}
        <Panel title="MO Status">
          <div className="flex flex-col gap-2">
            {(['draft', 'in-progress', 'on-hold', 'completed'] as const).map((status) => {
              const count = moStats.byStatus[status] ?? 0;
              const Icon = STATUS_ICON[status];
              const tone = STATUS_TONE[status];
              const fg =
                tone === 'green'
                  ? 'var(--rag-green)'
                  : tone === 'blue'
                  ? 'var(--rag-blue)'
                  : tone === 'red'
                  ? 'var(--rag-red)'
                  : 'var(--fg-secondary)';
              const bg =
                tone === 'green'
                  ? 'var(--rag-green-soft)'
                  : tone === 'blue'
                  ? 'var(--rag-blue-soft)'
                  : tone === 'red'
                  ? 'var(--rag-red-soft)'
                  : 'var(--bg-sunken)';
              const total = Object.values(moStats.byStatus).reduce((a, b) => a + b, 0);
              const percent = total > 0 ? (count / total) * 100 : 0;
              return (
                <button
                  key={status}
                  onClick={() => count > 0 && navigate(`/manufacturing/orders?status=${status}`)}
                  disabled={count === 0}
                  className="w-full flex items-center justify-between p-2.5 rounded-[8px] border transition-colors text-left"
                  style={{
                    borderColor: 'var(--border-default)',
                    opacity: count > 0 ? 1 : 0.6,
                    cursor: count > 0 ? 'pointer' : 'default',
                  }}
                  onMouseEnter={(e) => {
                    if (count > 0) e.currentTarget.style.backgroundColor = 'var(--bg-sunken)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-7 w-7 rounded-md grid place-items-center"
                      style={{ backgroundColor: bg, color: fg }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span
                      className="font-medium text-[13px]"
                      style={{ color: 'var(--fg-primary)' }}
                    >
                      {MO_STATUS_LABELS[status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-24 rounded-full h-1.5 overflow-hidden"
                      style={{ backgroundColor: 'var(--bg-sunken)' }}
                    >
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${percent}%`, backgroundColor: fg }}
                      />
                    </div>
                    <span
                      className="text-[16px] font-semibold w-8 text-right tabular-nums"
                      style={{ color: 'var(--fg-primary)' }}
                    >
                      {count}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>

        {/* PO Status Summary */}
        <Panel
          title="Purchase Orders"
          actions={
            <Link
              to="/procurement/orders"
              className="text-[12px] font-medium inline-flex items-center gap-1"
              style={{ color: 'var(--accent)' }}
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          <div className="grid grid-cols-2 gap-2.5">
            {(['draft', 'pending-approval', 'sent', 'partially-received', 'received'] as const).map(
              (status) => {
                const count = poStats.byStatus[status] ?? 0;
                const hasItems = count > 0;
                return (
                  <button
                    key={status}
                    onClick={() => hasItems && navigate(`/procurement/orders?status=${status}`)}
                    disabled={!hasItems}
                    className="p-3 rounded-[8px] border transition-colors text-left flex flex-col gap-1.5"
                    style={{
                      borderColor: 'var(--border-default)',
                      backgroundColor: 'var(--bg-surface)',
                      opacity: hasItems ? 1 : 0.6,
                      cursor: hasItems ? 'pointer' : 'default',
                    }}
                    onMouseEnter={(e) => {
                      if (hasItems) e.currentTarget.style.backgroundColor = 'var(--bg-sunken)';
                    }}
                    onMouseLeave={(e) => {
                      if (hasItems) e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                    }}
                  >
                    <RagBadge tone={PO_STATUS_TONE[status]} hideDot>
                      {count}
                    </RagBadge>
                    <div className="text-[12px] font-medium" style={{ color: 'var(--fg-primary)' }}>
                      {PO_STATUS_LABELS[status]}
                    </div>
                  </button>
                );
              },
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  title,
  actions,
  children,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-[10px] border bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] overflow-hidden"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <header
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <h2 className="text-[14.5px] font-semibold m-0" style={{ color: 'var(--fg-primary)' }}>
          {title}
        </h2>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
