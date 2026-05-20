/**
 * Pricing & Optimization Defaults Section
 *
 * Collapsible settings section for configuring organization-wide
 * optimization parameters: kerf, buffers, yields, minimums, default costs.
 *
 * Same UI pattern as WorkshopProcessingRatesSection in SettingsPage.
 */

import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Calculator,
  Save,
  RotateCcw,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { DEFAULT_PRICING_ASSUMPTIONS, resolvePricingAssumptions } from '@/shared/types/pricingAssumptions';
import type { OrganizationSettings } from '@/core/settings/types';

// ============================================
// Props
// ============================================

interface PricingAssumptionsSectionProps {
  canEdit: boolean;
  settings: OrganizationSettings | null;
  updateSettings: (updates: Partial<OrganizationSettings>) => Promise<void>;
  defaultExpanded?: boolean;
}

// ============================================
// Component
// ============================================

export function PricingAssumptionsSection({
  canEdit,
  settings,
  updateSettings,
  defaultExpanded = false,
}: PricingAssumptionsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Local state for each group
  const [cutting, setCutting] = useState(DEFAULT_PRICING_ASSUMPTIONS.cutting);
  const [buffers, setBuffers] = useState(DEFAULT_PRICING_ASSUMPTIONS.buffers);
  const [yields, setYields] = useState(DEFAULT_PRICING_ASSUMPTIONS.yields);
  const [minimums, setMinimums] = useState(DEFAULT_PRICING_ASSUMPTIONS.minimums);
  const [glass, setGlass] = useState(DEFAULT_PRICING_ASSUMPTIONS.glass);
  const [defaultSheetCosts, setDefaultSheetCosts] = useState(DEFAULT_PRICING_ASSUMPTIONS.defaultSheetCosts);
  const [defaultCostByThickness, setDefaultCostByThickness] = useState(DEFAULT_PRICING_ASSUMPTIONS.defaultCostByThickness);
  const [fallbackSheetCost, setFallbackSheetCost] = useState(DEFAULT_PRICING_ASSUMPTIONS.fallbackSheetCost);

  // New entry inputs
  const [newSheetName, setNewSheetName] = useState('');
  const [newSheetCost, setNewSheetCost] = useState('');
  const [newThickness, setNewThickness] = useState('');
  const [newThicknessCost, setNewThicknessCost] = useState('');

  // Sync from settings
  useEffect(() => {
    const resolved = resolvePricingAssumptions(settings?.pricingAssumptions);
    setCutting(resolved.cutting);
    setBuffers(resolved.buffers);
    setYields(resolved.yields);
    setMinimums(resolved.minimums);
    setGlass(resolved.glass);
    setDefaultSheetCosts(resolved.defaultSheetCosts);
    setDefaultCostByThickness(resolved.defaultCostByThickness);
    setFallbackSheetCost(resolved.fallbackSheetCost);
  }, [settings?.pricingAssumptions]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const pricingAssumptions = {
        cutting,
        buffers,
        yields,
        minimums,
        glass,
        defaultSheetCosts,
        defaultCostByThickness,
        fallbackSheetCost,
        labor: (DEFAULT_PRICING_ASSUMPTIONS as any).labor || {},
        updatedAt: new Date().toISOString(),
      };
      await updateSettings({ pricingAssumptions } as any);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save pricing assumptions:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setCutting(DEFAULT_PRICING_ASSUMPTIONS.cutting);
    setBuffers(DEFAULT_PRICING_ASSUMPTIONS.buffers);
    setYields(DEFAULT_PRICING_ASSUMPTIONS.yields);
    setMinimums(DEFAULT_PRICING_ASSUMPTIONS.minimums);
    setGlass(DEFAULT_PRICING_ASSUMPTIONS.glass);
    setDefaultSheetCosts(DEFAULT_PRICING_ASSUMPTIONS.defaultSheetCosts);
    setDefaultCostByThickness(DEFAULT_PRICING_ASSUMPTIONS.defaultCostByThickness);
    setFallbackSheetCost(DEFAULT_PRICING_ASSUMPTIONS.fallbackSheetCost);
  };

  const handleCancel = () => {
    const resolved = resolvePricingAssumptions(settings?.pricingAssumptions);
    setCutting(resolved.cutting);
    setBuffers(resolved.buffers);
    setYields(resolved.yields);
    setMinimums(resolved.minimums);
    setGlass(resolved.glass);
    setDefaultSheetCosts(resolved.defaultSheetCosts);
    setDefaultCostByThickness(resolved.defaultCostByThickness);
    setFallbackSheetCost(resolved.fallbackSheetCost);
    setIsEditing(false);
  };

  /** Convert buffer multiplier (1.10) to percentage string (10) and back */
  const bufferToPercent = (val: number) => Math.round((val - 1) * 100);
  const percentToBuffer = (pct: number) => 1 + pct / 100;

  return (
    <div className="border-t border-gray-200 pt-6 mt-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-3 w-full text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
        <Calculator className="w-5 h-5 text-gray-500" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            Pricing &amp; Optimization Defaults
          </h3>
          <p className="text-sm text-gray-500">
            Default kerf, cost buffers, yield targets, minimum offcuts, and fallback material costs
          </p>
        </div>
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-6">
          {/* Action Bar */}
          <div className="flex items-center justify-end gap-2">
            {canEdit && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-[#872E5C] hover:text-[#6a2449]"
              >
                Edit Defaults
              </button>
            )}
            {isEditing && (
              <>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset to Defaults
                </button>
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[#872E5C] text-white rounded-lg hover:bg-[#6a2449] disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save Defaults
                </button>
              </>
            )}
          </div>

          {/* ── Cutting Parameters ── */}
          <FieldGroup title="Saw Kerf / Blade Width">
            <NumField
              label="Panel Saw Kerf"
              value={cutting.panelKerfMm}
              unit="mm"
              step={0.1}
              editing={isEditing}
              onChange={(v) => setCutting({ ...cutting, panelKerfMm: v })}
            />
            <NumField
              label="Timber Saw Kerf"
              value={cutting.timberKerfMm}
              unit="mm"
              step={0.1}
              editing={isEditing}
              onChange={(v) => setCutting({ ...cutting, timberKerfMm: v })}
            />
            <NumField
              label="Glass Kerf"
              value={cutting.glassKerfMm}
              unit="mm"
              step={0.1}
              editing={isEditing}
              onChange={(v) => setCutting({ ...cutting, glassKerfMm: v })}
            />
          </FieldGroup>

          {/* ── Cost Buffers ── */}
          <FieldGroup title="Estimation Cost Buffers">
            <NumField
              label="Panel Buffer"
              value={bufferToPercent(buffers.panelBuffer)}
              unit="%"
              step={1}
              editing={isEditing}
              onChange={(v) => setBuffers({ ...buffers, panelBuffer: percentToBuffer(v) })}
            />
            <NumField
              label="Timber Buffer"
              value={bufferToPercent(buffers.timberBuffer)}
              unit="%"
              step={1}
              editing={isEditing}
              onChange={(v) => setBuffers({ ...buffers, timberBuffer: percentToBuffer(v) })}
            />
            <NumField
              label="Linear Stock Buffer"
              value={bufferToPercent(buffers.linearBuffer)}
              unit="%"
              step={1}
              editing={isEditing}
              onChange={(v) => setBuffers({ ...buffers, linearBuffer: percentToBuffer(v) })}
            />
            <NumField
              label="Glass Buffer"
              value={bufferToPercent(buffers.glassBuffer)}
              unit="%"
              step={1}
              editing={isEditing}
              onChange={(v) => setBuffers({ ...buffers, glassBuffer: percentToBuffer(v) })}
            />
          </FieldGroup>

          {/* ── Target Yields ── */}
          <FieldGroup title="Target Yields">
            <NumField
              label="Panel Target Yield"
              value={yields.panelTargetYield}
              unit="%"
              step={1}
              editing={isEditing}
              onChange={(v) => setYields({ ...yields, panelTargetYield: v })}
            />
            <NumField
              label="Timber Target Yield"
              value={yields.timberTargetYield}
              unit="%"
              step={1}
              editing={isEditing}
              onChange={(v) => setYields({ ...yields, timberTargetYield: v })}
            />
            <NumField
              label="Linear Stock Target Yield"
              value={yields.linearTargetYield}
              unit="%"
              step={1}
              editing={isEditing}
              onChange={(v) => setYields({ ...yields, linearTargetYield: v })}
            />
            <NumField
              label="Glass Target Yield"
              value={yields.glassTargetYield}
              unit="%"
              step={1}
              editing={isEditing}
              onChange={(v) => setYields({ ...yields, glassTargetYield: v })}
            />
            <NumField
              label="Estimation Utilization"
              value={yields.estimationUtilization}
              unit="%"
              step={1}
              editing={isEditing}
              onChange={(v) => setYields({ ...yields, estimationUtilization: v })}
            />
          </FieldGroup>

          {/* ── Minimum Reusable Sizes ── */}
          <FieldGroup title="Minimum Reusable Sizes">
            <NumField
              label="Timber Min Offcut Length"
              value={minimums.timberMinOffcutMm}
              unit="mm"
              step={10}
              editing={isEditing}
              onChange={(v) => setMinimums({ ...minimums, timberMinOffcutMm: v })}
            />
            <NumField
              label="Linear Min Offcut Length"
              value={minimums.linearMinOffcutMm}
              unit="mm"
              step={10}
              editing={isEditing}
              onChange={(v) => setMinimums({ ...minimums, linearMinOffcutMm: v })}
            />
            <NumField
              label="Panel Min Usable Width"
              value={minimums.panelMinUsableWidth}
              unit="mm"
              step={10}
              editing={isEditing}
              onChange={(v) => setMinimums({ ...minimums, panelMinUsableWidth: v })}
            />
            <NumField
              label="Panel Min Usable Height"
              value={minimums.panelMinUsableHeight}
              unit="mm"
              step={10}
              editing={isEditing}
              onChange={(v) => setMinimums({ ...minimums, panelMinUsableHeight: v })}
            />
            <NumField
              label="Glass Min Cut Length"
              value={minimums.glassMinCutLength}
              unit="mm"
              step={10}
              editing={isEditing}
              onChange={(v) => setMinimums({ ...minimums, glassMinCutLength: v })}
            />
            <NumField
              label="Glass Min Cut Width"
              value={minimums.glassMinCutWidth}
              unit="mm"
              step={10}
              editing={isEditing}
              onChange={(v) => setMinimums({ ...minimums, glassMinCutWidth: v })}
            />
          </FieldGroup>

          {/* ── Glass-Specific ── */}
          <FieldGroup title="Glass Settings">
            <NumField
              label="Edge Safety Margin"
              value={glass.safetyMarginMm}
              unit="mm"
              step={1}
              editing={isEditing}
              onChange={(v) => setGlass({ ...glass, safetyMarginMm: v })}
            />
            <NumField
              label="Waste Reusability Threshold"
              value={glass.wasteReusabilityThresholdMm2}
              unit="mm²"
              step={1000}
              editing={isEditing}
              onChange={(v) => setGlass({ ...glass, wasteReusabilityThresholdMm2: v })}
            />
          </FieldGroup>

          {/* ── Default Sheet Costs ── */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Default Sheet Material Costs (UGX)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="px-3 py-2 text-left font-medium">Material</th>
                    <th className="px-3 py-2 text-right font-medium">Cost per Sheet</th>
                    {isEditing && <th className="px-3 py-2 w-10" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(defaultSheetCosts)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([name, cost]) => (
                      <tr key={name} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900">{name}</td>
                        <td className="px-3 py-2 text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              min={0}
                              value={cost}
                              onChange={(e) =>
                                setDefaultSheetCosts({
                                  ...defaultSheetCosts,
                                  [name]: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-28 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:ring-1 focus:ring-[#872E5C]"
                            />
                          ) : (
                            <span>{cost.toLocaleString()} UGX</span>
                          )}
                        </td>
                        {isEditing && (
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => {
                                const updated = { ...defaultSheetCosts };
                                delete updated[name];
                                setDefaultSheetCosts(updated);
                              }}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  {isEditing && (
                    <tr className="bg-gray-50/50">
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          placeholder="Material name"
                          value={newSheetName}
                          onChange={(e) => setNewSheetName(e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-[#872E5C]"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          placeholder="Cost"
                          value={newSheetCost}
                          onChange={(e) => setNewSheetCost(e.target.value)}
                          className="w-28 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:ring-1 focus:ring-[#872E5C]"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => {
                            if (newSheetName.trim() && newSheetCost) {
                              setDefaultSheetCosts({
                                ...defaultSheetCosts,
                                [newSheetName.trim()]: parseFloat(newSheetCost) || 0,
                              });
                              setNewSheetName('');
                              setNewSheetCost('');
                            }
                          }}
                          disabled={!newSheetName.trim() || !newSheetCost}
                          className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-30"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Default Costs by Thickness ── */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Fallback Cost by Thickness (UGX)
            </h4>
            <p className="text-xs text-gray-400 mb-2">
              Used when a material has no inventory mapping and no named cost above
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="px-3 py-2 text-left font-medium">Thickness (mm)</th>
                    <th className="px-3 py-2 text-right font-medium">Cost per Sheet</th>
                    {isEditing && <th className="px-3 py-2 w-10" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(defaultCostByThickness)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([thickness, cost]) => (
                      <tr key={thickness} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900">{thickness} mm</td>
                        <td className="px-3 py-2 text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              min={0}
                              value={cost}
                              onChange={(e) =>
                                setDefaultCostByThickness({
                                  ...defaultCostByThickness,
                                  [thickness]: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-28 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:ring-1 focus:ring-[#872E5C]"
                            />
                          ) : (
                            <span>{cost.toLocaleString()} UGX</span>
                          )}
                        </td>
                        {isEditing && (
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => {
                                const updated = { ...defaultCostByThickness };
                                delete updated[thickness];
                                setDefaultCostByThickness(updated);
                              }}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  {isEditing && (
                    <tr className="bg-gray-50/50">
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          placeholder="Thickness"
                          value={newThickness}
                          onChange={(e) => setNewThickness(e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-[#872E5C]"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          placeholder="Cost"
                          value={newThicknessCost}
                          onChange={(e) => setNewThicknessCost(e.target.value)}
                          className="w-28 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:ring-1 focus:ring-[#872E5C]"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => {
                            if (newThickness && newThicknessCost) {
                              setDefaultCostByThickness({
                                ...defaultCostByThickness,
                                [newThickness]: parseFloat(newThicknessCost) || 0,
                              });
                              setNewThickness('');
                              setNewThicknessCost('');
                            }
                          }}
                          disabled={!newThickness || !newThicknessCost}
                          className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-30"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Fallback cost */}
            <div className="mt-3">
              <NumField
                label="Fallback Sheet Cost (when thickness not listed)"
                value={fallbackSheetCost}
                unit="UGX"
                step={1000}
                editing={isEditing}
                onChange={setFallbackSheetCost}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Shared Sub-components
// ============================================

function FieldGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
        {title}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{children}</div>
    </div>
  );
}

function NumField({
  label,
  value,
  unit,
  step = 1,
  editing,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  step?: number;
  editing: boolean;
  onChange: (val: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
          />
          <span className="text-sm text-gray-500">{unit}</span>
        </div>
      ) : (
        <p className="text-gray-900">
          {value.toLocaleString()} {unit}
        </p>
      )}
    </div>
  );
}

export default PricingAssumptionsSection;
