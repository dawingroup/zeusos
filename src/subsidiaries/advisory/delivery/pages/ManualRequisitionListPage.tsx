/**
 * MANUAL REQUISITION LIST PAGE
 *
 * Backlog management page for manually entered requisitions.
 * Shows summary stats, filtering, and actions for linking to projects.
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Link2,
  LinkIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  MoreVertical,
  Trash2,
  Edit,
  Eye,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
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
import { Badge } from '@/core/components/ui/badge';
import { Card, CardContent } from '@/core/components/ui/card';
import { Skeleton } from '@/core/components/ui/skeleton';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import { formatCurrency } from '@/subsidiaries/advisory/core/utils/formatters';
import { format } from 'date-fns';
import {
  useManualRequisitions,
  useDeleteManualRequisition,
  useManualRequisitionSummary,
} from '../hooks/manual-requisition-hooks';
import { ManualRequisition, ManualRequisitionStatus } from '../types/manual-requisition';
import { AccountabilityStatus } from '../types/requisition';

// ─────────────────────────────────────────────────────────────────
// STATUS BADGES
// ─────────────────────────────────────────────────────────────────

function LinkStatusBadge({ status }: { status: ManualRequisitionStatus }) {
  switch (status) {
    case 'unlinked':
      return (
        <Badge variant="outline" className="text-gray-600 border-gray-300">
          <Link2 className="w-3 h-3 mr-1" />
          Unlinked
        </Badge>
      );
    case 'linked':
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">
          <LinkIcon className="w-3 h-3 mr-1" />
          Linked
        </Badge>
      );
    case 'reconciled':
      return (
        <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Reconciled
        </Badge>
      );
    default:
      return null;
  }
}

function AccountabilityStatusBadge({ status }: { status: AccountabilityStatus }) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    case 'partial':
      return (
        <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
          <TrendingUp className="w-3 h-3 mr-1" />
          Partial
        </Badge>
      );
    case 'complete':
      return (
        <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Complete
        </Badge>
      );
    case 'overdue':
      return (
        <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
          <AlertCircle className="w-3 h-3 mr-1" />
          Overdue
        </Badge>
      );
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// SUMMARY CARDS
// ─────────────────────────────────────────────────────────────────

function SummaryCards() {
  const { summary, loading } = useManualRequisitionSummary();
  const isLoading = loading || !summary;

  return (
    <div className="mb-6">
      <KPIGrid cols={4}>
        <KPICard
          label="Total Backlog"
          value={isLoading ? <Skeleton className="h-7 w-12" /> : summary!.total}
          delta={isLoading ? undefined : formatCurrency(summary!.totalAmount, 'UGX')}
        />
        <KPICard
          label="Unlinked"
          value={isLoading ? <Skeleton className="h-7 w-12" /> : summary!.unlinked}
          delta="Needs project linking"
        />
        <KPICard
          label="Linked"
          value={isLoading ? <Skeleton className="h-7 w-12" /> : summary!.linked}
          delta="Awaiting reconciliation"
        />
        <KPICard
          label="Unaccounted"
          value={
            isLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              formatCurrency(summary!.totalUnaccountedAmount, 'UGX')
            )
          }
          delta={
            !isLoading && summary!.overdueCount > 0 ? (
              <span className="inline-flex items-center">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {summary!.overdueCount} overdue
              </span>
            ) : undefined
          }
          trend={!isLoading && summary!.overdueCount > 0 ? 'down' : undefined}
        />
      </KPIGrid>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// REQUISITION ROW
// ─────────────────────────────────────────────────────────────────

interface RequisitionRowProps {
  requisition: ManualRequisition;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onLink: (id: string) => void;
}

function RequisitionRow({ requisition, onView, onEdit, onDelete, onLink }: RequisitionRowProps) {
  const accountabilityPercentage = requisition.amount > 0
    ? Math.round((requisition.totalAccountedAmount / requisition.amount) * 100)
    : 0;

  // Handle Firestore Timestamp
  const requisitionDate = requisition.requisitionDate instanceof Date
    ? requisition.requisitionDate
    : requisition.requisitionDate.toDate();

  return (
    <div
      className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow cursor-pointer"
      onClick={() => onView(requisition.id)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm text-gray-600">
              {requisition.referenceNumber}
            </span>
            <LinkStatusBadge status={requisition.linkStatus} />
            <AccountabilityStatusBadge status={requisition.accountabilityStatus} />
          </div>

          <h3 className="font-medium text-gray-900 truncate">
            {requisition.description}
          </h3>

          {requisition.purpose && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-1">
              {requisition.purpose}
            </p>
          )}

          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span>
              {format(requisitionDate, 'MMM d, yyyy')}
            </span>
            {requisition.linkedProjectName && (
              <span className="flex items-center text-blue-600">
                <ChevronRight className="w-3 h-3" />
                {requisition.linkedProjectName}
              </span>
            )}
            {requisition.sourceDocument && (
              <span className="flex items-center">
                <FileText className="w-3 h-3 mr-1" />
                {requisition.sourceDocument}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 ml-4">
          <div className="text-right">
            <p className="font-semibold text-gray-900">
              {formatCurrency(requisition.amount, requisition.currency)}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    accountabilityPercentage >= 100
                      ? 'bg-green-500'
                      : accountabilityPercentage > 0
                      ? 'bg-orange-500'
                      : 'bg-gray-300'
                  }`}
                  style={{ width: `${Math.min(accountabilityPercentage, 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{accountabilityPercentage}%</span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onView(requisition.id)}>
                <Eye className="w-4 h-4 mr-2" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(requisition.id)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              {requisition.linkStatus === 'unlinked' && (
                <DropdownMenuItem onClick={() => onLink(requisition.id)}>
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Link to Project
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(requisition.id)}
                className="text-red-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────

export function ManualRequisitionListPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [linkStatusFilter, setLinkStatusFilter] = useState<ManualRequisitionStatus | 'all'>('all');
  const [accountabilityFilter, setAccountabilityFilter] = useState<AccountabilityStatus | 'all'>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { requisitions, loading } = useManualRequisitions({
    linkStatus: linkStatusFilter !== 'all' ? linkStatusFilter : undefined,
    accountabilityStatus: accountabilityFilter !== 'all' ? accountabilityFilter : undefined,
  });

  const { deleteRequisition, loading: deleteLoading } = useDeleteManualRequisition();

  // Filter by search query
  const filteredRequisitions = useMemo(() => {
    if (!searchQuery) return requisitions;

    const query = searchQuery.toLowerCase();
    return requisitions.filter(
      (r: ManualRequisition) =>
        r.referenceNumber.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query) ||
        r.purpose?.toLowerCase().includes(query) ||
        r.sourceReference?.toLowerCase().includes(query)
    );
  }, [requisitions, searchQuery]);

  const handleView = (id: string) => {
    navigate(`/advisory/delivery/backlog/${id}`);
  };

  const handleEdit = (id: string) => {
    navigate(`/advisory/delivery/backlog/${id}/edit`);
  };

  const handleDelete = (id: string) => {
    setSelectedId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedId) {
      await deleteRequisition(selectedId);
      setDeleteDialogOpen(false);
      setSelectedId(null);
    }
  };

  const handleLink = (id: string) => {
    // Navigate to link dialog/page
    navigate(`/advisory/delivery/backlog/${id}/link`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Requisition Backlog</h1>
          <p className="text-gray-500 mt-1">
            Manually entered requisitions pending project linking
          </p>
        </div>
        <Button onClick={() => navigate('/advisory/delivery/backlog/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Add Requisition
        </Button>
      </div>

      {/* Summary Cards */}
      <SummaryCards />

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search requisitions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={linkStatusFilter}
          onValueChange={(v) => setLinkStatusFilter(v as ManualRequisitionStatus | 'all')}
        >
          <SelectTrigger className="w-[150px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Link Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="unlinked">Unlinked</SelectItem>
            <SelectItem value="linked">Linked</SelectItem>
            <SelectItem value="reconciled">Reconciled</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={accountabilityFilter}
          onValueChange={(v) => setAccountabilityFilter(v as AccountabilityStatus | 'all')}
        >
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Accountability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accountability</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
              <div className="h-5 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : filteredRequisitions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No requisitions found
            </h3>
            <p className="text-gray-500 mb-4">
              {searchQuery || linkStatusFilter !== 'all' || accountabilityFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Start by adding a requisition from your backlog'}
            </p>
            <Button onClick={() => navigate('/advisory/delivery/backlog/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Requisition
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRequisitions.map((requisition: ManualRequisition) => (
            <RequisitionRow
              key={requisition.id}
              requisition={requisition}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onLink={handleLink}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Requisition</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this requisition? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ManualRequisitionListPage;
