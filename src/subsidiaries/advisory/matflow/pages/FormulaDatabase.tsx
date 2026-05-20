/**
 * Formula Database Page
 * Standard calculation formulas for construction materials
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  Calculator,
  Filter,
  Copy,
  CheckCircle2,
  Loader2,
  X,
  Plus,
  Edit,
  Trash2
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { getFormulas, incrementFormulaUsage, deleteFormula, createFormula, updateFormula } from '../services/formulaService';
import { MaterialCategory } from '../types';
import type { StandardFormula } from '../types';
import { FormulaEditor, type FormulaFormData } from '../components/FormulaEditor';
import { useAuth } from '@/core/hooks/useAuth';

const CATEGORIES: { value: MaterialCategory | ''; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: MaterialCategory.CONCRETE, label: 'Concrete' },
  { value: MaterialCategory.STEEL, label: 'Steel' },
  { value: MaterialCategory.MASONRY, label: 'Masonry' },
  { value: MaterialCategory.TIMBER, label: 'Timber' },
  { value: MaterialCategory.ROOFING, label: 'Roofing' },
  { value: MaterialCategory.PLUMBING, label: 'Plumbing' },
  { value: MaterialCategory.ELECTRICAL, label: 'Electrical' },
  { value: MaterialCategory.FINISHES, label: 'Finishes' },
];

const FormulaDatabase: React.FC = () => {
  const { user } = useAuth();
  const [formulas, setFormulas] = useState<StandardFormula[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | ''>('');
  const [selectedFormula, setSelectedFormula] = useState<StandardFormula | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<StandardFormula | null>(null);

  // Load formulas
  useEffect(() => {
    loadFormulas();
  }, [selectedCategory]);

  const loadFormulas = async () => {
    setIsLoading(true);
    try {
      const data = await getFormulas(selectedCategory || undefined);
      setFormulas(data);
    } catch (err) {
      console.error('Failed to load formulas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter by search
  const filteredFormulas = formulas.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Build a formula string from components
  const buildFormulaString = (formula: StandardFormula): string => {
    if (!formula.components || formula.components.length === 0) return formula.name;
    return formula.components.map(c => `${c.quantity} ${c.materialName}`).join(' + ');
  };

  const handleCopyFormula = async (formula: StandardFormula) => {
    try {
      await navigator.clipboard.writeText(buildFormulaString(formula));
      setCopiedId(formula.id);
      await incrementFormulaUsage(formula.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getCategoryLabel = (cat: MaterialCategory) => {
    return CATEGORIES.find(c => c.value === cat)?.label || cat;
  };

  const handleCreateFormula = () => {
    setEditingFormula(null);
    setIsEditorOpen(true);
  };

  const handleEditFormula = (formula: StandardFormula) => {
    setEditingFormula(formula);
    setIsEditorOpen(true);
  };

  const handleDeleteFormula = async (formula: StandardFormula) => {
    if (!user) return;

    if (!confirm(`Are you sure you want to delete the formula "${formula.name}"?`)) {
      return;
    }

    try {
      await deleteFormula(formula.id, user.uid);
      await loadFormulas();
    } catch (error) {
      console.error('Error deleting formula:', error);
      alert('Failed to delete formula. Please try again.');
    }
  };

  const handleSaveFormula = async (formData: FormulaFormData) => {
    if (!user) return;

    try {
      if (editingFormula) {
        // Update existing formula
        await updateFormula(editingFormula.id, formData, user.uid);
      } else {
        // Create new formula
        await createFormula(formData, user.uid);
      }

      // Reload formulas
      await loadFormulas();
      setIsEditorOpen(false);
      setEditingFormula(null);
    } catch (error) {
      console.error('Error saving formula:', error);
      throw error;
    }
  };

  return (
    <div>
      <PageHeader
        title="Formula Database"
        description="Standard calculation formulas for construction materials"
        breadcrumbs={[
          { label: 'MatFlow', href: '/advisory/matflow' },
          { label: 'Formula Database' },
        ]}
      />

      <div className="p-6">
        {/* Filters and Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search formulas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any | '')}
              className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white appearance-none"
            >
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCreateFormula}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            New Formula
          </button>
        </div>

        {/* Formulas Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
          </div>
        ) : filteredFormulas.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No formulas found</h3>
            <p className="text-gray-500">
              {searchQuery || selectedCategory 
                ? 'Try adjusting your search or filter' 
                : 'No formulas have been added yet'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredFormulas.map((formula) => (
              <div
                key={formula.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:border-amber-300 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => setSelectedFormula(formula)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-amber-700 transition-colors">{formula.name}</h3>
                    {formula.code && (
                      <span className="text-xs font-mono text-gray-500">{formula.code}</span>
                    )}
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                    {getCategoryLabel(formula.category as any)}
                  </span>
                </div>
                
                {formula.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{formula.description}</p>
                )}
                
                {/* Formula Display */}
                <div className="bg-gray-50 rounded-lg p-3 mb-3 font-mono text-sm">
                  <code className="text-gray-800">{buildFormulaString(formula)}</code>
                </div>
                
                {/* Components */}
                {formula.components && formula.components.length > 0 && (
                  <div className="text-xs text-gray-500 mb-3">
                    <span className="font-medium">Components: </span>
                    {formula.components.map((c, i) => (
                      <span key={i}>
                        {c.quantity} {c.materialName}
                        {i < formula.components.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Actions */}
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyFormula(formula);
                      }}
                      className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
                    >
                      {copiedId === formula.id ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                          <span className="text-green-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditFormula(formula);
                      }}
                      className="flex-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 flex items-center justify-center gap-1.5 text-sm font-medium"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Edit Formula
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFormula(formula);
                      }}
                      className="flex-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-md hover:bg-red-100 flex items-center justify-center gap-1.5 text-sm font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
                
                {/* Usage Count */}
                {formula.usageCount > 0 && (
                  <p className="text-xs text-gray-400 mt-2">
                    Used {formula.usageCount} times
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total Formulas</p>
            <p className="text-2xl font-semibold text-gray-900">{formulas.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Categories</p>
            <p className="text-2xl font-semibold text-gray-900">
              {new Set(formulas.map(f => f.category)).size}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Most Used</p>
            <p className="text-lg font-semibold text-gray-900 truncate">
              {formulas.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))[0]?.name || '-'}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total Usage</p>
            <p className="text-2xl font-semibold text-amber-600">
              {formulas.reduce((sum, f) => sum + (f.usageCount || 0), 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Formula Detail Modal */}
      {selectedFormula && (
        <FormulaDetailModal
          formula={selectedFormula}
          onClose={() => setSelectedFormula(null)}
          onCopy={() => handleCopyFormula(selectedFormula)}
          isCopied={copiedId === selectedFormula.id}
        />
      )}

      {/* Formula Editor Modal */}
      <FormulaEditor
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingFormula(null);
        }}
        formula={editingFormula}
        onSave={handleSaveFormula}
      />
    </div>
  );
};

// Formula Detail Drawer
interface FormulaDetailModalProps {
  formula: StandardFormula;
  onClose: () => void;
  onCopy: () => void;
  isCopied: boolean;
}

const FormulaDetailModal: React.FC<FormulaDetailModalProps> = ({
  formula,
  onClose,
  onCopy,
  isCopied,
}) => {
  // Build formula string from components
  const formulaString = formula.components && formula.components.length > 0
    ? formula.components.map(c => `${c.quantity} ${c.materialName}`).join(' + ')
    : formula.name;

  // Get category label
  const getCategoryLabel = (cat: string) => {
    return CATEGORIES.find(c => c.value === cat)?.label || cat;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900">{formula.name}</h3>
            {formula.code && (
              <span className="text-sm font-mono text-gray-500 mt-1 block">{formula.code}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {formula.description && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
              <p className="text-gray-600 leading-relaxed">{formula.description}</p>
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Formula Expression</h4>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <code className="text-amber-900 font-mono text-base">{formulaString}</code>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Category & Output</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Category</p>
                <p className="text-sm font-medium text-gray-900">{getCategoryLabel(formula.category as any)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Output Unit</p>
                <p className="text-sm font-medium text-gray-900">{formula.outputUnit}</p>
              </div>
            </div>
          </div>

          {formula.components && formula.components.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Material Components</h4>
              <div className="space-y-3">
                {formula.components.map((component, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-amber-300 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-gray-900">{component.materialName}</p>
                      <span className="font-mono font-semibold text-amber-600 text-lg">
                        {component.quantity} {component.unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Unit: {component.unit}</span>
                      {component.wastagePercent > 0 && (
                        <span>Wastage: {component.wastagePercent}%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {formula.keywords && formula.keywords.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Search Keywords</h4>
              <div className="flex flex-wrap gap-2">
                {formula.keywords.map((keyword, i) => (
                  <span key={i} className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {formula.usageCount > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Usage Statistics</p>
                  <p className="text-xs text-blue-700 mt-1">
                    This formula has been used {formula.usageCount} time{formula.usageCount !== 1 ? 's' : ''} in BOQ calculations
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
          >
            Close
          </button>
          <button
            onClick={onCopy}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-2 font-medium shadow-sm"
          >
            {isCopied ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Formula
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default FormulaDatabase;
