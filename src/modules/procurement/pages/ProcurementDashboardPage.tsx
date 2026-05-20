/**
 * Procurement Dashboard Page
 * Overview of purchase orders, spend, pending approvals, and procurement queue.
 * Migrated to the portal redesign tokens + KPICard + RagBadge primitives.
 */

import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  ArrowRight,
  FileUp,
  Inbox,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import {
  KPICard,
  Banner,
  RagBadge,
  EmptyStateV2,
} from '@/shared/components/data-display';
import { usePurchaseOrders } from '../hooks/usePurchaseOrders';
import {
  useProcurementRequirements,
  useProcurementConsolidation,
} from '../hooks/useProcurementRequirements';
import { PO_STATUS_LABELS, type PurchaseOrderStatus } from '../types/purchaseOrder';
import type { PurchaseOrder } from '../types/purchaseOrder';
import { getPendingRequestCount } from '../services/procurementRequestService';
import { CreatePurchaseOrderDialog } from '../components/CreatePurchaseOrderDialog';
import { POPdfImportDialog } from '../components/POPdfImportDialog';
import { useAuth } from '@/shared/hooks/useAuth';

const SUBSIDIARY_ID = 'finishes';

const PO_STATUS_TONE: Record<PurchaseOrderStatus, 'green' | 'amber' | 'red' | 'blue' | 'na'> = {
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

export default function ProcurementDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders, stats: poStats, loading: poLoading } = usePurchaseOrders(SUBSIDIARY_ID);
  const { requirements } = useProcurementRequirements({ subsidiaryId: SUBSIDIARY_ID });
  const { groups } = useProcurementConsolidation(SUBSIDIARY_ID);
  const [queueCount, setQueueCount] = useState(0);
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [showImportPDF, setShowImportPDF] = useState(false);

  useEffect(() => {
    getPendingRequestCount(SUBSIDIARY_ID).then(setQueueCount).catch(() => {});
  }, []);

  const metrics = useMemo(() => {
    const activeStatuses: PurchaseOrderStatus[] = ['approved', 'sent', 'partially-received'];
    const activeOrders = orders.filter((o) => activeStatuses.includes(o.status));
    const totalCommitted = activeOrders.reduce((sum, o) => sum + (o.totals?.grandTotal ?? 0), 0);
    const currency = activeOrders[0]?.totals?.currency ?? 'UGX';
    const awaitingApproval = poStats.byStatus['pending-approval'] ?? 0;
    const awaitingDelivery =
      (poStats.byStatus['sent'] ?? 0) + (poStats.byStatus['partially-received'] ?? 0);
    const pendingRequirements = requirements.filter((r) => r.status === 'pending').length;

    const recentPOs = [...orders]
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds ?? 0) * 1000;
        const bTime = b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds ?? 0) * 1000;
        return bTime - aTime;
      })
      .slice(0, 5);

    const supplierSpend = new Map<string, { name: string; total: number; count: number }>();
    for (const o of activeOrders) {
      const existing =
        supplierSpend.get(o.supplierName) ?? { name: o.supplierName, total: 0, count: 0 };
      existing.total += o.totals?.grandTotal ?? 0;
      existing.count += 1;
      supplierSpend.set(o.supplierName, existing);
    }
    const topSuppliers = [...supplierSpend.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      totalCommitted,
      currency,
      awaitingApproval,
      awaitingDelivery,
      pendingRequirements,
      recentPOs,
      topSuppliers,
    };
  }, [orders, poStats, requirements]);

  if (poLoading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="animate-spin rounded-full h-7 w-7 border-2 border-t-transparent"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-6 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1>Procurement Dashboard</h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
            Purchase orders, spend overview, and procurement pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/procurement/queue">
            <Button variant="outline" size="sm">
              <Inbox className="h-3.5 w-3.5" /> Queue
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => setShowImportPDF(true)}>
            <FileUp className="h-3.5 w-3.5" /> Import PDF
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowCreatePO(true)}>
            <Plus className="h-3.5 w-3.5" /> New PO
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard label="Total POs" value={poStats.total} sparkColor="var(--rag-blue)" />
        <KPICard
          label="Committed Spend"
          value={metrics.totalCommitted.toLocaleString()}
          unit={metrics.currency}
          sparkColor="var(--rag-green)"
        />
        <KPICard
          label="Awaiting Approval"
          value={metrics.awaitingApproval}
          trend={metrics.awaitingApproval > 0 ? 'down' : 'flat'}
          sparkColor="var(--rag-amber)"
        />
        <KPICard
          label="Awaiting Delivery"
          value={metrics.awaitingDelivery}
          sparkColor="var(--rag-blue)"
        />
        <KPICard
          label="Procurement Queue"
          value={queueCount}
          trend={queueCount > 0 ? 'down' : 'flat'}
          sparkColor="var(--boysenberry)"
        />
      </div>

      {/* PO Status Pipeline */}
      <Panel
        title="Purchase Order Pipeline"
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {(
            [
              'draft',
              'pending-approval',
              'approved',
              'sent',
              'partially-received',
              'received',
              'closed',
            ] as const
          ).map((status) => {
            const count = poStats.byStatus[status] ?? 0;
            const hasItems = count > 0;
            return (
              <button
                key={status}
                type="button"
                onClick={() =>
                  hasItems && navigate(`/procurement/orders?status=${status}`)
                }
                disabled={!hasItems}
                className={cn(
                  'flex flex-col items-start gap-1.5 p-3 rounded-[8px] border text-left transition-colors',
                )}
                style={{
                  borderColor: 'var(--border-default)',
                  backgroundColor: 'var(--bg-surface)',
                  opacity: hasItems ? 1 : 0.5,
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
                <span
                  className="text-[12px] font-medium"
                  style={{ color: 'var(--fg-primary)' }}
                >
                  {PO_STATUS_LABELS[status]}
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent POs */}
        <Panel
          title="Recent Purchase Orders"
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
          {metrics.recentPOs.length === 0 ? (
            <EmptyStateV2
              icon={<ShoppingCart className="h-5 w-5" />}
              size="compact"
              title="No purchase orders yet"
              action={
                <Button variant="outline" size="sm" onClick={() => setShowCreatePO(true)}>
                  <Plus className="h-3 w-3" /> Create First PO
                </Button>
              }
            />
          ) : (
            <div>
              {metrics.recentPOs.map((po) => (
                <RecentPORow key={po.id} po={po} />
              ))}
            </div>
          )}
        </Panel>

        {/* Top Suppliers + Consolidation */}
        <div className="space-y-5">
          <Panel title="Top Suppliers (Active POs)">
            {metrics.topSuppliers.length === 0 ? (
              <p
                className="text-center text-[12.5px] py-4"
                style={{ color: 'var(--fg-tertiary)' }}
              >
                No active supplier spend
              </p>
            ) : (
              <div>
                {metrics.topSuppliers.map((supplier, i) => (
                  <div
                    key={supplier.name}
                    className="flex items-center justify-between py-2.5 border-b last:border-b-0"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-6 h-6 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: 'var(--accent-soft)',
                          color: 'var(--accent)',
                        }}
                      >
                        {i + 1}
                      </span>
                      <div>
                        <p
                          className="text-[13px] font-medium m-0"
                          style={{ color: 'var(--fg-primary)' }}
                        >
                          {supplier.name}
                        </p>
                        <p
                          className="text-[11.5px] m-0"
                          style={{ color: 'var(--fg-tertiary)' }}
                        >
                          {supplier.count} active PO{supplier.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <span
                      className="text-[13px] font-semibold tabular-nums"
                      style={{ color: 'var(--fg-primary)' }}
                    >
                      {supplier.total.toLocaleString()} {metrics.currency}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {groups.length > 0 && (
            <Panel
              title={
                <span className="inline-flex items-center gap-2">
                  <TrendingUp
                    className="h-3.5 w-3.5"
                    style={{ color: 'var(--rag-green)' }}
                  />
                  Consolidation Opportunities
                </span>
              }
              meta={`${groups.length} supplier group${groups.length !== 1 ? 's' : ''}`}
            >
              <div>
                {groups.slice(0, 3).map((group) => (
                  <div
                    key={group.supplierId}
                    className="flex items-center justify-between py-2.5 border-b last:border-b-0"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div>
                      <p
                        className="text-[13px] font-medium m-0"
                        style={{ color: 'var(--fg-primary)' }}
                      >
                        {group.supplierName}
                      </p>
                      <p
                        className="text-[11.5px] m-0"
                        style={{ color: 'var(--fg-tertiary)' }}
                      >
                        {group.requirements.length} items from {group.moCount} MO
                        {group.moCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span
                      className="text-[13px] font-semibold tabular-nums"
                      style={{ color: 'var(--fg-primary)' }}
                    >
                      {group.totalEstimatedCost.toLocaleString()} {group.currency}
                    </span>
                  </div>
                ))}
              </div>
              {groups.length > 3 && (
                <div
                  className="mt-3 pt-3 border-t"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <Link
                    to="/procurement/queue"
                    className="text-[12px] font-medium inline-flex items-center gap-1"
                    style={{ color: 'var(--accent)' }}
                  >
                    View all {groups.length} groups <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>

      {/* Pending Requirements Banner */}
      {metrics.pendingRequirements > 0 && (
        <Banner
          tone="warning"
          title={`${metrics.pendingRequirements} procurement requirement${
            metrics.pendingRequirements !== 1 ? 's' : ''
          } pending`}
          message="Items from manufacturing orders awaiting PO creation."
          actions={
            <Link to="/procurement/queue">
              <Button variant="primary" size="sm">
                Review Queue
              </Button>
            </Link>
          }
        />
      )}

      {/* Dialogs */}
      {showCreatePO && (
        <CreatePurchaseOrderDialog
          open={showCreatePO}
          onClose={() => setShowCreatePO(false)}
          onCreated={(poId) => {
            setShowCreatePO(false);
            navigate(`/procurement/orders?selected=${poId}`);
          }}
          subsidiaryId={SUBSIDIARY_ID}
          userId={user?.uid ?? ''}
        />
      )}
      {showImportPDF && (
        <POPdfImportDialog
          open={showImportPDF}
          onClose={() => setShowImportPDF(false)}
          onCreated={(poId) => {
            setShowImportPDF(false);
            navigate(`/procurement/orders?selected=${poId}`);
          }}
          subsidiaryId={SUBSIDIARY_ID}
          userId={user?.uid ?? ''}
        />
      )}
    </div>
  );
}

function Panel({
  title,
  meta,
  actions,
  children,
}: {
  title: React.ReactNode;
  meta?: string;
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
        {meta && (
          <span className="text-[11.5px]" style={{ color: 'var(--fg-tertiary)' }}>
            {meta}
          </span>
        )}
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function RecentPORow({ po }: { po: PurchaseOrder }) {
  const date =
    po.createdAt?.toDate?.() ??
    (po.createdAt?.seconds ? new Date(po.createdAt.seconds * 1000) : null);
  return (
    <Link
      to={`/procurement/orders?selected=${po.id}`}
      className="flex items-center justify-between py-2.5 border-b last:border-b-0 transition-colors"
      style={{ borderColor: 'var(--border-subtle)' }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor = 'var(--bg-sunken)')
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = 'transparent')
      }
    >
      <div className="flex items-center gap-3 min-w-0">
        <ShoppingCart
          className="h-3.5 w-3.5 shrink-0"
          style={{ color: 'var(--fg-tertiary)' }}
        />
        <div className="min-w-0">
          <p
            className="text-[13px] font-medium font-mono truncate m-0"
            style={{ color: 'var(--fg-primary)' }}
          >
            {po.poNumber}
          </p>
          <p
            className="text-[11.5px] truncate m-0"
            style={{ color: 'var(--fg-tertiary)' }}
          >
            {po.supplierName}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <p
            className="text-[13px] font-semibold tabular-nums m-0"
            style={{ color: 'var(--fg-primary)' }}
          >
            {(po.totals?.grandTotal ?? 0).toLocaleString()}
          </p>
          {date && (
            <p
              className="text-[10.5px] m-0"
              style={{ color: 'var(--fg-tertiary)' }}
            >
              {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </p>
          )}
        </div>
        <RagBadge tone={PO_STATUS_TONE[po.status]}>{PO_STATUS_LABELS[po.status]}</RagBadge>
      </div>
    </Link>
  );
}

// Tiny inlined cn helper — avoids extra import for a single utility usage.
function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}
