/**
 * Material Requirements Table
 * Shows BOQ items with formula status and material requirements
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Beaker, Calculator, Trash2, MoreVertical, Package, Edit, Sparkles, Ban, RotateCcw, Eye } from 'lucide-react';
import type { BOQItem } from '../../types';

interface MaterialRequirementsTableProps {
  items: BOQItem[];
  selectedItems: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  onApplyFormula: (itemIds: string[]) => void;
  onAIAssistant?: (itemId: string) => void;
  onCustomMaterials: (itemId: string) => void;
  onClearMaterials: (itemId: string) => void;
  onConvertToBulk: (itemId: string) => void;
  onUnmarkBulk: (itemId: string) => void;
  onMarkNoFormula?: (itemId: string) => void;
  onUnmarkNoFormula?: (itemId: string) => void;
  onBulkMarkNoFormula?: () => void;
  onViewDetails?: (itemId: string) => void;
  onEditItem?: (itemId: string) => void;
}

export function MaterialRequirementsTable({
  items,
  selectedItems,
  onSelectionChange,
  onApplyFormula,
  onAIAssistant,
  onCustomMaterials,
  onClearMaterials,
  onConvertToBulk,
  onUnmarkBulk,
  onMarkNoFormula,
  onUnmarkNoFormula,
  onBulkMarkNoFormula,
  onViewDetails,
  onEditItem,
}: MaterialRequirementsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const toggleRow = (itemId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedRows(newExpanded);
  };

  const toggleSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    onSelectionChange(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(items.map(item => item.id)));
    }
  };

  const isBulkItem = (item: BOQItem) => {
    return item.isBulkItem === true;
  };

  const getFormulaStatus = (item: BOQItem): { label: string; color: string; description?: string } => {
    if (item.noFormulaRequired) {
      return { label: 'Excluded', color: 'bg-gray-100 text-gray-500', description: 'No formula needed' };
    } else if (item.formulaId && item.materialRequirements && item.materialRequirements?.length > 0) {
      return { label: 'Applied', color: 'bg-green-100 text-green-700' };
    } else if (!item.formulaId && item.materialRequirements && item.materialRequirements.length > 0) {
      return { label: 'Custom', color: 'bg-purple-100 text-purple-700' };
    } else if (isBulkItem(item)) {
      return {
        label: 'Bulk',
        color: 'bg-blue-100 text-blue-700',
        description: 'Sent to supplier as-is'
      };
    } else {
      return { label: 'Pending', color: 'bg-orange-100 text-orange-700', description: 'Needs formula' };
    }
  };

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      {selectedItems.size > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm font-medium text-purple-900">
            {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onApplyFormula(Array.from(selectedItems))}
              className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 flex items-center gap-2"
            >
              <Beaker className="w-4 h-4" />
              Apply Formula
            </button>
            {onAIAssistant && selectedItems.size === 1 && (
              <button
                onClick={() => onAIAssistant(Array.from(selectedItems)[0])}
                className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                AI Formula Assistant
              </button>
            )}
            {onBulkMarkNoFormula && (
              <button
                onClick={onBulkMarkNoFormula}
                className="px-3 py-1.5 bg-white text-gray-700 text-sm rounded-lg hover:bg-gray-50 border border-gray-300 flex items-center gap-2"
              >
                <Ban className="w-4 h-4 text-gray-500" />
                No Formula Needed
              </button>
            )}
            <button
              onClick={() => onSelectionChange(new Set())}
              className="px-3 py-1.5 bg-white text-gray-700 text-sm rounded-lg hover:bg-gray-50 border border-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-12 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={items.length > 0 && selectedItems.size === items.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                />
              </th>
              <th className="w-12 px-4 py-3"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Item Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unit
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Formula Status
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Materials
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item) => {
              const level = item.hierarchyLevel ?? 99;
              const isHeaderRow = level <= 2 || item.isSummaryRow;
              const isSectionRow = level === 3;
              const isExpanded = expandedRows.has(item.id);
              const isSelected = selectedItems.has(item.id);
              const status = getFormulaStatus(item);
              const hasMaterials = item.materialRequirements && item.materialRequirements.length > 0;

              // ── Level 1 (Bill) header row ──
              if (level === 1) {
                return (
                  <tr key={item.id} className="bg-gray-800">
                    <td colSpan={9} className="px-4 py-2.5">
                      <span className="text-sm font-bold text-white uppercase tracking-wide">
                        {item.hierarchyPath || item.itemNumber} — {item.description}
                      </span>
                    </td>
                  </tr>
                );
              }

              // ── Level 2 (Element) header row ──
              if (level === 2 || (isHeaderRow && level !== 1)) {
                return (
                  <tr key={item.id} className="bg-gray-100 border-t-2 border-gray-300">
                    <td colSpan={9} className="px-4 py-2 pl-6">
                      <span className="text-sm font-semibold text-gray-700">
                        {item.hierarchyPath || item.itemNumber} — {item.description}
                      </span>
                    </td>
                  </tr>
                );
              }

              // ── Level 3 (Section / Governing Spec) row ──
              if (isSectionRow) {
                return (
                  <React.Fragment key={item.id}>
                    <tr className="bg-blue-50 border-t border-blue-200">
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(item.id)}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                        />
                      </td>
                      <td className="px-4 py-2"></td>
                      <td className="px-6 py-2 text-xs font-mono text-blue-600">
                        {item.hierarchyPath || item.itemNumber}
                      </td>
                      <td colSpan={3} className="px-6 py-2">
                        <button
                          onClick={() => onEditItem?.(item.id)}
                          className="text-left hover:underline"
                        >
                          <span className="text-sm font-medium text-blue-900">{item.description}</span>
                          {item.specification && (
                            <span className="block text-xs text-blue-600 mt-0.5 italic">{item.specification}</span>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-2 text-center">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${status.color}`}>{status.label}</span>
                      </td>
                      <td className="px-6 py-2 text-center text-xs text-gray-400">Section</td>
                      <td className="px-6 py-2 text-center">
                        {/* Section-level actions */}
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                            className="p-1 hover:bg-blue-100 rounded"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-400" />
                          </button>
                          {openMenuId === item.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                              <div className="absolute right-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                {onEditItem && (
                                  <button onClick={() => { onEditItem(item.id); setOpenMenuId(null); }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                                    <Edit className="w-4 h-4 text-blue-600" /><span>Edit Item</span>
                                  </button>
                                )}
                                {item.noFormulaRequired ? (
                                  onUnmarkNoFormula && (
                                    <button onClick={() => { onUnmarkNoFormula(item.id); setOpenMenuId(null); }}
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                                      <RotateCcw className="w-4 h-4 text-green-600" /><span>Restore — needs formula</span>
                                    </button>
                                  )
                                ) : (
                                  onMarkNoFormula && (
                                    <button onClick={() => { onMarkNoFormula(item.id); setOpenMenuId(null); }}
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                                      <Ban className="w-4 h-4 text-gray-500" /><span>No Formula Needed</span>
                                    </button>
                                  )
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              }

              // ── Level 4+ (Work Items) — full row with all actions ──
              return (
                <React.Fragment key={item.id}>
                  {/* Main Row */}
                  <tr className={`${isSelected ? 'bg-purple-50' : item.noFormulaRequired ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(item.id)}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {hasMaterials && (
                        <button
                          onClick={() => toggleRow(item.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm font-mono text-gray-500 pl-10">
                      {item.hierarchyPath || item.itemNumber}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">
                      <button
                        onClick={() => onEditItem?.(item.id)}
                        className="text-left hover:underline hover:text-gray-900"
                      >
                        {item.description}
                        {item.specification && (
                          <span className="block text-xs text-gray-400 mt-0.5">{item.specification}</span>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900 text-right">
                      {(item.quantityContract || item.quantity || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {item.unit}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${status.color}`}>
                          {status.label}
                        </span>
                        {status.description && (
                          <span className="text-xs text-gray-500">{status.description}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-center text-sm text-gray-900">
                      {hasMaterials ? (
                        <button
                          onClick={() => onViewDetails?.(item.id)}
                          className="font-medium text-purple-600 hover:text-purple-800 hover:underline cursor-pointer"
                          title="View formula details"
                        >
                          {item.materialRequirements?.length}
                        </button>
                      ) : isBulkItem(item) ? (
                        <span className="text-blue-600 text-xs">N/A</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          title="Actions"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-600" />
                        </button>

                        {/* Dropdown Menu */}
                        {openMenuId === item.id && (
                          <>
                            {/* Backdrop */}
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenMenuId(null)}
                            />

                            {/* Menu */}
                            <div className="absolute right-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                              {/* Excluded items — show restore option */}
                              {item.noFormulaRequired ? (
                                <>
                                  <div className="px-4 py-1.5 text-xs text-gray-400 font-medium">Excluded — no formula needed</div>
                                  {onUnmarkNoFormula && (
                                    <button
                                      onClick={() => { onUnmarkNoFormula(item.id); setOpenMenuId(null); }}
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                    >
                                      <RotateCcw className="w-4 h-4 text-green-600" />
                                      <span>Restore — needs formula</span>
                                    </button>
                                  )}
                                </>
                              ) : isBulkItem(item) ? (
                                <>
                                  {/* Unmark Bulk */}
                                  <button
                                    onClick={() => {
                                      onUnmarkBulk(item.id);
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Package className="w-4 h-4 text-orange-600" />
                                    <span>Unmark as Bulk</span>
                                  </button>
                                </>
                              ) : (
                                <>
                                  {/* Edit Item */}
                                  {onEditItem && (
                                    <button
                                      onClick={() => {
                                        onEditItem(item.id);
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                    >
                                      <Edit className="w-4 h-4 text-blue-600" />
                                      <span>Edit Item</span>
                                    </button>
                                  )}

                                  {/* Apply Formula */}
                                  <button
                                    onClick={() => {
                                      onApplyFormula([item.id]);
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Beaker className="w-4 h-4 text-green-600" />
                                    <span>Apply Formula</span>
                                  </button>

                                  {/* AI Formula Assistant */}
                                  {onAIAssistant && (
                                    <button
                                      onClick={() => {
                                        onAIAssistant(item.id);
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                    >
                                      <Sparkles className="w-4 h-4 text-purple-600" />
                                      <span>AI Generate Formula</span>
                                    </button>
                                  )}

                                  {/* Custom Materials */}
                                  <button
                                    onClick={() => {
                                      onCustomMaterials(item.id);
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Calculator className="w-4 h-4 text-purple-600" />
                                    <span>Custom Materials</span>
                                  </button>

                                  {/* Mark as Bulk */}
                                  <button
                                    onClick={() => {
                                      onConvertToBulk(item.id);
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Package className="w-4 h-4 text-blue-600" />
                                    <span>Mark as Bulk</span>
                                  </button>

                                  {/* No Formula Needed */}
                                  {onMarkNoFormula && (
                                    <button
                                      onClick={() => {
                                        onMarkNoFormula(item.id);
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                    >
                                      <Ban className="w-4 h-4 text-gray-500" />
                                      <span>No Formula Needed</span>
                                    </button>
                                  )}

                                  {/* View / Edit Details (only if has materials) */}
                                  {hasMaterials && (
                                    <>
                                      <div className="border-t border-gray-100 my-1" />
                                      {onViewDetails && (
                                        <button
                                          onClick={() => {
                                            onViewDetails(item.id);
                                            setOpenMenuId(null);
                                          }}
                                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                        >
                                          <Eye className="w-4 h-4 text-blue-600" />
                                          <span>View / Edit Details</span>
                                        </button>
                                      )}
                                      <button
                                        onClick={() => {
                                          onCustomMaterials(item.id);
                                          setOpenMenuId(null);
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                      >
                                        <Edit className="w-4 h-4 text-gray-600" />
                                        <span>Edit Materials</span>
                                      </button>
                                    </>
                                  )}

                                  {/* Clear Materials (only if has materials) */}
                                  {hasMaterials && (
                                    <button
                                      onClick={() => {
                                        onClearMaterials(item.id);
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      <span>Clear Materials</span>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Row - Material Requirements */}
                  {isExpanded && hasMaterials && (() => {
                    const qty = item.quantityContract ?? item.quantity ?? 0;
                    const materialCost = (item.materialRequirements ?? []).reduce(
                      (sum: number, r: any) => sum + (r.totalCost ?? 0), 0
                    );
                    const labourCost = qty * (item.laborRate ?? 0);
                    const equipmentCost = qty * (item.equipmentRate ?? 0);
                    const lineTotal = materialCost + labourCost + equipmentCost;
                    const fmt = (n: number) =>
                      new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(n);
                    return (
                      <tr className="bg-gray-50">
                        <td colSpan={9} className="px-12 py-4">
                          <div className="space-y-3">
                            <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                              {item.formulaId ? (
                                <>
                                  <Beaker className="w-4 h-4 text-green-600" />
                                  Formula: {item.formulaCode || item.formulaId}
                                </>
                              ) : (
                                <>
                                  <Calculator className="w-4 h-4 text-purple-600" />
                                  Custom Material List
                                </>
                              )}
                            </h4>

                            {/* Material breakdown table */}
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left py-2 px-3 font-medium text-gray-600">Material</th>
                                  <th className="text-right py-2 px-3 font-medium text-gray-600">Req Qty</th>
                                  <th className="text-right py-2 px-3 font-medium text-gray-600">Purchase Qty</th>
                                  <th className="text-left py-2 px-3 font-medium text-gray-600">Unit</th>
                                  <th className="text-left py-2 px-3 font-medium text-gray-600">Pack</th>
                                  <th className="text-right py-2 px-3 font-medium text-gray-600">Unit Price</th>
                                  <th className="text-right py-2 px-3 font-medium text-gray-600">Material Cost</th>
                                </tr>
                              </thead>
                              <tbody>
                                {item.materialRequirements?.map((req: any, idx: number) => (
                                  <tr key={idx} className="border-b border-gray-100 last:border-0">
                                    <td className="py-2 px-3 text-gray-900">{req.materialName || req.materialId}</td>
                                    <td className="py-2 px-3 text-right text-gray-500">
                                      {req.requiredQuantity != null
                                        ? req.requiredQuantity.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                        : req.quantity?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '-'}
                                    </td>
                                    <td className="py-2 px-3 text-right font-medium text-gray-900">
                                      {req.purchaseQuantity != null
                                        ? req.purchaseQuantity.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                        : req.quantity?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '-'}
                                    </td>
                                    <td className="py-2 px-3 text-gray-600">{req.unit || '-'}</td>
                                    <td className="py-2 px-3 text-gray-500 text-xs">
                                      {req.moq ? `MOQ ${req.moq}${req.packUnit ? ` ${req.packUnit}` : ''}` : '-'}
                                    </td>
                                    <td className="py-2 px-3 text-right text-gray-900">
                                      {req.unitPrice ? fmt(req.unitPrice) : '-'}
                                    </td>
                                    <td className="py-2 px-3 text-right font-medium text-gray-900">
                                      {req.totalCost ? fmt(req.totalCost) : '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            {/* Cost summary row */}
                            <div className="flex gap-6 pt-2 border-t border-gray-200 text-xs">
                              <div className="flex flex-col items-start gap-0.5">
                                <span className="text-gray-500 uppercase tracking-wide">Material Cost</span>
                                <span className="font-semibold text-gray-900">{fmt(materialCost)}</span>
                              </div>
                              {labourCost > 0 && (
                                <div className="flex flex-col items-start gap-0.5">
                                  <span className="text-gray-500 uppercase tracking-wide">Labour Cost</span>
                                  <span className="font-semibold text-gray-900">{fmt(labourCost)}</span>
                                </div>
                              )}
                              {equipmentCost > 0 && (
                                <div className="flex flex-col items-start gap-0.5">
                                  <span className="text-gray-500 uppercase tracking-wide">Equipment Cost</span>
                                  <span className="font-semibold text-gray-900">{fmt(equipmentCost)}</span>
                                </div>
                              )}
                              <div className="flex flex-col items-start gap-0.5 ml-auto">
                                <span className="text-gray-500 uppercase tracking-wide">Line Total</span>
                                <span className="font-bold text-purple-700 text-sm">{fmt(lineTotal)}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })()}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {items.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Calculator className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No items match the selected filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
