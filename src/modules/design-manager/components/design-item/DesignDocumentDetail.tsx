/**
 * Design Document Detail
 * Dedicated detail view for design documents (drawings, specs, schedules)
 * Previously known as architectural items
 */

import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, DollarSign, FolderOpen, History,
  Trash2, CheckCircle, Info
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { ResponsiveTabs } from '@/shared/components/ui/ResponsiveTabs';
import { useDesignItem, useProject } from '../../hooks';
import { StageBadge } from './StageBadge';
import { CATEGORY_LABELS, formatDateTime, STAGE_LABELS } from '../../utils/formatting';
import { getNextStageForItem, ARCHITECTURAL_STAGE_ORDER } from '../../utils/stage-gate';
import { StageGateCheck } from '../stage-gate/StageGateCheck';
import { DesignDocumentPricingTab } from './DesignDocumentPricingTab';
import {
  transitionStage,
  deleteDesignItem,
  updateDesignItem,
} from '../../services/firestore';
import { useAuth } from '@/contexts/AuthContext';
import type { ArchitecturalPricing } from '../../types';
import { DISCIPLINE_LABELS } from '../../types';

type Tab = 'overview' | 'document-info' | 'pricing' | 'files' | 'history';

export default function DesignDocumentDetail() {
  const { projectId, itemId } = useParams<{ projectId: string; itemId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { project } = useProject(projectId);
  const { item, loading } = useDesignItem(projectId, itemId);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showGateCheck, setShowGateCheck] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-gray-900">Document not found</h2>
        <Link to={`/design/project/${projectId}`} className="text-indigo-600 hover:underline mt-2 inline-block">
          Return to project
        </Link>
      </div>
    );
  }

  const nextStage = getNextStageForItem(item);

  const handleAdvance = async (
    _advItem: typeof item,
    targetStage: typeof item.currentStage,
    overrideNote?: string
  ) => {
    try {
      await transitionStage(
        projectId!,
        itemId!,
        targetStage,
        user?.email || '',
        overrideNote || ''
      );
    } catch (err) {
      console.error('Failed to transition stage:', err);
    }
    setShowGateCheck(false);
  };

  const handleDelete = async () => {
    if (!projectId || !itemId) return;
    setDeleting(true);
    try {
      await deleteDesignItem(projectId, itemId);
      navigate(`/design/project/${projectId}`);
    } catch (err) {
      console.error('Failed to delete item:', err);
      setDeleting(false);
    }
  };

  const handleUpdatePricing = async (updates: Partial<ArchitecturalPricing>) => {
    if (!projectId || !itemId) return;
    await updateDesignItem(projectId, itemId, {
      architectural: {
        ...item.architectural,
        ...updates,
      } as ArchitecturalPricing,
    }, user?.uid || user?.email || '');
  };

  const tabs = [
    { id: 'overview' as Tab, label: 'Overview', icon: FileText },
    { id: 'document-info' as Tab, label: 'Document Info', icon: Info },
    { id: 'pricing' as Tab, label: 'Pricing', icon: DollarSign },
    { id: 'files' as Tab, label: 'Files', icon: FolderOpen },
    { id: 'history' as Tab, label: 'History', icon: History },
  ];

  // Get current stage index for progress display
  const currentStageIndex = ARCHITECTURAL_STAGE_ORDER.indexOf(item.currentStage);
  const pricing = item.architectural;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <Link
            to={`/design/project/${projectId}`}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{item.name}</h1>
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-medium">
                DESIGN DOCUMENT
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 mt-1 flex-wrap">
              <span className="text-sm text-gray-600 hidden sm:inline">
                {project?.name || 'Unknown Project'}
              </span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded hidden sm:inline">
                {item.itemCode}
              </span>
              {pricing?.discipline && (
                <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">
                  {DISCIPLINE_LABELS[pricing.discipline]}
                </span>
              )}
            </div>
          </div>

          {/* Desktop actions */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <StageBadge stage={item.currentStage} size="sm" />

            {nextStage && (
              <button
                onClick={() => setShowGateCheck(true)}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
              >
                Advance
              </button>
            )}

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
              title="Delete Document"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile action bar */}
        <div className="flex sm:hidden items-center justify-between gap-2 px-1">
          <StageBadge stage={item.currentStage} size="sm" />

          <div className="flex items-center gap-1">
            {nextStage && (
              <button
                onClick={() => setShowGateCheck(true)}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium"
              >
                Advance
              </button>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Document Progress */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Document Progress</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {ARCHITECTURAL_STAGE_ORDER.map((stage, index) => {
            const isComplete = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;
            return (
              <div key={stage} className="flex items-center flex-1 min-w-[100px]">
                <div className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium flex-shrink-0',
                  isComplete && 'bg-green-500 text-white',
                  isCurrent && 'bg-indigo-600 text-white',
                  !isComplete && !isCurrent && 'bg-gray-200 text-gray-500'
                )}>
                  {isComplete ? <CheckCircle className="w-4 h-4" /> : index + 1}
                </div>
                <div className="ml-2 flex-1 min-w-0">
                  <p className={cn(
                    'text-xs font-medium truncate',
                    isCurrent ? 'text-indigo-600' : 'text-gray-500'
                  )}>
                    {STAGE_LABELS[stage]}
                  </p>
                </div>
                {index < ARCHITECTURAL_STAGE_ORDER.length - 1 && (
                  <div className={cn(
                    'w-8 h-0.5 mx-2 flex-shrink-0',
                    isComplete ? 'bg-green-500' : 'bg-gray-200'
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <ResponsiveTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as Tab)}
      />

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200">
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6">
            {/* Document Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
                <p className="text-gray-900">{item.description || 'No description provided'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Category</h3>
                <p className="text-gray-900">{CATEGORY_LABELS[item.category]}</p>
              </div>
            </div>

            {/* Document Details */}
            {pricing && (
              <div className="border-t pt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-4">Document Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {pricing.drawingNumber && (
                    <div>
                      <p className="text-xs text-gray-500">Drawing Number</p>
                      <p className="text-sm font-medium">{pricing.drawingNumber}</p>
                    </div>
                  )}
                  {pricing.scale && (
                    <div>
                      <p className="text-xs text-gray-500">Scale</p>
                      <p className="text-sm font-medium">{pricing.scale}</p>
                    </div>
                  )}
                  {pricing.sheetSize && (
                    <div>
                      <p className="text-xs text-gray-500">Sheet Size</p>
                      <p className="text-sm font-medium">{pricing.sheetSize}</p>
                    </div>
                  )}
                  {pricing.discipline && (
                    <div>
                      <p className="text-xs text-gray-500">Discipline</p>
                      <p className="text-sm font-medium">{DISCIPLINE_LABELS[pricing.discipline]}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cost Summary */}
            {pricing && (
              <div className="border-t pt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-4">Cost Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Total Hours</p>
                    <p className="text-lg font-semibold">{pricing.totalHours || 0}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Labor Cost</p>
                    <p className="text-lg font-semibold">
                      {pricing.currency} {(pricing.totalLaborCost || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Pass-Through Costs</p>
                    <p className="text-lg font-semibold">
                      {pricing.currency} {(((pricing.totalCost || 0) - (pricing.totalLaborCost || 0)) > 0 ? ((pricing.totalCost || 0) - (pricing.totalLaborCost || 0)).toLocaleString() : '0')}
                    </p>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-3">
                    <p className="text-xs text-indigo-600">Total Fee</p>
                    <p className="text-lg font-semibold text-indigo-700">
                      {pricing.currency} {(pricing.totalCost || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="border-t pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Created</p>
                  <p className="text-gray-700">{formatDateTime(item.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Updated</p>
                  <p className="text-gray-700">{formatDateTime(item.updatedAt)}</p>
                </div>
                {pricing?.revisionCount !== undefined && pricing.revisionCount > 0 && (
                  <div>
                    <p className="text-xs text-gray-500">Revision</p>
                    <p className="text-gray-700">Rev {pricing.revisionCount}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'document-info' && (
          <div className="p-6 space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Document Information</h3>
            <p className="text-sm text-gray-500">
              Edit document details like drawing number, scale, and sheet size.
            </p>

            {pricing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Drawing Number
                    </label>
                    <input
                      type="text"
                      value={pricing.drawingNumber || ''}
                      onChange={(e) => handleUpdatePricing({ drawingNumber: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="e.g., A-101"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Scale
                    </label>
                    <input
                      type="text"
                      value={pricing.scale || ''}
                      onChange={(e) => handleUpdatePricing({ scale: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="e.g., 1:100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sheet Size
                    </label>
                    <select
                      value={pricing.sheetSize || ''}
                      onChange={(e) => handleUpdatePricing({ sheetSize: e.target.value as any })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select size</option>
                      <option value="A0">A0 (841 x 1189 mm)</option>
                      <option value="A1">A1 (594 x 841 mm)</option>
                      <option value="A2">A2 (420 x 594 mm)</option>
                      <option value="A3">A3 (297 x 420 mm)</option>
                      <option value="A4">A4 (210 x 297 mm)</option>
                      <option value="ARCH-D">ARCH D (24 x 36 in)</option>
                      <option value="ARCH-E">ARCH E (36 x 48 in)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Discipline
                    </label>
                    <select
                      value={pricing.discipline || ''}
                      onChange={(e) => handleUpdatePricing({ discipline: e.target.value as any })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {Object.entries(DISCIPLINE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Document pricing data not initialized.</p>
            )}
          </div>
        )}

        {activeTab === 'pricing' && (
          <DesignDocumentPricingTab
            item={item}
            projectId={projectId!}
            userId={user?.uid || ''}
            onUpdate={handleUpdatePricing}
          />
        )}

        {activeTab === 'files' && (
          <div className="p-6">
            <div className="text-center py-8 text-gray-500">
              <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">File management coming soon</p>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Stage History</h3>
            {item.stageHistory && item.stageHistory.length > 0 ? (
              <div className="space-y-3">
                {item.stageHistory.map((transition, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <History className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {STAGE_LABELS[transition.fromStage]} &rarr; {STAGE_LABELS[transition.toStage]}
                      </p>
                      <p className="text-xs text-gray-500">
                        {transition.transitionedBy} &middot; {formatDateTime(transition.transitionedAt)}
                      </p>
                      {transition.notes && (
                        <p className="text-sm text-gray-600 mt-1">{transition.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No stage transitions yet.</p>
            )}
          </div>
        )}
      </div>

      {/* Stage Gate Check Modal */}
      {showGateCheck && nextStage && (
        <StageGateCheck
          item={item}
          targetStage={nextStage}
          onAdvance={(advItem, stage, note) => handleAdvance(advItem, stage, note)}
          onCancel={() => setShowGateCheck(false)}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Document?</h3>
            <p className="text-gray-600 mb-6">
              This will permanently delete "{item.name}" and all associated files. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
