/**
 * FormulaAssistantPanel
 *
 * Two-phase formula matching:
 *  Phase 1 — Recommend existing formulas from the library using the item's
 *            description + hierarchy context (levels 2-4: element, section, spec).
 *  Phase 2 — If no good match, offer Claude AI generation.
 *            AI-generated formulas are automatically saved to the library.
 */

import { useState, useEffect } from 'react';
import { Sparkles, Save, Check, AlertTriangle, ChevronDown, ChevronUp, Loader2, X, Beaker, TrendingUp, Wand2 } from 'lucide-react';
import type { BOQItem, StandardFormula } from '../../types';
import { getFormulas } from '../../services/formulaService';
import { suggestFormulasQuick } from '../../services/formulaSuggestionService';
import { useFormulaAssistant, type FormulaBreakdown, type FormulaComponent } from '../../hooks/useFormulaAssistant';
import { calculateMaterials } from '../../services/materialCalculator';
import { updateBOQItemMaterials } from '../../services/boqService';
import { useAuth } from '@/core/hooks/useAuth';

interface FormulaAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  boqItem: BOQItem | null;
  orgId: string;
  projectId: string;
  onApplied: () => void;
}

/** Build full context string from item + parent headers (levels 2-4) */
function buildContext(item: BOQItem): string {
  const parts: string[] = [];
  if (item.billName) parts.push(`Bill: ${item.billName}`);
  if (item.elementName) parts.push(`Element: ${item.elementName}`);
  if (item.sectionName) parts.push(`Section: ${item.sectionName}`);
  if (item.specification) parts.push(`Spec: ${item.specification}`);
  parts.push(`Item: ${item.description || ''}`);
  return parts.join(' | ');
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.7) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{Math.round(confidence * 100)}% match</span>;
  }
  if (confidence >= 0.4) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">{Math.round(confidence * 100)}% match</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{Math.round(confidence * 100)}% match</span>;
}

type PanelPhase = 'recommend' | 'generate';

export function FormulaAssistantPanel({
  isOpen,
  onClose,
  boqItem,
  orgId,
  projectId,
  onApplied,
}: FormulaAssistantPanelProps) {
  const { user } = useAuth();
  const { generateBreakdown, saveAsFormula, applyToItem, reset, loading: aiLoading, result: aiResult, error: aiError } = useFormulaAssistant(orgId, projectId);

  const [phase, setPhase] = useState<PanelPhase>('recommend');
  const [, setAllFormulas] = useState<StandardFormula[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{ formula: StandardFormula; confidence: number; reasoning?: string }>>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [applying, setApplying] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // AI generation state
  const [editedComponents, setEditedComponents] = useState<FormulaComponent[] | null>(null);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load formulas and compute suggestions when panel opens
  useEffect(() => {
    if (!isOpen || !boqItem) return;
    setPhase('recommend');
    setSuggestions([]);
    setSuccessMessage(null);
    setEditedComponents(null);
    reset();

    setLoadingSuggestions(true);

    getFormulas().then(formulas => {
      setAllFormulas(formulas);

      // Build context from item + hierarchy headers
      const contextDesc = buildContext(boqItem);
      const unit = boqItem.unit || '';

      return suggestFormulasQuick(contextDesc, unit, 5).then(results => {
        const mapped = results
          .map(s => {
            const formula = formulas.find(f => f.code === s.formulaCode);
            return formula ? { formula, confidence: s.confidence, reasoning: s.reasoning } : null;
          })
          .filter(Boolean) as Array<{ formula: StandardFormula; confidence: number; reasoning?: string }>;
        setSuggestions(mapped);
      });
    })
      .catch(err => console.error('Error loading suggestions:', err))
      .finally(() => setLoadingSuggestions(false));
  }, [isOpen, boqItem]);

  if (!isOpen || !boqItem) return null;

  const handleApplyExistingFormula = async (formula: StandardFormula) => {
    if (!user) return;
    setApplying(true);
    try {
      // Calculate materials using the real calculator (fetches prices from library)
      const itemWithFormula = { ...boqItem, formulaId: formula.id, formulaCode: formula.code };
      const calcResult = await calculateMaterials(itemWithFormula as any, { rateSource: 'standard' });

      if (calcResult.success) {
        await updateBOQItemMaterials(orgId, projectId, boqItem.id, user.uid, calcResult.requirements, formula.id, formula.code);
        setSuccessMessage(`Applied formula "${formula.code}" with ${calcResult.requirements.length} materials`);
        onApplied();
      } else {
        // Fallback: apply formula link without calculated materials
        await updateBOQItemMaterials(orgId, projectId, boqItem.id, user.uid, [], formula.id, formula.code);
        setSuccessMessage(`Linked formula "${formula.code}" (no material prices available yet)`);
        onApplied();
      }
    } catch (err) {
      console.error('Error applying formula:', err);
      alert('Failed to apply formula. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  const handleSwitchToGenerate = () => {
    setPhase('generate');
    setSuccessMessage(null);
  };

  const handleGenerate = async () => {
    setEditedComponents(null);
    setSuccessMessage(null);
    await generateBreakdown({
      description: boqItem.description || '',
      specification: [boqItem.sectionName, boqItem.elementName, boqItem.specification].filter(Boolean).join('. '),
      unit: boqItem.unit || 'nr',
      quantity: boqItem.quantityContract ?? boqItem.quantity ?? 0,
    });
  };

  const handleApplyAIResult = async () => {
    if (!aiResult || !user) return;
    setApplying(true);
    const breakdown: FormulaBreakdown = { ...aiResult, components: editedComponents || aiResult.components };

    // Auto-save to formula library
    setSaving(true);
    const formulaId = await saveAsFormula(breakdown);
    setSaving(false);

    // Apply to the item (multiply by BOQ line item quantity)
    const boqQty = boqItem.quantityContract ?? boqItem.quantity ?? 0;
    const success = await applyToItem(boqItem.id, boqQty, breakdown, formulaId || undefined);
    setApplying(false);
    if (success) {
      setSuccessMessage(formulaId
        ? `Applied & saved formula "${breakdown.formulaName}" to library`
        : 'Applied to item (save to library failed)');
      onApplied();
    }
  };

  const handleUpdateComponent = (index: number, field: keyof FormulaComponent, value: any) => {
    const current = editedComponents || aiResult?.components || [];
    const updated = [...current];
    updated[index] = { ...updated[index], [field]: value };
    setEditedComponents(updated);
  };

  const handleRemoveComponent = (index: number) => {
    const current = editedComponents || aiResult?.components || [];
    setEditedComponents(current.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    reset();
    setEditedComponents(null);
    setSuccessMessage(null);
    setSuggestions([]);
    onClose();
  };

  const components = editedComponents || aiResult?.components || [];
  const boqQty = boqItem.quantityContract ?? boqItem.quantity ?? 0;
  const computeTotal = (perUnit: number, wastage: number) =>
    Math.ceil(perUnit * boqQty * (1 + wastage / 100) * 100) / 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI Formula Assistant</h2>
              <p className="text-xs text-gray-500">
                {phase === 'recommend' ? 'Matching formulas from library' : 'Generating new formula with AI'}
              </p>
            </div>
          </div>
          {/* Phase toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPhase('recommend')}
              className={`px-3 py-1 text-xs rounded-md ${phase === 'recommend' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <Beaker className="w-3 h-3 inline mr-1" />
              Match
            </button>
            <button
              onClick={handleSwitchToGenerate}
              className={`px-3 py-1 text-xs rounded-md ${phase === 'generate' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <Wand2 className="w-3 h-3 inline mr-1" />
              Generate
            </button>
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg ml-2">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* BOQ Item Context */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 uppercase">BOQ Item</span>
              <span className="text-xs text-gray-400">{boqItem.itemNumber || boqItem.itemCode}</span>
            </div>
            <p className="text-sm text-gray-900 font-medium">{boqItem.description}</p>
            {/* Show hierarchy context */}
            {(boqItem.elementName || boqItem.sectionName) && (
              <div className="text-xs text-gray-500 space-y-0.5 pt-1 border-t border-gray-200 mt-2">
                {boqItem.billName && <div><span className="font-medium">Bill:</span> {boqItem.billName}</div>}
                {boqItem.elementName && <div><span className="font-medium">Element:</span> {boqItem.elementName}</div>}
                {boqItem.sectionName && <div><span className="font-medium">Section:</span> {boqItem.sectionName}</div>}
                {boqItem.specification && <div><span className="font-medium">Spec:</span> {boqItem.specification}</div>}
              </div>
            )}
            <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
              <span>Qty: <strong>{boqItem.quantityContract ?? boqItem.quantity ?? 0}</strong></span>
              <span>Unit: <strong>{boqItem.unit || '--'}</strong></span>
            </div>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-800">{successMessage}</span>
            </div>
          )}

          {/* ============ PHASE 1: RECOMMEND EXISTING FORMULAS ============ */}
          {phase === 'recommend' && (
            <>
              {loadingSuggestions ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-2">
                  <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                  <p className="text-sm text-gray-600">Matching formulas from library...</p>
                </div>
              ) : suggestions.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Beaker className="w-4 h-4 text-green-600" />
                    Recommended Formulas ({suggestions.length})
                  </h3>
                  {suggestions.map(({ formula, confidence, reasoning }) => (
                    <div key={formula.id} className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">{formula.code}</span>
                            <span className="text-sm font-medium text-gray-900">{formula.name}</span>
                            <ConfidenceBadge confidence={confidence} />
                          </div>
                          {formula.description && <p className="text-xs text-gray-500 mt-1">{formula.description}</p>}
                          {reasoning && <p className="text-xs text-blue-600 mt-1 italic">{reasoning}</p>}
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                            <span>{formula.category}</span>
                            <span>•</span>
                            <span>Output: {formula.outputUnit}</span>
                            <span>•</span>
                            <span>{(formula.components || []).length} materials</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{formula.usageCount || 0} uses</span>
                          </div>
                          {/* Show components preview */}
                          {formula.components && formula.components.length > 0 && (
                            <div className="mt-2 text-xs text-gray-500">
                              {formula.components.slice(0, 3).map((c, i) => (
                                <span key={i}>{i > 0 ? ', ' : ''}{c.materialName} ({c.quantity} {c.unit})</span>
                              ))}
                              {formula.components.length > 3 && <span> +{formula.components.length - 3} more</span>}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleApplyExistingFormula(formula)}
                          disabled={applying}
                          className="flex-shrink-0 ml-3 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Apply
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No matching formulas found in the library</p>
                  <p className="text-xs text-gray-400 mt-1">Try loading AAQS standard formulas, or generate a new one with AI</p>
                </div>
              )}

              {/* Always show option to generate */}
              <button
                onClick={handleSwitchToGenerate}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors text-sm"
              >
                <Wand2 className="w-4 h-4" />
                No match? Generate a new formula with AI
              </button>
            </>
          )}

          {/* ============ PHASE 2: AI GENERATION ============ */}
          {phase === 'generate' && (
            <>
              {/* Generate Button */}
              {!aiResult && !aiLoading && (
                <button
                  onClick={handleGenerate}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  <Sparkles className="w-5 h-5" />
                  Generate Material Breakdown with AI
                </button>
              )}

              {/* Loading */}
              {aiLoading && (
                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                  <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                  <p className="text-sm text-gray-600">Analyzing work item and calculating materials...</p>
                  <p className="text-xs text-gray-400">Generated formulas will be auto-saved to your library</p>
                </div>
              )}

              {/* Error */}
              {aiError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Generation Failed</p>
                    <p className="text-xs text-red-600 mt-1">{aiError}</p>
                    <button onClick={handleGenerate} className="mt-2 text-xs text-red-700 underline hover:no-underline">Try again</button>
                  </div>
                </div>
              )}

              {/* AI Results */}
              {aiResult && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{aiResult.formulaName}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">{aiResult.category}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">AI Generated</span>
                        <span className="text-xs text-gray-400">Will be saved to formula library</span>
                      </div>
                    </div>
                    <button onClick={handleGenerate} className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />Regenerate
                    </button>
                  </div>

                  {/* Quantity Impact Summary */}
                  {boqQty > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-blue-700 uppercase">Material Requirements for {boqQty} {boqItem.unit || 'units'}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {components.map((comp, i) => (
                          <div key={i} className="bg-white rounded px-2.5 py-1.5">
                            <div className="text-sm font-bold text-blue-900">
                              {computeTotal(comp.quantity, comp.wastagePercent).toLocaleString(undefined, { maximumFractionDigits: 2 })} {comp.unit}
                            </div>
                            <div className="text-xs text-blue-600 truncate">{comp.materialName}</div>
                            <div className="text-xs text-blue-400">{comp.quantity}/{boqItem.unit} x {boqQty} + {comp.wastagePercent}% waste</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Editable Components Table */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Material</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-20">Per {boqItem.unit || 'unit'}</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-16">Unit</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-20">Wastage</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-28">Total ({boqQty} {boqItem.unit || 'units'})</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {components.map((comp, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <span className="text-gray-900 font-medium">{comp.materialName}</span>
                              {comp.specification && <span className="block text-xs text-gray-400">{comp.specification}</span>}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input type="number" value={comp.quantity} onChange={e => handleUpdateComponent(i, 'quantity', parseFloat(e.target.value) || 0)}
                                className="w-20 text-right text-sm border border-gray-200 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-purple-400" step="0.01" />
                            </td>
                            <td className="px-3 py-2 text-gray-600">{comp.unit}</td>
                            <td className="px-3 py-2 text-right">
                              <input type="number" value={comp.wastagePercent} onChange={e => handleUpdateComponent(i, 'wastagePercent', parseFloat(e.target.value) || 0)}
                                className="w-16 text-right text-sm border border-gray-200 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-purple-400" step="0.5" min="0" max="50" />
                              <span className="text-xs text-gray-400 ml-0.5">%</span>
                            </td>
                            <td className="px-3 py-2 text-right text-sm font-bold text-blue-700">
                              {computeTotal(comp.quantity, comp.wastagePercent).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              <span className="text-xs text-gray-400 font-normal ml-1">{comp.unit}</span>
                            </td>
                            <td className="px-1 py-2">
                              <button onClick={() => handleRemoveComponent(i)} className="p-1 text-gray-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Assumptions */}
                  {aiResult.assumptions && aiResult.assumptions.length > 0 && (
                    <div>
                      <button onClick={() => setShowAssumptions(!showAssumptions)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                        {showAssumptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {aiResult.assumptions.length} assumptions
                      </button>
                      {showAssumptions && (
                        <ul className="mt-2 space-y-1 pl-4">
                          {aiResult.assumptions.map((a, i) => <li key={i} className="text-xs text-gray-500 list-disc">{a}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer — only for AI generation results */}
        {phase === 'generate' && aiResult && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Save className="w-3.5 h-3.5" />
              Formula will be auto-saved to library on apply
            </p>
            <button
              onClick={handleApplyAIResult}
              disabled={applying || saving}
              className="flex items-center gap-2 px-5 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 font-medium"
            >
              {applying || saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Apply & Save to Library
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
