/**
 * ExpiryTimeline
 * Upcoming document expirations with urgency indicators.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Clock, AlertTriangle, Calendar } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { ComplianceDocument } from '../types';
import { CATEGORY_LABELS } from '../types/constants';

interface ExpiryTimelineProps {
  documents: ComplianceDocument[];
}

function getDaysUntil(date: Date): number {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getUrgencyClass(days: number): string {
  if (days <= 0) return 'border-l-red-500 bg-[var(--rag-red-soft)]';
  if (days <= 7) return 'border-l-orange-500 bg-[var(--rag-amber-soft)]';
  if (days <= 14) return 'border-l-amber-500 bg-[var(--rag-amber-soft)]';
  return 'border-l-blue-500 bg-[var(--rag-blue-soft)]';
}

export function ExpiryTimeline({ documents }: ExpiryTimelineProps) {
  if (documents.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-[var(--rag-amber)]" />
            Upcoming Expirations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            No upcoming expirations in the next 30 days
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-[var(--rag-amber)]" />
          Upcoming Expirations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {documents.slice(0, 6).map(doc => {
          const expiryDate = doc.expiryDate?.toDate();
          if (!expiryDate) return null;
          const days = getDaysUntil(expiryDate);

          return (
            <div
              key={doc.id}
              className={cn(
                'border-l-4 rounded-r-md px-3 py-2',
                getUrgencyClass(days)
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[doc.category]}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  {days <= 0 ? (
                    <span className="flex items-center gap-1 text-[var(--rag-red)] font-medium">
                      <AlertTriangle className="h-3 w-3" />
                      Expired
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {days} day{days !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
