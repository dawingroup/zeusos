/**
 * DesignOptionsList Component
 * List/grid view of design options with filtering and bulk actions
 */

import { useState } from 'react';
import {
  Plus,
  Filter,
  LayoutGrid,
  List,
  Loader2,
  Lightbulb,
} from 'lucide-react';
import { DesignOptionCard } from './DesignOptionCard';
import { DesignOptionCreator } from './DesignOptionCreator';
import { useDesignOptions } from '../../hooks/useDesignOptions';
import { useAuth } from '@/contexts/AuthContext';
import type { DesignOption, DesignOptionStatus, DesignOptionCategory, DesignOptionFormData } from '../../types/designOptions';

interface DesignOptionsListProps {
  projectId: string;
  designItemId?: string;
  designItemName?: string;
  showCreateButton?: boolean;
  compact?: boolean;
}

const STATUS_FILTERS: { value: DesignOptionStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'revision', label: 'Revision' },
];

const CATEGORY_FILTERS: { value: DesignOptionCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'material', label: 'Material' },
  { value: 'finish', label: 'Finish' },
  { value: 'style', label: 'Style' },
  { value: 'layout', label: 'Layout' },
  { value: 'feature', label: 'Feature' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'other', label: 'Other' },
];

export function DesignOptionsList({
  projectId,
  designItemId,
  designItemName,
  showCreateButton = true,
  compact = false,
}: DesignOptionsListProps) {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<DesignOptionStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<DesignOptionCategory | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<DesignOption | null>(null);

  const {
    options,
    loading,
    error,
    createOption,
    updateOption,
    submitForApproval,
    deleteOption: _deleteOption,
  } = useDesignOptions({
    projectId,
    designItemId,
    filters: {
      status: statusFilter !== 'all' ? statusFilter : undefined,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
    },
  });

  const handleCreateOption = async (data: DesignOptionFormData) => {
    if (!user?.uid) return;
    await createOption(data, user.uid);
  };

  const handleUpdateOption = async (data: DesignOptionFormData) => {
    if (!editingOption) return;
    await updateOption(editingOption.id, data);
    setEditingOption(null);
  };

  const handleSubmitOption = async (option: DesignOption) => {
    if (!user?.uid) return;
    if (!confirm(`Submit "${option.name}" for client approval?`)) return;
    await submitForApproval(option.id, user.uid);
  };

  const handleArchiveOption = async (option: DesignOption) => {
    if (!confirm(`Archive "${option.name}"?`)) return;
    await updateOption(option.id, { status: 'superseded' });
  };

  const handleSubmitWithApproval = async (data: DesignOptionFormData) => {
    if (!user?.uid) return;
    const option = await createOption(data, user.uid);
    await submitForApproval(option.id, user.uid);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-red-600">Failed to load design options</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-600" />
          <h3 className="font-semibold text-gray-900">Design Options</h3>
          {options.length > 0 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
              {options.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          {!compact && (
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 ${viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              >
                <LayoutGrid className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 ${viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              >
                <List className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          )}

          {/* Create button */}
          {showCreateButton && (
            <button
              onClick={() => setIsCreatorOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1d1d1f] text-white text-sm font-medium rounded-lg hover:bg-black transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Option
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      {!compact && options.length > 0 && (
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DesignOptionStatus | 'all')}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]"
          >
            {STATUS_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as DesignOptionCategory | 'all')}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]"
          >
            {CATEGORY_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Options Grid/List */}
      {options.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <Lightbulb className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <h3 className="font-medium text-gray-900">No design options yet</h3>
          <p className="text-sm text-gray-500 mt-1">
            Create options with inspirations for client approval
          </p>
          {showCreateButton && (
            <button
              onClick={() => setIsCreatorOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#1d1d1f] text-white rounded-lg text-sm font-medium hover:bg-black"
            >
              <Plus className="w-4 h-4" />
              Create First Option
            </button>
          )}
        </div>
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'space-y-3'
          }
        >
          {options.map((option) => (
            <DesignOptionCard
              key={option.id}
              option={option}
              onEdit={(opt) => setEditingOption(opt)}
              onSubmit={handleSubmitOption}
              onArchive={handleArchiveOption}
            />
          ))}
        </div>
      )}

      {/* Creator Dialog */}
      {(isCreatorOpen || editingOption) && (
        <DesignOptionCreator
          projectId={projectId}
          designItemId={designItemId}
          designItemName={designItemName}
          existingOption={editingOption || undefined}
          onSave={editingOption ? handleUpdateOption : handleCreateOption}
          onSubmit={editingOption ? undefined : handleSubmitWithApproval}
          onClose={() => {
            setIsCreatorOpen(false);
            setEditingOption(null);
          }}
        />
      )}
    </div>
  );
}

export default DesignOptionsList;
