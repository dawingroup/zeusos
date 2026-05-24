// ============================================================================
// GROUP CASH FLOW PAGE
// Cross-subsidiary dashboard: bank balances, critical counts, combined queue
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/core/components/ui/card';
import { Skeleton } from '@/core/components/ui/skeleton';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/core/components/ui/table';
import {
  Building2,
  AlertTriangle,
  TrendingUp,
  Banknote,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { optimizerService } from '../services/optimizerService';
import { TierBadge, CommitmentBadge, formatUGX } from '../components/optimizer/ExpenditureScoreCard';
import type { ExpenditureItem } from '../types/optimizer.types';

interface SubsidiarySummary {
  id: string;
  name: string;
  bankBalance: number;
  criticalCount: number;
  totalPending: number;
  pendingCount: number;
}

const SUBSIDIARY_NAMES: Record<string, string> = {
  'zeus-the-agency': 'Zeus Group',
  'zeus-digital': 'Zeus Group',
  'dawin-interiors': 'Dawin Interiors',
};

export default function GroupCashFlowPage() {
  const companyId = 'dawinos'; // From company context
  const [allItems, setAllItems] = useState<ExpenditureItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [subsidiaryFilter, setSubsidiaryFilter] = useState<string>('');

  const loadAll = async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      // Load all pending expenditures (no subsidiary filter = all)
      const items = await optimizerService.getExpenditureQueue(companyId, {
        status: 'pending',
      });
      setAllItems(items);
    } catch (err) {
      console.error('Failed to load group data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [companyId]);

  // Group by subsidiary
  const subsidiaries = useMemo<SubsidiarySummary[]>(() => {
    const map = new Map<string, SubsidiarySummary>();

    for (const item of allItems) {
      const sid = item.subsidiaryId || 'zeus-the-agency';
      if (!map.has(sid)) {
        map.set(sid, {
          id: sid,
          name: SUBSIDIARY_NAMES[sid] || sid,
          bankBalance: 0,
          criticalCount: 0,
          totalPending: 0,
          pendingCount: 0,
        });
      }
      const summary = map.get(sid)!;
      summary.totalPending += item.amountUGX;
      summary.pendingCount += 1;
      if (item.priorityTier === 'CRITICAL') summary.criticalCount += 1;
    }

    return Array.from(map.values()).sort((a, b) => b.totalPending - a.totalPending);
  }, [allItems]);

  const filteredItems = useMemo(() => {
    const items = subsidiaryFilter
      ? allItems.filter(i => i.subsidiaryId === subsidiaryFilter)
      : allItems;
    return items.sort((a, b) => b.compositeScore - a.compositeScore);
  }, [allItems, subsidiaryFilter]);

  const totalCritical = subsidiaries.reduce((s, sub) => s + sub.criticalCount, 0);
  const totalPending = allItems.reduce((s, i) => s + i.amountUGX, 0);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            Group Cash Flow
          </h2>
          <p className="text-sm text-muted-foreground">
            Cross-subsidiary expenditure queue overview
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Summary Cards Row */}
      <KPIGrid cols={3}>
        <KPICard
          label={
            <span className="inline-flex items-center gap-1.5">
              <Banknote className="h-3 w-3" /> Total Pending Obligations
            </span>
          }
          value={formatUGX(totalPending)}
          delta={`${allItems.length} items across ${subsidiaries.length} subsidiaries`}
        />
        <KPICard
          label={
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-[var(--rag-red)]" /> Critical Items
            </span>
          }
          value={totalCritical}
          trend={totalCritical > 0 ? 'down' : 'flat'}
          delta="Require immediate attention"
        />
        <KPICard
          label={
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-[var(--rag-blue)]" /> Subsidiaries Active
            </span>
          }
          value={subsidiaries.length}
          delta="With pending expenditures"
        />
      </KPIGrid>

      {/* Per-Subsidiary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {subsidiaries.map(sub => (
          <Card
            key={sub.id}
            className={`p-4 cursor-pointer transition-all border-2 ${
              subsidiaryFilter === sub.id ? 'border-[var(--rag-blue)] bg-[var(--rag-blue-soft)]/30' : 'border-transparent hover:border-[var(--border-subtle)]'
            }`}
            onClick={() => setSubsidiaryFilter(subsidiaryFilter === sub.id ? '' : sub.id)}
          >
            <div className="font-medium text-sm">{sub.name}</div>
            <div className="text-lg font-bold mt-1">{formatUGX(sub.totalPending)}</div>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>{sub.pendingCount} items</span>
              {sub.criticalCount > 0 && (
                <span className="text-[var(--rag-red)] font-medium">
                  {sub.criticalCount} critical
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Combined Queue Table */}
      <Card>
        <div className="p-4 border-b">
          <h3 className="font-medium text-sm">
            {subsidiaryFilter
              ? `${SUBSIDIARY_NAMES[subsidiaryFilter] || subsidiaryFilter} — Expenditure Queue`
              : 'All Subsidiaries — Combined Queue'}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filteredItems.length} items, sorted by composite score
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Description</TableHead>
              <TableHead>Subsidiary</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Commitment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.slice(0, 50).map(item => (
              <TableRow key={item.id}>
                <TableCell className="text-sm font-medium truncate max-w-[200px]">
                  {item.description}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {SUBSIDIARY_NAMES[item.subsidiaryId] || item.subsidiaryId}
                </TableCell>
                <TableCell className="text-xs capitalize">{item.category}</TableCell>
                <TableCell className="text-right text-sm font-medium">
                  {formatUGX(item.amountUGX)}
                </TableCell>
                <TableCell>
                  <span className="text-sm font-bold">{item.compositeScore}</span>
                </TableCell>
                <TableCell>
                  <TierBadge tier={item.priorityTier} />
                </TableCell>
                <TableCell>
                  {item.commitmentLevel && (
                    <CommitmentBadge level={item.commitmentLevel} />
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-[var(--fg-tertiary)]">
                  No pending expenditures found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
