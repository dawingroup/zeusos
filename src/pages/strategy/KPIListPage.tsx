/**
 * KPIListPage.tsx
 * KPI management page with cards, filters, and trend visualization
 * DawinOS v2.0 - Phase 8.7
 */

import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  X,
  MoreVertical,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  Gauge,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';

import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Badge } from '@/core/components/ui/badge';
import { Progress } from '@/core/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import { Skeleton } from '@/core/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';

const KPI_COLOR = '#00BCD4';

// Mock KPI data
const mockKPIs = [
  {
    id: '1',
    name: 'Monthly Revenue',
    category: 'financial',
    frequency: 'monthly',
    currentValue: 450000000,
    targetValue: 500000000,
    unit: 'UGX',
    format: 'currency',
    status: 'warning',
    trend: 'down',
    trendValue: -5,
    trendDirection: 'negative',
    owner: { name: 'Finance Team' },
    lastUpdated: new Date(2026, 0, 5),
  },
  {
    id: '2',
    name: 'Customer Satisfaction Score',
    category: 'customer',
    frequency: 'weekly',
    currentValue: 4.2,
    targetValue: 4.5,
    unit: '/5',
    format: 'number',
    status: 'on_target',
    trend: 'up',
    trendValue: 3,
    trendDirection: 'positive',
    owner: { name: 'CX Team' },
    lastUpdated: new Date(2026, 0, 6),
  },
  {
    id: '3',
    name: 'Employee Turnover Rate',
    category: 'employee',
    frequency: 'monthly',
    currentValue: 18,
    targetValue: 12,
    unit: '%',
    format: 'percentage',
    status: 'critical',
    trend: 'up',
    trendValue: 8,
    trendDirection: 'negative',
    owner: { name: 'HR Team' },
    lastUpdated: new Date(2026, 0, 4),
  },
  {
    id: '4',
    name: 'Order Fulfillment Rate',
    category: 'operational',
    frequency: 'daily',
    currentValue: 96,
    targetValue: 95,
    unit: '%',
    format: 'percentage',
    status: 'on_target',
    trend: 'up',
    trendValue: 2,
    trendDirection: 'positive',
    owner: { name: 'Operations' },
    lastUpdated: new Date(2026, 0, 7),
  },
  {
    id: '5',
    name: 'Customer Acquisition Cost',
    category: 'financial',
    frequency: 'monthly',
    currentValue: 125000,
    targetValue: 100000,
    unit: 'UGX',
    format: 'currency',
    status: 'critical',
    trend: 'up',
    trendValue: 12,
    trendDirection: 'negative',
    owner: { name: 'Marketing' },
    lastUpdated: new Date(2026, 0, 5),
  },
  {
    id: '6',
    name: 'Website Conversion Rate',
    category: 'growth',
    frequency: 'weekly',
    currentValue: 3.2,
    targetValue: 4.0,
    unit: '%',
    format: 'percentage',
    status: 'warning',
    trend: 'flat',
    trendValue: 0,
    trendDirection: 'neutral',
    owner: { name: 'Digital Team' },
    lastUpdated: new Date(2026, 0, 6),
  },
];

function getStatusColor(status: string): string {
  switch (status) {
    case 'on_target': return 'text-green-600';
    case 'warning': return 'text-amber-600';
    case 'critical': return 'text-red-600';
    default: return 'text-gray-600';
  }
}


function formatValue(value: number, formatType: string): string {
  if (formatType === 'currency') {
    return `UGX ${value.toLocaleString()}`;
  }
  if (formatType === 'percentage') {
    return `${value}%`;
  }
  return value.toLocaleString();
}

interface KPICardProps {
  kpi: typeof mockKPIs[0];
  onEdit: () => void;
  onDelete: () => void;
}

function KPICard({ kpi, onEdit, onDelete }: KPICardProps) {
  const navigate = useNavigate();

  const progressPercent = kpi.targetValue ? Math.min((kpi.currentValue / kpi.targetValue) * 100, 100) : 0;

  const StatusIcon = kpi.status === 'on_target' ? CheckCircle : kpi.status === 'warning' ? AlertTriangle : AlertCircle;
  const TrendIcon = kpi.trend === 'up' ? TrendingUp : kpi.trend === 'down' ? TrendingDown : Minus;

  return (
    <Card
      className="hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
      onClick={() => navigate(`/strategy/kpis/${kpi.id}`)}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className={cn('h-4 w-4', getStatusColor(kpi.status))} />
            <span className="font-semibold text-sm">{kpi.name}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Category & Frequency */}
        <div className="flex gap-1 mt-2">
          <Badge variant="outline" className="text-[10px] capitalize">{kpi.category}</Badge>
          <Badge className="text-[10px]" style={{ backgroundColor: `${KPI_COLOR}20`, color: KPI_COLOR }}>
            {kpi.frequency}
          </Badge>
        </div>

        {/* Value */}
        <div className="mt-4 mb-3">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold">{formatValue(kpi.currentValue, kpi.format)}</span>
            <div className="flex items-center gap-1">
              <TrendIcon 
                className={cn(
                  'h-4 w-4',
                  kpi.trendDirection === 'positive' ? 'text-green-500' :
                  kpi.trendDirection === 'negative' ? 'text-red-500' : 'text-gray-400'
                )} 
              />
              <span className={cn(
                'text-sm font-medium',
                kpi.trendDirection === 'positive' ? 'text-green-500' :
                kpi.trendDirection === 'negative' ? 'text-red-500' : 'text-gray-400'
              )}>
                {kpi.trendValue > 0 ? '+' : ''}{kpi.trendValue}%
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Target: {formatValue(kpi.targetValue, kpi.format)}
          </p>
        </div>

        {/* Progress */}
        <Progress 
          value={progressPercent} 
          className="h-1.5"
        />

        {/* Footer */}
        <div className="flex items-center justify-between mt-3">
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium">
            {kpi.owner.name[0]}
          </div>
          <span className="text-xs text-muted-foreground">
            Updated {format(kpi.lastUpdated, 'MMM d')}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function KPIListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || 'all');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [loading] = useState(false);

  // Filter KPIs
  const filteredKPIs = useMemo(() => {
    return mockKPIs.filter(kpi => {
      if (search && !kpi.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== 'all' && kpi.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && kpi.status !== statusFilter) return false;
      return true;
    });
  }, [search, categoryFilter, statusFilter]);

  // Stats
  const stats = {
    total: mockKPIs.length,
    onTarget: mockKPIs.filter(k => k.status === 'on_target').length,
    warning: mockKPIs.filter(k => k.status === 'warning').length,
    critical: mockKPIs.filter(k => k.status === 'critical').length,
  };

  const hasActiveFilters = search || categoryFilter !== 'all' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-56" />)}
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
            <Gauge className="h-6 w-6" style={{ color: KPI_COLOR }} />
            Key Performance Indicators
          </h1>
          <p className="text-muted-foreground">Track and monitor critical business metrics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => navigate('/strategy/kpis/new')} style={{ backgroundColor: KPI_COLOR }}>
            <Plus className="h-4 w-4 mr-2" />
            New KPI
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-center p-4">
          <p className="text-3xl font-bold">{stats.total}</p>
          <p className="text-sm text-muted-foreground">Total KPIs</p>
        </Card>
        <Card className="text-center p-4 bg-green-50">
          <p className="text-3xl font-bold text-green-600">{stats.onTarget}</p>
          <p className="text-sm text-muted-foreground">On Target</p>
        </Card>
        <Card className="text-center p-4 bg-amber-50">
          <p className="text-3xl font-bold text-amber-600">{stats.warning}</p>
          <p className="text-sm text-muted-foreground">Warning</p>
        </Card>
        <Card className="text-center p-4 bg-red-50">
          <p className="text-3xl font-bold text-red-600">{stats.critical}</p>
          <p className="text-sm text-muted-foreground">Critical</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search KPIs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="financial">Financial</SelectItem>
            <SelectItem value="operational">Operational</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
            <SelectItem value="growth">Growth</SelectItem>
            <SelectItem value="quality">Quality</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="on_target">On Target</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* KPI Grid */}
      {filteredKPIs.length === 0 ? (
        <Card className="p-12 text-center">
          <Gauge className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No KPIs Found</h3>
          <p className="text-muted-foreground mb-4">
            {hasActiveFilters ? 'Try adjusting your filters' : 'Create your first KPI to get started'}
          </p>
          {!hasActiveFilters && (
            <Button onClick={() => navigate('/strategy/kpis/new')} style={{ backgroundColor: KPI_COLOR }}>
              <Plus className="h-4 w-4 mr-2" />
              Create First KPI
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredKPIs.map(kpi => (
            <KPICard
              key={kpi.id}
              kpi={kpi}
              onEdit={() => navigate(`/strategy/kpis/${kpi.id}/edit`)}
              onDelete={() => console.log('Delete', kpi.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default KPIListPage;
