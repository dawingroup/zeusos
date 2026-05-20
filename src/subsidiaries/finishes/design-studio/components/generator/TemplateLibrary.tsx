/**
 * TemplateLibrary — Management UI for furniture templates
 *
 * Displays template cards with thumbnails, allows creating new templates,
 * editing parameters, and seeding defaults. Used as a standalone management
 * view (not the generation configurator).
 */

import { useState, useEffect, useCallback } from 'react';
import { Box, Settings, Trash2, Download, Loader2 } from 'lucide-react';
import { listTemplates, deleteTemplate, seedDefaultTemplates } from '../../services/templateService';
import type { FurnitureTemplate } from '../../types/generation.types';

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  seating: { label: 'Seating', color: 'bg-blue-100 text-blue-700' },
  casegoods: { label: 'Casegoods', color: 'bg-amber-100 text-amber-700' },
  tables: { label: 'Tables', color: 'bg-green-100 text-green-700' },
  beds: { label: 'Beds', color: 'bg-purple-100 text-purple-700' },
  fitout: { label: 'Fitout', color: 'bg-cyan-100 text-cyan-700' },
  custom: { label: 'Custom', color: 'bg-gray-100 text-gray-600' },
};

interface TemplateLibraryProps {
  onSelectTemplate?: (template: FurnitureTemplate) => void;
}

export default function TemplateLibrary({ onSelectTemplate }: TemplateLibraryProps) {
  const [templates, setTemplates] = useState<FurnitureTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTemplates(categoryFilter || undefined);
      setTemplates(data);
    } catch (err) {
      console.error('[TemplateLibrary] Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const handleSeedDefaults = useCallback(async () => {
    setSeeding(true);
    try {
      const count = await seedDefaultTemplates();
      if (count > 0) {
        await loadTemplates();
      }
    } catch (err) {
      console.error('[TemplateLibrary] Failed to seed templates:', err);
    } finally {
      setSeeding(false);
    }
  }, [loadTemplates]);

  const handleDelete = useCallback(async (templateId: string) => {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    try {
      await deleteTemplate(templateId);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch (err) {
      console.error('[TemplateLibrary] Failed to delete template:', err);
    }
  }, []);

  return (
    <div className="flex flex-col gap-3 p-2 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Template Library ({templates.length})
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-[10px] border rounded px-1.5 py-0.5 bg-background"
          >
            <option value="">All</option>
            {Object.entries(CATEGORY_LABELS).map(([val, { label }]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Seed button (when empty) */}
      {!loading && templates.length === 0 && (
        <div className="text-center py-4 border-2 border-dashed rounded-lg">
          <Box className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-muted-foreground mb-2">No templates yet</p>
          <button
            onClick={handleSeedDefaults}
            disabled={seeding}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[10px] font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {seeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            {seeding ? 'Seeding...' : 'Seed Default Templates (4)'}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-6 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-1" />
          Loading templates...
        </div>
      )}

      {/* Template cards */}
      {!loading && templates.length > 0 && (
        <div className="flex flex-col gap-2">
          {templates.map((tmpl) => {
            const cat = CATEGORY_LABELS[tmpl.category] || CATEGORY_LABELS.custom;
            const isExpanded = expandedId === tmpl.id;

            return (
              <div key={tmpl.id} className="border rounded-lg overflow-hidden">
                {/* Card header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : tmpl.id)}
                  className="w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-muted/20 transition-colors"
                >
                  {tmpl.thumbnailUrl ? (
                    <img src={tmpl.thumbnailUrl} alt={tmpl.name} className="w-10 h-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted/30 flex items-center justify-center shrink-0">
                      <Box className="h-5 w-5 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[11px]">{tmpl.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`px-1 py-0.5 rounded text-[8px] font-medium ${cat.color}`}>
                        {cat.label}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {tmpl.parameters.length} params
                      </span>
                    </div>
                    {tmpl.description && (
                      <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1">{tmpl.description}</p>
                    )}
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3 py-2 border-t bg-muted/10">
                    {/* Parameters */}
                    <div className="text-[9px] font-medium text-muted-foreground uppercase mb-1">Parameters</div>
                    <div className="grid grid-cols-2 gap-1 mb-2">
                      {tmpl.parameters.map((p) => (
                        <div key={p.key} className="text-[9px] flex justify-between bg-background rounded px-1.5 py-0.5 border">
                          <span className="text-muted-foreground truncate">{p.label}</span>
                          <span className="font-medium ml-1">
                            {p.type === 'select' ? (p.options?.find(o => String(o.value) === String(p.default))?.label || String(p.default)) : String(p.default)}
                            {p.unit ? ` ${p.unit}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* BOM template */}
                    {tmpl.bomTemplate.length > 0 && (
                      <>
                        <div className="text-[9px] font-medium text-muted-foreground uppercase mb-1">BOM Template</div>
                        <div className="space-y-0.5 mb-2">
                          {tmpl.bomTemplate.map((b, i) => (
                            <div key={i} className="text-[9px] flex items-center gap-1">
                              <span className="capitalize">{b.materialCategory}</span>
                              <span className="text-muted-foreground">— {b.quantityExpression} {b.unit}</span>
                              {b.isVariantDriven && <span className="text-[8px] text-amber-600">(variant)</span>}
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Actions */}
                    <div className="flex gap-1.5 pt-1 border-t">
                      {onSelectTemplate && (
                        <button
                          onClick={() => onSelectTemplate(tmpl)}
                          className="flex-1 py-1 rounded text-[10px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1"
                        >
                          <Settings className="h-3 w-3" /> Use Template
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(tmpl.id)}
                        className="px-2 py-1 rounded text-[10px] border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center gap-1"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
