/**
 * Formula Application Panel
 * Modal for searching and applying formulas from the library to BOQ items.
 * Uses real formula service + rule-based/keyword suggestion matching
 * with hierarchy context (levels 2-4) for better recommendations.
 */

import { useState, useEffect, useMemo } from 'react';
import { X, Beaker, Search, Sparkles, TrendingUp, Check, Loader2, AlertCircle } from 'lucide-react';
import type { BOQItem, StandardFormula } from '../../types';
import { getFormulas } from '../../services/formulaService';
import { suggestFormulasQuick } from '../../services/formulaSuggestionService';

interface FormulaApplicationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: BOQItem[];
  onApply: (formulaId: string, formulaCode: string, wastageOverride?: number) => Promise<void>;
}

/**
 * Build a combined description from the item + its hierarchy headers (levels 2-4)
 * so that the suggestion engine has full context.
 */
function buildContextDescription(item: BOQItem): string {
  const parts: string[] = [];
  if (item.billName) parts.push(item.billName);
  if (item.elementName) parts.push(item.elementName);
  if (item.sectionName) parts.push(item.sectionName);
  if (item.specification) parts.push(item.specification);
  parts.push(item.description || '');
  return parts.join(' | ');
}

export function FormulaApplicationPanel({
  isOpen,
  onClose,
  selectedItems,
  onApply,
}: FormulaApplicationPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFormula, setSelectedFormula] = useState<StandardFormula | null>(null);
  const [wastageOverride, setWastageOverride] = useState<number | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [allFormulas, setAllFormulas] = useState<StandardFormula[]>([]);
  const [loadingFormulas, setLoadingFormulas] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ formula: StandardFormula; confidence: number; reasoning?: string }>>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Fetch all formulas from library when panel opens
  useEffect(() => {
    if (!isOpen) return;
    setLoadingFormulas(true);
    getFormulas()
      .then(formulas => setAllFormulas(formulas))
      .catch(err => console.error('Error loading formulas:', err))
      .finally(() => setLoadingFormulas(false));
  }, [isOpen]);

  // Generate AI suggestions based on selected items' hierarchy context
  useEffect(() => {
    if (!isOpen || allFormulas.length === 0 || selectedItems.length === 0) return;

    setLoadingSuggestions(true);

    // Build combined context from the first selected item + its hierarchy
    const primaryItem = selectedItems[0];
    const contextDesc = buildContextDescription(primaryItem);
    const unit = primaryItem.unit || '';

    suggestFormulasQuick(contextDesc, unit, 5)
      .then(results => {
        // Map suggestion codes back to full formula objects
        const mapped = results
          .map(s => {
            const formula = allFormulas.find(f => f.code === s.formulaCode);
            return formula ? { formula, confidence: s.confidence, reasoning: s.reasoning } : null;
          })
          .filter(Boolean) as Array<{ formula: StandardFormula; confidence: number; reasoning?: string }>;
        setSuggestions(mapped);
      })
      .catch(err => console.error('Error getting suggestions:', err))
      .finally(() => setLoadingSuggestions(false));
  }, [isOpen, allFormulas, selectedItems]);

  // Filter formulas by search term
  const filteredFormulas = useMemo(() => {
    if (!searchTerm.trim()) return allFormulas;
    const term = searchTerm.toLowerCase();
    return allFormulas.filter(
      f =>
        f.name.toLowerCase().includes(term) ||
        f.code.toLowerCase().includes(term) ||
        (f.description || '').toLowerCase().includes(term) ||
        (f.keywords || []).some(k => k.includes(term))
    );
  }, [allFormulas, searchTerm]);

  const handleApply = async () => {
    if (!selectedFormula) return;
    setIsApplying(true);
    try {
      await onApply(selectedFormula.id, selectedFormula.code, wastageOverride || undefined);
      onClose();
      setSelectedFormula(null);
      setWastageOverride(null);
      setSearchTerm('');
    } catch (error) {
      console.error('Error applying formula:', error);
      alert('Failed to apply formula. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  const renderFormulaCard = (
    formula: StandardFormula,
    confidence?: number,
    reasoning?: string,
  ) => (
    <button
      key={formula.id}
      onClick={() => setSelectedFormula(formula)}
      className={`text-left p-4 rounded-lg border-2 transition-colors w-full ${
        selectedFormula?.id === formula.id
          ? 'border-purple-500 bg-purple-50'
          : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">{formula.code}</span>
            <span className="text-sm font-medium text-gray-900 truncate">{formula.name}</span>
            {selectedFormula?.id === formula.id && <Check className="w-4 h-4 text-purple-600 flex-shrink-0" />}
          </div>
          {formula.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{formula.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{formula.category}</span>
            <span className="text-xs text-gray-400">Output: {formula.outputUnit}</span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {formula.usageCount || 0} uses
            </span>
            {formula.components && (
              <span className="text-xs text-gray-400">• {formula.components.length} materials</span>
            )}
          </div>
          {confidence != null && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1 bg-gray-200 rounded-full max-w-[100px]">
                <div
                  className={`h-1 rounded-full ${confidence >= 0.7 ? 'bg-green-500' : confidence >= 0.4 ? 'bg-yellow-500' : 'bg-gray-400'}`}
                  style={{ width: `${Math.round(confidence * 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{Math.round(confidence * 100)}% match</span>
            </div>
          )}
          {reasoning && <p className="text-xs text-blue-600 mt-1 italic">{reasoning}</p>}
        </div>
      </div>
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Beaker className="w-6 h-6 text-purple-600" />
              Apply Formula
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
              {allFormulas.length > 0 && ` • ${allFormulas.length} formulas in library`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Context Info — show hierarchy */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-purple-900 mb-2">Selected BOQ Items:</h3>
            <div className="space-y-1.5">
              {selectedItems.slice(0, 3).map((item) => (
                <div key={item.id} className="text-sm">
                  <span className="text-purple-700 font-medium">{item.hierarchyPath || item.itemNumber}</span>
                  <span className="text-purple-600"> — {item.description}</span>
                  {(item.sectionName || item.elementName) && (
                    <span className="block text-xs text-purple-500 ml-4 mt-0.5">
                      Context: {[item.elementName, item.sectionName].filter(Boolean).join(' → ')}
                    </span>
                  )}
                </div>
              ))}
              {selectedItems.length > 3 && (
                <p className="text-sm text-purple-600">... and {selectedItems.length - 3} more</p>
              )}
            </div>
          </div>

          {/* AI Suggestions */}
          {(loadingSuggestions || suggestions.length > 0) && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                Recommended Formulas
                <span className="text-xs text-gray-400 font-normal">Based on item description + hierarchy context</span>
              </h3>
              {loadingSuggestions ? (
                <div className="flex items-center gap-2 py-4 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Matching formulas to item descriptions...
                </div>
              ) : suggestions.length > 0 ? (
                <div className="space-y-2">
                  {suggestions.map(s => renderFormulaCard(s.formula, s.confidence, s.reasoning))}
                </div>
              ) : null}
            </div>
          )}

          {suggestions.length === 0 && !loadingSuggestions && allFormulas.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              No strong formula matches found. Try searching the library below or use the AI Formula Assistant.
            </div>
          )}

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Formula Library ({filteredFormulas.length} formulas)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, code, category, or keyword..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Formula List */}
          {loadingFormulas ? (
            <div className="flex items-center gap-2 py-8 justify-center text-gray-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading formula library...
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {(searchTerm ? filteredFormulas : filteredFormulas.slice(0, 10)).map(f => renderFormulaCard(f))}
              {!searchTerm && filteredFormulas.length > 10 && (
                <p className="text-xs text-gray-400 text-center py-2">
                  Showing top 10 of {filteredFormulas.length} — use search to find more
                </p>
              )}
              {searchTerm && filteredFormulas.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No formulas match "{searchTerm}"
                </p>
              )}
            </div>
          )}

          {/* Formula Preview */}
          {selectedFormula && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-medium text-gray-900">
                Formula Components — {selectedFormula.code}: {selectedFormula.name}
              </h3>
              <div className="space-y-2">
                {(selectedFormula.components || []).map((comp, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900">{comp.materialName}</span>
                      <p className="text-xs text-gray-500 mt-0.5">Wastage: {comp.wastagePercent}%</p>
                    </div>
                    <div className="text-sm text-gray-700">
                      {comp.quantity} {comp.unit} per {selectedFormula.outputUnit}
                    </div>
                  </div>
                ))}
              </div>

              {/* Wastage Override */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Override Wastage (Optional)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={wastageOverride || ''}
                    onChange={(e) => setWastageOverride(e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="Use formula defaults"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <span className="text-sm text-gray-600">%</span>
                  {wastageOverride != null && (
                    <button onClick={() => setWastageOverride(null)} className="text-sm text-purple-600 hover:text-purple-700">
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={isApplying}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!selectedFormula || isApplying}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Beaker className="w-4 h-4" />
                  Apply Formula
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
