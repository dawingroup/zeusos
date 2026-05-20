/**
 * Procurement Page
 * Full procurement management with deliveries, purchase orders, and supplier tracking
 */

import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Package,
  Plus,
  Search,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Building2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { useProjectProcurement, useProcurementMutations } from '../hooks/procurement-hooks';
import { useMatFlowProjects } from '../hooks/useMatFlow';
import { useAuth } from '@/shared/hooks';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import type { ProcurementEntry, ProcurementStatus, ProcurementType } from '../types/procurement';

type TabType = 'all' | 'deliveries' | 'pending' | 'confirmed';

const TAB_CONFIG: Record<TabType, { label: string; icon: React.ElementType }> = {
  all: { label: 'All Entries', icon: Package },
  deliveries: { label: 'Deliveries', icon: Truck },
  pending: { label: 'Pending', icon: Clock },
  confirmed: { label: 'Confirmed', icon: CheckCircle },
};

const STATUS_CONFIG: Record<ProcurementStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700', icon: XCircle },
  disputed: { label: 'Disputed', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
};

const TYPE_LABELS: Record<ProcurementType, string> = {
  delivery: 'Delivery',
  purchase_order: 'Purchase Order',
  stock_adjustment: 'Stock Adjustment',
  return: 'Return',
  transfer: 'Transfer',
};

function formatDate(date: Date | { toDate: () => Date } | undefined): string {
  if (!date) return '-';
  const d = 'toDate' in date ? date.toDate() : date;
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatCurrency(amount: number): string {
  return `UGX ${amount.toLocaleString()}`;
}

interface ProcurementCardProps {
  entry: ProcurementEntry;
  onConfirm: (id: string) => void;
  confirming: boolean;
}

function ProcurementCard({ entry, onConfirm, confirming }: ProcurementCardProps) {
  const statusConfig = STATUS_CONFIG[entry.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900">{entry.materialName}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${statusConfig.color}`}>
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </span>
          </div>
          <div className="text-sm text-gray-500">
            {entry.referenceNumber} • {TYPE_LABELS[entry.type]}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold text-gray-900">{formatCurrency(entry.totalAmount)}</div>
          <div className="text-xs text-gray-500">{entry.quantityAccepted} {entry.unit}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
        <div>
          <span className="text-gray-500">Supplier:</span>
          <span className="ml-2 text-gray-900">{entry.supplierName}</span>
        </div>
        <div>
          <span className="text-gray-500">Delivered:</span>
          <span className="ml-2 text-gray-900">{formatDate(entry.deliveryDate)}</span>
        </div>
      </div>

      {entry.deliveryCondition && entry.deliveryCondition !== 'good' && (
        <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
          <AlertTriangle className="w-4 h-4 inline mr-1" />
          Condition: {entry.deliveryCondition}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Building2 className="w-4 h-4" />
          Received by: {entry.receivedByName}
        </div>
        {entry.status === 'pending' && (
          <button
            onClick={() => onConfirm(entry.id)}
            disabled={confirming}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {confirming ? 'Confirming...' : 'Confirm'}
          </button>
        )}
      </div>
    </div>
  );
}

const ProcurementPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || undefined;
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [_showNewDeliveryModal, setShowNewDeliveryModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(projectId);
  const { projects } = useMatFlowProjects();
  const { entries, loading, error, refetch } = useProjectProcurement(selectedProjectId);
  const { confirmEntry, loading: mutating } = useProcurementMutations();

  // Filter entries based on tab and search
  const filteredEntries = useMemo(() => {
    let result = entries;

    // Tab filter
    switch (activeTab) {
      case 'deliveries':
        result = result.filter(e => e.type === 'delivery');
        break;
      case 'pending':
        result = result.filter(e => e.status === 'pending');
        break;
      case 'confirmed':
        result = result.filter(e => e.status === 'confirmed');
        break;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.materialName.toLowerCase().includes(query) ||
        e.supplierName.toLowerCase().includes(query) ||
        e.referenceNumber.toLowerCase().includes(query)
      );
    }

    return result;
  }, [entries, activeTab, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    total: entries.length,
    pending: entries.filter(e => e.status === 'pending').length,
    confirmed: entries.filter(e => e.status === 'confirmed').length,
    totalValue: entries.reduce((sum, e) => sum + e.totalAmount, 0),
  }), [entries]);

  const handleConfirm = async (entryId: string) => {
    if (!user) return;
    try {
      await confirmEntry(entryId, user.uid);
      refetch();
    } catch (err) {
      console.error('Failed to confirm entry:', err);
    }
  };

  return (
    <div>
      <PageHeader
        title="Procurement"
        description="Track material deliveries and purchases"
        breadcrumbs={[
          { label: 'MatFlow', href: '/advisory/matflow' },
          { label: 'Procurement' },
        ]}
        actions={
          <button
            onClick={() => setShowNewDeliveryModal(true)}
            className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Log Delivery
          </button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Project Selector */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Project:</label>
          <select
            value={selectedProjectId || ''}
            onChange={(e) => setSelectedProjectId(e.target.value || undefined)}
            className="px-3 py-2 border rounded-lg bg-white min-w-[250px]"
          >
            <option value="">Select a project</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {selectedProjectId ? (
          <>
            {/* Stats */}
            <KPIGrid cols={4}>
              <KPICard label="Total Entries" value={stats.total} />
              <KPICard label="Pending" value={stats.pending} />
              <KPICard label="Confirmed" value={stats.confirmed} trend="up" />
              <KPICard label="Total Value" value={formatCurrency(stats.totalValue)} />
            </KPIGrid>

            {/* Tabs */}
            <div className="border-b">
              <div className="flex gap-1">
                {(Object.keys(TAB_CONFIG) as TabType[]).map(tab => {
                  const config = TAB_CONFIG[tab];
                  const Icon = config.icon;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        activeTab === tab
                          ? 'border-amber-600 text-amber-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by material, supplier, or reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                {error.message}
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="bg-white rounded-lg border p-12 text-center">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No procurement entries</h3>
                <p className="text-gray-500 mb-4">
                  {entries.length === 0
                    ? 'Log your first material delivery to start tracking.'
                    : 'No entries match your current filters.'}
                </p>
                <button
                  onClick={() => setShowNewDeliveryModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                >
                  <Plus className="w-4 h-4" />
                  Log Delivery
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredEntries.map(entry => (
                  <ProcurementCard
                    key={entry.id}
                    entry={entry}
                    onConfirm={handleConfirm}
                    confirming={mutating}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-lg border p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Project</h3>
            <p className="text-gray-500">Choose a project to view its procurement entries.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProcurementPage;
