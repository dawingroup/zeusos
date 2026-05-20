/**
 * ProjectPartsPicker Component
 * Modal to select parts from the project's parts library
 */

import { useState } from 'react';
import { X, Package, Search, Check, ExternalLink, Image } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectParts } from '../../hooks/useProjectParts';
import type { ProjectPart } from '../../types';

interface ProjectPartsPickerProps {
  projectId: string;
  onSelect: (part: ProjectPart, quantity: number) => void;
  onClose: () => void;
  excludePartIds?: string[]; // Parts already added to the design item
}

export function ProjectPartsPicker({ 
  projectId, 
  onSelect, 
  onClose,
  excludePartIds = []
}: ProjectPartsPickerProps) {
  const { user } = useAuth();
  const { parts, loading } = useProjectParts(projectId, user?.uid || '');
  const [search, setSearch] = useState('');
  const [selectedPart, setSelectedPart] = useState<ProjectPart | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Filter parts by search and exclude already added
  const availableParts = parts.filter(part => {
    if (excludePartIds.includes(part.id)) return false;
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      part.name.toLowerCase().includes(searchLower) ||
      part.supplier.toLowerCase().includes(searchLower) ||
      part.category.toLowerCase().includes(searchLower)
    );
  });

  const handleConfirm = () => {
    if (selectedPart && quantity > 0) {
      onSelect(selectedPart, quantity);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Select from Parts Library</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search parts by name, supplier, or category..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </div>
        </div>

        {/* Parts List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : availableParts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {parts.length === 0 
                  ? 'No parts in the project library yet. Convert clips to parts first.'
                  : 'No matching parts found.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {availableParts.map((part) => (
                <button
                  key={part.id}
                  onClick={() => setSelectedPart(part)}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                    selectedPart?.id === part.id
                      ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500/20'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {/* Image */}
                  <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {part.referenceImageUrl ? (
                      <img
                        src={part.referenceImageUrl}
                        alt={part.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-6 h-6 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-medium text-gray-900 line-clamp-1">{part.name}</h3>
                        <p className="text-sm text-gray-500">{part.supplier}</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                        {formatCurrency(part.unitCost, part.currency)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded capitalize">
                        {part.category}
                      </span>
                      {part.purchaseUrl && (
                        <a
                          href={part.purchaseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                        >
                          View source <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Selected indicator */}
                  {selectedPart?.id === part.id && (
                    <div className="flex-shrink-0">
                      <Check className="w-5 h-5 text-purple-600" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer with quantity and confirm */}
        {selectedPart && (
          <div className="p-4 border-t bg-gray-50">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Quantity:</span>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-center"
                />
                <span className="text-sm text-gray-500">
                  Total: {formatCurrency(selectedPart.unitCost * quantity, selectedPart.currency)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Add to Design Item
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
