/**
 * BudgetListPage.tsx
 * Budget management with filters, utilization tracking, and over-budget warnings
 * DawinOS v2.0 - Phase 8.8
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
  Download,
  TrendingUp,
  AlertTriangle,
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

const FINANCE_COLOR = '#4CAF50';

// Format currency in UGX
function formatCurrencyUGX(amount: number): string {
  return `UGX ${amount.toLocaleString()}`;
}

// Budget categories
const BUDGET_CATEGORIES = [
  { value: 'operational', label: 'Operational' },
  { value: 'capital', label: 'Capital' },
  { value: 'project', label: 'Project' },
  { value: 'department', label: 'Department' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'hr', label: 'HR' },
];

// Budget periods
const BUDGET_PERIODS = [
  { value: 'Q1 2026', label: 'Q1 2026' },
  { value: 'Q2 2026', label: 'Q2 2026' },
  { value: 'Q3 2026', label: 'Q3 2026' },
  { value: 'Q4 2026', label: 'Q4 2026' },
  { value: 'FY2026', label: 'FY 2026' },
];

// Mock budget data
const mockBudgets = [
  { id: '1', name: 'Operations Q1', category: 'operational', period: 'Q1 2026', spent: 45000000, allocated: 60000000, utilization: 75, remaining: 15000000, ownerName: 'John Doe', ownerId: 'user1' },
  { id: '2', name: 'Marketing Campaign', category: 'marketing', period: 'Q1 2026', spent: 28000000, allocated: 25000000, utilization: 112, remaining: -3000000, ownerName: 'Jane Smith', ownerId: 'user2' },
  { id: '3', name: 'IT Infrastructure', category: 'capital', period: 'FY2026', spent: 35000000, allocated: 50000000, utilization: 70, remaining: 15000000, ownerName: 'Mike Johnson', ownerId: 'user1' },
  { id: '4', name: 'HR Training', category: 'hr', period: 'Q1 2026', spent: 8000000, allocated: 15000000, utilization: 53, remaining: 7000000, ownerName: 'Sarah Wilson', ownerId: 'user3' },
  { id: '5', name: 'Office Supplies', category: 'operational', period: 'Q1 2026', spent: 4500000, allocated: 5000000, utilization: 90, remaining: 500000, ownerName: 'David Brown', ownerId: 'user1' },
  { id: '6', name: 'Product Development', category: 'project', period: 'Q2 2026', spent: 120000000, allocated: 100000000, utilization: 120, remaining: -20000000, ownerName: 'Emily Davis', ownerId: 'user4' },
  { id: '7', name: 'Customer Support', category: 'department', period: 'Q1 2026', spent: 18000000, allocated: 25000000, utilization: 72, remaining: 7000000, ownerName: 'Chris Lee', ownerId: 'user5' },
  { id: '8', name: 'Sales Incentives', category: 'marketing', period: 'Q1 2026', spent: 22000000, allocated: 30000000, utilization: 73, remaining: 8000000, ownerName: 'Anna Kim', ownerId: 'user2' },
];

export function BudgetListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || 'all');
  const [periodFilter, setPeriodFilter] = useState(searchParams.get('period') || 'all');
  const [activeTab, setActiveTab] = useState('all');
  const [loading] = useState(false);

  // Filter budgets
  const filteredBudgets = useMemo(() => {
    return mockBudgets.filter(budget => {
      if (search && !budget.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== 'all' && budget.category !== categoryFilter) return false;
      if (periodFilter !== 'all' && budget.period !== periodFilter) return false;
      if (activeTab === 'my') return budget.ownerId === 'user1'; // Mock current user
      if (activeTab === 'over') return budget.utilization >= 100;
      return true;
    });
  }, [search, categoryFilter, periodFilter, activeTab]);

  // Stats
  const stats = {
    totalBudgets: mockBudgets.length,
    totalAllocated: mockBudgets.reduce((sum, b) => sum + b.allocated, 0),
    totalSpent: mockBudgets.reduce((sum, b) => sum + b.spent, 0),
    overBudgetCount: mockBudgets.filter(b => b.utilization >= 100).length,
  };
  const overallUtilization = Math.round((stats.totalSpent / stats.totalAllocated) * 100);

  const hasActiveFilters = search || categoryFilter !== 'all' || periodFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setPeriodFilter('all');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-48" />)}
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
            <TrendingUp className="h-6 w-6" style={{ color: FINANCE_COLOR }} />
            Budgets
          </h1>
          <p className="text-muted-foreground">Manage company budgets and track spending</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => navigate('/finance/budgets/new')} style={{ backgroundColor: FINANCE_COLOR }}>
            <Plus className="h-4 w-4 mr-2" />
            New Budget
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-center p-4">
          <p className="text-3xl font-bold">{stats.totalBudgets}</p>
          <p className="text-sm text-muted-foreground">Total Budgets</p>
        </Card>
        <Card className="text-center p-4">
          <p className="text-xl font-bold">{formatCurrencyUGX(stats.totalAllocated)}</p>
          <p className="text-sm text-muted-foreground">Total Allocated</p>
        </Card>
        <Card className="text-center p-4">
          <p className="text-xl font-bold">{formatCurrencyUGX(stats.totalSpent)}</p>
          <p className="text-xs text-muted-foreground">({overallUtilization}% utilized)</p>
        </Card>
        <Card className="text-center p-4 bg-red-50">
          <p className="text-3xl font-bold text-red-600">{stats.overBudgetCount}</p>
          <p className="text-sm text-muted-foreground">Over Budget</p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Budgets</TabsTrigger>
          <TabsTrigger value="my">My Budgets</TabsTrigger>
          <TabsTrigger value="over">Over Budget</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search budgets..."
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
            {BUDGET_CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Periods</SelectItem>
            {BUDGET_PERIODS.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Budget Cards */}
      {filteredBudgets.length === 0 ? (
        <Card className="p-12 text-center">
          <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Budgets Found</h3>
          <p className="text-muted-foreground mb-4">
            {hasActiveFilters ? 'Try adjusting your filters' : 'Create your first budget to get started'}
          </p>
          {!hasActiveFilters && (
            <Button onClick={() => navigate('/finance/budgets/new')} style={{ backgroundColor: FINANCE_COLOR }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Budget
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBudgets.map(budget => (
            <Card
              key={budget.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/finance/budgets/${budget.id}`)}
            >
              <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{budget.name}</p>
                    <div className="flex gap-1 mt-1">
                      <Badge variant="outline" className="text-xs capitalize">{budget.category}</Badge>
                      <Badge className="text-xs" style={{ backgroundColor: `${FINANCE_COLOR}20`, color: FINANCE_COLOR }}>
                        {budget.period}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/finance/budgets/${budget.id}/edit`); }}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Progress */}
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{formatCurrencyUGX(budget.spent)}</span>
                    <span className="text-muted-foreground">{formatCurrencyUGX(budget.allocated)}</span>
                  </div>
                  <Progress 
                    value={Math.min(budget.utilization, 100)} 
                    className={cn(
                      "h-2",
                      budget.utilization >= 100 ? "[&>div]:bg-red-500" :
                      budget.utilization >= 90 ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500"
                    )}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-medium">{budget.utilization.toFixed(1)}% utilized</span>
                    {budget.utilization >= 100 ? (
                      <Badge className="text-[10px] bg-red-100 text-red-800 gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Over by {formatCurrencyUGX(Math.abs(budget.remaining))}
                      </Badge>
                    ) : (
                      <span className="text-xs text-green-600">{formatCurrencyUGX(budget.remaining)} remaining</span>
                    )}
                  </div>
                </div>

                {/* Owner */}
                <div className="flex items-center gap-2 mt-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                    {budget.ownerName[0]}
                  </div>
                  <span className="text-xs text-muted-foreground">{budget.ownerName}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default BudgetListPage;
