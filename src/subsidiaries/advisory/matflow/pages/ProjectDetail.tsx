/**
 * Project Detail Page
 * Tab-based detail view for MatFlow projects
 */

import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  FileText, 
  ClipboardList, 
  Package, 
  TrendingUp, 
  Receipt,
  FileBarChart,
  Settings,
  Calendar,
  MapPin,
  Building2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  Upload,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw,
  Calculator,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useMatFlowProject, useProjectBOQItems, useProjectDeliveries, useProjectMutations } from '../hooks/useMatFlow';
import { formatCurrency, formatDate } from '../utils/formatters';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import { exportAndDownloadBOQ } from '../services/boqExportService';
import { exportAndDownloadMaterials } from '../services/materialsWorkbookExport';
import { toggleItemSelection, bulkToggleSelection } from '../services/materialForecastService';
import { useAuth } from '@/core/hooks/useAuth';

type Tab = 'overview' | 'boq' | 'deliveries' | 'variance' | 'invoices' | 'reports' | 'settings';

const ProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  
  const { project, isLoading: projectLoading } = useMatFlowProject(projectId || '');
  const { items: boqItems, loading: boqLoading } = useProjectBOQItems(projectId || '');
  const { deliveries, loading: deliveriesLoading } = useProjectDeliveries(projectId || '');
  
  const tabs = [
    { id: 'overview' as Tab, label: 'Overview', icon: FileText },
    { id: 'boq' as Tab, label: 'BOQ Items', icon: ClipboardList },
    { id: 'deliveries' as Tab, label: 'Deliveries', icon: Package },
    { id: 'variance' as Tab, label: 'Variance', icon: TrendingUp },
    { id: 'invoices' as Tab, label: 'Invoices', icon: Receipt },
    { id: 'reports' as Tab, label: 'Reports', icon: FileBarChart },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
  ];

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-medium text-gray-900">Project not found</h2>
          <Link 
            to="/advisory/matflow/projects" 
            className="text-amber-600 hover:underline mt-2 inline-block"
          >
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'on-hold': return 'bg-yellow-100 text-yellow-700';
      case 'completed': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          to="/advisory/matflow/projects"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <span className={cn('text-xs px-2 py-1 rounded-full font-medium', getStatusColor(project.status))}>
              {project.status}
            </span>
          </div>
          
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              {project.customerName || 'No client'}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {project.location?.district || 'No location'}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDate(project.createdAt as unknown as Date)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to={`/advisory/matflow/projects/${projectId}/import`}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            <Upload className="w-4 h-4" />
            Import BOQ
          </Link>
          <button className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium">
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <KPIGrid cols={4}>
        <KPICard label="BOQ Items" value={boqItems?.length || 0} />
        <KPICard label="Deliveries" value={deliveries?.length || 0} />
        <KPICard
          label="Budget Used"
          value={formatCurrency(project.totalActualCost || 0, 'UGX')}
          delta={`of ${formatCurrency(project.totalPlannedCost || 0, 'UGX')}`}
        />
        <KPICard
          label="Variance"
          value={`${((project.totalActualCost || 0) - (project.totalPlannedCost || 0)) >= 0 ? '+' : ''}${formatCurrency((project.totalActualCost || 0) - (project.totalPlannedCost || 0), 'UGX')}`}
          trend={(project.totalActualCost || 0) > (project.totalPlannedCost || 0) ? 'down' : 'up'}
        />
      </KPIGrid>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-amber-600 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200">
        {activeTab === 'overview' && (
          <OverviewTab project={project} boqItems={boqItems || []} deliveries={deliveries || []} />
        )}
        
        {activeTab === 'boq' && (
          <BOQTab 
            projectId={projectId!} 
            items={boqItems || []} 
            loading={boqLoading} 
            projectInfo={project ? {
              name: project.name,
              clientName: project.customerName,
              location: project.location?.district || project.location?.address || '',
              description: project.description,
            } : undefined}
          />
        )}
        
        {activeTab === 'deliveries' && (
          <DeliveriesTab projectId={projectId!} deliveries={deliveries || []} loading={deliveriesLoading} />
        )}
        
        {activeTab === 'variance' && (
          <VarianceTab projectId={projectId!} />
        )}
        
        {activeTab === 'invoices' && (
          <InvoicesTab projectId={projectId!} />
        )}
        
        {activeTab === 'reports' && (
          <ReportsTab projectId={projectId!} project={project} />
        )}
        
        {activeTab === 'settings' && (
          <SettingsTab project={project} projectId={projectId!} />
        )}
      </div>
    </div>
  );
};

// Overview Tab
function OverviewTab({ project, deliveries }: { project: any; boqItems?: any[]; deliveries: any[] }) {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Info */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Project Information</h3>
          <dl className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <dt className="text-gray-500">Client</dt>
              <dd className="font-medium">{project.customerName || '-'}</dd>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <dt className="text-gray-500">Location</dt>
              <dd className="font-medium">{project.location?.district || '-'}</dd>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <dt className="text-gray-500">Created</dt>
              <dd className="font-medium">{formatDate(project.createdAt as unknown as Date)}</dd>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <dt className="text-gray-500">Status</dt>
              <dd className="font-medium">{project.status || '-'}</dd>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <dt className="text-gray-500">BOQ Status</dt>
              <dd className="font-medium">{project.boqStatus || '-'}</dd>
            </div>
          </dl>
        </div>
        
        {/* Recent Activity */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {deliveries.slice(0, 5).map((delivery: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Package className="w-4 h-4 text-amber-600 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {delivery.description || 'Delivery'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(delivery.deliveryDate)} • {delivery.supplierName}
                  </p>
                </div>
              </div>
            ))}
            {deliveries.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Description */}
      {project.description && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
          <p className="text-gray-600">{project.description}</p>
        </div>
      )}
    </div>
  );
}

// BOQ Tab - Hierarchical Display
interface ProjectInfo {
  name: string;
  clientName?: string;
  location?: string;
  description?: string;
}

function BOQTab({ projectId, items, loading, projectInfo }: { projectId: string; items: any[]; loading: boolean; projectInfo?: ProjectInfo }) {
  const { user } = useAuth();
  const [collapsedBills, setCollapsedBills] = React.useState<Set<string>>(new Set());
  const [collapsedElements, setCollapsedElements] = React.useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = React.useState(false);
  const [isExportingMaterials, setIsExportingMaterials] = React.useState(false);
  const [isTogglingSelection, setIsTogglingSelection] = React.useState<string | null>(null);
  
  // Handle item selection toggle
  const handleToggleSelection = async (itemId: string, currentlySelected: boolean) => {
    if (!user) return;
    setIsTogglingSelection(itemId);
    try {
      await toggleItemSelection(itemId, user.uid, !currentlySelected, projectId);
    } catch (err) {
      console.error('Failed to toggle selection:', err);
    } finally {
      setIsTogglingSelection(null);
    }
  };
  
  // Handle bulk selection
  const handleSelectAll = async () => {
    if (!user) return;
    const unselectedIds = items.filter((i: any) => !i.isSelectedForImplementation).map((i: any) => i.id);
    if (unselectedIds.length === 0) return;
    setIsTogglingSelection('bulk');
    try {
      await bulkToggleSelection(unselectedIds, user.uid, true, projectId);
    } catch (err) {
      console.error('Failed to select all:', err);
    } finally {
      setIsTogglingSelection(null);
    }
  };
  
  const handleClearSelection = async () => {
    if (!user) return;
    const selectedIds = items.filter((i: any) => i.isSelectedForImplementation).map((i: any) => i.id);
    if (selectedIds.length === 0) return;
    setIsTogglingSelection('bulk');
    try {
      await bulkToggleSelection(selectedIds, user.uid, false, projectId);
    } catch (err) {
      console.error('Failed to clear selection:', err);
    } finally {
      setIsTogglingSelection(null);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"></div>
      </div>
    );
  }
  
  // Group items by hierarchy: Bill > Element > Section > Items
  type HierarchyMeta = { items: any[]; name?: string };
  type SectionGroup = Record<string, HierarchyMeta>;
  type ElementGroup = Record<string, { sections: SectionGroup; name?: string }>;
  type BillGroup = Record<string, { elements: ElementGroup; name?: string }>;
  
  const groupedItems: BillGroup = {};
  
  for (const item of items) {
    const bill = item.billNumber || 'Uncategorized';
    const element = item.elementCode || 'General';
    const section = item.sectionCode || 'Items';
    
    if (!groupedItems[bill]) {
      groupedItems[bill] = { elements: {}, name: item.billName };
    }
    if (item.billName && !groupedItems[bill].name) {
      groupedItems[bill].name = item.billName;
    }
    
    if (!groupedItems[bill].elements[element]) {
      groupedItems[bill].elements[element] = { sections: {}, name: item.elementName };
    }
    if (item.elementName && !groupedItems[bill].elements[element].name) {
      groupedItems[bill].elements[element].name = item.elementName;
    }
    
    if (!groupedItems[bill].elements[element].sections[section]) {
      groupedItems[bill].elements[element].sections[section] = { items: [], name: item.sectionName };
    }
    if (item.sectionName && !groupedItems[bill].elements[element].sections[section].name) {
      groupedItems[bill].elements[element].sections[section].name = item.sectionName;
    }
    
    groupedItems[bill].elements[element].sections[section].items.push(item);
  }
  
  const toggleBill = (billNumber: string) => {
    const newCollapsed = new Set(collapsedBills);
    if (newCollapsed.has(billNumber)) {
      newCollapsed.delete(billNumber);
    } else {
      newCollapsed.add(billNumber);
    }
    setCollapsedBills(newCollapsed);
  };
  
  const toggleElement = (key: string) => {
    const newCollapsed = new Set(collapsedElements);
    if (newCollapsed.has(key)) {
      newCollapsed.delete(key);
    } else {
      newCollapsed.add(key);
    }
    setCollapsedElements(newCollapsed);
  };
  
  const [isCleaningUp, _setIsCleaningUp] = React.useState(false);
  const [cleanupProgress, _setCleanupProgress] = React.useState<string | null>(null);
  const navigate = useNavigate();
  
  const handleRunCleanup = async () => {
    // Navigate to import page with cleanup mode for existing items
    navigate(`/advisory/matflow/projects/${projectId}/import?mode=cleanup`);
  };
  
  // Stats for the summary bar
  const totalItems = items.length;
  const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const itemsNeedingReview = items.filter((item: any) => item.needsEnhancement).length;
  const uncategorizedCount = items.filter((item: any) => !item.billNumber || item.billNumber === 'Uncategorized').length;
  const selectedCount = items.filter((item: any) => item.isSelectedForImplementation).length;
  
  return (
    <div className="p-4">
      {/* Summary Stats */}
      {items.length > 0 && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-gray-500">Total Items:</span>
              <span className="ml-1 font-medium">{totalItems}</span>
            </div>
            <div>
              <span className="text-gray-500">Total Value:</span>
              <span className="ml-1 font-medium">{formatCurrency(totalAmount, 'UGX')}</span>
            </div>
            {itemsNeedingReview > 0 && (
              <div className="text-yellow-600">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                {itemsNeedingReview} items need review
              </div>
            )}
            {uncategorizedCount > 0 && (
              <div className="text-amber-600">
                <span>{uncategorizedCount} uncategorized</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Selection Controls */}
      {items.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-blue-900">
              Select items for implementation:
            </span>
            <button
              onClick={handleSelectAll}
              disabled={isTogglingSelection === 'bulk'}
              className="text-sm text-blue-700 hover:text-blue-900 underline disabled:opacity-50"
            >
              Select All ({items.length - selectedCount})
            </button>
            <button
              onClick={handleClearSelection}
              disabled={isTogglingSelection === 'bulk' || selectedCount === 0}
              className="text-sm text-blue-700 hover:text-blue-900 underline disabled:opacity-50"
            >
              Clear Selection
            </button>
          </div>
          {isTogglingSelection === 'bulk' && (
            <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
          )}
        </div>
      )}
      
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Bill of Quantities</h3>
          {selectedCount > 0 && (
            <p className="text-sm text-green-600 font-medium">{selectedCount} of {items.length} items selected for implementation</p>
          )}
        </div>
        <div className="flex gap-2">
          {/* Material Forecast Button */}
          <Link
            to={`/advisory/matflow/projects/${projectId}/forecast`}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg",
              selectedCount > 0 
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            )}
          >
            <Calculator className="w-4 h-4" />
            Material Forecast {selectedCount > 0 && `(${selectedCount})`}
          </Link>
          {items.length > 0 && (
            <button 
              onClick={handleRunCleanup}
              disabled={isCleaningUp}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {isCleaningUp ? 'Cleaning...' : 'AI Cleanup'}
            </button>
          )}
          <Link
            to={`/advisory/matflow/projects/${projectId}/import`}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Upload className="w-4 h-4" />
            Import
          </Link>
          <button 
            onClick={async () => {
              if (!projectInfo) return;
              setIsExporting(true);
              try {
                await exportAndDownloadBOQ(items, projectInfo);
              } catch (err) {
                console.error('Export failed:', err);
              } finally {
                setIsExporting(false);
              }
            }}
            disabled={isExporting || items.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Exporting...' : 'Export BOQ'}
          </button>
          <button
            onClick={async () => {
              if (!projectInfo) return;
              setIsExportingMaterials(true);
              try {
                await exportAndDownloadMaterials(items, projectInfo);
              } catch (err) {
                console.error('Materials export failed:', err);
              } finally {
                setIsExportingMaterials(false);
              }
            }}
            disabled={isExportingMaterials || items.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <FileBarChart className="w-4 h-4" />
            {isExportingMaterials ? 'Exporting...' : 'Export Materials'}
          </button>
        </div>
      </div>
      
      {/* Cleanup Progress */}
      {cleanupProgress && (
        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center gap-2 text-purple-700">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">{cleanupProgress}</span>
          </div>
        </div>
      )}
      
      {items.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No BOQ items yet</h3>
          <p className="text-gray-500 mb-4">Import a BOQ spreadsheet or add items manually</p>
          <Link
            to={`/advisory/matflow/projects/${projectId}/import`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            <Upload className="w-4 h-4" />
            Import BOQ
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedItems).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([billNumber, billData]) => {
            const isBillCollapsed = collapsedBills.has(billNumber);
            const billItemCount = Object.values(billData.elements).flatMap(el => Object.values(el.sections).flatMap(s => s.items)).length;
            const billTotal = Object.values(billData.elements).flatMap(el => Object.values(el.sections).flatMap(s => s.items)).reduce((sum, item) => sum + (item.amount || 0), 0);
            
            return (
              <div key={billNumber} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                {/* Bill Header */}
                <button
                  onClick={() => toggleBill(billNumber)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-amber-600 hover:bg-amber-700 text-left"
                >
                  <div className="flex items-center gap-3">
                    {isBillCollapsed ? (
                      <ChevronDown className="w-5 h-5 text-amber-100" />
                    ) : (
                      <ChevronUp className="w-5 h-5 text-amber-100" />
                    )}
                    <div>
                      <div className="font-bold text-white">Bill {billNumber}</div>
                      {billData.name && <div className="text-sm text-amber-100">{billData.name}</div>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-amber-100">{billItemCount} items</div>
                    <div className="text-sm font-medium text-white">{formatCurrency(billTotal, 'UGX')}</div>
                  </div>
                </button>
                
                {/* Bill Content */}
                {!isBillCollapsed && (
                  <div>
                    <div className="divide-y divide-gray-100">
                    {Object.entries(billData.elements).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([elementCode, elementData]) => {
                      const elementKey = `${billNumber}-${elementCode}`;
                      const isElementCollapsed = collapsedElements.has(elementKey);
                      const elementItemCount = Object.values(elementData.sections).flatMap(s => s.items).length;
                      const elementTotal = Object.values(elementData.sections).flatMap(s => s.items).reduce((sum, item) => sum + (item.amount || 0), 0);
                      
                      return (
                        <div key={elementCode} className="bg-white">
                          {/* Element Header */}
                          {elementCode !== 'General' && (
                            <button
                              onClick={() => toggleElement(elementKey)}
                              className="w-full px-4 py-2.5 bg-blue-100 border-b border-blue-200 flex items-center justify-between hover:bg-blue-150"
                            >
                              <div className="flex items-center gap-2">
                                {isElementCollapsed ? (
                                  <ChevronDown className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <ChevronUp className="w-4 h-4 text-blue-600" />
                                )}
                                <span className="font-semibold text-blue-800">Element {billNumber}.{elementCode}</span>
                                {elementData.name && <span className="text-blue-600">- {elementData.name}</span>}
                              </div>
                              <div className="text-right">
                                <span className="text-xs text-blue-500">{elementItemCount} items</span>
                                <span className="text-sm font-medium text-blue-700 ml-3">{formatCurrency(elementTotal, 'UGX')}</span>
                              </div>
                            </button>
                          )}
                          
                          {/* Sections */}
                          {(elementCode === 'General' || !isElementCollapsed) && Object.entries(elementData.sections).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([sectionCode, sectionData]) => (
                            <div key={sectionCode}>
                              {/* Section Header */}
                              {sectionCode !== 'Items' && (
                                <div className="px-6 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                                  <div>
                                    <span className="font-medium text-gray-700">Section {billNumber}.{elementCode}.{sectionCode}</span>
                                    {sectionData.name && <span className="text-gray-500 ml-2">- {sectionData.name}</span>}
                                  </div>
                                  <span className="text-xs text-gray-400">{sectionData.items.length} items</span>
                                </div>
                              )}
                              
                              {/* Work Items */}
                              <div className="divide-y divide-gray-50">
                                {sectionData.items.map((item: any) => (
                                  <div key={item.id} className={cn(
                                    "px-4 py-2 hover:bg-gray-50 flex items-start gap-3",
                                    item.isSelectedForImplementation && "bg-green-50 border-l-4 border-green-500"
                                  )}>
                                    {/* Selection Checkbox */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleSelection(item.id, item.isSelectedForImplementation);
                                      }}
                                      disabled={isTogglingSelection === item.id}
                                      className={cn(
                                        "mt-1 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                                        item.isSelectedForImplementation 
                                          ? "bg-green-500 border-green-500 text-white" 
                                          : "border-gray-300 hover:border-green-400",
                                        isTogglingSelection === item.id && "opacity-50"
                                      )}
                                    >
                                      {item.isSelectedForImplementation && (
                                        <CheckCircle2 className="w-3 h-3" />
                                      )}
                                      {isTogglingSelection === item.id && (
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                      )}
                                    </button>
                                    
                                    <div className="flex-1 flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs font-mono text-gray-400 shrink-0">{item.itemCode || item.hierarchyPath}</span>
                                          {item.isSelectedForImplementation && (
                                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Selected</span>
                                          )}
                                          {item.needsEnhancement && (
                                            <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Needs Review</span>
                                          )}
                                        </div>
                                        <p className="text-sm text-gray-900 mt-0.5">{item.itemName || item.description}</p>
                                        {item.specifications && (
                                          <p className="text-xs text-gray-500 mt-0.5">{item.specifications}</p>
                                        )}
                                      </div>
                                      <div className="text-right shrink-0">
                                        <div className="text-sm font-medium">{formatCurrency(item.amount || 0, 'UGX')}</div>
                                        <div className="text-xs text-gray-500">{item.quantityContract || item.quantity || 0} {item.unit}</div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    </div>
                    
                    {/* Bill Summary - Elements Aggregation */}
                    <div className="px-4 py-3 bg-amber-50 border-t border-amber-200">
                      <div className="text-sm font-medium text-amber-800 mb-2">Bill {billNumber} Summary</div>
                      <div className="space-y-1">
                        {Object.entries(billData.elements).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([elCode, elData]) => {
                          const elTotal = Object.values(elData.sections).flatMap(s => s.items).reduce((sum, item) => sum + (item.amount || 0), 0);
                          return (
                            <div key={elCode} className="flex justify-between text-sm">
                              <span className="text-gray-600">
                                {elCode !== 'General' ? `Element ${billNumber}.${elCode}` : 'General Items'}
                                {elData.name && ` - ${elData.name}`}
                              </span>
                              <span className="font-medium">{formatCurrency(elTotal, 'UGX')}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-2 pt-2 border-t border-amber-200 font-semibold text-amber-900">
                        <span>Bill {billNumber} Total</span>
                        <span>{formatCurrency(billTotal, 'UGX')}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Grand Total Summary */}
          <div className="border border-gray-300 rounded-lg overflow-hidden shadow-md bg-white">
            <div className="px-4 py-3 bg-gray-800 text-white">
              <div className="text-lg font-bold">Grand Summary</div>
            </div>
            <div className="p-4">
              <div className="space-y-2 mb-4">
                {Object.entries(groupedItems).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([billNum, billD]) => {
                  const bTotal = Object.values(billD.elements).flatMap(el => Object.values(el.sections).flatMap(s => s.items)).reduce((sum, item) => sum + (item.amount || 0), 0);
                  const bCount = Object.values(billD.elements).flatMap(el => Object.values(el.sections).flatMap(s => s.items)).length;
                  return (
                    <div key={billNum} className="flex justify-between">
                      <span className="text-gray-700">
                        Bill {billNum}{billD.name && ` - ${billD.name}`}
                        <span className="text-gray-400 text-sm ml-2">({bCount} items)</span>
                      </span>
                      <span className="font-medium">{formatCurrency(bTotal, 'UGX')}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between pt-3 border-t-2 border-gray-300 text-lg font-bold">
                <span>Grand Total</span>
                <span className="text-amber-600">{formatCurrency(totalAmount, 'UGX')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Deliveries Tab
function DeliveriesTab({ deliveries, loading }: { projectId?: string; deliveries: any[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"></div>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Deliveries</h3>
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700">
          <Plus className="w-4 h-4" />
          Log Delivery
        </button>
      </div>
      
      {deliveries.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No deliveries yet</h3>
          <p className="text-gray-500">Log material deliveries to track procurement</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deliveries.map((delivery: any) => (
            <div key={delivery.id} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{delivery.description}</p>
                <p className="text-sm text-gray-500">
                  {delivery.supplierName} • {formatDate(delivery.deliveryDate)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatCurrency(delivery.totalAmount, 'UGX')}</p>
                <p className="text-xs text-gray-500">{delivery.invoiceNumber}</p>
              </div>
              <div>
                {delivery.efrisValidated ? (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    EFRIS
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-yellow-600">
                    <Clock className="w-4 h-4" />
                    Pending
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Variance Tab
function VarianceTab(_props: { projectId?: string }) {
  return (
    <div className="p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Variance Analysis</h3>
      <div className="text-center py-12">
        <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">Variance analysis coming soon</h3>
        <p className="text-gray-500">Track budget vs actual costs by category</p>
      </div>
    </div>
  );
}

// Invoices Tab
function InvoicesTab(_props: { projectId?: string }) {
  return (
    <div className="p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Invoices & Tax Compliance</h3>
      <div className="text-center py-12">
        <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">Invoice tracking coming soon</h3>
        <p className="text-gray-500">Track invoices and EFRIS compliance</p>
      </div>
    </div>
  );
}

// Reports Tab
function ReportsTab(_props: { projectId?: string; project?: any }) {
  return (
    <div className="p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Reports</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { name: 'BOQ Summary', description: 'Complete bill of quantities', icon: ClipboardList },
          { name: 'Procurement Log', description: 'All deliveries and suppliers', icon: Package },
          { name: 'Variance Report', description: 'Budget vs actual analysis', icon: TrendingUp },
          { name: 'Tax Compliance', description: 'EFRIS validation report', icon: Receipt },
          { name: 'Project Overview', description: 'Executive summary', icon: FileBarChart },
        ].map((report) => {
          const Icon = report.icon;
          return (
            <button
              key={report.name}
              className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
            >
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{report.name}</p>
                <p className="text-sm text-gray-500">{report.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Settings Tab
function SettingsTab({ project, projectId }: { project: any; projectId: string }) {
  const navigate = useNavigate();
  const { update, remove, isSubmitting } = useProjectMutations();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: project?.name || '',
    customerName: project?.customerName || '',
    district: project?.location?.district || '',
    address: project?.location?.address || '',
    description: project?.description || '',
    status: project?.status || 'draft',
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Sync form data when project changes
  React.useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        customerName: project.customerName || '',
        district: project.location?.district || '',
        address: project.location?.address || '',
        description: project.description || '',
        status: project.status || 'draft',
      });
    }
  }, [project]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await update(projectId, {
        name: formData.name,
        description: formData.description,
        status: formData.status as any,
        location: {
          district: formData.district,
          address: formData.address,
        },
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save:', err);
      setSaveStatus('error');
    }
  };

  return (
    <div className="p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Project Settings</h3>
      <div className="max-w-2xl space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
          <input
            type="text"
            value={formData.customerName}
            onChange={(e) => handleChange('customerName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
            <input
              type="text"
              value={formData.district}
              onChange={(e) => handleChange('district', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            rows={3}
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="pt-4 flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
          {saveStatus === 'saved' && (
            <span className="text-green-600 text-sm flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-red-600 text-sm">Failed to save</span>
          )}
        </div>

        {/* Danger Zone - Delete Project */}
        <div className="mt-12 pt-6 border-t border-red-200">
          <h4 className="text-red-600 font-semibold mb-2">Danger Zone</h4>
          <p className="text-sm text-gray-600 mb-4">
            Once you delete a project, there is no going back. Please be certain.
          </p>
          
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Project
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700 mb-3">
                Are you sure you want to delete <strong>{project?.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      await remove(projectId);
                      navigate('/advisory/matflow/projects');
                    } catch (err) {
                      console.error('Failed to delete:', err);
                      setIsDeleting(false);
                    }
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>Deleting...</>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Yes, Delete Project
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectDetail;
