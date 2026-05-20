/**
 * ExpenseListPage.tsx
 * Expense management with table view, filters, and approval workflow
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
  Eye,
  Download,
  CheckCircle,
  XCircle,
  Receipt,
  Paperclip,
  ArrowUpDown,
} from 'lucide-react';
import { format } from 'date-fns';

import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Badge } from '@/core/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { Textarea } from '@/core/components/ui/textarea';
import { Skeleton } from '@/core/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';

const FINANCE_COLOR = '#4CAF50';

// Format currency in UGX
function formatCurrencyUGX(amount: number): string {
  return `UGX ${amount.toLocaleString()}`;
}

// Expense categories
const EXPENSE_CATEGORIES = [
  { value: 'travel', label: 'Travel' },
  { value: 'meals', label: 'Meals & Entertainment' },
  { value: 'supplies', label: 'Office Supplies' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'transport', label: 'Transport' },
  { value: 'communication', label: 'Communication' },
  { value: 'professional', label: 'Professional Services' },
  { value: 'other', label: 'Other' },
];

const statusColors: Record<string, string> = {
  approved: 'bg-green-100 text-green-800',
  pending: 'bg-amber-100 text-amber-800',
  rejected: 'bg-red-100 text-red-800',
  paid: 'bg-blue-100 text-blue-800',
  draft: 'bg-gray-100 text-gray-800',
};

// Mock expense data
const mockExpenses = [
  { id: '1', description: 'Office Rent - January', category: 'utilities', amount: 15000000, date: new Date(2026, 0, 5), status: 'paid', submitter: 'John Doe', vendor: 'Kampala Properties Ltd', hasAttachments: true },
  { id: '2', description: 'Fuel for Delivery Vehicles', category: 'transport', amount: 3500000, date: new Date(2026, 0, 6), status: 'pending', submitter: 'Jane Smith', vendor: 'Shell Uganda', hasAttachments: true },
  { id: '3', description: 'Staff Training Workshop', category: 'professional', amount: 8000000, date: new Date(2026, 0, 4), status: 'approved', submitter: 'Mike Johnson', vendor: 'Training Solutions Ltd', hasAttachments: false },
  { id: '4', description: 'Internet & Communication', category: 'communication', amount: 2500000, date: new Date(2026, 0, 3), status: 'paid', submitter: 'Sarah Wilson', vendor: 'MTN Uganda', hasAttachments: true },
  { id: '5', description: 'Marketing Materials', category: 'supplies', amount: 5000000, date: new Date(2026, 0, 2), status: 'pending', submitter: 'David Brown', vendor: 'Print House', hasAttachments: true },
  { id: '6', description: 'Client Entertainment', category: 'meals', amount: 1200000, date: new Date(2026, 0, 1), status: 'rejected', submitter: 'Emily Davis', vendor: 'Serena Hotel', hasAttachments: false },
  { id: '7', description: 'Travel to Mbarara', category: 'travel', amount: 850000, date: new Date(2025, 11, 28), status: 'approved', submitter: 'Chris Lee', vendor: 'Link Bus', hasAttachments: true },
  { id: '8', description: 'Office Stationery', category: 'supplies', amount: 450000, date: new Date(2025, 11, 27), status: 'draft', submitter: 'Anna Kim', vendor: 'Office Mart', hasAttachments: false },
];

type SortField = 'date' | 'amount' | 'category' | 'status';
type SortOrder = 'asc' | 'desc';

export function ExpenseListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || 'all');
  const [activeTab, setActiveTab] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; expenseId: string | null }>({ open: false, expenseId: null });
  const [rejectReason, setRejectReason] = useState('');
  const [loading] = useState(false);

  // Filter and sort expenses
  const processedExpenses = useMemo(() => {
    let filtered = [...mockExpenses];

    // Tab filter
    if (activeTab === 'my') {
      filtered = filtered.filter(e => e.submitter === 'John Doe'); // Mock current user
    } else if (activeTab === 'pending') {
      filtered = filtered.filter(e => e.status === 'pending');
    } else if (activeTab === 'rejected') {
      filtered = filtered.filter(e => e.status === 'rejected');
    }

    // Search filter
    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(e =>
        e.description.toLowerCase().includes(query) ||
        e.category.toLowerCase().includes(query) ||
        e.vendor?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(e => e.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(e => e.category === categoryFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison = a.date.getTime() - b.date.getTime();
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [search, statusFilter, categoryFilter, activeTab, sortField, sortOrder]);

  // Selection handlers
  const pendingExpenses = processedExpenses.filter(e => e.status === 'pending');
  const allPendingSelected = pendingExpenses.length > 0 && pendingExpenses.every(e => selected.includes(e.id));

  const handleSelectAll = () => {
    if (allPendingSelected) {
      setSelected([]);
    } else {
      setSelected(pendingExpenses.map(e => e.id));
    }
  };

  const handleSelectOne = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const hasActiveFilters = search || statusFilter !== 'all' || categoryFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCategoryFilter('all');
  };

  const handleBulkApprove = () => {
    console.log('Approving:', selected);
    setSelected([]);
  };

  const handleApprove = (id: string) => {
    console.log('Approving:', id);
  };

  const handleReject = () => {
    console.log('Rejecting:', rejectDialog.expenseId, 'Reason:', rejectReason);
    setRejectDialog({ open: false, expenseId: null });
    setRejectReason('');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6" style={{ color: FINANCE_COLOR }} />
            Expenses
          </h1>
          <p className="text-muted-foreground">Manage and track company expenses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => navigate('/finance/expenses/new')} style={{ backgroundColor: FINANCE_COLOR }}>
            <Plus className="h-4 w-4 mr-2" />
            New Expense
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selected.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-green-900">
                {selected.length} expense{selected.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelected([])}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleBulkApprove} style={{ backgroundColor: FINANCE_COLOR }}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Expenses</TabsTrigger>
          <TabsTrigger value="my">My Expenses</TabsTrigger>
          <TabsTrigger value="pending">Pending Approval</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search expenses..."
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
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {EXPENSE_CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
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

      {/* Expense Table */}
      {processedExpenses.length === 0 ? (
        <Card className="p-12 text-center">
          <Receipt className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Expenses Found</h3>
          <p className="text-muted-foreground mb-4">
            {hasActiveFilters ? 'Try adjusting your filters' : 'Create your first expense to get started'}
          </p>
          {!hasActiveFilters && (
            <Button onClick={() => navigate('/finance/expenses/new')} style={{ backgroundColor: FINANCE_COLOR }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Expense
            </Button>
          )}
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="p-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={allPendingSelected}
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </th>
                  <th className="p-3 text-left">
                    <Button variant="ghost" size="sm" className="h-auto p-0 font-medium" onClick={() => handleSort('date')}>
                      Date
                      <ArrowUpDown className="h-3 w-3 ml-1" />
                    </Button>
                  </th>
                  <th className="p-3 text-left">Description</th>
                  <th className="p-3 text-left">
                    <Button variant="ghost" size="sm" className="h-auto p-0 font-medium" onClick={() => handleSort('category')}>
                      Category
                      <ArrowUpDown className="h-3 w-3 ml-1" />
                    </Button>
                  </th>
                  <th className="p-3 text-right">
                    <Button variant="ghost" size="sm" className="h-auto p-0 font-medium" onClick={() => handleSort('amount')}>
                      Amount
                      <ArrowUpDown className="h-3 w-3 ml-1" />
                    </Button>
                  </th>
                  <th className="p-3 text-left">Submitter</th>
                  <th className="p-3 text-left">
                    <Button variant="ghost" size="sm" className="h-auto p-0 font-medium" onClick={() => handleSort('status')}>
                      Status
                      <ArrowUpDown className="h-3 w-3 ml-1" />
                    </Button>
                  </th>
                  <th className="p-3 text-right w-10"></th>
                </tr>
              </thead>
              <tbody>
                {processedExpenses.map(expense => (
                  <tr key={expense.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      {expense.status === 'pending' && (
                        <input
                          type="checkbox"
                          checked={selected.includes(expense.id)}
                          onChange={() => handleSelectOne(expense.id)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {format(expense.date, 'MMM d, yyyy')}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{expense.description}</span>
                        {expense.hasAttachments && (
                          <Paperclip className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{expense.vendor}</span>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs capitalize">{expense.category}</Badge>
                    </td>
                    <td className="p-3 text-right font-medium">
                      {formatCurrencyUGX(expense.amount)}
                    </td>
                    <td className="p-3 text-muted-foreground">{expense.submitter}</td>
                    <td className="p-3">
                      <Badge className={cn("text-xs capitalize", statusColors[expense.status])}>
                        {expense.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/finance/expenses/${expense.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          {expense.status === 'draft' && (
                            <DropdownMenuItem onClick={() => navigate(`/finance/expenses/${expense.id}/edit`)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {expense.status === 'pending' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleApprove(expense.id)} className="text-green-600">
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setRejectDialog({ open: true, expenseId: expense.id })} className="text-red-600">
                                <XCircle className="h-4 w-4 mr-2" />
                                Reject
                              </DropdownMenuItem>
                            </>
                          )}
                          {expense.status === 'draft' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(open: boolean) => setRejectDialog({ open, expenseId: open ? rejectDialog.expenseId : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Expense</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this expense. The submitter will be notified.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter rejection reason..."
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, expenseId: null })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>
              Reject Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ExpenseListPage;
