/**
 * DealCard Component
 * Card representation of a deal for kanban and list views
 */

import { NavLink } from 'react-router-dom';
import { Calendar, User, DollarSign, ArrowRight, ShoppingBag } from 'lucide-react';
import type { CRMDeal } from '../../types';
import {
  DEAL_PRIORITY_COLORS,
  DEAL_PRIORITY_LABELS,
  CRM_DEAL_STAGE_LABELS,
} from '../../constants/crm.constants';

interface DealCardProps {
  deal: CRMDeal;
  compact?: boolean;
  onStageChange?: (dealId: string, newStage: string) => void;
}

function formatCurrency(value: number, currency: string): string {
  if (currency === 'UGX') {
    return `UGX ${value.toLocaleString()}`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

function formatDate(timestamp: { toDate?: () => Date; seconds?: number } | undefined): string {
  if (!timestamp) return '';
  const date = timestamp.toDate?.() ?? new Date((timestamp.seconds ?? 0) * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function DealCard({ deal, compact = false }: DealCardProps) {
  const priorityColor = DEAL_PRIORITY_COLORS[deal.priority] ?? 'text-gray-500';

  if (compact) {
    const ownerInitials = (deal.ownerName || '')
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
    return (
      <NavLink
        to={`/crm/deals/${deal.id}`}
        className="block rounded-[10px] border bg-[var(--bg-surface)] transition-shadow hover:shadow-[var(--shadow-md)]"
        style={{
          padding: 12,
          borderColor: 'var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          className="text-[13px] font-medium leading-snug mb-1.5"
          style={{ color: 'var(--fg-primary)' }}
        >
          {deal.title}
        </div>
        {deal.customerName && (
          <div
            className="text-[11px] mb-2"
            style={{ color: 'var(--fg-tertiary)' }}
          >
            {deal.customerName}
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[13px] font-semibold tabular-nums"
            style={{ color: 'var(--fg-primary)' }}
          >
            {formatCurrency(deal.estimatedValue, deal.currency)}
          </span>
          {deal.probability != null && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10.5px] font-medium tabular-nums"
              style={{
                backgroundColor: 'var(--bg-sunken)',
                color: 'var(--fg-secondary)',
              }}
            >
              {deal.probability}%
            </span>
          )}
        </div>
        {deal.ownerName && (
          <div
            className="flex items-center gap-2 pt-2 border-t"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span
              className="h-5 w-5 rounded-full grid place-items-center text-[9px] font-semibold shrink-0"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
            >
              {ownerInitials}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--fg-secondary)' }}>
              {deal.ownerName}
            </span>
            {deal.expectedCloseDate && (
              <span
                className="ml-auto text-[11px]"
                style={{ color: 'var(--fg-tertiary)' }}
              >
                {formatDate(deal.expectedCloseDate)}
              </span>
            )}
            {!deal.expectedCloseDate && deal.priority && deal.priority !== 'medium' && (
              <span className={`ml-auto text-[10.5px] font-medium ${priorityColor}`}>
                {DEAL_PRIORITY_LABELS[deal.priority]}
              </span>
            )}
          </div>
        )}
      </NavLink>
    );
  }

  return (
    <NavLink
      to={`/crm/deals/${deal.id}`}
      className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{deal.title}</p>
          <p className="text-xs text-gray-500">{deal.dealNumber}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityColor} bg-gray-50`}>
          {DEAL_PRIORITY_LABELS[deal.priority]}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <User className="h-3 w-3" />
          <span>{deal.customerName}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <DollarSign className="h-3 w-3" />
          <span className="font-medium text-gray-900">
            {formatCurrency(deal.estimatedValue, deal.currency)}
          </span>
          <span className="text-gray-400">
            ({deal.probability}% = {formatCurrency(deal.weightedValue, deal.currency)})
          </span>
        </div>

        {deal.expectedCloseDate && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="h-3 w-3" />
            <span>Close by {formatDate(deal.expectedCloseDate)}</span>
          </div>
        )}

        {deal.linkedProjectId && (
          <div className="flex items-center gap-1.5 text-xs text-blue-600">
            <ArrowRight className="h-3 w-3" />
            <span>Project linked</span>
          </div>
        )}

        {deal.shopifyOrderId && (
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <ShoppingBag className="h-3 w-3" />
            <span>Shopify #{deal.shopifyOrderNumber || deal.shopifyOrderId}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <User className="h-3 w-3" />
          <span>{deal.ownerName}</span>
        </div>
        <span className="text-xs text-gray-400">
          {CRM_DEAL_STAGE_LABELS[deal.stage]}
        </span>
      </div>
    </NavLink>
  );
}
