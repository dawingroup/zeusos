/**
 * Material Pricing Rules Section
 *
 * Collapsible settings section for configuring per-material-type pricing rules.
 * Allows users to override default yield factors, buffer multipliers, and
 * type-specific parameters (timber planing, panel sheet sizes, etc.)
 *
 * Stored in OrganizationSettings.pricingAssumptions.materialPricingRules
 */

import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Layers,
  Save,
  RotateCcw,
  Loader2,
  TreePine,
  LayoutGrid,
  Ruler,
  Gem,
  Scissors,
  Frame,
  Minus,
  Box,
} from 'lucide-react';
import type { OrganizationSettings } from '@/core/settings/types';
import type { MaterialType } from '@/shared/types';
import type { MaterialPricingRule } from '@/shared/types/pricingAssumptions';
import {
  DEFAULT_MATERIAL_PRICING_RULES,
  resolvePricingAssumptions,
} from '@/shared/types/pricingAssumptions';

// ============================================
// Props
// ============================================

interface MaterialPricingRulesSectionProps {
  canEdit: boolean;
  settings: OrganizationSettings | null;
  updateSettings: (updates: Partial<OrganizationSettings>) => Promise<void>;
  defaultExpanded?: boolean;
}

// ============================================
// Constants
// ============================================

const MATERIAL_TYPE_CONFIG: {
  type: MaterialType;
  label: string;
  description: string;
  icon: typeof TreePine;
  color: string;
}[] = [
  { type: 'PANEL', label: 'Panel / Sheet', description: 'MDF, Plywood, Melamine, Chipboard', icon: LayoutGrid, color: 'blue' },
  { type: 'TIMBER', label: 'Timber / Lumber', description: 'Hardwood, Softwood, dimensional lumber', icon: TreePine, color: 'emerald' },
  { type: 'GLASS', label: 'Glass', description: 'Float glass, tempered, laminated', icon: Frame, color: 'sky' },
  { type: 'METAL_BAR', label: 'Metal Bar', description: 'Steel bars, tubes, SHS', icon: Ruler, color: 'amber' },
  { type: 'ALUMINIUM', label: 'Aluminium', description: 'Extrusions, profiles', icon: Ruler, color: 'gray' },
  { type: 'STONE', label: 'Stone / Slab', description: 'Granite, marble, quartz worktops', icon: Gem, color: 'orange' },
  { type: 'FABRIC', label: 'Fabric / Upholstery', description: 'Fabric rolls, leather, upholstery', icon: Scissors, color: 'violet' },
  { type: 'EDGE', label: 'Edge Banding', description: 'PVC, ABS, veneer tape', icon: Minus, color: 'teal' },
  { type: 'COMPONENT', label: 'Components', description: 'Bought-out parts, priced per piece', icon: Box, color: 'slate' },
];

// ============================================
// Component
// ============================================

export function MaterialPricingRulesSection({
  canEdit,
  settings,
  updateSettings,
  defaultExpanded = false,
}: MaterialPricingRulesSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedType, setExpandedType] = useState<MaterialType | null>(null);

  // Local state: partial overrides keyed by MaterialType
  const [localRules, setLocalRules] = useState<
    Partial<Record<MaterialType, Partial<MaterialPricingRule>>>
  >({});

  // Sync from settings
  useEffect(() => {
    const resolved = resolvePricingAssumptions(settings?.pricingAssumptions);
    setLocalRules(resolved.materialPricingRules ?? {});
  }, [settings?.pricingAssumptions]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const current = settings?.pricingAssumptions ?? {};
      await updateSettings({
        pricingAssumptions: {
          ...current,
          materialPricingRules: localRules,
        },
      } as any);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save material pricing rules:', err);
    }
    setIsSaving(false);
  };

  const handleReset = () => {
    setLocalRules(settings?.pricingAssumptions?.materialPricingRules ?? {});
    setIsEditing(false);
  };

  const getEffectiveValue = (type: MaterialType, field: keyof MaterialPricingRule): any => {
    const override = localRules[type];
    if (override && (override as any)[field] !== undefined) {
      return (override as any)[field];
    }
    return (DEFAULT_MATERIAL_PRICING_RULES[type] as any)?.[field];
  };

  const setRuleField = (type: MaterialType, field: string, value: any) => {
    setLocalRules(prev => ({
      ...prev,
      [type]: {
        ...(prev[type] ?? {}),
        [field]: value,
      },
    }));
  };

  const setTimberConfigField = (type: MaterialType, field: string, value: any) => {
    setLocalRules(prev => {
      const existing = prev[type] ?? {};
      const existingTimber = existing.timberConfig ?? {};
      return {
        ...prev,
        [type]: {
          ...existing,
          timberConfig: { ...existingTimber, [field]: value },
        },
      };
    });
  };

  const getTimberConfigValue = (type: MaterialType, field: string): any => {
    const override = localRules[type]?.timberConfig;
    if (override && (override as any)[field] !== undefined) {
      return (override as any)[field];
    }
    return (DEFAULT_MATERIAL_PRICING_RULES[type]?.timberConfig as any)?.[field];
  };

  return (
    <div className="bg-card rounded-xl border border-[var(--border-subtle)] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-[var(--bg-sunken)] transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-[var(--fg-tertiary)]" />
          ) : (
            <ChevronRight className="w-5 h-5 text-[var(--fg-tertiary)]" />
          )}
          <Layers className="w-5 h-5 text-[var(--rag-blue)]" />
          <div className="text-left">
            <h3 className="text-base font-semibold text-foreground">Material Pricing Rules</h3>
            <p className="text-sm text-muted-foreground">
              Per-material-type yield, buffer, and conversion settings that influence all cost calculations
            </p>
          </div>
        </div>
        {canEdit && isExpanded && !isEditing && (
          <span
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            className="text-sm text-[var(--rag-blue)] hover:text-[var(--rag-blue)] cursor-pointer"
          >
            Edit
          </span>
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-3">
          {/* Material Type Cards */}
          {MATERIAL_TYPE_CONFIG.map(({ type, label, description, icon: Icon, color }) => {
            const isOpen = expandedType === type;
            const yieldVal = getEffectiveValue(type, 'defaultYieldFactor') as number;
            const bufferVal = getEffectiveValue(type, 'defaultBufferMultiplier') as number;
            const measurement = getEffectiveValue(type, 'measurement') as string;
            const isOverridden = !!localRules[type];

            return (
              <div
                key={type}
                className={`border rounded-lg overflow-hidden ${isOverridden ? `border-${color}-300 bg-${color}-50/30` : 'border-[var(--border-subtle)]'}`}
              >
                {/* Material Row */}
                <button
                  onClick={() => setExpandedType(isOpen ? null : type)}
                  className="w-full flex items-center justify-between p-3 hover:bg-[var(--bg-sunken)]/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-[var(--fg-tertiary)]" /> : <ChevronRight className="w-4 h-4 text-[var(--fg-tertiary)]" />}
                    <Icon className={`w-4 h-4 text-${color}-500`} />
                    <div className="text-left">
                      <span className="text-sm font-medium text-foreground">{label}</span>
                      <span className="text-xs text-muted-foreground ml-2">{description}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Yield: <strong className="text-muted-foreground">{Math.round(yieldVal * 100)}%</strong></span>
                    <span>Buffer: <strong className="text-muted-foreground">{Math.round((bufferVal - 1) * 100)}%</strong></span>
                    <span className="uppercase">{measurement?.replace('_', ' ')}</span>
                    {isOverridden && (
                      <span className="text-xs bg-[var(--rag-blue-soft)] text-[var(--rag-blue)] px-1.5 py-0.5 rounded">Custom</span>
                    )}
                  </div>
                </button>

                {/* Expanded Detail */}
                {isOpen && (
                  <div className="border-t border-[var(--border-subtle)] p-4 bg-card space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Yield Factor */}
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Yield Factor (%)
                        </label>
                        <input
                          type="number"
                          min={10}
                          max={100}
                          step={1}
                          value={Math.round(yieldVal * 100)}
                          onChange={(e) => isEditing && setRuleField(type, 'defaultYieldFactor', Number(e.target.value) / 100)}
                          disabled={!isEditing}
                          className="w-full px-3 py-1.5 border border-[var(--border-subtle)] rounded text-sm disabled:bg-[var(--bg-sunken)] disabled:text-muted-foreground"
                        />
                        <p className="text-xs text-[var(--fg-tertiary)] mt-0.5">Default: {Math.round(DEFAULT_MATERIAL_PRICING_RULES[type].defaultYieldFactor * 100)}%</p>
                      </div>

                      {/* Buffer Multiplier */}
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Cost Buffer (%)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          step={1}
                          value={Math.round((bufferVal - 1) * 100)}
                          onChange={(e) => isEditing && setRuleField(type, 'defaultBufferMultiplier', 1 + Number(e.target.value) / 100)}
                          disabled={!isEditing}
                          className="w-full px-3 py-1.5 border border-[var(--border-subtle)] rounded text-sm disabled:bg-[var(--bg-sunken)] disabled:text-muted-foreground"
                        />
                        <p className="text-xs text-[var(--fg-tertiary)] mt-0.5">Default: {Math.round((DEFAULT_MATERIAL_PRICING_RULES[type].defaultBufferMultiplier - 1) * 100)}%</p>
                      </div>

                      {/* Measurement */}
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Measurement
                        </label>
                        <input
                          type="text"
                          value={measurement?.replace('_', ' ') ?? ''}
                          disabled
                          className="w-full px-3 py-1.5 border border-[var(--border-subtle)] rounded text-sm bg-[var(--bg-sunken)] text-muted-foreground"
                        />
                      </div>

                      {/* Pricing Priority */}
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Pricing Priority
                        </label>
                        <input
                          type="text"
                          value={(getEffectiveValue(type, 'pricingMethodPriority') as string[])?.join(' > ') ?? ''}
                          disabled
                          className="w-full px-3 py-1.5 border border-[var(--border-subtle)] rounded text-sm bg-[var(--bg-sunken)] text-muted-foreground"
                        />
                      </div>
                    </div>

                    {/* Timber-Specific Config */}
                    {type === 'TIMBER' && (
                      <div className="border-t pt-3 mt-3">
                        <h5 className="text-xs font-semibold text-[var(--rag-green)] uppercase mb-3">Timber-Specific Settings</h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Planing Allowance (mm/side)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={10}
                              step={0.5}
                              value={getTimberConfigValue(type, 'planingAllowanceMm') ?? 3}
                              onChange={(e) => isEditing && setTimberConfigField(type, 'planingAllowanceMm', Number(e.target.value))}
                              disabled={!isEditing}
                              className="w-full px-3 py-1.5 border border-[var(--border-subtle)] rounded text-sm disabled:bg-[var(--bg-sunken)] disabled:text-muted-foreground"
                            />
                            <p className="text-xs text-[var(--fg-tertiary)] mt-0.5">Default: 3mm</p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Saw Kerf (mm)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={10}
                              step={0.5}
                              value={getTimberConfigValue(type, 'kerfMm') ?? 4}
                              onChange={(e) => isEditing && setTimberConfigField(type, 'kerfMm', Number(e.target.value))}
                              disabled={!isEditing}
                              className="w-full px-3 py-1.5 border border-[var(--border-subtle)] rounded text-sm disabled:bg-[var(--bg-sunken)] disabled:text-muted-foreground"
                            />
                            <p className="text-xs text-[var(--fg-tertiary)] mt-0.5">Default: 4mm</p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Rough-Sawn Default
                            </label>
                            <select
                              value={getTimberConfigValue(type, 'isRoughSawn') === false ? 'dressed' : 'rough'}
                              onChange={(e) => isEditing && setTimberConfigField(type, 'isRoughSawn', e.target.value === 'rough')}
                              disabled={!isEditing}
                              className="w-full px-3 py-1.5 border border-[var(--border-subtle)] rounded text-sm disabled:bg-[var(--bg-sunken)] disabled:text-muted-foreground"
                            >
                              <option value="rough">Rough-sawn (needs planing)</option>
                              <option value="dressed">Dressed (pre-planed)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Panel-Specific Config */}
                    {(type === 'PANEL' || type === 'SOLID' || type === 'VENEER') && (
                      <div className="border-t pt-3 mt-3">
                        <h5 className="text-xs font-semibold text-[var(--rag-blue)] uppercase mb-3">Panel Settings</h5>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Default Sheet Length (mm)
                            </label>
                            <input
                              type="number"
                              value={DEFAULT_MATERIAL_PRICING_RULES[type]?.panelConfig?.defaultSheetSize?.length ?? 2440}
                              disabled
                              className="w-full px-3 py-1.5 border border-[var(--border-subtle)] rounded text-sm bg-[var(--bg-sunken)] text-muted-foreground"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Default Sheet Width (mm)
                            </label>
                            <input
                              type="number"
                              value={DEFAULT_MATERIAL_PRICING_RULES[type]?.panelConfig?.defaultSheetSize?.width ?? 1220}
                              disabled
                              className="w-full px-3 py-1.5 border border-[var(--border-subtle)] rounded text-sm bg-[var(--bg-sunken)] text-muted-foreground"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Panel Kerf (mm)
                            </label>
                            <input
                              type="number"
                              value={DEFAULT_MATERIAL_PRICING_RULES[type]?.panelConfig?.kerfMm ?? 3.2}
                              disabled
                              className="w-full px-3 py-1.5 border border-[var(--border-subtle)] rounded text-sm bg-[var(--bg-sunken)] text-muted-foreground"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Glass-Specific Config */}
                    {type === 'GLASS' && (
                      <div className="border-t pt-3 mt-3">
                        <h5 className="text-xs font-semibold text-[var(--rag-blue)] uppercase mb-3">Glass Settings</h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Safety Margin (mm)</label>
                            <input type="number" value={DEFAULT_MATERIAL_PRICING_RULES.GLASS.glassConfig?.safetyMarginMm ?? 25} disabled className="w-full px-3 py-1.5 border border-[var(--border-subtle)] rounded text-sm bg-[var(--bg-sunken)] text-muted-foreground" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Glass Kerf (mm)</label>
                            <input type="number" value={DEFAULT_MATERIAL_PRICING_RULES.GLASS.glassConfig?.kerfMm ?? 4} disabled className="w-full px-3 py-1.5 border border-[var(--border-subtle)] rounded text-sm bg-[var(--bg-sunken)] text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Fabric-Specific Config */}
                    {type === 'FABRIC' && (
                      <div className="border-t pt-3 mt-3">
                        <h5 className="text-xs font-semibold text-[var(--rag-blue)] uppercase mb-3">Fabric Settings</h5>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">Default Roll Width (mm)</label>
                          <input type="number" value={DEFAULT_MATERIAL_PRICING_RULES.FABRIC.fabricConfig?.defaultRollWidthMm ?? 1400} disabled className="w-full max-w-xs px-3 py-1.5 border border-[var(--border-subtle)] rounded text-sm bg-[var(--bg-sunken)] text-muted-foreground" />
                        </div>
                      </div>
                    )}

                    {/* Linear-Specific Config */}
                    {(type === 'METAL_BAR' || type === 'ALUMINIUM') && (
                      <div className="border-t pt-3 mt-3">
                        <h5 className="text-xs font-semibold text-[var(--rag-amber)] uppercase mb-3">Linear Stock Settings</h5>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">Default Stock Length (mm)</label>
                          <input type="number" value={DEFAULT_MATERIAL_PRICING_RULES[type].linearConfig?.defaultStockLengthMm ?? 6000} disabled className="w-full max-w-xs px-3 py-1.5 border border-[var(--border-subtle)] rounded text-sm bg-[var(--bg-sunken)] text-muted-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Save / Cancel / Reset Buttons */}
          {isEditing && (
            <div className="flex items-center gap-3 pt-4 border-t border-[var(--border-subtle)]">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--rag-blue)] text-white rounded-lg text-sm hover:bg-[var(--rag-blue)] disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Saving...' : 'Save Rules'}
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 border border-[var(--border-subtle)] rounded-lg text-sm hover:bg-[var(--bg-sunken)] text-muted-foreground"
              >
                <RotateCcw className="w-4 h-4" />
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
