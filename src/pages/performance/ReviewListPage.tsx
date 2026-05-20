/**
 * ReviewListPage.tsx
 * Performance reviews management with table view and approval workflow
 * DawinOS v2.0 - Phase 8.9
 */

import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  MoreVertical,
  Edit,
  Eye,
  Play,
  XCircle,
  Download,
  FileText,
  Star,
  ArrowUpDown,
} from 'lucide-react';
import { format, isPast } from 'date-fns';

import { Card } from '@/core/components/ui/card';
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
import { Skeleton } from '@/core/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';

const PERFORMANCE_COLOR = '#FF5722';

// Review statuses
const REVIEW_STATUSES = [
  { value: 'scheduled', label: 'Scheduled', color: 'bg-gray-100 text-gray-800' },
  { value: 'self_assessment', label: 'Self Assessment', color: 'bg-blue-100 text-blue-800' },
  { value: 'manager_review', label: 'Manager Review', color: 'bg-amber-100 text-amber-800' },
  { value: 'calibration', label: 'Calibration', color: 'bg-purple-100 text-purple-800' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
  { value: 'acknowledged', label: 'Acknowledged', color: 'bg-green-100 text-green-800' },
];

// Review types
const REVIEW_TYPES = [
  { value: 'annual', label: 'Annual' },
  { value: 'mid_year', label: 'Mid-Year' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'probation', label: 'Probation' },
  { value: 'project', label: 'Project' },
];

// Mock review data
const mockReviews = [
  { id: '1', employeeName: 'David Ssempala', employeePosition: 'Senior Developer', reviewType: 'annual', scheduledDate: new Date(2026, 0, 10), reviewerName: 'John Manager', status: 'scheduled', rating: null },
  { id: '2', employeeName: 'Rebecca Nambi', employeePosition: 'Marketing Lead', reviewType: 'mid_year', scheduledDate: new Date(2026, 0, 12), reviewerName: 'Sarah Director', status: 'self_assessment', rating: null },
  { id: '3', employeeName: 'Samuel Okello', employeePosition: 'Sales Rep', reviewType: 'probation', scheduledDate: new Date(2026, 0, 5), reviewerName: 'Peter Manager', status: 'manager_review', rating: null },
  { id: '4', employeeName: 'Agnes Akoth', employeePosition: 'HR Specialist', reviewType: 'quarterly', scheduledDate: new Date(2026, 0, 15), reviewerName: 'Mary Director', status: 'scheduled', rating: null },
  { id: '5', employeeName: 'Moses Wafula', employeePosition: 'Accountant', reviewType: 'annual', scheduledDate: new Date(2026, 0, 18), reviewerName: 'Grace CFO', status: 'calibration', rating: 4.2 },
  { id: '6', employeeName: 'Alice Namutebi', employeePosition: 'Project Manager', reviewType: 'annual', scheduledDate: new Date(2025, 11, 20), reviewerName: 'John Director', status: 'completed', rating: 4.5 },
  { id: '7', employeeName: 'Brian Musoke', employeePosition: 'Engineer', reviewType: 'mid_year', scheduledDate: new Date(2025, 11, 15), reviewerName: 'Sarah Manager', status: 'acknowledged', rating: 3.8 },
];

function RatingDisplay({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-muted-foreground text-sm">-</span>;
  return (
    <div className="flex items-center gap-1">
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
      <span className="text-sm font-medium">{rating.toFixed(1)}</span>
    </div>
  );
}

export function ReviewListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || 'all');
  const [activeTab, setActiveTab] = useState('all');
  const [sortField, setSortField] = useState<'date' | 'name' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loading] = useState(false);

  // Filter and sort reviews
  const processedReviews = useMemo(() => {
    let filtered = [...mockReviews];

    // Tab filter
    if (activeTab === 'my') {
      filtered = filtered.filter(r => r.employeeName === 'David Ssempala'); // Mock current user
    } else if (activeTab === 'to_review') {
      filtered = filtered.filter(r => r.status === 'manager_review');
    } else if (activeTab === 'upcoming') {
      filtered = filtered.filter(r => r.status === 'scheduled');
    } else if (activeTab === 'completed') {
      filtered = filtered.filter(r => ['completed', 'acknowledged'].includes(r.status));
    }

    // Search filter
    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.employeeName.toLowerCase().includes(query) ||
        r.employeePosition.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(r => r.reviewType === typeFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison = a.scheduledDate.getTime() - b.scheduledDate.getTime();
          break;
        case 'name':
          comparison = a.employeeName.localeCompare(b.employeeName);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [search, statusFilter, typeFilter, activeTab, sortField, sortOrder]);

  // Stats
  const stats = {
    total: mockReviews.length,
    scheduled: mockReviews.filter(r => r.status === 'scheduled').length,
    inProgress: mockReviews.filter(r => ['self_assessment', 'manager_review', 'calibration'].includes(r.status)).length,
    completed: mockReviews.filter(r => ['completed', 'acknowledged'].includes(r.status)).length,
    toReview: mockReviews.filter(r => r.status === 'manager_review').length,
  };

  const handleSort = (field: 'date' | 'name' | 'status') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
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
            <FileText className="h-6 w-6" style={{ color: PERFORMANCE_COLOR }} />
            Performance Reviews
          </h1>
          <p className="text-muted-foreground">Manage and track employee performance reviews</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => navigate('/performance/reviews/new')} style={{ backgroundColor: PERFORMANCE_COLOR }}>
            <Plus className="h-4 w-4 mr-2" />
            Schedule Review
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card className="text-center p-3">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total Reviews</p>
        </Card>
        <Card className="text-center p-3">
          <p className="text-2xl font-bold text-gray-600">{stats.scheduled}</p>
          <p className="text-xs text-muted-foreground">Scheduled</p>
        </Card>
        <Card className="text-center p-3">
          <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
          <p className="text-xs text-muted-foreground">In Progress</p>
        </Card>
        <Card className="text-center p-3">
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </Card>
        <Card className="text-center p-3" style={{ backgroundColor: `${PERFORMANCE_COLOR}10` }}>
          <p className="text-2xl font-bold" style={{ color: PERFORMANCE_COLOR }}>{stats.toReview}</p>
          <p className="text-xs text-muted-foreground">To Review</p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Reviews</TabsTrigger>
          <TabsTrigger value="my">My Reviews</TabsTrigger>
          <TabsTrigger value="to_review">To Review</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by employee name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {REVIEW_STATUSES.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {REVIEW_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Reviews Table */}
      {processedReviews.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Reviews Found</h3>
          <p className="text-muted-foreground mb-4">
            {search || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Schedule a performance review to get started'}
          </p>
          <Button onClick={() => navigate('/performance/reviews/new')} style={{ backgroundColor: PERFORMANCE_COLOR }}>
            <Plus className="h-4 w-4 mr-2" />
            Schedule Review
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="p-3 text-left">Employee</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-left">
                    <Button variant="ghost" size="sm" className="h-auto p-0 font-medium" onClick={() => handleSort('date')}>
                      Scheduled Date
                      <ArrowUpDown className="h-3 w-3 ml-1" />
                    </Button>
                  </th>
                  <th className="p-3 text-left">Reviewer</th>
                  <th className="p-3 text-left">
                    <Button variant="ghost" size="sm" className="h-auto p-0 font-medium" onClick={() => handleSort('status')}>
                      Status
                      <ArrowUpDown className="h-3 w-3 ml-1" />
                    </Button>
                  </th>
                  <th className="p-3 text-left">Rating</th>
                  <th className="p-3 text-right w-10"></th>
                </tr>
              </thead>
              <tbody>
                {processedReviews.map(review => {
                  const statusInfo = REVIEW_STATUSES.find(s => s.value === review.status);
                  const typeInfo = REVIEW_TYPES.find(t => t.value === review.reviewType);
                  const isOverdue = isPast(review.scheduledDate) && !['completed', 'acknowledged'].includes(review.status);

                  return (
                    <tr
                      key={review.id}
                      className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/performance/reviews/${review.id}`)}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                            {review.employeeName[0]}
                          </div>
                          <div>
                            <p className="font-medium">{review.employeeName}</p>
                            <p className="text-xs text-muted-foreground">{review.employeePosition}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">{typeInfo?.label}</Badge>
                      </td>
                      <td className="p-3">
                        <p className={cn(isOverdue && "text-red-600")}>
                          {format(review.scheduledDate, 'MMM d, yyyy')}
                        </p>
                        {isOverdue && <p className="text-xs text-red-600">Overdue</p>}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium">
                            {review.reviewerName[0]}
                          </div>
                          <span className="text-sm">{review.reviewerName}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge className={cn("text-xs", statusInfo?.color)}>
                          {statusInfo?.label}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <RatingDisplay rating={review.rating} />
                      </td>
                      <td className="p-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/performance/reviews/${review.id}`); }}>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            {review.status === 'manager_review' && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/performance/reviews/${review.id}/conduct`); }}>
                                <Play className="h-4 w-4 mr-2" />
                                Start Review
                              </DropdownMenuItem>
                            )}
                            {review.status === 'scheduled' && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/performance/reviews/${review.id}/edit`); }}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {!['completed', 'acknowledged'].includes(review.status) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive">
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Cancel
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export default ReviewListPage;
