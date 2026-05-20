/**
 * StockAdjustmentList
 * Main list view with filters for stock adjustments.
 * Uses shadcn/ui + Tailwind to match the rest of the system.
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ClipboardList } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Badge } from '@/core/components/ui/badge';
import { Card, CardContent } from '@/core/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { AdjustmentStatusBadge } from './AdjustmentStatusBadge';
import { AdjustmentTypeBadge } from './AdjustmentTypeBadge';
import { QBOSyncStatusIndicator } from './QBOSyncStatusIndicator';
import type { StockAdjustment } from '../../types/stockAdjustment';
import { ADJUSTMENT_STATUS_LABELS, ADJUSTMENT_TYPE_LABELS } from '../../types/stockAdjustment';

interface StockAdjustmentListProps {
  adjustments: StockAdjustment[];
  loading: boolean;
  error: Error | null;
}

export function StockAdjustmentList({
  adjustments,
  loading,
  error,
}: StockAdjustmentListProps) {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 })
      .format(amount);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const filtered = useMemo(() => {
    let result = adjustments;
    if (statusFilter && statusFilter !== 'all') {
      result = result.filter(a => a.status === statusFilter);
    }
    if (typeFilter && typeFilter !== 'all') {
      result = result.filter(a => a.adjustmentType === typeFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.adjustmentNumber?.toLowerCase().includes(q) ||
        a.reason?.toLowerCase().includes(q) ||
        a.referenceNumber?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [adjustments, statusFilter, typeFilter, searchQuery]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load adjustments: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Adjustments</h1>
          <p className="text-sm text-muted-foreground">Manage inventory quantity corrections and movements</p>
        </div>
        <Button onClick={() => navigate('/inventory/adjustments/new')} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          New Adjustment
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search adjustments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="min-w-[140px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(ADJUSTMENT_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="min-w-[180px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(ADJUSTMENT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filtered.length} adjustment{filtered.length !== 1 ? 's' : ''}
        {(statusFilter !== 'all' || typeFilter !== 'all') && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 ml-2 text-sm"
            onClick={() => { setStatusFilter('all'); setTypeFilter('all'); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <h3 className="text-lg font-medium">No stock adjustments found</h3>
            <p className="text-muted-foreground mt-1">
              {adjustments.length === 0
                ? 'Create your first stock adjustment to get started'
                : 'Try adjusting your filters'}
            </p>
            {adjustments.length === 0 && (
              <Button variant="link" className="mt-2" onClick={() => navigate('/inventory/adjustments/new')}>
                Create Adjustment
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Adjustment #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Items</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Net Impact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Reference</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">QBO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((adj) => (
                  <tr
                    key={adj.id}
                    onClick={() => navigate(`/inventory/adjustments/${adj.id}`)}
                    className="hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium font-mono text-sm">{adj.adjustmentNumber || 'Pending...'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(adj.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <AdjustmentTypeBadge type={adj.adjustmentType} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <AdjustmentStatusBadge status={adj.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <Badge variant="outline">{adj.lineCount}</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`font-semibold text-sm ${adj.netValueImpact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {adj.netValueImpact >= 0 ? '+' : ''}{formatCurrency(adj.netValueImpact)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {adj.referenceNumber || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <QBOSyncStatusIndicator
                        status={adj.qboSyncStatus}
                        error={adj.qboSyncError}
                        journalEntryId={adj.qboJournalEntryId}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
