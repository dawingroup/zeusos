/**
 * Asset Detail Drawer
 * Slide-out drawer showing full asset details with tabbed layout:
 * Overview, Maintenance, Activity, Features, Intelligence.
 */

import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/core/components/ui/sheet';
import {
  Edit2,
  MapPin,
  Tag,
  Wrench,
  Activity,
  Cpu,
  Sparkles,
  ExternalLink,
  FileText,
  Clock,
  Hash,
  Loader2,
  AlertTriangle,
  DollarSign,
  Package,
} from 'lucide-react';
import { useAssetDetail } from '../hooks/useAssetDetail';
import { useAuth } from '@/shared/hooks';
import { AssetService } from '../services/AssetService';
import { calculateDepreciationSummary } from '../services/depreciationService';
import { MaintenanceTimeline } from './MaintenanceTimeline';
import { StatusChangeLog } from './StatusChangeLog';
import { CheckoutHistory } from './CheckoutHistory';
import { LinkedFeatures } from './LinkedFeatures';
import { AssetIntelligencePanel } from './AssetIntelligencePanel';
import { ConsumablesTab } from './ConsumablesTab';
import { MaintenanceLogModal } from './MaintenanceLogModal';
import type { AssetStatus, AssetCategory } from '@/shared/types';
import type { MaintenanceLog } from '../types';

const assetService = new AssetService();

const STATUS_CONFIG: Record<AssetStatus, { label: string; bg: string; text: string }> = {
  ACTIVE: { label: 'Active', bg: 'bg-green-100', text: 'text-green-700' },
  MAINTENANCE: { label: 'Maintenance', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  BROKEN: { label: 'Broken', bg: 'bg-red-100', text: 'text-red-700' },
  CHECKED_OUT: { label: 'Checked Out', bg: 'bg-blue-100', text: 'text-blue-700' },
  RETIRED: { label: 'Retired', bg: 'bg-gray-100', text: 'text-gray-700' },
};

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  STATIONARY_MACHINE: 'Stationary Machine',
  POWER_TOOL: 'Power Tool',
  HAND_TOOL: 'Hand Tool',
  JIG: 'Jig / Fixture',
  CNC: 'CNC Machine',
  DUST_COLLECTION: 'Dust Collection',
  SPRAY_EQUIPMENT: 'Spray Equipment',
  SEWING_MACHINE: 'Sewing Machine',
};

function SectionCard({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-500" />
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        </div>
        {action}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {Icon && <Icon className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <div className="text-[11px] text-gray-500">{label}</div>
        <div className="text-sm text-gray-900 break-words">
          {value || <span className="text-gray-400 italic">Not provided</span>}
        </div>
      </div>
    </div>
  );
}

function formatDate(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString();
  }
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === 'string') return new Date(value).toLocaleDateString();
  return 'Unknown';
}

type TabId = 'overview' | 'maintenance' | 'activity' | 'features' | 'parts' | 'intelligence';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Tag },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'features', label: 'Features', icon: Cpu },
  { id: 'parts', label: 'Parts', icon: Package },
  { id: 'intelligence', label: 'Intelligence', icon: Sparkles },
];

interface AssetDetailDrawerProps {
  assetId: string | null;
  open: boolean;
  onClose: () => void;
}

export function AssetDetailDrawer({ assetId, open, onClose }: AssetDetailDrawerProps) {
  const { user } = useAuth();
  const {
    asset,
    maintenanceLogs,
    statusChanges,
    checkouts,
    features,
    isLoading,
    error,
    refresh,
  } = useAssetDetail(assetId || undefined);

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const handleStatusChange = async (newStatus: AssetStatus) => {
    if (!asset || !user?.uid || newStatus === asset.status) return;
    setStatusUpdating(true);
    try {
      await assetService.updateStatus(asset.id, newStatus, user.uid);
      refresh();
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setStatusUpdating(false);
      setIsEditingStatus(false);
    }
  };

  // Reset tab when drawer opens with a new asset
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      setActiveTab('overview');
      setIsEditingStatus(false);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      );
    }

    if (error || !asset) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <AlertTriangle className="w-8 h-8 mb-3 text-amber-500" />
          <p className="font-medium text-sm">{error || 'Asset not found'}</p>
        </div>
      );
    }

    const statusConfig = STATUS_CONFIG[asset.status] || STATUS_CONFIG.ACTIVE;

    const nextServiceDate = asset.maintenance.nextServiceDue
      ? new Date(
          typeof asset.maintenance.nextServiceDue === 'string'
            ? asset.maintenance.nextServiceDue
            : (asset.maintenance.nextServiceDue as Date)
        )
      : null;
    const isServiceOverdue = nextServiceDate ? nextServiceDate <= new Date() : false;

    const totalMaintenanceCost = maintenanceLogs.reduce(
      (sum, log) => sum + (log.cost || 0),
      0
    );

    return (
      <>
        {/* Header Info */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            {/* Status badge */}
            <div className="relative">
              <button
                onClick={() => setIsEditingStatus(!isEditingStatus)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text} hover:opacity-80`}
              >
                {statusUpdating && <Loader2 className="w-3 h-3 animate-spin" />}
                {statusConfig.label}
              </button>

              {isEditingStatus && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
                  {(Object.entries(STATUS_CONFIG) as [AssetStatus, typeof statusConfig][]).map(
                    ([status, config]) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${
                          status === asset.status ? 'font-medium' : ''
                        }`}
                      >
                        <span className={`inline-block w-2 h-2 rounded-full ${config.bg} mr-2`} />
                        {config.label}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Category badge */}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {CATEGORY_LABELS[asset.category] || asset.category}
            </span>
          </div>

          {/* Quick stats */}
          <div className={`grid ${asset.financials ? 'grid-cols-5' : 'grid-cols-4'} gap-3 mt-3`}>
            <div className="text-center bg-gray-50 rounded-lg py-2">
              <div className="text-base font-bold text-gray-900">{maintenanceLogs.length}</div>
              <div className="text-[10px] text-gray-500">Services</div>
            </div>
            <div className="text-center bg-gray-50 rounded-lg py-2">
              <div className="text-base font-bold text-gray-900">{checkouts.length}</div>
              <div className="text-[10px] text-gray-500">Checkouts</div>
            </div>
            <div className="text-center bg-gray-50 rounded-lg py-2">
              <div className="text-base font-bold text-gray-900">{features.length}</div>
              <div className="text-[10px] text-gray-500">Features</div>
            </div>
            <div className="text-center bg-gray-50 rounded-lg py-2">
              <div className="text-base font-bold text-gray-900">
                {totalMaintenanceCost > 0 ? `${(totalMaintenanceCost / 1000).toFixed(0)}K` : '0'}
              </div>
              <div className="text-[10px] text-gray-500">Cost (UGX)</div>
            </div>
            {asset.financials && (() => {
              const depSummary = calculateDepreciationSummary(asset.financials);
              return (
                <div className="text-center bg-teal-50 rounded-lg py-2">
                  <div className="text-base font-bold text-teal-700">
                    {depSummary.currentBookValue > 1000000
                      ? `${(depSummary.currentBookValue / 1000000).toFixed(1)}M`
                      : depSummary.currentBookValue > 1000
                      ? `${(depSummary.currentBookValue / 1000).toFixed(0)}K`
                      : depSummary.currentBookValue.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-teal-600">Book Value</div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Tab Bar */}
        <div className="border-b border-gray-200 mb-4 -mx-6 px-6">
          <div className="flex gap-0.5 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {/* Overview */}
          {activeTab === 'overview' && (
            <>
              <SectionCard title="Asset Information" icon={Tag}>
                <div className="grid grid-cols-2 gap-x-4">
                  <DetailRow label="Brand" value={asset.brand} />
                  <DetailRow label="Model" value={asset.model} />
                  <DetailRow label="Serial Number" value={asset.serialNumber} icon={Hash} />
                  <DetailRow label="Nickname" value={asset.nickname} />
                  <DetailRow label="Category" value={CATEGORY_LABELS[asset.category]} icon={Tag} />
                  <DetailRow label="Zone" value={asset.location.zone} icon={MapPin} />
                </div>
              </SectionCard>

              {asset.financials && (() => {
                const depSummary = calculateDepreciationSummary(asset.financials);
                const depMethodLabels: Record<string, string> = {
                  STRAIGHT_LINE: 'Straight Line',
                  DECLINING_BALANCE: 'Declining Balance',
                  SUM_OF_YEARS_DIGITS: 'Sum of Years Digits',
                  UNITS_OF_PRODUCTION: 'Units of Production',
                };
                const barColor = depSummary.percentDepreciated < 50
                  ? 'bg-green-500'
                  : depSummary.percentDepreciated < 80
                  ? 'bg-amber-500'
                  : 'bg-red-500';

                return (
                  <SectionCard title="Financial Summary" icon={DollarSign}>
                    <div className="grid grid-cols-2 gap-x-4">
                      <DetailRow label="Purchase Price" value={`UGX ${asset.financials.purchasePrice.toLocaleString()}`} />
                      <DetailRow label="Purchase Date" value={formatDate(asset.financials.purchaseDate)} />
                      {asset.financials.supplier && (
                        <DetailRow label="Supplier" value={asset.financials.supplier} />
                      )}
                      {asset.financials.invoiceReference && (
                        <DetailRow label="Invoice Ref" value={asset.financials.invoiceReference} icon={Hash} />
                      )}
                    </div>

                    {/* Depreciation Progress */}
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                        <span>Depreciation ({depMethodLabels[asset.financials.depreciationMethod] || asset.financials.depreciationMethod})</span>
                        <span className="font-medium text-gray-700">{depSummary.percentDepreciated}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className={`h-2.5 rounded-full transition-all ${barColor}`}
                          style={{ width: `${Math.min(depSummary.percentDepreciated, 100)}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-3 text-center">
                        <div>
                          <div className="text-xs text-gray-500">Book Value</div>
                          <div className="text-sm font-semibold text-gray-900">
                            UGX {depSummary.currentBookValue.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Annual Depr.</div>
                          <div className="text-sm font-semibold text-gray-900">
                            UGX {depSummary.annualDepreciation.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Remaining Life</div>
                          <div className="text-sm font-semibold text-gray-900">
                            {depSummary.isFullyDepreciated ? 'Fully depreciated' : `${depSummary.remainingLifeYears} yrs`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-[11px] text-gray-400">
                        <span>Salvage: UGX {asset.financials.salvageValue.toLocaleString()}</span>
                        <span>Useful life: {asset.financials.usefulLifeYears} yrs</span>
                      </div>
                    </div>
                  </SectionCard>
                );
              })()}

              <SectionCard title="Maintenance Summary" icon={Wrench}>
                <div className="grid grid-cols-2 gap-x-4">
                  <DetailRow
                    label="Service Interval"
                    value={`${asset.maintenance.intervalHours} hours`}
                    icon={Clock}
                  />
                  <DetailRow
                    label="Next Service Due"
                    value={
                      nextServiceDate ? (
                        <span className={isServiceOverdue ? 'text-red-600 font-medium' : ''}>
                          {formatDate(nextServiceDate)}
                          {isServiceOverdue && ' (Overdue)'}
                        </span>
                      ) : (
                        'Not set'
                      )
                    }
                  />
                  <DetailRow
                    label="Last Serviced"
                    value={
                      asset.maintenance.lastServicedAt
                        ? formatDate(asset.maintenance.lastServicedAt)
                        : 'Never'
                    }
                  />
                  <DetailRow label="Total Services" value={`${maintenanceLogs.length} records`} />
                </div>

                {asset.maintenance.tasks.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-100">
                    <div className="text-[11px] text-gray-500 mb-1.5">Maintenance Tasks</div>
                    <div className="flex flex-wrap gap-1">
                      {asset.maintenance.tasks.map((task, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-50 text-gray-600 text-xs rounded">
                          {task}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>

              {Object.keys(asset.specs).length > 0 && (
                <SectionCard title="Technical Specifications" icon={FileText}>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(asset.specs).map(([key, value]) => (
                      <div key={key}>
                        <div className="text-[11px] text-gray-500">{key}</div>
                        <div className="text-sm font-medium text-gray-900">{value}</div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {(asset.manualUrl || asset.productPageUrl) && (
                <SectionCard title="Resources" icon={ExternalLink}>
                  <div className="flex flex-col gap-2">
                    {asset.manualUrl && (
                      <a
                        href={asset.manualUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-primary"
                      >
                        <FileText className="w-4 h-4" />
                        Manual / Documentation
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {asset.productPageUrl && (
                      <a
                        href={asset.productPageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-primary"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Product Page
                      </a>
                    )}
                  </div>
                </SectionCard>
              )}
            </>
          )}

          {/* Maintenance */}
          {activeTab === 'maintenance' && (
            <SectionCard
              title="Maintenance History"
              icon={Wrench}
              action={
                <button
                  onClick={() => setShowMaintenanceModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  <Edit2 className="w-3 h-3" />
                  Log Maintenance
                </button>
              }
            >
              {isServiceOverdue && (
                <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>Overdue:</strong> Next service was due{' '}
                    {nextServiceDate && formatDate(nextServiceDate)}
                  </span>
                </div>
              )}
              <MaintenanceTimeline logs={maintenanceLogs} />
            </SectionCard>
          )}

          {/* Activity */}
          {activeTab === 'activity' && (
            <>
              <SectionCard title="Status Changes" icon={Activity}>
                <StatusChangeLog changes={statusChanges} />
              </SectionCard>
              <SectionCard title="Checkout History" icon={Activity}>
                <CheckoutHistory checkouts={checkouts} />
              </SectionCard>
            </>
          )}

          {/* Features */}
          {activeTab === 'features' && (
            <SectionCard title="Linked Features" icon={Cpu}>
              <LinkedFeatures features={features} assetStatus={asset.status} />
            </SectionCard>
          )}

          {/* Parts */}
          {activeTab === 'parts' && (
            <ConsumablesTab asset={asset} />
          )}

          {/* Intelligence */}
          {activeTab === 'intelligence' && (
            <AssetIntelligencePanel
              asset={asset}
              maintenanceLogs={maintenanceLogs}
              statusChanges={statusChanges}
              checkouts={checkouts}
              onAssetUpdated={refresh}
            />
          )}
        </div>

        {/* Maintenance Modal */}
        {showMaintenanceModal && asset && (
          <MaintenanceLogModal
            asset={asset}
            isOpen={showMaintenanceModal}
            onClose={() => {
              setShowMaintenanceModal(false);
              refresh();
            }}
            onSubmit={async (logEntry: Omit<MaintenanceLog, 'id' | 'performedAt' | 'assetId'>) => {
              await assetService.logMaintenance(asset.id, logEntry, user?.uid || 'system');
              setShowMaintenanceModal(false);
              refresh();
            }}
          />
        )}
      </>
    );
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-3xl overflow-y-auto"
      >
        <SheetHeader className="pb-3 border-b border-gray-100 mb-4">
          <SheetTitle className="text-lg">
            {asset ? `${asset.brand} ${asset.model}` : 'Asset Details'}
          </SheetTitle>
          <SheetDescription>
            {asset?.nickname ? `"${asset.nickname}"` : 'Loading asset details...'}
          </SheetDescription>
        </SheetHeader>

        {renderContent()}
      </SheetContent>
    </Sheet>
  );
}
