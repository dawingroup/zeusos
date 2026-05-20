/**
 * OPO Analytics Dashboard
 * Visual overview of outsourced purchase order metrics
 */

import { useMemo } from 'react';
import { BarChart3, TrendingUp, Clock, CheckCircle2, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { useOutsourcedPurchaseOrders } from '../hooks/useOutsourcedPurchaseOrders';
import type { PurchaseOrder, PurchaseOrderStatus } from '../types/purchaseOrder';
import { PO_STATUS_LABELS } from '../types/purchaseOrder';

const SUBSIDIARY_ID = 'finishes';

// Status badge colors (Tailwind classes)
const STATUS_COLORS: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-gray-200 text-gray-800',
  'pending-approval': 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  sent: 'bg-indigo-100 text-indigo-800',
  'partially-received': 'bg-orange-100 text-orange-800',
  received: 'bg-green-100 text-green-800',
  closed: 'bg-gray-300 text-gray-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function toDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    return (ts as { toDate: () => Date }).toDate();
  }
  return null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ============================================
// KPI Card
// ============================================

function KPICard({
  title,
  value,
  subtitle,
  icon,
  iconBg,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={`flex-shrink-0 rounded-lg p-3 ${iconBg}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Spend by Contractor
// ============================================

interface ContractorRow {
  name: string;
  orderCount: number;
  totalServiceFee: number;
  totalProductCost: number;
}

function SpendByContractor({ data }: { data: ContractorRow[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No contractor data
      </div>
    );
  }

  const maxCost = Math.max(...data.map((d) => d.totalProductCost), 1);

  return (
    <div className="space-y-3">
      {data.map((row) => (
        <div key={row.name} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium truncate mr-2">{row.name}</span>
            <span className="text-muted-foreground flex-shrink-0">
              {row.orderCount} order{row.orderCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded transition-all"
                style={{ width: `${(row.totalProductCost / maxCost) * 100}%` }}
              />
            </div>
            <span className="text-sm font-semibold tabular-nums w-28 text-right">
              {formatCurrency(row.totalProductCost)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground pl-0.5">
            Service fee: {formatCurrency(row.totalServiceFee)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Status Distribution
// ============================================

function StatusDistribution({ byStatus }: { byStatus: Record<PurchaseOrderStatus, number> }) {
  const entries = (Object.entries(byStatus) as [PurchaseOrderStatus, number][]).filter(
    ([, count]) => count > 0,
  );

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-12 text-muted-foreground text-sm">
        No orders
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([status, count]) => (
        <span
          key={status}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[status]}`}
        >
          {PO_STATUS_LABELS[status]}
          <span className="font-bold">{count}</span>
        </span>
      ))}
    </div>
  );
}

// ============================================
// Recent OPOs Table
// ============================================

function RecentOPOsTable({ orders }: { orders: PurchaseOrder[] }) {
  if (orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No recent OPOs
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left font-medium py-2.5 px-3">OPO #</th>
            <th className="text-left font-medium py-2.5 px-3">Contractor</th>
            <th className="text-left font-medium py-2.5 px-3">Status</th>
            <th className="text-right font-medium py-2.5 px-3">Product Cost</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b last:border-b-0 hover:bg-muted/30">
              <td className="py-2.5 px-3 font-medium">{o.poNumber}</td>
              <td className="py-2.5 px-3 text-muted-foreground">{o.supplierName}</td>
              <td className="py-2.5 px-3">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[o.status]}`}
                >
                  {PO_STATUS_LABELS[o.status]}
                </span>
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums">
                {formatCurrency(o.totalProductCost ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// Main Page
// ============================================

export default function OutsourcedAnalyticsPage() {
  const { orders, loading, stats } = useOutsourcedPurchaseOrders(SUBSIDIARY_ID);

  const analytics = useMemo(() => {
    const activeOrders = orders.filter(
      (o) => o.status !== 'cancelled' && o.status !== 'closed',
    );

    // Total product cost
    const totalProductCost = activeOrders.reduce(
      (sum, o) => sum + (o.totalProductCost ?? 0),
      0,
    );

    // Average lead time
    let totalLeadDays = 0;
    let leadTimeCount = 0;
    for (const o of activeOrders) {
      const orderD = toDate(o.orderDate);
      const deliveryD = toDate(o.expectedDeliveryDate);
      if (orderD && deliveryD) {
        const diffMs = deliveryD.getTime() - orderD.getTime();
        totalLeadDays += diffMs / (1000 * 60 * 60 * 24);
        leadTimeCount++;
      }
    }
    const avgLeadTime = leadTimeCount > 0 ? Math.round(totalLeadDays / leadTimeCount) : 0;

    // Ingredient availability rate
    const withAvailability = activeOrders.filter(
      (o) => o.ingredientAvailability !== undefined && o.ingredientAvailability !== 'not_applicable',
    );
    const inStockCount = withAvailability.filter(
      (o) => o.ingredientAvailability === 'in_stock',
    ).length;
    const availabilityRate =
      withAvailability.length > 0
        ? Math.round((inStockCount / withAvailability.length) * 100)
        : 0;

    // Spend by contractor
    const contractorMap = new Map<string, ContractorRow>();
    for (const o of activeOrders) {
      const name = o.supplierName || 'Unknown';
      const existing = contractorMap.get(name);
      if (existing) {
        existing.orderCount++;
        existing.totalServiceFee += o.totalServiceFee ?? 0;
        existing.totalProductCost += o.totalProductCost ?? 0;
      } else {
        contractorMap.set(name, {
          name,
          orderCount: 1,
          totalServiceFee: o.totalServiceFee ?? 0,
          totalProductCost: o.totalProductCost ?? 0,
        });
      }
    }
    const spendByContractor = Array.from(contractorMap.values()).sort(
      (a, b) => b.totalProductCost - a.totalProductCost,
    );

    // Recent OPOs (last 5 by createdAt)
    const recentOPOs = [...orders]
      .sort((a, b) => {
        const aD = toDate(a.createdAt);
        const bD = toDate(b.createdAt);
        return (bD?.getTime() ?? 0) - (aD?.getTime() ?? 0);
      })
      .slice(0, 5);

    return {
      activeCount: activeOrders.length,
      totalProductCost,
      avgLeadTime,
      availabilityRate,
      spendByContractor,
      recentOPOs,
    };
  }, [orders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Active OPOs"
          value={String(analytics.activeCount)}
          subtitle={`${stats.total} total`}
          icon={<BarChart3 size={22} className="text-blue-600" />}
          iconBg="bg-blue-100"
        />
        <KPICard
          title="Total Product Cost"
          value={formatCurrency(analytics.totalProductCost)}
          subtitle="Active OPOs"
          icon={<DollarSign size={22} className="text-green-600" />}
          iconBg="bg-green-100"
        />
        <KPICard
          title="Avg Lead Time"
          value={`${analytics.avgLeadTime}d`}
          subtitle="Order to delivery"
          icon={<Clock size={22} className="text-orange-600" />}
          iconBg="bg-orange-100"
        />
        <KPICard
          title="Ingredient Availability"
          value={`${analytics.availabilityRate}%`}
          subtitle="OPOs with stock ready"
          icon={<CheckCircle2 size={22} className="text-emerald-600" />}
          iconBg="bg-emerald-100"
        />
      </div>

      {/* Middle row: Spend by Contractor + Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp size={18} className="text-muted-foreground" />
              Spend by Contractor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SpendByContractor data={analytics.spendByContractor} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDistribution byStatus={stats.byStatus} />
          </CardContent>
        </Card>
      </div>

      {/* Recent OPOs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent OPOs</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentOPOsTable orders={analytics.recentOPOs} />
        </CardContent>
      </Card>
    </div>
  );
}
