/**
 * SalesOrdersPage
 * Migrated to shared <DataTable> primitive — sortable, searchable, filterable.
 */

import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSalesOrders } from '../hooks/useSalesOrders';
import { SOStatusBadge } from '../components/shared';
import RiskFlagBanner from '../components/RiskFlagBanner';
import { SO_STATUS_ORDER } from '../constants';
import type { SalesOrderStatus } from '../types';
import {
  DataTable,
  type DataTableColumn,
} from '@/shared/components/data-display';

const SUBSIDIARY_ID = 'zeus-the-agency';

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface Row {
  id: string;
  orderNumber: string;
  customerName: string;
  title: string;
  originalQuoteAmount: number;
  currentAmount: number;
  totalDiscountPercent: number;
  status: SalesOrderStatus;
  currency: string;
  raw: ReturnType<typeof useSalesOrders>['orders'][number];
}

export default function SalesOrdersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qFromUrl = searchParams.get('q')?.trim() ?? '';

  // Fetch all orders — DataTable handles client-side search + filter.
  const { orders, loading } = useSalesOrders(SUBSIDIARY_ID, {});

  const rows: Row[] = useMemo(
    () =>
      orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        title: o.title,
        originalQuoteAmount: o.originalQuoteAmount,
        currentAmount: o.currentAmount,
        totalDiscountPercent: o.totalDiscountPercent,
        status: o.status,
        currency: o.currency,
        raw: o,
      })),
    [orders],
  );

  const columns: DataTableColumn<Row>[] = useMemo(
    () => [
      {
        key: 'orderNumber',
        label: 'Order #',
        type: 'mono',
        width: 150,
      },
      { key: 'customerName', label: 'Client' },
      {
        key: 'title',
        label: 'Title',
        render: (row) => (
          <span className="truncate block max-w-[260px]" title={row.title}>
            {row.title}
          </span>
        ),
      },
      {
        key: 'originalQuoteAmount',
        label: 'Original',
        type: 'number',
        align: 'right',
        render: (row) => (
          <span className="tabular-nums" style={{ color: 'var(--fg-secondary)' }}>
            {formatCurrency(row.originalQuoteAmount, row.currency)}
          </span>
        ),
      },
      {
        key: 'currentAmount',
        label: 'Current',
        type: 'number',
        align: 'right',
        render: (row) => (
          <span
            className="tabular-nums font-semibold"
            style={{
              color:
                row.currentAmount < row.originalQuoteAmount
                  ? 'var(--rag-amber)'
                  : 'var(--fg-primary)',
            }}
          >
            {formatCurrency(row.currentAmount, row.currency)}
          </span>
        ),
      },
      {
        key: 'totalDiscountPercent',
        label: 'Discount %',
        align: 'right',
        render: (row) => (
          <span className="tabular-nums" style={{ color: 'var(--fg-tertiary)' }}>
            {row.totalDiscountPercent > 0 ? `${row.totalDiscountPercent.toFixed(1)}%` : '—'}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        render: (row) => <SOStatusBadge status={row.status} />,
        width: 160,
      },
      {
        key: 'riskFlags',
        label: 'Risk',
        sortable: false,
        render: (row) => <RiskFlagBanner riskFlags={row.raw.riskFlags} compact />,
        width: 130,
      },
    ],
    [],
  );

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      <div className="flex items-baseline justify-between">
        <h1>Sales Orders</h1>
        <span className="text-[12px]" style={{ color: 'var(--fg-tertiary)' }}>
          {rows.length} order{rows.length === 1 ? '' : 's'}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div
            className="animate-spin rounded-full h-7 w-7 border-2 border-t-transparent"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          search="Search by order #, client or title…"
          initialSearch={qFromUrl}
          filters={[
            {
              label: 'Status',
              key: 'status',
              options: ['All', ...SO_STATUS_ORDER],
            },
          ]}
          onRowClick={(row) => navigate(`/sales-orders/${row.id}`)}
        />
      )}
    </div>
  );
}
