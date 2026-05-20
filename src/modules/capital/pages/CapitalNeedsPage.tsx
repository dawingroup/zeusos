import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { useCapitalNeeds } from '../hooks/useCapitalNeeds';
import { StatusChip } from '../components/shared/StatusChip';
import { formatCurrency } from '../components/shared/CurrencyDisplay';
import {
  NEED_TYPE_LABELS,
  NEED_TYPE_COLORS,
  NEED_STATUS_LABELS,
  NEED_STATUS_COLORS,
  URGENCY_LABELS,
  URGENCY_COLORS,
} from '../constants/capital.constants';
import type { CapitalNeedFilters } from '../types/capital.types';

const COMPANY_ID = 'default';

export default function CapitalNeedsPage() {
  const [filters] = useState<CapitalNeedFilters>({});
  const { needs, detectedGaps, affordability, loading, error } = useCapitalNeeds(
    COMPANY_ID,
    filters,
  );

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

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1>Capital Needs</h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
            Identify, track, and manage your business capital requirements
          </p>
        </div>
        <Button variant="primary" size="sm">Add Capital Need</Button>
      </div>

      {error && (
        <div
          className="rounded-[10px] border p-3 text-[12.5px]"
          style={{
            backgroundColor: 'var(--rag-red-soft)',
            borderColor: 'var(--rag-red)',
            color: 'var(--rag-red)',
          }}
        >
          {error}
        </div>
      )}

      {/* Auto-detected gaps */}
      {detectedGaps.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-amber-600">Auto-Detected Cash Flow Gaps</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {detectedGaps.map((gap, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-white dark:bg-background rounded border"
                >
                  <div>
                    <span className="font-medium text-sm">
                      {gap.gapStartDate} to {gap.gapEndDate}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Projected cash shortfall during this period
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-destructive">
                      {formatCurrency(gap.gapAmount, 'UGX', true)}
                    </div>
                    <span className="text-xs text-muted-foreground">gap amount</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Affordability summary */}
      {affordability && affordability.monthlyCapacity > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Monthly Capacity</div>
              <div className="text-lg font-bold">
                {formatCurrency(affordability.monthlyCapacity, 'UGX', true)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Max Borrowing</div>
              <div className="text-lg font-bold">
                {formatCurrency(affordability.maxBorrowingAmount, 'UGX', true)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Max Term</div>
              <div className="text-lg font-bold">{affordability.maxTermMonths} months</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Debt Service Ratio</div>
              <div className="text-lg font-bold">{affordability.debtServiceRatio}x</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Needs list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Capital Needs ({needs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {needs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No capital needs recorded. Add one manually or run auto-detection.
            </p>
          ) : (
            <div className="space-y-3">
              {needs.map(need => (
                <div
                  key={need.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="font-medium">{need.title}</div>
                    <div className="flex gap-2 flex-wrap">
                      <StatusChip
                        label={NEED_TYPE_LABELS[need.type]}
                        color={NEED_TYPE_COLORS[need.type]}
                      />
                      <StatusChip
                        label={NEED_STATUS_LABELS[need.status]}
                        color={NEED_STATUS_COLORS[need.status]}
                      />
                      <StatusChip
                        label={URGENCY_LABELS[need.urgency].split(' (')[0]}
                        color={URGENCY_COLORS[need.urgency]}
                      />
                      {need.detectedBy === 'system' && (
                        <StatusChip label="Auto-detected" variant="outline" />
                      )}
                    </div>
                    {need.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {need.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <div className="text-lg font-bold">
                      {formatCurrency(need.amountRequired, need.currency, true)}
                    </div>
                    {need.applicationIds.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {need.applicationIds.length} application(s)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
