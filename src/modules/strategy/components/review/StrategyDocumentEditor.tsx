// ============================================================================
// STRATEGY DOCUMENT EDITOR
// DawinOS v2.0 - CEO Strategy Command
// Inline document editor with AI annotations in the margin
// ============================================================================

import React, { useState, useCallback } from 'react';
import {
  FileText,
  Download,
  Wand2,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  Loader2,
  ExternalLink,
  Lightbulb,
  CheckCircle2,
  Star,
} from 'lucide-react';
import {
  createStrategyGoogleDoc,
  openGoogleDoc,
} from '../../services/strategyGoogleDocs.service';
import type { StrategyDocBranding } from '../../services/strategyGoogleDocs.service';
import type { StrategyReviewData, SectionReview } from '../../types/strategy.types';
import {
  REVIEW_SECTION_ORDER,
  REVIEW_SECTION_LABELS,
  type ReviewSectionKey,
} from '../../constants/strategyReview.constants';

interface StrategyDocumentEditorProps {
  reviewData: StrategyReviewData;
  onSectionChange: (sectionKey: ReviewSectionKey, review: SectionReview) => void;
  onGoogleDocCreated?: (docId: string, docUrl: string) => void;
  readOnly?: boolean;
  sectionSidebar?: React.ReactNode;
  showSectionSidebar?: boolean;
  docBranding?: StrategyDocBranding;
}

export const StrategyDocumentEditor: React.FC<StrategyDocumentEditorProps> = ({
  reviewData,
  onSectionChange,
  onGoogleDocCreated,
  readOnly = false,
  sectionSidebar,
  showSectionSidebar = false,
  docBranding,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(REVIEW_SECTION_ORDER)
  );
  const [openAnnotations, setOpenAnnotations] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isCreatingGoogleDoc, setIsCreatingGoogleDoc] = useState(false);
  const [googleDocError, setGoogleDocError] = useState<string | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);

  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  };

  const toggleAnnotation = (sectionKey: string) => {
    setOpenAnnotations(prev => {
      const next = new Set(prev);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  };

  const expandAll = () => setExpandedSections(new Set(REVIEW_SECTION_ORDER));
  const collapseAll = () => setExpandedSections(new Set());

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Accept AI suggestion: merge AI updatedContent into the document's currentContent
  const handleAcceptAnnotation = (sectionKey: ReviewSectionKey) => {
    const review = reviewData.sectionReviews[sectionKey as keyof typeof reviewData.sectionReviews];
    if (!review || !review.updatedContent) return;

    onSectionChange(sectionKey, {
      ...review,
      currentContent: review.updatedContent,
      status: 'approved',
    });
    // Close the annotation card
    setOpenAnnotations(prev => {
      const next = new Set(prev);
      next.delete(sectionKey);
      return next;
    });
  };

  // Google Docs handler
  const handleOpenInGoogleDocs = useCallback(async () => {
    if (reviewData.googleDocUrl) {
      openGoogleDoc(reviewData.googleDocUrl);
      return;
    }
    setIsCreatingGoogleDoc(true);
    setGoogleDocError(null);
    try {
      const result = await createStrategyGoogleDoc(reviewData, docBranding);
      if (result.success && result.docId && result.docUrl) {
        onGoogleDocCreated?.(result.docId, result.docUrl);
        openGoogleDoc(result.docUrl);
      } else {
        setGoogleDocError(result.error || 'Failed to create Google Doc');
      }
    } catch (error) {
      setGoogleDocError(error instanceof Error ? error.message : 'Unexpected error');
    } finally {
      setIsCreatingGoogleDoc(false);
    }
  }, [reviewData, onGoogleDocCreated, docBranding]);

  // Count sections
  const sectionsAnalyzed = REVIEW_SECTION_ORDER.filter(
    k => {
      const r = reviewData.sectionReviews[k as keyof typeof reviewData.sectionReviews];
      return r?.updatedContent || r?.recommendations?.length;
    }
  ).length;

  // Export as DOCX
  const handleExportDOCX = useCallback(async () => {
    setIsExporting(true);
    try {
      const lines: string[] = [];
      lines.push(`# ${reviewData.title || 'Business Strategy Review'}`);
      lines.push(`\nDate: ${new Date(reviewData.reviewDate).toLocaleDateString()}`);
      lines.push(`Status: ${reviewData.status}`);
      lines.push(`Overall Score: ${reviewData.overallScore}/5`);
      lines.push('');

      REVIEW_SECTION_ORDER.forEach(sectionKey => {
        const label = REVIEW_SECTION_LABELS[sectionKey];
        const review = reviewData.sectionReviews[sectionKey as keyof typeof reviewData.sectionReviews];
        if (!review) return;

        lines.push(`\n## ${label}`);
        if (review.score > 0) lines.push(`Score: ${review.score}/5`);

        const content = review.currentContent;
        if (content) {
          lines.push('');
          lines.push(content);
        }

        if (review.recommendations.length > 0) {
          lines.push('\n### AI Recommendations');
          review.recommendations.forEach((rec, i) => {
            lines.push(`${i + 1}. ${rec}`);
          });
        }

        if (review.reviewNotes) {
          lines.push('\n### Review Notes');
          lines.push(review.reviewNotes);
        }
      });

      const fullText = lines.join('\n');
      const htmlContent = fullText
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        .replace(/\n/g, '<br/>');

      const docContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:w="urn:schemas-microsoft-com:office:word"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #333; }
            h1 { font-size: 24pt; color: #1a365d; border-bottom: 2px solid #2563eb; padding-bottom: 8px; }
            h2 { font-size: 16pt; color: #1e40af; margin-top: 24px; }
            h3 { font-size: 13pt; color: #374151; margin-top: 16px; }
            li { margin-left: 20px; margin-bottom: 4px; }
          </style>
        </head>
        <body>${htmlContent}</body>
        </html>
      `;

      const blob = new Blob([docContent], { type: 'application/vnd.ms-word' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(reviewData.title || 'Strategy-Review').replace(/\s+/g, '-')}.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [reviewData]);

  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden ${showSectionSidebar ? 'grid grid-cols-[280px_1fr]' : ''}`}>
      {showSectionSidebar && sectionSidebar && (
        <div className="border-r border-gray-200 overflow-y-auto max-h-[80vh]">
          {sectionSidebar}
        </div>
      )}
      <div>
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Strategy Document</h3>
              <p className="text-xs text-gray-500">
                {sectionsAnalyzed} sections with AI insights
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle AI annotations */}
            <button
              onClick={() => setShowAnnotations(!showAnnotations)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                showAnnotations ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-gray-100 text-gray-500 border border-gray-200'
              }`}
            >
              <Lightbulb className="w-3 h-3" />
              {showAnnotations ? 'AI Insights On' : 'AI Insights Off'}
            </button>

            {/* Expand / Collapse */}
            <button
              onClick={expandedSections.size > 0 ? collapseAll : expandAll}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
            >
              {expandedSections.size > 0 ? 'Collapse All' : 'Expand All'}
            </button>

            {/* Open in Google Docs */}
            <button
              onClick={handleOpenInGoogleDocs}
              disabled={isCreatingGoogleDoc}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                reviewData.googleDocUrl
                  ? 'text-green-700 bg-green-50 border border-green-200 hover:bg-green-100'
                  : 'text-gray-700 bg-white border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {isCreatingGoogleDoc ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5" />
              )}
              {reviewData.googleDocUrl ? 'Open Google Doc' : 'Open in Google Docs'}
            </button>

            {/* Export */}
            <button
              onClick={handleExportDOCX}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export DOCX
            </button>
          </div>
        </div>

        {/* Google Doc Error / Link */}
        {googleDocError && (
          <div className="px-5 py-2 bg-red-50 border-b border-red-200 text-xs text-red-700 flex items-center justify-between">
            <span>{googleDocError}</span>
            <button onClick={() => setGoogleDocError(null)} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
          </div>
        )}
        {reviewData.googleDocUrl && !googleDocError && (
          <div className="px-5 py-2 bg-green-50 border-b border-green-200 text-xs text-green-700 flex items-center gap-2">
            <ExternalLink className="w-3 h-3" />
            <span>Linked Google Doc:</span>
            <a
              href={reviewData.googleDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-green-900 font-medium truncate max-w-md"
            >
              {reviewData.googleDocUrl}
            </a>
            <button
              onClick={() => {
                setIsCreatingGoogleDoc(true);
                setGoogleDocError(null);
                createStrategyGoogleDoc(reviewData, docBranding).then(result => {
                  if (result.success && result.docId && result.docUrl) {
                    onGoogleDocCreated?.(result.docId, result.docUrl);
                    openGoogleDoc(result.docUrl);
                  } else {
                    setGoogleDocError(result.error || 'Failed');
                  }
                }).catch(e => setGoogleDocError(e.message)).finally(() => setIsCreatingGoogleDoc(false));
              }}
              disabled={isCreatingGoogleDoc}
              className="ml-auto text-[10px] text-green-600 hover:text-green-800 underline whitespace-nowrap"
            >
              Create New Version
            </button>
          </div>
        )}

        {/* Document Sections */}
        <div className="divide-y divide-gray-100">
          {REVIEW_SECTION_ORDER.map(sectionKey => {
            const review = reviewData.sectionReviews[sectionKey as keyof typeof reviewData.sectionReviews];
            if (!review) return null;
            const label = REVIEW_SECTION_LABELS[sectionKey];
            const isExpanded = expandedSections.has(sectionKey);
            const hasContent = !!review.currentContent;
            const hasAI = !!review.updatedContent || review.recommendations.length > 0;
            const isAnnotationOpen = openAnnotations.has(sectionKey);

            return (
              <div key={sectionKey} className="group">
                {/* Section Header */}
                <div
                  onClick={() => toggleSection(sectionKey)}
                  className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <h4 className="text-sm font-semibold text-gray-900">{label}</h4>
                    <div className="flex items-center gap-1.5">
                      {review.score > 0 && (
                        <span className={`flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded ${
                          review.score >= 4 ? 'bg-green-50 text-green-700' :
                          review.score >= 3 ? 'bg-amber-50 text-amber-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          <Star className="w-2.5 h-2.5" />
                          {review.score}/5
                        </span>
                      )}
                      {hasAI && showAnnotations && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-600 rounded flex items-center gap-0.5">
                          <Lightbulb className="w-2.5 h-2.5" />
                          AI Insight
                        </span>
                      )}
                      {review.status === 'approved' && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-50 text-green-600 rounded flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Accepted
                        </span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>

                {/* Section Content — Inline Document + AI Annotation Card */}
                {isExpanded && (
                  <div className="px-5 pb-4">
                    <div className={`${hasAI && showAnnotations ? 'grid grid-cols-[1fr_320px] gap-4' : ''}`}>
                      {/* Main Document Content — editable */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Document Content</span>
                          {hasContent && (
                            <button
                              onClick={() => handleCopy(review.currentContent, `${sectionKey}-doc`)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {copiedField === `${sectionKey}-doc` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                        <textarea
                          value={review.currentContent}
                          onChange={(e) => onSectionChange(sectionKey, { ...review, currentContent: e.target.value })}
                          placeholder="Document content for this section will appear here after upload and AI analysis..."
                          rows={8}
                          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[160px] leading-relaxed"
                          readOnly={readOnly}
                        />
                      </div>

                      {/* AI Annotation Card — margin comment style */}
                      {hasAI && showAnnotations && (
                        <div className="space-y-3">
                          {/* AI Analysis Card */}
                          {review.updatedContent && (
                            <div className="border border-amber-200 rounded-lg bg-amber-50/50 overflow-hidden">
                              <button
                                onClick={() => toggleAnnotation(sectionKey)}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100/50 transition-colors"
                              >
                                <span className="flex items-center gap-1.5">
                                  <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                                  AI Analysis
                                </span>
                                {isAnnotationOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                              {isAnnotationOpen && (
                                <div className="px-3 pb-3 border-t border-amber-200/50">
                                  <div className="mt-2 text-xs text-amber-900 whitespace-pre-wrap max-h-[400px] overflow-y-auto leading-relaxed">
                                    {review.updatedContent}
                                  </div>
                                  {!readOnly && (
                                    <button
                                      onClick={() => handleAcceptAnnotation(sectionKey)}
                                      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 transition-colors w-full justify-center"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      Accept AI Version
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Recommendations Card */}
                          {review.recommendations.length > 0 && (
                            <div className="border border-blue-200 rounded-lg bg-blue-50/50 px-3 py-2.5">
                              <p className="text-xs font-semibold text-blue-800 mb-1.5 flex items-center gap-1.5">
                                <Wand2 className="w-3.5 h-3.5 text-blue-600" />
                                Recommendations
                              </p>
                              <ul className="space-y-1">
                                {review.recommendations.map((rec, i) => (
                                  <li key={i} className="text-xs text-blue-800 flex items-start gap-1.5">
                                    <span className="font-medium text-blue-600 mt-0.5 flex-shrink-0">{i + 1}.</span>
                                    <span className="leading-relaxed">{rec}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Score Details */}
                          {review.score > 0 && (
                            <div className="border border-gray-200 rounded-lg bg-gray-50 px-3 py-2">
                              <p className="text-xs text-gray-500">
                                <span className="font-medium text-gray-700">Score: {review.score}/5</span>
                                {' — '}
                                {review.score >= 4 ? 'Strong section' :
                                 review.score >= 3 ? 'Adequate, room for improvement' :
                                 review.score >= 2 ? 'Needs significant work' :
                                 'Critical gaps identified'}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StrategyDocumentEditor;
