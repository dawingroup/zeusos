/**
 * Material Library Page
 * Manage construction materials catalog
 */

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Package,
  Filter,
  ChevronRight,
  Loader2,
  X,
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { materialService } from '../services/material-service';
import MaterialDetailDrawer from '../components/materials/MaterialDetailDrawer';
import type { Material, MaterialCategoryExtended } from '../types/material';
import { useAuth } from '@/core/hooks/useAuth';

const CATEGORIES: { value: MaterialCategoryExtended; label: string }[] = [
  { value: 'cement_concrete', label: 'Cement & Concrete' },
  { value: 'steel_reinforcement', label: 'Steel & Reinforcement' },
  { value: 'masonry', label: 'Masonry' },
  { value: 'timber', label: 'Timber' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'finishes', label: 'Finishes' },
  { value: 'doors_windows', label: 'Doors & Windows' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'aggregates', label: 'Aggregates' },
  { value: 'chemicals', label: 'Chemicals' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_COLOURS: Record<string, string> = {
  cement_concrete: 'bg-gray-100 text-gray-700',
  steel_reinforcement: 'bg-blue-100 text-blue-700',
  masonry: 'bg-orange-100 text-orange-700',
  timber: 'bg-amber-100 text-amber-700',
  roofing: 'bg-red-100 text-red-700',
  plumbing: 'bg-cyan-100 text-cyan-700',
  electrical: 'bg-yellow-100 text-yellow-700',
  finishes: 'bg-purple-100 text-purple-700',
  doors_windows: 'bg-indigo-100 text-indigo-700',
  hardware: 'bg-zinc-100 text-zinc-700',
  aggregates: 'bg-stone-100 text-stone-700',
  chemicals: 'bg-green-100 text-green-700',
  equipment: 'bg-rose-100 text-rose-700',
  other: 'bg-gray-100 text-gray-500',
};

const MaterialLibrary: React.FC = () => {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategoryExtended | ''>('');
  const [showAddModal, setShowAddModal] = useState(false);
  // Detail drawer — null means closed
  const [drawerMaterial, setDrawerMaterial] = useState<Material | null>(null);

  useEffect(() => {
    loadMaterials();
  }, [selectedCategory]);

  const loadMaterials = async () => {
    setIsLoading(true);
    try {
      let data: Material[];
      if (selectedCategory) {
        data = await materialService.getMaterialsByCategory(selectedCategory);
      } else {
        data = await materialService.getAllMaterials();
      }
      setMaterials(data);
    } catch (err) {
      console.error('Failed to load materials:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMaterials = materials.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryLabel = (cat: MaterialCategoryExtended) =>
    CATEGORIES.find(c => c.value === cat)?.label || cat;

  const formatMoney = (amount: number, currency: string = 'UGX') =>
    new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);

  // Update a single material in the list in-place after drawer save / AI pricing
  const handleDrawerSaved = (updated: Material) => {
    setMaterials(prev => prev.map(m => m.id === updated.id ? updated : m));
    // Keep drawer open so user can continue editing
    setDrawerMaterial(updated);
  };

  return (
    <div>
      <PageHeader
        title="Material Library"
        description="Manage your construction materials catalog"
        breadcrumbs={[
          { label: 'MatFlow', href: '/advisory/matflow' },
          { label: 'Material Library' },
        ]}
        actions={
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Material
          </button>
        }
      />

      <div className="p-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search materials…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as MaterialCategoryExtended | '')}
              className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white appearance-none"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Materials List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No materials found</h3>
            <p className="text-gray-500 mb-4">
              {searchQuery || selectedCategory
                ? 'Try adjusting your filters'
                : 'Add your first material to the library'}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700"
            >
              <Plus className="w-4 h-4" />
              Add Material
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Code</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Material</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Unit</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Rate</th>
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMaterials.map((material) => {
                  const isMarketPriced = material.rateHistory?.[0]?.source === 'market';
                  return (
                    <tr
                      key={material.id}
                      onClick={() => setDrawerMaterial(material)}
                      className="hover:bg-amber-50 cursor-pointer group"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-gray-600">{material.code}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 group-hover:text-amber-700 transition-colors">
                            {material.name}
                          </p>
                          {material.description && (
                            <p className="text-sm text-gray-500 truncate max-w-xs">{material.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLOURS[material.category] || 'bg-gray-100 text-gray-600'}`}>
                          {getCategoryLabel(material.category)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{material.baseUnit}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium text-gray-900">
                          {formatMoney(material.standardRate.amount, material.standardRate.currency)}
                        </span>
                        <span className="text-sm text-gray-500">/{material.baseUnit}</span>
                        {isMarketPriced && (
                          <div className="text-xs text-green-600 font-medium mt-0.5">AI Market Price</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-amber-500 transition-colors" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total Materials</p>
            <p className="text-2xl font-semibold text-gray-900">{materials.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Categories</p>
            <p className="text-2xl font-semibold text-gray-900">
              {new Set(materials.map(m => m.category)).size}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">AI Market Priced</p>
            <p className="text-2xl font-semibold text-green-600">
              {materials.filter(m => m.rateHistory?.[0]?.source === 'market').length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Active</p>
            <p className="text-2xl font-semibold text-green-600">
              {materials.filter(m => m.isActive).length}
            </p>
          </div>
        </div>
      </div>

      {/* Add Material Modal (compact) */}
      {showAddModal && (
        <MaterialAddModal
          onClose={() => setShowAddModal(false)}
          onSave={() => { setShowAddModal(false); loadMaterials(); }}
          userId={user?.uid || ''}
        />
      )}

      {/* Detail / Edit Drawer */}
      <MaterialDetailDrawer
        material={drawerMaterial}
        onClose={() => setDrawerMaterial(null)}
        onSaved={handleDrawerSaved}
        userId={user?.uid || ''}
      />
    </div>
  );
};

// ─── Add Material Modal (lean — just the essentials to create) ────────────────

interface MaterialAddModalProps {
  onClose: () => void;
  onSave: () => void;
  userId: string;
}

const MaterialAddModal: React.FC<MaterialAddModalProps> = ({ onClose, onSave, userId }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    category: 'other' as MaterialCategoryExtended,
    baseUnit: '',
    rateAmount: 0,
    rateCurrency: 'UGX',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await materialService.createMaterial({
        code: formData.code,
        name: formData.name,
        description: formData.description,
        category: formData.category,
        baseUnit: formData.baseUnit,
        standardRate: { amount: formData.rateAmount, currency: formData.rateCurrency },
      }, userId);
      onSave();
    } catch (err) {
      console.error('Failed to create material:', err);
      alert('Failed to create material');
    } finally {
      setIsSubmitting(false);
    }
  };

  const CATEGORIES_LIST: { value: MaterialCategoryExtended; label: string }[] = [
    { value: 'cement_concrete', label: 'Cement & Concrete' },
    { value: 'steel_reinforcement', label: 'Steel & Reinforcement' },
    { value: 'masonry', label: 'Masonry' },
    { value: 'timber', label: 'Timber' },
    { value: 'roofing', label: 'Roofing' },
    { value: 'plumbing', label: 'Plumbing' },
    { value: 'electrical', label: 'Electrical' },
    { value: 'finishes', label: 'Finishes' },
    { value: 'doors_windows', label: 'Doors & Windows' },
    { value: 'hardware', label: 'Hardware' },
    { value: 'aggregates', label: 'Aggregates' },
    { value: 'chemicals', label: 'Chemicals' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Add Material</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <input
                type="text" required
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="e.g., CEM-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select
                required
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value as MaterialCategoryExtended })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              >
                {CATEGORIES_LIST.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text" required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="e.g., Portland Cement 50kg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base Unit *</label>
              <input
                type="text" required
                value={formData.baseUnit}
                onChange={e => setFormData({ ...formData, baseUnit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="e.g., bag, kg, m³"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate (UGX) *</label>
              <input
                type="number" required min="0"
                value={formData.rateAmount}
                onChange={e => setFormData({ ...formData, rateAmount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="0"
              />
            </div>
          </div>

          <p className="text-xs text-gray-400">
            After adding, click the row to open the detail drawer where you can add specifications, alternative units, suppliers, and get AI market pricing.
          </p>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Material
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MaterialLibrary;
