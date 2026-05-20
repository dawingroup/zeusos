/**
 * Asset Detail Page
 * Full-featured detail page for a single asset with tabbed layout:
 * Overview, Maintenance, Activity, Features, Intelligence.
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
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
} from 'lucide-react';
import { useAssetDetail } from '../hooks/useAssetDetail';
import { useAuth } from '@/shared/hooks';
import { AssetService } from '../services/AssetService';
import { MaintenanceTimeline } from '../components/MaintenanceTimeline';
import { StatusChangeLog } from '../components/StatusChangeLog';
import { CheckoutHistory } from '../components/CheckoutHistory';
import { LinkedFeatures } from '../components/LinkedFeatures';
import { AssetIntelligencePanel } from '../components/AssetIntelligencePanel';
import { MaintenanceLogModal } from '../components/MaintenanceLogModal';
import type { AssetStatus, AssetCategory } from '@/shared/types';
import type { MaintenanceLog } from '../types';

const assetService = new AssetService();

// ============================================================================
// STATUS & CATEGORY CONFIG
// ============================================================================

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

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

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
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
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
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
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

// ============================================================================
// TAB DEFINITIONS
// ============================================================================

type TabId = 'overview' | 'maintenance' | 'activity' | 'features' | 'intelligence';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Tag },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'features', label: 'Features', icon: Cpu },
  { id: 'intelligence', label: 'Intelligence', icon: Sparkles },
];

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function AssetDetailPage() {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();
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
  } = useAssetDetail(assetId);

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // ---- Loading / Error ----
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500">
        <AlertTriangle className="w-10 h-10 mb-3 text-amber-500" />
        <p className="font-medium">{error || 'Asset not found'}</p>
        <button
          onClick={() => navigate('/assets')}
          className="mt-4 text-sm text-primary hover:underline"
        >
          Back to Asset Registry
        </button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[asset.status] || STATUS_CONFIG.ACTIVE;

  // ---- Status update ----
  const handleStatusChange = async (newStatus: AssetStatus) => {
    if (!user?.uid || newStatus === asset.status) return;
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

  // ---- Compute maintenance status ----
  const nextServiceDate = asset.maintenance.nextServiceDue
    ? new Date(
        typeof asset.maintenance.nextServiceDue === 'string'
          ? asset.maintenance.nextServiceDue
          : (asset.maintenance.nextServiceDue as Date)
      )
    : null;
  const isServiceOverdue = nextServiceDate ? nextServiceDate <= new Date() : false;

  // Total maintenance cost
  const totalMaintenanceCost = maintenanceLogs.reduce(
    (sum, log) => sum + (log.cost || 0),
    0
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* ---- HEADER ---- */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/assets')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Asset Registry
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {asset.brand} {asset.model}
            </h1>
            {asset.nickname && (
              <p className="text-gray-500 mt-0.5">"{asset.nickname}"</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {/* Status badge */}
              <div className="relative">
                <button
                  onClick={() => setIsEditingStatus(!isEditingStatus)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text} hover:opacity-80`}
                >
                  {statusUpdating ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : null}
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
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                {CATEGORY_LABELS[asset.category] || asset.category}
              </span>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-gray-900">
                {maintenanceLogs.length}
              </div>
              <div className="text-xs text-gray-500">Services</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">
                {checkouts.length}
              </div>
              <div className="text-xs text-gray-500">Checkouts</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">
                {features.length}
              </div>
              <div className="text-xs text-gray-500">Features</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">
                {totalMaintenanceCost > 0
                  ? `${(totalMaintenanceCost / 1000).toFixed(0)}K`
                  : '0'}
              </div>
              <div className="text-xs text-gray-500">Cost (UGX)</div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- TAB BAR ---- */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- TAB CONTENT ---- */}
      <div className="space-y-6">
        {/* ==== OVERVIEW ==== */}
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Asset Info */}
              <SectionCard title="Asset Information" icon={Tag}>
                <div className="grid grid-cols-2 gap-x-6">
                  <DetailRow label="Brand" value={asset.brand} />
                  <DetailRow label="Model" value={asset.model} />
                  <DetailRow label="Serial Number" value={asset.serialNumber} icon={Hash} />
                  <DetailRow label="Nickname" value={asset.nickname} />
                  <DetailRow
                    label="Category"
                    value={CATEGORY_LABELS[asset.category]}
                    icon={Tag}
                  />
                  <DetailRow label="Zone" value={asset.location.zone} icon={MapPin} />
                </div>
              </SectionCard>

              {/* Maintenance Summary */}
              <SectionCard title="Maintenance Summary" icon={Wrench}>
                <div className="grid grid-cols-2 gap-x-6">
                  <DetailRow
                    label="Service Interval"
                    value={`${asset.maintenance.intervalHours} hours`}
                    icon={Clock}
                  />
                  <DetailRow
                    label="Next Service Due"
                    value={
                      nextServiceDate ? (
                        <span
                          className={
                            isServiceOverdue
                              ? 'text-red-600 font-medium'
                              : ''
                          }
                        >
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
                  <DetailRow
                    label="Total Services"
                    value={`${maintenanceLogs.length} records`}
                  />
                </div>

                {asset.maintenance.tasks.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500 mb-2">
                      Maintenance Tasks
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {asset.maintenance.tasks.map((task, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-gray-50 text-gray-600 text-xs rounded"
                        >
                          {task}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Technical Specs */}
            {Object.keys(asset.specs).length > 0 && (
              <SectionCard title="Technical Specifications" icon={FileText}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Object.entries(asset.specs).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-xs text-gray-500">{key}</div>
                      <div className="text-sm font-medium text-gray-900">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Resources */}
            {(asset.manualUrl || asset.productPageUrl) && (
              <SectionCard title="Resources" icon={ExternalLink}>
                <div className="flex gap-3">
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

        {/* ==== MAINTENANCE ==== */}
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
              <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
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

        {/* ==== ACTIVITY ==== */}
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

        {/* ==== FEATURES ==== */}
        {activeTab === 'features' && (
          <SectionCard title="Linked Features" icon={Cpu}>
            <LinkedFeatures features={features} assetStatus={asset.status} />
          </SectionCard>
        )}

        {/* ==== INTELLIGENCE ==== */}
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

      {/* ---- MAINTENANCE MODAL ---- */}
      {showMaintenanceModal && (
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
    </div>
  );
}
