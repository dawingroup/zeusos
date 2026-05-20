/**
 * BOQ Import Review Page
 * Review and approve AI-parsed BOQ items before import
 */

import React, { useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Filter,
  Search,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { ParsedItemCard } from '../components/import/ParsedItemCard';
import { BulkActionsBar } from '../components/import/BulkActionsBar';
import { ReviewSummary } from '../components/import/ReviewSummary';
import { useBOQReview } from '../hooks/useBOQReview';
import { useProject } from '../hooks/useProjects';
import {
  type ReviewStatus,
  type ConfidenceLevel,
  CONFIDENCE_CONFIG,
} from '../utils/reviewHelpers';

const BOQImportReview: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  
  // Get parsed items from navigation state (from parsing job)
  const parsedItems = location.state?.parsedItems || [];
  const fileName = location.state?.fileName || 'Imported file';
  
  const { project, isLoading: loadingProject } = useProject(projectId!);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus[]>([]);
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceLevel[]>([]);

  const {
    items,
    stats,
    selectedItems,
    selectedIds,
    isAllSelected,
    toggleSelect,
    selectAll,
    deselectAll,
    setFilters,
    updateItem,
    approveItem,
    rejectItem,
    bulkApprove,
    bulkReject,
    bulkAssignFormula,
    bulkSetStage,
    bulkDelete,
    importApprovedItems,
    isImporting,
  } = useBOQReview({
    projectId: projectId!,
    parsedItems,
    onImportComplete: (count) => {
      navigate(`/advisory/matflow/projects/${projectId}/boq`, {
        state: { importedCount: count },
      });
    },
  });

  // Update filters
  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
    setFilters((prev) => ({ ...prev, searchTerm: term }));
  }, [setFilters]);

  const handleStatusFilterChange = useCallback((status: ReviewStatus) => {
    setStatusFilter((prev) => {
      const next = prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status];
      setFilters((f) => ({ ...f, status: next.length > 0 ? next : undefined }));
      return next;
    });
  }, [setFilters]);

  const handleConfidenceFilterChange = useCallback((level: ConfidenceLevel) => {
    setConfidenceFilter((prev) => {
      const next = prev.includes(level)
        ? prev.filter((l) => l !== level)
        : [...prev, level];
      setFilters((f) => ({ ...f, confidenceLevel: next.length > 0 ? next : undefined }));
      return next;
    });
  }, [setFilters]);

  const handleCancel = useCallback(() => {
    if (window.confirm('Are you sure you want to cancel? All review progress will be lost.')) {
      navigate(`/advisory/matflow/projects/${projectId}/boq`);
    }
  }, [navigate, projectId]);

  if (loadingProject) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Project not found</h2>
        <button
          onClick={() => navigate('/advisory/matflow/projects')}
          className="text-amber-600 hover:text-amber-700"
        >
          Return to projects
        </button>
      </div>
    );
  }

  if (parsedItems.length === 0) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No items to review</h2>
        <p className="text-gray-500 mb-4">
          No parsed BOQ items were found. Please try importing a file again.
        </p>
        <button
          onClick={() => navigate(`/advisory/matflow/projects/${projectId}/boq`)}
          className="text-amber-600 hover:text-amber-700"
        >
          Go back to BOQ
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Review Imported BOQ"
        description={`Reviewing ${stats.total} items from ${fileName}`}
        breadcrumbs={[
          { label: 'Projects', href: '/advisory/matflow/projects' },
          { label: project.name, href: `/advisory/matflow/projects/${projectId}` },
          { label: 'Import Review' },
        ]}
        actions={
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={18} />
            Cancel Import
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search and filters */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by item code or description..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`
                flex items-center gap-2 px-4 py-2 border rounded-lg
                ${showFilters
                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }
              `}
            >
              <Filter size={18} />
              Filters
              {(statusFilter.length > 0 || confidenceFilter.length > 0) && (
                <span className="w-5 h-5 bg-amber-600 text-white text-xs rounded-full flex items-center justify-center">
                  {statusFilter.length + confidenceFilter.length}
                </span>
              )}
            </button>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['pending', 'approved', 'rejected', 'modified'] as ReviewStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusFilterChange(status)}
                      className={`
                        px-3 py-1 rounded-full text-sm capitalize
                        ${statusFilter.includes(status)
                          ? 'bg-amber-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
                        }
                      `}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI Confidence
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['high', 'medium', 'low', 'very_low'] as ConfidenceLevel[]).map((level) => (
                    <button
                      key={level}
                      onClick={() => handleConfidenceFilterChange(level)}
                      className={`
                        px-3 py-1 rounded-full text-sm
                        ${confidenceFilter.includes(level)
                          ? `${CONFIDENCE_CONFIG[level].bgColor} ${CONFIDENCE_CONFIG[level].color}` 
                          : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
                        }
                      `}
                    >
                      {CONFIDENCE_CONFIG[level].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Bulk actions */}
          <BulkActionsBar
            selectedItems={selectedItems}
            totalItems={items.length}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            onBulkApprove={bulkApprove}
            onBulkReject={bulkReject}
            onBulkAssignFormula={bulkAssignFormula}
            onBulkSetStage={bulkSetStage}
            onBulkDelete={bulkDelete}
            isAllSelected={isAllSelected}
          />

          {/* Items list */}
          <div className="space-y-3">
            {items.map((item) => (
              <ParsedItemCard
                key={item.reviewId}
                item={item}
                onUpdateItem={updateItem}
                onApprove={approveItem}
                onReject={rejectItem}
                isSelected={selectedIds.has(item.reviewId)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>

          {items.length === 0 && (
            <div className="p-8 text-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">No items match your filters</p>
            </div>
          )}
        </div>

        {/* Sidebar - Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <ReviewSummary
              stats={stats}
              projectName={project.name}
              fileName={fileName}
              onProceedImport={importApprovedItems}
              onCancel={handleCancel}
              isImporting={isImporting}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BOQImportReview;
