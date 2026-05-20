/**
 * DealList Component
 * Migrated to portal redesign tokens — DataTable-style chrome,
 * RagBadge for stage, design-system filter row.
 */

import { useState, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { Search, Filter, ChevronUp, ChevronDown, ShoppingBag } from 'lucide-react';
import type { CRMDeal, CRMDealStage } from '../../types';
import {
  CRM_DEAL_STAGE_LABELS,
  DEAL_SOURCE_LABELS,
  CRM_DEAL_STAGE_ORDER,
} from '../../constants/crm.constants';
import { Input } from '@/core/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { Button } from '@/core/components/ui/button';
import { RagBadge } from '@/shared/components/data-display';

interface DealListProps {
  deals: CRMDeal[];
  onCreateDeal?: () => void;
}

type SortField = 'title' | 'customerName' | 'estimatedValue' | 'stage' | 'updatedAt';
type SortDir = 'asc' | 'desc';

const STAGE_TONE: Record<CRMDealStage, 'green' | 'amber' | 'red' | 'blue' | 'na'> = {
  lead: 'na',
  qualification: 'blue',
  site_visit: 'blue',
  design_proposal: 'blue',
  quotation: 'amber',
  negotiation: 'amber',
  won: 'green',
  lost: 'red',
  on_hold: 'na',
};

function formatCurrency(value: number, currency: string): string {
  if (currency === 'UGX') return `UGX ${value.toLocaleString()}`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

function formatDate(timestamp: { toDate?: () => Date; seconds?: number } | undefined): string {
  if (!timestamp) return '—';
  const date = timestamp.toDate?.() ?? new Date((timestamp.seconds ?? 0) * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DealList({ deals, onCreateDeal }: DealListProps) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<CRMDealStage | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filteredDeals = useMemo(() => {
    let result = deals;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.customerName.toLowerCase().includes(q) ||
          d.dealNumber.toLowerCase().includes(q),
      );
    }

    if (stageFilter !== 'all') {
      result = result.filter((d) => d.stage === stageFilter);
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'customerName':
          cmp = a.customerName.localeCompare(b.customerName);
          break;
        case 'estimatedValue':
          cmp = a.estimatedValue - b.estimatedValue;
          break;
        case 'stage':
          cmp = CRM_DEAL_STAGE_ORDER.indexOf(a.stage) - CRM_DEAL_STAGE_ORDER.indexOf(b.stage);
          break;
        case 'updatedAt': {
          const aTs = a.updatedAt as { toMillis?: () => number; seconds?: number } | undefined;
          const bTs = b.updatedAt as { toMillis?: () => number; seconds?: number } | undefined;
          const aMs = aTs?.toMillis?.() ?? (aTs?.seconds ?? 0) * 1000;
          const bMs = bTs?.toMillis?.() ?? (bTs?.seconds ?? 0) * 1000;
          cmp = aMs - bMs;
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [deals, search, stageFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
  };

  const TH = ({
    label,
    field,
    align = 'left',
  }: {
    label: string;
    field?: SortField;
    align?: 'left' | 'right';
  }) => (
    <th
      className={`px-3 py-2.5 text-[10.5px] font-medium uppercase tracking-wider ${
        field ? 'cursor-pointer' : ''
      } ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{ color: 'var(--fg-tertiary)' }}
      onClick={field ? () => toggleSort(field) : undefined}
    >
      <span
        className={`inline-flex items-center gap-1 ${
          align === 'right' ? 'flex-row-reverse' : ''
        }`}
      >
        {label}
        {field && <SortIcon field={field} />}
      </span>
    </th>
  );

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
        <div className="flex-1 relative max-w-md">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
            style={{ color: 'var(--fg-tertiary)' }}
          />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, customer, deal #…"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5" style={{ color: 'var(--fg-tertiary)' }} />
          <Select
            value={stageFilter}
            onValueChange={(v) => setStageFilter(v as CRMDealStage | 'all')}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {CRM_DEAL_STAGE_ORDER.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {CRM_DEAL_STAGE_LABELS[stage]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {onCreateDeal && (
          <Button variant="primary" size="sm" onClick={onCreateDeal}>
            + New Deal
          </Button>
        )}
      </div>

      {/* Table */}
      <div
        className="overflow-x-auto rounded-[10px] border shadow-[var(--shadow-sm)]"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr
              className="border-b"
              style={{
                backgroundColor: 'var(--bg-sunken)',
                borderColor: 'var(--border-default)',
              }}
            >
              <TH label="Deal" field="title" />
              <TH label="Customer" field="customerName" />
              <TH label="Stage" field="stage" />
              <TH label="Value" field="estimatedValue" align="right" />
              <TH label="Source" />
              <TH label="Owner" />
              <TH label="Updated" field="updatedAt" />
            </tr>
          </thead>
          <tbody>
            {filteredDeals.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-[13px]"
                  style={{ color: 'var(--fg-tertiary)' }}
                >
                  {search || stageFilter !== 'all'
                    ? 'No deals match your filters.'
                    : 'No deals yet. Create your first deal to get started.'}
                </td>
              </tr>
            ) : (
              filteredDeals.map((deal) => (
                <tr
                  key={deal.id}
                  className="border-b transition-colors"
                  style={{ borderColor: 'var(--border-subtle)' }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = 'var(--bg-sunken)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = 'transparent')
                  }
                >
                  <td className="px-3 py-2">
                    <NavLink to={`/crm/deals/${deal.id}`} className="block">
                      <div className="flex items-center gap-1.5">
                        <p
                          className="text-[13px] font-medium m-0"
                          style={{ color: 'var(--fg-primary)' }}
                        >
                          {deal.title}
                        </p>
                        {deal.shopifyOrderId && (
                          <RagBadge tone="green" hideDot>
                            <ShoppingBag className="h-2.5 w-2.5" />
                            Shopify
                          </RagBadge>
                        )}
                      </div>
                      <p
                        className="text-[11px] font-mono m-0"
                        style={{ color: 'var(--fg-tertiary)' }}
                      >
                        {deal.dealNumber}
                      </p>
                    </NavLink>
                  </td>
                  <td
                    className="px-3 py-2 text-[13px]"
                    style={{ color: 'var(--fg-secondary)' }}
                  >
                    {deal.customerName}
                  </td>
                  <td className="px-3 py-2">
                    <RagBadge tone={STAGE_TONE[deal.stage] ?? 'na'}>
                      {CRM_DEAL_STAGE_LABELS[deal.stage]}
                    </RagBadge>
                  </td>
                  <td
                    className="px-3 py-2 text-[13px] text-right font-medium tabular-nums"
                    style={{ color: 'var(--fg-primary)' }}
                  >
                    {formatCurrency(deal.estimatedValue, deal.currency)}
                  </td>
                  <td
                    className="px-3 py-2 text-[11.5px]"
                    style={{ color: 'var(--fg-tertiary)' }}
                  >
                    {DEAL_SOURCE_LABELS[deal.source]}
                  </td>
                  <td
                    className="px-3 py-2 text-[13px]"
                    style={{ color: 'var(--fg-secondary)' }}
                  >
                    {deal.ownerName}
                  </td>
                  <td
                    className="px-3 py-2 text-[11.5px]"
                    style={{ color: 'var(--fg-tertiary)' }}
                  >
                    {formatDate(deal.updatedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        className="mt-2 text-[11.5px] px-1"
        style={{ color: 'var(--fg-tertiary)' }}
      >
        {filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
