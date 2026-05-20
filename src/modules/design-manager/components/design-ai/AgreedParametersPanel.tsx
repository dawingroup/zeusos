/**
 * Agreed Parameters Panel
 * Displays AI-suggested parameters with option to apply them
 * back to the design item's DesignParameters in Firestore.
 */

import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Sparkles, Save, Loader2, AlertCircle } from 'lucide-react';
import type { SuggestedParameters } from './useDesignChat';

interface AgreedParametersPanelProps {
  messageId: string;
  parameters: SuggestedParameters;
  alreadyApplied?: boolean;
  onApply: (messageId: string, params: SuggestedParameters) => Promise<void>;
  isApplying: boolean;
}

type FieldGroup = 'dimensions' | 'primaryMaterial' | 'finish' | 'hardware' | 'construction' | 'joinery' | 'awiGrade' | 'specialRequirements' | 'description';

const FIELD_GROUP_LABELS: Record<FieldGroup, string> = {
  description: 'Description',
  dimensions: 'Dimensions',
  primaryMaterial: 'Primary Material',
  finish: 'Finish',
  hardware: 'Hardware',
  construction: 'Construction Method',
  joinery: 'Joinery Types',
  awiGrade: 'AWI Grade',
  specialRequirements: 'Special Requirements',
};

export function AgreedParametersPanel({
  messageId,
  parameters,
  alreadyApplied = false,
  onApply,
  isApplying,
}: AgreedParametersPanelProps) {
  const [isExpanded, setIsExpanded] = useState(!alreadyApplied);
  const [selectedFields, setSelectedFields] = useState<Set<FieldGroup>>(new Set(getAvailableFields(parameters)));
  const [applied, setApplied] = useState(alreadyApplied);

  const availableFields = getAvailableFields(parameters);

  if (availableFields.length === 0) return null;

  const toggleField = (field: FieldGroup) => {
    if (applied) return;
    const next = new Set(selectedFields);
    if (next.has(field)) {
      next.delete(field);
    } else {
      next.add(field);
    }
    setSelectedFields(next);
  };

  const handleApply = async () => {
    if (applied || isApplying || selectedFields.size === 0) return;

    // Build filtered parameters based on selected fields
    const filtered: SuggestedParameters = {};
    if (selectedFields.has('description')) filtered.description = parameters.description;
    if (selectedFields.has('dimensions')) filtered.dimensions = parameters.dimensions;
    if (selectedFields.has('primaryMaterial')) filtered.primaryMaterial = parameters.primaryMaterial;
    if (selectedFields.has('finish')) filtered.finish = parameters.finish;
    if (selectedFields.has('hardware')) filtered.hardware = parameters.hardware;
    if (selectedFields.has('construction')) filtered.constructionMethod = parameters.constructionMethod;
    if (selectedFields.has('joinery')) filtered.joineryTypes = parameters.joineryTypes;
    if (selectedFields.has('awiGrade')) filtered.awiGrade = parameters.awiGrade;
    if (selectedFields.has('specialRequirements')) filtered.specialRequirements = parameters.specialRequirements;

    await onApply(messageId, filtered);
    setApplied(true);
  };

  const confidenceColor = parameters.confidence
    ? parameters.confidence >= 0.8 ? 'text-green-600'
      : parameters.confidence >= 0.6 ? 'text-amber-600'
      : 'text-red-600'
    : 'text-gray-500';

  return (
    <div className={`mt-2 border rounded-xl p-3 space-y-2 shadow-sm ${
      applied
        ? 'bg-green-50 border-green-200'
        : 'bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-xs font-semibold text-purple-700 hover:text-purple-900"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {applied ? 'Parameters Applied' : 'Suggested Parameters'}
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <div className="flex items-center gap-2">
          {parameters.confidence != null && (
            <span className={`text-[10px] ${confidenceColor}`}>
              {Math.round(parameters.confidence * 100)}%
            </span>
          )}
          {applied ? (
            <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-[10px] font-medium">
              <Check className="w-3 h-3" />
              Applied
            </span>
          ) : (
            <button
              onClick={handleApply}
              disabled={isApplying || selectedFields.size === 0}
              className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded-lg text-[10px] font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Save className="w-3 h-3" />
                  Apply to Item ({selectedFields.size})
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Field Groups */}
      {isExpanded && (
        <div className="space-y-1.5 pt-1">
          {availableFields.map((field) => (
            <FieldRow
              key={field}
              field={field}
              parameters={parameters}
              selected={selectedFields.has(field)}
              onToggle={() => toggleField(field)}
              disabled={applied}
            />
          ))}

          {/* Reasoning */}
          {parameters.reasoning && (
            <div className="pt-1.5 border-t border-purple-200/50">
              <p className="text-[10px] text-gray-500 italic flex items-start gap-1">
                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                {parameters.reasoning}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Field Row Sub-component
// ============================================

interface FieldRowProps {
  field: FieldGroup;
  parameters: SuggestedParameters;
  selected: boolean;
  onToggle: () => void;
  disabled: boolean;
}

function FieldRow({ field, parameters, selected, onToggle, disabled }: FieldRowProps) {
  const value = getFieldPreview(field, parameters);
  if (!value) return null;

  return (
    <label className={`flex items-start gap-2 p-1.5 rounded-lg cursor-pointer transition-colors ${
      disabled ? 'opacity-75' : selected ? 'bg-white/60' : 'hover:bg-white/40'
    }`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        disabled={disabled}
        className="mt-0.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
      />
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
          {FIELD_GROUP_LABELS[field]}
        </span>
        <p className="text-xs text-gray-700 truncate">{value}</p>
      </div>
    </label>
  );
}

// ============================================
// Helpers
// ============================================

function getAvailableFields(params: SuggestedParameters): FieldGroup[] {
  const fields: FieldGroup[] = [];
  if (params.description) fields.push('description');
  if (params.dimensions && (params.dimensions.width || params.dimensions.height || params.dimensions.depth)) {
    fields.push('dimensions');
  }
  if (params.primaryMaterial?.name) fields.push('primaryMaterial');
  if (params.finish?.type) fields.push('finish');
  if (params.hardware && params.hardware.length > 0) fields.push('hardware');
  if (params.constructionMethod) fields.push('construction');
  if (params.joineryTypes && params.joineryTypes.length > 0) fields.push('joinery');
  if (params.awiGrade) fields.push('awiGrade');
  if (params.specialRequirements && params.specialRequirements.length > 0) fields.push('specialRequirements');
  return fields;
}

function getFieldPreview(field: FieldGroup, params: SuggestedParameters): string | null {
  switch (field) {
    case 'description':
      return params.description?.slice(0, 80) + (params.description && params.description.length > 80 ? '...' : '') || null;
    case 'dimensions': {
      if (!params.dimensions) return null;
      const d = params.dimensions;
      const parts = [];
      if (d.width) parts.push(`W:${d.width}`);
      if (d.height) parts.push(`H:${d.height}`);
      if (d.depth) parts.push(`D:${d.depth}`);
      return parts.length > 0 ? `${parts.join(' x ')} ${d.unit || 'mm'}` : null;
    }
    case 'primaryMaterial': {
      if (!params.primaryMaterial) return null;
      const m = params.primaryMaterial;
      return `${m.name}${m.thickness ? ` (${m.thickness}mm)` : ''} - ${m.type}`;
    }
    case 'finish': {
      if (!params.finish) return null;
      const f = params.finish;
      return [f.type, f.color, f.sheen].filter(Boolean).join(', ');
    }
    case 'hardware': {
      if (!params.hardware?.length) return null;
      return params.hardware.map(h => `${h.quantity}x ${h.name}`).join(', ');
    }
    case 'construction':
      return params.constructionMethod?.replace('-', ' ') || null;
    case 'joinery':
      return params.joineryTypes?.map(j => j.replace('-', ' ')).join(', ') || null;
    case 'awiGrade':
      return params.awiGrade || null;
    case 'specialRequirements':
      return params.specialRequirements?.join('; ') || null;
    default:
      return null;
  }
}
