/**
 * MaterialSelector Component
 * Dropdown/modal for selecting materials from the library
 */

import { useState, useMemo } from 'react';
import { Search, Package, ChevronDown, X, Check } from 'lucide-react';
import { useProjectMaterials } from '../../hooks/useMaterials';
import { MATERIAL_CATEGORIES } from '../../types/materials';
import type { ResolvedMaterial, MaterialCategory } from '../../types/materials';

interface MaterialSelectorProps {
  projectId: string;
  customerId?: string;
  selectedMaterialId?: string;
  onSelect: (material: ResolvedMaterial) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MaterialSelector({
  projectId,
  customerId,
  selectedMaterialId,
  onSelect,
  disabled = false,
  placeholder = 'Select material...',
}: MaterialSelectorProps) {
  const { materials, loading } = useProjectMaterials(projectId, customerId);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<MaterialCategory | 'all'>('all');

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === selectedMaterialId),
    [materials, selectedMaterialId]
  );

  const filteredMaterials = useMemo(() => {
    let result = materials.filter((m) => m.status === 'active');

    if (categoryFilter !== 'all') {
      result = result.filter((m) => m.category === categoryFilter);
    }

    if (search) {
      const query = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.code.toLowerCase().includes(query)
      );
    }

    return result;
  }, [materials, categoryFilter, search]);

  const groupedMaterials = useMemo(() => {
    const groups = Object.fromEntries(
      Object.keys(MATERIAL_CATEGORIES).map((k) => [k, []])
    ) as unknown as Record<MaterialCategory, ResolvedMaterial[]>;

    filteredMaterials.forEach((m) => {
      if (groups[m.category]) {
        groups[m.category].push(m);
      }
    });

    return groups;
  }, [filteredMaterials]);

  const handleSelect = (material: ResolvedMaterial) => {
    onSelect(material);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-left ${
          disabled
            ? 'bg-gray-100 cursor-not-allowed'
            : 'bg-white hover:border-gray-400 cursor-pointer'
        } ${isOpen ? 'border-primary ring-1 ring-primary' : 'border-gray-300'}`}
      >
        {selectedMaterial ? (
          <div className="flex items-center gap-2">
            <span className="text-lg">{MATERIAL_CATEGORIES[selectedMaterial.category].icon}</span>
            <div>
              <span className="font-medium">{selectedMaterial.name}</span>
              <span className="text-gray-500 text-sm ml-2">
                {selectedMaterial.dimensions?.thickness}mm
              </span>
            </div>
          </div>
        ) : (
          <span className="text-gray-500">{loading ? 'Loading...' : placeholder}</span>
        )}
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-hidden">
            {/* Search & Filter */}
            <div className="p-2 border-b border-gray-200 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search materials..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => setCategoryFilter('all')}
                  className={`px-2 py-1 rounded text-xs ${
                    categoryFilter === 'all'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {Object.entries(MATERIAL_CATEGORIES).map(([key, { label, icon }]) => (
                  <button
                    key={key}
                    onClick={() => setCategoryFilter(key as MaterialCategory)}
                    className={`px-2 py-1 rounded text-xs ${
                      categoryFilter === key
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Materials List */}
            <div className="max-h-64 overflow-y-auto">
              {filteredMaterials.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No materials found</p>
                </div>
              ) : categoryFilter === 'all' ? (
                // Grouped view
                Object.entries(groupedMaterials).map(([category, items]) =>
                  items.length > 0 ? (
                    <div key={category}>
                      <div className="px-3 py-1.5 bg-gray-50 text-xs font-medium text-gray-500 sticky top-0">
                        {MATERIAL_CATEGORIES[category as MaterialCategory].icon}{' '}
                        {MATERIAL_CATEGORIES[category as MaterialCategory].label}
                      </div>
                      {items.map((material) => (
                        <MaterialOption
                          key={material.id}
                          material={material}
                          isSelected={material.id === selectedMaterialId}
                          onSelect={handleSelect}
                        />
                      ))}
                    </div>
                  ) : null
                )
              ) : (
                // Flat view
                filteredMaterials.map((material) => (
                  <MaterialOption
                    key={material.id}
                    material={material}
                    isSelected={material.id === selectedMaterialId}
                    onSelect={handleSelect}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MaterialOption({
  material,
  isSelected,
  onSelect,
}: {
  material: ResolvedMaterial;
  isSelected: boolean;
  onSelect: (material: ResolvedMaterial) => void;
}) {
  return (
    <button
      onClick={() => onSelect(material)}
      className={`w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 ${
        isSelected ? 'bg-primary/5' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <div>
          <div className="font-medium text-sm text-gray-900">{material.name}</div>
          <div className="text-xs text-gray-500">
            {material.code} • {material.dimensions?.thickness ?? '?'}mm
            {material.pricing?.unitCost && (
              <span className="ml-1">
                • {material.pricing.currency} {material.pricing.unitCost.toLocaleString()}/{material.pricing.unit}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${
            material.resolvedFrom === 'project'
              ? 'bg-purple-100 text-purple-700'
              : material.resolvedFrom === 'customer'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {material.resolvedFrom}
        </span>
        {isSelected && <Check className="h-4 w-4 text-primary" />}
      </div>
    </button>
  );
}

export default MaterialSelector;
