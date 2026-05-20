/**
 * Formula Library Page
 * View and manage standard formulas for material calculations
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Beaker, Plus, Edit, Trash2, Search, ArrowLeft } from 'lucide-react';
import { getFormulas, deleteFormula, createFormula, updateFormula } from '../services/formulaService';
import { FormulaEditor, type FormulaFormData } from '../components/FormulaEditor';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import type { StandardFormula } from '../types';
import { useAuth } from '@/core/hooks/useAuth';

const FormulaLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [formulas, setFormulas] = useState<StandardFormula[]>([]);
  const [filteredFormulas, setFilteredFormulas] = useState<StandardFormula[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<StandardFormula | null>(null);

  useEffect(() => {
    loadFormulas();
  }, []);

  useEffect(() => {
    filterFormulas();
  }, [formulas, searchTerm, categoryFilter]);

  const loadFormulas = async () => {
    setIsLoading(true);
    try {
      const data = await getFormulas();
      setFormulas(data);
    } catch (error) {
      console.error('Error loading formulas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterFormulas = () => {
    let filtered = formulas;

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(f => f.category === categoryFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(f =>
        f.name.toLowerCase().includes(term) ||
        f.code.toLowerCase().includes(term) ||
        f.description?.toLowerCase().includes(term)
      );
    }

    setFilteredFormulas(filtered);
  };

  const handleCreateFormula = () => {
    setEditingFormula(null);
    setIsEditorOpen(true);
  };

  const handleEditFormula = (formula: StandardFormula) => {
    setEditingFormula(formula);
    setIsEditorOpen(true);
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

  // Get unique categories
  const categories = Array.from(new Set(formulas.map(f => f.category))).sort();

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600">Loading formulas...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Beaker className="w-6 h-6 text-purple-600" />
              Formula Library
            </h2>
            <p className="text-gray-600 mt-1">Standard formulas for material calculations</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search formulas by name, code, or description..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Create Button */}
          <button
            onClick={handleCreateFormula}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Formula
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="mb-6">
        <KPIGrid cols={3}>
          <KPICard label="Total Formulas" value={formulas.length} />
          <KPICard label="Categories" value={categories.length} />
          <KPICard
            label="Most Used"
            value={
              <span className="text-[18px] font-semibold">
                {formulas.length > 0 ? formulas[0]?.name : 'N/A'}
              </span>
            }
          />
        </KPIGrid>
      </div>

      {/* Formula List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredFormulas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Output Unit
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Components
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usage
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredFormulas.map((formula) => (
                  <tr key={formula.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">
                      {formula.code}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-gray-900">{formula.name}</div>
                      {formula.description && (
                        <div className="text-gray-500 text-xs mt-1">{formula.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formula.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formula.outputUnit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded font-medium">
                        {formula.components?.length || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      {formula.usageCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditFormula(formula)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit formula"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteFormula(formula)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete formula"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Beaker className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No formulas found</p>
            {searchTerm || categoryFilter !== 'all' ? (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('all');
                }}
                className="text-purple-600 hover:text-purple-700 text-sm mt-2"
              >
                Clear filters
              </button>
            ) : (
              <button
                onClick={handleCreateFormula}
                className="text-purple-600 hover:text-purple-700 text-sm mt-2"
              >
                Create your first formula
              </button>
            )}
          </div>
        )}
      </div>

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

export default FormulaLibraryPage;
