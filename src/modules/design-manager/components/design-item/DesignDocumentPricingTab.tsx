/**
 * Design Document Pricing Tab
 * Matrix-based pricing: Professional Roles × Design Stages
 * Plus pass-through costs (logistics, external studies)
 */

import { useState, useMemo } from 'react';
import { Plus, Trash2, Settings, Download, Truck, FlaskConical } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { DesignItem, ArchitecturalPricing } from '../../types';
import type {
  PricingDesignStage,
  StaffRole,
  BottomUpPricingConfig,
} from '../../types/bottomUpPricing';
import {
  PRICING_DESIGN_STAGE_LABELS,
  STAFF_ROLE_LABELS,
  DEFAULT_BOTTOM_UP_PRICING_CONFIG,
} from '../../types/bottomUpPricing';
import { getRateForRole } from '../../services/bottomUpPricingService';
import { nanoid } from 'nanoid';

export interface DesignDocumentPricingTabProps {
  item: DesignItem;
  projectId: string;
  userId: string;
  onUpdate: (updates: Partial<ArchitecturalPricing>) => Promise<void>;
  readOnly?: boolean;
}

const STAGE_OPTIONS: PricingDesignStage[] = ['concept', 'schematic', 'design-development', 'construction-docs'];
const ROLE_OPTIONS: StaffRole[] = ['principal', 'senior-engineer', 'mid-level-architect', 'junior-drafter'];

// Matrix structure stored in architectural.pricingMatrix
interface PricingMatrix {
  [key: string]: number; // key format: "role_stage" -> hours
}

interface LogisticsItem {
  id: string;
  description: string;
  amount: number;
}

interface ExternalStudyItem {
  id: string;
  description: string;
  amount: number;
}

export function DesignDocumentPricingTab({
  item,
  onUpdate,
  readOnly = false,
}: DesignDocumentPricingTabProps) {
  const pricing = item.architectural;

  // Initialize rate config from persisted data or defaults
  const [config, setConfig] = useState<BottomUpPricingConfig>(() => {
    const saved = (pricing as any)?.rateConfig as BottomUpPricingConfig | undefined;
    if (saved?.roles?.length) return saved;
    return DEFAULT_BOTTOM_UP_PRICING_CONFIG;
  });
  const [showRateConfig, setShowRateConfig] = useState(false);

  // Get matrix data from architectural field (or initialize empty)
  const matrix = useMemo<PricingMatrix>(() => {
    return (pricing as any)?.pricingMatrix || {};
  }, [pricing]);

  const logistics = useMemo<LogisticsItem[]>(() => {
    const raw = (pricing as any)?.logistics || [];
    return raw.map((item: any) => ({ ...item, amount: Number(item.amount) || 0 }));
  }, [pricing]);

  const externalStudies = useMemo<ExternalStudyItem[]>(() => {
    const raw = (pricing as any)?.externalStudies || [];
    return raw.map((item: any) => ({ ...item, amount: Number(item.amount) || 0 }));
  }, [pricing]);

  const adminFeePercent = useMemo(() => {
    return (pricing as any)?.adminFeePercent || 10;
  }, [pricing]);

  // State for adding logistics/studies
  const [newLogDesc, setNewLogDesc] = useState('');
  const [newLogAmt, setNewLogAmt] = useState('');
  const [newStudyDesc, setNewStudyDesc] = useState('');
  const [newStudyAmt, setNewStudyAmt] = useState('');

  const formatCurrency = (val: number) =>
    `UGX ${val.toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const getMatrixKey = (role: StaffRole, stage: PricingDesignStage) => `${role}_${stage}`;

  const getHours = (role: StaffRole, stage: PricingDesignStage): number => {
    return matrix[getMatrixKey(role, stage)] || 0;
  };

  // Compute totals from given data (used to include summary fields in every Firestore write)
  const computeTotals = (
    matrixData: PricingMatrix,
    rateConfig: BottomUpPricingConfig,
    logisticsData: LogisticsItem[],
    externalStudiesData: ExternalStudyItem[],
    adminFeePct: number,
  ) => {
    let laborHours = 0;
    let laborCost = 0;
    ROLE_OPTIONS.forEach(role => {
      const rate = getRateForRole(role, rateConfig);
      STAGE_OPTIONS.forEach(stage => {
        const hours = matrixData[getMatrixKey(role, stage)] || 0;
        laborHours += hours;
        laborCost += hours * rate;
      });
    });
    const logCost = logisticsData.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    const extCost = externalStudiesData.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    const adminFee = extCost * (adminFeePct / 100);
    const grand = laborCost + logCost + extCost + adminFee;
    return { totalCost: grand, totalHours: laborHours, totalLaborCost: laborCost };
  };

  // Helper: save data along with recomputed summary totals
  const saveWithTotals = async (
    updates: Record<string, any>,
    overrides?: { matrixData?: PricingMatrix; rateConfig?: BottomUpPricingConfig; logisticsData?: LogisticsItem[]; externalStudiesData?: ExternalStudyItem[]; adminFeePct?: number }
  ) => {
    const totals = computeTotals(
      overrides?.matrixData ?? matrix,
      overrides?.rateConfig ?? config,
      overrides?.logisticsData ?? logistics,
      overrides?.externalStudiesData ?? externalStudies,
      overrides?.adminFeePct ?? adminFeePercent,
    );
    await onUpdate({ ...updates, ...totals } as any);
  };

  const handleUpdateHours = async (role: StaffRole, stage: PricingDesignStage, hours: number) => {
    const key = getMatrixKey(role, stage);
    const updatedMatrix = { ...matrix, [key]: hours };
    await saveWithTotals({ pricingMatrix: updatedMatrix }, { matrixData: updatedMatrix });
  };

  const handleUpdateRate = async (role: StaffRole, rate: number) => {
    const updatedConfig: BottomUpPricingConfig = {
      ...config,
      roles: config.roles.map((r) => (r.id === role ? { ...r, hourlyRate: rate } : r)),
    };
    setConfig(updatedConfig);
    await saveWithTotals({ rateConfig: updatedConfig }, { rateConfig: updatedConfig });
  };

  const handleAddLogistics = async () => {
    if (!newLogDesc.trim() || !newLogAmt) return;
    const newItem: LogisticsItem = {
      id: nanoid(8),
      description: newLogDesc.trim(),
      amount: parseFloat(newLogAmt),
    };
    const updated = [...logistics, newItem];
    await saveWithTotals({ logistics: updated }, { logisticsData: updated });
    setNewLogDesc('');
    setNewLogAmt('');
  };

  const handleUpdateLogistics = async (id: string, updates: Partial<LogisticsItem>) => {
    const updated = logistics.map(item => item.id === id ? { ...item, ...updates } : item);
    await saveWithTotals({ logistics: updated }, { logisticsData: updated });
  };

  const handleRemoveLogistics = async (id: string) => {
    const updated = logistics.filter(item => item.id !== id);
    await saveWithTotals({ logistics: updated }, { logisticsData: updated });
  };

  const handleAddExternalStudy = async () => {
    if (!newStudyDesc.trim() || !newStudyAmt) return;
    const newItem: ExternalStudyItem = {
      id: nanoid(8),
      description: newStudyDesc.trim(),
      amount: parseFloat(newStudyAmt),
    };
    const updated = [...externalStudies, newItem];
    await saveWithTotals({ externalStudies: updated }, { externalStudiesData: updated });
    setNewStudyDesc('');
    setNewStudyAmt('');
  };

  const handleUpdateExternalStudy = async (id: string, updates: Partial<ExternalStudyItem>) => {
    const updated = externalStudies.map(item => item.id === id ? { ...item, ...updates } : item);
    await saveWithTotals({ externalStudies: updated }, { externalStudiesData: updated });
  };

  const handleRemoveExternalStudy = async (id: string) => {
    const updated = externalStudies.filter(item => item.id !== id);
    await saveWithTotals({ externalStudies: updated }, { externalStudiesData: updated });
  };

  const handleSetAdminFeePercent = async (pct: number) => {
    await saveWithTotals({ adminFeePercent: pct }, { adminFeePct: pct });
  };

  // Calculate totals
  const calculations = useMemo(() => {
    let totalLaborHours = 0;
    let totalLaborCost = 0;

    const byRole: Record<StaffRole, { hours: number; cost: number }> = {
      'principal': { hours: 0, cost: 0 },
      'senior-engineer': { hours: 0, cost: 0 },
      'mid-level-architect': { hours: 0, cost: 0 },
      'junior-drafter': { hours: 0, cost: 0 },
    };

    const byStage: Record<PricingDesignStage, { hours: number; cost: number }> = {
      'concept': { hours: 0, cost: 0 },
      'schematic': { hours: 0, cost: 0 },
      'design-development': { hours: 0, cost: 0 },
      'construction-docs': { hours: 0, cost: 0 },
    };

    ROLE_OPTIONS.forEach(role => {
      const rate = getRateForRole(role, config);
      STAGE_OPTIONS.forEach(stage => {
        const hours = getHours(role, stage);
        const cost = hours * rate;

        totalLaborHours += hours;
        totalLaborCost += cost;

        byRole[role].hours += hours;
        byRole[role].cost += cost;

        byStage[stage].hours += hours;
        byStage[stage].cost += cost;
      });
    });

    const logisticsCost = logistics.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const externalStudiesCost = externalStudies.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const adminFeeAmount = externalStudiesCost * (adminFeePercent / 100);
    const externalStudiesTotalWithFee = externalStudiesCost + adminFeeAmount;
    const grandTotal = totalLaborCost + logisticsCost + externalStudiesTotalWithFee;

    return {
      totalLaborHours,
      totalLaborCost,
      byRole,
      byStage,
      logisticsCost,
      externalStudiesCost,
      adminFeeAmount,
      externalStudiesTotalWithFee,
      grandTotal,
    };
  }, [matrix, config, logistics, externalStudies, adminFeePercent]);

  const handleExportCSV = () => {
    let csv = 'Design Document Pricing Breakdown\n\n';
    csv += `Project: ${item.name}\n`;
    csv += `Date: ${new Date().toLocaleDateString()}\n\n`;

    csv += 'LABOR MATRIX (Hours × Rate)\n';
    csv += 'Role,';
    STAGE_OPTIONS.forEach(stage => {
      csv += `${PRICING_DESIGN_STAGE_LABELS[stage]},`;
    });
    csv += 'Total Hours,Total Cost\n';

    ROLE_OPTIONS.forEach(role => {
      const rate = getRateForRole(role, config);
      csv += `${STAFF_ROLE_LABELS[role]} (${formatCurrency(rate)}/hr),`;
      STAGE_OPTIONS.forEach(stage => {
        const hours = getHours(role, stage);
        csv += `${hours},`;
      });
      csv += `${calculations.byRole[role].hours},${calculations.byRole[role].cost}\n`;
    });

    csv += `\nTOTAL LABOR,,,${calculations.totalLaborHours} hrs,${formatCurrency(calculations.totalLaborCost)}\n\n`;

    if (logistics.length > 0) {
      csv += '\nLOGISTICS / REIMBURSABLES\n';
      logistics.forEach(item => {
        csv += `${item.description},${item.amount}\n`;
      });
      csv += `TOTAL LOGISTICS,${formatCurrency(calculations.logisticsCost)}\n\n`;
    }

    if (externalStudies.length > 0) {
      csv += '\nEXTERNAL STUDIES\n';
      externalStudies.forEach(item => {
        csv += `${item.description},${item.amount}\n`;
      });
      csv += `Admin Fee (${adminFeePercent}%),${formatCurrency(calculations.adminFeeAmount)}\n`;
      csv += `TOTAL EXTERNAL STUDIES,${formatCurrency(calculations.externalStudiesTotalWithFee)}\n\n`;
    }

    csv += `\nGRAND TOTAL FEE,${formatCurrency(calculations.grandTotal)}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.name}_pricing.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!pricing) {
    return (
      <div className="p-6 text-center text-gray-500">
        Pricing data not available for this document.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Design Document Pricing</h2>
          <p className="text-sm text-gray-500">Matrix-based billing: Hours per role per stage</p>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <button
              onClick={() => setShowRateConfig(!showRateConfig)}
              className={cn(
                'px-3 py-1.5 text-sm rounded border flex items-center gap-1',
                showRateConfig ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              <Settings className="w-4 h-4" />
              Rates
            </button>
          )}
          <button
            onClick={handleExportCSV}
            disabled={calculations.grandTotal === 0}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 text-sm rounded',
              calculations.grandTotal > 0
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Rate Config */}
      {showRateConfig && !readOnly && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Hourly Rates</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {config.roles.map((role) => (
              <div key={role.id} className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">{role.label}</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">UGX</span>
                  <input
                    type="number"
                    value={role.hourlyRate}
                    onChange={(e) => handleUpdateRate(role.id, parseFloat(e.target.value) || 0)}
                    min={0}
                    step={5000}
                    className="w-full pl-11 pr-9 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">/hr</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Fee Summary</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Labor ({calculations.totalLaborHours.toFixed(1)} hrs)</span>
            <span className="text-sm font-medium text-gray-900">{formatCurrency(calculations.totalLaborCost)}</span>
          </div>
          {calculations.logisticsCost > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Logistics / Reimbursables</span>
              <span className="text-sm font-medium text-gray-900">{formatCurrency(calculations.logisticsCost)}</span>
            </div>
          )}
          {calculations.externalStudiesCost > 0 && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">External Studies</span>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(calculations.externalStudiesCost)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 pl-4">+ Admin Fee ({adminFeePercent}%)</span>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(calculations.adminFeeAmount)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-center pt-3 mt-3 border-t-2 border-blue-300">
            <span className="text-lg font-bold text-gray-900">Grand Total Fee</span>
            <span className="text-2xl font-bold text-blue-700">{formatCurrency(calculations.grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Labor Matrix */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Labor Matrix</h3>
          <p className="text-xs text-gray-500 mt-1">Enter hours required for each professional role per design stage</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-3 text-left font-medium text-gray-700">Professional Role</th>
                <th className="p-3 text-center font-medium text-gray-700">Rate/Hr</th>
                {STAGE_OPTIONS.map(stage => (
                  <th key={stage} className="p-3 text-center font-medium text-gray-700">
                    {PRICING_DESIGN_STAGE_LABELS[stage]}
                  </th>
                ))}
                <th className="p-3 text-center font-medium text-gray-700">Total Hours</th>
                <th className="p-3 text-right font-medium text-gray-700">Total Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ROLE_OPTIONS.map(role => {
                const rate = getRateForRole(role, config);
                const totals = calculations.byRole[role];
                return (
                  <tr key={role} className="hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-900">{STAFF_ROLE_LABELS[role]}</td>
                    <td className="p-3 text-center text-xs text-gray-500">{formatCurrency(rate)}</td>
                    {STAGE_OPTIONS.map(stage => {
                      const hours = getHours(role, stage);
                      return (
                        <td key={stage} className="p-3">
                          <input
                            type="number"
                            value={hours || ''}
                            onChange={(e) => handleUpdateHours(role, stage, parseFloat(e.target.value) || 0)}
                            disabled={readOnly}
                            min={0}
                            step={0.5}
                            placeholder="0"
                            className="w-20 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                          />
                        </td>
                      );
                    })}
                    <td className="p-3 text-center font-medium text-gray-900">{totals.hours.toFixed(1)}</td>
                    <td className="p-3 text-right font-medium text-gray-900">{formatCurrency(totals.cost)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                <td className="p-3 text-gray-900" colSpan={2}>Total Labor</td>
                {STAGE_OPTIONS.map(stage => (
                  <td key={stage} className="p-3 text-center text-gray-900">
                    {calculations.byStage[stage].hours.toFixed(1)}
                  </td>
                ))}
                <td className="p-3 text-center text-gray-900">{calculations.totalLaborHours.toFixed(1)}</td>
                <td className="p-3 text-right text-gray-900">{formatCurrency(calculations.totalLaborCost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Pass-Through Costs */}
      <div className="space-y-4">
        {/* Logistics */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900">Logistics / Reimbursables</h3>
            </div>
            <span className="text-sm font-semibold text-gray-900">{formatCurrency(calculations.logisticsCost)}</span>
          </div>
          <div className="p-4 space-y-2">
            {logistics.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => handleUpdateLogistics(item.id, { description: e.target.value })}
                  disabled={readOnly}
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                />
                <div className="relative w-32">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">UGX</span>
                  <input
                    type="number"
                    value={item.amount || ''}
                    onChange={(e) => handleUpdateLogistics(item.id, { amount: parseFloat(e.target.value) || 0 })}
                    disabled={readOnly}
                    min={0}
                    className="w-full pl-11 pr-2 py-1.5 text-sm text-right border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                {!readOnly && (
                  <button onClick={() => handleRemoveLogistics(item.id)} className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            {!readOnly && (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <input
                  type="text"
                  value={newLogDesc}
                  onChange={(e) => setNewLogDesc(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLogistics()}
                  placeholder="e.g., Travel, Printing, Courier..."
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div className="relative w-32">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">UGX</span>
                  <input
                    type="number"
                    value={newLogAmt}
                    onChange={(e) => setNewLogAmt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddLogistics()}
                    min={0}
                    placeholder="0"
                    className="w-full pl-11 pr-2 py-1.5 text-sm text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleAddLogistics}
                  disabled={!newLogDesc.trim() || !newLogAmt}
                  className={cn(
                    'p-1.5 rounded',
                    newLogDesc.trim() && newLogAmt ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400'
                  )}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* External Studies */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900">External Studies</h3>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              {formatCurrency(calculations.externalStudiesTotalWithFee)}
            </span>
          </div>
          <div className="p-4 space-y-2">
            {externalStudies.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => handleUpdateExternalStudy(item.id, { description: e.target.value })}
                  disabled={readOnly}
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                />
                <div className="relative w-32">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">UGX</span>
                  <input
                    type="number"
                    value={item.amount || ''}
                    onChange={(e) => handleUpdateExternalStudy(item.id, { amount: parseFloat(e.target.value) || 0 })}
                    disabled={readOnly}
                    min={0}
                    className="w-full pl-11 pr-2 py-1.5 text-sm text-right border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                {!readOnly && (
                  <button onClick={() => handleRemoveExternalStudy(item.id)} className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            {!readOnly && (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <input
                  type="text"
                  value={newStudyDesc}
                  onChange={(e) => setNewStudyDesc(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddExternalStudy()}
                  placeholder="e.g., Geotechnical, Acoustic, Environmental..."
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div className="relative w-32">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">UGX</span>
                  <input
                    type="number"
                    value={newStudyAmt}
                    onChange={(e) => setNewStudyAmt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddExternalStudy()}
                    min={0}
                    placeholder="0"
                    className="w-full pl-11 pr-2 py-1.5 text-sm text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleAddExternalStudy}
                  disabled={!newStudyDesc.trim() || !newStudyAmt}
                  className={cn(
                    'p-1.5 rounded',
                    newStudyDesc.trim() && newStudyAmt ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400'
                  )}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Admin Fee */}
            {(externalStudies.length > 0 || !readOnly) && (
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Admin Fee</span>
                  {!readOnly ? (
                    <div className="relative w-20">
                      <input
                        type="number"
                        value={adminFeePercent}
                        onChange={(e) => handleSetAdminFeePercent(parseFloat(e.target.value) || 0)}
                        min={0}
                        max={100}
                        step={1}
                        className="w-full pl-2 pr-6 py-1 text-sm text-right border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">({adminFeePercent}%)</span>
                  )}
                </div>
                <span className="text-sm font-medium text-gray-700">{formatCurrency(calculations.adminFeeAmount)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DesignDocumentPricingTab;
