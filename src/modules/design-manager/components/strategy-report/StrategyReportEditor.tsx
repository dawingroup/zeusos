/**
 * Strategy Report Editor
 * Main editing interface for persisted strategy reports
 * Provides real-time editing with auto-save and version tracking
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit3,
  Eye,
  Share2,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/shared/hooks';
import { useStrategyReport, useLastSavedText } from '../../hooks/useStrategyReport';
import type { Trend, Recommendation, MaterialPalette } from '@/modules/strategy/types';

export function StrategyReportEditor() {
  const { projectId, reportId } = useParams<{ projectId: string; reportId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.uid || '';

  // Load report with real-time sync
  const {
    report,
    isLoading,
    isSaving,
    saveStatus,
    lastSaved,
    error,
    updateReport,
    clearError: _clearError,
  } = useStrategyReport(reportId!, userId);

  const lastSavedText = useLastSavedText(lastSaved);

  // UI state
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('edit');
  const [_editingSection, _setEditingSection] = useState<string | null>(null);

  // Local edit state
  const [localTitle, setLocalTitle] = useState('');
  const [localExecutiveSummary, setLocalExecutiveSummary] = useState('');

  // Initialize local state when report loads
  useEffect(() => {
    if (report) {
      setLocalTitle(report.reportTitle);
      setLocalExecutiveSummary(report.executiveSummary);
    }
  }, [report]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading strategy report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Report Not Found</h2>
          <p className="text-gray-600 mb-6">
            {error || 'The strategy report you are looking for could not be loaded.'}
          </p>
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Back to Project
          </button>
        </div>
      </div>
    );
  }

  const handleTitleChange = (newTitle: string) => {
    setLocalTitle(newTitle);
    updateReport({
      reportTitle: newTitle,
      manualEdits: [...(report.manualEdits || []), 'reportTitle'],
      lastEditedSection: 'header',
    });
  };

  const handleExecutiveSummaryChange = (newSummary: string) => {
    setLocalExecutiveSummary(newSummary);
    updateReport({
      executiveSummary: newSummary,
      manualEdits: [...(report.manualEdits || []), 'executiveSummary'],
      lastEditedSection: 'executive-summary',
    });
  };

  // Save status indicator
  const SaveStatusIndicator = () => {
    if (saveStatus === 'saving' || isSaving) {
      return (
        <div className="flex items-center gap-2 text-blue-600">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
          <span className="text-sm">Saving...</span>
        </div>
      );
    }

    if (saveStatus === 'saved') {
      return (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm">{lastSavedText || 'Saved'}</span>
        </div>
      );
    }

    if (saveStatus === 'error') {
      return (
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm">Failed to save</span>
        </div>
      );
    }

    return null;
  };

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            {/* Left: Back button */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/projects/${projectId}`)}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Project
              </button>

              {/* Status badge */}
              <div className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                {report.status}
              </div>
            </div>

            {/* Center: Save status */}
            <div className="flex-1 flex justify-center">
              <SaveStatusIndicator />
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {/* View mode toggle */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('preview')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded ${
                    viewMode === 'preview'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button
                  onClick={() => setViewMode('edit')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded ${
                    viewMode === 'edit'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  Edit
                </button>
              </div>

              {/* Share button */}
              <button
                onClick={() => alert('Share functionality coming soon!')}
                className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-600 rounded-lg hover:bg-green-50"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-6">
        {/* Report Title */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          {viewMode === 'edit' ? (
            <input
              type="text"
              value={localTitle || report.reportTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full text-3xl font-bold text-gray-900 border-0 border-b-2 border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none px-0 py-2"
              placeholder="Report Title"
            />
          ) : (
            <h1 className="text-3xl font-bold text-gray-900">{report.reportTitle}</h1>
          )}

          {/* Metadata */}
          <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Version {report.version}
            </div>
            <div>•</div>
            <div>
              Created {report.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
            </div>
            {report.lastEditedAt && (
              <>
                <div>•</div>
                <div>
                  Last edited {report.lastEditedAt?.toDate?.()?.toLocaleDateString() || ''}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Executive Summary */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Executive Summary</h2>
          {viewMode === 'edit' ? (
            <textarea
              value={localExecutiveSummary || report.executiveSummary}
              onChange={(e) => handleExecutiveSummaryChange(e.target.value)}
              className="w-full min-h-[150px] p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter executive summary..."
            />
          ) : (
            <p className="text-gray-700 leading-relaxed">{report.executiveSummary}</p>
          )}
        </section>

        {/* Key Trends */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Key Design Trends
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({report.trends?.length || 0} trends)
            </span>
          </h2>
          <div className="space-y-4">
            {report.trends?.map((trend: Trend, index: number) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{trend.name}</h3>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                    Relevance: {Math.round(trend.relevanceScore * 100)}%
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{trend.description}</p>
                {trend.source && (
                  <p className="text-xs text-gray-400">Source: {trend.source}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Strategic Recommendations */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Strategic Recommendations
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({report.recommendations?.length || 0} recommendations)
            </span>
          </h2>
          <div className="space-y-4">
            {report.recommendations?.map((rec: Recommendation, index: number) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{rec.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      rec.priority === 'high'
                        ? 'bg-red-100 text-red-700'
                        : rec.priority === 'medium'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {rec.priority}
                    </span>
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                      {rec.complexity}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                <div className="text-xs text-gray-500">
                  Estimated: {rec.estimatedDays} days
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Material Palette */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recommended Materials</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.materialPalette?.map((material: MaterialPalette, index: number) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-1">{material.material}</h3>
                <p className="text-sm text-gray-600 mb-1">Application: {material.application}</p>
                <p className="text-sm text-gray-600">Finish: {material.finish}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Color Scheme */}
        {report.colorScheme && (
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Color Palette</h2>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <div
                  className="h-20 rounded-lg border-2 border-gray-300"
                  style={{ backgroundColor: report.colorScheme.primary }}
                />
                <p className="text-sm text-gray-600 mt-2">Primary: {report.colorScheme.primary}</p>
              </div>
              <div className="flex-1">
                <div
                  className="h-20 rounded-lg border-2 border-gray-300"
                  style={{ backgroundColor: report.colorScheme.secondary }}
                />
                <p className="text-sm text-gray-600 mt-2">Secondary: {report.colorScheme.secondary}</p>
              </div>
              <div className="flex-1">
                <div
                  className="h-20 rounded-lg border-2 border-gray-300"
                  style={{ backgroundColor: report.colorScheme.accent }}
                />
                <p className="text-sm text-gray-600 mt-2">Accent: {report.colorScheme.accent}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">{report.colorScheme.description}</p>
          </section>
        )}

        {/* Next Steps */}
        {report.nextSteps && report.nextSteps.length > 0 && (
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recommended Next Steps</h2>
            <ol className="list-decimal list-inside space-y-2">
              {report.nextSteps.map((step: string, index: number) => (
                <li key={index} className="text-gray-700">{step}</li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
