/**
 * Product Card Component
 * Individual product card for pipeline board
 */

import { MoreVertical, Edit2, Trash2, Calendar, Clock } from 'lucide-react';
import { useState } from 'react';
import type { RoadmapProduct } from '../../types/roadmap';
import { PRIORITY_CONFIG } from '../../types/roadmap';

interface ProductCardProps {
  product: RoadmapProduct;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateProgress: (progress: number) => void;
  onDragStart: (e: React.DragEvent) => void;
}

export function ProductCard({ 
  product, 
  onEdit, 
  onDelete, 
  onUpdateProgress,
  onDragStart,
}: ProductCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const priorityConfig = PRIORITY_CONFIG[product.priority];

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateProgress(parseInt(e.target.value));
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate">{product.name}</h4>
          {product.description && (
            <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{product.description}</p>
          )}
        </div>
        <div className="relative ml-2">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              <button
                onClick={() => { onEdit(); setShowMenu(false); }}
                className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                onClick={() => { onDelete(); setShowMenu(false); }}
                className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{product.progressPercent}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={product.progressPercent}
          onChange={handleProgressChange}
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs">
        <span className={`font-medium ${priorityConfig.color}`}>
          {priorityConfig.label}
        </span>
        <div className="flex items-center gap-2 text-gray-400">
          {product.estimatedHours && (
            <span className="flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              {product.estimatedHours}h
            </span>
          )}
          {product.targetLaunchDate && (
            <span className="flex items-center gap-0.5">
              <Calendar className="w-3 h-3" />
              {new Date(product.targetLaunchDate.toDate()).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
