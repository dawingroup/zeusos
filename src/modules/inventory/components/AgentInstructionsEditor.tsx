/**
 * AgentInstructionsEditor Component
 * Allows administrators to configure the AI audit agent's behaviour:
 * - Custom context and additional rules
 * - Naming conventions
 * - Known aliases (to ignore as duplicates)
 * - Severity overrides
 * - Focus area priorities
 */

import { useState, useCallback } from 'react';
import {
  Settings2,
  Loader2,
  Save,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Tag,
  Shield,
  Target,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import type {
  AgentInstructions,
  AgentNamingRules,
  AgentKnownAlias,
  AgentSeverityOverride,
  AgentFocusPriority,
  AuditIssueCategory,
} from '../types/inventoryAI';
import { DEFAULT_AGENT_INSTRUCTIONS } from '../types/inventoryAI';

interface AgentInstructionsEditorProps {
  instructions: AgentInstructions | null;
  saving: boolean;
  error: string | null;
  onUpdate: (instructions: AgentInstructions) => void;
  onSave: () => void;
  onReset: () => void;
}

const CAPITALISATION_OPTIONS = [
  { value: 'title-case', label: 'Title Case' },
  { value: 'sentence-case', label: 'Sentence case' },
  { value: 'uppercase', label: 'UPPERCASE' },
  { value: 'as-is', label: 'As-is (no enforcement)' },
] as const;

const ABBREVIATION_OPTIONS = [
  { value: 'abbreviate', label: 'Use abbreviations (mm, kg)' },
  { value: 'spell-out', label: 'Spell out (millimetres, kilograms)' },
  { value: 'as-is', label: 'As-is (no enforcement)' },
] as const;

const SEPARATOR_OPTIONS = [
  { value: ' - ', label: 'Dash ( - )' },
  { value: ' | ', label: 'Pipe ( | )' },
  { value: ' / ', label: 'Slash ( / )' },
  { value: ', ', label: 'Comma (, )' },
] as const;

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical', color: 'text-red-600' },
  { value: 'warning', label: 'Warning', color: 'text-amber-600' },
  { value: 'info', label: 'Info', color: 'text-blue-600' },
  { value: 'ignore', label: 'Ignore', color: 'text-gray-400' },
] as const;

const ISSUE_CATEGORIES: Array<{ value: AuditIssueCategory; label: string }> = [
  { value: 'incomplete-data', label: 'Incomplete Data' },
  { value: 'potential-duplicate', label: 'Potential Duplicate' },
  { value: 'naming-inconsistency', label: 'Naming Inconsistency' },
  { value: 'miscategorized', label: 'Miscategorised' },
  { value: 'pricing-concern', label: 'Pricing Concern' },
  { value: 'low-stock', label: 'Low Stock' },
  { value: 'stale-data', label: 'Stale Data' },
  { value: 'orphan-sku', label: 'Orphan SKU' },
  { value: 'unit-mismatch', label: 'Unit Mismatch' },
  { value: 'phantom-stock', label: 'Phantom Stock' },
  { value: 'brand-in-title', label: 'Brand in Title' },
  { value: 'missing-structured-name', label: 'Missing Structured Name' },
  { value: 'family-candidate', label: 'Family Candidate' },
];

const FOCUS_AREAS: Array<{ value: AgentFocusPriority['area']; label: string }> = [
  { value: 'data-quality', label: 'Data Quality' },
  { value: 'duplicates', label: 'Duplicates' },
  { value: 'categorization', label: 'Categorisation' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'stock', label: 'Stock Levels' },
  { value: 'corrections', label: 'Auto-corrections' },
];

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High', color: 'text-red-600' },
  { value: 'normal', label: 'Normal', color: 'text-gray-600' },
  { value: 'skip', label: 'Skip', color: 'text-gray-400' },
] as const;

type SectionId = 'context' | 'naming' | 'brands' | 'aliases' | 'severity' | 'focus' | 'rules';

export function AgentInstructionsEditor({
  instructions,
  saving,
  error,
  onUpdate,
  onSave,
  onReset,
}: AgentInstructionsEditorProps) {
  const current = instructions || DEFAULT_AGENT_INSTRUCTIONS;
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(
    new Set(['context', 'naming'])
  );

  const toggleSection = useCallback((section: SectionId) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  const update = useCallback(
    (partial: Partial<AgentInstructions>) => {
      onUpdate({ ...current, ...partial });
    },
    [current, onUpdate]
  );

  const updateNamingRules = useCallback(
    (partial: Partial<AgentNamingRules>) => {
      update({ namingRules: { ...current.namingRules, ...partial } });
    },
    [current, update]
  );

  // --- Alias management ---
  const addAlias = useCallback(() => {
    update({
      knownAliases: [
        ...current.knownAliases,
        { primary: '', aliases: [''], reason: '' },
      ],
    });
  }, [current, update]);

  const removeAlias = useCallback(
    (index: number) => {
      update({
        knownAliases: current.knownAliases.filter((_, i) => i !== index),
      });
    },
    [current, update]
  );

  const updateAlias = useCallback(
    (index: number, partial: Partial<AgentKnownAlias>) => {
      update({
        knownAliases: current.knownAliases.map((a, i) =>
          i === index ? { ...a, ...partial } : a
        ),
      });
    },
    [current, update]
  );

  // --- Severity overrides ---
  const addSeverityOverride = useCallback(() => {
    update({
      severityOverrides: [
        ...current.severityOverrides,
        { category: 'incomplete-data', severity: 'info' },
      ],
    });
  }, [current, update]);

  const removeSeverityOverride = useCallback(
    (index: number) => {
      update({
        severityOverrides: current.severityOverrides.filter((_, i) => i !== index),
      });
    },
    [current, update]
  );

  // --- Additional rules ---
  const addRule = useCallback(() => {
    update({ additionalRules: [...current.additionalRules, ''] });
  }, [current, update]);

  const removeRule = useCallback(
    (index: number) => {
      update({
        additionalRules: current.additionalRules.filter((_, i) => i !== index),
      });
    },
    [current, update]
  );

  function SectionHeader({
    id,
    icon: Icon,
    title,
    count,
  }: {
    id: SectionId;
    icon: typeof Settings2;
    title: string;
    count?: number;
  }) {
    const isOpen = expandedSections.has(id);
    return (
      <button
        className="w-full flex items-center gap-2 py-2 text-left hover:text-gray-900 transition-colors"
        onClick={() => toggleSection(id)}
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
        <Icon className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">{title}</span>
        {count !== undefined && count > 0 && (
          <Badge variant="outline" className="text-xs ml-auto">
            {count}
          </Badge>
        )}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700">Agent Instructions</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onReset}
            disabled={saving}
          >
            Reset to Defaults
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={onSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-3 h-3 mr-1" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="border rounded-lg divide-y bg-white">
        {/* Custom Context */}
        <div className="px-3">
          <SectionHeader id="context" icon={MessageSquare} title="Custom Context" />
          {expandedSections.has('context') && (
            <div className="pb-3 space-y-2">
              <p className="text-xs text-gray-400">
                Provide business-specific context that helps the AI understand your inventory better.
              </p>
              <textarea
                value={current.customContext}
                onChange={e => update({ customContext: e.target.value })}
                placeholder="e.g., We are a furniture manufacturer in Kampala. Our primary materials are MDF, plywood, and solid hardwoods. We use UGX as primary currency..."
                className="w-full h-24 text-sm border rounded-md p-2 resize-y focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
              />
              <label className="text-xs text-gray-500 block">Category Guidance</label>
              <textarea
                value={current.categoryGuidance}
                onChange={e => update({ categoryGuidance: e.target.value })}
                placeholder="e.g., Edge banding should include PVC tapes and veneer tapes. Hardware includes hinges, slides, handles, locks..."
                className="w-full h-16 text-sm border rounded-md p-2 resize-y focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          )}
        </div>

        {/* Naming Rules */}
        <div className="px-3">
          <SectionHeader id="naming" icon={BookOpen} title="Naming Conventions" />
          {expandedSections.has('naming') && (
            <div className="pb-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Capitalisation
                  </label>
                  <select
                    value={current.namingRules.capitalisation}
                    onChange={e =>
                      updateNamingRules({
                        capitalisation: e.target.value as AgentNamingRules['capitalisation'],
                      })
                    }
                    className="w-full text-sm border rounded-md p-1.5 focus:ring-1 focus:ring-purple-500"
                  >
                    {CAPITALISATION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Abbreviations
                  </label>
                  <select
                    value={current.namingRules.abbreviationStyle}
                    onChange={e =>
                      updateNamingRules({
                        abbreviationStyle: e.target.value as AgentNamingRules['abbreviationStyle'],
                      })
                    }
                    className="w-full text-sm border rounded-md p-1.5 focus:ring-1 focus:ring-purple-500"
                  >
                    {ABBREVIATION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Name Separator
                  </label>
                  <select
                    value={current.namingRules.nameSeparator}
                    onChange={e =>
                      updateNamingRules({
                        nameSeparator: e.target.value as AgentNamingRules['nameSeparator'],
                      })
                    }
                    className="w-full text-sm border rounded-md p-1.5 focus:ring-1 focus:ring-purple-500"
                  >
                    {SEPARATOR_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer pb-1.5">
                    <input
                      type="checkbox"
                      checked={current.namingRules.includeBrandInName}
                      onChange={e =>
                        updateNamingRules({ includeBrandInName: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    Include brand in name
                  </label>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Prefix/Suffix Convention
                </label>
                <input
                  type="text"
                  value={current.namingRules.prefixSuffix || ''}
                  onChange={e =>
                    updateNamingRules({ prefixSuffix: e.target.value || undefined })
                  }
                  placeholder='e.g., "DWN-" prefix for all internal items'
                  className="w-full text-sm border rounded-md p-1.5 focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Known Brands */}
        <div className="px-3">
          <SectionHeader
            id="brands"
            icon={Tag}
            title="Known Brands"
            count={current.knownBrands?.length || 0}
          />
          {expandedSections.has('brands') && (
            <div className="pb-3 space-y-2">
              <p className="text-xs text-gray-400">
                Brand names the AI should detect in item titles and extract to the brand field.
                Comma-separated list.
              </p>
              <textarea
                value={(current.knownBrands || []).join(', ')}
                onChange={e =>
                  update({
                    knownBrands: e.target.value
                      .split(',')
                      .map(s => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="e.g., Plascon, Sadolin, Blum, Hafele, Hettich, SWECO, Ingco, Meite, Salice, Grass, STARKE, DTC, GTV, LP, Formica"
                className="w-full h-20 text-sm border rounded-md p-2 resize-y focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="text-xs text-gray-400">
                Common brands: Plascon, Sadolin, SWECO, Ingco, Meite, Blum, Salice, Hafele, Hettich, Grass, STARKE, DTC, GTV, LP, Formica
              </p>
            </div>
          )}
        </div>

        {/* Known Aliases */}
        <div className="px-3">
          <SectionHeader
            id="aliases"
            icon={Tag}
            title="Known Aliases (Ignore as Duplicates)"
            count={current.knownAliases.length}
          />
          {expandedSections.has('aliases') && (
            <div className="pb-3 space-y-2">
              <p className="text-xs text-gray-400">
                Items you know are not duplicates despite similar names. The AI will skip these.
              </p>
              {current.knownAliases.map((alias, idx) => (
                <div key={idx} className="border rounded-md p-2 space-y-1.5 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={alias.primary}
                      onChange={e => updateAlias(idx, { primary: e.target.value })}
                      placeholder="Primary item name or SKU"
                      className="flex-1 text-sm border rounded-md p-1.5 focus:ring-1 focus:ring-purple-500"
                    />
                    <button
                      onClick={() => removeAlias(idx)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={alias.aliases.join(', ')}
                    onChange={e =>
                      updateAlias(idx, {
                        aliases: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder="Aliases (comma-separated)"
                    className="w-full text-sm border rounded-md p-1.5 focus:ring-1 focus:ring-purple-500"
                  />
                  <input
                    type="text"
                    value={alias.reason}
                    onChange={e => updateAlias(idx, { reason: e.target.value })}
                    placeholder="Reason these are not duplicates"
                    className="w-full text-xs border rounded-md p-1.5 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={addAlias}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Known Alias
              </Button>
            </div>
          )}
        </div>

        {/* Severity Overrides */}
        <div className="px-3">
          <SectionHeader
            id="severity"
            icon={Shield}
            title="Severity Overrides"
            count={current.severityOverrides.length}
          />
          {expandedSections.has('severity') && (
            <div className="pb-3 space-y-2">
              <p className="text-xs text-gray-400">
                Raise, lower, or completely ignore specific issue categories.
              </p>
              {current.severityOverrides.map((override, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={override.category}
                    onChange={e => {
                      const updated = [...current.severityOverrides];
                      updated[idx] = { ...updated[idx], category: e.target.value as AuditIssueCategory };
                      update({ severityOverrides: updated });
                    }}
                    className="flex-1 text-sm border rounded-md p-1.5 focus:ring-1 focus:ring-purple-500"
                  >
                    {ISSUE_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={override.severity}
                    onChange={e => {
                      const updated = [...current.severityOverrides];
                      updated[idx] = {
                        ...updated[idx],
                        severity: e.target.value as AgentSeverityOverride['severity'],
                      };
                      update({ severityOverrides: updated });
                    }}
                    className="w-28 text-sm border rounded-md p-1.5 focus:ring-1 focus:ring-purple-500"
                  >
                    {SEVERITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeSeverityOverride(idx)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={addSeverityOverride}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Override
              </Button>
            </div>
          )}
        </div>

        {/* Focus Priorities */}
        <div className="px-3">
          <SectionHeader id="focus" icon={Target} title="Focus Priorities" />
          {expandedSections.has('focus') && (
            <div className="pb-3 space-y-2">
              <p className="text-xs text-gray-400">
                Set which audit areas the agent should prioritise or skip entirely.
              </p>
              <div className="space-y-1.5">
                {FOCUS_AREAS.map(area => {
                  const currentPriority =
                    current.focusPriorities.find(fp => fp.area === area.value)?.priority || 'normal';
                  return (
                    <div key={area.value} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{area.label}</span>
                      <div className="flex items-center gap-1">
                        {PRIORITY_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => {
                              const updated = current.focusPriorities.filter(
                                fp => fp.area !== area.value
                              );
                              updated.push({ area: area.value, priority: opt.value as AgentFocusPriority['priority'] });
                              update({ focusPriorities: updated });
                            }}
                            className={`px-2 py-0.5 text-xs rounded-md border transition-colors ${
                              currentPriority === opt.value
                                ? 'border-purple-300 bg-purple-50 text-purple-700'
                                : 'border-gray-200 text-gray-400 hover:border-gray-300'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Additional Rules */}
        <div className="px-3">
          <SectionHeader
            id="rules"
            icon={BookOpen}
            title="Additional Rules"
            count={current.additionalRules.filter(r => r.trim()).length}
          />
          {expandedSections.has('rules') && (
            <div className="pb-3 space-y-2">
              <p className="text-xs text-gray-400">
                Free-form rules the AI agent should follow during the audit.
              </p>
              {current.additionalRules.map((rule, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={rule}
                    onChange={e => {
                      const updated = [...current.additionalRules];
                      updated[idx] = e.target.value;
                      update({ additionalRules: updated });
                    }}
                    placeholder='e.g., "Always flag items priced below 1000 UGX as suspicious"'
                    className="flex-1 text-sm border rounded-md p-1.5 focus:ring-1 focus:ring-purple-500"
                  />
                  <button
                    onClick={() => removeRule(idx)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={addRule}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Rule
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
