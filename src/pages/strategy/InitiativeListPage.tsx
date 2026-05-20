/**
 * InitiativeListPage.tsx
 * Strategic initiatives management with kanban and list views
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
  Archive,
  Lightbulb,
  Clock,
  Link,
  LayoutGrid,
  List,
} from 'lucide-react';
import { differenceInDays } from 'date-fns';

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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import { Skeleton } from '@/core/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';

const INITIATIVE_COLOR = '#FF9800';

// Status columns for Kanban view
const STATUS_COLUMNS = [
  { id: 'planning', label: 'Planning', color: '#9E9E9E' },
  { id: 'in_progress', label: 'In Progress', color: '#2196F3' },
  { id: 'on_hold', label: 'On Hold', color: '#FF9800' },
  { id: 'completed', label: 'Completed', color: '#4CAF50' },
];

// Mock initiative data
const mockInitiatives = [
  {
    id: '1',
    name: 'Digital Transformation Program',
    description: 'Modernize core business systems and processes',
    progress: 65,
    priority: 'critical',
    status: 'in_progress',
    owner: { name: 'Tech Team' },
    linkedOKRs: ['okr1', 'okr2'],
    endDate: new Date(2026, 5, 30),
  },
  {
    id: '2',
    name: 'Customer Experience Enhancement',
    description: 'Improve customer journey across all touchpoints',
    progress: 40,
    priority: 'high',
    status: 'in_progress',
    owner: { name: 'CX Team' },
    linkedOKRs: ['okr3'],
    endDate: new Date(2026, 3, 30),
  },
  {
    id: '3',
    name: 'Supply Chain Optimization',
    description: 'Streamline procurement and logistics',
    progress: 80,
    priority: 'medium',
    status: 'in_progress',
    owner: { name: 'Operations' },
    linkedOKRs: [],
    endDate: new Date(2026, 2, 31),
  },
  {
    id: '4',
    name: 'Talent Development Initiative',
    description: 'Build leadership pipeline and skills',
    progress: 55,
    priority: 'high',
    status: 'in_progress',
    owner: { name: 'HR Team' },
    linkedOKRs: ['okr4'],
    endDate: new Date(2026, 8, 30),
  },
  {
    id: '5',
    name: 'Market Expansion Strategy',
    description: 'Enter 2 new East African markets',
    progress: 25,
    priority: 'critical',
    status: 'planning',
    owner: { name: 'Strategy' },
    linkedOKRs: ['okr1'],
    endDate: new Date(2026, 11, 31),
  },
  {
    id: '6',
    name: 'Sustainability Program',
    description: 'Reduce carbon footprint by 30%',
    progress: 15,
    priority: 'medium',
    status: 'planning',
    owner: { name: 'Operations' },
    linkedOKRs: [],
    endDate: new Date(2026, 11, 31),
  },
  {
    id: '7',
    name: 'Product Innovation Lab',
    description: 'R&D for next-gen product lines',
    progress: 0,
    priority: 'low',
    status: 'on_hold',
    owner: { name: 'R&D Team' },
    linkedOKRs: [],
    endDate: null,
  },
  {
    id: '8',
    name: 'Legacy System Migration',
    description: 'Migrate from legacy ERP to modern platform',
    progress: 100,
    priority: 'high',
    status: 'completed',
    owner: { name: 'IT Team' },
    linkedOKRs: ['okr2'],
    endDate: new Date(2025, 11, 31),
  },
];

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'critical': return 'bg-red-100 text-red-800';
    case 'high': return 'bg-amber-100 text-amber-800';
    case 'medium': return 'bg-blue-100 text-blue-800';
    case 'low': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

interface InitiativeCardProps {
  initiative: typeof mockInitiatives[0];
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
  compact?: boolean;
}

function InitiativeCard({ initiative, onEdit, onDelete, onArchive, compact = false }: InitiativeCardProps) {
  const navigate = useNavigate();

  const daysRemaining = initiative.endDate
    ? differenceInDays(initiative.endDate, new Date())
    : null;

  return (
    <Card
      className={cn(
        'hover:shadow-md hover:border-primary/50 transition-all cursor-pointer',
        compact && 'shadow-sm'
      )}
      onClick={() => navigate(`/strategy/initiatives/${initiative.id}`)}
    >
      <CardContent className={cn('p-4', compact && 'p-3')}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={cn('font-semibold truncate', compact ? 'text-sm' : '')}>{initiative.name}</p>
            {!compact && (
              <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{initiative.description}</p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(); }}>
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Priority & Timeline */}
        <div className="flex gap-1.5 mt-2">
          <Badge className={cn('text-[10px] capitalize', getPriorityColor(initiative.priority))}>
            {initiative.priority}
          </Badge>
          {daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 14 && (
            <Badge variant="outline" className="text-[10px] gap-0.5">
              <Clock className="h-3 w-3" />
              {daysRemaining}d
            </Badge>
          )}
        </div>

        {/* Progress */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{initiative.progress}%</span>
          </div>
          <Progress value={initiative.progress} className="h-1.5" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3">
          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium">
            {initiative.owner.name[0]}
          </div>
          {initiative.linkedOKRs.length > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Link className="h-3 w-3" />
              <span className="text-[10px]">{initiative.linkedOKRs.length}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function InitiativeListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') || 'all');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [loading] = useState(false);

  // Filter initiatives
  const filteredInitiatives = useMemo(() => {
    return mockInitiatives.filter(init => {
      if (search && !init.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (priorityFilter !== 'all' && init.priority !== priorityFilter) return false;
      return true;
    });
  }, [search, priorityFilter]);

  // Group by status for kanban
  const getInitiativesByStatus = (status: string) =>
    filteredInitiatives.filter(i => i.status === status);

  const hasActiveFilters = search || priorityFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setPriorityFilter('all');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-96" />)}
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
            <Lightbulb className="h-6 w-6" style={{ color: INITIATIVE_COLOR }} />
            Strategic Initiatives
          </h1>
          <p className="text-muted-foreground">Plan and execute strategic projects</p>
        </div>
        <Button onClick={() => navigate('/strategy/initiatives/new')} style={{ backgroundColor: INITIATIVE_COLOR }}>
          <Plus className="h-4 w-4 mr-2" />
          New Initiative
        </Button>
      </div>

      {/* Filters & View Toggle */}
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="flex gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search initiatives..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
        <div className="flex gap-1 border rounded-md p-1">
          <Button
            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('kanban')}
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Kanban
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4 mr-1" />
            List
          </Button>
        </div>
      </div>

      {/* Content */}
      {filteredInitiatives.length === 0 ? (
        <Card className="p-12 text-center">
          <Lightbulb className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Initiatives Found</h3>
          <p className="text-muted-foreground mb-4">
            {hasActiveFilters ? 'Try adjusting your filters' : 'Create your first initiative to get started'}
          </p>
          {!hasActiveFilters && (
            <Button onClick={() => navigate('/strategy/initiatives/new')} style={{ backgroundColor: INITIATIVE_COLOR }}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Initiative
            </Button>
          )}
        </Card>
      ) : viewMode === 'kanban' ? (
        /* Kanban View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATUS_COLUMNS.map(column => (
            <div
              key={column.id}
              className="rounded-lg p-3"
              style={{ backgroundColor: `${column.color}10`, border: `1px solid ${column.color}30` }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: column.color }} />
                  <span className="font-medium text-sm">{column.label}</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {getInitiativesByStatus(column.id).length}
                </Badge>
              </div>
              <div className="space-y-3 min-h-[200px]">
                {getInitiativesByStatus(column.id).map(initiative => (
                  <InitiativeCard
                    key={initiative.id}
                    initiative={initiative}
                    onEdit={() => navigate(`/strategy/initiatives/${initiative.id}/edit`)}
                    onDelete={() => console.log('Delete', initiative.id)}
                    onArchive={() => console.log('Archive', initiative.id)}
                    compact
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="space-y-4">
          {filteredInitiatives.map(initiative => (
            <InitiativeCard
              key={initiative.id}
              initiative={initiative}
              onEdit={() => navigate(`/strategy/initiatives/${initiative.id}/edit`)}
              onDelete={() => console.log('Delete', initiative.id)}
              onArchive={() => console.log('Archive', initiative.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default InitiativeListPage;
