/**
 * InventoryHealthDashboard Component
 * Dashboard showing Claude AI audit results for inventory health.
 * Enhanced with:
 * - Issues tab with severity filtering
 * - Duplicates tab for reviewing and merging duplicate groups
 * - Corrections tab for reviewing and applying batch fixes
 * - Agent Instructions tab for configuring audit behaviour
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Package,
  RefreshCw,
  Zap,
  Eye,
  GitMerge,
  Wrench,
  Settings2,
  ClipboardList,
  Tag,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import { ColoredStatsCard } from '@/shared/components/data-display';
import { useInventoryAI } from '../hooks/useInventoryAI';
import { AIEnhancementPanel } from './AIEnhancementPanel';
import { BulkAIEnhanceDialog } from './BulkAIEnhanceDialog';
import { DuplicateResolutionPanel } from './DuplicateResolutionPanel';
import { CorrectionReviewPanel } from './CorrectionReviewPanel';
import { AgentInstructionsEditor } from './AgentInstructionsEditor';
import { getInventoryItem, getActiveGlobalItems, updateInventoryItem } from '../services/inventoryService';
import { DEFAULT_AGENT_INSTRUCTIONS } from '../types/inventoryAI';
import type { InventoryItem, InventoryItemFormData, InventoryListItem } from '../types/inventory';
import type { AuditIssue } from '../types/inventoryAI';

interface InventoryHealthDashboardProps {
  userId: string;
  onViewItem?: (itemId: string) => void;
}

type MainTab = 'issues' | 'duplicates' | 'corrections' | 'instructions';
type FilterTab = 'all' | 'critical' | 'warning' | 'info';

const ISSUE_CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  'incomplete-data': { label: 'Incomplete Data', color: 'bg-gray-100 text-gray-700' },
  'potential-duplicate': { label: 'Potential Duplicate', color: 'bg-purple-100 text-purple-700' },
  'naming-inconsistency': { label: 'Naming', color: 'bg-indigo-100 text-indigo-700' },
  'miscategorized': { label: 'Miscategorised', color: 'bg-orange-100 text-orange-700' },
  'pricing-concern': { label: 'Pricing', color: 'bg-red-100 text-red-700' },
  'low-stock': { label: 'Low Stock', color: 'bg-amber-100 text-amber-700' },
  'stale-data': { label: 'Stale Data', color: 'bg-gray-100 text-gray-600' },
  'orphan-sku': { label: 'Orphan SKU', color: 'bg-yellow-100 text-yellow-700' },
  'unit-mismatch': { label: 'Unit Mismatch', color: 'bg-pink-100 text-pink-700' },
  'phantom-stock': { label: 'Phantom Stock', color: 'bg-rose-100 text-rose-700' },
  'brand-in-title': { label: 'Brand in Title', color: 'bg-teal-100 text-teal-700' },
  'missing-structured-name': { label: 'Missing Structured Name', color: 'bg-cyan-100 text-cyan-700' },
  'family-candidate': { label: 'Family Candidate', color: 'bg-emerald-100 text-emerald-700' },
};

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

function getSeverityIcon(severity: AuditIssue['severity']) {
  switch (severity) {
    case 'critical':
      return <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
    case 'info':
      return <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />;
  }
}

export function InventoryHealthDashboard({
  userId,
  onViewItem,
}: InventoryHealthDashboardProps) {
  const {
    // Audit
    auditResult,
    auditing,
    auditProgress,
    auditError,
    runAudit,
    loadSavedAudit,
    // Duplicate merge
    merging,
    mergeError,
    mergeResult,
    runMerge,
    // Corrections
    corrections,
    applyingCorrections,
    correctionError,
    correctionResult,
    setCorrectionStatus,
    acceptAllCorrections,
    rejectAllCorrections,
    runApplyCorrections,
    // Post-improvement cleanup
    removeIssuesForItems,
    // Agent instructions
    agentInstructions,
    instructionsSaving,
    instructionsError,
    loadInstructions,
    updateInstructions,
    saveInstructions,
  } = useInventoryAI();

  const [mainTab, setMainTab] = useState<MainTab>('issues');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [forceFullAudit, setForceFullAudit] = useState(false);

  // AI Enhancement panel state
  const [enhanceItem, setEnhanceItem] = useState<InventoryItem | null>(null);
  const [enhancePanelOpen, setEnhancePanelOpen] = useState(false);

  // Bulk enhance state
  const [bulkEnhanceOpen, setBulkEnhanceOpen] = useState(false);

  // Reusable item loader — called on mount and after improvements
  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const freshItems = await getActiveGlobalItems();
      setItems(freshItems);
    } catch (err) {
      console.error('Failed to load items for audit:', err);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  // Load inventory items on mount
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Load last audit results on mount
  useEffect(() => {
    loadSavedAudit();
  }, [loadSavedAudit]);

  // Load agent instructions on mount
  useEffect(() => {
    loadInstructions();
  }, [loadInstructions]);

  // Reload items after corrections are successfully applied
  useEffect(() => {
    if (correctionResult && correctionResult.appliedCount > 0) {
      loadItems();
    }
  }, [correctionResult, loadItems]);

  const handleRunAudit = useCallback(() => {
    if (items.length === 0) return;
    runAudit(items, { skipIfAuditedWithinDays: forceFullAudit ? 0 : 7 });
  }, [items, runAudit, forceFullAudit]);

  const handleEnhanceItem = useCallback(async (itemId: string) => {
    try {
      const fullItem = await getInventoryItem(itemId);
      if (fullItem) {
        setEnhanceItem(fullItem);
        setEnhancePanelOpen(true);
      }
    } catch (err) {
      console.error('Failed to load item for enhancement:', err);
    }
  }, []);

  const handleApplyEnhancement = useCallback(
    async (updates: Partial<InventoryItemFormData>) => {
      if (!enhanceItem) return;
      await updateInventoryItem(enhanceItem.id, updates, userId);
      setEnhancePanelOpen(false);
      // Remove stale issues for the enhanced item immediately
      removeIssuesForItems([enhanceItem.id]);
      setEnhanceItem(null);
      // Reload fresh items from Firestore
      await loadItems();
    },
    [enhanceItem, userId, removeIssuesForItems, loadItems]
  );

  const handleSaveInstructions = useCallback(() => {
    saveInstructions(userId);
  }, [saveInstructions, userId]);

  const handleResetInstructions = useCallback(() => {
    updateInstructions(DEFAULT_AGENT_INSTRUCTIONS);
  }, [updateInstructions]);

  // Build the list of unique items flagged in the audit for bulk enhancement
  const itemsWithIssues: InventoryListItem[] = useMemo(() => {
    if (!auditResult) return [];
    const uniqueIds = new Set(auditResult.issues.map(i => i.itemId));
    return items
      .filter(item => uniqueIds.has(item.id))
      .map(item => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        displayName: item.displayName,
        category: item.category,
        subcategory: item.subcategory,
        brand: item.brand,
        tier: item.tier,
        source: item.source,
        thickness: item.dimensions?.thickness,
        costPerUnit: item.pricing?.costPerUnit,
        currency: item.pricing?.currency,
        inStock: item.inventory?.inStock,
        status: item.status,
        isFamily: item.isFamily,
        isOrderable: item.isOrderable,
        isBomSelectable: item.isBomSelectable,
        familyId: item.familyId,
      }));
  }, [auditResult, items]);

  const handleBulkEnhanceComplete = useCallback(() => {
    setBulkEnhanceOpen(false);
    // Remove stale issues for all items that were in the bulk enhance set
    const enhancedIds = itemsWithIssues.map(i => i.id);
    if (enhancedIds.length > 0) {
      removeIssuesForItems(enhancedIds);
    }
    // Reload fresh items from Firestore to reflect bulk enhancements
    loadItems();
  }, [loadItems, itemsWithIssues, removeIssuesForItems]);

  const filteredIssues = auditResult
    ? auditResult.issues.filter(issue => {
        if (filterTab === 'all') return true;
        return issue.severity === filterTab;
      })
    : [];

  const FILTER_TABS: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: auditResult?.issues.length },
    { id: 'critical', label: 'Critical', count: auditResult?.summary.criticalCount },
    { id: 'warning', label: 'Warning', count: auditResult?.summary.warningCount },
    { id: 'info', label: 'Info', count: auditResult?.summary.infoCount },
  ];

  const MAIN_TABS: Array<{ id: MainTab; label: string; icon: typeof ClipboardList; count?: number }> = [
    {
      id: 'issues',
      label: 'Issues',
      icon: ClipboardList,
      count: auditResult?.issues.length,
    },
    {
      id: 'duplicates',
      label: 'Duplicates',
      icon: GitMerge,
      count: auditResult?.duplicateGroups?.length,
    },
    {
      id: 'corrections',
      label: 'Corrections',
      icon: Wrench,
      count: auditResult?.corrections?.length,
    },
    {
      id: 'instructions',
      label: 'Agent Instructions',
      icon: Settings2,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI Inventory Health Audit
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Claude analyses your inventory for data quality issues, duplicates, corrections, and
            items needing attention
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={forceFullAudit}
              onChange={e => setForceFullAudit(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              disabled={auditing}
            />
            Re-audit all
          </label>
          <Button onClick={handleRunAudit} disabled={auditing || loadingItems || items.length === 0}>
            {loadingItems ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading items...
              </>
            ) : auditing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {auditProgress
                  ? `Batch ${auditProgress.currentBatch}/${auditProgress.totalBatches} (${auditProgress.itemsProcessed}/${auditProgress.totalItems})`
                  : `Analysing ${items.length} items...`}
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Run AI Audit ({items.length} items)
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Batch progress bar */}
      {auditing && auditProgress && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Batch {auditProgress.currentBatch} of {auditProgress.totalBatches}</span>
            <span>{auditProgress.itemsProcessed} / {auditProgress.totalItems} items</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-purple-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(auditProgress.itemsProcessed / auditProgress.totalItems) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Error state */}
      {auditError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700">{auditError}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRunAudit}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* Main tabs */}
      <div className="flex gap-1 border-b">
        {MAIN_TABS.map(tab => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                mainTab === tab.id
                  ? 'border-purple-500 text-purple-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <TabIcon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Agent Instructions tab (always accessible) */}
      {mainTab === 'instructions' && (
        <AgentInstructionsEditor
          instructions={agentInstructions}
          saving={instructionsSaving}
          error={instructionsError}
          onUpdate={updateInstructions}
          onSave={handleSaveInstructions}
          onReset={handleResetInstructions}
        />
      )}

      {/* Empty state (for non-instructions tabs) */}
      {mainTab !== 'instructions' && !auditResult && !auditing && !auditError && (
        <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-700 mb-1">No audit run yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Click "Run AI Audit" to analyse {items.length} inventory item
            {items.length !== 1 ? 's' : ''} for data quality issues, duplicates, and corrections
          </p>
          <Button variant="outline" onClick={handleRunAudit} disabled={items.length === 0}>
            <Zap className="w-4 h-4 mr-2" />
            Start Audit
          </Button>
        </div>
      )}

      {/* Results */}
      {auditResult && mainTab !== 'instructions' && (
        <>
          {/* Skipped items banner */}
          {(auditResult.summary.skippedRecentlyAudited ?? 0) > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500" />
                <p className="text-sm text-blue-700">
                  {auditResult.summary.skippedRecentlyAudited} item{auditResult.summary.skippedRecentlyAudited !== 1 ? 's' : ''} skipped
                  (audited within the last 7 days). Check "Re-audit all" to include them.
                </p>
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <ColoredStatsCard
              label="Items Analysed"
              value={auditResult.summary.totalItems}
              icon={Package}
              color="blue"
              subtitle={`${auditResult.summary.itemsWithIssues} with issues`}
            />
            <ColoredStatsCard
              label="Critical"
              value={auditResult.summary.criticalCount}
              icon={AlertCircle}
              color="red"
              onClick={() => { setMainTab('issues'); setFilterTab('critical'); }}
            />
            <ColoredStatsCard
              label="Warnings"
              value={auditResult.summary.warningCount}
              icon={AlertTriangle}
              color="amber"
              onClick={() => { setMainTab('issues'); setFilterTab('warning'); }}
            />
            <ColoredStatsCard
              label="Info"
              value={auditResult.summary.infoCount}
              icon={Info}
              color="blue"
              onClick={() => { setMainTab('issues'); setFilterTab('info'); }}
            />
            <ColoredStatsCard
              label="Brand Issues"
              value={auditResult.issues.filter(i => i.category === 'brand-in-title').length}
              icon={Tag}
              color="teal"
              onClick={() => { setMainTab('issues'); setFilterTab('all'); }}
            />
            <ColoredStatsCard
              label="Duplicates"
              value={auditResult.summary.duplicateGroupCount || 0}
              icon={GitMerge}
              color="purple"
              onClick={() => setMainTab('duplicates')}
            />
            <ColoredStatsCard
              label="Corrections"
              value={auditResult.summary.correctableCount || 0}
              icon={Wrench}
              color="indigo"
              onClick={() => setMainTab('corrections')}
            />
          </div>

          {/* Issues tab */}
          {mainTab === 'issues' && (
            <>
              {/* Filter tabs + Bulk Enhance button */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-1 border-b flex-1">
                  {FILTER_TABS.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setFilterTab(tab.id)}
                      className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                        filterTab === tab.id
                          ? 'border-purple-500 text-purple-700'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                      {tab.count !== undefined && (
                        <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {itemsWithIssues.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0"
                    onClick={() => setBulkEnhanceOpen(true)}
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    Bulk Enhance ({itemsWithIssues.length} items)
                  </Button>
                )}
              </div>

              {/* Issues list */}
              <ScrollArea className="max-h-[500px]">
                <div className="space-y-2">
                  {filteredIssues.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">
                        {filterTab === 'all'
                          ? 'No issues found — your inventory is in great shape!'
                          : `No ${filterTab} issues found`}
                      </p>
                    </div>
                  ) : (
                    filteredIssues.map((issue, idx) => {
                      const catStyle = ISSUE_CATEGORY_LABELS[issue.category] || {
                        label: issue.category,
                        color: 'bg-gray-100 text-gray-700',
                      };
                      return (
                        <div
                          key={`${issue.itemId}-${idx}`}
                          className="border rounded-lg p-3 bg-white hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2 min-w-0 flex-1">
                              {getSeverityIcon(issue.severity)}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-gray-900 truncate">
                                    {issue.itemName}
                                  </span>
                                  {issue.itemSku && (
                                    <span className="text-xs text-gray-400">{issue.itemSku}</span>
                                  )}
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${catStyle.color}`}
                                  >
                                    {catStyle.label}
                                  </Badge>
                                  {issue.correction && (
                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600">
                                      Auto-correctable
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 mt-0.5">{issue.message}</p>
                                <p className="text-xs text-gray-400 mt-1">{issue.suggestedAction}</p>
                              </div>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleEnhanceItem(issue.itemId)}
                              >
                                <Sparkles className="w-3 h-3 mr-1" />
                                Enhance
                              </Button>
                              {onViewItem && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => onViewItem(issue.itemId)}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  View
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>

              {/* Recommendations */}
              {auditResult.recommendations.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">Recommendations</h3>
                  {auditResult.recommendations.map((rec, idx) => (
                    <div key={idx} className="border rounded-lg p-3 bg-white">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={`text-xs ${PRIORITY_STYLES[rec.priority] || ''}`}
                        >
                          {rec.priority}
                        </Badge>
                        <span className="text-sm font-medium text-gray-900">{rec.title}</span>
                        <span className="text-xs text-gray-400">
                          ({rec.affectedItemIds.length} item
                          {rec.affectedItemIds.length !== 1 ? 's' : ''})
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{rec.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Duplicates tab */}
          {mainTab === 'duplicates' && (
            <DuplicateResolutionPanel
              groups={auditResult.duplicateGroups || []}
              merging={merging}
              mergeError={mergeError}
              mergeResult={mergeResult}
              onMerge={runMerge}
              onViewItem={onViewItem}
            />
          )}

          {/* Corrections tab */}
          {mainTab === 'corrections' && (
            <CorrectionReviewPanel
              corrections={corrections}
              applying={applyingCorrections}
              error={correctionError}
              result={correctionResult}
              onSetStatus={setCorrectionStatus}
              onAcceptAll={acceptAllCorrections}
              onRejectAll={rejectAllCorrections}
              onApply={runApplyCorrections}
              onViewItem={onViewItem}
            />
          )}

          {/* AI Notes */}
          {auditResult.aiNotes && mainTab === 'issues' && (
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
              <h3 className="text-sm font-semibold text-purple-800 mb-1 flex items-center gap-1">
                <Sparkles className="w-4 h-4" />
                AI Summary
              </h3>
              <p className="text-sm text-purple-700">{auditResult.aiNotes}</p>
            </div>
          )}
        </>
      )}

      {/* AI Enhancement Panel (single item) */}
      {enhanceItem && (
        <AIEnhancementPanel
          open={enhancePanelOpen}
          item={enhanceItem}
          onClose={() => {
            setEnhancePanelOpen(false);
            setEnhanceItem(null);
          }}
          onApply={handleApplyEnhancement}
        />
      )}

      {/* Bulk AI Enhancement Dialog */}
      <BulkAIEnhanceDialog
        open={bulkEnhanceOpen}
        selectedItems={itemsWithIssues}
        onClose={() => setBulkEnhanceOpen(false)}
        onComplete={handleBulkEnhanceComplete}
        userId={userId}
      />
    </div>
  );
}
