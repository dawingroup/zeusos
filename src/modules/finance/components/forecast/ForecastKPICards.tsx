/**
 * ForecastKPICards
 * Shows 4 headline KPI cards: Revenue, Gross Profit, EBITDA, Free Cash Flow
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/core/components/ui/card';
import { Skeleton } from '@/core/components/ui/skeleton';
import type { ForecastPeriod } from '../../types/forecast.types';
import { fmtFull } from '../../services/forecastEngine';

interface Props {
  periods: ForecastPeriod[];
  loading: boolean;
}

function sum(periods: ForecastPeriod[], key: 'revenue' | 'grossProfit' | 'ebitda' | 'netProfit') {
  return periods.reduce((acc, p) => acc + p.pl[key], 0);
}

function freeCF(periods: ForecastPeriod[]) {
  return periods.reduce((acc, p) => acc + p.cfs.operating + p.cfs.investing, 0);
}

interface KPICardProps {
  label: string;
  value: number;
  loading: boolean;
}

function KPICard({ label, value, loading }: KPICardProps) {
  const isNeg = value < 0;
  const Icon = isNeg ? TrendingDown : value === 0 ? Minus : TrendingUp;
  return (
    <Card className={`border ${isNeg ? 'border-[var(--rag-red)] bg-[var(--rag-red-soft)]' : 'border-[var(--rag-green)] bg-[var(--rag-green-soft)]'}`}>
      <CardContent className="p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 shrink-0 ${isNeg ? 'text-[var(--rag-red)]' : 'text-[var(--rag-green)]'}`} />
            <p className={`text-2xl font-bold ${isNeg ? 'text-[var(--rag-red)]' : 'text-[var(--rag-green)]'}`}>
              {fmtFull(value)}
            </p>
          </div>
        )}
        <p className="text-xs text-[var(--fg-tertiary)] mt-1">Forecast period total</p>
      </CardContent>
    </Card>
  );
}

export function ForecastKPICards({ periods, loading }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard label="Revenue" value={sum(periods, 'revenue')} loading={loading} />
      <KPICard label="Gross Profit" value={sum(periods, 'grossProfit')} loading={loading} />
      <KPICard label="EBITDA" value={sum(periods, 'ebitda')} loading={loading} />
      <KPICard label="Free Cash Flow" value={freeCF(periods)} loading={loading} />
    </div>
  );
}
