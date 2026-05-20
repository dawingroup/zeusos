/**
 * Advisory Overview Card Component
 * DawinOS v2.0 - Dawin Advisory
 * Metric card following Capital Hub UI patterns
 */

import React from 'react';
import { Card, CardContent } from '@/core/components/ui/card';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

interface AdvisoryOverviewCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: number;
  trendLabel?: string;
  onClick?: () => void;
}

export const AdvisoryOverviewCard: React.FC<AdvisoryOverviewCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color,
  trend,
  trendLabel,
  onClick,
}) => {
  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-all group"
      style={{ borderLeft: `4px solid ${color}` }}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-2xl font-semibold">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            {trend !== undefined && (
              <div className="mt-2 flex items-center gap-1">
                {trend >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={`text-xs font-medium ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {Math.abs(trend)}%
                </span>
                {trendLabel && (
                  <span className="text-xs text-muted-foreground">{trendLabel}</span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div 
              className="p-3 rounded-lg transition-colors"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {icon}
            </div>
            {onClick && (
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdvisoryOverviewCard;
