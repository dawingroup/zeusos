/**
 * Material Calculator View
 * Main container for Materials tab - calculate material requirements from BOQ items
 */

import { useState, useMemo } from 'react';
import { Calculator, List, BarChart3, Beaker, Sparkles, RefreshCw, Loader2, Database, Ban, X, FileDown } from 'lucide-react';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import { exportMaterialsWorkbook } from '../../services/materialsWorkbookExport';
import type { BOQItem } from '../../types';
import { MaterialRequirementsTable } from './MaterialRequirementsTable';
import { MaterialAggregationView } from './MaterialAggregationView';
import { FormulaApplicationPanel } from './FormulaApplicationPanel';
import { FormulaAssistantPanel } from './FormulaAssistantPanel';
import { FormulaDetailDrawer } from './FormulaDetailDrawer';
import { BOQItemEditDrawer } from './BOQItemEditDrawer';
import { CustomMaterialBuilder } from './CustomMaterialBuilder';
import { updateBOQItemMaterials, updateBOQItem } from '../../services/boqService';
import { calculateMaterials } from '../../services/materialCalculator';
import { seedStandardFormulas } from '../../services/formulaService';
import { BulkFormulaRunner } from '@/subsidiaries/advisory/delivery/components/projects/BulkFormulaRunner';
import { useAuth } from '@/core/hooks/useAuth';
import { deleteField } from 'firebase/firestore';

interface MaterialCalculatorViewProps {
  projectId: string;
  items: BOQItem[];
  onItemsUpdate: () => void;
}

type CalcViewMode = 'items' | 'aggregation';
type FormulaFilter = 'all' | 'applied' | 'not_applied' | 'custom' | 'bulk' | 'excluded';

export function MaterialCalculatorView({ projectId, items, onItemsUpdate }: MaterialCalculatorViewProps) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || 'default';

  const [viewMode, setViewMode] = useState<CalcViewMode>('items');
  const [formulaFilter, setFormulaFilter] = useState<FormulaFilter>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [aiAssistantItem, setAIAssistantItem] = useState<BOQItem | null>(null);
  const [customModalItem, setCustomModalItem] = useState<BOQItem | null>(null);
  const [detailDrawerItem, setDetailDrawerItem] = useState<BOQItem | null>(null);
  const [editDrawerItem, setEditDrawerItem] = useState<BOQItem | null>(null);
  const [isBulkRunnerOpen, setIsBulkRunnerOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<{ updated: number; errors: number } | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ created: number; skipped: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Helper: Check if item is marked as bulk purchase
  const isBulkItem = (item: BOQItem) => {
    return item.isBulkItem === true;
  };

  // Build hierarchical items — always include all levels for context
  const filteredItems = useMemo(() => {
    // Sort items by hierarchyPath to maintain order
    const sorted = [...items].sort((a, b) => {
      const pathA = a.hierarchyPath || a.itemNumber || '';
      const pathB = b.hierarchyPath || b.itemNumber || '';
      return pathA.localeCompare(pathB, undefined, { numeric: true });
    });

    if (formulaFilter === 'all') {
      return sorted; // Show ALL items including headers
    }

    // For specific filters, find matching level 3+ items then include their parent headers
    let matchingItems: Set<string> = new Set();
    const level3Plus = sorted.filter(item => (item.hierarchyLevel ?? 99) >= 3);

    switch (formulaFilter) {
      case 'applied':
        level3Plus.filter(item => item.formulaId && item.materialRequirements && item.materialRequirements.length > 0)
          .forEach(item => matchingItems.add(item.id));
        break;
      case 'not_applied':
        level3Plus.filter(item => {
          const hasNoBreakdown = !item.formulaId && (!item.materialRequirements || item.materialRequirements.length === 0);
          return hasNoBreakdown && !isBulkItem(item) && !item.noFormulaRequired;
        }).forEach(item => matchingItems.add(item.id));
        break;
      case 'custom':
        level3Plus.filter(item => !item.formulaId && item.materialRequirements && item.materialRequirements.length > 0)
          .forEach(item => matchingItems.add(item.id));
        break;
      case 'bulk':
        level3Plus.filter(item => isBulkItem(item))
          .forEach(item => matchingItems.add(item.id));
        break;
      case 'excluded':
        level3Plus.filter(item => item.noFormulaRequired === true)
          .forEach(item => matchingItems.add(item.id));
        break;
    }

    if (matchingItems.size === 0) return [];

    // Include parent headers (levels 1-2) that contain matching items
    // by matching the hierarchyPath prefix
    const matchingPaths = sorted
      .filter(item => matchingItems.has(item.id))
      .map(item => item.hierarchyPath || item.itemNumber || '');

    return sorted.filter(item => {
      if (matchingItems.has(item.id)) return true;
      const level = item.hierarchyLevel ?? 99;
      if (level <= 3) {
        // Include header/section if any matching child starts with this path
        const headerPath = item.hierarchyPath || item.itemNumber || '';
        return matchingPaths.some(p => p.startsWith(headerPath));
      }
      return false;
    });
  }, [items, formulaFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const materialItems = items.filter(item => item.hierarchyLevel && item.hierarchyLevel >= 3);
    const itemsWithFormulas = materialItems.filter(item => item.formulaId && item.materialRequirements && item.materialRequirements.length > 0);
    const customMaterials = materialItems.filter(item => !item.formulaId && item.materialRequirements && item.materialRequirements.length > 0);
    const bulkItems = materialItems.filter(item => isBulkItem(item));
    const excludedItems = materialItems.filter(item => item.noFormulaRequired === true);

    // Items needing formulas (exclude bulk and excluded items)
    const itemsNeedingFormulas = materialItems.filter(item => {
      const hasNoBreakdown = !item.formulaId && (!item.materialRequirements || item.materialRequirements.length === 0);
      return hasNoBreakdown && !isBulkItem(item) && !item.noFormulaRequired;
    });

    // Count unique materials
    const uniqueMaterials = new Set<string>();
    materialItems.forEach(item => {
      if (item.materialRequirements) {
        item.materialRequirements.forEach((req: any) => {
          if (req.materialId) uniqueMaterials.add(req.materialId);
        });
      }
    });

    const totalMaterialCost = materialItems.reduce((sum, item) =>
      sum + (item.materialRequirements ?? []).reduce((s: number, r: any) => s + (r.totalCost ?? 0), 0), 0);
    const totalLabourCost = materialItems.reduce((sum, item) =>
      sum + ((item.quantityContract ?? item.quantity ?? 0) * (item.laborRate ?? 0)), 0);
    const totalEquipmentCost = materialItems.reduce((sum, item) =>
      sum + ((item.quantityContract ?? item.quantity ?? 0) * (item.equipmentRate ?? 0)), 0);

    return {
      totalItems: materialItems.length,
      itemsWithFormulas: itemsWithFormulas.length,
      itemsNeedingFormulas: itemsNeedingFormulas.length,
      customMaterials: customMaterials.length,
      bulkItems: bulkItems.length,
      excludedItems: excludedItems.length,
      uniqueMaterials: uniqueMaterials.size,
      totalMaterialCost,
      totalLabourCost,
      totalEquipmentCost,
      grandTotal: totalMaterialCost + totalLabourCost + totalEquipmentCost,
    };
  }, [items]);

  // Get selected BOQ items
  const selectedBoqItems = useMemo(() => {
    return items.filter(item => selectedItems.has(item.id));
  }, [items, selectedItems]);

  // Handlers
  const handleApplyFormula = (itemIds: string[]) => {
    setSelectedItems(new Set(itemIds));
    setIsFormulaModalOpen(true);
  };

  const handleAIAssistant = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      setAIAssistantItem(item);
      setIsAIAssistantOpen(true);
    }
  };

  const handleViewDetails = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) setDetailDrawerItem(item);
  };

  const handleDetailSave = async (itemId: string, materials: any[]) => {
    if (!user) return;
    await updateBOQItemMaterials(orgId, projectId, itemId, user.uid, materials);
    onItemsUpdate();
  };

  const handleEditItem = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) setEditDrawerItem(item);
  };

  const handleEditItemSave = async (itemId: string, updates: Partial<BOQItem>) => {
    if (!user) return;
    await updateBOQItem(orgId, projectId, itemId, user.uid, updates);
    onItemsUpdate();
  };

  const handleCustomMaterials = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      setCustomModalItem(item);
      setIsCustomModalOpen(true);
    }
  };

  const handleClearMaterials = async (itemId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to clear the material requirements for this item?')) return;

    try {
      await updateBOQItemMaterials(orgId, projectId, itemId, user.uid, [], undefined, undefined);
      onItemsUpdate();
    } catch (error) {
      console.error('Error clearing materials:', error);
      alert('Failed to clear materials. Please try again.');
    }
  };

  const handleConvertToBulk = async (itemId: string) => {
    if (!user) return;

    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const confirmMessage = `Mark "${item.description}" as bulk purchase?\n\nThe BOQ item description IS the material that will be purchased. The item will be sent to the supplier as-is with the quantities from the BOQ.\n\nThe supplier will be responsible for providing any material breakdown if needed.`;

    if (!confirm(confirmMessage)) return;

    try {
      // Mark as bulk item and clear formula/materials
      await updateBOQItem(orgId, projectId, itemId, user.uid, {
        isBulkItem: true,
        formulaId: deleteField() as any,
        formulaCode: deleteField() as any,
        materialRequirements: [],
      });
      onItemsUpdate();
    } catch (error) {
      console.error('Error converting to bulk:', error);
      alert('Failed to convert to bulk. Please try again.');
    }
  };

  const handleUnmarkBulk = async (itemId: string) => {
    if (!user) return;

    try {
      await updateBOQItem(orgId, projectId, itemId, user.uid, {
        isBulkItem: false,
      });
      onItemsUpdate();
    } catch (error) {
      console.error('Error unmarking bulk:', error);
      alert('Failed to unmark bulk. Please try again.');
    }
  };

  const handleFormulaApply = async (formulaId: string, formulaCode: string, wastageOverride?: number) => {
    if (!user) return;

    try {
      for (const itemId of selectedItems) {
        const item = items.find(i => i.id === itemId);
        if (!item) continue;

        // Calculate requirements using the formula
        const result = await calculateMaterials(
          { ...item, formulaId, formulaCode },
          { rateSource: 'standard', ...(wastageOverride != null ? { wastageOverride } : {}) }
        );

        const requirements = result.success ? result.requirements : [];

        await updateBOQItemMaterials(
          orgId,
          projectId,
          itemId,
          user.uid,
          requirements,
          formulaId,
          formulaCode
        );
      }
      setSelectedItems(new Set());
      onItemsUpdate();
    } catch (error) {
      console.error('Error applying formula:', error);
      throw error;
    }
  };

  const handleRefreshEstimates = async () => {
    if (!user) return;
    setIsRefreshing(true);
    setRefreshResult(null);

    // Find items with formulas that can be recalculated
    const itemsWithFormulas = items.filter(
      item => (item.formulaId || item.formulaCode) && !item.isBulkItem
    );

    let updated = 0;
    let errors = 0;

    for (const item of itemsWithFormulas) {
      try {
        const result = await calculateMaterials(item, { rateSource: 'standard' });
        if (result.success && result.requirements.length > 0) {
          await updateBOQItemMaterials(
            orgId,
            projectId,
            item.id,
            user.uid,
            result.requirements,
            item.formulaId,
            item.formulaCode,
          );
          updated++;
        }
      } catch (err) {
        console.error(`Error refreshing item ${item.id}:`, err);
        errors++;
      }
    }

    setRefreshResult({ updated, errors });
    setIsRefreshing(false);
    onItemsUpdate();

    // Clear result message after 5 seconds
    setTimeout(() => setRefreshResult(null), 5000);
  };

  const handleMarkNoFormula = async (itemId: string) => {
    if (!user) return;
    try {
      await updateBOQItem(orgId, projectId, itemId, user.uid, {
        noFormulaRequired: true,
        formulaId: deleteField() as any,
        formulaCode: deleteField() as any,
        materialRequirements: [],
      });
      onItemsUpdate();
    } catch (error) {
      console.error('Error marking item:', error);
      alert('Failed to mark item. Please try again.');
    }
  };

  const handleUnmarkNoFormula = async (itemId: string) => {
    if (!user) return;
    try {
      await updateBOQItem(orgId, projectId, itemId, user.uid, {
        noFormulaRequired: false,
      });
      onItemsUpdate();
    } catch (error) {
      console.error('Error unmarking item:', error);
      alert('Failed to unmark item. Please try again.');
    }
  };

  const handleExportWorkbook = async () => {
    setIsExporting(true);
    try {
      const blob = await exportMaterialsWorkbook(items, { name: projectId });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Materials_${projectId}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleBulkMarkNoFormula = async () => {
    if (!user || selectedItems.size === 0) return;
    for (const itemId of selectedItems) {
      await handleMarkNoFormula(itemId);
    }
    setSelectedItems(new Set());
  };

  const handleSeedFormulas = async () => {
    if (!user) return;
    setIsSeeding(true);
    setSeedResult(null);
    try {
      const result = await seedStandardFormulas(user.uid);
      setSeedResult(result);
      setTimeout(() => setSeedResult(null), 8000);
    } catch (err) {
      console.error('Error seeding formulas:', err);
      alert('Failed to seed standard formulas. Please try again.');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleCustomMaterialsSave = async (materials: any[]) => {
    if (!user || !customModalItem) return;

    const materialRequirements = materials.map(m => ({
      materialId: m.materialId,
      materialName: m.materialName,
      quantity: m.quantity,
      unit: m.unit,
      wastagePercent: m.wastagePercent,
      unitRate: 0, // TODO: Get from material library
      totalCost: 0,
    }));

    try {
      await updateBOQItemMaterials(
        orgId,
        projectId,
        customModalItem.id,
        user.uid,
        materialRequirements,
        undefined,
        undefined
      );
      onItemsUpdate();
    } catch (error) {
      console.error('Error saving custom materials:', error);
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-purple-600" />
            Material Calculator
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Calculate material requirements from formulas or build custom lists
          </p>
        </div>

        <div className="flex items-center gap-3">
        {/* AI Formula Assistant Button */}
        {stats.itemsNeedingFormulas > 0 && (
          <button
            onClick={() => {
              // Open AI assistant for the first item needing a formula
              const needsFormula = items.find(item =>
                item.hierarchyLevel && item.hierarchyLevel >= 3 &&
                !item.formulaId && (!item.materialRequirements || item.materialRequirements.length === 0) &&
                !item.isBulkItem
              );
              if (needsFormula) {
                setAIAssistantItem(needsFormula);
                setIsAIAssistantOpen(true);
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            title="Open AI Formula Assistant to match or generate formulas for items"
          >
            <Sparkles className="w-4 h-4" />
            AI Formula Assistant
          </button>
        )}

        {/* Seed Standard Formulas Button */}
        <button
          onClick={handleSeedFormulas}
          disabled={isSeeding}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Load AAQS standard construction formulas into the formula library"
        >
          {isSeeding ? (
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
          ) : (
            <Database className="w-4 h-4 text-indigo-600" />
          )}
          {isSeeding ? 'Seeding...' : 'Load AAQS Formulas'}
        </button>

        {/* Refresh Estimates Button */}
        <button
          onClick={handleRefreshEstimates}
          disabled={isRefreshing || stats.itemsWithFormulas === 0}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Recalculate material quantities and prices for all items with formulas"
        >
          {isRefreshing ? (
            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
          ) : (
            <RefreshCw className="w-4 h-4 text-purple-600" />
          )}
          {isRefreshing ? 'Refreshing...' : 'Refresh Estimates'}
        </button>

        {/* Export Workbook Button */}
        <button
          onClick={handleExportWorkbook}
          disabled={isExporting || stats.grandTotal === 0}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Export a 4-sheet XLSX workbook with materials, labour, equipment and procurement summary"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin text-green-600" />
          ) : (
            <FileDown className="w-4 h-4 text-green-600" />
          )}
          {isExporting ? 'Exporting...' : 'Export Workbook'}
        </button>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
          <button
            onClick={() => setViewMode('items')}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === 'items'
                ? 'bg-purple-100 text-purple-700 font-medium'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <List className="w-4 h-4" />
            Item View
          </button>
          <button
            onClick={() => setViewMode('aggregation')}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === 'aggregation'
                ? 'bg-purple-100 text-purple-700 font-medium'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Aggregation
          </button>
        </div>
        </div>
      </div>

      {/* Seed Result Banner */}
      {seedResult && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-indigo-50 border border-indigo-200 text-indigo-800">
          <Database className="w-4 h-4" />
          Loaded {seedResult.created} standard formula{seedResult.created !== 1 ? 's' : ''} into library
          {seedResult.skipped > 0 && ` (${seedResult.skipped} already existed)`}
        </div>
      )}

      {/* Refresh Result Banner */}
      {refreshResult && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
          refreshResult.errors > 0
            ? 'bg-amber-50 border border-amber-200 text-amber-800'
            : 'bg-green-50 border border-green-200 text-green-800'
        }`}>
          <RefreshCw className="w-4 h-4" />
          Updated {refreshResult.updated} item{refreshResult.updated !== 1 ? 's' : ''} with latest prices
          {refreshResult.errors > 0 && ` (${refreshResult.errors} failed)`}
        </div>
      )}

      {/* Statistics Cards */}
      <KPIGrid cols={5}>
        <KPICard
          label="Total Items"
          value={stats.totalItems}
          delta="Level 3+ items"
        />
        <KPICard
          label="With Formulas"
          value={stats.itemsWithFormulas}
          trend="up"
          delta={`${stats.totalItems > 0 ? Math.round((stats.itemsWithFormulas / stats.totalItems) * 100) : 0}% complete`}
        />
        <KPICard
          label="Need Formulas"
          value={stats.itemsNeedingFormulas}
          trend={stats.itemsNeedingFormulas > 0 ? 'down' : 'flat'}
          delta="Requires breakdown"
        />
        <KPICard
          label="Bulk Items"
          value={stats.bulkItems}
          delta="Sent to supplier"
        />
        <KPICard
          label="Custom Lists"
          value={stats.customMaterials}
          delta="Manual breakdown"
        />
      </KPIGrid>

      {/* Cost Summary Bar */}
      {stats.grandTotal > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-5 py-3 flex flex-wrap gap-6 items-center">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-purple-600 uppercase tracking-wide font-medium">Material Cost</span>
            <span className="text-lg font-bold text-purple-900">
              {new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(stats.totalMaterialCost)}
            </span>
          </div>
          {stats.totalLabourCost > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-purple-600 uppercase tracking-wide font-medium">Labour Cost</span>
              <span className="text-lg font-bold text-purple-900">
                {new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(stats.totalLabourCost)}
              </span>
            </div>
          )}
          {stats.totalEquipmentCost > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-purple-600 uppercase tracking-wide font-medium">Equipment Cost</span>
              <span className="text-lg font-bold text-purple-900">
                {new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(stats.totalEquipmentCost)}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-0.5 ml-auto">
            <span className="text-xs text-purple-600 uppercase tracking-wide font-medium">Grand Total</span>
            <span className="text-xl font-extrabold text-purple-900">
              {new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(stats.grandTotal)}
            </span>
          </div>
        </div>
      )}

      {/* Formula Filter */}
      {viewMode === 'items' && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Filter:</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFormulaFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                formulaFilter === 'all'
                  ? 'bg-purple-100 text-purple-700 font-medium'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All ({stats.totalItems})
            </button>
            <button
              onClick={() => setFormulaFilter('applied')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                formulaFilter === 'applied'
                  ? 'bg-green-100 text-green-700 font-medium'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Applied ({stats.itemsWithFormulas})
            </button>
            <button
              onClick={() => setFormulaFilter('not_applied')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                formulaFilter === 'not_applied'
                  ? 'bg-orange-100 text-orange-700 font-medium'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Not Applied ({stats.itemsNeedingFormulas})
            </button>
            <button
              onClick={() => setFormulaFilter('custom')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                formulaFilter === 'custom'
                  ? 'bg-purple-100 text-purple-700 font-medium'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Custom ({stats.customMaterials})
            </button>
            <button
              onClick={() => setFormulaFilter('bulk')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                formulaFilter === 'bulk'
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Bulk ({stats.bulkItems})
            </button>
            <button
              onClick={() => setFormulaFilter('excluded')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                formulaFilter === 'excluded'
                  ? 'bg-gray-200 text-gray-800 font-medium'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Excluded ({stats.excludedItems})
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {viewMode === 'items' ? (
        <MaterialRequirementsTable
          items={filteredItems}
          selectedItems={selectedItems}
          onSelectionChange={setSelectedItems}
          onApplyFormula={handleApplyFormula}
          onAIAssistant={handleAIAssistant}
          onCustomMaterials={handleCustomMaterials}
          onClearMaterials={handleClearMaterials}
          onConvertToBulk={handleConvertToBulk}
          onUnmarkBulk={handleUnmarkBulk}
          onMarkNoFormula={handleMarkNoFormula}
          onUnmarkNoFormula={handleUnmarkNoFormula}
          onBulkMarkNoFormula={handleBulkMarkNoFormula}
          onViewDetails={handleViewDetails}
          onEditItem={handleEditItem}
        />
      ) : (
        <MaterialAggregationView items={items} />
      )}

      {/* Formula Application Modal */}
      <FormulaApplicationPanel
        isOpen={isFormulaModalOpen}
        onClose={() => {
          setIsFormulaModalOpen(false);
          setSelectedItems(new Set());
        }}
        selectedItems={selectedBoqItems}
        onApply={handleFormulaApply}
      />

      {/* Custom Material Builder Modal */}
      <CustomMaterialBuilder
        isOpen={isCustomModalOpen}
        onClose={() => {
          setIsCustomModalOpen(false);
          setCustomModalItem(null);
        }}
        boqItem={customModalItem}
        onSave={handleCustomMaterialsSave}
      />

      {/* AI Formula Assistant Modal */}
      <FormulaAssistantPanel
        isOpen={isAIAssistantOpen}
        onClose={() => {
          setIsAIAssistantOpen(false);
          setAIAssistantItem(null);
        }}
        boqItem={aiAssistantItem}
        orgId={orgId}
        projectId={projectId}
        onApplied={onItemsUpdate}
      />

      {/* BOQ Item Edit Drawer */}
      <BOQItemEditDrawer
        item={editDrawerItem}
        onClose={() => setEditDrawerItem(null)}
        onSave={handleEditItemSave}
      />

      {/* Formula Detail Drawer */}
      <FormulaDetailDrawer
        item={detailDrawerItem}
        onClose={() => setDetailDrawerItem(null)}
        onSave={handleDetailSave}
      />

      {/* Bulk AI Formula Runner */}
      <BulkFormulaRunner
        open={isBulkRunnerOpen}
        items={selectedBoqItems.filter(i => (i.hierarchyLevel ?? 99) >= 3 && !i.isBulkItem && !i.noFormulaRequired)}
        orgId={orgId}
        projectId={projectId}
        onClose={() => setIsBulkRunnerOpen(false)}
        onComplete={() => {
          setIsBulkRunnerOpen(false);
          setSelectedItems(new Set());
          onItemsUpdate();
        }}
      />

      {/* Floating Bulk Actions Toolbar */}
      {selectedItems.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white rounded-xl shadow-2xl px-6 py-3 flex items-center gap-4">
          <span className="bg-purple-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            {selectedItems.size}
          </span>
          <span className="text-sm text-gray-300">
            item{selectedItems.size !== 1 ? 's' : ''} selected
          </span>
          <div className="w-px h-6 bg-gray-700" />
          <button
            onClick={() => setIsBulkRunnerOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            AI Generate Formulas
          </button>
          <button
            onClick={() => handleApplyFormula(Array.from(selectedItems))}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
          >
            <Beaker className="w-4 h-4" />
            Apply Formula
          </button>
          <button
            onClick={handleBulkMarkNoFormula}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
          >
            <Ban className="w-4 h-4" />
            No Formula Needed
          </button>
          <button
            onClick={() => setSelectedItems(new Set())}
            className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
