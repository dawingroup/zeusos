/**
 * ProductionTab Component
 * Production optimization for Stage 4+ with batch release to manufacturing
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Scissors,
  Lock,
  Factory,
  CheckSquare,
  Square,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { NestingStudio, ShopTravelerSection } from '../production';
import { OptimizationStatusBadge } from '@/shared/components/OptimizationStatusBadge';
import { batchReleaseToProduction } from '@/modules/manufacturing/services/handoverService';
import type { Project } from '@/shared/types';
import type { DesignProject, DesignStage, DesignItem } from '../../types';
import type { OptimizationStatus } from '@/shared/services/optimization/changeDetection';

// ============================================
// Types
// ============================================

interface ProductionTabProps {
  project: DesignProject;
  stage?: DesignStage;
  onRefresh?: () => void;
}

// Stages that allow production
const PRODUCTION_STAGES: DesignStage[] = ['pre-production', 'production-ready'];

// Sourcing types eligible for manufacturing
const MANUFACTURABLE_TYPES = ['CUSTOM_FURNITURE_MILLWORK', 'MANUFACTURED'];

// ============================================
// Sub-Components
// ============================================

interface StageGateMessageProps {
  currentStage: DesignStage;
  requiredStages: DesignStage[];
}

const StageGateMessage: React.FC<StageGateMessageProps> = ({ currentStage, requiredStages }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Lock className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Production Not Available
      </h3>
      <p className="text-gray-500 max-w-md">
        Production optimization is available when the project reaches{' '}
        <span className="font-medium">{requiredStages.join(' or ')}</span> stage.
      </p>
      <p className="text-sm text-gray-400 mt-2">
        Current stage: <span className="font-medium">{currentStage}</span>
      </p>
    </div>
  );
};

// ============================================
// Release to Production Section
// ============================================

interface ReleaseToProductionProps {
  projectId: string;
  onReleased?: () => void;
}

function ReleaseToProductionSection({ projectId, onReleased }: ReleaseToProductionProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<DesignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [releasing, setReleasing] = useState(false);
  const [releaseResults, setReleaseResults] = useState<{
    batchNumber: string;
    results: Array<{ designItemName: string; success: boolean; error?: string }>;
  } | null>(null);

  const fetchEligibleItems = useCallback(async () => {
    setLoading(true);
    try {
      const itemsRef = collection(db, 'designProjects', projectId, 'designItems');
      const snap = await getDocs(itemsRef);
      const allItems = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DesignItem));

      // Filter: production-ready, manufacturable type, not already handed over
      const eligible = allItems.filter(
        (item) =>
          item.currentStage === 'production-ready' &&
          MANUFACTURABLE_TYPES.includes(item.sourcingType ?? '') &&
          !item.manufacturingOrderId,
      );
      setItems(eligible);
    } catch {
      console.error('Failed to fetch eligible items');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchEligibleItems();
  }, [fetchEligibleItems]);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const handleRelease = async () => {
    if (!user?.uid || selectedIds.size === 0) return;
    setReleasing(true);
    setReleaseResults(null);

    try {
      const result = await batchReleaseToProduction(
        projectId,
        Array.from(selectedIds),
        user.uid,
      );
      setReleaseResults({
        batchNumber: result.batchNumber,
        results: result.results.map((r) => ({
          designItemName: r.designItemName,
          success: r.success,
          error: r.error,
        })),
      });
      setSelectedIds(new Set());
      // Refresh items list to remove released items
      await fetchEligibleItems();
      onReleased?.();
    } catch (err) {
      setReleaseResults({
        batchNumber: '',
        results: [{ designItemName: 'Batch release', success: false, error: String(err) }],
      });
    } finally {
      setReleasing(false);
    }
  };

  // Already-released items query
  const [releasedCount, setReleasedCount] = useState(0);
  useEffect(() => {
    (async () => {
      try {
        const itemsRef = collection(db, 'designProjects', projectId, 'designItems');
        const snap = await getDocs(itemsRef);
        const count = snap.docs.filter((d) => d.data().manufacturingOrderId).length;
        setReleasedCount(count);
      } catch { /* ignore */ }
    })();
  }, [projectId, items.length]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading eligible items...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Section Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Factory className="w-5 h-5 text-[#872E5C]" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Release to Production</h3>
              <p className="text-xs text-gray-500">
                Select production-ready items to release as a manufacturing batch
              </p>
            </div>
          </div>
          {releasedCount > 0 && (
            <span className="text-xs text-gray-400">
              {releasedCount} item{releasedCount !== 1 ? 's' : ''} already in production
            </span>
          )}
        </div>
      </div>

      {/* Release Results */}
      {releaseResults && (
        <div className={`px-6 py-3 border-b ${
          releaseResults.results.every((r) => r.success) ? 'bg-green-50' : 'bg-amber-50'
        }`}>
          <div className="flex items-start gap-2">
            {releaseResults.results.every((r) => r.success) ? (
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
            )}
            <div>
              {releaseResults.batchNumber && (
                <p className="text-sm font-medium text-gray-900">
                  Batch {releaseResults.batchNumber} created
                </p>
              )}
              <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                {releaseResults.results.map((r, i) => (
                  <div key={i} className="flex items-center gap-1">
                    {r.success ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-500" />
                    )}
                    <span>{r.designItemName}</span>
                    {r.error && <span className="text-red-600">— {r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Items Table or Empty State */}
      {items.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-gray-500">
            {releasedCount > 0
              ? 'All production-ready items have been released to manufacturing.'
              : 'No items at production-ready stage yet. Items will appear here when they reach the production-ready stage.'}
          </p>
        </div>
      ) : (
        <>
          {/* Select All + Release Button */}
          <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
            <button
              onClick={toggleAll}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              {selectedIds.size === items.length ? (
                <CheckSquare className="w-4 h-4 text-[#872E5C]" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              {selectedIds.size === items.length ? 'Deselect All' : 'Select All'}
              <span className="text-gray-400">({items.length} items)</span>
            </button>

            <button
              onClick={handleRelease}
              disabled={selectedIds.size === 0 || releasing}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-[#872E5C] rounded-lg hover:bg-[#6a2449] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {releasing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Factory className="w-4 h-4" />
              )}
              {releasing
                ? 'Releasing...'
                : `Release ${selectedIds.size} Item${selectedIds.size !== 1 ? 's' : ''} to Production`}
            </button>
          </div>

          {/* Items Table */}
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-10 px-4 py-2"></th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Readiness</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Est. Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    {selectedIds.has(item.id) ? (
                      <CheckSquare className="w-4 h-4 text-[#872E5C]" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-300" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {item.sourcingType === 'CUSTOM_FURNITURE_MILLWORK' ? 'Custom/Millwork' : 'Manufactured'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {item.requiredQuantity ?? 1}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      (item.overallReadiness ?? 0) >= 80
                        ? 'bg-green-100 text-green-700'
                        : (item.overallReadiness ?? 0) >= 50
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {item.overallReadiness ?? 0}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {item.manufacturing?.totalCost
                      ? `UGX ${item.manufacturing.totalCost.toLocaleString()}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function ProductionTab({ project, stage, onRefresh }: ProductionTabProps) {
  const { user } = useAuth();

  // Check if stage allows production (default to allowing if no stage provided)
  const currentStage = stage || 'pre-production';
  const canAccessProduction = PRODUCTION_STAGES.includes(currentStage);

  if (!canAccessProduction) {
    return <StageGateMessage currentStage={currentStage} requiredStages={PRODUCTION_STAGES} />;
  }

  const projectData = project as unknown as Project;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Scissors className="w-6 h-6 text-purple-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Production Optimization</h2>
            <p className="text-sm text-gray-500">
              Release items to manufacturing and generate optimized cutting layouts
            </p>
          </div>
        </div>

        {/* Optimization Status Badge */}
        <OptimizationStatusBadge
          status={(project as unknown as { optimizationStatus?: OptimizationStatus }).optimizationStatus || null}
          onReOptimize={onRefresh ? async () => onRefresh() : undefined}
          size="md"
          showLabel={true}
          showReasons={true}
        />
      </div>

      {/* Release to Production */}
      <ReleaseToProductionSection
        projectId={project.id}
        onReleased={onRefresh}
      />

      {/* Nesting Studio */}
      {user?.email && (
        <NestingStudio
          projectId={project.id}
          project={projectData}
          mode="PRODUCTION"
          userId={user.email}
          onRefresh={onRefresh}
        />
      )}

      {/* Shop Traveler */}
      <ShopTravelerSection
        project={projectData}
        onRefresh={onRefresh ? async () => onRefresh() : undefined}
      />

    </div>
  );
}

export default ProductionTab;
