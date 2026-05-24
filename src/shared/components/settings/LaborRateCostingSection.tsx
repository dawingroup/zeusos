/**
 * Labor Rate Costing Section
 *
 * Collapsible settings section for configuring the auto-calculated
 * blended labor cost per hour from actual payroll data.
 *
 * Follows the same edit/view mode pattern as PricingAssumptionsSection
 * and WorkshopProcessingRatesSection.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Calculator,
  Save,
  Loader2,
  Plus,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import type { OrganizationSettings } from '@/core/settings/types';
import type { PricingAssumptions } from '@/shared/types/pricingAssumptions';
import { DEFAULT_PRICING_ASSUMPTIONS, resolvePricingAssumptions } from '@/shared/types/pricingAssumptions';
import { DEPARTMENT_IDS } from '@/modules/intelligence/config/constants';
import { employeeService } from '@/modules/hr-central/services/employee.service';
import { calculateLaborRate, type LaborRateCalculation } from '@/modules/finance/services/laborRateCalculator';

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;
type LaborCostBucket = 'direct' | 'overhead';

// ============================================
// Department list from system constants
// ============================================

const BASE_DEPARTMENT_OPTIONS = Object.entries(DEPARTMENT_IDS).map(([key, value]) => ({
  id: value,
  label: key
    .split('_')
    .map(w => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' '),
}));

function toDepartmentLabel(departmentId: string): string {
  return departmentId
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ============================================
// Props
// ============================================

interface LaborRateCostingSectionProps {
  canEdit: boolean;
  settings: OrganizationSettings | null;
  updateSettings: (updates: Partial<OrganizationSettings>) => Promise<void>;
  defaultExpanded?: boolean;
}

// ============================================
// Component
// ============================================

export function LaborRateCostingSection({
  canEdit,
  settings,
  updateSettings,
  defaultExpanded = false,
}: LaborRateCostingSectionProps) {
  const normalizeContributors = (
    contributors: PricingAssumptions['labor']['partialContributors']
  ): PricingAssumptions['labor']['partialContributors'] =>
    contributors.map((c) => ({
      ...c,
      costBucket: c.costBucket === 'direct' ? 'direct' : 'overhead',
    }));

  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculation, setCalculation] = useState<LaborRateCalculation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [departmentOptions, setDepartmentOptions] = useState(BASE_DEPARTMENT_OPTIONS);

  // Labor config state
  const resolved = resolvePricingAssumptions(settings?.pricingAssumptions);
  const [productionDeptId, setProductionDeptId] = useState(resolved.labor.productionDepartmentId);
  const [partialContributors, setPartialContributors] = useState(
    normalizeContributors(resolved.labor.partialContributors)
  );
  const [hoursPerDay, setHoursPerDay] = useState(resolved.labor.hoursPerDay);
  const [workingDaysPerMonth, setWorkingDaysPerMonth] = useState(resolved.labor.workingDaysPerMonth);
  const [productiveHoursPercent, setProductiveHoursPercent] = useState<number>(
    resolved.labor.productiveHoursPercent ?? 85
  );
  const [manualOverride, setManualOverride] = useState<number | undefined>(resolved.labor.manualOverride);
  const [cachedRate, setCachedRate] = useState<number | undefined>(resolved.labor.calculatedRate);
  const [cachedAt, setCachedAt] = useState<string | undefined>(resolved.labor.calculatedAt);

  // Sync from settings when they change
  useEffect(() => {
    const r = resolvePricingAssumptions(settings?.pricingAssumptions);
    setProductionDeptId(r.labor.productionDepartmentId);
    setPartialContributors(normalizeContributors(r.labor.partialContributors));
    setHoursPerDay(r.labor.hoursPerDay);
    setWorkingDaysPerMonth(r.labor.workingDaysPerMonth);
    setProductiveHoursPercent(r.labor.productiveHoursPercent ?? 85);
    setManualOverride(r.labor.manualOverride);
    setCachedRate(r.labor.calculatedRate);
    setCachedAt(r.labor.calculatedAt);
  }, [settings?.pricingAssumptions]);

  useEffect(() => {
    let cancelled = false;
    const loadLiveDepartments = async () => {
      try {
        const stats = await employeeService.getEmployeeStats();
        const liveDepartmentIds = Object.keys(stats.byDepartment || {});
        if (!liveDepartmentIds.length || cancelled) return;

        const mergedMap = new Map<string, string>(
          BASE_DEPARTMENT_OPTIONS.map((d) => [d.id, d.label])
        );
        for (const deptId of liveDepartmentIds) {
          if (!mergedMap.has(deptId)) {
            mergedMap.set(deptId, toDepartmentLabel(deptId));
          }
        }

        if (!cancelled) {
          setDepartmentOptions(
            Array.from(mergedMap.entries()).map(([id, label]) => ({ id, label })) as typeof BASE_DEPARTMENT_OPTIONS
          );
        }
      } catch {
        // keep defaults if we cannot load live departments
      }
    };

    void loadLiveDepartments();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistAutoCalculatedRate = useCallback(async (nextRate: number, nextCalculatedAt: string) => {
    if (!settings) return;

    const currentAssumptions = resolvePricingAssumptions(settings.pricingAssumptions);
    if (currentAssumptions.labor.calculatedRate === nextRate) {
      return;
    }

    const updatedAssumptions: PricingAssumptions = {
      ...currentAssumptions,
      labor: {
        ...currentAssumptions.labor,
        calculatedRate: nextRate,
        calculatedAt: nextCalculatedAt,
      },
      updatedAt: nextCalculatedAt,
    };

    await updateSettings({ pricingAssumptions: updatedAssumptions });
  }, [settings, updateSettings]);

  const handleCalculate = async () => {
    setIsCalculating(true);
    setError(null);
    setCalculation(null);

    try {
      const result = await calculateLaborRate({
        productionDepartmentId: productionDeptId,
        partialContributors,
        hoursPerDay,
        workingDaysPerMonth,
        productiveHoursPercent,
      });

      if (result.staff.length === 0) {
        setError('No active employees with payroll or contract pay data were found for calculation.');
        return;
      }

      setCalculation(result);
      setCachedRate(result.calculatedRatePerHour);
      setCachedAt(new Date().toISOString());
    } catch (err) {
      console.error('Labor rate calculation failed:', err);
      setError('Failed to calculate labor rate. Please check department configuration.');
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    if (!isExpanded || isEditing) {
      return;
    }

    let cancelled = false;

    const syncFromPayroll = async () => {
      setIsCalculating(true);
      setError(null);
      try {
        const result = await calculateLaborRate({
          productionDepartmentId: productionDeptId,
          partialContributors,
          hoursPerDay,
          workingDaysPerMonth,
        });
        if (cancelled) return;

        if (result.staff.length === 0) {
          setError('No active employees with payroll or contract pay data were found for calculation.');
          return;
        }

        const calculatedAtIso = new Date().toISOString();
        setCalculation(result);
        setCachedRate(result.calculatedRatePerHour);
        setCachedAt(calculatedAtIso);
        await persistAutoCalculatedRate(result.calculatedRatePerHour, calculatedAtIso);
      } catch (err) {
        if (cancelled) return;
        console.error('Auto-sync labor rate failed:', err);
        setError('Auto-sync failed. You can still recalculate manually.');
      } finally {
        if (!cancelled) setIsCalculating(false);
      }
    };

    void syncFromPayroll();
    const timer = window.setInterval(() => {
      void syncFromPayroll();
    }, AUTO_SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    isExpanded,
    isEditing,
    productionDeptId,
    partialContributors,
    hoursPerDay,
    workingDaysPerMonth,
    productiveHoursPercent,
    settings?.pricingAssumptions,
    persistAutoCalculatedRate,
  ]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const currentAssumptions = settings?.pricingAssumptions || {};
      // Build labor config, omitting undefined fields (Firestore rejects undefined)
      const laborConfig: Record<string, unknown> = {
        productionDepartmentId: productionDeptId,
        partialContributors,
        hoursPerDay,
        workingDaysPerMonth,
        productiveHoursPercent,
      };
      if (cachedRate != null) laborConfig.calculatedRate = cachedRate;
      if (cachedAt != null) laborConfig.calculatedAt = cachedAt;
      if (manualOverride != null && manualOverride > 0) laborConfig.manualOverride = manualOverride;

      const updatedAssumptions: Partial<PricingAssumptions> = {
        ...currentAssumptions,
        labor: laborConfig as PricingAssumptions['labor'],
        updatedAt: new Date().toISOString(),
      };
      await updateSettings({ pricingAssumptions: updatedAssumptions as PricingAssumptions });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save labor config:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    const r = resolvePricingAssumptions(settings?.pricingAssumptions);
    setProductionDeptId(r.labor.productionDepartmentId);
    setPartialContributors(normalizeContributors(r.labor.partialContributors));
    setHoursPerDay(r.labor.hoursPerDay);
    setWorkingDaysPerMonth(r.labor.workingDaysPerMonth);
    setProductiveHoursPercent(r.labor.productiveHoursPercent ?? 85);
    setManualOverride(r.labor.manualOverride);
    setCachedRate(r.labor.calculatedRate);
    setCachedAt(r.labor.calculatedAt);
    setCalculation(null);
    setError(null);
    setIsEditing(false);
  };

  const handleReset = () => {
    setProductionDeptId(DEFAULT_PRICING_ASSUMPTIONS.labor.productionDepartmentId);
    setPartialContributors(normalizeContributors(DEFAULT_PRICING_ASSUMPTIONS.labor.partialContributors));
    setHoursPerDay(DEFAULT_PRICING_ASSUMPTIONS.labor.hoursPerDay);
    setWorkingDaysPerMonth(DEFAULT_PRICING_ASSUMPTIONS.labor.workingDaysPerMonth);
    setProductiveHoursPercent(DEFAULT_PRICING_ASSUMPTIONS.labor.productiveHoursPercent ?? 85);
    setManualOverride(undefined);
    setCachedRate(undefined);
    setCachedAt(undefined);
    setCalculation(null);
  };

  // Partial contributor management
  const addPartialContributor = () => {
    setPartialContributors(prev => [
      ...prev,
      { departmentId: '', departmentName: '', allocationPercent: 20, costBucket: 'overhead' },
    ]);
  };

  const updatePartialContributor = (index: number, field: string, value: string | number) => {
    setPartialContributors(prev => prev.map((c, i) => {
      if (i !== index) return c;
      if (field === 'departmentId') {
        const dept = departmentOptions.find(d => d.id === value);
        return { ...c, departmentId: value as string, departmentName: dept?.label || '' };
      }
      if (field === 'costBucket') {
        return { ...c, costBucket: value as LaborCostBucket };
      }
      return { ...c, [field]: value };
    }));
  };

  const removePartialContributor = (index: number) => {
    setPartialContributors(prev => prev.filter((_, i) => i !== index));
  };

  const productionDeptLabel = departmentOptions.find(d => d.id === productionDeptId)?.label || '';
  const effectiveRate = manualOverride || cachedRate || 0;
  const calculatedRate = calculation?.calculatedRatePerHour || cachedRate || 0;
  const monthlyHours = hoursPerDay * workingDaysPerMonth;
  const productiveMonthlyHours = Math.round(monthlyHours * (productiveHoursPercent / 100));

  return (
    <div className="border-t border-[var(--border-subtle)] pt-6 mt-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-3 w-full text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-[var(--fg-tertiary)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--fg-tertiary)]" />
        )}
        <Calculator className="w-5 h-5 text-muted-foreground" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground">Labor Rate Calculator</h3>
          <p className="text-sm text-muted-foreground">
            Auto-calculate blended labor cost per hour from payroll data
          </p>
        </div>
        {effectiveRate > 0 && !isExpanded && (
          <span className="text-sm font-medium text-muted-foreground">
            {effectiveRate.toLocaleString()} UGX/hr
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-6">
          {/* Action Bar */}
          <div className="flex items-center justify-end gap-2">
            {canEdit && !isEditing && (
              <>
                <button
                  onClick={handleCalculate}
                  disabled={isCalculating || !productionDeptId}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:bg-[var(--bg-sunken)] rounded-lg disabled:opacity-50"
                >
                  {isCalculating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Calculator className="w-3.5 h-3.5" />
                  )}
                  Recalculate
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-sm text-[#872E5C] hover:text-[#6a2449]"
                >
                  Edit Labor Config
                </button>
              </>
            )}
            {isEditing && (
              <>
                <button
                  onClick={handleCalculate}
                  disabled={isCalculating || !productionDeptId}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:bg-[var(--bg-sunken)] rounded-lg disabled:opacity-50"
                >
                  {isCalculating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Calculator className="w-3.5 h-3.5" />
                  )}
                  Recalculate
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:bg-[var(--bg-sunken)] rounded-lg"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset to Defaults
                </button>
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:bg-[var(--bg-sunken)] rounded-lg"
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
                  Save Config
                </button>
              </>
            )}
          </div>
          {!manualOverride && (
            <p className="text-xs text-muted-foreground -mt-3">
              Auto-sync is enabled: rate refreshes from HR payroll data every 5 minutes while this panel is open.
            </p>
          )}
          <p className="text-xs text-muted-foreground -mt-4">
            Tip: add the same department multiple times to split direct vs overhead allocations.
          </p>

          {/* Current Rate Display */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Active Labor Rate
              </label>
              <p className="text-foreground">
                {effectiveRate > 0
                  ? `${effectiveRate.toLocaleString()} UGX/hr`
                  : 'Not configured'}
                {manualOverride ? (
                  <span className="ml-2 text-xs text-muted-foreground">(manual override)</span>
                ) : cachedAt ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (synced {new Date(cachedAt).toLocaleString()})
                  </span>
                ) : null}
              </p>
              {calculation && (
                <p className="text-xs text-muted-foreground mt-1">
                  Direct {calculation.directRatePerHour.toLocaleString()} + Overhead {calculation.overheadRatePerHour.toLocaleString()} = {calculation.calculatedRatePerHour.toLocaleString()} UGX/hr
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Calculated Labor Rate
              </label>
              <p className="text-foreground">
                {calculatedRate > 0
                  ? `${calculatedRate.toLocaleString()} UGX/hr`
                  : 'Not calculated'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Returned by payroll calculator
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Production Department
              </label>
              {isEditing ? (
                <select
                  value={productionDeptId}
                  onChange={(e) => setProductionDeptId(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                >
                  <option value="">Select department...</option>
                  {departmentOptions.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.label}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-foreground">{productionDeptLabel || 'Not selected'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Manual Override
              </label>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={manualOverride || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setManualOverride(val > 0 ? val : undefined);
                    }}
                    placeholder="Auto"
                    className="w-28 px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                  />
                  <span className="text-sm text-muted-foreground">UGX/hr</span>
                </div>
              ) : (
                <p className="text-foreground">
                  {manualOverride ? `${manualOverride.toLocaleString()} UGX/hr` : 'None (use calculated)'}
                </p>
              )}
            </div>
          </div>

          {/* Working Hours */}
          <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
            Working Hours
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Hours per Day
              </label>
              {isEditing ? (
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(parseInt(e.target.value) || 8)}
                  className="w-24 px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                />
              ) : (
                <p className="text-foreground">{hoursPerDay} hrs</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Working Days / Month
              </label>
              {isEditing ? (
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={workingDaysPerMonth}
                  onChange={(e) => setWorkingDaysPerMonth(parseInt(e.target.value) || 22)}
                  className="w-24 px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                />
              ) : (
                <p className="text-foreground">{workingDaysPerMonth} days</p>
              )}
            </div>
            <div>
              <label
                className="block text-sm font-medium text-muted-foreground mb-1"
                title="Share of paid hours that are actually productive — net of leave, public holidays, sick days, and idle time. Lower this if your team typically loses time to non-billable activities."
              >
                Productive Hours %
              </label>
              {isEditing ? (
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={productiveHoursPercent}
                  onChange={(e) => setProductiveHoursPercent(parseInt(e.target.value) || 85)}
                  className="w-24 px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                />
              ) : (
                <p className="text-foreground">{productiveHoursPercent}%</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Monthly Hours
              </label>
              <p className="text-foreground">
                <span className="font-medium">{productiveMonthlyHours}</span>
                <span className="text-[var(--fg-tertiary)]"> productive · {monthlyHours} paid</span>
              </p>
            </div>
          </div>

          {/* Partial Contributors */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Partial Contributors
              </h4>
              {isEditing && (
                <button
                  onClick={addPartialContributor}
                  className="flex items-center gap-1 text-xs text-[#872E5C] hover:text-[#6a2449]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Department
                </button>
              )}
            </div>

            {partialContributors.length === 0 ? (
              <p className="text-sm text-[var(--fg-tertiary)] italic">No partial contributors configured</p>
            ) : isEditing ? (
              <div className="space-y-2">
                {partialContributors.map((contributor, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <select
                      value={contributor.departmentId}
                      onChange={(e) => updatePartialContributor(index, 'departmentId', e.target.value)}
                      className="flex-1 max-w-sm px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                    >
                      <option value="">Select department...</option>
                      {departmentOptions.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={contributor.costBucket || 'overhead'}
                      onChange={(e) => updatePartialContributor(index, 'costBucket', e.target.value)}
                      className="w-28 px-2 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                    >
                      <option value="direct">Direct</option>
                      <option value="overhead">Overhead</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={contributor.allocationPercent}
                        onChange={(e) => updatePartialContributor(index, 'allocationPercent', parseInt(e.target.value) || 0)}
                        className="w-20 px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm text-right focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                    <button
                      onClick={() => removePartialContributor(index)}
                      className="p-1.5 text-[var(--fg-tertiary)] hover:text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--bg-sunken)] text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Department</th>
                      <th className="px-3 py-2 text-left font-medium">Bucket</th>
                      <th className="px-3 py-2 text-right font-medium">Allocation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {partialContributors.map((c, i) => (
                      <tr key={i} className="hover:bg-[var(--bg-sunken)]">
                        <td className="px-3 py-2 text-foreground">{c.departmentName || c.departmentId}</td>
                        <td className="px-3 py-2 text-muted-foreground capitalize">{c.costBucket || 'overhead'}</td>
                        <td className="px-3 py-2 text-right text-foreground">{c.allocationPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Calculation Results */}
          {calculation && (
            <div>
              {calculation.usedOrgWideFallback && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <span className="font-medium">Heads up:</span> the configured production
                  department doesn't match any active employees, so the rate below averages
                  cost across <em>all</em> active staff (including back-office). Set a real
                  production department above for an accurate direct-labor rate.
                </div>
              )}
              <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                Calculation Breakdown
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--bg-sunken)] text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium">Department</th>
                      <th
                        className="px-3 py-2 text-right font-medium"
                        title="Fully-loaded monthly cost: gross pay + employer NSSF (10%). Sourced from latest payroll, then active contract, then employee record."
                      >
                        Loaded Cost
                      </th>
                      <th className="px-3 py-2 text-left font-medium">Source</th>
                      <th className="px-3 py-2 text-left font-medium">Bucket</th>
                      <th className="px-3 py-2 text-right font-medium">Allocation</th>
                      <th className="px-3 py-2 text-right font-medium">Weighted Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {calculation.staff.map((entry) => (
                      <tr key={entry.employeeId} className="hover:bg-[var(--bg-sunken)]">
                        <td className="px-3 py-2 text-foreground">{entry.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{entry.department}</td>
                        <td className="px-3 py-2 text-right text-foreground">
                          {entry.monthlyPayCost.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground capitalize">
                          {entry.paySource === 'employee_record' ? 'Employee record' : entry.paySource}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground capitalize">
                          {entry.costBucket}
                        </td>
                        <td className="px-3 py-2 text-right text-foreground">
                          {Math.round(entry.allocation * 100)}%
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-foreground">
                          {entry.weightedCost.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[var(--bg-sunken)] font-medium">
                      <td colSpan={6} className="px-3 py-2 text-right text-muted-foreground">
                        Total Weighted Cost
                      </td>
                      <td className="px-3 py-2 text-right text-foreground">
                        {calculation.totalWeightedMonthlyCost.toLocaleString()} UGX
                      </td>
                    </tr>
                    <tr className="bg-[var(--bg-sunken)] font-medium">
                      <td colSpan={6} className="px-3 py-2 text-right text-muted-foreground">
                        Direct Cost {calculation.directWeightedMonthlyCost.toLocaleString()} UGX + Overhead Cost {calculation.overheadWeightedMonthlyCost.toLocaleString()} UGX
                      </td>
                      <td className="px-3 py-2 text-right text-foreground">
                        {calculation.directRatePerHour.toLocaleString()} + {calculation.overheadRatePerHour.toLocaleString()} UGX/hr
                      </td>
                    </tr>
                    <tr className="bg-[var(--bg-sunken)] font-medium">
                      <td colSpan={6} className="px-3 py-2 text-right text-muted-foreground">
                        {calculation.headcount.fullTime} full-time + {calculation.headcount.partial} partial = {calculation.totalPlannedMonthlyHours} hrs/month
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-foreground">
                        {calculation.calculatedRatePerHour.toLocaleString()} UGX/hr
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
