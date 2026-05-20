/**
 * Smart Consolidation Alert
 *
 * Shows when other MOs have pending requirements for the same supplier.
 * Allows users to add those requirements to the current PO for consolidated purchasing.
 */

import { useState } from 'react';
import { Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import type { ConsolidationOpportunity, MORequirementSummary } from '../services/smartConsolidationService';
import type { ProcurementRequirement } from '../types/procurement';

interface Props {
  opportunity: ConsolidationOpportunity | null;
  loading: boolean;
  /** Called when user selects requirements to add */
  onAddRequirements: (requirements: ProcurementRequirement[]) => void;
}

export function SmartConsolidationAlert({ opportunity, loading, onAddRequirements }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedMOs, setSelectedMOs] = useState<Set<string>>(new Set());

  // Don't render if no opportunities
  if (!loading && (!opportunity || opportunity.otherMOs.length === 0)) {
    return null;
  }

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const handleToggleMO = (moId: string) => {
    setSelectedMOs((prev) => {
      const next = new Set(prev);
      if (next.has(moId)) {
        next.delete(moId);
      } else {
        next.add(moId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!opportunity) return;
    if (selectedMOs.size === opportunity.otherMOs.length) {
      setSelectedMOs(new Set());
    } else {
      setSelectedMOs(new Set(opportunity.otherMOs.map((mo) => mo.moId)));
    }
  };

  const handleAddSelected = () => {
    if (!opportunity) return;

    const selectedRequirements: ProcurementRequirement[] = [];
    for (const mo of opportunity.otherMOs) {
      if (selectedMOs.has(mo.moId)) {
        selectedRequirements.push(...mo.requirements);
      }
    }

    if (selectedRequirements.length > 0) {
      onAddRequirements(selectedRequirements);
      setSelectedMOs(new Set());
      setExpanded(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-blue-600" />
          <div className="h-4 w-64 animate-pulse rounded bg-blue-200" />
        </div>
      </div>
    );
  }

  const totalSelectedValue = opportunity
    ? opportunity.otherMOs
        .filter((mo) => selectedMOs.has(mo.moId))
        .reduce((sum, mo) => sum + mo.totalEstimatedCost, 0)
    : 0;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-semibold text-blue-900">Consolidation Opportunity</h4>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                {opportunity?.totalRequirementCount} items
              </Badge>
            </div>
            <p className="text-sm text-blue-800">
              {opportunity?.otherMOs.length} other manufacturing order(s) need materials from{' '}
              <strong>{opportunity?.supplierName}</strong> totaling{' '}
              <strong>{formatCurrency(opportunity?.totalPotentialValue ?? 0, opportunity?.currency ?? 'USD')}</strong>.
              Consolidate for better pricing.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-blue-600 hover:bg-blue-100 shrink-0"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 bg-white rounded-lg border border-blue-100 p-3">
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" size="sm" className="text-xs" onClick={handleSelectAll}>
              {selectedMOs.size === opportunity?.otherMOs.length ? 'Deselect All' : 'Select All'}
            </Button>
            {selectedMOs.size > 0 && (
              <span className="text-xs text-muted-foreground">
                Selected: {formatCurrency(totalSelectedValue, opportunity?.currency ?? 'USD')}
              </span>
            )}
          </div>

          <ul className="divide-y divide-border">
            {opportunity?.otherMOs.map((mo) => (
              <MOListItem
                key={mo.moId}
                mo={mo}
                selected={selectedMOs.has(mo.moId)}
                onToggle={() => handleToggleMO(mo.moId)}
              />
            ))}
          </ul>

          {selectedMOs.size > 0 && (
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={handleAddSelected}>
                Add {selectedMOs.size} MO(s) to this PO
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface MOListItemProps {
  mo: MORequirementSummary;
  selected: boolean;
  onToggle: () => void;
}

function MOListItem({ mo, selected, onToggle }: MOListItemProps) {
  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <li
      onClick={onToggle}
      className="flex items-center gap-3 py-2.5 px-2 cursor-pointer hover:bg-muted/50 rounded transition-colors"
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/20 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{mo.moNumber}</span>
          <span className="text-xs text-muted-foreground">{mo.projectCode}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{mo.designItemName}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {mo.requirementCount} items
          </Badge>
        </div>
      </div>
      <span className="text-sm font-medium text-primary shrink-0">
        {formatCurrency(mo.totalEstimatedCost, mo.currency)}
      </span>
    </li>
  );
}
