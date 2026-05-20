/**
 * Feature Card Component
 * Displays a feature in grid or list view
 */

import { Clock, Wrench, Star, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FeatureLibraryItem } from '../../types/featureLibrary';
import { CATEGORY_LABELS, QUALITY_GRADE_LABELS } from '../../types/featureLibrary';

interface FeatureCardProps {
  feature: FeatureLibraryItem;
  viewMode: 'grid' | 'list';
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function FeatureCard({ feature, viewMode, onClick, onEdit, onDelete }: FeatureCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const gradeColors = {
    economy: 'bg-gray-100 text-gray-700',
    custom: 'bg-blue-100 text-blue-700',
    premium: 'bg-amber-100 text-amber-700',
  };

  const statusColors = {
    active: 'bg-green-100 text-green-700',
    'in-development': 'bg-yellow-100 text-yellow-700',
    deprecated: 'bg-red-100 text-red-700',
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onEdit();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onDelete();
  };

  if (viewMode === 'list') {
    return (
      <div
        onClick={onClick}
        className="bg-white rounded-lg border border-gray-200 p-4 hover:border-primary hover:shadow-sm transition-all cursor-pointer"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Code Badge */}
            <div className="flex-shrink-0 px-3 py-1.5 bg-gray-100 rounded-lg font-mono text-sm font-medium text-gray-700">
              {feature.code}
            </div>
            
            {/* Name & Category */}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 truncate">{feature.name}</h3>
              <p className="text-sm text-gray-500">{CATEGORY_LABELS[feature.category]}</p>
            </div>

            {/* Badges */}
            <div className="hidden sm:flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${gradeColors[feature.qualityGrade]}`}>
                {QUALITY_GRADE_LABELS[feature.qualityGrade]}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[feature.status]}`}>
                {feature.status}
              </span>
            </div>

            {/* Time Estimate */}
            <div className="hidden md:flex items-center gap-1 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>{feature.estimatedTime.typical}h</span>
            </div>

            {/* Usage Count */}
            <div className="hidden lg:flex items-center gap-1 text-sm text-gray-500">
              <Star className="w-4 h-4" />
              <span>{feature.usageCount} uses</span>
            </div>
          </div>

          {/* Menu */}
          <div className="relative">
            <button
              onClick={handleMenuClick}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                <button
                  onClick={handleEdit}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Grid View
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-4 hover:border-primary hover:shadow-md transition-all cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="px-2.5 py-1 bg-gray-100 rounded-lg font-mono text-xs font-medium text-gray-700">
          {feature.code}
        </div>
        <div className="relative">
          <button
            onClick={handleMenuClick}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              <button
                onClick={handleEdit}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Name */}
      <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{feature.name}</h3>
      
      {/* Category */}
      <p className="text-sm text-gray-500 mb-3">{CATEGORY_LABELS[feature.category]}</p>

      {/* Description */}
      {feature.description && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{feature.description}</p>
      )}

      {/* Tags */}
      {feature.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {feature.tags.slice(0, 3).map((tag, i) => (
            <span key={i} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
              {tag}
            </span>
          ))}
          {feature.tags.length > 3 && (
            <span className="px-2 py-0.5 text-xs text-gray-400">
              +{feature.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${gradeColors[feature.qualityGrade]}`}>
            {QUALITY_GRADE_LABELS[feature.qualityGrade]}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {feature.estimatedTime.typical}h
          </span>
          <span className="flex items-center gap-1">
            <Wrench className="w-3.5 h-3.5" />
            {feature.requiredEquipment.length}
          </span>
        </div>
      </div>
    </div>
  );
}
