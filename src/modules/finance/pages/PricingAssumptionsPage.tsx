/**
 * Pricing & Optimization Defaults Page
 * Finance Module Settings sub-page
 *
 * Combines both optimization parameters (kerf, buffers, yields, costs)
 * and workshop processing rates (planing, crosscut, rip, routing, panel saw, edge banding).
 */

import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useOrganizationSettings, useCurrentDawinUser } from '@/core/settings';
import { PricingAssumptionsSection } from '@/shared/components/settings/PricingAssumptionsSection';
import { MaterialPricingRulesSection } from '@/shared/components/settings/MaterialPricingRulesSection';
import { WorkshopProcessingRatesSection } from '@/shared/components/settings/WorkshopProcessingRatesSection';
import { LaborRateCostingSection } from '@/shared/components/settings/LaborRateCostingSection';

export function PricingAssumptionsPage() {
  const navigate = useNavigate();
  const { settings, updateSettings } = useOrganizationSettings();
  const { hasPermission } = useCurrentDawinUser();
  const canEdit = hasPermission('settings:edit');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/finance/settings')}
          className="p-1.5 hover:bg-[var(--bg-sunken)] rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Pricing & Optimization Defaults
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organization-wide defaults for material optimization, costing buffers, and yield targets
          </p>
        </div>
      </div>

      {/* Optimization Parameters */}
      <PricingAssumptionsSection
        canEdit={canEdit}
        settings={settings}
        updateSettings={updateSettings}
        defaultExpanded
      />

      {/* Material Pricing Rules (per-type yield, buffer, conversion) */}
      <MaterialPricingRulesSection
        canEdit={canEdit}
        settings={settings}
        updateSettings={updateSettings}
      />

      {/* Workshop Processing Rates (timber & panel) */}
      <WorkshopProcessingRatesSection
        canEdit={canEdit}
        settings={settings}
        updateSettings={updateSettings}
        defaultExpanded
      />

      {/* Labor Rate Calculator (from payroll data) */}
      <LaborRateCostingSection
        canEdit={canEdit}
        settings={settings}
        updateSettings={updateSettings}
        defaultExpanded
      />
    </div>
  );
}

export default PricingAssumptionsPage;
