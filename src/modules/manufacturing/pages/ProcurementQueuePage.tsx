/**
 * Procurement Queue Page
 * Shows material-driven procurement requests created from the Materials Library.
 * Ops/procurement team can review, assign, and create POs from requests.
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search,
  ArrowLeft,
  ShoppingCart,
  Package,
  XCircle,
  ExternalLink,
  User,
} from 'lucide-react';
import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Input } from '@/core/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  subscribeToProcurementRequests,
  cancelRequest,
} from '../services/procurementRequestService';
import {
  PROCUREMENT_REQUEST_STATUS_LABELS,
  PROCUREMENT_URGENCY_LABELS,
} from '../types/procurementRequest';
import type {
  ProcurementRequest,
  ProcurementRequestStatus,
  ProcurementUrgency,
} from '../types/procurementRequest';
const SUBSIDIARY_ID = 'finishes';

const STATUS_STYLES: Record<ProcurementRequestStatus, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'in-progress': 'bg-blue-50 text-blue-700 border-blue-200',
  ordered: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

const URGENCY_STYLES: Record<ProcurementUrgency, string> = {
  low: 'bg-gray-100 text-gray-600 border-gray-200',
  normal: 'bg-blue-50 text-blue-600 border-blue-200',
  high: 'bg-orange-50 text-orange-600 border-orange-200',
  urgent: 'bg-red-50 text-red-600 border-red-200',
};

export default function ProcurementQueuePage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const statusFilters: ProcurementRequestStatus[] | undefined =
      statusFilter === 'active'
        ? ['pending', 'in-progress']
        : statusFilter === 'all'
          ? undefined
          : [statusFilter as ProcurementRequestStatus];

    const unsub = subscribeToProcurementRequests(
      SUBSIDIARY_ID,
      (data) => {
        setRequests(data);
        setLoading(false);
      },
      (err) => {
        console.error('Procurement queue error:', err);
        setLoading(false);
      },
      {
        status: statusFilters,
        urgency: urgencyFilter !== 'all' ? (urgencyFilter as ProcurementUrgency) : undefined,
        search: search || undefined,
      },
    );

    return unsub;
  }, [statusFilter, urgencyFilter, search]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pendingRequests = requests.filter((r) => r.status === 'pending' || r.status === 'in-progress');
    if (selectedIds.size === pendingRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingRequests.map((r) => r.id)));
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this procurement request?')) return;
    await cancelRequest(id, 'Cancelled by user');
  };

  const handleCreatePO = () => {
    // Navigate to PO creation with selected request IDs as query params
    const ids = Array.from(selectedIds).join(',');
    navigate(`/manufacturing/purchase-orders?fromRequests=${ids}`);
  };

  const formatCurrency = (amount: number, currency: string) =>
    `${currency} ${amount.toLocaleString()}`;

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const activeSelectable = requests.filter((r) => r.status === 'pending' || r.status === 'in-progress');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/manufacturing"
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Procurement Queue</h1>
            <p className="text-sm text-muted-foreground">
              Material requests from the design team — review and convert to purchase orders
            </p>
          </div>
        </div>
        {selectedIds.size > 0 && (
          <Button onClick={handleCreatePO} className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Create PO ({selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''})
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search material, code, or supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="min-w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(PROCUREMENT_REQUEST_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger className="min-w-[130px]">
                <SelectValue placeholder="Urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Urgency</SelectItem>
                {Object.entries(PROCUREMENT_URGENCY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          {requests.length} request{requests.length !== 1 ? 's' : ''}
        </span>
        {selectedIds.size > 0 && (
          <span className="text-primary font-medium">
            ({selectedIds.size} selected)
          </span>
        )}
      </div>

      {/* Loading / Empty / Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <h3 className="text-lg font-medium">No procurement requests</h3>
            <p className="text-muted-foreground mt-1">
              Requests appear here when the design team flags materials for procurement in the Materials Library.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border table-sticky-first-col">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === activeSelectable.length && activeSelectable.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-primary focus:ring-primary/20"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Material
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Urgency
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Est. Cost
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Requested By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((req) => {
                  const canSelect = req.status === 'pending' || req.status === 'in-progress';
                  return (
                    <tr key={req.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(req.id)}
                          onChange={() => toggleSelection(req.id)}
                          disabled={!canSelect}
                          className="rounded border-gray-300 text-primary focus:ring-primary/20 disabled:opacity-40"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium text-sm">{req.materialName}</span>
                          <span className="text-xs text-muted-foreground ml-2 font-mono">{req.materialCode}</span>
                        </div>
                        {req.targetProjectName && (
                          <span className="text-xs text-muted-foreground">
                            For: {req.targetProjectName}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={URGENCY_STYLES[req.urgency]}>
                          {PROCUREMENT_URGENCY_LABELS[req.urgency]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {req.quantity} {req.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                        {formatCurrency(req.estimatedUnitCost * req.quantity, req.currency)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {req.suggestedSupplier || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          {req.requestedByName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(req.requestedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={STATUS_STYLES[req.status]}>
                          {PROCUREMENT_REQUEST_STATUS_LABELS[req.status]}
                        </Badge>
                        {req.poNumber && (
                          <Link
                            to={`/manufacturing/purchase-orders/${req.poId}`}
                            className="text-xs text-primary hover:underline ml-2"
                          >
                            {req.poNumber}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {req.sourceUrl && (
                            <a
                              href={req.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted"
                              title="View source"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          {canSelect && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleCancel(req.id)}
                              title="Cancel request"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
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
