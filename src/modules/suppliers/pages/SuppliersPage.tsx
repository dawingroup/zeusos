/**
 * Unified Suppliers Page
 *
 * Table-based supplier library with Sheet drawer for quick preview.
 * Supports subsidiary filtering, sorting, search, and QuickBooks sync.
 *
 * Migrated from: card-grid layout
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Star,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Filter,
  Download,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Sparkles,
  ChevronRight,
  Package,
  TrendingUp,
  Globe,
  CreditCard,
  Edit2,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/core/components/ui/sheet';
import { useSuppliers, useCreateSupplier } from '../hooks/useSuppliers';
import { useSupplierOrders } from '../hooks/useSupplierOrders';
import { PO_STATUS_LABELS } from '@/modules/procurement/types/purchaseOrder';
import type { PurchaseOrderStatus } from '@/modules/procurement/types/purchaseOrder';
import { useAuth } from '@/shared/hooks';
import type { Supplier, SupplierStatus, SupplierCategory, CreateSupplierInput, SubsidiaryId } from '../types/supplier';
import { SUBSIDIARY_CONFIG } from '../types/supplier';
import { syncQBOContactsToFirestore } from '@/modules/finance/services/qboSyncService';
import { RagBadge, Banner } from '@/shared/components/data-display';

const COMPANY_ID = 'dawinos';

type TabType = 'all' | 'active' | 'inactive';

const TAB_CONFIG: Record<TabType, { label: string }> = {
  all: { label: 'All Suppliers' },
  active: { label: 'Active' },
  inactive: { label: 'Inactive' },
};

type SupplierTone = 'green' | 'amber' | 'red' | 'blue' | 'na';

const STATUS_CONFIG: Record<SupplierStatus, { label: string; tone: SupplierTone; icon: React.ElementType }> = {
  active: { label: 'Active', tone: 'green', icon: CheckCircle },
  inactive: { label: 'Inactive', tone: 'na', icon: XCircle },
  pending_approval: { label: 'Pending', tone: 'amber', icon: Clock },
  blacklisted: { label: 'Blacklisted', tone: 'red', icon: AlertTriangle },
};

const DRAWER_PO_STATUS_TONE_MAP: Record<PurchaseOrderStatus, SupplierTone> = {
  draft: 'na',
  'pending-approval': 'amber',
  approved: 'blue',
  rejected: 'red',
  sent: 'blue',
  'partially-received': 'amber',
  received: 'green',
  closed: 'na',
  cancelled: 'red',
};

// ============================================================================
// SORT CONFIG
// ============================================================================

type SortField = 'name' | 'code' | 'rating' | 'totalOrders' | 'onTimeDeliveryRate' | 'status';
type SortDir = 'asc' | 'desc';

function sortSuppliers(suppliers: Supplier[], field: SortField, dir: SortDir): Supplier[] {
  return [...suppliers].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'name':
        cmp = (a.name || a.code || '').localeCompare(b.name || b.code || '');
        break;
      case 'code':
        cmp = (a.code || '').localeCompare(b.code || '');
        break;
      case 'rating':
        cmp = (a.rating || 0) - (b.rating || 0);
        break;
      case 'totalOrders':
        cmp = (a.totalOrders || 0) - (b.totalOrders || 0);
        break;
      case 'onTimeDeliveryRate':
        cmp = (a.onTimeDeliveryRate || 0) - (b.onTimeDeliveryRate || 0);
        break;
      case 'status':
        cmp = a.status.localeCompare(b.status);
        break;
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

// ============================================================================
// SUPPLIER DRAWER
// ============================================================================

interface SupplierDrawerProps {
  supplier: Supplier | null;
  open: boolean;
  onClose: () => void;
  onViewDetail: (id: string) => void;
  onEditSupplier?: (id: string) => void;
}


function SupplierDrawer({ supplier, open, onClose, onViewDetail, onEditSupplier }: SupplierDrawerProps) {
  const { orders, stats: orderStats } = useSupplierOrders(open && supplier ? supplier.id : null);

  if (!supplier) return null;

  const statusConfig = STATUS_CONFIG[supplier.status] || STATUS_CONFIG.active;
  const StatusIcon = statusConfig.icon;
  const formatCurrency = (amount: number, currency: string = 'UGX') =>
    `${currency} ${amount.toLocaleString()}`;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-lg">{supplier.name || supplier.code}</SheetTitle>
            {supplier.rating && supplier.rating >= 4 && (
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            )}
          </div>
          <SheetDescription className="flex items-center gap-2 flex-wrap">
            <RagBadge tone={statusConfig.tone}>
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </RagBadge>
            <span className="text-[11px] font-mono" style={{ color: 'var(--fg-tertiary)' }}>
              {supplier.code}
            </span>
            {supplier.categories?.length > 0 && (
              <span className="text-[11.5px] capitalize" style={{ color: 'var(--fg-secondary)' }}>
                {supplier.categories[0]}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 pt-5">
          {/* Performance Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-blue-600 mb-1">
                <Package className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium uppercase">Orders</span>
              </div>
              <div className="text-xl font-bold text-gray-900">{supplier.totalOrders || 0}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-green-600 mb-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium uppercase">On-Time</span>
              </div>
              <div className="text-xl font-bold text-gray-900">
                {supplier.onTimeDeliveryRate ? `${Math.round(supplier.onTimeDeliveryRate * 100)}%` : 'N/A'}
              </div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-amber-600 mb-1">
                <Star className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium uppercase">Rating</span>
              </div>
              <div className="text-xl font-bold text-gray-900">{supplier.rating?.toFixed(1) || 'N/A'}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-purple-600 mb-1">
                <CreditCard className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium uppercase">Value</span>
              </div>
              <div className="text-sm font-bold text-gray-900">
                {supplier.totalValue?.amount
                  ? formatCurrency(supplier.totalValue.amount, supplier.totalValue.currency)
                  : 'N/A'}
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Contact</h4>
            <div className="space-y-2 text-sm">
              {supplier.contactPerson && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  {supplier.contactPerson}
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-700">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                {supplier.phone}
              </div>
              {supplier.email && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  {supplier.email}
                </div>
              )}
              {supplier.website && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Globe className="w-3.5 h-3.5 text-gray-400" />
                  <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs truncate">
                    {supplier.website}
                  </a>
                </div>
              )}
              {supplier.address?.city && (
                <div className="flex items-center gap-2 text-gray-700">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  {[supplier.address.city, supplier.address.region, supplier.address.country].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Financial Quick View */}
          {(supplier.paymentTerms || supplier.bankDetails) && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Financial</h4>
              <div className="space-y-1 text-sm">
                {supplier.paymentTerms && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Payment Terms</span>
                    <span className="font-medium">{supplier.paymentTerms}</span>
                  </div>
                )}
                {supplier.bankDetails?.bankName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Bank</span>
                    <span className="font-medium">{supplier.bankDetails.bankName}</span>
                  </div>
                )}
                {supplier.taxId && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tax ID</span>
                    <span className="font-medium">{supplier.taxId}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Intelligence Status */}
          {supplier.aiIntelligence?.lastAnalyzedAt && (
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-xs font-medium text-purple-700">AI Intelligence Available</span>
              </div>
              <div className="text-[10px] text-purple-500">
                Last analyzed: {new Date(supplier.aiIntelligence.lastAnalyzedAt).toLocaleDateString()}
              </div>
              <div className="flex gap-2 mt-1 flex-wrap">
                {(supplier.aiIntelligence.riskAlerts?.length ?? 0) > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded">
                    {supplier.aiIntelligence.riskAlerts!.length} risks
                  </span>
                )}
                {(supplier.aiIntelligence.recommendations?.length ?? 0) > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">
                    {supplier.aiIntelligence.recommendations!.length} recommendations
                  </span>
                )}
                {supplier.aiIntelligence.enrichment?.certifications?.length && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded">
                    {supplier.aiIntelligence.enrichment.certifications.length} certifications
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Subsidiary Tags */}
          {supplier.subsidiaries && supplier.subsidiaries.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Subsidiaries</h4>
              <div className="flex flex-wrap gap-1.5">
                {supplier.subsidiaries.map((s) => (
                  <span key={s} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                    {SUBSIDIARY_CONFIG[s]?.label || s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent Orders */}
          {orderStats.totalOrders > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                Recent Orders ({orderStats.totalOrders})
              </h4>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-blue-50 rounded-lg px-3 py-2">
                  <div className="text-xs text-blue-600 font-medium">{orderStats.openOrders} open</div>
                </div>
                <div className="bg-green-50 rounded-lg px-3 py-2">
                  <div className="text-xs text-green-600 font-medium">
                    {orderStats.currency} {orderStats.totalValue.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-green-500">total spend</div>
                </div>
              </div>
              <div className="space-y-1.5">
                {orders.slice(0, 3).map((po) => {
                  const rawDate = po.createdAt;
                  const poDate = rawDate && typeof rawDate === 'object' && 'toDate' in rawDate
                    ? (rawDate as any).toDate()
                    : typeof rawDate === 'string' || typeof rawDate === 'number'
                      ? new Date(rawDate)
                      : null;

                  return (
                    <div key={po.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div>
                        <div className="text-xs font-medium text-gray-900">{po.poNumber}</div>
                        <div className="text-[10px] text-gray-400">
                          {poDate && !isNaN(poDate.getTime())
                            ? poDate.toLocaleDateString()
                            : '-'}
                        </div>
                      </div>
                      <div className="text-right">
                        <RagBadge tone={DRAWER_PO_STATUS_TONE_MAP[po.status] ?? 'na'}>
                          {PO_STATUS_LABELS[po.status] || po.status}
                        </RagBadge>
                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--fg-tertiary)' }}>
                          {(po.totals?.grandTotal || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-gray-100 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (onEditSupplier) {
                    onEditSupplier(supplier.id);
                  } else {
                    onViewDetail(supplier.id);
                  }
                  onClose();
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Supplier
              </button>
              <button
                onClick={() => {
                  onViewDetail(supplier.id);
                  onClose();
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                View Full Profile
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================================
// NEW SUPPLIER MODAL
// ============================================================================

interface NewSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateSupplierInput) => Promise<void>;
  loading: boolean;
  defaultSubsidiary?: SubsidiaryId;
}

function NewSupplierModal({ isOpen, onClose, onSubmit, loading, defaultSubsidiary }: NewSupplierModalProps) {
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('materials');
  const [city, setCity] = useState('');
  const [subsidiaries, setSubsidiaries] = useState<SubsidiaryId[]>(
    defaultSubsidiary ? [defaultSubsidiary] : ['all']
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = `SUP-${Date.now().toString(36).toUpperCase()}`;
    await onSubmit({
      code,
      name,
      contactPerson,
      email,
      phone,
      category: category as SupplierCategory,
      address: {
        line1: '',
        city,
        country: 'Uganda',
      },
      categories: [category],
      subsidiaries,
      createdBy: '',
    });
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setCategory('materials');
    setCity('');
    setSubsidiaries(defaultSubsidiary ? [defaultSubsidiary] : ['all']);
    onClose();
  };

  const toggleSubsidiary = (sub: SubsidiaryId) => {
    if (sub === 'all') {
      setSubsidiaries(['all']);
    } else {
      const newSubs = subsidiaries.filter(s => s !== 'all');
      if (newSubs.includes(sub)) {
        const filtered = newSubs.filter(s => s !== sub);
        setSubsidiaries(filtered.length === 0 ? ['all'] : filtered);
      } else {
        setSubsidiaries([...newSubs, sub]);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Add New Supplier</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Enter company name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Primary contact name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="materials">Materials</option>
              <option value="equipment">Equipment</option>
              <option value="services">Services</option>
              <option value="subcontractor">Subcontractor</option>
              <option value="contractor">Contractor</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="+256..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="email@example.com (optional)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="e.g., Kampala"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Available To</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SUBSIDIARY_CONFIG) as SubsidiaryId[]).map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => toggleSubsidiary(sub)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    subsidiaries.includes(sub)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary'
                  }`}
                >
                  {SUBSIDIARY_CONFIG[sub].label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !phone}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Adding...' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// SORTABLE HEADER
// ============================================================================

function SortableHeader({
  label,
  field,
  currentField,
  currentDir,
  onSort,
  className = '',
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const isActive = currentField === field;
  return (
    <th
      className={`px-3 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-wider cursor-pointer select-none ${className}`}
      style={{ color: isActive ? 'var(--fg-primary)' : 'var(--fg-tertiary)' }}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          currentDir === 'asc' ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </div>
    </th>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

interface SuppliersPageProps {
  subsidiaryId?: SubsidiaryId;
  title?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

const SuppliersPage: React.FC<SuppliersPageProps> = ({
  subsidiaryId,
  title = 'Suppliers',
  breadcrumbs,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [subsidiaryFilter, setSubsidiaryFilter] = useState<SubsidiaryId | undefined>(subsidiaryId);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  // Drawer state
  const [drawerSupplier, setDrawerSupplier] = useState<Supplier | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Sort state
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const { suppliers, loading, error, refresh } = useSuppliers({
    subsidiaryId: subsidiaryFilter,
  });
  const { createSupplier, creating } = useCreateSupplier();

  // Filter suppliers
  const filteredSuppliers = useMemo(() => {
    let result = suppliers;

    switch (activeTab) {
      case 'active':
        result = result.filter((s) => s.status === 'active');
        break;
      case 'inactive':
        result = result.filter((s) => s.status === 'inactive' || s.status === 'blacklisted');
        break;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name?.toLowerCase().includes(query) ||
          s.code?.toLowerCase().includes(query) ||
          s.phone?.includes(query) ||
          s.email?.toLowerCase().includes(query) ||
          s.contactPerson?.toLowerCase().includes(query)
      );
    }

    return sortSuppliers(result, sortField, sortDir);
  }, [suppliers, activeTab, searchQuery, sortField, sortDir]);

  // Stats
  const stats = useMemo(
    () => ({
      total: suppliers.length,
      active: suppliers.filter((s) => s.status === 'active').length,
      avgRating:
        suppliers.length > 0
          ? (suppliers.reduce((sum, s) => sum + (s.rating || 0), 0) / suppliers.length).toFixed(1)
          : '0',
    }),
    [suppliers]
  );

  const handleCreateSupplier = async (data: CreateSupplierInput) => {
    await createSupplier({
      ...data,
      createdBy: user?.uid || 'unknown',
    });
    refresh();
  };

  const handleSyncFromQuickBooks = async () => {
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const result = await syncQBOContactsToFirestore(COMPANY_ID, ['vendors']);

      if (!result.success) {
        const errorMsg = result.errors ? Object.values(result.errors).join(', ') : 'Sync failed';
        throw new Error(errorMsg);
      }

      const syncStats = result.results.vendors;
      setSyncResult({
        success: true,
        message: `Imported ${syncStats?.created ?? 0} new, updated ${syncStats?.updated ?? 0} existing, skipped ${syncStats?.skipped ?? 0} (${syncStats?.total ?? 0} total in QuickBooks)`,
      });
      refresh();
    } catch (err) {
      setSyncResult({
        success: false,
        message: err instanceof Error ? err.message : 'Sync failed',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const openDrawer = (supplier: Supplier) => {
    setDrawerSupplier(supplier);
    setDrawerOpen(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-4">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span>/</span>}
                {crumb.href ? (
                  <a href={crumb.href} className="hover:text-primary">
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-gray-900">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500">Manage suppliers and track performance</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncFromQuickBooks}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {isSyncing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isSyncing ? 'Syncing...' : 'Import from QuickBooks'}
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Supplier
            </button>
          </div>
        </div>
      </div>

      {/* Sync Result Banner */}
      {syncResult && (
        <div className={`mx-0 mt-4 p-3 rounded-lg ${syncResult.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {syncResult.message}
          <button onClick={() => setSyncResult(null)} className="ml-2 underline text-sm">Dismiss</button>
        </div>
      )}

      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Total Suppliers</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Active</div>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Avg. Rating</div>
            <div className="flex items-center gap-1 text-2xl font-bold text-amber-600">
              <Star className="w-5 h-5 fill-amber-500" />
              {stats.avgRating}
            </div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="border-b sm:border-b-0 flex-1">
            <div className="flex gap-1">
              {(Object.keys(TAB_CONFIG) as TabType[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === tab
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {TAB_CONFIG[tab].label}
                </button>
              ))}
            </div>
          </div>

          {!subsidiaryId && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={subsidiaryFilter || ''}
                onChange={(e) => setSubsidiaryFilter((e.target.value as SubsidiaryId) || undefined)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Subsidiaries</option>
                <option value="finishes">Finishes</option>
                <option value="advisory">Advisory</option>
                <option value="matflow">Matflow</option>
              </select>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search suppliers by name, code, contact, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Banner tone="danger" title="Error loading suppliers" message={error} />
        ) : filteredSuppliers.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No suppliers found</h3>
            <p className="text-gray-500 mb-4">
              {suppliers.length === 0
                ? 'Add your first supplier to start tracking.'
                : 'No suppliers match your current filters.'}
            </p>
            <button
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Supplier
            </button>
          </div>
        ) : (
          /* Supplier Table — DataTable-style chrome */
          <div
            className="overflow-x-auto rounded-[10px] border shadow-[var(--shadow-sm)]"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
              <table className="min-w-full border-collapse">
                <thead>
                  <tr
                    className="border-b"
                    style={{
                      backgroundColor: 'var(--bg-sunken)',
                      borderColor: 'var(--border-default)',
                    }}
                  >
                    <SortableHeader label="Supplier" field="name" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="min-w-[200px]" />
                    <SortableHeader label="Code" field="code" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                    <th className="px-3 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-wider" style={{ color: 'var(--fg-tertiary)' }}>Category</th>
                    <SortableHeader label="Status" field="status" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                    <th className="px-3 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-wider" style={{ color: 'var(--fg-tertiary)' }}>Phone</th>
                    <th className="px-3 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-wider" style={{ color: 'var(--fg-tertiary)' }}>City</th>
                    <SortableHeader label="Orders" field="totalOrders" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="On-Time" field="onTimeDeliveryRate" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Rating" field="rating" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                    <th className="px-3 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-wider" style={{ color: 'var(--fg-tertiary)' }}>AI</th>
                    <th className="px-3 py-2.5 text-right w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((supplier) => {
                    const statusConfig = STATUS_CONFIG[supplier.status] || STATUS_CONFIG.active;
                    const StatusIcon = statusConfig.icon;

                    return (
                      <tr
                        key={supplier.id}
                        onClick={() => openDrawer(supplier)}
                        className="border-b transition-colors cursor-pointer"
                        style={{ borderColor: 'var(--border-subtle)' }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = 'var(--bg-sunken)')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = 'transparent')
                        }
                      >
                        {/* Name */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium truncate max-w-[180px]" style={{ color: 'var(--fg-primary)' }}>
                              {supplier.name || supplier.code}
                            </span>
                            {supplier.rating && supplier.rating >= 4 && (
                              <Star className="w-3 h-3 fill-current shrink-0" style={{ color: 'var(--rag-amber)' }} />
                            )}
                          </div>
                          {supplier.contactPerson && (
                            <div className="text-[11px] truncate max-w-[180px]" style={{ color: 'var(--fg-tertiary)' }}>{supplier.contactPerson}</div>
                          )}
                        </td>

                        {/* Code */}
                        <td className="px-3 py-2 text-[12px] font-mono" style={{ color: 'var(--fg-tertiary)' }}>{supplier.code}</td>

                        {/* Category */}
                        <td className="px-3 py-2">
                          {supplier.categories?.length > 0 && (
                            <span className="text-[12px] capitalize" style={{ color: 'var(--fg-secondary)' }}>{supplier.categories[0]}</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2">
                          <RagBadge tone={statusConfig.tone}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </RagBadge>
                        </td>

                        {/* Phone */}
                        <td className="px-3 py-2 text-[12px]" style={{ color: 'var(--fg-secondary)' }}>{supplier.phone}</td>

                        {/* City */}
                        <td className="px-3 py-2 text-[12px]" style={{ color: 'var(--fg-secondary)' }}>{supplier.address?.city || '—'}</td>

                        {/* Orders */}
                        <td className="px-3 py-2 text-[13px] font-medium text-center tabular-nums" style={{ color: 'var(--fg-primary)' }}>{supplier.totalOrders || 0}</td>

                        {/* On-Time */}
                        <td className="px-3 py-2 text-center">
                          <span
                            className="text-[12px] font-medium tabular-nums"
                            style={{
                              color:
                                supplier.onTimeDeliveryRate && supplier.onTimeDeliveryRate >= 0.9
                                  ? 'var(--rag-green)'
                                  : supplier.onTimeDeliveryRate && supplier.onTimeDeliveryRate >= 0.7
                                  ? 'var(--rag-amber)'
                                  : 'var(--fg-tertiary)',
                            }}
                          >
                            {supplier.onTimeDeliveryRate ? `${Math.round(supplier.onTimeDeliveryRate * 100)}%` : '—'}
                          </span>
                        </td>

                        {/* Rating */}
                        <td className="px-3 py-2 text-center">
                          {supplier.rating ? (
                            <div className="flex items-center justify-center gap-0.5">
                              <Star className="w-3 h-3 fill-current" style={{ color: 'var(--rag-amber)' }} />
                              <span className="text-[12px] font-medium tabular-nums" style={{ color: 'var(--fg-primary)' }}>{supplier.rating.toFixed(1)}</span>
                            </div>
                          ) : (
                            <span className="text-[12px]" style={{ color: 'var(--fg-tertiary)' }}>—</span>
                          )}
                        </td>

                        {/* AI Status */}
                        <td className="px-3 py-2 text-center">
                          {supplier.aiIntelligence?.lastAnalyzedAt ? (
                            <Sparkles className="w-3.5 h-3.5 mx-auto" style={{ color: 'var(--accent)' }} />
                          ) : (
                            <span className="text-[12px]" style={{ color: 'var(--fg-quaternary)' }}>—</span>
                          )}
                        </td>

                        {/* Arrow */}
                        <td className="px-3 py-2 text-right">
                          <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--fg-quaternary)' }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

            {/* Table Footer */}
            <div
              className="px-4 py-2.5 border-t text-[11.5px]"
              style={{
                backgroundColor: 'var(--bg-sunken)',
                borderColor: 'var(--border-default)',
                color: 'var(--fg-tertiary)',
              }}
            >
              {filteredSuppliers.length} supplier{filteredSuppliers.length !== 1 ? 's' : ''} shown
              {filteredSuppliers.length < suppliers.length && ` (${suppliers.length} total)`}
            </div>
          </div>
        )}
      </div>

      {/* Supplier Drawer */}
      <SupplierDrawer
        supplier={drawerSupplier}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onViewDetail={(id) => navigate(`/suppliers/${id}`)}
        onEditSupplier={(id) => navigate(`/suppliers/${id}?edit=true`)}
      />

      <NewSupplierModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onSubmit={handleCreateSupplier}
        loading={creating}
        defaultSubsidiary={subsidiaryId}
      />
    </div>
  );
};

export default SuppliersPage;
