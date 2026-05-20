/**
 * Workshop Processing Rates Section
 *
 * Collapsible settings section for configuring timber and panel
 * processing step rates (planing, crosscut, rip, routing, panel saw, edge banding).
 *
 * Shared component used by both global Settings and Finance Settings.
 */

import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Wrench,
  Save,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import type { WorkshopProcessingRates, ProcessingStepRate } from '@/shared/types/processingSteps';
import { DEFAULT_WORKSHOP_PROCESSING_RATES } from '@/shared/types/processingSteps';
import type { OrganizationSettings } from '@/core/settings/types';

// ============================================
// Props
// ============================================

interface WorkshopProcessingRatesSectionProps {
  canEdit: boolean;
  settings: OrganizationSettings | null;
  updateSettings: (updates: Partial<OrganizationSettings>) => Promise<void>;
  defaultExpanded?: boolean;
}

// ============================================
// Component
// ============================================

export function WorkshopProcessingRatesSection({
  canEdit,
  settings,
  updateSettings,
  defaultExpanded = false,
}: WorkshopProcessingRatesSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rates, setRates] = useState<ProcessingStepRate[]>([]);
  const [planingAllowance, setPlaningAllowance] = useState(3);
  const [edgeBandingMaterial, setEdgeBandingMaterial] = useState('PVC');
  const [edgeBandMaterialCost, setEdgeBandMaterialCost] = useState(2000);

  // Initialize from settings or defaults
  useEffect(() => {
    const workshopRates = settings?.workshopProcessingRates || DEFAULT_WORKSHOP_PROCESSING_RATES;
    setRates(workshopRates.rates);
    setPlaningAllowance(workshopRates.planingAllowancePerSide);
    setEdgeBandingMaterial(workshopRates.defaultEdgeBandingMaterial);
    setEdgeBandMaterialCost(workshopRates.edgeBandMaterialCostPerMeter ?? 2000);
  }, [settings?.workshopProcessingRates]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const workshopProcessingRates: WorkshopProcessingRates = {
        rates,
        planingAllowancePerSide: planingAllowance,
        defaultEdgeBandingMaterial: edgeBandingMaterial,
        edgeBandMaterialCostPerMeter: edgeBandMaterialCost,
        updatedAt: new Date().toISOString(),
      };
      await updateSettings({ workshopProcessingRates });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save workshop rates:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setRates(DEFAULT_WORKSHOP_PROCESSING_RATES.rates);
    setPlaningAllowance(DEFAULT_WORKSHOP_PROCESSING_RATES.planingAllowancePerSide);
    setEdgeBandingMaterial(DEFAULT_WORKSHOP_PROCESSING_RATES.defaultEdgeBandingMaterial);
    setEdgeBandMaterialCost(DEFAULT_WORKSHOP_PROCESSING_RATES.edgeBandMaterialCostPerMeter);
  };

  const handleCancel = () => {
    const workshopRates = settings?.workshopProcessingRates || DEFAULT_WORKSHOP_PROCESSING_RATES;
    setRates(workshopRates.rates);
    setPlaningAllowance(workshopRates.planingAllowancePerSide);
    setEdgeBandingMaterial(workshopRates.defaultEdgeBandingMaterial);
    setEdgeBandMaterialCost(workshopRates.edgeBandMaterialCostPerMeter ?? 2000);
    setIsEditing(false);
  };

  const updateRate = (stepId: string, field: keyof ProcessingStepRate, value: number) => {
    setRates(prev =>
      prev.map(r => r.stepId === stepId ? { ...r, [field]: value } : r)
    );
  };

  const unitLabel = (method: string) => {
    switch (method) {
      case 'per_linear_meter': return 'UGX/m';
      case 'per_cut': return 'UGX/cut';
      case 'per_linear_meter_per_edge': return 'UGX/m';
      default: return 'UGX';
    }
  };

  const timberSteps = rates.filter(r =>
    ['planing', 'crosscut', 'rip', 'routing'].includes(r.stepId)
  );
  const panelSteps = rates.filter(r =>
    ['panel_saw_cut', 'edge_banding', 'edge_banding_material'].includes(r.stepId)
  );
  const glassSteps = rates.filter(r =>
    ['glass_scoring'].includes(r.stepId)
  );
  const metalSteps = rates.filter(r =>
    ['metal_saw_cut'].includes(r.stepId)
  );

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
        <Wrench className="w-5 h-5 text-gray-500" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">Workshop Processing Rates</h3>
          <p className="text-sm text-gray-500">
            Default rates for timber and panel processing steps used in material optimization
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
                Edit Rates
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
                  Save Rates
                </button>
              </>
            )}
          </div>

          {/* Global Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Planing Allowance (per side)
              </label>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    step={0.5}
                    value={planingAllowance}
                    onChange={(e) => setPlaningAllowance(parseFloat(e.target.value) || 3)}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                  />
                  <span className="text-sm text-gray-500">mm</span>
                </div>
              ) : (
                <p className="text-gray-900">{planingAllowance} mm</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Edge Band Material
              </label>
              {isEditing ? (
                <select
                  value={edgeBandingMaterial}
                  onChange={(e) => setEdgeBandingMaterial(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                >
                  <option value="PVC">PVC</option>
                  <option value="ABS">ABS</option>
                  <option value="Melamine">Melamine</option>
                  <option value="Veneer">Veneer</option>
                </select>
              ) : (
                <p className="text-gray-900">{edgeBandingMaterial}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Edge Band Material Cost
              </label>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={edgeBandMaterialCost}
                    onChange={(e) => setEdgeBandMaterialCost(parseFloat(e.target.value) || 2000)}
                    className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                  />
                  <span className="text-sm text-gray-500">UGX/m</span>
                </div>
              ) : (
                <p className="text-gray-900">{edgeBandMaterialCost.toLocaleString()} UGX/m</p>
              )}
            </div>
          </div>

          {/* Timber Processing Rates */}
          <RatesTable
            title="Timber Processing"
            steps={timberSteps}
            isEditing={isEditing}
            updateRate={updateRate}
            unitLabel={unitLabel}
          />

          {/* Panel Processing Rates */}
          <RatesTable
            title="Board/Panel Processing"
            steps={panelSteps}
            isEditing={isEditing}
            updateRate={updateRate}
            unitLabel={unitLabel}
          />

          {/* Glass Processing Rates */}
          {glassSteps.length > 0 && (
            <RatesTable
              title="Glass Processing"
              steps={glassSteps}
              isEditing={isEditing}
              updateRate={updateRate}
              unitLabel={unitLabel}
            />
          )}

          {/* Metal Processing Rates */}
          {metalSteps.length > 0 && (
            <RatesTable
              title="Metal / Linear Stock Processing"
              steps={metalSteps}
              isEditing={isEditing}
              updateRate={updateRate}
              unitLabel={unitLabel}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Rates Table Sub-component
// ============================================

function RatesTable({
  title,
  steps,
  isEditing,
  updateRate,
  unitLabel,
}: {
  title: string;
  steps: ProcessingStepRate[];
  isEditing: boolean;
  updateRate: (stepId: string, field: keyof ProcessingStepRate, value: number) => void;
  unitLabel: (method: string) => string;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
        {title}
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="px-3 py-2 text-left font-medium">Step</th>
              <th className="px-3 py-2 text-right font-medium">Rate</th>
              <th className="px-3 py-2 text-right font-medium">Setup (min)</th>
              <th className="px-3 py-2 text-right font-medium">Time/Unit (min)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {steps.map((step) => (
              <tr key={step.stepId} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-900">{step.label}</td>
                <td className="px-3 py-2 text-right">
                  {isEditing ? (
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        min={0}
                        value={step.ratePerUnit}
                        onChange={(e) => updateRate(step.stepId, 'ratePerUnit', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:ring-1 focus:ring-[#872E5C]"
                      />
                      <span className="text-gray-400 text-xs whitespace-nowrap">{unitLabel(step.costingMethod)}</span>
                    </div>
                  ) : (
                    <span>{step.ratePerUnit.toLocaleString()} {unitLabel(step.costingMethod)}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {isEditing ? (
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={step.setupTimeMinutes}
                      onChange={(e) => updateRate(step.stepId, 'setupTimeMinutes', parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:ring-1 focus:ring-[#872E5C]"
                    />
                  ) : (
                    <span>{step.setupTimeMinutes}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {isEditing ? (
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={step.timePerUnit}
                      onChange={(e) => updateRate(step.stepId, 'timePerUnit', parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:ring-1 focus:ring-[#872E5C]"
                    />
                  ) : (
                    <span>{step.timePerUnit}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
