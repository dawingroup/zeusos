/**
 * Design Item Detail
 * Full detail view for a design item
 */

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText, Activity, CheckSquare, Sparkles, Settings, Package, Trash2, Edit2, Layers, PanelRight } from 'lucide-react';
import { DetailDrawer, DrawerTrigger } from './DetailDrawer';
import { ProjectItemsDrawer } from './ProjectItemsDrawer';
import { cn } from '@/shared/lib/utils';
import { ResponsiveTabs } from '@/shared/components/ui/ResponsiveTabs';
import { useDesignItem, useProject, useRAGUpdate } from '../../hooks';
import { StageBadge } from './StageBadge';
import { ReadinessGauge } from './ReadinessGauge';
import { RAGStagePanel } from '../traffic-light/RAGStagePanel';
import { RAGEditModal } from '../traffic-light/RAGEditModal';
import { StageGateCheck } from '../stage-gate/StageGateCheck';
import { AIErrorBoundary } from '../ai/AIErrorBoundary';
import { ParametersEditor } from './ParametersEditor';
import { ApprovalWorkflow } from '../approvals/ApprovalWorkflow';
import { UnifiedFileManager } from '@/shared/components/file-manager';
import { PartsTab } from './PartsTab';
import { ItemRevisionTimeline } from './ItemRevisionTimeline';
import { RevisionRequestsPanel } from '../project/RevisionRequestsPanel';
import { CATEGORY_LABELS, formatDateTime } from '../../utils/formatting';
import { getNextStageForItem } from '../../utils/stage-gate';
import {
  transitionStage,
  createApproval,
  respondToApproval as respondToApprovalFirestore,
  deleteDesignItem,
} from '../../services/firestore';
import { deriveHandoverStatus } from '../../services/designItemStatusDerivation';
import { useAuth } from '@/contexts/AuthContext';
import type { RAGStatus, RAGValue, RAGStatusValue, DesignItem, DfMIssue } from '../../types';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';

// Lazy load AI components to prevent blocking main bundle
const DfMChecker = lazyWithRetry(() =>
  import('../ai/DfMChecker').then(m => ({ default: m.DfMChecker }))
);
const ImageAnalysisAI = lazyWithRetry(() =>
  import('../ai/ImageAnalysisAI').then(m => ({ default: m.ImageAnalysisAI }))
);
const DesignItemEnhancementAI = lazyWithRetry(() =>
  import('../ai/DesignItemEnhancementAI').then(m => ({ default: m.DesignItemEnhancementAI }))
);
const DesignChat = lazyWithRetry(() =>
  import('../design-ai/DesignChat').then(m => ({ default: m.DesignChat }))
);

import { useAIContext } from '../../hooks/useAIContext';
import { EditDesignItemDialog } from './EditDesignItemDialog';
import { ArchitecturalPricingTab } from './ArchitecturalPricingTab';
import { HandoverToManufacturingButton } from './HandoverToManufacturingButton';
import { LinkedBoqItemsCard } from './LinkedBoqItemsCard';
import { designToManufacturingService, type DesignSyncResult } from '@/modules/manufacturing/services/designToManufacturingService';
import { DollarSign, Factory, RefreshCw } from 'lucide-react';

type Tab = 'parts-costing' | 'pricing' | 'rag' | 'files-approvals' | 'ai';

// Aspect labels for display
const ASPECT_LABELS: Record<string, string> = {
  overallDimensions: 'Overall Dimensions',
  model3D: '3D Model',
  productionDrawings: 'Production Drawings',
  materialSpecs: 'Material Specs',
  hardwareSpecs: 'Hardware Specs',
  finishSpecs: 'Finish Specs',
  joineryDetails: 'Joinery Details',
  tolerances: 'Tolerances',
  assemblyInstructions: 'Assembly Instructions',
  materialAvailability: 'Material Availability',
  hardwareAvailability: 'Hardware Availability',
  toolingReadiness: 'Tooling Readiness',
  processDocumentation: 'Process Documentation',
  qualityCriteria: 'Quality Criteria',
  costValidation: 'Cost Validation',
  internalDesignReview: 'Internal Design Review',
  manufacturingReview: 'Manufacturing Review',
  clientApproval: 'Client Approval',
  prototypeValidation: 'Prototype Validation',
};

export default function DesignItemDetail() {
  const { projectId, itemId } = useParams<{ projectId: string; itemId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { project } = useProject(projectId);
  const { item, loading } = useDesignItem(projectId, itemId);
  const { updateAspect } = useRAGUpdate(projectId, itemId);
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<Tab>('parts-costing');
  const [showGateCheck, setShowGateCheck] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  
  // RAG Edit Modal state
  const [editingAspect, setEditingAspect] = useState<{
    category: keyof RAGStatus;
    key: string;
    value: RAGValue;
  } | null>(null);

  // MO sync state
  const [moSyncing, setMoSyncing] = useState(false);
  const [moSyncResult, setMoSyncResult] = useState<DesignSyncResult | null>(null);

  const handleSyncToMO = useCallback(async () => {
    if (!projectId || !itemId || !item?.manufacturingOrderId) return;
    setMoSyncing(true);
    setMoSyncResult(null);
    try {
      const result = await designToManufacturingService.syncDesignItemToMO(
        projectId,
        itemId,
        user?.email || '',
      );
      setMoSyncResult(result);
    } catch (err) {
      setMoSyncResult({
        synced: false,
        moId: item.manufacturingOrderId,
        changes: [],
        error: err instanceof Error ? err.message : 'Sync failed',
      });
    } finally {
      setMoSyncing(false);
    }
  }, [projectId, itemId, item?.manufacturingOrderId, user?.email]);

  // Drawer states - must be before any conditional returns
  const [showInspirationDrawer, setShowInspirationDrawer] = useState(false);
  const [showCostSummaryDrawer, setShowCostSummaryDrawer] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showItemDetailsDrawer, setShowItemDetailsDrawer] = useState(false);
  const [showProjectItemsDrawer, setShowProjectItemsDrawer] = useState(false);
  const tabSyncedForItemId = useRef<string | null>(null);

  useEffect(() => {
    if (!item?.id) return;
    const arch = (item as any).sourcingType === 'ARCHITECTURAL';
    const defaultTab: Tab = arch ? 'pricing' : 'parts-costing';
    const p = tabParam;

    if (p === 'overview' || p === 'parameters') {
      setActiveTab(defaultTab);
      setShowItemDetailsDrawer(true);
      tabSyncedForItemId.current = item.id;
      return;
    }

    if (p === 'parts-costing' || p === 'pricing' || p === 'rag' || p === 'files-approvals' || p === 'ai') {
      if (p === 'pricing' && !arch) setActiveTab('parts-costing');
      else if (p === 'parts-costing' && arch) setActiveTab('pricing');
      else setActiveTab(p);
      tabSyncedForItemId.current = item.id;
      return;
    }

    if (tabSyncedForItemId.current !== item.id) {
      setActiveTab(defaultTab);
      tabSyncedForItemId.current = item.id;
    }
  }, [item?.id, (item as any)?.sourcingType, tabParam]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1d1d1f]"></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-medium text-gray-900">Item not found</h2>
        <Link 
          to={`/design/project/${projectId}`} 
          className="text-[#1d1d1f] hover:underline mt-2 inline-block"
        >
          Back to Project
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

  // Determine if this is an architectural item
  const isArchitectural = (item as any).sourcingType === 'ARCHITECTURAL';

  const tabs = [
    // Show Pricing tab for architectural items, Parts tab for others (first)
    isArchitectural
      ? { id: 'pricing' as Tab, label: 'Pricing', icon: DollarSign }
      : { id: 'parts-costing' as Tab, label: 'Parts', icon: Package },
    { id: 'rag' as Tab, label: 'RAG', icon: Activity },
    { id: 'files-approvals' as Tab, label: 'Files', icon: CheckSquare },
    { id: 'ai' as Tab, label: 'AI', icon: Sparkles },
  ];

  return (
    <div className="space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col gap-4">
        {/* Top row: Back button + Title */}
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-1 flex-shrink-0">
            <Link
              to={`/design/project/${projectId}`}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              title="Back to Project"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <button
              onClick={() => setShowProjectItemsDrawer(true)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg sm:hidden"
              title="Switch items"
            >
              <Layers className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{item.name}</h1>
              <button
                type="button"
                onClick={() => setShowItemDetailsDrawer(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100"
                title="Overview and parameters"
              >
                <PanelRight className="h-4 w-4 text-gray-600" />
                <span className="hidden sm:inline">Details</span>
              </button>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded hidden sm:inline">
                {item.itemCode}
              </span>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 mt-1 flex-wrap">
              <button
                onClick={() => setShowProjectItemsDrawer(true)}
                className="text-sm text-gray-600 hover:text-[#1d1d1f] hover:underline cursor-pointer hidden sm:block"
              >
                {project?.name || 'Unknown Project'}
              </button>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {CATEGORY_LABELS[item.category]}
              </span>
              <StageBadge stage={item.currentStage} size="sm" />
            </div>
          </div>

          {/* Desktop actions */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <ReadinessGauge value={item.overallReadiness} size="lg" />

            {nextStage && (
              <button
                onClick={() => setShowGateCheck(true)}
                className="px-3 py-2 bg-[#1d1d1f] text-white rounded-lg hover:bg-[#424245] text-sm font-medium"
              >
                Advance
              </button>
            )}

            <HandoverToManufacturingButton
              designItem={item}
              projectId={projectId!}
              userId={user?.uid || ''}
            />

            <button
              onClick={() => setShowEditDialog(true)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              title="Edit Item"
            >
              <Edit2 className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete Item"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile action bar */}
        <div className="flex sm:hidden items-center justify-between gap-2 px-1">
          <ReadinessGauge value={item.overallReadiness} size="md" />

          <div className="flex items-center gap-1">
            {nextStage && (
              <button
                onClick={() => setShowGateCheck(true)}
                className="px-3 py-1.5 bg-[#1d1d1f] text-white rounded-lg text-sm font-medium"
              >
                Advance
              </button>
            )}

            <HandoverToManufacturingButton
              designItem={item}
              projectId={projectId!}
              userId={user?.uid || ''}
            />
            <button
              onClick={() => setShowEditDialog(true)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Design Item?</h3>
            <p className="text-gray-600 mb-4">
              This will permanently delete <strong>{item.name}</strong> and all its deliverables and approvals. This action cannot be undone.
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

      {/* Edit Design Item Dialog */}
      {showEditDialog && item && (
        <EditDesignItemDialog
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          item={item}
          projectId={projectId!}
          userId={user?.email || ''}
        />
      )}

      {/* Manufacturing Status Banner */}
      {item.manufacturingOrderId && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Factory className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <span className="text-sm font-medium text-blue-900">Handed over to Manufacturing</span>
              <span className="text-sm text-blue-600 ml-2">
                {deriveHandoverStatus(item) === 'handed-over' ? 'Manufacturing order active' : 'Pending handover'}
              </span>
            </div>
            <button
              onClick={handleSyncToMO}
              disabled={moSyncing}
              className="text-sm font-medium text-blue-700 hover:text-blue-900 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-md flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              title="Push current design changes to the Manufacturing Order"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', moSyncing && 'animate-spin')} />
              {moSyncing ? 'Syncing...' : 'Sync to MO'}
            </button>
            <Link
              to={`/manufacturing/orders/${item.manufacturingOrderId}`}
              className="text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1"
            >
              View MO →
            </Link>
          </div>
          {/* Sync result feedback */}
          {moSyncResult && (
            <div className={cn(
              'p-3 rounded-lg border text-sm',
              moSyncResult.synced
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            )}>
              {moSyncResult.synced ? (
                <>
                  <span className="font-medium">MO {moSyncResult.moNumber} synced successfully.</span>
                  <ul className="mt-1 ml-4 list-disc text-xs space-y-0.5">
                    {moSyncResult.changes.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </>
              ) : (
                <span>{moSyncResult.error}</span>
              )}
              <button
                onClick={() => setMoSyncResult(null)}
                className="ml-2 text-xs underline opacity-70 hover:opacity-100"
              >
                dismiss
              </button>
            </div>
          )}
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
        {activeTab === 'parts-costing' && (
          <PartsCostingTab
            item={item}
            projectId={projectId!}
            onOpenCostSummary={() => setShowCostSummaryDrawer(true)}
          />
        )}

        {activeTab === 'pricing' && isArchitectural && (
          <ArchitecturalPricingTabWrapper
            item={item}
            projectId={projectId!}
            userId={user?.uid || ''}
          />
        )}
        
        {activeTab === 'rag' && (
          <RAGStagePanel 
            ragStatus={item.ragStatus}
            currentStage={item.currentStage}
            editable 
            onAspectClick={(category: keyof RAGStatus, aspectKey: string, value: RAGValue) => {
              setEditingAspect({ category, key: aspectKey, value });
            }}
          />
        )}
        
        {activeTab === 'files-approvals' && (
          <FilesApprovalsTab 
            item={item} 
            projectId={projectId!}
            onOpenHistory={() => setShowHistoryDrawer(true)}
          />
        )}
        
        {activeTab === 'ai' && (
          <AITab item={item} projectId={projectId!} itemId={itemId!} userId={user?.uid} />
        )}
      </div>

      {/* Inspiration Drawer */}
      <DetailDrawer
        isOpen={showInspirationDrawer}
        onClose={() => setShowInspirationDrawer(false)}
        title="Design Inspiration"
        subtitle={`Reference images for ${item.name}`}
        width="lg"
      >
        <InspirationDrawerContent item={item} projectId={projectId!} itemId={itemId!} />
      </DetailDrawer>

      {/* Cost Summary Drawer */}
      <DetailDrawer
        isOpen={showCostSummaryDrawer}
        onClose={() => setShowCostSummaryDrawer(false)}
        title="Cost Summary"
        subtitle="Auto-calculated from parts"
        width="lg"
      >
        <CostSummaryDrawerContent item={item} />
      </DetailDrawer>

      {/* History Drawer */}
      <DetailDrawer
        isOpen={showHistoryDrawer}
        onClose={() => setShowHistoryDrawer(false)}
        title="Stage History"
        subtitle="Timeline of stage transitions"
        width="md"
      >
        <HistoryDrawerContent item={item} />
      </DetailDrawer>

      {/* Overview + Parameters (right drawer) */}
      <DetailDrawer
        isOpen={showItemDetailsDrawer}
        onClose={() => setShowItemDetailsDrawer(false)}
        title="Item details"
        subtitle={item.name}
        width="xl"
      >
        <div className="space-y-10 pb-6">
          <section aria-labelledby="item-details-overview-heading">
            <h2
              id="item-details-overview-heading"
              className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Overview
            </h2>
            <OverviewTab
              item={item}
              projectId={projectId!}
              onOpenInspiration={() => setShowInspirationDrawer(true)}
              layout="drawer"
            />
          </section>
          <section
            aria-labelledby="item-details-parameters-heading"
            className="border-t border-gray-200 pt-8"
          >
            <h2
              id="item-details-parameters-heading"
              className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Parameters
            </h2>
            <ParametersTab item={item} projectId={projectId!} />
          </section>
        </div>
      </DetailDrawer>

      {/* Project Items Drawer - for switching between deliverables */}
      <ProjectItemsDrawer
        isOpen={showProjectItemsDrawer}
        onClose={() => setShowProjectItemsDrawer(false)}
        projectId={projectId!}
        projectName={project?.name}
        currentItemId={itemId}
      />

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
              targetStage={nextStage}
              onAdvance={handleAdvance}
              onCancel={() => setShowGateCheck(false)}
              allowOverride
            />
          </div>
        </div>
      )}

      {/* RAG Edit Modal */}
      {editingAspect && (
        <RAGEditModal
          open={true}
          category={editingAspect.category}
          aspectKey={editingAspect.key}
          aspectLabel={ASPECT_LABELS[editingAspect.key] || editingAspect.key}
          currentValue={editingAspect.value}
          onSave={async (status: RAGStatusValue, notes: string) => {
            const aspectPath = `${editingAspect.category}.${editingAspect.key}`;
            await updateAspect(aspectPath, status, notes);
          }}
          onClose={() => setEditingAspect(null)}
        />
      )}
    </div>
  );
}

// Tab Components
function OverviewTab({
  item,
  projectId,
  onOpenInspiration,
  onOpenParameters,
  layout = 'page',
}: {
  item: NonNullable<ReturnType<typeof useDesignItem>['item']>;
  projectId: string;
  onOpenInspiration: () => void;
  /** Shown only in full page layout (opens parameters summary drawer). Omit in drawer layout. */
  onOpenParameters?: () => void;
  layout?: 'page' | 'drawer';
}) {
  const { user } = useAuth();
  const [isUpdatingSourcing, setIsUpdatingSourcing] = useState(false);
  const [isUpdatingDueDate, setIsUpdatingDueDate] = useState(false);
  const [InspirationPanelComponent, setInspirationPanelComponent] = useState<React.ComponentType<any> | null>(null);

  // Lazy load InspirationPanel for sidebar
  useEffect(() => {
    import('./InspirationPanel').then((mod) => {
      setInspirationPanelComponent(() => mod.InspirationPanel);
    });
  }, []);

  const params = (item as any).parameters || {};
  const dimensions = params.dimensions || {};
  const hasDimensions = dimensions.width || dimensions.height || dimensions.depth;

  const sourcingType = (item as any)?.sourcingType as ('MANUFACTURED' | 'PROCURED' | undefined);

  const isDrawerLayout = layout === 'drawer';

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-6',
        isDrawerLayout ? '' : 'lg:grid-cols-3',
      )}
    >
      {/* Main Content */}
      <div className={cn('space-y-6', isDrawerLayout ? '' : 'lg:col-span-2')}>
        {/* Description */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
          <p className="text-gray-900">{item.description || 'No description provided.'}</p>
        </div>
      
        {/* Key Info Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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
                const { updateDesignItem } = await import('../../services/firestore');
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
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Sourcing</h3>
          <select
            value={sourcingType || ''}
            disabled={isUpdatingSourcing}
            onChange={async (e) => {
              const next = (e.target.value || undefined) as ('MANUFACTURED' | 'PROCURED' | undefined);
              setIsUpdatingSourcing(true);
              try {
                const { updateDesignItem } = await import('../../services/firestore');
                await updateDesignItem(projectId, item.id, { sourcingType: next } as any, user?.email || 'system');
              } catch (error) {
                console.error('Failed to update sourcingType:', error);
              } finally {
                setIsUpdatingSourcing(false);
              }
            }}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">Not set</option>
            <option value="MANUFACTURED">Manufactured</option>
            <option value="PROCURED">Procured</option>
          </select>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Readiness</h3>
          <p className="text-lg font-semibold text-gray-900">{item.overallReadiness}%</p>
        </div>
      </div>

      {/* Key Parameters Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Key Parameters</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Dimensions */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Dimensions</h4>
            {hasDimensions ? (
              <p className="text-sm text-gray-900">
                {dimensions.width || '-'} × {dimensions.height || '-'} × {dimensions.depth || '-'} {dimensions.unit || 'mm'}
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic">Not specified</p>
            )}
          </div>
          
          {/* Primary Material */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Primary Material</h4>
            <p className="text-sm text-gray-900">
              {params.primaryMaterial?.name || <span className="text-gray-400 italic">Not specified</span>}
            </p>
          </div>
          
          {/* Finish */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Finish</h4>
            <p className="text-sm text-gray-900">
              {params.finish ? (
                typeof params.finish === 'string' 
                  ? params.finish 
                  : `${params.finish.type || 'Unknown'}${params.finish.color ? ` - ${params.finish.color}` : ''}${params.finish.sheen ? ` (${params.finish.sheen})` : ''}`
              ) : (
                <span className="text-gray-400 italic">Not specified</span>
              )}
            </p>
          </div>
          
          {/* Construction Method */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Construction</h4>
            <p className="text-sm text-gray-900 capitalize">
              {params.constructionMethod || <span className="text-gray-400 italic">Not specified</span>}
            </p>
          </div>
          
          {/* AWI Grade */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">AWI Grade</h4>
            <p className="text-sm text-gray-900 uppercase">
              {params.awiGrade || <span className="text-gray-400 italic">Not specified</span>}
            </p>
          </div>
          
          {/* Hardware Count */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Hardware Items</h4>
            <p className="text-sm text-gray-900">
              {params.hardware?.length > 0 
                ? `${params.hardware.length} item${params.hardware.length !== 1 ? 's' : ''}`
                : <span className="text-gray-400 italic">None specified</span>
              }
            </p>
          </div>
        </div>
        
        {/* Special Requirements */}
        {params.specialRequirements?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Special Requirements</h4>
            <div className="flex flex-wrap gap-2">
              {params.specialRequirements.map((req: string, index: number) => (
                <span key={index} className="px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded-full">
                  {req}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      
        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Created</h3>
            <p className="text-sm font-medium text-gray-900">{formatDateTime(item.createdAt)}</p>
            <p className="text-xs text-gray-500">by {item.createdBy}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Last Updated</h3>
            <p className="text-sm font-medium text-gray-900">{formatDateTime(item.updatedAt)}</p>
            <p className="text-xs text-gray-500">by {item.updatedBy}</p>
          </div>
        </div>
      </div>

      {/* Sidebar - Quick Actions */}
      <div className={cn('space-y-4', isDrawerLayout ? '' : 'lg:col-span-1')}>
        {/* Inspiration Preview Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Inspiration</h3>
          </div>
          {InspirationPanelComponent ? (
            <InspirationPanelComponent
              designItemId={item.id}
              projectId={projectId}
              designItemName={item.name}
              onOpenGallery={onOpenInspiration}
              compact
              maxItems={2}
            />
          ) : (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#1d1d1f]"></div>
            </div>
          )}
          <DrawerTrigger
            label="View All Inspiration"
            onClick={onOpenInspiration}
            variant="compact"
          />
        </div>

        {/* Parameters Quick View Card (full page only; parameters live below in drawer layout) */}
        {!isDrawerLayout && onOpenParameters && (
          <DrawerTrigger
            label="Parameters"
            sublabel={hasDimensions ? `${dimensions.width}×${dimensions.height}×${dimensions.depth}mm` : 'View specifications'}
            onClick={onOpenParameters}
            variant="card"
            icon={<Settings className="w-5 h-5" />}
          />
        )}

        {/* P9b — advisory BOQ reconciliation. Rendered always so the
            user discovers the surface even before the first link is
            created (empty-state nudges the workflow). */}
        <LinkedBoqItemsCard
          designItem={item}
          designProjectId={projectId}
          userId={user?.email || ''}
        />
      </div>
    </div>
  );
}

interface ParametersTabProps {
  item: DesignItem;
  projectId: string;
}

function ParametersTab({ item, projectId }: ParametersTabProps) {
  const { user } = useAuth();
  
  const handleSaveParameters = async (parameters: any) => {
    try {
      // Import updateDesignItem dynamically to avoid circular deps
      const { updateDesignItem } = await import('../../services/firestore');
      await updateDesignItem(projectId, item.id, { parameters } as any, user?.email || 'system');
      console.log('Parameters saved successfully');
    } catch (error) {
      console.error('Failed to save parameters:', error);
      throw error;
    }
  };

  // Get existing parameters or use defaults
  const existingParams = (item as any).parameters || {
    dimensions: { width: null, height: null, depth: null, unit: 'mm' },
    primaryMaterial: null,
    secondaryMaterials: [],
    edgeBanding: null,
    hardware: [],
    finish: null,
    constructionMethod: 'frameless',
    joineryTypes: [],
    awiGrade: 'custom',
    specialRequirements: [],
  };

  return (
    <ParametersEditor
      parameters={existingParams}
      onSave={handleSaveParameters}
      isReadOnly={false}
    />
  );
}

interface AITabProps {
  item: DesignItem;
  projectId: string;
  itemId: string;
  userId?: string;
}

function AITab({ item, projectId, itemId, userId }: AITabProps) {
  const [activeAITool, setActiveAITool] = useState<'enhance' | 'dfm' | 'image' | 'chat'>('enhance');
  const { context: _context, changesDetected, hasChangesFor: _hasChangesFor, recordOutput, acknowledgeChanges } = useAIContext(item, projectId);

  const handleIssuesFound = (issues: DfMIssue[]) => {
    console.log('DfM issues found:', issues);
  };

  const LoadingFallback = () => (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1d1d1f] mx-auto"></div>
        <p className="mt-3 text-sm text-gray-500">Loading AI tools...</p>
      </div>
    </div>
  );

  return (
    <AIErrorBoundary
      fallback={
        <div className="text-center py-8 px-4">
          <div className="text-4xl mb-3">⚠️</div>
          <h3 className="text-lg font-medium text-gray-900">AI Features Unavailable</h3>
          <p className="text-gray-500 mt-1 text-sm">
            There was an error loading the AI features. Please try refreshing the page.
          </p>
        </div>
      }
    >
      <div className="space-y-6">
        {/* AI Tool Selector */}
        <div className="flex flex-wrap gap-2 border-b pb-4">
          <button
            onClick={() => setActiveAITool('enhance')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              activeAITool === 'enhance'
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            ✨ AI Enhancement
          </button>
          <button
            onClick={() => setActiveAITool('dfm')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              activeAITool === 'dfm'
                ? 'bg-[#1d1d1f] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            🔧 DfM Check
          </button>
          <button
            onClick={() => setActiveAITool('image')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              activeAITool === 'image'
                ? 'bg-[#1d1d1f] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            🖼️ Image Analysis
          </button>
          <button
            onClick={() => setActiveAITool('chat')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              activeAITool === 'chat'
                ? 'bg-[#1d1d1f] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            💬 Design Chat
          </button>
        </div>

        {/* Change Detection Banner */}
        {changesDetected.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-amber-500 text-lg">⚠️</span>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-amber-800">Data has changed since last AI analysis</h4>
                <p className="text-xs text-amber-700 mt-1">
                  The following sections have been updated: {changesDetected.join(', ')}.
                  Re-run AI tools to get updated insights.
                </p>
              </div>
              <button
                onClick={acknowledgeChanges}
                className="text-xs text-amber-600 hover:text-amber-800 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Active Tool with Suspense */}
        <Suspense fallback={<LoadingFallback />}>
          {activeAITool === 'dfm' && (
            <DfMChecker
              designItem={item as any}
              onIssuesFound={handleIssuesFound}
              onResolveIssue={(ruleId: string) => console.log('Resolved:', ruleId)}
            />
          )}

          {activeAITool === 'image' && (
            <ImageAnalysisAI
              projectId={projectId}
              onAnalysisComplete={(result) => console.log('Image analysis:', result)}
              onItemSelect={(selectedItem) => console.log('Selected item:', selectedItem)}
            />
          )}

          {activeAITool === 'enhance' && (
            <DesignItemEnhancementAI
              designItem={{
                id: itemId || '',
                name: item?.name || 'Design Item',
                itemType: (item as any)?.itemType,
                sourcingType: (item as any)?.sourcingType,
                quantity: (item as any)?.quantity || 1,
              }}
              projectId={projectId}
              userId={userId}
              companyId={'default'}
              onEnhancementComplete={async (result) => {
                console.log('Enhancement complete:', result);
                await recordOutput('enhance', result, ['overview', 'parameters']);
              }}
            />
          )}

          {activeAITool === 'chat' && (
            <DesignChat
              designItemId={itemId}
              projectId={projectId}
              designItemName={item?.name}
              userId={userId}
            />
          )}
        </Suspense>
      </div>
    </AIErrorBoundary>
  );
}

// Lazy wrapper for ClipGallery to avoid circular deps
function ClipGalleryWrapper({ onLinkClip }: { onLinkClip: (clip: any) => void }) {
  const [ClipGallery, setClipGallery] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    import('@/subsidiaries/finishes/clipper/components').then((mod) => {
      setClipGallery(() => mod.ClipGallery);
    });
  }, []);

  if (!ClipGallery) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1d1d1f]"></div>
      </div>
    );
  }

  return <ClipGallery onLinkClip={onLinkClip} selectable />;
}

// ==========================================
// CONSOLIDATED TAB COMPONENTS
// ==========================================

// Parts & Costing Tab - Combines PartsTab with cost summary drawer trigger
interface PartsCostingTabProps {
  item: NonNullable<ReturnType<typeof useDesignItem>['item']>;
  projectId: string;
  onOpenCostSummary: () => void;
}

function PartsCostingTab({ item, projectId, onOpenCostSummary }: PartsCostingTabProps) {
  const manufacturing = (item as any).manufacturing || {};
  const totalCost = manufacturing.totalCost || 0;
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'decimal', 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Cost Summary Bar */}
      <div className="flex items-center justify-between bg-gradient-to-r from-[#0A7C8E]/10 to-[#0A7C8E]/5 rounded-lg p-4 border border-[#0A7C8E]/20">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-sm text-gray-600">Estimated Cost</p>
            <p className="text-2xl font-bold text-[#0A7C8E]">
              {totalCost > 0 ? `UGX ${formatCurrency(totalCost)}` : 'Not calculated'}
            </p>
          </div>
        </div>
        <DrawerTrigger
          label="View Cost Breakdown"
          onClick={onOpenCostSummary}
          variant="default"
          icon={<Package className="w-4 h-4" />}
        />
      </div>

      {/* Parts List */}
      <PartsTab item={item} projectId={projectId} />
    </div>
  );
}

// Architectural Pricing Tab - For ARCHITECTURAL items
interface ArchitecturalPricingTabWrapperProps {
  item: NonNullable<ReturnType<typeof useDesignItem>['item']>;
  projectId: string;
  userId: string;
}

function ArchitecturalPricingTabWrapper({ item, projectId, userId }: ArchitecturalPricingTabWrapperProps) {
  const { updateDesignItem } = require('../../services/firestore');

  const handleUpdate = async (updates: any) => {
    try {
      await updateDesignItem(projectId, item.id, {
        architectural: {
          ...(item as any).architectural,
          ...updates,
        },
      } as any, userId);
    } catch (error) {
      console.error('Failed to update architectural pricing:', error);
      throw error;
    }
  };

  return (
    <ArchitecturalPricingTab
      item={item}
      projectId={projectId}
      userId={userId}
      onUpdate={handleUpdate}
    />
  );
}

// Files & Approvals Tab - Combines Files, Approvals with History drawer trigger
interface FilesApprovalsTabProps {
  item: NonNullable<ReturnType<typeof useDesignItem>['item']>;
  projectId: string;
  onOpenHistory: () => void;
}

function FilesApprovalsTab({ item, projectId, onOpenHistory }: FilesApprovalsTabProps) {
  const { user } = useAuth();
  const { project } = useProject(projectId);
  const [activeSection, setActiveSection] = useState<'files' | 'approvals'>('files');

  const handleRequestApproval = async (approval: any) => {
    if (!user?.email) {
      alert('You must be logged in to request approvals');
      return;
    }
    
    try {
      await createApproval(
        projectId,
        item.id,
        {
          type: approval.type,
          assignedTo: approval.assignedTo,
          notes: approval.notes,
        },
        user.email
      );
    } catch (error) {
      console.error('Failed to create approval:', error);
      alert('Failed to create approval request');
    }
  };
  
  const handleRespondToApproval = async (approvalId: string, status: 'approved' | 'rejected', notes?: string) => {
    if (!user?.email) {
      alert('You must be logged in to respond to approvals');
      return;
    }
    
    try {
      await respondToApprovalFirestore(
        projectId,
        item.id,
        approvalId,
        status,
        notes || '',
        user.email
      );
    } catch (error) {
      console.error('Failed to respond to approval:', error);
      alert('Failed to respond to approval');
    }
  };

  return (
    <div className="space-y-4">
      {/* Section Toggle + History Trigger */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSection('files')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              activeSection === 'files'
                ? 'bg-[#1d1d1f] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            Files & Deliverables
          </button>
          <button
            onClick={() => setActiveSection('approvals')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              activeSection === 'approvals'
                ? 'bg-[#1d1d1f] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            Approvals ({item.approvals.length})
          </button>
        </div>
        <DrawerTrigger
          label="Stage History"
          onClick={onOpenHistory}
          variant="compact"
          badge={item.stageHistory.length}
        />
      </div>

      {/* Content */}
      {activeSection === 'files' && (
        <div className="space-y-4">
          <UnifiedFileManager
            projectId={projectId}
            projectCode={project?.code}
            itemId={item.id}
            itemName={item.name}
            userId={user?.uid || user?.email || ''}
            module="design-manager"
            showBulkActions
          />
          {/* Phase 3b — item-scoped revision request inbox + timeline.
              Gives the designer a single place to see client feedback
              and the full history of file uploads in context. */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <RevisionRequestsPanel projectId={projectId} itemId={item.id} />
            <ItemRevisionTimeline projectId={projectId} itemId={item.id} />
          </div>
        </div>
      )}

      {activeSection === 'approvals' && (
        <ApprovalWorkflow
          designItem={item}
          projectId={projectId}
          approvals={item.approvals}
          onRequestApproval={handleRequestApproval}
          onRespondToApproval={handleRespondToApproval}
        />
      )}
    </div>
  );
}

// ==========================================
// DRAWER CONTENT COMPONENTS
// ==========================================

// Inspiration Drawer Content
function InspirationDrawerContent({ 
  item, 
  projectId, 
  itemId 
}: { 
  item: DesignItem; 
  projectId: string; 
  itemId: string;
}) {
  const [showGallery, setShowGallery] = useState(false);
  const [InspirationPanelComponent, setInspirationPanelComponent] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    import('./InspirationPanel').then((mod) => {
      setInspirationPanelComponent(() => mod.InspirationPanel);
    });
  }, []);

  const handleLinkClip = async (clip: any) => {
    try {
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('@/shared/services/firebase');
      
      const clipRef = doc(db, 'designClips', clip.id);
      await updateDoc(clipRef, {
        projectId,
        designItemId: itemId,
        updatedAt: serverTimestamp(),
      });
      
      setShowGallery(false);
    } catch (error) {
      console.error('Failed to link clip:', error);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowGallery(true)}
        className="w-full px-4 py-2 bg-[#1d1d1f] text-white rounded-lg text-sm font-medium hover:bg-[#424245]"
      >
        + Link New Clip
      </button>

      {InspirationPanelComponent ? (
        <InspirationPanelComponent
          designItemId={itemId}
          projectId={projectId}
          designItemName={item.name}
          onOpenGallery={() => setShowGallery(true)}
        />
      ) : (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1d1d1f]"></div>
        </div>
      )}

      {showGallery && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Select Inspiration Clip</h3>
              <button onClick={() => setShowGallery(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1d1d1f]"></div></div>}>
                <ClipGalleryWrapper onLinkClip={handleLinkClip} />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Cost Summary Drawer Content
function CostSummaryDrawerContent({ item }: { item: NonNullable<ReturnType<typeof useDesignItem>['item']> }) {
  const manufacturing = (item as any).manufacturing || {};
  const sheetMaterials = manufacturing.sheetMaterials || [];
  const timberMaterials = manufacturing.timberMaterials || [];
  const linearMaterials = manufacturing.linearMaterials || [];
  const edgingMaterials = manufacturing.edgingMaterials || [];
  const standardParts = manufacturing.standardParts || [];
  const specialParts = manufacturing.specialParts || [];

  const sheetMaterialsCost = manufacturing.sheetMaterialsCost || 0;
  const timberMaterialsCost = manufacturing.timberMaterialsCost || 0;
  const linearMaterialsCost = manufacturing.linearMaterialsCost || 0;
  const edgingMaterialsCost = manufacturing.edgingMaterialsCost || 0;
  const processingSteps = manufacturing.processingSteps || [];
  const processingCost = manufacturing.processingCost || 0;
  const standardPartsCost = manufacturing.standardPartsCost || 0;
  const specialPartsCost = manufacturing.specialPartsCost || 0;
  const laborHours = manufacturing.laborHours || 0;
  const laborRate = manufacturing.laborRate || 15000;
  const laborCost = laborHours * laborRate;
  const totalCost = manufacturing.totalCost || 0;
  const quantity = manufacturing.quantity || 1;
  const costPerUnit = quantity > 0 ? totalCost / quantity : totalCost;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'decimal', 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount);
  };

  if ((item as any).sourcingType === 'PROCURED') {
    return (
      <div className="text-center py-8">
        <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900">Procured Item</h3>
        <p className="text-gray-500 mt-1">Costing managed externally.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sheet Materials */}
      {(sheetMaterials.length > 0 || (timberMaterials.length === 0 && linearMaterials.length === 0)) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 mb-2">Sheet Materials</h4>
          {sheetMaterials.length > 0 ? (
            <div className="space-y-2">
              {sheetMaterials.map((mat: any, idx: number) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{mat.materialName} ({mat.thickness}mm) — {mat.totalArea?.toFixed(2)} m²</span>
                  <span className="font-medium">UGX {formatCurrency(mat.totalCost)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-blue-300 flex justify-between font-semibold">
                <span>Subtotal</span>
                <span>UGX {formatCurrency(sheetMaterialsCost)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-blue-600">Not calculated</p>
          )}
        </div>
      )}

      {/* Timber Materials (volumetric m³) */}
      {timberMaterials.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-semibold text-amber-800 mb-2">Timber Materials</h4>
          <div className="space-y-2">
            {timberMaterials.map((mat: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm">
                <span>
                  {mat.materialName} ({mat.crossSection?.thickness}×{mat.crossSection?.width}mm)
                  {' — '}
                  {`${mat.totalVolumeCubicMeters} m\u00B3 (${mat.totalLinearMeters} m)`}
                </span>
                <span className="font-medium">UGX {formatCurrency(mat.totalCost)}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-amber-300 flex justify-between font-semibold">
              <span>Subtotal</span>
              <span>UGX {formatCurrency(timberMaterialsCost)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Linear Stock (linear meters) */}
      {linearMaterials.length > 0 && (
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
          <h4 className="font-semibold text-sky-800 mb-2">Linear Stock</h4>
          <div className="space-y-2">
            {linearMaterials.map((mat: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm">
                <span>{mat.materialName} ({mat.profile}) — {mat.totalLinearMeters} m</span>
                <span className="font-medium">UGX {formatCurrency(mat.totalCost)}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-sky-300 flex justify-between font-semibold">
              <span>Subtotal</span>
              <span>UGX {formatCurrency(linearMaterialsCost)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Edging Materials (linear meters) */}
      {edgingMaterials.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
          <h4 className="font-semibold text-rose-800 mb-2">Edging Materials</h4>
          <div className="space-y-2">
            {edgingMaterials.map((mat: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm">
                <span>{mat.materialName} — {mat.totalLinearMeters} m</span>
                <span className="font-medium">UGX {formatCurrency(mat.totalCost)}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-rose-300 flex justify-between font-semibold">
              <span>Subtotal</span>
              <span>UGX {formatCurrency(edgingMaterialsCost)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Standard Parts */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <h4 className="font-semibold text-orange-800 mb-2">Standard Parts ({standardParts.length})</h4>
        <div className="flex justify-between font-semibold">
          <span>Subtotal</span>
          <span>UGX {formatCurrency(standardPartsCost)}</span>
        </div>
      </div>

      {/* Special Parts */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h4 className="font-semibold text-purple-800 mb-2">Special Parts ({specialParts.length})</h4>
        <div className="flex justify-between font-semibold">
          <span>Subtotal</span>
          <span>UGX {formatCurrency(specialPartsCost)}</span>
        </div>
      </div>

      {/* Processing Costs */}
      {processingSteps.length > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
          <h4 className="font-semibold text-teal-800 mb-2">Material Processing</h4>
          <div className="space-y-2">
            {processingSteps.map((step: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm">
                <span>{step.label} — {step.quantity} {step.unit}</span>
                <span className="font-medium">UGX {formatCurrency(step.totalCost)}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-teal-300 flex justify-between font-semibold">
              <span>Subtotal</span>
              <span>UGX {formatCurrency(processingCost)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Labor */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-semibold text-green-800 mb-2">Labor</h4>
        <div className="text-sm text-green-700 mb-1">
          {laborHours} hours @ UGX {formatCurrency(laborRate)}/hr
        </div>
        <div className="flex justify-between font-semibold">
          <span>Subtotal</span>
          <span>UGX {formatCurrency(laborCost)}</span>
        </div>
      </div>

      {/* Total */}
      <div className="bg-gradient-to-r from-[#0A7C8E] to-[#0A7C8E]/80 rounded-lg p-4 text-white">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="font-semibold">Total Cost</h4>
            {quantity > 1 && (
              <p className="text-sm text-white/80">UGX {formatCurrency(costPerUnit)} per unit × {quantity}</p>
            )}
          </div>
          <p className="text-2xl font-bold">UGX {formatCurrency(totalCost)}</p>
        </div>
      </div>
    </div>
  );
}

// History Drawer Content
function HistoryDrawerContent({ item }: { item: NonNullable<ReturnType<typeof useDesignItem>['item']> }) {
  if (item.stageHistory.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No stage transitions yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {item.stageHistory.map((transition, index) => (
        <div key={index} className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0">
          <div className="w-2 h-2 bg-[#1d1d1f] rounded-full mt-2 flex-shrink-0" />
          <div>
            <p className="font-medium text-gray-900">
              {transition.fromStage} → {transition.toStage}
            </p>
            <p className="text-sm text-gray-500">
              {formatDateTime(transition.transitionedAt)} by {transition.transitionedBy}
            </p>
            {transition.notes && (
              <p className="text-sm text-gray-600 mt-1 bg-gray-50 p-2 rounded">{transition.notes}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

