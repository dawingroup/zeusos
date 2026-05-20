/**
 * Procured Item Detail
 * Detail view for procured items with procurement-specific tabs
 */

import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, FileText, Package, ClipboardList,
  History, Trash2, DollarSign, Truck, CheckCircle
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { ResponsiveTabs } from '@/shared/components/ui/ResponsiveTabs';
import { useDesignItem, useProject } from '../../hooks';
import { StageBadge } from './StageBadge';
import { CATEGORY_LABELS, formatDateTime, STAGE_LABELS } from '../../utils/formatting';
import { getNextStageForItem, PROCUREMENT_STAGE_ORDER } from '../../utils/stage-gate';
import { StageGateCheck } from '../stage-gate/StageGateCheck';
import { 
  transitionStage, 
  deleteDesignItem,
  updateDesignItem,
} from '../../services/firestore';
import { useAuth } from '@/contexts/AuthContext';

type Tab = 'overview' | 'sourcing' | 'quotes' | 'orders' | 'files' | 'history';

export default function ProcuredItemDetail() {
  const { projectId, itemId } = useParams<{ projectId: string; itemId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { project } = useProject(projectId);
  const { item, loading } = useDesignItem(projectId, itemId);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showGateCheck, setShowGateCheck] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A7C8E]"></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Item not found</h2>
        <Link to={`/design/project/${projectId}`} className="text-[#0A7C8E] hover:underline mt-2 inline-block">
          Return to project
        </Link>
      </div>
    );
  }

  const nextStage = getNextStageForItem(item);

  const handleAdvance = async (
    _item: typeof item, 
    stage: typeof item.currentStage, 
    overrideNote?: string
  ) => {
    try {
      await transitionStage(
        projectId!,
        itemId!,
        stage,
        user?.email || '',
        overrideNote || '',
        !!overrideNote
      );
    } catch (err) {
      console.error('Failed to transition stage:', err);
    }
    setShowGateCheck(false);
  };

  const tabs = [
    { id: 'overview' as Tab, label: 'Overview', icon: FileText },
    { id: 'sourcing' as Tab, label: 'Sourcing', icon: Package },
    { id: 'quotes' as Tab, label: 'Quotes', icon: DollarSign },
    { id: 'orders' as Tab, label: 'Orders', icon: Truck },
    { id: 'files' as Tab, label: 'Files', icon: ClipboardList },
    { id: 'history' as Tab, label: 'History', icon: History },
  ];

  // Get current stage index for progress display
  const currentStageIndex = PROCUREMENT_STAGE_ORDER.indexOf(item.currentStage);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col gap-4">
        {/* Top row */}
        <div className="flex items-start gap-3">
          <Link
            to={`/design/project/${projectId}`}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{item.name}</h1>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">
                PROCURED
              </span>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 mt-1 flex-wrap">
              <span className="text-sm text-gray-600 hidden sm:inline">
                {project?.name || 'Unknown Project'}
              </span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded hidden sm:inline">
                {item.itemCode}
              </span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {CATEGORY_LABELS[item.category]}
              </span>
            </div>
          </div>

          {/* Desktop actions */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <StageBadge stage={item.currentStage} size="sm" />
            
            {nextStage && (
              <button
                onClick={() => setShowGateCheck(true)}
                className="px-3 py-2 bg-[#0A7C8E] text-white rounded-lg hover:bg-[#0A7C8E]/90 text-sm font-medium"
              >
                Advance
              </button>
            )}
            
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
              title="Delete Item"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile action bar */}
        <div className="flex sm:hidden items-center justify-between gap-2 px-1">
          <StageBadge stage={item.currentStage} size="sm" />
          
          <div className="flex items-center gap-1">
            {nextStage && (
              <button
                onClick={() => setShowGateCheck(true)}
                className="px-3 py-1.5 bg-[#0A7C8E] text-white rounded-lg text-sm font-medium"
              >
                Advance
              </button>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Procurement Progress */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Procurement Progress</h3>
        <div className="flex items-center gap-2">
          {PROCUREMENT_STAGE_ORDER.map((stage, index) => {
            const isComplete = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;
            return (
              <div key={stage} className="flex items-center flex-1">
                <div className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium',
                  isComplete && 'bg-green-500 text-white',
                  isCurrent && 'bg-[#0A7C8E] text-white',
                  !isComplete && !isCurrent && 'bg-gray-200 text-gray-500'
                )}>
                  {isComplete ? <CheckCircle className="w-4 h-4" /> : index + 1}
                </div>
                <div className="ml-2 flex-1 min-w-0">
                  <p className={cn(
                    'text-xs font-medium truncate',
                    isCurrent ? 'text-[#0A7C8E]' : 'text-gray-500'
                  )}>
                    {STAGE_LABELS[stage]}
                  </p>
                </div>
                {index < PROCUREMENT_STAGE_ORDER.length - 1 && (
                  <div className={cn(
                    'w-8 h-0.5 mx-2',
                    isComplete ? 'bg-green-500' : 'bg-gray-200'
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Procured Item?</h3>
            <p className="text-gray-600 mb-4">
              This will permanently delete <strong>{item.name}</strong>. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await deleteDesignItem(projectId!, itemId!);
                    navigate(`/design/project/${projectId}`);
                  } catch (err) {
                    console.error('Delete error:', err);
                    setDeleting(false);
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs - Responsive */}
      <ResponsiveTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as Tab)}
        variant="underline"
      />

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {activeTab === 'overview' && (
          <OverviewTab item={item} projectId={projectId!} />
        )}
        
        {activeTab === 'sourcing' && (
          <SourcingTab item={item} projectId={projectId!} />
        )}
        
        {activeTab === 'quotes' && (
          <QuotesTab item={item} projectId={projectId!} />
        )}
        
        {activeTab === 'orders' && (
          <OrdersTab item={item} projectId={projectId!} />
        )}
        
        {activeTab === 'files' && (
          <FilesTab item={item} projectId={projectId!} />
        )}
        
        {activeTab === 'history' && (
          <HistoryTab item={item} />
        )}
      </div>

      {/* Stage Gate Check Modal */}
      {showGateCheck && nextStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setShowGateCheck(false)}
          />
          <div className="relative max-w-md w-full mx-4">
            <StageGateCheck
              item={item}
              onAdvance={handleAdvance}
              onCancel={() => setShowGateCheck(false)}
              allowOverride
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Overview Tab Component
function OverviewTab({
  item,
  projectId,
}: {
  item: NonNullable<ReturnType<typeof useDesignItem>['item']>;
  projectId: string;
}) {
  const { user } = useAuth();
  const [isUpdatingDueDate, setIsUpdatingDueDate] = useState(false);

  return (
    <div className="space-y-6">
      {/* Description */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
        <p className="text-gray-900">{item.description || 'No description provided.'}</p>
      </div>
      
      {/* Key Info Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Priority</h3>
          <p className="text-lg font-semibold text-gray-900 capitalize">{item.priority || 'Not set'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Due Date</h3>
          <input
            type="date"
            value={item.dueDate ? new Date(item.dueDate.seconds * 1000).toISOString().split('T')[0] : ''}
            disabled={isUpdatingDueDate}
            onChange={async (e) => {
              const dateValue = e.target.value;
              setIsUpdatingDueDate(true);
              try {
                await updateDesignItem(
                  projectId, 
                  item.id, 
                  { 
                    dueDate: dateValue 
                      ? { seconds: new Date(dateValue).getTime() / 1000, nanoseconds: 0 } 
                      : undefined 
                  } as any, 
                  user?.email || 'system'
                );
              } catch (error) {
                console.error('Failed to update dueDate:', error);
              } finally {
                setIsUpdatingDueDate(false);
              }
            }}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Category</h3>
          <p className="text-lg font-semibold text-gray-900">{CATEGORY_LABELS[item.category]}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Current Stage</h3>
          <p className="text-lg font-semibold text-gray-900">{STAGE_LABELS[item.currentStage]}</p>
        </div>
      </div>

      {/* Timestamps */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Created</h3>
          <p className="text-sm text-gray-900">{formatDateTime(item.createdAt)}</p>
          <p className="text-xs text-gray-500">{item.createdBy}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Last Updated</h3>
          <p className="text-sm text-gray-900">{formatDateTime(item.updatedAt)}</p>
          <p className="text-xs text-gray-500">{item.updatedBy}</p>
        </div>
      </div>
    </div>
  );
}

// Sourcing Tab Component
function SourcingTab({
  item,
  projectId,
}: {
  item: NonNullable<ReturnType<typeof useDesignItem>['item']>;
  projectId: string;
}) {
  const { user } = useAuth();
  const [vendor, setVendor] = useState((item as any).vendor || '');
  const [specifications, setSpecifications] = useState((item as any).specifications || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDesignItem(projectId, item.id, {
        vendor,
        specifications,
      } as any, user?.email || 'system');
    } catch (error) {
      console.error('Failed to save sourcing info:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Vendor / Supplier</label>
        <input
          type="text"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          placeholder="Enter vendor or supplier name"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E] focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Specifications & Requirements</label>
        <textarea
          value={specifications}
          onChange={(e) => setSpecifications(e.target.value)}
          placeholder="Enter item specifications, requirements, or notes for procurement..."
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E] focus:border-transparent resize-none"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-[#0A7C8E] text-white rounded-lg hover:bg-[#0A7C8E]/90 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Sourcing Info'}
      </button>
    </div>
  );
}

// Quotes Tab Component - Procurement Pricing
function QuotesTab({
  item,
  projectId,
}: {
  item: NonNullable<ReturnType<typeof useDesignItem>['item']>;
  projectId: string;
}) {
  const { user } = useAuth();
  const procurement = (item as any).procurement || {};
  
  const [unitCost, setUnitCost] = useState<number>(procurement.unitCost || 0);
  const [quantity, setQuantity] = useState<number>(procurement.quantity || 1);
  const [currency, setCurrency] = useState<string>(procurement.currency || 'USD');
  const [vendor, setVendor] = useState<string>(procurement.vendor || '');
  const [quoteReference, setQuoteReference] = useState<string>(procurement.quoteReference || '');
  
  // Exchange rate
  const [exchangeRate, setExchangeRate] = useState<number>(procurement.exchangeRate || 1);
  const [targetCurrency, setTargetCurrency] = useState<string>(procurement.targetCurrency || 'UGX');
  
  // Logistics
  const [weight, setWeight] = useState<number>(procurement.weight || 0);
  const [logisticsCost, setLogisticsCost] = useState<number>(procurement.logisticsCost || 0);
  const [logisticsNotes, setLogisticsNotes] = useState<string>(procurement.logisticsNotes || '');
  
  // Customs
  const [customsCost, setCustomsCost] = useState<number>(procurement.customsCost || 0);
  const [hsCode, setHsCode] = useState<string>(procurement.hsCode || '');
  const [customsNotes, setCustomsNotes] = useState<string>(procurement.customsNotes || '');
  
  const [saving, setSaving] = useState(false);

  // Calculate totals in source currency
  const totalItemCost = unitCost * quantity;
  const totalLogistics = logisticsCost;
  const totalCustoms = customsCost;
  const grandTotal = totalItemCost + totalLogistics + totalCustoms;
  
  // Calculate landed cost in target currency
  const totalLandedCost = grandTotal * exchangeRate;
  const landedCostPerUnit = quantity > 0 ? totalLandedCost / quantity : 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDesignItem(projectId, item.id, {
        procurement: {
          unitCost,
          quantity,
          currency,
          vendor,
          quoteReference,
          exchangeRate,
          targetCurrency,
          weight,
          logisticsCost,
          logisticsNotes,
          customsCost,
          hsCode,
          customsNotes,
          totalItemCost,
          totalLogistics,
          totalCustoms,
          grandTotal,
          landedCostPerUnit,
          totalLandedCost,
          quotedAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
          quotedBy: user?.email || 'system',
        },
      } as any, user?.email || 'system');
    } catch (error) {
      console.error('Failed to save procurement pricing:', error);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'decimal', 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Item Cost Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-600" />
          Item Cost
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost</label>
            <input
              type="number"
              value={unitCost}
              onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E] focus:border-transparent"
            >
              <option value="USD">USD</option>
              <option value="UGX">UGX</option>
              <option value="KES">KES</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="CNY">CNY</option>
            </select>
          </div>
          <div className="flex items-end">
            <div className="w-full bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <span className="text-xs text-green-600">Subtotal</span>
              <p className="font-semibold text-green-800">{currency} {formatCurrency(totalItemCost)}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Supplier name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quote Reference</label>
            <input
              type="text"
              value={quoteReference}
              onChange={(e) => setQuoteReference(e.target.value)}
              placeholder="Quote # or reference"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Logistics Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Truck className="w-4 h-4 text-blue-600" />
          Logistics & Shipping
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
              min="0"
              step="0.1"
              placeholder="Total weight"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logistics Cost ({currency})</label>
            <input
              type="number"
              value={logisticsCost}
              onChange={(e) => setLogisticsCost(parseFloat(e.target.value) || 0)}
              min="0"
              step="0.01"
              placeholder="Shipping/freight cost"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E] focus:border-transparent"
            />
          </div>
          <div className="flex items-end">
            <div className="w-full bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <span className="text-xs text-blue-600">Logistics Total</span>
              <p className="font-semibold text-blue-800">{currency} {formatCurrency(totalLogistics)}</p>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Logistics Notes</label>
          <input
            type="text"
            value={logisticsNotes}
            onChange={(e) => setLogisticsNotes(e.target.value)}
            placeholder="Shipping method, carrier, tracking info..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E] focus:border-transparent"
          />
        </div>
      </div>

      {/* Customs Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Package className="w-4 h-4 text-orange-600" />
          Customs & Duties
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">HS Code</label>
            <input
              type="text"
              value={hsCode}
              onChange={(e) => setHsCode(e.target.value)}
              placeholder="e.g., 9403.30"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customs Cost ({currency})</label>
            <input
              type="number"
              value={customsCost}
              onChange={(e) => setCustomsCost(parseFloat(e.target.value) || 0)}
              min="0"
              step="0.01"
              placeholder="Import duties, taxes"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E] focus:border-transparent"
            />
          </div>
          <div className="flex items-end">
            <div className="w-full bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
              <span className="text-xs text-orange-600">Customs Total</span>
              <p className="font-semibold text-orange-800">{currency} {formatCurrency(totalCustoms)}</p>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Customs Notes</label>
          <input
            type="text"
            value={customsNotes}
            onChange={(e) => setCustomsNotes(e.target.value)}
            placeholder="Duty rates, exemptions, clearance info..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E] focus:border-transparent"
          />
        </div>
      </div>

      {/* Exchange Rate Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          💱 Exchange Rate
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Currency</label>
            <select
              value={targetCurrency}
              onChange={(e) => setTargetCurrency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E] focus:border-transparent"
            >
              <option value="UGX">UGX (Uganda Shilling)</option>
              <option value="KES">KES (Kenya Shilling)</option>
              <option value="USD">USD (US Dollar)</option>
              <option value="EUR">EUR (Euro)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Exchange Rate (1 {currency} = ? {targetCurrency})
            </label>
            <input
              type="number"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
              min="0.0001"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E] focus:border-transparent"
            />
          </div>
          <div className="flex items-end">
            <div className="w-full bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
              <span className="text-xs text-purple-600">Source Total</span>
              <p className="font-semibold text-purple-800">{currency} {formatCurrency(grandTotal)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Landed Cost - Grand Total */}
      <div className="bg-gradient-to-r from-[#0A7C8E] to-[#0A7C8E]/80 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Landed Cost</h3>
            <p className="text-sm text-white/80">Item + Logistics + Customs (converted)</p>
            <p className="text-xs text-white/60 mt-1">
              {currency} {formatCurrency(grandTotal)} × {exchangeRate} = {targetCurrency} {formatCurrency(totalLandedCost)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{targetCurrency} {formatCurrency(totalLandedCost)}</p>
            <p className="text-sm text-white/80 mt-1">
              {targetCurrency} {formatCurrency(landedCostPerUnit)} per unit
            </p>
            {procurement.quotedAt && (
              <p className="text-xs text-white/70 mt-1">
                Last updated: {new Date(procurement.quotedAt.seconds * 1000).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-[#0A7C8E] text-white rounded-lg hover:bg-[#0A7C8E]/90 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Save Pricing
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Orders Tab Component
function OrdersTab({
  item,
  projectId,
}: {
  item: NonNullable<ReturnType<typeof useDesignItem>['item']>;
  projectId: string;
}) {
  const { user } = useAuth();
  const [poNumber, setPoNumber] = useState((item as any).poNumber || '');
  const [orderDate, setOrderDate] = useState((item as any).orderDate || '');
  const [expectedDelivery, setExpectedDelivery] = useState((item as any).expectedDelivery || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDesignItem(projectId, item.id, {
        poNumber,
        orderDate: orderDate ? { seconds: new Date(orderDate).getTime() / 1000, nanoseconds: 0 } : undefined,
        expectedDelivery: expectedDelivery ? { seconds: new Date(expectedDelivery).getTime() / 1000, nanoseconds: 0 } : undefined,
      } as any, user?.email || 'system');
    } catch (error) {
      console.error('Failed to save order info:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PO Number</label>
          <input
            type="text"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
            placeholder="Purchase order number"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Order Date</label>
          <input
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery</label>
          <input
            type="date"
            value={expectedDelivery}
            onChange={(e) => setExpectedDelivery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7C8E] focus:border-transparent"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-[#0A7C8E] text-white rounded-lg hover:bg-[#0A7C8E]/90 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Order Info'}
      </button>
    </div>
  );
}

// Files Tab Component
function FilesTab({
  item: _item,
  projectId: _projectId,
}: {
  item: NonNullable<ReturnType<typeof useDesignItem>['item']>;
  projectId: string;
}) {
  return (
    <div className="text-center py-12">
      <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
      <h3 className="text-lg font-medium text-gray-900">Documents & Files</h3>
      <p className="text-gray-500 mt-1">Upload and manage procurement documents, specs, and invoices.</p>
      <p className="text-sm text-gray-400 mt-4">File management coming soon</p>
    </div>
  );
}

// History Tab Component
function HistoryTab({
  item,
}: {
  item: NonNullable<ReturnType<typeof useDesignItem>['item']>;
}) {
  const history = item.stageHistory || [];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Stage History</h3>
      
      {history.length === 0 ? (
        <p className="text-gray-500">No stage transitions recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {history.map((entry: any, index: number) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-[#0A7C8E] text-white rounded-full flex items-center justify-center text-xs">
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">
                    {entry.from ? `${(STAGE_LABELS as any)[entry.from]} → ` : ''}{(STAGE_LABELS as any)[entry.to]}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {formatDateTime(entry.timestamp)} by {entry.changedBy}
                </p>
                {entry.notes && (
                  <p className="text-sm text-gray-600 mt-1">{entry.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
