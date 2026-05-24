/**
 * StatusBreakdown
 * Visual breakdown: valid / expiring / expired / missing counts.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { ComplianceDocumentStatus } from '../types';
import { DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_DOT_COLORS } from '../types/constants';

interface StatusBreakdownProps {
  breakdown: Record<ComplianceDocumentStatus, number>;
  total: number;
}

const DISPLAY_ORDER: ComplianceDocumentStatus[] = [
  'valid',
  'expiring_soon',
  'expired',
  'missing',
  'pending_verification',
  'not_applicable',
];

export function StatusBreakdown({ breakdown, total }: StatusBreakdownProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-[var(--rag-blue)]" />
          Status Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {DISPLAY_ORDER.map(status => {
          const count = breakdown[status] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;

          return (
            <div key={status} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={cn('h-2.5 w-2.5 rounded-full', DOCUMENT_STATUS_DOT_COLORS[status])} />
                  <span>{DOCUMENT_STATUS_LABELS[status]}</span>
                </div>
                <span className="text-muted-foreground font-medium">{count}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', DOCUMENT_STATUS_DOT_COLORS[status])}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
