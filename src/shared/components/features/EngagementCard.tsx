/**
 * EngagementCard Component
 * Display engagement summary in a card format
 */

import { Calendar, Building2, DollarSign, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { StatusBadge } from '@/shared/components/data-display/StatusBadge';
import { cn } from '@/shared/lib/utils';

interface EngagementCardProps {
  id: string;
  title: string;
  client: string;
  status: string;
  value?: number;
  currency?: string;
  startDate?: string;
  teamSize?: number;
  onClick?: () => void;
  className?: string;
}

export function EngagementCard({
  id: _id,
  title,
  client,
  status,
  value,
  currency = 'UGX',
  startDate,
  teamSize,
  onClick,
  className,
}: EngagementCardProps) {
  const formatCurrency = (amount: number, curr: string) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-shadow hover:shadow-md',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-semibold line-clamp-1">
            {title}
          </CardTitle>
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span className="line-clamp-1">{client}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {value !== undefined && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {formatCurrency(value, currency)}
              </span>
            </div>
          )}

          {startDate && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{new Date(startDate).toLocaleDateString()}</span>
            </div>
          )}

          {teamSize !== undefined && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{teamSize} members</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
