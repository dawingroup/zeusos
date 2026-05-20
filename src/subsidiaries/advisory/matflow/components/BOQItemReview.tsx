/**
 * BOQ Item Review Component
 * Review parsed items with confidence scores, formula matching, and cleanup
 */

import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Beaker,
  Package,
  Filter,
  CheckSquare,
  Square,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { CleanedBOQItem } from '../ai/boqCleanupService';
import { getConfidenceColor } from '../ai/boqCleanupService';

interface BOQItemReviewProps {
  items: CleanedBOQItem[];
  onItemsChange?: (items: CleanedBOQItem[]) => void;
  onImport?: (items: CleanedBOQItem[]) => void;
  isReadOnly?: boolean;
}

type ConfidenceFilter = 'all' | 'high' | 'medium' | 'low' | 'very_low';

export const BOQItemReview: React.FC<BOQItemReviewProps> = ({
  items,
  onImport,
  isReadOnly = false,
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set(items.map((_, i) => String(i))));
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all');
  const [showSummaryRows, setShowSummaryRows] = useState(false);
  const [collapsedBills, setCollapsedBills] = useState<Set<string>>(new Set());

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = [...items];
    
    // Filter by summary rows
    if (!showSummaryRows) {
      result = result.filter(item => !item.isSummaryRow);
    }
    
    // Filter by confidence
    if (confidenceFilter !== 'all') {
      result = result.filter(item => {
        const conf = item.confidence || 0;
        switch (confidenceFilter) {
          case 'high': return conf >= 0.8;
          case 'medium': return conf >= 0.6 && conf < 0.8;
          case 'low': return conf >= 0.4 && conf < 0.6;
          case 'very_low': return conf < 0.4;
          default: return true;
        }
      });
    }
    
    // Sort by item code (which groups by bill/section naturally)
    result.sort((a, b) => {
      return (a.itemCode || '').localeCompare(b.itemCode || '', undefined, { numeric: true });
    });
    
    return result;
  }, [items, showSummaryRows, confidenceFilter]);

  // Group items by 4-level hierarchy: Bill > Element > Section > Items
  // Structure with names for display
  interface HierarchyMeta {
    items: CleanedBOQItem[];
    name?: string;
  }
  type SectionGroup = Record<string, HierarchyMeta>;
  type ElementGroup = Record<string, { sections: SectionGroup; name?: string }>;
  type BillGroup = Record<string, { elements: ElementGroup; name?: string }>;
  
  const groupedItems = useMemo(() => {
    const groups: BillGroup = {};
    
    for (const item of filteredItems) {
      const bill = item.billNumber || 'Uncategorized';
      const element = item.elementCode || 'General';
      const section = item.sectionCode || 'Items';
      
      if (!groups[bill]) {
        groups[bill] = { elements: {}, name: item.billName };
      }
      // Update bill name if we find one
      if (item.billName && !groups[bill].name) {
        groups[bill].name = item.billName;
      }
      
      if (!groups[bill].elements[element]) {
        groups[bill].elements[element] = { sections: {}, name: item.elementName };
      }
      // Update element name if we find one
      if (item.elementName && !groups[bill].elements[element].name) {
        groups[bill].elements[element].name = item.elementName;
      }
      
      if (!groups[bill].elements[element].sections[section]) {
        groups[bill].elements[element].sections[section] = { items: [], name: item.sectionName };
      }
      // Update section name if we find one
      if (item.sectionName && !groups[bill].elements[element].sections[section].name) {
        groups[bill].elements[element].sections[section].name = item.sectionName;
      }
      
      groups[bill].elements[element].sections[section].items.push(item);
    }
    
    return groups;
  }, [filteredItems]);

  // Stats
  const stats = useMemo(() => {
    const total = items.length;
    const summaryRows = items.filter(i => i.isSummaryRow).length;
    const withFormula = items.filter(i => i.suggestedFormula).length;
    const highConf = items.filter(i => (i.confidence || 0) >= 0.8).length;
    const lowConf = items.filter(i => (i.confidence || 0) < 0.6).length;
    const avgConf = items.length > 0
      ? items.reduce((sum, i) => sum + (i.confidence || 0), 0) / items.length
      : 0;
    const needsEnhancement = items.filter(i => i.needsEnhancement).length;
    const workItems = items.filter(i => i.hierarchyLevel === 4 && !i.isSummaryRow).length;
    
    return { total, summaryRows, withFormula, highConf, lowConf, avgConf, needsEnhancement, workItems };
  }, [items]);

  const toggleExpand = (index: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const toggleSelect = (index: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    setSelectedItems(new Set(filteredItems.map((_, i) => String(i))));
  };

  const selectNone = () => {
    setSelectedItems(new Set());
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (confidence >= 0.6) return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    if (confidence >= 0.4) return <AlertCircle className="w-4 h-4 text-orange-600" />;
    return <XCircle className="w-4 h-4 text-red-600" />;
  };

  const handleImportSelected = () => {
    if (onImport) {
      const selectedItemsList = filteredItems.filter((_, i) => selectedItems.has(String(i)));
      onImport(selectedItemsList);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-xs text-gray-500">Total Items</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.workItems}</div>
          <div className="text-xs text-blue-600">Work Items</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.highConf}</div>
          <div className="text-xs text-green-600">High Confidence</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-purple-600">{stats.withFormula}</div>
          <div className="text-xs text-purple-600">Formula Matched</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-600">{stats.needsEnhancement}</div>
          <div className="text-xs text-orange-600">Needs Enhancement</div>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{stats.lowConf}</div>
          <div className="text-xs text-red-600">Low Confidence</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.summaryRows}</div>
          <div className="text-xs text-yellow-600">Summary Rows</div>
        </div>
        <div className="bg-teal-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-teal-600">{(stats.avgConf * 100).toFixed(0)}%</div>
          <div className="text-xs text-teal-600">Avg Confidence</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 py-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">Filter:</span>
        </div>
        
        <select
          value={confidenceFilter}
          onChange={(e) => setConfidenceFilter(e.target.value as ConfidenceFilter)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="all">All Confidence</option>
          <option value="high">High (≥80%)</option>
          <option value="medium">Medium (60-79%)</option>
          <option value="low">Low (40-59%)</option>
          <option value="very_low">Very Low (&lt;40%)</option>
        </select>
        
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showSummaryRows}
            onChange={(e) => setShowSummaryRows(e.target.checked)}
            className="rounded border-gray-300"
          />
          Show Summary Rows
        </label>
        
        <div className="flex-1" />
        
        <div className="flex items-center gap-2">
          <button
            onClick={selectAll}
            className="text-sm text-amber-600 hover:text-amber-700"
          >
            Select All
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={selectNone}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Select None
          </button>
        </div>
      </div>

      {/* Items List - Grouped by Bill > Element > Section */}
      <div className="space-y-4 max-w-full overflow-x-auto">
        {Object.entries(groupedItems).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([billNumber, billData]) => {
          const isBillCollapsed = collapsedBills.has(billNumber);
          const billItemCount = Object.values(billData.elements).flatMap(el => Object.values(el.sections).flatMap(s => s.items)).length;
          
          return (
            <div key={billNumber} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              {/* Bill Header (Level 1) */}
              <button
                onClick={() => {
                  const newCollapsed = new Set(collapsedBills);
                  if (isBillCollapsed) {
                    newCollapsed.delete(billNumber);
                  } else {
                    newCollapsed.add(billNumber);
                  }
                  setCollapsedBills(newCollapsed);
                }}
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
                    {billData.name && (
                      <div className="text-sm text-amber-100">{billData.name}</div>
                    )}
                  </div>
                </div>
                <span className="text-sm text-amber-100 bg-amber-500 px-2 py-0.5 rounded">{billItemCount} items</span>
              </button>
              
              {/* Bill Content */}
              {!isBillCollapsed && (
                <div className="divide-y divide-gray-100">
                  {Object.entries(billData.elements).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([elementCode, elementData]) => {
                    const elementItemCount = Object.values(elementData.sections).flatMap(s => s.items).length;
                    return (
                    <div key={elementCode} className="bg-white">
                      {/* Element Header (Level 2) */}
                      {elementCode !== 'General' && (
                        <div className="px-4 py-2.5 bg-blue-100 border-b border-blue-200 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-blue-800">Element {billNumber}.{elementCode}</span>
                            {elementData.name && (
                              <span className="text-blue-600 ml-2">- {elementData.name}</span>
                            )}
                          </div>
                          <span className="text-xs text-blue-500">{elementItemCount} items</span>
                        </div>
                      )}
                      
                      {/* Sections within Element */}
                      {Object.entries(elementData.sections).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([sectionCode, sectionData]) => (
                        <div key={sectionCode}>
                          {/* Section Header (Level 3) */}
                          {sectionCode !== 'Items' && (
                            <div className="px-6 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                              <div>
                                <span className="font-medium text-gray-700">Section {billNumber}.{elementCode}.{sectionCode}</span>
                                {sectionData.name && (
                                  <span className="text-gray-500 ml-2">- {sectionData.name}</span>
                                )}
                              </div>
                              <span className="text-xs text-gray-400">{sectionData.items.length} items</span>
                            </div>
                          )}
                          
                          {/* Work Items (Level 4) */}
                          <div className="divide-y divide-gray-50">
                            {sectionData.items.map((item: CleanedBOQItem) => {
                          const indexStr = item.itemCode || String(filteredItems.indexOf(item));
                          const isExpanded = expandedItems.has(indexStr);
                          const isSelected = selectedItems.has(String(filteredItems.indexOf(item)));
                          const confidence = item.confidence || 0;
                          
                          return (
                            <div
                              key={indexStr}
                              className={cn(
                                "transition-all",
                                item.isSummaryRow && "bg-yellow-50/50",
                                !item.isSummaryRow && isSelected && "bg-amber-50/30"
                              )}
                            >
                              {/* Item Row */}
                              <div className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 min-w-0">
                                {/* Checkbox */}
                                {!isReadOnly && (
                                  <button
                                    onClick={() => toggleSelect(String(filteredItems.indexOf(item)))}
                                    className="flex-shrink-0"
                                  >
                                    {isSelected ? (
                                      <CheckSquare className="w-4 h-4 text-amber-600" />
                                    ) : (
                                      <Square className="w-4 h-4 text-gray-300" />
                                    )}
                                  </button>
                                )}
                                
                                {/* Item Code */}
                                <div className="w-14 flex-shrink-0">
                                  <span className="text-xs font-mono text-gray-500">{item.itemCode}</span>
                                </div>
                                
                                {/* Item Name */}
                                <div className="flex-1 min-w-0 max-w-md">
                                  <div className="text-sm text-gray-900 truncate">
                                    {item.itemName || item.description?.substring(0, 60)}
                                  </div>
                                </div>
                                
                                {/* Qty & Unit */}
                                <div className="w-20 text-right flex-shrink-0">
                                  <span className="text-xs text-gray-900">{item.quantity}</span>
                                  <span className="text-xs text-gray-500 ml-1">{item.unit}</span>
                                </div>
                                
                                {/* Confidence */}
                                <div className={cn(
                                  "w-14 flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-xs",
                                  getConfidenceColor(confidence)
                                )}>
                                  {getConfidenceIcon(confidence)}
                                  <span className="hidden sm:inline">{(confidence * 100).toFixed(0)}%</span>
                                </div>
                                
                                {/* Enhancement Warning Badge */}
                                {item.needsEnhancement && (
                                  <div className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-700" title={item.enhancementReasons?.join(', ')}>
                                    <AlertTriangle className="w-3 h-3" />
                                    <span className="hidden lg:inline">Needs Spec</span>
                                  </div>
                                )}
                                
                                {/* Formula Badge */}
                                {item.suggestedFormula && (
                                  <div className="flex-shrink-0 hidden md:flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700">
                                    <Beaker className="w-3 h-3" />
                                    <span className="truncate max-w-16">{item.suggestedFormula.formulaCode}</span>
                                  </div>
                                )}
                                
                                {/* Expand Button */}
                                <button
                                  onClick={() => toggleExpand(indexStr)}
                                  className="p-1 hover:bg-gray-100 rounded flex-shrink-0"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-gray-400" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                  )}
                                </button>
                              </div>
                              
                              {/* Expanded Details */}
                              {isExpanded && (
                                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
                                  <div>
                                    <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Description</h5>
                                    <p className="text-sm text-gray-700">{item.description}</p>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                    <div>
                                      <span className="text-xs text-gray-500">Category:</span>
                                      <p className="text-gray-800">{item.category || '-'}</p>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500">Stage:</span>
                                      <p className="text-gray-800">{item.stage || '-'}</p>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500">Rate:</span>
                                      <p className="text-gray-800">{item.rate?.toLocaleString() || '-'}</p>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500">Amount:</span>
                                      <p className="text-gray-800">{item.amount?.toLocaleString() || '-'}</p>
                                    </div>
                                  </div>
                                  
                                  {/* Governing Specs - show for Level 3 (specification) or inherited on Level 4 */}
                                  {item.governingSpecs && (
                                    <div className={cn(
                                      "rounded p-2",
                                      item.isSpecificationRow ? "bg-teal-50" : "bg-gray-50"
                                    )}>
                                      <div className="flex items-center gap-2 text-xs mb-1">
                                        <span className={cn(
                                          "font-medium",
                                          item.isSpecificationRow ? "text-teal-700" : "text-gray-500"
                                        )}>
                                          {item.isSpecificationRow ? "Governing Specs (Level 3)" : "Inherited Specs"}
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {item.governingSpecs.materialGrade && (
                                          <span className="text-xs bg-white px-2 py-0.5 rounded border border-teal-200">
                                            <strong>Grade:</strong> {item.governingSpecs.materialGrade}
                                          </span>
                                        )}
                                        {item.governingSpecs.brand && (
                                          <span className="text-xs bg-white px-2 py-0.5 rounded border border-blue-200">
                                            <strong>Brand:</strong> {item.governingSpecs.brand}
                                          </span>
                                        )}
                                        {item.governingSpecs.finish && (
                                          <span className="text-xs bg-white px-2 py-0.5 rounded border border-purple-200">
                                            <strong>Finish:</strong> {item.governingSpecs.finish}
                                          </span>
                                        )}
                                        {item.governingSpecs.standardRef && (
                                          <span className="text-xs bg-white px-2 py-0.5 rounded border border-amber-200">
                                            <strong>Std:</strong> {item.governingSpecs.standardRef}
                                          </span>
                                        )}
                                        {item.governingSpecs.color && (
                                          <span className="text-xs bg-white px-2 py-0.5 rounded border border-pink-200">
                                            <strong>Color:</strong> {item.governingSpecs.color}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {item.suggestedFormula && (
                                    <div className="bg-purple-50 rounded p-2">
                                      <div className="flex items-center gap-2 text-sm">
                                        <Beaker className="w-4 h-4 text-purple-600" />
                                        <span className="font-medium text-purple-900">{item.suggestedFormula.formulaCode}</span>
                                        <span className="text-purple-700">{item.suggestedFormula.formulaName}</span>
                                        <span className="text-xs text-purple-500 ml-auto">
                                          {item.suggestedFormula.matchScore}% match
                                        </span>
                                      </div>
                                      {item.materialRequirements && item.materialRequirements.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {item.materialRequirements.map((mat, i) => (
                                            <span key={i} className="text-xs bg-white px-2 py-1 rounded">
                                              <Package className="w-3 h-3 inline mr-1 text-purple-400" />
                                              {mat.materialName}: {mat.quantity.toFixed(2)} {mat.unit}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Bar */}
      {!isReadOnly && onImport && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            {selectedItems.size} of {filteredItems.length} items selected
          </div>
          <button
            onClick={handleImportSelected}
            disabled={selectedItems.size === 0}
            className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Import {selectedItems.size} Items
          </button>
        </div>
      )}
    </div>
  );
};

export default BOQItemReview;
