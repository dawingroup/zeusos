/**
 * Product Card Component
 * Enhanced card with deliverables count, gate status, and AI badges
 */

import { MoreVertical, Trash2, Edit, FileCheck, Sparkles, AlertCircle, CheckCircle, Eye } from 'lucide-react';
import { useState } from 'react';
import type { LaunchProduct } from '../../types/product.types';
import type { StageConfig } from '../../types/stage.types';

interface ProductCardProps {
  product: LaunchProduct;
  stageConfig: StageConfig;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

export function ProductCard({ 
  product, 
  stageConfig,
  onEdit, 
  onDelete,
  onDragStart,
}: ProductCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  // Calculate deliverables progress for current stage
  const requiredDeliverables = stageConfig.requiredDeliverables;
  const completedDeliverables = product.deliverables.filter(
    d => d.stage === product.currentStage && requiredDeliverables.includes(d.type)
  ).length;
  const deliverableProgress = requiredDeliverables.length > 0 
    ? Math.round((completedDeliverables / requiredDeliverables.length) * 100)
    : 100;

  // Check gate requirements
  const gateRequirements = stageConfig.gateRequirements;
  const passedGates = gateRequirements.filter(gate => {
    if (gate.type === 'data_field') {
      if (gate.id === 'has_name') return !!product.name;
      if (gate.id === 'has_category') return !!product.category;
      if (gate.id === 'dimensions_set') return !!product.specifications?.dimensions;
      return true;
    }
    if (gate.type === 'deliverable') {
      return product.deliverables.some(d => d.stage === product.currentStage);
    }
    return false;
  }).length;
  const gateProgress = gateRequirements.length > 0
    ? Math.round((passedGates / gateRequirements.length) * 100)
    : 100;

  // Check if product has AI-generated content
  const hasAIContent = !!product.namingSession || !!product.aiContent;

  // Priority colors
  const priorityColors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-100 text-blue-600',
    high: 'bg-orange-100 text-orange-600',
    urgent: 'bg-red-100 text-red-600',
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <a 
          href={`/launch-pipeline/product/${product.id}`}
          className="flex-1 min-w-0 cursor-pointer" 
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <h4 className="font-medium text-gray-900 truncate hover:text-[#872E5C] transition-colors">{product.name || 'Untitled Product'}</h4>
          <p className="text-xs text-gray-500 capitalize">{product.category}</p>
        </a>
        
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 min-h-[44px] min-w-[44px] hover:bg-gray-100 rounded"
          >
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-6 bg-white border rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
              <a
                href={`/launch-pipeline/product/${product.id}`}
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 w-full text-left"
              >
                <Eye className="w-3.5 h-3.5" />
                View
              </a>
              <button
                onClick={() => { onEdit(); setShowMenu(false); }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 w-full text-left"
              >
                <Edit className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                onClick={() => { onDelete(); setShowMenu(false); }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 w-full text-left text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <p className="text-xs text-gray-600 mb-2 line-clamp-2">{product.description}</p>
      )}

      {/* Progress Indicators */}
      <div className="space-y-1.5 mb-2">
        {/* Deliverables Progress */}
        <div className="flex items-center gap-2">
          <FileCheck className="w-3.5 h-3.5 text-gray-400" />
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${deliverableProgress}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{completedDeliverables}/{requiredDeliverables.length}</span>
        </div>

        {/* Gate Progress */}
        <div className="flex items-center gap-2">
          {gateProgress === 100 ? (
            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
          )}
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${gateProgress === 100 ? 'bg-green-500' : 'bg-amber-500'}`}
              style={{ width: `${gateProgress}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{passedGates}/{gateRequirements.length}</span>
        </div>
      </div>

      {/* Footer Badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[product.priority]}`}>
          {product.priority}
        </span>
        
        {hasAIContent && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-600">
            <Sparkles className="w-3 h-3" />
            AI
          </span>
        )}

        {product.shopifySync?.status === 'synced' && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-600">
            Published
          </span>
        )}
      </div>
    </div>
  );
}
