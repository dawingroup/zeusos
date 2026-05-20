/**
 * Project View
 * Project detail page with design items, cutlist, estimates, and client quotes
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, LayoutGrid, List, FolderOpen, Calendar, User, Clock,
  CheckCircle, AlertTriangle, Package, Edit2, Scissors, Sparkles, Calculator, Upload,
  X, Library, FileText, MapPin, MessageSquare, ExternalLink, Rocket, Settings2, Factory, Layers,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { CrossModuleEntityTabs } from '@/shared/components/navigation/CrossModuleEntityTabs';
import { ResponsiveTabs } from '@/shared/components/ui/ResponsiveTabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/core/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useProject, useDesignItems, useDesignProjectChangeOrders } from '../../hooks';
import { ProjectDialog } from './ProjectDialog';
import { ProjectScenesPanel } from './ProjectScenesPanel';
import type { DesignStage, DesignCategory } from '../../types';
import { STAGE_LABELS, CATEGORY_LABELS } from '../../utils/formatting';
import { STAGE_ORDER, MANUFACTURING_STAGE_ORDER, PROCUREMENT_STAGE_ORDER, ARCHITECTURAL_STAGE_ORDER, isAtFinalStageForItem } from '../../utils/stage-gate';
import { CONSTRUCTION_STAGES, normalizeSourcingType } from '../../types/deliverables';
import { NewDesignItemDialog } from '../design-item/NewDesignItemDialog';
import { StageKanban } from '../dashboard/StageKanban';
import { DesignItemsTable } from './DesignItemsTable';
import { CutlistTab } from './CutlistTab';
import { EstimateTab } from './EstimateTab';
import { ProductionTab } from './ProductionTab';
import { StrategyCanvas } from '../strategy';
import { BulkImporter } from '../ProjectEstimation/BulkImporter';
import { ProjectInspirationSummary } from './ProjectInspirationSummary';
import { ProjectPartsLibrary } from './ProjectPartsLibrary';
import { runProjectProduction } from '@/shared/services/optimization';
import QuoteManagement from '../client-portal/QuoteManagement';
import ClientPortalManager from '../client-portal/ClientPortalManager';
import { ProjectDocuments } from './ProjectDocuments';
import { ProjectDeliverablesMatrix } from './ProjectDeliverablesMatrix';
import { UnifiedFileManager } from '@/shared/components/file-manager';
import { DeliverableProfileConfigDialog } from './DeliverableProfileConfigDialog';
import { createDesignItem } from '../../services/firestore';
import { markAIAsApplied } from '../../services/documentUpload';
import type { ClientDocument } from '../../types/document.types';
import { PricingWorkflowTracker } from '../workflow';
import { ClientInteractionsTab } from './ClientInteractionsTab';
import { RevisionRequestsPanel } from './RevisionRequestsPanel';
import {
  subscribeToRevisionRequests,
  countOpenRequests,
} from '../../services/revisionRequestService';
import { calculateWorkflowState, type PricingWorkflowState } from '../../services/workflowStateService';
import { batchRecalculateItemCosts } from '../../services/estimateService';
import { ReleaseToProductionDialog } from '@/modules/manufacturing/components/release/ReleaseToProductionDialog';
import ScopeChangeOrderBanner from './ScopeChangeOrderBanner';
import { recordDesignManagerRecent } from '../../services/designManagerRecents';
import { fetchDealIdByLinkedProjectId } from '@/modules/crm/services/crmDealLookup';

type ViewMode = 'kanban' | 'list';
type ProjectTab = 'items' | 'scenes' | 'cutlist' | 'estimate' | 'production' | 'quotes' | 'portal' | 'files' | 'interactions';

export default function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const { project, loading: projectLoading } = useProject(projectId);
  const { context: coContext } = useDesignProjectChangeOrders(project?.linkedSalesOrderId);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [stageFilter, setStageFilter] = useState<DesignStage | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<DesignCategory | 'all'>('all');
  const [showNewItem, setShowNewItem] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [activeTab, setActiveTab] = useState<ProjectTab>('items');
  const [showPartsDrawer, setShowPartsDrawer] = useState(false);
  const [showProjectInfo, setShowProjectInfo] = useState(false);
  const [showReleaseToProduction, setShowReleaseToProduction] = useState(false);
  const [showProfileConfig, setShowProfileConfig] = useState(false);
  const [workflowState, setWorkflowState] = useState<PricingWorkflowState | null>(null);

  // Phase 4b — open-revision-request counter for the Interactions tab
  // badge. Uses the same real-time subscription that powers the
  // RevisionRequestsPanel, so the badge and the panel are always in
  // lockstep. ResponsiveTabs' label is a plain string, so we suffix
  // " (N)" onto the label when there's at least one open request.
  // Must be declared before any conditional early returns to satisfy
  // the Rules of Hooks.
  const [openRevisionRequests, setOpenRevisionRequests] = useState(0);
  useEffect(() => {
    if (!projectId) return;
    const unsub = subscribeToRevisionRequests(projectId, undefined, (rows) => {
      setOpenRevisionRequests(countOpenRequests(rows));
    });
    return unsub;
  }, [projectId]);

  /** Deal may only be linked from CRM (`linkedProjectId`) without `dealId` on the project doc. */
  const [dealIdFromLinkedCrm, setDealIdFromLinkedCrm] = useState<string | null>(null);
  useEffect(() => {
    if (!project?.id) {
      setDealIdFromLinkedCrm(null);
      return;
    }
    const direct = typeof project.dealId === 'string' ? project.dealId.trim() : '';
    if (direct) {
      setDealIdFromLinkedCrm(null);
      return;
    }
    let cancelled = false;
    void fetchDealIdByLinkedProjectId(project.id).then((id) => {
      if (!cancelled) setDealIdFromLinkedCrm(id);
    });
    return () => {
      cancelled = true;
    };
  }, [project?.id, project?.dealId]);

  useEffect(() => {
    if (!project) return;
    recordDesignManagerRecent({ id: project.id, name: project.name, code: project.code });
  }, [project?.id, project?.name, project?.code]);

  const { items, loading: itemsLoading } = useDesignItems(projectId, {
    stage: stageFilter === 'all' ? undefined : stageFilter,
    category: categoryFilter === 'all' ? undefined : categoryFilter,
  });

  // Calculate workflow state for pricing/estimation tracking
  useEffect(() => {
    if (project && items.length > 0) {
      calculateWorkflowState(project as any, items).then(setWorkflowState);
    }
  }, [project, items]);

  const handleApplyAIToProject = useCallback(async (document: ClientDocument) => {
    if (!projectId || !project || !document.aiAnalysisResult?.extractedItems?.length) return;

    const userId = user?.email || '';
    const extractedItems = document.aiAnalysisResult.extractedItems;

    for (const item of extractedItems) {
      await createDesignItem(projectId, {
        name: item.name,
        category: (item.category as any) || 'casework',
        description: item.description || '',
        projectId,
        projectCode: project.code,
      }, userId);
    }

    await markAIAsApplied(projectId, document.id);
    setActiveTab('items');
  }, [projectId, project, user?.email]);

  // Project statistics — single pass over items, memoized on items so we
  // don't re-filter on every keystroke / selection toggle.
  // Declared before the early returns below so hook order is stable across renders.
  const stats = useMemo(() => {
    let inProgress = 0;
    let productionReady = 0;
    let needsAttention = 0;
    let readinessSum = 0;
    for (const i of items) {
      if (isAtFinalStageForItem(i)) productionReady++;
      else inProgress++;
      if (i.overallReadiness < 50 || i.priority === 'urgent') needsAttention++;
      readinessSum += i.overallReadiness;
    }
    return {
      total: items.length,
      inProgress,
      productionReady,
      needsAttention,
      avgReadiness: items.length > 0 ? Math.round(readinessSum / items.length) : 0,
    };
  }, [items]);

  // Bucket items by normalized sourcing type once. The Kanban section
  // previously called `items.filter(normalizeSourcingType(...))` eight times
  // (once for the condition, once for the prop on each of four buckets),
  // burning O(N) work eight times per render.
  const itemsBySourcingType = useMemo(() => {
    const buckets = {
      CUSTOM_FURNITURE_MILLWORK: [] as typeof items,
      PROCURED: [] as typeof items,
      DESIGN_DOCUMENT: [] as typeof items,
      CONSTRUCTION: [] as typeof items,
    };
    for (const item of items) {
      const t = normalizeSourcingType((item as any).sourcingType);
      if (t === 'CUSTOM_FURNITURE_MILLWORK') buckets.CUSTOM_FURNITURE_MILLWORK.push(item);
      else if (t === 'PROCURED') buckets.PROCURED.push(item);
      else if (t === 'DESIGN_DOCUMENT') buckets.DESIGN_DOCUMENT.push(item);
      else if (t === 'CONSTRUCTION') buckets.CONSTRUCTION.push(item);
    }
    return buckets;
  }, [items]);

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A7C8E]"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-medium text-gray-900">Project not found</h2>
        <Link to="/design" className="text-[#0A7C8E] hover:underline mt-2 inline-block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Not set';
    let date: Date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp.seconds !== undefined) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
    'active': { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' },
    'on-hold': { bg: 'bg-amber-100', text: 'text-amber-800', label: 'On Hold' },
    'completed': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Completed' },
    'cancelled': { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
  };

  const statusConfig = STATUS_CONFIG[project.status] || STATUS_CONFIG['active'];

  const projectTabs = [
    { id: 'items' as ProjectTab, label: 'Items', icon: Package },
    { id: 'scenes' as ProjectTab, label: 'Scenes', icon: Layers },
    { id: 'cutlist' as ProjectTab, label: 'Cutlist', icon: Scissors },
    { id: 'estimate' as ProjectTab, label: 'Estimate', icon: Calculator },
    { id: 'production' as ProjectTab, label: 'Production', icon: Scissors },
    { id: 'quotes' as ProjectTab, label: 'Quotes', icon: FileText },
    {
      id: 'interactions' as ProjectTab,
      label:
        openRevisionRequests > 0
          ? `Interactions (${openRevisionRequests})`
          : 'Interactions',
      icon: MessageSquare,
    },
    { id: 'files' as ProjectTab, label: 'Files', icon: FolderOpen },
    { id: 'portal' as ProjectTab, label: 'Portal', icon: Package },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col gap-4">
        {/* Top row — title left, cross-module tabs right (inline) */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Link
              to="/design"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{project.name}</h1>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded hidden sm:inline">
                  {project.code}
                </span>
                <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', statusConfig.bg, statusConfig.text)}>
                  {statusConfig.label}
                </span>
              </div>
              {project.customerName && (
                <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {project.customerName}
                </p>
              )}
            </div>
          </div>
          <CrossModuleEntityTabs
            links={{
              dealId: (typeof project.dealId === 'string' ? project.dealId.trim() : '') || dealIdFromLinkedCrm || undefined,
              designProjectId: project.id,
              salesOrderId: project.linkedSalesOrderId,
              manufacturingOrderId: project.linkedManufacturingOrderIds?.[0],
            }}
            className="w-fit shrink-0 sm:self-center sm:ml-2"
          />
        </div>

        {/* Action buttons - responsive */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowNewItem(true)}
            className="flex items-center gap-2 px-3 py-2 bg-[#0A7C8E] text-white rounded-lg hover:bg-[#086a7a] transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Item</span>
            <span className="sm:hidden">Add</span>
          </button>
          <button
            onClick={() => setShowStrategy(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity text-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">AI Strategy</span>
          </button>
          <Link
            to={`/design/project/${projectId}/pricing`}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <Calculator className="w-4 h-4" />
            <span className="hidden sm:inline">Pricing</span>
          </Link>
          <button
            onClick={() => setShowBulkImport(true)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import</span>
          </button>
          <button
            onClick={() => setShowEditProject(true)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <Edit2 className="w-4 h-4" />
            <span className="hidden sm:inline">Edit</span>
          </button>
          <button
            onClick={() => setShowProjectInfo(true)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Project Info</span>
          </button>
          {project.code && (
            // Open the client-facing portal in a new tab. Staff with a
            // `@dawin.group` email are recognised by the portal as
            // internal viewers and bypass the per-project whitelist
            // (see portalAccessGate.ts), so this works even when the
            // project hasn't been formally opened to a client.
            <a
              href={`/portal/p/${project.code}/dashboard`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              title="Open the client portal for this project in a new tab"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">View client portal</span>
              <span className="sm:hidden">Portal</span>
            </a>
          )}
          <button
            onClick={() => setShowReleaseToProduction(true)}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm"
          >
            <Rocket className="w-4 h-4" />
            <span className="hidden sm:inline">Release to Production</span>
            <span className="sm:hidden">Release</span>
          </button>
        </div>
      </div>

      {/* Compact Stats Bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-2.5 text-sm">
        <div className="flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-gray-500">Items</span>
          <span className="font-semibold text-gray-900">{stats.total}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-gray-500">In Progress</span>
          <span className="font-semibold text-gray-900">{stats.inProgress}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
          <span className="text-gray-500">Ready</span>
          <span className="font-semibold text-gray-900">{stats.productionReady}</span>
        </div>
        {stats.needsAttention > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            <span className="text-gray-500">Attention</span>
            <span className="font-semibold text-red-600">{stats.needsAttention}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0A7C8E] rounded-full"
              style={{ width: `${stats.avgReadiness}%` }}
            />
          </div>
          <span className="font-semibold text-gray-900">{stats.avgReadiness}%</span>
        </div>
        {(project as any).linkedManufacturingOrderIds?.length > 0 && (
          <Link
            to="/manufacturing"
            className="flex items-center gap-1.5 hover:bg-emerald-50 px-2 py-0.5 rounded-md transition-colors"
          >
            <Factory className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-gray-500">MOs</span>
            <span className="font-semibold text-emerald-700">{(project as any).linkedManufacturingOrderIds.length}</span>
          </Link>
        )}
      </div>

      {/* Parts Library Drawer */}
      {showPartsDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/30 transition-opacity"
            onClick={() => setShowPartsDrawer(false)}
          />
          {/* Drawer */}
          <div className="absolute inset-y-0 right-0 w-full max-w-lg bg-white shadow-xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Library className="w-5 h-5 text-[#0A7C8E]" />
                Project Parts Library
              </h2>
              <button
                onClick={() => setShowPartsDrawer(false)}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {projectId && <ProjectPartsLibrary projectId={projectId} />}
            </div>
          </div>
        </div>
      )}

      {/* Scope / Change Order Banner */}
      <ScopeChangeOrderBanner context={coContext} />

      {/* Pricing Workflow Tracker */}
      {workflowState && (
        <PricingWorkflowTracker
          workflowState={workflowState}
          onNavigate={(tab) => setActiveTab(tab as ProjectTab)}
          onBatchRecalculate={async () => {
            if (!projectId || !user?.email) return;
            const result = await batchRecalculateItemCosts(projectId, user.email);
            if (result.errors.length > 0) {
              console.warn('[BatchRecalc] Errors:', result.errors);
            }
            // Refresh workflow state
            if (project && items) {
              const newState = await calculateWorkflowState(project, items);
              setWorkflowState(newState);
            }
          }}
          className="mb-4"
        />
      )}

      {/* Project Tabs - Responsive */}
      <ResponsiveTabs
        tabs={projectTabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as ProjectTab)}
        variant="underline"
      />

      {activeTab === 'items' && (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <div className="flex items-center gap-4">
              {/* Stage Filter */}
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value as DesignStage | 'all')}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
              >
                <option value="all">All Stages</option>
                {STAGE_ORDER.map((stage) => (
                  <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>
                ))}
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as DesignCategory | 'all')}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
              >
                <option value="all">All Categories</option>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>

              <span className="text-sm text-gray-500">
                {items.length} item{items.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* View Toggle */}
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('kanban')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'kanban' ? 'bg-[#0A7C8E] text-white' : 'text-gray-600 hover:bg-gray-100'
                )}
                title="Kanban View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'list' ? 'bg-[#0A7C8E] text-white' : 'text-gray-600 hover:bg-gray-100'
                )}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          {itemsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A7C8E]"></div>
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No design items yet</h3>
              <p className="text-gray-500 mt-1">Create your first design item to get started.</p>
              <button
                onClick={() => setShowNewItem(true)}
                className="mt-4 text-[#0A7C8E] hover:underline"
              >
                Add Design Item
              </button>
            </div>
          ) : viewMode === 'kanban' ? (
            <div className="space-y-8">
              {/* Custom Furniture/Millwork Kanban */}
              {itemsBySourcingType.CUSTOM_FURNITURE_MILLWORK.length > 0 && (
                <StageKanban
                  items={itemsBySourcingType.CUSTOM_FURNITURE_MILLWORK}
                  projectId={projectId!}
                  stageOrder={MANUFACTURING_STAGE_ORDER}
                  title="🏭 Custom Furniture/Millwork"
                />
              )}

              {/* Procurement Kanban */}
              {itemsBySourcingType.PROCURED.length > 0 && (
                <StageKanban
                  items={itemsBySourcingType.PROCURED}
                  projectId={projectId!}
                  stageOrder={PROCUREMENT_STAGE_ORDER}
                  title="📦 Procurement"
                />
              )}

              {/* Design Documents Kanban */}
              {itemsBySourcingType.DESIGN_DOCUMENT.length > 0 && (
                <StageKanban
                  items={itemsBySourcingType.DESIGN_DOCUMENT}
                  projectId={projectId!}
                  stageOrder={ARCHITECTURAL_STAGE_ORDER}
                  title="📐 Design Documents"
                />
              )}

              {/* Construction Kanban */}
              {itemsBySourcingType.CONSTRUCTION.length > 0 && (
                <StageKanban
                  items={itemsBySourcingType.CONSTRUCTION}
                  projectId={projectId!}
                  stageOrder={CONSTRUCTION_STAGES}
                  title="🔨 Construction"
                />
              )}

              {/* Show message if no items */}
              {items.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  No design items yet
                </div>
              )}
            </div>
          ) : (
            // List view - DesignItemsTable handles all filtering internally
            <DesignItemsTable
              items={items}
              projectId={projectId!}
              coItemMap={coContext.itemMap}
              coSalesOrderId={coContext.salesOrderId}
            />
          )}
        </>
      )}

      {activeTab === 'scenes' && projectId && (
        <ProjectScenesPanel projectId={projectId} />
      )}

      {activeTab === 'cutlist' && (
        <CutlistTab project={project} />
      )}

      {activeTab === 'estimate' && (
        <EstimateTab project={project} />
      )}

      {activeTab === 'production' && (
        <ProductionTab 
          project={project} 
          onRefresh={async () => {
            if (projectId && user?.email) {
              await runProjectProduction(projectId, user.email);
            }
          }} 
        />
      )}

      {activeTab === 'quotes' && projectId && (
        <QuoteManagement
          projectId={projectId}
          projectName={project.name}
          customerId={project.customerId}
          customerName={project.customerName}
          customerEmail={(project as any).customerEmail}
        />
      )}

      {activeTab === 'portal' && projectId && (
        <ClientPortalManager
          projectId={projectId}
          projectName={project.name}
          clientName={project.customerName}
          clientEmail={(project as any).customerEmail}
        />
      )}

      {activeTab === 'interactions' && projectId && (
        <div className="space-y-6">
          {/* Phase 3b — F-D3 revision request inbox. Lives next to
              ClientInteractions since revision asks are themselves a
              form of client interaction. */}
          <RevisionRequestsPanel projectId={projectId} />
          <ClientInteractionsTab projectId={projectId} />
        </div>
      )}

      {activeTab === 'files' && projectId && (
        <div className="space-y-8">
          <div className="flex items-center justify-end">
            <button
              onClick={() => setShowProfileConfig(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Configure Requirements
            </button>
          </div>
          <ProjectDeliverablesMatrix
            projectId={projectId}
            items={items}
            userId={user?.email || ''}
            deliverableProfile={project?.deliverableProfile}
          />
          <ProjectDocuments
            projectId={projectId}
            projectCode={project.code}
            userId={user?.email || ''}
            userName={user?.displayName || user?.email || ''}
            onApplyAIToProject={handleApplyAIToProject}
          />

          {/* Unified File Manager — cross-module file browser */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <UnifiedFileManager
              projectId={projectId}
              projectCode={project?.code}
              userId={user?.email || ''}
              userName={user?.displayName || user?.email || ''}
              module="design-manager"
              showBulkActions
            />
          </div>
        </div>
      )}

      {/* New Item Dialog */}
      <NewDesignItemDialog
        open={showNewItem}
        onClose={() => setShowNewItem(false)}
        projectId={projectId!}
        projectCode={project.code}
        userId={user?.email || ''}
      />

      {/* Edit Project Dialog */}
      <ProjectDialog
        open={showEditProject}
        onClose={() => setShowEditProject(false)}
        userId={user?.email || ''}
        project={project}
      />

      {/* Strategy Canvas Drawer */}
      <Sheet open={showStrategy} onOpenChange={setShowStrategy}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-3xl p-0 overflow-y-auto [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Project Strategy</SheetTitle>
            <SheetDescription>AI-powered strategy canvas</SheetDescription>
          </SheetHeader>
          <StrategyCanvas
            projectId={projectId!}
            projectName={project.name}
            projectCode={project.code}
            clientBrief={project.description}
            userId={user?.email || undefined}
            onClose={() => setShowStrategy(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Project Info Drawer */}
      <Sheet open={showProjectInfo} onOpenChange={setShowProjectInfo}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 overflow-y-auto [&>button]:hidden">
          <SheetHeader className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <SheetTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#0A7C8E]" />
              Project Information
            </SheetTitle>
            <SheetDescription className="sr-only">Project details and inspiration</SheetDescription>
          </SheetHeader>
          <div className="divide-y divide-gray-200">
            {/* Project Details */}
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Project Details</h3>
              <div className="grid grid-cols-2 gap-4">
                {project.description && (
                  <div className="col-span-2">
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Description</h4>
                    <p className="text-sm text-gray-900">{project.description}</p>
                  </div>
                )}
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Start Date</h4>
                  <p className="text-sm text-gray-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {formatDate(project.startDate)}
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Due Date</h4>
                  <p className="text-sm text-gray-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {formatDate(project.dueDate)}
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Created</h4>
                  <p className="text-sm text-gray-900">{formatDate(project.createdAt)}</p>
                  <p className="text-xs text-gray-500">by {project.createdBy}</p>
                </div>
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Last Updated</h4>
                  <p className="text-sm text-gray-900">{formatDate(project.updatedAt)}</p>
                  <p className="text-xs text-gray-500">by {project.updatedBy}</p>
                </div>

                {/* Site Location */}
                {project.siteLocation && (project.siteLocation.address || project.siteLocation.city || project.siteLocation.geoLocation?.googleMapsUrl) && (
                  <div className="col-span-2">
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Site Location
                    </h4>
                    <p className="text-sm text-gray-900">
                      {[project.siteLocation.address, project.siteLocation.city, project.siteLocation.country].filter(Boolean).join(', ')}
                    </p>
                    {project.siteLocation.notes && (
                      <p className="text-xs text-gray-500 mt-0.5">{project.siteLocation.notes}</p>
                    )}
                    {project.siteLocation.geoLocation?.googleMapsUrl && (
                      <a
                        href={project.siteLocation.geoLocation.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#0A7C8E] hover:underline mt-0.5 inline-flex items-center gap-1"
                      >
                        Open in Google Maps <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                {/* Delivery Location */}
                {project.deliveryLocation && (project.deliveryLocation.address || project.deliveryLocation.city || project.deliveryLocation.geoLocation?.googleMapsUrl) && (
                  <div className="col-span-2">
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Delivery Location
                    </h4>
                    <p className="text-sm text-gray-900">
                      {[project.deliveryLocation.address, project.deliveryLocation.city, project.deliveryLocation.country].filter(Boolean).join(', ')}
                    </p>
                    {project.deliveryLocation.notes && (
                      <p className="text-xs text-gray-500 mt-0.5">{project.deliveryLocation.notes}</p>
                    )}
                    {project.deliveryLocation.geoLocation?.googleMapsUrl && (
                      <a
                        href={project.deliveryLocation.geoLocation.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#0A7C8E] hover:underline mt-0.5 inline-flex items-center gap-1"
                      >
                        Open in Google Maps <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Inspiration */}
            {projectId && (
              <div className="p-4">
                <ProjectInspirationSummary projectId={projectId} />
              </div>
            )}

            {/* Parts Library */}
            {projectId && (
              <div className="p-4">
                <button
                  onClick={() => { setShowProjectInfo(false); setShowPartsDrawer(true); }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-[#0A7C8E] bg-white border border-[#0A7C8E] rounded-lg hover:bg-[#0A7C8E] hover:text-white transition-colors"
                >
                  <Library className="w-4 h-4" />
                  Parts Library
                </button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Release to Production Dialog */}
      {showReleaseToProduction && (
        <ReleaseToProductionDialog
          open={showReleaseToProduction}
          onClose={() => setShowReleaseToProduction(false)}
          designProjectId={projectId!}
          designItems={items.map(item => ({
            id: item.id,
            name: item.name,
            category: item.category ?? '',
            status: item.currentStage ?? '',
            sourcingType: item.sourcingType,
            requiredQuantity: item.requiredQuantity ?? 1,
          }))}
          userId={user?.uid ?? ''}
        />
      )}

      {/* Bulk Importer */}
      {showBulkImport && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowBulkImport(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">Bulk Import Design Items</h2>
                <button
                  onClick={() => setShowBulkImport(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4">
                <BulkImporter
                  projectId={projectId!}
                  projectCode={project.code}
                  onComplete={() => setShowBulkImport(false)}
                  onCancel={() => setShowBulkImport(false)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deliverable Profile Config */}
      {showProfileConfig && projectId && (
        <DeliverableProfileConfigDialog
          open={showProfileConfig}
          onClose={() => setShowProfileConfig(false)}
          projectId={projectId}
          userId={user?.uid || ''}
          currentProfile={project?.deliverableProfile}
        />
      )}
    </div>
  );
}
