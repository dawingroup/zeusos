/**
 * SalesOrderDashboardPage — Action items, pipeline funnel, risk summary, aging.
 */

import { FileCheck, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSalesOrders } from '../hooks/useSalesOrders';
import { SOStatusBadge } from '../components/shared';
import { SO_STATUS_LABELS } from '../constants';
import { KPICard, KPIGrid, RagBadge } from '@/shared/components/data-display';
import { Button } from '@/core/components/ui/button';

const SUBSIDIARY_ID = 'zeus-the-agency';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SalesOrderDashboardPage() {
  const navigate = useNavigate();
  const { orders, loading, stats } = useSalesOrders(SUBSIDIARY_ID);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="animate-spin rounded-full h-7 w-7 border-2 border-t-transparent"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  // Recent actionable orders
  const actionableOrders = orders
    .filter(
      (o) =>
        o.status !== 'completed' &&
        o.status !== 'cancelled' &&
        o.status !== 'in_progress',
    )
    .slice(0, 10);

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1>Sales Orders</h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
            Commercial protection & approval tracking
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/sales-orders/list')}>
          View All Orders
        </Button>
      </div>

      {/* KPIs */}
      <KPIGrid>
        <KPICard
          label="Awaiting Client"
          value={stats.awaitingClientResponse}
          sparkColor="var(--rag-blue)"
        />
        <KPICard
          label="Ready to Release"
          value={stats.readyToRelease}
          trend="up"
          sparkColor="var(--rag-green)"
        />
        <KPICard
          label="Pending Discounts"
          value={stats.pendingDiscounts}
          sparkColor="var(--rag-amber)"
        />
        <KPICard
          label="Risk Flags"
          value={stats.activeRiskFlags}
          trend={stats.activeRiskFlags > 0 ? 'down' : 'flat'}
          sparkColor="var(--rag-red)"
        />
      </KPIGrid>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Pipeline Value */}
        <div
          className="rounded-[10px] border bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] p-5"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <h2 className="text-[14.5px] font-semibold mb-2 m-0" style={{ color: 'var(--fg-primary)' }}>
            Pipeline Value
          </h2>
          <p
            className="text-[26px] font-semibold tabular-nums m-0"
            style={{ color: 'var(--accent)', letterSpacing: '-0.02em' }}
          >
            {formatCurrency(stats.totalPipelineValue)}
          </p>
          <p className="text-[11.5px] mb-4 m-0" style={{ color: 'var(--fg-tertiary)' }}>
            {stats.totalOrders} total orders
          </p>
          <div
            className="border-t pt-3 space-y-2"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            {Object.entries(stats.byStatus)
              .filter(([, count]) => (count ?? 0) > 0)
              .map(([status, count]) => (
                <div key={status} className="flex justify-between items-center">
                  <span className="text-[12px]" style={{ color: 'var(--fg-secondary)' }}>
                    {SO_STATUS_LABELS[status as keyof typeof SO_STATUS_LABELS]}
                  </span>
                  <RagBadge tone="na" hideDot>
                    {count}
                  </RagBadge>
                </div>
              ))}
          </div>
        </div>

        {/* Action Required */}
        <div
          className="md:col-span-2 rounded-[10px] border bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] p-5"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <h2 className="text-[14.5px] font-semibold mb-3 m-0" style={{ color: 'var(--fg-primary)' }}>
            Action Required
          </h2>
          {actionableOrders.length === 0 ? (
            <p
              className="text-[12.5px] text-center py-8 m-0"
              style={{ color: 'var(--fg-tertiary)' }}
            >
              No orders require action right now.
            </p>
          ) : (
            <div>
              {actionableOrders.map((order) => {
                const daysSinceUpdate = Math.floor(
                  (Date.now() - order.updatedAt.toMillis()) / (1000 * 60 * 60 * 24),
                );
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between py-2.5 cursor-pointer rounded px-2 -mx-2 transition-colors border-b last:border-b-0"
                    style={{ borderColor: 'var(--border-subtle)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = 'var(--bg-sunken)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = 'transparent')
                    }
                    onClick={() => navigate(`/sales-orders/${order.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <FileCheck className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--fg-tertiary)' }} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold font-mono" style={{ color: 'var(--fg-primary)' }}>
                            {order.orderNumber}
                          </span>
                          <span className="text-[13px] truncate max-w-[200px]" style={{ color: 'var(--fg-secondary)' }}>
                            {order.customerName}
                          </span>
                        </div>
                        <p className="text-[11.5px] tabular-nums m-0" style={{ color: 'var(--fg-tertiary)' }}>
                          {formatCurrency(order.currentAmount)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {daysSinceUpdate > 7 && (
                        <RagBadge tone="amber">
                          <Clock className="h-3 w-3" />
                          {daysSinceUpdate}d
                        </RagBadge>
                      )}
                      <SOStatusBadge status={order.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
