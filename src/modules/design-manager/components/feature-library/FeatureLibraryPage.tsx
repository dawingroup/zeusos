/**
 * Feature Library Page
 * Main page for browsing and managing manufacturing features
 */

import { useState } from 'react';
import { Search, Plus, Grid, List, Filter, X } from 'lucide-react';
import { useFeatureLibrary } from '../../hooks/useFeatureLibrary';
import { FeatureCard } from './FeatureCard';
import { FeatureForm } from './FeatureForm';
import { FeatureDetailModal } from './FeatureDetailModal';
import { FeatureCacheStatus } from './FeatureCacheStatus';
import type { FeatureLibraryItem, FeatureCategory, FeatureFormData } from '../../types/featureLibrary';
import { CATEGORY_LABELS, QUALITY_GRADE_LABELS, STATUS_LABELS } from '../../types/featureLibrary';

export function FeatureLibraryPage() {
  const {
    features,
    isLoading,
    error,
    searchQuery,
    filters,
    setSearchQuery,
    setFilters,
    createFeature,
    updateFeature,
    deleteFeature,
    categoryCounts,
  } = useFeatureLibrary();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<FeatureLibraryItem | null>(null);
  const [editingFeature, setEditingFeature] = useState<FeatureLibraryItem | null>(null);

  const handleCreateFeature = async (data: FeatureFormData) => {
    await createFeature(data);
    setShowCreateForm(false);
  };

  const handleUpdateFeature = async (data: FeatureFormData) => {
    if (editingFeature) {
      await updateFeature(editingFeature.id, data);
      setEditingFeature(null);
    }
  };

  const handleDeleteFeature = async (id: string) => {
    if (confirm('Are you sure you want to delete this feature?')) {
      await deleteFeature(id);
      setSelectedFeature(null);
    }
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
  };

  const hasActiveFilters = filters.category || filters.qualityGrade || filters.status || searchQuery;

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-14 z-40">
        <div className="px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Feature Library</h1>
              <p className="text-sm text-gray-500 mt-1">
                {features.length} manufacturing capabilities
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search features..."
                  className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg border transition-colors ${
                  showFilters || hasActiveFilters
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Filter className="w-5 h-5" />
              </button>

              {/* View Toggle */}
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'}`}
                >
                  <Grid className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'}`}
                >
                  <List className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Add Button */}
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Add Feature</span>
              </button>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex flex-wrap items-center gap-4">
                {/* Category Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                  <select
                    value={filters.category || ''}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value as FeatureCategory || undefined })}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">All Categories</option>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label} ({categoryCounts[value as FeatureCategory] || 0})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quality Grade Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Quality Grade</label>
                  <select
                    value={filters.qualityGrade || ''}
                    onChange={(e) => setFilters({ ...filters, qualityGrade: e.target.value as any || undefined })}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">All Grades</option>
                    {Object.entries(QUALITY_GRADE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select
                    value={filters.status || ''}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value as any || undefined })}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">All Statuses</option>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg mt-5"
                  >
                    <X className="w-4 h-4" />
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="pt-4">
        {/* AI Cache Status - Admin Panel */}
        <div className="mb-6">
          <FeatureCacheStatus />
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500">{error}</p>
          </div>
        ) : features.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No features found</h3>
            <p className="text-gray-500 mb-4">
              {hasActiveFilters 
                ? 'Try adjusting your search or filters'
                : 'Get started by adding your first manufacturing feature'}
            </p>
            {!hasActiveFilters && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                <Plus className="w-5 h-5" />
                Add Feature
              </button>
            )}
          </div>
        ) : (
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'space-y-3'
          }>
            {features.map((feature) => (
              <FeatureCard
                key={feature.id}
                feature={feature}
                viewMode={viewMode}
                onClick={() => setSelectedFeature(feature)}
                onEdit={() => setEditingFeature(feature)}
                onDelete={() => handleDeleteFeature(feature.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <FeatureForm
          onSubmit={handleCreateFeature}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Edit Form Modal */}
      {editingFeature && (
        <FeatureForm
          feature={editingFeature}
          onSubmit={handleUpdateFeature}
          onCancel={() => setEditingFeature(null)}
        />
      )}

      {/* Detail Modal */}
      {selectedFeature && !editingFeature && (
        <FeatureDetailModal
          feature={selectedFeature}
          onClose={() => setSelectedFeature(null)}
          onEdit={() => {
            setEditingFeature(selectedFeature);
            setSelectedFeature(null);
          }}
          onDelete={() => handleDeleteFeature(selectedFeature.id)}
        />
      )}
    </div>
  );
}

export default FeatureLibraryPage;
