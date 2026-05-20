/**
 * DeliverableProfileConfigDialog
 * Configures which deliverable types are required for a project and
 * which RAG aspects should be marked N/A per sourcing type.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/core/components/ui/dialog';
import { Settings2, Zap, Lock, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { DeliverableType, DeliverableRequirementsProfile } from '../../types';
import {
  DELIVERABLE_TYPES,
  AUTO_GENERATED_DELIVERABLE_TYPES,
  ALL_RAG_ASPECTS,
  DELIVERABLE_RAG_MAP,
} from '../../constants/deliverableConstants';
import { getSourcingTypeNADefaults } from '../../services/ragAutoUpdateService';
import { updateProject } from '../../services/firestore';

// ============================================
// Presets
// ============================================

const PRESETS: { label: string; description: string; types: DeliverableType[] }[] = [
  {
    label: 'Custom Millwork',
    description: 'Shop drawings, cut lists, BOMs, specs, 3D models, assembly instructions',
    types: ['shop-drawing', 'cut-list', 'bom', 'specification-sheet', '3d-model', 'assembly-instructions'],
  },
  {
    label: 'Procured Items',
    description: 'Specification sheets and client presentations',
    types: ['specification-sheet', 'client-presentation'],
  },
  {
    label: 'Design Documents',
    description: 'Concept sketches, renderings, client presentations',
    types: ['concept-sketch', 'rendering', 'client-presentation'],
  },
  {
    label: 'Full Service',
    description: 'All deliverable types included',
    types: DELIVERABLE_TYPES.map(dt => dt.value),
  },
];

const SOURCING_TYPES = [
  { key: 'CUSTOM_FURNITURE_MILLWORK', label: 'Custom Furniture / Millwork' },
  { key: 'PROCURED', label: 'Procured' },
  { key: 'DESIGN_DOCUMENT', label: 'Design Document' },
  { key: 'CONSTRUCTION', label: 'Construction' },
];

const autoGenSet = new Set<string>(AUTO_GENERATED_DELIVERABLE_TYPES);

// ============================================
// Component
// ============================================

interface DeliverableProfileConfigDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  userId: string;
  currentProfile?: DeliverableRequirementsProfile;
}

export function DeliverableProfileConfigDialog({
  open,
  onClose,
  projectId,
  userId,
  currentProfile,
}: DeliverableProfileConfigDialogProps) {
  // State: required types
  const [requiredTypes, setRequiredTypes] = useState<Set<DeliverableType>>(() => {
    if (currentProfile?.requiredTypes?.length) {
      return new Set(currentProfile.requiredTypes);
    }
    // Default: all types
    return new Set(DELIVERABLE_TYPES.map(dt => dt.value));
  });

  // State: N/A overrides per sourcing type
  const [naOverrides, setNaOverrides] = useState<Record<string, Set<string>>>(() => {
    const result: Record<string, Set<string>> = {};
    for (const st of SOURCING_TYPES) {
      result[st.key] = new Set(currentProfile?.naOverrides?.[st.key] || []);
    }
    return result;
  });

  // State: UI
  const [expandedSourcing, setExpandedSourcing] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Compute which RAG aspects are suggested as N/A when a deliverable type is unchecked
  const suggestedNA = useMemo(() => {
    const suggested = new Set<string>();
    for (const [type, aspects] of Object.entries(DELIVERABLE_RAG_MAP)) {
      if (!requiredTypes.has(type as DeliverableType)) {
        for (const a of aspects) suggested.add(a.path);
      }
    }
    return suggested;
  }, [requiredTypes]);

  const toggleType = useCallback((type: DeliverableType) => {
    setRequiredTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const applyPreset = useCallback((preset: DeliverableType[]) => {
    setRequiredTypes(new Set(preset));
  }, []);

  const toggleSourcingExpand = useCallback((key: string) => {
    setExpandedSourcing(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleNAOverride = useCallback((sourcingKey: string, aspectPath: string) => {
    setNaOverrides(prev => {
      const current = new Set(prev[sourcingKey] || []);
      if (current.has(aspectPath)) current.delete(aspectPath);
      else current.add(aspectPath);
      return { ...prev, [sourcingKey]: current };
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const profile: DeliverableRequirementsProfile = {
        requiredTypes: Array.from(requiredTypes),
        naOverrides: Object.fromEntries(
          Object.entries(naOverrides).map(([key, set]) => [key, Array.from(set)])
        ),
      };

      await updateProject(projectId, { deliverableProfile: profile }, userId);
      onClose();
    } catch (err) {
      console.error('Failed to save deliverable profile:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-gray-500" />
            Configure Deliverable Requirements
          </DialogTitle>
          <DialogDescription>
            Choose which deliverable types are required for this project and configure RAG aspect overrides per sourcing type.
          </DialogDescription>
        </DialogHeader>

        {/* Section 1: Required Deliverable Types */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-900">Required Deliverable Types</h4>
          <p className="text-xs text-gray-500">
            Unchecked types will be hidden from the matrix. Auto-generated types are always included.
          </p>

          {/* Presets */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(preset => (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset.types)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                title={preset.description}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Type checklist */}
          <div className="grid grid-cols-2 gap-2">
            {DELIVERABLE_TYPES.map(dt => {
              const isAuto = autoGenSet.has(dt.value);
              const checked = requiredTypes.has(dt.value);

              return (
                <label
                  key={dt.value}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
                    checked ? 'border-gray-300 bg-white' : 'border-gray-100 bg-gray-50 opacity-60',
                    isAuto && 'cursor-default',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked || isAuto}
                    disabled={isAuto}
                    onChange={() => !isAuto && toggleType(dt.value)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">{dt.label}</span>
                  {isAuto && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-600 ml-auto">
                      <Zap className="w-2.5 h-2.5" /> Auto
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          {suggestedNA.size > 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Unchecking deliverable types may leave some RAG aspects without a source. Consider marking them as N/A below.
            </p>
          )}
        </div>

        {/* Section 2: RAG Aspect Overrides */}
        <div className="space-y-3 mt-6">
          <h4 className="text-sm font-semibold text-gray-900">RAG Aspect Overrides</h4>
          <p className="text-xs text-gray-500">
            Mark RAG aspects as "Not Applicable" per sourcing type. Locked aspects are already N/A by default for that type.
          </p>

          {SOURCING_TYPES.map(st => {
            const isExpanded = expandedSourcing.has(st.key);
            const systemDefaults = new Set(getSourcingTypeNADefaults(st.key));
            const overrides = naOverrides[st.key] || new Set();
            const totalNA = systemDefaults.size + overrides.size;

            return (
              <div key={st.key} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSourcingExpand(st.key)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{st.label}</span>
                    <span className="text-xs text-gray-500">
                      {totalNA} N/A of {ALL_RAG_ASPECTS.length}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 space-y-1 border-t border-gray-100">
                    {ALL_RAG_ASPECTS.map(aspect => {
                      const isSystemDefault = systemDefaults.has(aspect.path);
                      const isOverridden = overrides.has(aspect.path);
                      const isNA = isSystemDefault || isOverridden;
                      const isSuggested = suggestedNA.has(aspect.path) && !isNA;

                      return (
                        <label
                          key={aspect.path}
                          className={cn(
                            'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                            isSystemDefault && 'opacity-50 cursor-default',
                            !isSystemDefault && 'cursor-pointer hover:bg-gray-50',
                            isSuggested && 'bg-amber-50/50',
                          )}
                        >
                          {isSystemDefault ? (
                            <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          ) : (
                            <input
                              type="checkbox"
                              checked={isOverridden}
                              onChange={() => toggleNAOverride(st.key, aspect.path)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          )}
                          <span className={cn(
                            'flex-1',
                            isNA ? 'text-gray-400 line-through' : 'text-gray-700',
                          )}>
                            {aspect.label}
                          </span>
                          {isSystemDefault && (
                            <span className="text-[10px] text-gray-400">Default N/A</span>
                          )}
                          {isSuggested && (
                            <span className="text-[10px] text-amber-500">Suggest N/A</span>
                          )}
                          {isNA && !isSystemDefault && (
                            <span className="text-[10px] text-blue-500">N/A override</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1d1d1f] rounded-lg hover:bg-[#2d2d2f] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : (
              <>
                <Check className="w-4 h-4" />
                Save Configuration
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
