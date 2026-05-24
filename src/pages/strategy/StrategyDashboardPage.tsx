/**
 * StrategyDashboardPage.tsx
 * CEO Strategy Command dashboard with strategic overview and key metrics
 * ZeusOS v2.0 - Phase 8.7
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  FileText,
  Gauge,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  Plus,
  RefreshCw,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Progress } from '@/core/components/ui/progress';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import { Skeleton } from '@/core/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';

const STRATEGY_COLOR = '#9C27B0';

// Mock data for demonstration
const mockMetrics = {
  okrProgress: 68,
  okrsOnTrack: 12,
  okrsAtRisk: 4,
  okrsBehind: 2,
  activeStrategies: 3,
  totalStrategies: 5,
  kpiCount: 24,
  kpisPositive: 18,
  kpisNegative: 3,
  activeInitiatives: 8,
  completedInitiatives: 15,
};

const mockOKRs = [
  { id: '1', objective: 'Increase market share in East Africa by 25%', progress: 72, status: 'on_track', owner: 'John Doe', keyResultsCount: 4 },
  { id: '2', objective: 'Launch 3 new product lines by Q4', progress: 45, status: 'at_risk', owner: 'Jane Smith', keyResultsCount: 3 },
  { id: '3', objective: 'Achieve 95% customer satisfaction rating', progress: 88, status: 'on_track', owner: 'Mike Johnson', keyResultsCount: 5 },
  { id: '4', objective: 'Reduce operational costs by 15%', progress: 32, status: 'behind', owner: 'Sarah Wilson', keyResultsCount: 3 },
  { id: '5', objective: 'Expand to 2 new countries', progress: 60, status: 'on_track', owner: 'David Brown', keyResultsCount: 4 },
];

const mockKPIs = [
  { id: '1', name: 'Monthly Revenue', status: 'warning', currentValue: 450000000, targetValue: 500000000, trend: 'down', trendValue: -5 },
  { id: '2', name: 'Customer Acquisition Cost', status: 'critical', currentValue: 125000, targetValue: 100000, trend: 'up', trendValue: 12 },
  { id: '3', name: 'Employee Turnover Rate', status: 'warning', currentValue: 18, targetValue: 12, trend: 'up', trendValue: 3 },
];

const mockInitiatives = [
  { id: '1', name: 'Digital Transformation Program', progress: 65, priority: 'critical', owner: 'Tech Team', status: 'in_progress' },
  { id: '2', name: 'Customer Experience Enhancement', progress: 40, priority: 'high', owner: 'CX Team', status: 'in_progress' },
  { id: '3', name: 'Supply Chain Optimization', progress: 80, priority: 'medium', owner: 'Operations', status: 'in_progress' },
  { id: '4', name: 'Talent Development Initiative', progress: 55, priority: 'high', owner: 'HR Team', status: 'in_progress' },
];

const mockAlerts = [
  { id: '1', type: 'okr_behind', severity: 'error', title: 'OKR Behind Schedule', description: '"Reduce operational costs" is at 32%' },
  { id: '2', type: 'kpi_decline', severity: 'warning', title: 'Revenue Declining', description: 'Monthly revenue down 5% from target' },
];

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  onClick?: () => void;
  color?: string;
}

function MetricCard({ title, value, subtitle, icon, trend, onClick, color = STRATEGY_COLOR }: MetricCardProps) {
  return (
    <Card 
      className={cn('cursor-pointer hover:shadow-md transition-shadow', onClick && 'hover:border-primary/50')}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                {trend.isPositive ? (
                  <TrendingUp className="h-4 w-4 text-[var(--rag-green)]" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-[var(--rag-red)]" />
                )}
                <span className={cn('text-sm', trend.isPositive ? 'text-[var(--rag-green)]' : 'text-[var(--rag-red)]')}>
                  {Math.abs(trend.value)}%
                </span>
              </div>
            )}
          </div>
          <div 
            className="p-3 rounded-lg"
            style={{ backgroundColor: `${color}15`, color }}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'on_track':
    case 'completed':
      return 'text-[var(--rag-green)]';
    case 'at_risk':
    case 'warning':
      return 'text-[var(--rag-amber)]';
    case 'behind':
    case 'critical':
      return 'text-[var(--rag-red)]';
    default:
      return 'text-muted-foreground';
  }
}

function getStatusBadge(status: string): string {
  switch (status) {
    case 'on_track':
    case 'completed':
      return 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]';
    case 'at_risk':
    case 'warning':
      return 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]';
    case 'behind':
    case 'critical':
      return 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]';
    default:
      return 'bg-[var(--bg-sunken)] text-foreground';
  }
}

export function StrategyDashboardPage() {
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState<'quarter' | 'year'>('quarter');
  const [loading] = useState(false);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-24" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6" style={{ color: STRATEGY_COLOR }} />
            CEO Strategy Command
          </h1>
          <p className="text-muted-foreground">Strategic overview and organizational performance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => navigate('/strategy/okrs/new')} style={{ backgroundColor: STRATEGY_COLOR }}>
            <Plus className="h-4 w-4 mr-2" />
            New OKR
          </Button>
        </div>
      </div>

      {/* Alerts Banner */}
      {mockAlerts.length > 0 && (
        <Card className="border-[var(--rag-amber)] bg-[var(--rag-amber-soft)]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-[var(--rag-amber)]" />
                <span className="font-medium text-[var(--rag-amber)]">
                  {mockAlerts.length} Strategic Alert{mockAlerts.length > 1 ? 's' : ''} Requiring Attention
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/strategy/alerts')}>
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="OKR Progress"
          value={`${mockMetrics.okrProgress}%`}
          subtitle={`${mockMetrics.okrsOnTrack} on track, ${mockMetrics.okrsAtRisk} at risk`}
          icon={<Target className="h-6 w-6" />}
          trend={{ value: mockMetrics.okrProgress >= 70 ? 5 : -3, isPositive: mockMetrics.okrProgress >= 70 }}
          onClick={() => navigate('/strategy/okrs')}
        />
        <MetricCard
          title="Active Strategies"
          value={mockMetrics.activeStrategies}
          subtitle={`${mockMetrics.totalStrategies} total strategies`}
          icon={<FileText className="h-6 w-6" />}
          color="#673AB7"
          onClick={() => navigate('/strategy/plans')}
        />
        <MetricCard
          title="KPI Health"
          value={`${mockMetrics.kpisPositive}/${mockMetrics.kpiCount}`}
          subtitle={`${mockMetrics.kpisNegative} declining`}
          icon={<Gauge className="h-6 w-6" />}
          color="#00BCD4"
          trend={{ value: 8, isPositive: true }}
          onClick={() => navigate('/strategy/kpis')}
        />
        <MetricCard
          title="Initiatives"
          value={mockMetrics.activeInitiatives}
          subtitle={`${mockMetrics.completedInitiatives} completed`}
          icon={<Lightbulb className="h-6 w-6" />}
          color="#FF9800"
          onClick={() => navigate('/strategy/initiatives')}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* OKRs Section */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">
              Key OKRs This {selectedPeriod === 'quarter' ? 'Quarter' : 'Year'}
            </CardTitle>
            <div className="flex gap-1">
              <Button
                variant={selectedPeriod === 'quarter' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod('quarter')}
                style={selectedPeriod === 'quarter' ? { backgroundColor: STRATEGY_COLOR } : {}}
              >
                Quarter
              </Button>
              <Button
                variant={selectedPeriod === 'year' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod('year')}
                style={selectedPeriod === 'year' ? { backgroundColor: STRATEGY_COLOR } : {}}
              >
                Year
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[350px]">
              <div className="space-y-3">
                {mockOKRs.map(okr => (
                  <div
                    key={okr.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/strategy/okrs/${okr.id}`)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={cn('mt-1', getStatusColor(okr.status))}>
                          {okr.status === 'on_track' && <CheckCircle className="h-5 w-5" />}
                          {okr.status === 'at_risk' && <AlertTriangle className="h-5 w-5" />}
                          {okr.status === 'behind' && <Clock className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{okr.objective}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground">{okr.owner}</span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">{okr.keyResultsCount} key results</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn('text-2xl font-bold', getStatusColor(okr.status))}>
                          {okr.progress}%
                        </p>
                        <Progress value={okr.progress} className="w-20 h-2 mt-1" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Button variant="ghost" className="w-full mt-4" onClick={() => navigate('/strategy/okrs')}>
              View All OKRs
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Critical KPIs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">KPIs Requiring Attention</CardTitle>
          </CardHeader>
          <CardContent>
            {mockKPIs.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle className="h-12 w-12 text-[var(--rag-green)] mx-auto mb-2" />
                <p className="text-muted-foreground">All KPIs are healthy</p>
              </div>
            ) : (
              <div className="space-y-3">
                {mockKPIs.map(kpi => (
                  <div
                    key={kpi.id}
                    className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/strategy/kpis/${kpi.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {kpi.trend === 'up' ? (
                          <TrendingUp className={cn('h-4 w-4', kpi.trendValue > 0 ? 'text-[var(--rag-red)]' : 'text-[var(--rag-green)]')} />
                        ) : (
                          <TrendingDown className={cn('h-4 w-4', kpi.trendValue < 0 ? 'text-[var(--rag-red)]' : 'text-[var(--rag-green)]')} />
                        )}
                        <span className="font-medium text-sm">{kpi.name}</span>
                      </div>
                      <Badge className={getStatusBadge(kpi.status)}>
                        {kpi.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {kpi.currentValue.toLocaleString()} / {kpi.targetValue.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <Button variant="ghost" className="w-full mt-4" onClick={() => navigate('/strategy/kpis')}>
              View All KPIs
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Initiatives */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold">Active Strategic Initiatives</CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate('/strategy/initiatives/new')}>
            <Plus className="h-4 w-4 mr-1" />
            New Initiative
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {mockInitiatives.map(initiative => (
              <div
                key={initiative.id}
                className="p-4 border rounded-lg hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all"
                onClick={() => navigate(`/strategy/initiatives/${initiative.id}`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="font-medium text-sm line-clamp-2">{initiative.name}</p>
                  <Badge 
                    className={cn(
                      'text-[10px] ml-2 shrink-0',
                      initiative.priority === 'critical' ? 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]' :
                      initiative.priority === 'high' ? 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]' :
                      'bg-[var(--bg-sunken)] text-foreground'
                    )}
                  >
                    {initiative.priority}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{initiative.owner}</p>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{initiative.progress}%</span>
                </div>
                <Progress value={initiative.progress} className="h-1.5" />
              </div>
            ))}
          </div>
          <Button variant="ghost" className="w-full mt-4" onClick={() => navigate('/strategy/initiatives')}>
            View All Initiatives
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default StrategyDashboardPage;
