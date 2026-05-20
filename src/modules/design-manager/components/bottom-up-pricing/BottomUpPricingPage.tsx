/**
 * Bottom-Up Pricing Calculator Page
 * Full-page pricing calculator for A&E projects that estimates costs
 * based on hours, complexity, and specific deliverables.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Download, RotateCcw, Calculator, Building2,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useBottomUpPricing } from '../../hooks/useBottomUpPricing';
import type { PricingDiscipline } from '../../types/bottomUpPricing';
import { PRICING_DISCIPLINE_LABELS } from '../../types/bottomUpPricing';
import { exportPricingCSV, downloadPricingCSV } from '../../services/bottomUpPricingService';
import { RateConfigPanel } from './RateConfigPanel';
import { DisciplineSection } from './DisciplineSection';
import { PassThroughCosts } from './PassThroughCosts';
import { PricingSummary } from './PricingSummary';

const ALL_DISCIPLINES: PricingDiscipline[] = ['architecture', 'interior-design', 'mep', 'structural'];

export default function BottomUpPricingPage() {
  const pricing = useBottomUpPricing();
  const [showRateConfig, setShowRateConfig] = useState(false);

  const activeDisciplineIds = new Set(pricing.proposal.disciplines.map((d) => d.discipline));
  const availableDisciplines = ALL_DISCIPLINES.filter((d) => !activeDisciplineIds.has(d));

  const handleExportCSV = () => {
    const csv = exportPricingCSV(pricing.proposal, pricing.result);
    downloadPricingCSV(csv, pricing.proposal.projectName || 'Untitled_Project');
  };

  const handleReset = () => {
    if (window.confirm('Reset the entire pricing calculator? All data will be lost.')) {
      pricing.resetProposal();
    }
  };

  // Map discipline IDs to calculated costs from result
  const disciplineCostMap = new Map(
    pricing.result.byDiscipline.map((d) => [d.discipline, { cost: d.totalCost, hours: d.totalHours }])
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/design" className="p-1.5 rounded hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-600" />
              Bottom-Up Pricing Calculator
            </h1>
            <p className="text-sm text-gray-500">Estimate project fees based on deliverables, hours, and complexity</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRateConfig(!showRateConfig)}
            className={cn(
              'px-3 py-1.5 text-sm rounded border',
              showRateConfig ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            )}
          >
            Rates
          </button>
          <button
            onClick={handleExportCSV}
            disabled={pricing.result.grandTotal === 0}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 text-sm rounded',
              pricing.result.grandTotal > 0
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Project Name */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <label className="block text-xs font-medium text-gray-600 mb-1">Project Name</label>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={pricing.proposal.projectName}
            onChange={(e) => pricing.setProjectName(e.target.value)}
            placeholder="Enter project name..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Rate Configuration (collapsible) */}
      {showRateConfig && (
        <RateConfigPanel config={pricing.config} onUpdateRate={pricing.updateRoleRate} />
      )}

      {/* Disciplines */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Design Disciplines</h2>
          {availableDisciplines.length > 0 && (
            <div className="flex items-center gap-2">
              {availableDisciplines.map((disc) => (
                <button
                  key={disc}
                  onClick={() => pricing.addDiscipline(disc)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                >
                  <Plus className="w-3 h-3" />
                  {PRICING_DISCIPLINE_LABELS[disc]}
                </button>
              ))}
            </div>
          )}
        </div>

        {pricing.proposal.disciplines.length === 0 && (
          <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-3">No disciplines added yet.</p>
            <p className="text-xs text-gray-400">Click a discipline button above to get started.</p>
          </div>
        )}

        {pricing.proposal.disciplines.map((entry) => {
          const costs = disciplineCostMap.get(entry.discipline) ?? { cost: 0, hours: 0 };
          return (
            <DisciplineSection
              key={entry.id}
              entry={entry}
              config={pricing.config}
              disciplineTotalCost={costs.cost}
              disciplineTotalHours={costs.hours}
              onAddDeliverable={pricing.addDeliverable}
              onUpdateDeliverable={pricing.updateDeliverable}
              onRemoveDeliverable={pricing.removeDeliverable}
              onRemoveDiscipline={pricing.removeDiscipline}
            />
          );
        })}
      </div>

      {/* Pass-Through Costs */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Pass-Through Costs</h2>
        <PassThroughCosts
          logistics={pricing.proposal.logistics}
          externalStudies={pricing.proposal.externalStudies}
          adminFeePercent={pricing.proposal.adminFeePercent}
          logisticsTotalCost={pricing.result.logisticsCost}
          externalStudiesTotalCost={pricing.result.externalStudiesCost}
          adminFeeAmount={pricing.result.adminFeeAmount}
          onAddLogistics={pricing.addLogisticsItem}
          onUpdateLogistics={pricing.updateLogisticsItem}
          onRemoveLogistics={pricing.removeLogisticsItem}
          onAddExternalStudy={pricing.addExternalStudy}
          onUpdateExternalStudy={pricing.updateExternalStudy}
          onRemoveExternalStudy={pricing.removeExternalStudy}
          onSetAdminFeePercent={pricing.setAdminFeePercent}
        />
      </div>

      {/* Summary */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Pricing Summary</h2>
        <PricingSummary result={pricing.result} currency={pricing.proposal.currency} />
      </div>
    </div>
  );
}
