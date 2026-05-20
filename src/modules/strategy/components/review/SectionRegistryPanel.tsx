// ============================================================================
// SECTION REGISTRY PANEL - Strategy Plan Update Tool
// Lists all document sections with scores, type badges, status, and actions
// ============================================================================

import { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Building,
  Shield,
  Users,
  FileText,
  Target,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Wand2,
  CheckCircle,
  XCircle,
  Eye,
} from 'lucide-react';
import type { DocumentSection, SectionType } from '../../types/documentSection.types';
import { ALIGNMENT_SCORE_LABELS } from '../../constants/sectionMapping.constants';

// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------

interface SectionRegistryPanelProps {
  sections: DocumentSection[];
  isLoading: boolean;
  selectedSectionId?: string;
  onSectionSelect: (sectionId: string) => void;
  onAssessSection: (sectionId: string) => void;
  onRewriteSection: (sectionId: string) => void;
  onApproveRewrite: (sectionId: string) => void;
  onRejectRewrite: (sectionId: string) => void;
  onRunFullAssessment: () => void;
  isAssessing?: boolean;
  isRunningCycle?: boolean;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const SECTION_TYPE_ICONS: Record<SectionType, typeof BarChart3> = {
  financial: BarChart3,
  market: TrendingUp,
  operations: Building,
  growth: TrendingUp,
  risk: Shield,
  people: Users,
  governance: FileText,
  general: Target,
};

const SECTION_TYPE_COLORS: Record<SectionType, string> = {
  financial: 'bg-blue-100 text-blue-700',
  market: 'bg-purple-100 text-purple-700',
  operations: 'bg-amber-100 text-amber-700',
  growth: 'bg-green-100 text-green-700',
  risk: 'bg-red-100 text-red-700',
  people: 'bg-pink-100 text-pink-700',
  governance: 'bg-slate-100 text-slate-700',
  general: 'bg-gray-100 text-gray-700',
};

const SCORE_COLORS: Record<number, string> = {
  5: 'bg-green-100 text-green-800 border-green-300',
  4: 'bg-lime-100 text-lime-800 border-lime-300',
  3: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  2: 'bg-orange-100 text-orange-800 border-orange-300',
  1: 'bg-red-100 text-red-800 border-red-300',
};

const REWRITE_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  none: { label: 'No Changes', className: 'bg-gray-100 text-gray-600' },
  pending_review: { label: 'Pending Review', className: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  applied: { label: 'Applied', className: 'bg-blue-100 text-blue-700' },
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SectionRegistryPanel({
  sections,
  isLoading,
  selectedSectionId,
  onSectionSelect,
  onAssessSection,
  onRewriteSection,
  onApproveRewrite,
  onRejectRewrite,
  onRunFullAssessment,
  isAssessing,
  isRunningCycle,
}: SectionRegistryPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading sections...
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No sections parsed yet.</p>
        <p className="text-xs mt-1">Upload a strategy document to get started.</p>
      </div>
    );
  }

  const avgScore = sections.filter((s) => s.alignmentScore).length > 0
    ? Math.round(
        sections
          .filter((s) => s.alignmentScore)
          .reduce((sum, s) => sum + (s.alignmentScore || 0), 0) /
          sections.filter((s) => s.alignmentScore).length * 10
      ) / 10
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Document Sections ({sections.length})
          </h3>
          {avgScore !== null && (
            <p className="text-xs text-gray-500 mt-0.5">
              Avg. alignment: {avgScore}/5
            </p>
          )}
        </div>
        <button
          onClick={onRunFullAssessment}
          disabled={isRunningCycle}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunningCycle ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {isRunningCycle ? 'Assessing...' : 'Assess All'}
        </button>
      </div>

      {/* Section List */}
      <div className="flex-1 overflow-y-auto">
        {sections.map((section) => {
          const Icon = SECTION_TYPE_ICONS[section.sectionType];
          const typeColor = SECTION_TYPE_COLORS[section.sectionType];
          const scoreColor = section.alignmentScore
            ? SCORE_COLORS[section.alignmentScore]
            : 'bg-gray-100 text-gray-500 border-gray-200';
          const isSelected = section.id === selectedSectionId;
          const isExpanded = section.id === expandedId;
          const statusConfig = REWRITE_STATUS_CONFIG[section.rewriteStatus] || REWRITE_STATUS_CONFIG.none;

          return (
            <div
              key={section.id}
              className={`border-b transition-colors ${
                isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'
              }`}
            >
              {/* Section Row */}
              <div
                className="flex items-center gap-2 p-3 cursor-pointer"
                onClick={() => onSectionSelect(section.id)}
              >
                <div className={`flex-shrink-0 p-1 rounded ${typeColor}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {section.headingText}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${typeColor}`}>
                      {section.sectionType}
                    </span>
                    {section.rewriteStatus !== 'none' && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusConfig.className}`}>
                        {statusConfig.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Score Badge */}
                <div className={`flex-shrink-0 px-2 py-0.5 rounded border text-xs font-medium ${scoreColor}`}>
                  {section.alignmentScore
                    ? `${section.alignmentScore}/5`
                    : '—'}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedId(isExpanded ? null : section.id);
                  }}
                  className="flex-shrink-0 p-1 rounded hover:bg-gray-200"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                  )}
                </button>
              </div>

              {/* Expanded Actions */}
              {isExpanded && (
                <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                  {section.alignmentScore && (
                    <span className="text-xs text-gray-500">
                      {ALIGNMENT_SCORE_LABELS[section.alignmentScore]?.label || ''}
                    </span>
                  )}
                  <div className="w-full flex gap-1.5 mt-1">
                    <button
                      onClick={() => onAssessSection(section.id)}
                      disabled={isAssessing}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                    >
                      <Eye className="h-3 w-3" /> Assess
                    </button>
                    <button
                      onClick={() => onRewriteSection(section.id)}
                      disabled={isAssessing}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                    >
                      <Wand2 className="h-3 w-3" /> Rewrite
                    </button>
                    {section.rewriteStatus === 'pending_review' && (
                      <>
                        <button
                          onClick={() => onApproveRewrite(section.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100"
                        >
                          <CheckCircle className="h-3 w-3" /> Approve
                        </button>
                        <button
                          onClick={() => onRejectRewrite(section.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-50 text-red-700 hover:bg-red-100"
                        >
                          <XCircle className="h-3 w-3" /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
