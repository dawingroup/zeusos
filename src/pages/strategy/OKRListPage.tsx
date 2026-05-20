/**
 * OKRListPage.tsx
 * OKR management page with list view, filters, and CRUD operations
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
  Copy,
  Archive,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertTriangle,
  Clock,
  Target,
} from 'lucide-react';

import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Badge } from '@/core/components/ui/badge';
import { Progress } from '@/core/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import { Skeleton } from '@/core/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';

const STRATEGY_COLOR = '#9C27B0';

// Mock OKR data
const mockOKRs = [
  {
    id: '1',
    objective: 'Increase market share in East Africa by 25%',
    progress: 72,
    status: 'on_track',
    period: 'Q1 2026',
    level: 'company',
    owner: { name: 'John Doe', avatar: null },
    keyResults: [
      { id: 'kr1', title: 'Expand to 3 new countries', progress: 66, currentValue: 2, targetValue: 3, unit: 'countries' },
      { id: 'kr2', title: 'Increase revenue by 30%', progress: 80, currentValue: 24, targetValue: 30, unit: '%' },
      { id: 'kr3', title: 'Acquire 500 new customers', progress: 70, currentValue: 350, targetValue: 500, unit: 'customers' },
    ],
    endDate: new Date(2026, 2, 31),
  },
  {
    id: '2',
    objective: 'Launch 3 new product lines by Q4',
    progress: 45,
    status: 'at_risk',
    period: 'Q2 2026',
    level: 'department',
    owner: { name: 'Jane Smith', avatar: null },
    keyResults: [
      { id: 'kr4', title: 'Complete product development', progress: 60, currentValue: 60, targetValue: 100, unit: '%' },
      { id: 'kr5', title: 'Secure manufacturing partners', progress: 33, currentValue: 1, targetValue: 3, unit: 'partners' },
    ],
    endDate: new Date(2026, 5, 30),
  },
  {
    id: '3',
    objective: 'Achieve 95% customer satisfaction rating',
    progress: 88,
    status: 'on_track',
    period: 'Q1 2026',
    level: 'team',
    owner: { name: 'Mike Johnson', avatar: null },
    keyResults: [
      { id: 'kr6', title: 'Reduce response time to < 2 hours', progress: 90, currentValue: 1.8, targetValue: 2, unit: 'hours' },
      { id: 'kr7', title: 'Resolve 98% of tickets within SLA', progress: 85, currentValue: 96, targetValue: 98, unit: '%' },
    ],
    endDate: new Date(2026, 2, 31),
  },
  {
    id: '4',
    objective: 'Reduce operational costs by 15%',
    progress: 32,
    status: 'behind',
    period: 'Q1 2026',
    level: 'company',
    owner: { name: 'Sarah Wilson', avatar: null },
    keyResults: [
      { id: 'kr8', title: 'Automate 50% of manual processes', progress: 40, currentValue: 20, targetValue: 50, unit: '%' },
      { id: 'kr9', title: 'Reduce vendor costs by 10%', progress: 25, currentValue: 2.5, targetValue: 10, unit: '%' },
    ],
    endDate: new Date(2026, 2, 31),
  },
];

function getStatusColor(status: string): string {
  switch (status) {
    case 'on_track': return 'text-green-600';
    case 'at_risk': return 'text-amber-600';
    case 'behind': return 'text-red-600';
    default: return 'text-gray-600';
  }
}


interface OKRCardProps {
  okr: typeof mockOKRs[0];
  onEdit: () => void;
  onDelete: () => void;
}

function OKRCard({ okr, onEdit, onDelete }: OKRCardProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const StatusIcon = okr.status === 'on_track' ? CheckCircle : okr.status === 'at_risk' ? AlertTriangle : Clock;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <StatusIcon className={cn('h-5 w-5 mt-0.5 shrink-0', getStatusColor(okr.status))} />
            <div className="flex-1 min-w-0">
              <p
                className="font-semibold hover:text-primary cursor-pointer"
                onClick={() => navigate(`/strategy/okrs/${okr.id}`)}
              >
                {okr.objective}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">{okr.period}</Badge>
                <Badge className="text-xs" style={{ backgroundColor: `${STRATEGY_COLOR}20`, color: STRATEGY_COLOR }}>
                  {okr.level}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className={cn('text-2xl font-bold', getStatusColor(okr.status))}>{okr.progress}%</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <Progress value={okr.progress} className="h-2" />
        </div>

        {/* Meta & Expand */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
              {okr.owner.name[0]}
            </div>
            <span className="text-sm text-muted-foreground">{okr.owner.name}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {okr.keyResults.length} Key Results
            {expanded ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
          </Button>
        </div>

        {/* Expanded Key Results */}
        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-3">
            {okr.keyResults.map((kr, index) => (
              <div key={kr.id} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{kr.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {kr.currentValue} / {kr.targetValue} {kr.unit}
                    </span>
                    <Progress value={kr.progress} className="w-16 h-1.5" />
                    <span className={cn('text-xs font-medium', getStatusColor(kr.progress >= 70 ? 'on_track' : kr.progress >= 40 ? 'at_risk' : 'behind'))}>
                      {kr.progress}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function OKRListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [periodFilter, setPeriodFilter] = useState(searchParams.get('period') || 'all');
  const [levelFilter, setLevelFilter] = useState(searchParams.get('level') || 'all');
  const [activeTab, setActiveTab] = useState('all');
  const [loading] = useState(false);

  // Filter OKRs
  const filteredOKRs = useMemo(() => {
    return mockOKRs.filter(okr => {
      if (search && !okr.objective.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all' && okr.status !== statusFilter) return false;
      if (periodFilter !== 'all' && okr.period !== periodFilter) return false;
      if (levelFilter !== 'all' && okr.level !== levelFilter) return false;
      if (activeTab === 'at_risk' && okr.status !== 'at_risk') return false;
      if (activeTab === 'behind' && okr.status !== 'behind') return false;
      return true;
    });
  }, [search, statusFilter, periodFilter, levelFilter, activeTab]);

  // Stats
  const stats = {
    total: mockOKRs.length,
    onTrack: mockOKRs.filter(o => o.status === 'on_track').length,
    atRisk: mockOKRs.filter(o => o.status === 'at_risk').length,
    behind: mockOKRs.filter(o => o.status === 'behind').length,
  };

  const hasActiveFilters = search || statusFilter !== 'all' || periodFilter !== 'all' || levelFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPeriodFilter('all');
    setLevelFilter('all');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
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
            Objectives & Key Results
          </h1>
          <p className="text-muted-foreground">Define and track strategic objectives</p>
        </div>
        <Button onClick={() => navigate('/strategy/okrs/new')} style={{ backgroundColor: STRATEGY_COLOR }}>
          <Plus className="h-4 w-4 mr-2" />
          New OKR
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-center p-4">
          <p className="text-3xl font-bold">{stats.total}</p>
          <p className="text-sm text-muted-foreground">Total OKRs</p>
        </Card>
        <Card className="text-center p-4 bg-green-50">
          <p className="text-3xl font-bold text-green-600">{stats.onTrack}</p>
          <p className="text-sm text-muted-foreground">On Track</p>
        </Card>
        <Card className="text-center p-4 bg-amber-50">
          <p className="text-3xl font-bold text-amber-600">{stats.atRisk}</p>
          <p className="text-sm text-muted-foreground">At Risk</p>
        </Card>
        <Card className="text-center p-4 bg-red-50">
          <p className="text-3xl font-bold text-red-600">{stats.behind}</p>
          <p className="text-sm text-muted-foreground">Behind</p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All OKRs</TabsTrigger>
          <TabsTrigger value="my">My OKRs</TabsTrigger>
          <TabsTrigger value="at_risk">At Risk</TabsTrigger>
          <TabsTrigger value="behind">Behind</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search OKRs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="on_track">On Track</SelectItem>
            <SelectItem value="at_risk">At Risk</SelectItem>
            <SelectItem value="behind">Behind</SelectItem>
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Periods</SelectItem>
            <SelectItem value="Q1 2026">Q1 2026</SelectItem>
            <SelectItem value="Q2 2026">Q2 2026</SelectItem>
            <SelectItem value="Q3 2026">Q3 2026</SelectItem>
            <SelectItem value="Q4 2026">Q4 2026</SelectItem>
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="company">Company</SelectItem>
            <SelectItem value="department">Department</SelectItem>
            <SelectItem value="team">Team</SelectItem>
            <SelectItem value="individual">Individual</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* OKR List */}
      {filteredOKRs.length === 0 ? (
        <Card className="p-12 text-center">
          <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No OKRs Found</h3>
          <p className="text-muted-foreground mb-4">
            {hasActiveFilters ? 'Try adjusting your filters' : 'Create your first OKR to get started'}
          </p>
          {!hasActiveFilters && (
            <Button onClick={() => navigate('/strategy/okrs/new')} style={{ backgroundColor: STRATEGY_COLOR }}>
              <Plus className="h-4 w-4 mr-2" />
              Create First OKR
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOKRs.map(okr => (
            <OKRCard
              key={okr.id}
              okr={okr}
              onEdit={() => navigate(`/strategy/okrs/${okr.id}/edit`)}
              onDelete={() => console.log('Delete', okr.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default OKRListPage;
