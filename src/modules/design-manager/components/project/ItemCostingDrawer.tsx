/**
 * ItemCostingDrawer
 * Slide-out drawer for reviewing and recalculating item-level costing
 * from the Estimate tab without navigating away.
 */

import { useState, useCallback } from 'react';
import { X, RefreshCw, Package, Calculator, Loader2, HardHat } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { StageBadge } from '../design-item/StageBadge';
import {
  calculateMaterialCostsFromParts,
  calculateLaborFromParts,
  calculateItemProcessingCosts,
} from '../../services/estimateService';
import { DEFAULT_ESTIMATE_CONFIG } from '../../types/estimate';
import { getOrganizationSettings } from '@/core/settings/settingsService';
import { resolveEffectiveLaborRate } from '@/modules/finance/services/laborRateCalculator';
import type { DesignItem } from '../../types';
import type { MaterialPaletteEntry } from '@/shared/types';

interface ItemCostingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: DesignItem | null;
  projectId: string;
  materialPalette: MaterialPaletteEntry[];
  userId: string;
  onCostsSaved?: () => void;
}

export function ItemCostingDrawer({
  isOpen,
  onClose,
  item,
  projectId,
  materialPalette,
  userId,
  onCostsSaved,
}: ItemCostingDrawerProps) {
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local costing state — populated after auto-calculate
  const [costData, setCostData] = useState<Record<string, any> | null>(null);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const handleAutoCalculate = useCallback(async () => {
    if (!item) return;
    const parts = (item as any).parts || [];
    if (parts.length === 0) {
      setError('No parts found on this item. Add parts first.');
      return;
    }

    setCalculating(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const matResult = await calculateMaterialCostsFromParts(parts, projectId, materialPalette);
      const processing = calculateItemProcessingCosts(parts, materialPalette);
      const labor = calculateLaborFromParts(parts);

      const standardParts = (item as any).manufacturing?.standardParts || [];
      const specialParts = (item as any).manufacturing?.specialParts || [];
      const standardPartsCost = standardParts.reduce(
        (sum: number, p: any) => sum + (p.quantity * (p.unitCost || 0)),
        0
      );
      const specialPartsCost = specialParts.reduce(
        (sum: number, p: any) => sum + (p.quantity * (p.unitCost || 0)),
        0
      );

      // Resolve labor rate
      let laborRate = (item as any).manufacturing?.laborRate || DEFAULT_ESTIMATE_CONFIG.laborRatePerHour;
      try {
        const orgSettings = await getOrganizationSettings('default');
        laborRate = await resolveEffectiveLaborRate({
          assumptions: orgSettings?.pricingAssumptions,
          fallbackRate: laborRate,
        });
      } catch {
        // keep existing rate
      }

      const totalMaterialCost = matResult.totalCost + standardPartsCost + specialPartsCost;
      const laborCost = labor.hours * laborRate;
      const totalCost = totalMaterialCost + processing.totalCost + laborCost;

      setCostData({
        sheetMaterials: matResult.sheetMaterials,
        sheetMaterialsCost: matResult.sheetMaterialsCost,
        timberMaterials: matResult.timberMaterials,
        timberMaterialsCost: matResult.timberMaterialsCost,
        linearMaterials: matResult.linearMaterials,
        linearMaterialsCost: matResult.linearMaterialsCost,
        edgingMaterials: matResult.edgingMaterials,
        edgingMaterialsCost: matResult.edgingMaterialsCost,
        standardParts,
        standardPartsCost,
        specialParts,
        specialPartsCost,
        processingSteps: processing.steps,
        processingCost: processing.totalCost,
        laborHours: labor.hours,
        laborRate,
        laborCost,
        materialCost: totalMaterialCost,
        totalCost,
        costPerUnit: totalCost,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-calculation failed');
    } finally {
      setCalculating(false);
    }
  }, [item, projectId, materialPalette]);

  const handleSave = useCallback(async () => {
    if (!item || !costData) return;
    setSaving(true);
    setError(null);

    // Strip undefined values recursively — Firestore rejects undefined at any depth
    const stripUndefined = (obj: any): any => {
      if (Array.isArray(obj)) return obj.map(stripUndefined);
      if (obj !== null && typeof obj === 'object') {
        return Object.fromEntries(
          Object.entries(obj)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, stripUndefined(v)])
        );
      }
      return obj;
    };

    try {
      const itemRef = doc(db, 'designProjects', projectId, 'designItems', item.id);
      await updateDoc(itemRef, {
        'manufacturing.sheetMaterials': stripUndefined(costData.sheetMaterials),
        'manufacturing.sheetMaterialsCost': costData.sheetMaterialsCost,
        'manufacturing.timberMaterials': stripUndefined(costData.timberMaterials),
        'manufacturing.timberMaterialsCost': costData.timberMaterialsCost,
        'manufacturing.linearMaterials': stripUndefined(costData.linearMaterials),
        'manufacturing.linearMaterialsCost': costData.linearMaterialsCost,
        'manufacturing.edgingMaterials': stripUndefined(costData.edgingMaterials),
        'manufacturing.edgingMaterialsCost': costData.edgingMaterialsCost,
        'manufacturing.materialCost': costData.materialCost,
        'manufacturing.processingSteps': stripUndefined(costData.processingSteps.map((s: any) => ({
          stepId: s.stepId || '',
          label: s.label || '',
          quantity: s.quantity || 0,
          unit: s.unit || '',
          ratePerUnit: s.ratePerUnit || 0,
          totalCost: s.totalCost || 0,
        }))),
        'manufacturing.processingCost': costData.processingCost,
        'manufacturing.laborHours': costData.laborHours,
        'manufacturing.laborRate': costData.laborRate,
        'manufacturing.laborCost': costData.laborCost,
        'manufacturing.totalCost': costData.totalCost,
        'manufacturing.costPerUnit': costData.costPerUnit,
        'manufacturing.quantity': 1,
        'manufacturing.autoCalculated': true,
        'manufacturing.lastAutoCalcAt': serverTimestamp(),
        'manufacturing.estimatedAt': serverTimestamp(),
        'manufacturing.estimatedBy': userId,
      });

      setSaveSuccess(true);
      onCostsSaved?.();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save costs');
    } finally {
      setSaving(false);
    }
  }, [item, projectId, costData, userId, onCostsSaved]);

  if (!isOpen || !item) return null;

  const manufacturing = (item as any).manufacturing || {};
  // Show either freshly calculated data or existing saved data
  const display = costData || manufacturing;
  const hasCosts = display.totalCost > 0;
  const isProcured = (item as any).sourcingType === 'PROCURED';
  const isConstruction = (item as any).sourcingType === 'CONSTRUCTION';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-2xl h-screen bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">{item.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <StageBadge stage={item.currentStage} size="sm" />
                {item.itemCode && (
                  <span className="text-xs text-gray-500">{item.itemCode}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isProcured ? (
            (() => {
              const proc = (item as any).procurement;
              const reqQty = item.requiredQuantity || 1;
              if (!proc || !proc.totalLandedCost) {
                return (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">Procured Item</h3>
                    <p className="text-gray-500 mt-1">No procurement pricing entered yet.</p>
                  </div>
                );
              }
              const srcCurrency = proc.currency || 'UGX';
              const tgtCurrency = proc.targetCurrency || 'UGX';
              const hasFx = proc.exchangeRate && proc.exchangeRate !== 1;
              return (
                <div className="space-y-4">
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                      <p className="text-xs text-teal-600 uppercase">Item Cost</p>
                      <p className="text-lg font-bold text-teal-900">{srcCurrency} {formatCurrency(proc.totalItemCost || 0)}</p>
                      <p className="text-xs text-gray-500">{proc.quantity || 1} × {formatCurrency(proc.unitCost || 0)}/unit</p>
                    </div>
                    {(proc.logisticsCost || 0) > 0 && (
                      <div className="bg-sky-50 border border-sky-200 rounded-lg p-3">
                        <p className="text-xs text-sky-600 uppercase">Logistics</p>
                        <p className="text-lg font-bold text-sky-900">{srcCurrency} {formatCurrency(proc.logisticsCost)}</p>
                        {proc.logisticsNotes && <p className="text-xs text-gray-500 truncate">{proc.logisticsNotes}</p>}
                      </div>
                    )}
                    {(proc.customsCost || 0) > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs text-amber-600 uppercase">Customs & Duties</p>
                        <p className="text-lg font-bold text-amber-900">{srcCurrency} {formatCurrency(proc.customsCost)}</p>
                        {proc.hsCode && <p className="text-xs text-gray-500">HS: {proc.hsCode}</p>}
                      </div>
                    )}
                    {hasFx && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <p className="text-xs text-purple-600 uppercase">Exchange Rate</p>
                        <p className="text-lg font-bold text-purple-900">1 {srcCurrency} = {proc.exchangeRate}</p>
                        <p className="text-xs text-gray-500">{tgtCurrency}</p>
                      </div>
                    )}
                  </div>

                  {/* Cost breakdown table */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                    <h4 className="font-semibold text-gray-800 mb-3">Cost Breakdown</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Unit Cost ({srcCurrency})</span>
                      <span className="font-medium">{formatCurrency(proc.unitCost || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Quantity</span>
                      <span className="font-medium">× {proc.quantity || 1}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-gray-600">Item Total ({srcCurrency})</span>
                      <span className="font-medium">{formatCurrency(proc.totalItemCost || 0)}</span>
                    </div>
                    {(proc.totalLogistics || 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">+ Logistics</span>
                        <span className="font-medium">{formatCurrency(proc.totalLogistics)}</span>
                      </div>
                    )}
                    {(proc.totalCustoms || 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">+ Customs & Duties</span>
                        <span className="font-medium">{formatCurrency(proc.totalCustoms)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-semibold border-t pt-2">
                      <span className="text-gray-700">Grand Total ({srcCurrency})</span>
                      <span>{formatCurrency(proc.grandTotal || 0)}</span>
                    </div>
                    {hasFx && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>× Exchange Rate</span>
                        <span>{proc.exchangeRate}</span>
                      </div>
                    )}
                  </div>

                  {/* Landed cost summary */}
                  <div className="bg-gradient-to-r from-teal-600 to-teal-500 rounded-lg p-4 text-white">
                    <div className="flex justify-between text-sm text-teal-100 mb-1">
                      <span>Landed Cost Per Unit</span>
                      <span>{tgtCurrency} {formatCurrency(proc.landedCostPerUnit || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-teal-100 mb-2">
                      <span>Total Landed Cost ({proc.quantity || 1} units)</span>
                      <span>{tgtCurrency} {formatCurrency(proc.totalLandedCost || 0)}</span>
                    </div>
                    {reqQty > 1 && (
                      <div className="flex justify-between text-sm text-teal-100 border-t border-teal-400 pt-2 mb-2">
                        <span>× Required Qty</span>
                        <span>× {reqQty}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t border-teal-400 pt-2">
                      <h4 className="font-semibold">Estimate Line Total</h4>
                      <p className="text-2xl font-bold">{tgtCurrency} {formatCurrency((proc.totalLandedCost || 0) * reqQty)}</p>
                    </div>
                  </div>

                  {/* Vendor info */}
                  {(proc.vendor || proc.quoteReference) && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm space-y-1">
                      {proc.vendor && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Vendor</span>
                          <span className="font-medium text-gray-900">{proc.vendor}</span>
                        </div>
                      )}
                      {proc.quoteReference && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Quote Ref</span>
                          <span className="font-medium text-gray-900">{proc.quoteReference}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()
          ) : isConstruction ? (
            (() => {
              const con = (item as any).construction;
              const reqQty = item.requiredQuantity || 1;
              if (!con || !con.totalCost) {
                return (
                  <div className="text-center py-12">
                    <HardHat className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">Construction Item</h3>
                    <p className="text-gray-500 mt-1">No construction pricing entered yet.</p>
                  </div>
                );
              }
              const currency = con.currency || 'UGX';
              const method = con.pricingMethod;
              const methodLabels: Record<string, string> = {
                measured: 'Measured (BOQ)',
                lump_sum: 'Lump Sum',
                day_works: 'Day Works',
                cost_plus: 'Cost Plus',
                contractor_quote: 'Contractor Quote',
                composite: 'Composite',
              };
              const unitLabels: Record<string, string> = {
                sqm: 'm²', sqft: 'ft²', lm: 'lin.m', unit: 'units', lot: 'lot',
              };
              return (
                <div className="space-y-4">
                  {/* Method badge */}
                  {method && (
                    <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium">
                      <HardHat className="w-4 h-4" />
                      {methodLabels[method] || method}
                    </div>
                  )}

                  {/* Summary cards */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Measured: quantity × rate */}
                    {(method === 'measured' || (!method && con.quantity > 0)) && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs text-amber-600 uppercase">Quantity</p>
                        <p className="text-lg font-bold text-amber-900">{con.quantity} {unitLabels[con.unitType] || con.unitType}</p>
                        <p className="text-xs text-gray-500">@ {formatCurrency(con.unitRate || 0)}/{unitLabels[con.unitType] || con.unitType}</p>
                      </div>
                    )}
                    {/* Day works: days × rate */}
                    {method === 'day_works' && (con.laborDays || 0) > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs text-amber-600 uppercase">Labor Days</p>
                        <p className="text-lg font-bold text-amber-900">{con.laborDays} days</p>
                        <p className="text-xs text-gray-500">@ {formatCurrency(con.laborDailyRate || 0)}/day</p>
                      </div>
                    )}
                    {/* Lump sum */}
                    {method === 'lump_sum' && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs text-amber-600 uppercase">Lump Sum</p>
                        <p className="text-lg font-bold text-amber-900">{formatCurrency(con.lumpSumAmount || 0)}</p>
                      </div>
                    )}
                    {/* Labor cost */}
                    {(con.laborCost || 0) > 0 && method !== 'day_works' && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-xs text-green-600 uppercase">Labor</p>
                        <p className="text-lg font-bold text-green-900">{formatCurrency(con.laborCost)}</p>
                        {con.laborNotes && <p className="text-xs text-gray-500 truncate">{con.laborNotes}</p>}
                      </div>
                    )}
                    {/* Materials cost */}
                    {(con.materialsCost || 0) > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs text-blue-600 uppercase">Materials</p>
                        <p className="text-lg font-bold text-blue-900">{formatCurrency(con.materialsCost)}</p>
                        {con.materialsBreakdown && <p className="text-xs text-gray-500 truncate">{con.materialsBreakdown}</p>}
                      </div>
                    )}
                    {/* Management fee (cost plus) */}
                    {method === 'cost_plus' && (con.managementFeeAmount || 0) > 0 && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <p className="text-xs text-purple-600 uppercase">Management Fee</p>
                        <p className="text-lg font-bold text-purple-900">{formatCurrency(con.managementFeeAmount)}</p>
                        <p className="text-xs text-gray-500">{((con.managementFeePercent || 0) * 100).toFixed(0)}%</p>
                      </div>
                    )}
                    {/* VAT */}
                    {(con.vatAmount || 0) > 0 && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-xs text-gray-600 uppercase">VAT</p>
                        <p className="text-lg font-bold text-gray-900">{formatCurrency(con.vatAmount)}</p>
                        <p className="text-xs text-gray-500">{((con.vatRate || 0) * 100).toFixed(0)}%</p>
                      </div>
                    )}
                  </div>

                  {/* Contractor quote line items */}
                  {method === 'contractor_quote' && con.quoteLineItems?.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-3">Quote Line Items</h4>
                      <div className="space-y-2">
                        {con.quoteLineItems.map((li: any, idx: number) => (
                          <div key={li.id || idx} className="flex justify-between text-sm">
                            <span className="text-gray-600">{li.description}</span>
                            <span className="font-medium">{formatCurrency(li.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Composite sub-items */}
                  {method === 'composite' && con.subItems?.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-3">Sub-Items</h4>
                      <div className="space-y-2">
                        {con.subItems.map((si: any, idx: number) => (
                          <div key={si.id || idx} className="flex justify-between text-sm">
                            <div>
                              <span className="text-gray-900">{si.name}</span>
                              <span className="text-gray-400 text-xs ml-2">({methodLabels[si.pricingMethod] || si.pricingMethod})</span>
                            </div>
                            <span className="font-medium">{formatCurrency(si.totalCost)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cost breakdown */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                    <h4 className="font-semibold text-gray-800 mb-3">Cost Summary</h4>
                    {(method === 'measured' || (!method && con.quantity > 0)) && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{con.quantity} {unitLabels[con.unitType] || con.unitType} × {formatCurrency(con.unitRate || 0)}</span>
                        <span className="font-medium">{formatCurrency((con.quantity || 0) * (con.unitRate || 0))}</span>
                      </div>
                    )}
                    {(con.laborCost || 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Labor</span>
                        <span className="font-medium">{formatCurrency(con.laborCost)}</span>
                      </div>
                    )}
                    {(con.materialsCost || 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Materials</span>
                        <span className="font-medium">{formatCurrency(con.materialsCost)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-semibold border-t pt-2">
                      <span className="text-gray-700">Subtotal ({currency})</span>
                      <span>{formatCurrency(con.subtotal || 0)}</span>
                    </div>
                    {(con.vatAmount || 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">+ VAT ({((con.vatRate || 0) * 100).toFixed(0)}%)</span>
                        <span className="font-medium">{formatCurrency(con.vatAmount)}</span>
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="bg-gradient-to-r from-amber-600 to-amber-500 rounded-lg p-4 text-white">
                    <div className="flex justify-between text-sm text-amber-100 mb-1">
                      <span>Total Cost</span>
                      <span>{currency} {formatCurrency(con.totalCost)}</span>
                    </div>
                    {reqQty > 1 && (
                      <div className="flex justify-between text-sm text-amber-100 border-t border-amber-400 pt-2 mb-2">
                        <span>× Required Qty</span>
                        <span>× {reqQty}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t border-amber-400 pt-2">
                      <h4 className="font-semibold">Estimate Line Total</h4>
                      <p className="text-2xl font-bold">{currency} {formatCurrency(con.totalCost * reqQty)}</p>
                    </div>
                  </div>

                  {/* Contractor & scope */}
                  {(con.contractor || con.scopeOfWork || con.quoteReference) && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm space-y-1">
                      {con.contractor && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Contractor</span>
                          <span className="font-medium text-gray-900">{con.contractor}</span>
                        </div>
                      )}
                      {con.quoteReference && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Quote Ref</span>
                          <span className="font-medium text-gray-900">{con.quoteReference}</span>
                        </div>
                      )}
                      {con.scopeOfWork && (
                        <div className="mt-2">
                          <span className="text-gray-500 block mb-1">Scope of Work</span>
                          <p className="text-gray-700 text-xs whitespace-pre-wrap">{con.scopeOfWork}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="space-y-4">
              {/* Auto-calculate toolbar */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <Calculator className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-green-900">Item Costing</h4>
                      <p className="text-sm text-green-700">
                        {((item as any).parts || []).length} parts &middot;
                        {' '}Qty: {item.requiredQuantity || 1}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleAutoCalculate}
                    disabled={calculating}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                  >
                    {calculating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    {calculating ? 'Calculating...' : 'Auto Calculate'}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              {/* Cost Breakdown */}
              {hasCosts && (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 gap-3">
                    {(display.sheetMaterialsCost || 0) > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs text-blue-600 uppercase">Sheet Materials</p>
                        <p className="text-lg font-bold text-blue-900">UGX {formatCurrency(display.sheetMaterialsCost)}</p>
                        <p className="text-xs text-gray-500">{(display.sheetMaterials || []).length} types</p>
                      </div>
                    )}
                    {(display.timberMaterialsCost || 0) > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs text-amber-600 uppercase">Timber (m&#179;)</p>
                        <p className="text-lg font-bold text-amber-900">UGX {formatCurrency(display.timberMaterialsCost)}</p>
                        <p className="text-xs text-gray-500">{(display.timberMaterials || []).length} groups</p>
                      </div>
                    )}
                    {(display.linearMaterialsCost || 0) > 0 && (
                      <div className="bg-sky-50 border border-sky-200 rounded-lg p-3">
                        <p className="text-xs text-sky-600 uppercase">Linear Stock (m)</p>
                        <p className="text-lg font-bold text-sky-900">UGX {formatCurrency(display.linearMaterialsCost)}</p>
                        <p className="text-xs text-gray-500">{(display.linearMaterials || []).length} profiles</p>
                      </div>
                    )}
                    {(display.edgingMaterialsCost || 0) > 0 && (
                      <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                        <p className="text-xs text-rose-600 uppercase">Edging</p>
                        <p className="text-lg font-bold text-rose-900">UGX {formatCurrency(display.edgingMaterialsCost)}</p>
                        <p className="text-xs text-gray-500">{(display.edgingMaterials || []).length} types</p>
                      </div>
                    )}
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <p className="text-xs text-orange-600 uppercase">Standard Parts</p>
                      <p className="text-lg font-bold text-orange-700">UGX {formatCurrency(display.standardPartsCost || 0)}</p>
                      <p className="text-xs text-gray-500">{(display.standardParts || []).length} items</p>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <p className="text-xs text-purple-600 uppercase">Special Parts</p>
                      <p className="text-lg font-bold text-purple-700">UGX {formatCurrency(display.specialPartsCost || 0)}</p>
                      <p className="text-xs text-gray-500">{(display.specialParts || []).length} items</p>
                    </div>
                    {(display.processingCost || 0) > 0 && (
                      <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                        <p className="text-xs text-teal-600 uppercase">Processing</p>
                        <p className="text-lg font-bold text-teal-700">UGX {formatCurrency(display.processingCost)}</p>
                        <p className="text-xs text-gray-500">{(display.processingSteps || []).length} ops</p>
                      </div>
                    )}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-xs text-green-600 uppercase">Labor</p>
                      <p className="text-lg font-bold text-green-700">
                        UGX {formatCurrency((display.laborHours || 0) * (display.laborRate || 0))}
                      </p>
                      <p className="text-xs text-gray-500">
                        {display.laborHours || 0} hrs @ {formatCurrency(display.laborRate || 0)}/hr
                      </p>
                    </div>
                  </div>

                  {/* Material detail breakdown */}
                  {(display.sheetMaterials || []).length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-800 mb-2">Sheet Materials</h4>
                      <div className="space-y-2">
                        {(display.sheetMaterials || []).map((mat: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{mat.materialName} ({mat.thickness}mm) — {mat.totalArea?.toFixed(2)} m²</span>
                            <span className="font-medium">UGX {formatCurrency(mat.totalCost)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(display.timberMaterials || []).length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h4 className="font-semibold text-amber-800 mb-2">Timber Materials</h4>
                      <div className="space-y-2">
                        {(display.timberMaterials || []).map((mat: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>
                              {mat.materialName} ({mat.crossSection?.thickness}×{mat.crossSection?.width}mm)
                              {' — '}{mat.totalVolumeCubicMeters} m³
                            </span>
                            <span className="font-medium">UGX {formatCurrency(mat.totalCost)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(display.edgingMaterials || []).length > 0 && (
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                      <h4 className="font-semibold text-rose-800 mb-2">Edging Materials</h4>
                      <div className="space-y-2">
                        {(display.edgingMaterials || []).map((mat: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{mat.materialName} — {mat.totalLinearMeters} m</span>
                            <span className="font-medium">UGX {formatCurrency(mat.totalCost)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Processing steps */}
                  {(display.processingSteps || []).length > 0 && (
                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                      <h4 className="font-semibold text-teal-800 mb-2">Processing Steps</h4>
                      <div className="space-y-2">
                        {(display.processingSteps || []).map((step: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{step.label} — {step.quantity} {step.unit}</span>
                            <span className="font-medium">UGX {formatCurrency(step.totalCost)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Total */}
                  <div className="bg-gradient-to-r from-[#0A7C8E] to-[#0A7C8E]/80 rounded-lg p-4 text-white">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold">Total Cost per Unit</h4>
                        {(item.requiredQuantity || 1) > 1 && (
                          <p className="text-sm text-white/80">
                            × {item.requiredQuantity} = UGX {formatCurrency(display.totalCost * (item.requiredQuantity || 1))}
                          </p>
                        )}
                      </div>
                      <p className="text-2xl font-bold">UGX {formatCurrency(display.totalCost)}</p>
                    </div>
                  </div>
                </>
              )}

              {!hasCosts && !calculating && (
                <div className="text-center py-8">
                  <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No costs calculated yet</p>
                  <p className="text-sm text-gray-400 mt-1">Click "Auto Calculate" to compute costs from parts</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isProcured && !isConstruction && costData && (
          <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {saveSuccess && <span className="text-green-600 font-medium">Costs saved successfully</span>}
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-[#0A7C8E] text-white rounded-lg hover:bg-[#0A7C8E]/90 disabled:opacity-50 text-sm font-medium"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? 'Saving...' : 'Save Costs'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ItemCostingDrawer;
