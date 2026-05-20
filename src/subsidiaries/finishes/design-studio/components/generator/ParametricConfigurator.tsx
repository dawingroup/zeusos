/**
 * ParametricConfigurator — Template selector + parameter form for parametric generation
 *
 * Displays a grid of furniture templates, then shows a parameter form
 * for the selected template. Submits to the generateParametric Cloud Function.
 */

import { useState, useCallback, useEffect } from 'react';
import { Box, ChevronLeft, Wand2 } from 'lucide-react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/firebase/config';
import GenerationProgress from './GenerationProgress';
import type { FurnitureTemplate, ParameterDefinition, GenerationProgress as ProgressType } from '../../types/generation.types';

const CATEGORY_LABELS: Record<string, string> = {
  seating: 'Seating',
  casegoods: 'Casegoods',
  tables: 'Tables',
  beds: 'Beds',
  fitout: 'Fitout',
  custom: 'Custom',
};

interface ParametricConfiguratorProps {
  onGenerate: (templateId: string, parameters: Record<string, unknown>) => Promise<void>;
  progress: ProgressType;
}

export default function ParametricConfigurator({
  onGenerate,
  progress,
}: ParametricConfiguratorProps) {
  const [templates, setTemplates] = useState<FurnitureTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<FurnitureTemplate | null>(null);
  const [parameters, setParameters] = useState<Record<string, unknown>>({});
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // Fetch templates
  useEffect(() => {
    (async () => {
      try {
        const constraints: import('firebase/firestore').QueryConstraint[] = [orderBy('name')];
        if (categoryFilter) constraints.unshift(where('category', '==', categoryFilter));

        const q = query(collection(db, 'furnitureTemplates'), ...constraints);
        const snap = await getDocs(q);
        setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as FurnitureTemplate)));
      } catch (err) {
        console.warn('[ParametricConfigurator] Failed to load templates:', err);
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [categoryFilter]);

  // Initialize parameters from template defaults when selected
  useEffect(() => {
    if (!selectedTemplate) return;
    const defaults: Record<string, unknown> = {};
    for (const param of selectedTemplate.parameters) {
      defaults[param.key] = param.default;
    }
    setParameters(defaults);
  }, [selectedTemplate]);

  const handleParameterChange = useCallback((key: string, value: unknown) => {
    setParameters(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedTemplate) return;
    await onGenerate(selectedTemplate.id, parameters);
  }, [selectedTemplate, parameters, onGenerate]);

  const isGenerating = progress.status !== 'idle' && progress.status !== 'complete' && progress.status !== 'error';

  // Template detail view
  if (selectedTemplate) {
    return (
      <div className="flex flex-col gap-3 p-2 text-xs">
        <button
          onClick={() => setSelectedTemplate(null)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3 w-3" /> Back to templates
        </button>

        <div className="border rounded-lg p-2 bg-muted/10">
          <div className="font-semibold text-sm">{selectedTemplate.name}</div>
          <div className="text-[10px] text-muted-foreground capitalize">
            {selectedTemplate.category} · {selectedTemplate.classification}
          </div>
          {selectedTemplate.description && (
            <p className="text-[10px] text-muted-foreground mt-1">{selectedTemplate.description}</p>
          )}
        </div>

        {/* Parameter Form */}
        <div className="flex flex-col gap-2">
          {selectedTemplate.parameters.map((param) => (
            <ParameterField
              key={param.key}
              definition={param}
              value={parameters[param.key]}
              onChange={(val) => handleParameterChange(param.key, val)}
            />
          ))}
        </div>

        {progress.status !== 'idle' && <GenerationProgress progress={progress} />}

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full py-2 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <Wand2 className="h-3.5 w-3.5" />
          {isGenerating ? 'Generating...' : 'Generate Model'}
        </button>
      </div>
    );
  }

  // Template grid view
  return (
    <div className="flex flex-col gap-2 p-2 text-xs">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Furniture Templates
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-[10px] border rounded px-1.5 py-0.5 bg-background"
        >
          <option value="">All</option>
          {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-6 text-muted-foreground">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-6">
          <Box className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">No templates available yet</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Templates will be added in Phase H.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {templates.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => setSelectedTemplate(tmpl)}
              className="border rounded-lg p-2 text-left hover:border-primary/50 hover:bg-muted/20 transition-colors"
            >
              {tmpl.thumbnailUrl ? (
                <img src={tmpl.thumbnailUrl} alt={tmpl.name} className="w-full aspect-square object-cover rounded mb-1.5" />
              ) : (
                <div className="w-full aspect-square bg-muted/30 rounded mb-1.5 flex items-center justify-center">
                  <Box className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
              <div className="font-medium text-[11px] truncate">{tmpl.name}</div>
              <div className="text-[9px] text-muted-foreground capitalize">{tmpl.category}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Individual parameter field renderer */
function ParameterField({
  definition,
  value,
  onChange,
}: {
  definition: ParameterDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (definition.type) {
    case 'number':
      return (
        <div>
          <label className="text-[10px] font-medium">
            {definition.label}
            {definition.unit && <span className="text-muted-foreground ml-1">({definition.unit})</span>}
          </label>
          <input
            type="number"
            value={value as number || ''}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            min={definition.min}
            max={definition.max}
            step={definition.step || 1}
            className="w-full px-2 py-1 text-[11px] border rounded bg-background mt-0.5"
          />
        </div>
      );
    case 'select':
      return (
        <div>
          <label className="text-[10px] font-medium">{definition.label}</label>
          <select
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-1 text-[11px] border rounded bg-background mt-0.5"
          >
            {definition.options?.map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    case 'boolean':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded border-border h-3.5 w-3.5"
          />
          <span className="text-[10px] font-medium">{definition.label}</span>
        </label>
      );
    default:
      return null;
  }
}
