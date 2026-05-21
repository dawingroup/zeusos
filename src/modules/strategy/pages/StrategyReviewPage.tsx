// ============================================================================
// STRATEGY REVIEW PAGE
// ZeusOS v2.0 - CEO Strategy Command
// Main page for comprehensive business strategy review with AI assistant
// ============================================================================

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Save,
  Sparkles,
  Loader2,
  FileText,
  Eye,
  LayoutGrid,
  TrendingUp,
  Users,
  Grid,
  DollarSign,
  ShieldAlert,
  Map,
  Target,
  ChevronRight,
  AlertCircle,
  BookOpen,
  PanelLeft,
  Building2,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { useStrategyReview } from '../hooks/useStrategyReview';
import { useOrganizationSettings } from '../../../core/settings';
import { DEFAULT_SUBSIDIARIES } from '../../../types/subsidiary';
import type { StrategyDocBranding } from '../services/strategyGoogleDocs.service';

import {
  StrategyDocumentUpload,
  BusinessModelCanvas,
  SWOTAnalysisSection,
  SectionReviewCard,
  OKRKPIOutputSection,
  AIStrategyAssistant,
  StrategyDocumentEditor,
  BusinessPivotsSection,
  OperationalGapAnalysis,
  AssetGapAnalysis,
  MarketIntelligenceContext,
  CrossModuleContext,
  SectionRegistryPanel,
} from '../components/review';

import type {
  UploadedStrategyDocument,
  SectionReview,
  AIMessage,
  AISuggestion,
  BusinessModelCanvas as BMCType,
  SWOTAnalysis,
} from '../types/strategy.types';

import {
  REVIEW_SECTIONS,
  REVIEW_SECTION_ORDER,
  REVIEW_SECTION_LABELS,
  type ReviewSectionKey,
} from '../constants/strategyReview.constants';

import {
  analyzeStrategySection,
  analyzeFullStrategy,
  createUserMessage,
} from '../services/strategyAI.service';

import { useDocumentSections } from '../hooks/useDocumentSections';
import { useSectionAssessment } from '../hooks/useSectionAssessment';
import { useFullAssessmentCycle } from '../hooks/useFullAssessmentCycle';
import { approveRewrite, rejectRewrite } from '../services/strategyDocumentSection.service';

const SECTION_ICONS: Record<string, React.FC<{ className?: string }>> = {
  executiveSummary: FileText,
  visionMission: Eye,
  businessModelCanvas: LayoutGrid,
  marketAnalysis: TrendingUp,
  competitiveAnalysis: Users,
  swotAnalysis: Grid,
  financialProjections: DollarSign,
  riskAssessment: ShieldAlert,
  implementationRoadmap: Map,
  okrKpiOutput: Target,
};

export const StrategyReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { reviewId } = useParams<{ reviewId?: string }>();
  const companyId = 'dawin_group';

  // Firestore-backed review state with auto-save
  const {
    reviewData,
    setReviewData,
    isSaving,
    lastSavedAt,
    save,
    isLoading,
  } = useStrategyReview({ companyId, reviewId });

  const [activeSection, setActiveSection] = useState<ReviewSectionKey>(REVIEW_SECTIONS.EXECUTIVE_SUMMARY);
  // Default to editor view when opening an existing review
  const [viewMode, setViewMode] = useState<'sections' | 'editor'>(reviewId ? 'editor' : 'sections');
  const [isAILoading, setIsAILoading] = useState(false);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isAnalyzingDocument, setIsAnalyzingDocument] = useState(false);
  const [aiError, setAIError] = useState<string | null>(null);
  const [selectedDocumentSectionId, setSelectedDocumentSectionId] = useState<string | undefined>();

  // Document section hooks (Phase 2 integration)
  const currentReviewId = reviewData.id || reviewId || '';
  const {
    sections: documentSections,
    isLoading: isSectionsLoading,
    refreshSections,
  } = useDocumentSections(companyId, currentReviewId);

  const {
    isAssessing: isAssessingSection,
    assessSection: assessDocumentSection,
    generateRewrite: generateSectionRewrite,
  } = useSectionAssessment(companyId, currentReviewId);

  const {
    isRunning: isRunningCycle,
    runCycle,
  } = useFullAssessmentCycle(companyId, currentReviewId);

  // Section action callbacks
  const handleAssessSection = useCallback(async (sectionId: string) => {
    try {
      const result = await assessDocumentSection({ sectionId });
      if (result && result.recommendation === 'rewrite') {
        await generateSectionRewrite({ sectionId, assessment: result });
      }
    } catch (err) {
      console.error('Section assessment failed:', err);
      setAIError('Section assessment failed. Please try again.');
    }
  }, [assessDocumentSection, generateSectionRewrite]);

  const handleApproveRewrite = useCallback(async (sectionId: string) => {
    try {
      await approveRewrite(companyId, currentReviewId, sectionId, user?.uid ?? 'unknown');
      refreshSections();
    } catch (err) {
      console.error('Approve rewrite failed:', err);
    }
  }, [companyId, currentReviewId, refreshSections, user?.uid]);

  const handleRejectRewrite = useCallback(async (sectionId: string) => {
    try {
      await rejectRewrite(companyId, currentReviewId, sectionId, user?.uid ?? 'unknown');
      refreshSections();
    } catch (err) {
      console.error('Reject rewrite failed:', err);
    }
  }, [companyId, currentReviewId, refreshSections, user?.uid]);

  const handleRunFullAssessment = useCallback(async () => {
    try {
      await runCycle({});
    } catch (err) {
      console.error('Full assessment cycle failed:', err);
      setAIError('Full assessment cycle failed. Please try again.');
    }
  }, [runCycle]);

  // Subsidiary selector & branding
  const [selectedSubsidiaryId, setSelectedSubsidiaryId] = useState<string>('zeus-group');
  const { settings: orgSettings } = useOrganizationSettings();

  const subsidiaryOptions = useMemo(() => [
    { id: 'zeus-group', name: 'Zeus Group (All)' },
    ...DEFAULT_SUBSIDIARIES.filter(s => s.status === 'active').map(s => ({ id: s.id, name: s.name })),
  ], []);

  const docBranding = useMemo((): StrategyDocBranding | undefined => {
    const sub = subsidiaryOptions.find(s => s.id === selectedSubsidiaryId);
    const branding = orgSettings?.branding?.subsidiaries?.[
      selectedSubsidiaryId as keyof typeof orgSettings.branding.subsidiaries
    ];
    if (!branding && selectedSubsidiaryId === 'zeus-group') {
      // Fallback to group-level colors
      return {
        subsidiaryName: 'Zeus Group',
        branding: {
          primaryColor: orgSettings?.branding?.groupPrimaryColor || '#1a365d',
          secondaryColor: orgSettings?.branding?.groupSecondaryColor || '#2563eb',
          logoUrl: orgSettings?.branding?.groupLogo,
        },
      };
    }
    return branding ? { subsidiaryName: sub?.name, branding } : undefined;
  }, [selectedSubsidiaryId, orgSettings, subsidiaryOptions]);

  // Stable ref for reviewData.id to avoid stale closures
  const reviewIdRef = useRef(reviewData.id);
  reviewIdRef.current = reviewData.id;

  const handleAnalyzeFullDocument = useCallback(async (content: string) => {
    console.log('[Strategy] handleAnalyzeFullDocument called, content length:', content.length);
    setIsAnalyzingDocument(true);
    setAIError(null);
    try {
      console.log('[Strategy] Calling analyzeFullStrategy...');
      const response = await analyzeFullStrategy(content, companyId, reviewIdRef.current);
      console.log('[Strategy] analyzeFullStrategy response:', {
        success: response.success,
        hasMessage: !!response.conversationMessage,
        suggestionsCount: response.suggestions?.length ?? 0,
        error: response.error,
        suggestionTypes: response.suggestions?.map(s => `${s.type}:${s.sectionKey || 'none'}`),
      });

      if (response.success && response.conversationMessage) {
        setReviewData(prev => ({
          ...prev,
          aiConversationHistory: [
            ...prev.aiConversationHistory,
            createUserMessage('Analyze the uploaded strategy document and provide comprehensive assessment.'),
            response.conversationMessage,
          ],
        }));

        // Apply suggestions to populate sections
        if (response.suggestions && response.suggestions.length > 0) {
          console.log('[Strategy] Applying', response.suggestions.length, 'suggestions to review sections');
          applySuggestionsToReview(response.suggestions);
        } else {
          console.warn('[Strategy] No suggestions in response to apply');
          setAIError('AI analysis completed but returned no section suggestions. The AI response may have been too large. Try with a shorter document or use the AI Assistant panel to analyze individual sections.');
        }
      } else if (response.error) {
        console.error('[Strategy] AI error:', response.error);
        setAIError(`AI analysis failed: ${response.error}`);
      } else if (!response.success) {
        console.error('[Strategy] Response not successful:', response);
        setAIError('AI analysis returned no results. Please try again.');
      }
    } catch (error) {
      console.error('[Strategy] Full analysis exception:', error);
      setAIError(error instanceof Error ? error.message : 'Full document analysis failed. Please try again.');
    } finally {
      setIsAnalyzingDocument(false);
    }
  }, [companyId]);

  // Document upload handler
  const handleDocumentUploaded = useCallback((doc: UploadedStrategyDocument, parsedContent?: string) => {
    console.log('[Strategy] handleDocumentUploaded called, parsedContent length:', parsedContent?.length ?? 0);
    setReviewData(prev => {
      const updated = {
        ...prev,
        uploadedDocument: doc,
        status: 'in_progress' as const,
      };

      // Populate every section's currentContent with the original document
      // so users can see their uploaded text in the editor. These duplicates
      // are detected and stripped by stripLargeFields before Firestore writes.
      // Once AI fills sections with section-specific content, they diverge
      // from the full doc and are saved normally.
      if (parsedContent && parsedContent.length > 50) {
        const sectionKeys = Object.keys(updated.sectionReviews) as (keyof typeof updated.sectionReviews)[];
        const updatedReviews = { ...updated.sectionReviews };
        sectionKeys.forEach(key => {
          updatedReviews[key] = { ...updatedReviews[key], currentContent: parsedContent };
        });
        updated.sectionReviews = updatedReviews;
      }

      return updated;
    });

    // If we have content, trigger full AI analysis
    if (parsedContent && parsedContent.length > 50) {
      console.log('[Strategy] Content > 50 chars, triggering full AI analysis');
      handleAnalyzeFullDocument(parsedContent);
    } else {
      console.warn('[Strategy] Content too short or missing, skipping AI analysis. Length:', parsedContent?.length ?? 0);
    }
  }, [handleAnalyzeFullDocument]);

  // Clear document handler — allows replacing the uploaded document
  const handleClearDocument = useCallback(() => {
    setReviewData(prev => ({
      ...prev,
      uploadedDocument: undefined,
    }));
  }, []);

  // Map suggestion types to sectionReview keys when no explicit sectionKey
  const SUGGESTION_TYPE_TO_SECTION: Record<string, string> = {
    general: 'executiveSummary',
    market: 'marketAnalysis',
    competitive: 'competitiveAnalysis',
    financial: 'financialProjections',
    risk: 'riskAssessment',
    roadmap: 'implementationRoadmap',
    okr: 'okrKpiOutput',
    kpi: 'okrKpiOutput',
  };

  const applySuggestionsToReview = (suggestions: AISuggestion[]) => {
    console.log('[Strategy] applySuggestionsToReview called with', suggestions.length, 'suggestions');
    suggestions.forEach((s, i) => {
      console.log(`[Strategy] Suggestion ${i}: type=${s.type}, sectionKey=${s.sectionKey}, score=${s.score}, contentLength=${s.content?.length}, recsCount=${s.recommendations?.length}`);
    });
    setReviewData(prev => {
      const updated = { ...prev };

      suggestions.forEach(s => {
        // --- BMC: populate Business Model Canvas ---
        if (s.type === 'bmc') {
          try {
            const bmcData = typeof s.content === 'string' ? JSON.parse(s.content) : s.content;
            if (bmcData && typeof bmcData === 'object') {
              Object.keys(bmcData).forEach(key => {
                const bmcKey = key as keyof BMCType;
                if (updated.businessModelCanvas[bmcKey] && Array.isArray(bmcData[key])) {
                  const newItems = bmcData[key].map((text: string) => ({
                    id: crypto.randomUUID().slice(0, 8),
                    text: typeof text === 'string' ? text : String(text),
                    aiSuggested: true,
                  }));
                  updated.businessModelCanvas[bmcKey] = [
                    ...updated.businessModelCanvas[bmcKey],
                    ...newItems,
                  ];
                }
              });
            }
          } catch { /* not JSON, skip */ }

          // Also update the BMC section review if score/recommendations provided
          if (s.score || s.recommendations?.length) {
            const sr = { ...updated.sectionReviews.businessModelCanvas };
            if (s.score) sr.score = s.score;
            if (s.recommendations?.length) sr.recommendations = s.recommendations;
            sr.status = 'in_review';
            sr.lastReviewedAt = new Date().toISOString();
            updated.sectionReviews = { ...updated.sectionReviews, businessModelCanvas: sr };
          }
          return;
        }

        // --- SWOT: populate SWOT Analysis ---
        if (s.type === 'swot') {
          try {
            const swotData = typeof s.content === 'string' ? JSON.parse(s.content) : s.content;
            if (swotData && typeof swotData === 'object') {
              (['strengths', 'weaknesses', 'opportunities', 'threats'] as const).forEach(q => {
                if (Array.isArray(swotData[q])) {
                  const newItems = swotData[q].map((text: string) => ({
                    id: crypto.randomUUID().slice(0, 8),
                    text: typeof text === 'string' ? text : String(text),
                    impact: 'medium' as const,
                    aiSuggested: true,
                  }));
                  updated.swotAnalysis[q] = [...updated.swotAnalysis[q], ...newItems];
                }
              });
            }
          } catch { /* not JSON, skip */ }

          // Also update the SWOT section review
          if (s.score || s.recommendations?.length) {
            const sr = { ...updated.sectionReviews.swotAnalysis };
            if (s.score) sr.score = s.score;
            if (s.recommendations?.length) sr.recommendations = s.recommendations;
            sr.status = 'in_review';
            sr.lastReviewedAt = new Date().toISOString();
            updated.sectionReviews = { ...updated.sectionReviews, swotAnalysis: sr };
          }
          return;
        }

        // --- All other types: populate the corresponding sectionReview ---
        // AI analysis goes into updatedContent (Revised column).
        // currentContent holds the original uploaded document text.
        const sectionKey = s.sectionKey || SUGGESTION_TYPE_TO_SECTION[s.type];
        if (sectionKey && sectionKey in updated.sectionReviews) {
          const key = sectionKey as keyof typeof updated.sectionReviews;
          const sr = { ...updated.sectionReviews[key] };
          if (s.content) {
            // Build revised content: AI analysis + recommendations
            const parts = [s.content];
            if (s.recommendations?.length) {
              parts.push('\n\n**Recommendations:**\n' + s.recommendations.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n'));
            }
            sr.updatedContent = parts.join('');
          }
          if (s.score) sr.score = s.score;
          if (s.recommendations?.length) sr.recommendations = s.recommendations;
          sr.status = 'in_review';
          sr.lastReviewedAt = new Date().toISOString();
          updated.sectionReviews = { ...updated.sectionReviews, [key]: sr };
        }
      });

      // Recalculate overall score from section scores
      const sectionKeys = Object.keys(updated.sectionReviews) as (keyof typeof updated.sectionReviews)[];
      const scoredSections = sectionKeys.filter(k => updated.sectionReviews[k].score > 0);
      if (scoredSections.length > 0) {
        const totalScore = scoredSections.reduce((sum, k) => sum + updated.sectionReviews[k].score, 0);
        updated.overallScore = Math.round((totalScore / scoredSections.length) * 10) / 10;
      }

      return updated;
    });
  };

  // Section review handlers
  const handleSectionReviewChange = useCallback((sectionKey: ReviewSectionKey, review: SectionReview) => {
    setReviewData(prev => ({
      ...prev,
      sectionReviews: {
        ...prev.sectionReviews,
        [sectionKey]: review,
      },
    }));
  }, []);

  // BMC change handler
  const handleBMCChange = useCallback((bmc: BMCType) => {
    setReviewData(prev => ({ ...prev, businessModelCanvas: bmc }));
  }, []);

  // SWOT change handler
  const handleSWOTChange = useCallback((swot: SWOTAnalysis) => {
    setReviewData(prev => ({ ...prev, swotAnalysis: swot }));
  }, []);

  // AI section analysis
  const handleRequestAI = useCallback(async (section?: string) => {
    const targetSection = section || activeSection;
    setIsAILoading(true);
    setAIError(null);
    try {
      const sectionData: Record<string, unknown> = {};
      if (targetSection === 'businessModelCanvas') {
        sectionData.businessModelCanvas = reviewData.businessModelCanvas;
      } else if (targetSection === 'swotAnalysis') {
        sectionData.swotAnalysis = reviewData.swotAnalysis;
      } else if (targetSection === 'financialProjections') {
        sectionData.financialProjections = reviewData.financialProjections;
      } else {
        sectionData.sectionReview = reviewData.sectionReviews[targetSection as keyof typeof reviewData.sectionReviews];
      }

      const response = await analyzeStrategySection({
        companyId,
        reviewId: reviewData.id,
        section: targetSection,
        currentData: sectionData,
        uploadedDocumentContent: reviewData.uploadedDocument?.parsedContent,
        conversationHistory: reviewData.aiConversationHistory,
      });

      if (response.conversationMessage) {
        setReviewData(prev => ({
          ...prev,
          aiConversationHistory: [
            ...prev.aiConversationHistory,
            createUserMessage(`Analyze the ${REVIEW_SECTION_LABELS[targetSection as ReviewSectionKey] || targetSection} section.`, targetSection),
            response.conversationMessage,
          ],
        }));
      }

      if (response.suggestions.length > 0) {
        applySuggestionsToReview(response.suggestions);
      }

      if (response.error) {
        setAIError(`Section analysis error: ${response.error}`);
      }
    } catch (error) {
      console.error('AI analysis failed:', error);
      setAIError(error instanceof Error ? error.message : 'Section analysis failed. Please try again.');
    } finally {
      setIsAILoading(false);
    }
  }, [activeSection, companyId, reviewData]);

  // Apply AI suggestion
  const handleApplySuggestion = useCallback((suggestion: AISuggestion) => {
    applySuggestionsToReview([suggestion]);
    // Mark as applied in conversation
    setReviewData(prev => ({
      ...prev,
      aiConversationHistory: prev.aiConversationHistory.map(msg => ({
        ...msg,
        suggestions: msg.suggestions?.map(s =>
          s.id === suggestion.id ? { ...s, applied: true } : s
        ),
      })),
    }));
  }, []);

  // Conversation update
  const handleConversationUpdate = useCallback((messages: AIMessage[]) => {
    setReviewData(prev => ({ ...prev, aiConversationHistory: messages }));
  }, []);

  // Calculate progress
  const completedSections = Object.values(reviewData.sectionReviews).filter(
    r => r.status === 'approved' || r.status === 'in_review'
  ).length;
  const totalSections = Object.keys(reviewData.sectionReviews).length;
  const progressPercent = Math.round((completedSections / totalSections) * 100);

  // Calculate overall score
  const scores = Object.values(reviewData.sectionReviews).filter(r => r.score > 0);
  const avgScore = scores.length > 0 ? (scores.reduce((sum, r) => sum + r.score, 0) / scores.length).toFixed(1) : '—';

  // Render active section content
  const renderSectionContent = () => {
    const currentReview = reviewData.sectionReviews[activeSection as keyof typeof reviewData.sectionReviews];
    if (!currentReview) return null;

    switch (activeSection) {
      case REVIEW_SECTIONS.BUSINESS_MODEL_CANVAS:
        return (
          <SectionReviewCard
            sectionKey={activeSection}
            review={currentReview}
            onChange={(r) => handleSectionReviewChange(activeSection, r)}
            onRequestAI={() => handleRequestAI('businessModelCanvas')}
            isAILoading={isAILoading}
          >
            <BusinessModelCanvas
              data={reviewData.businessModelCanvas}
              onChange={handleBMCChange}
              onRequestAI={(blockKey) => handleRequestAI(blockKey)}
              isAILoading={isAILoading}
            />
          </SectionReviewCard>
        );

      case REVIEW_SECTIONS.SWOT_ANALYSIS:
        return (
          <SectionReviewCard
            sectionKey={activeSection}
            review={currentReview}
            onChange={(r) => handleSectionReviewChange(activeSection, r)}
            onRequestAI={() => handleRequestAI('swotAnalysis')}
            isAILoading={isAILoading}
          >
            <SWOTAnalysisSection
              data={reviewData.swotAnalysis}
              onChange={handleSWOTChange}
              onRequestAI={() => handleRequestAI('swotAnalysis')}
              isAILoading={isAILoading}
            />
          </SectionReviewCard>
        );

      case REVIEW_SECTIONS.OKR_KPI_OUTPUT:
        return (
          <SectionReviewCard
            sectionKey={activeSection}
            review={currentReview}
            onChange={(r) => handleSectionReviewChange(activeSection, r)}
            onRequestAI={() => handleRequestAI('okrKpiOutput')}
            isAILoading={isAILoading}
          >
            <OKRKPIOutputSection
              okrs={reviewData.generatedOKRs}
              kpis={reviewData.generatedKPIs}
              reviewData={reviewData}
              companyId={companyId}
              onOKRsChange={(okrs) => setReviewData(prev => ({ ...prev, generatedOKRs: okrs }))}
              onKPIsChange={(kpis) => setReviewData(prev => ({ ...prev, generatedKPIs: kpis }))}
            />
          </SectionReviewCard>
        );

      default:
        return (
          <SectionReviewCard
            sectionKey={activeSection}
            review={currentReview}
            onChange={(r) => handleSectionReviewChange(activeSection, r)}
            onRequestAI={() => handleRequestAI(activeSection)}
            isAILoading={isAILoading}
          />
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Loading strategy review...</p>
        </div>
      </div>
    );
  }

  return (
    <div key={reviewId || 'new'}>
      {/* Top Bar */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/strategy/plans')}
              className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Business Strategy Review</h1>
              <p className="text-xs text-gray-500">
                {reviewData.status === 'draft' ? 'Draft' : reviewData.status === 'in_progress' ? 'In Progress' : 'Completed'}
                {' — '}{completedSections}/{totalSections} sections • Score: {avgScore}/5
                {lastSavedAt && (
                  <span className="ml-2 text-green-600">• Saved {new Date(lastSavedAt).toLocaleTimeString()}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Subsidiary Selector */}
            <div className="hidden md:flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={selectedSubsidiaryId}
                onChange={(e) => setSelectedSubsidiaryId(e.target.value)}
                className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {subsidiaryOptions.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Progress */}
            <div className="hidden md:flex items-center gap-2">
              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-600">{progressPercent}%</span>
            </div>

            {/* View Mode Toggle */}
            <div className="hidden md:flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('sections')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'sections' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <PanelLeft className="w-3.5 h-3.5" />
                Sections
              </button>
              <button
                onClick={() => setViewMode('editor')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'editor' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Document Editor
              </button>
            </div>

            <button
              onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                isAIPanelOpen
                  ? 'text-purple-700 bg-purple-100'
                  : 'text-purple-600 hover:bg-purple-50'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              AI Assistant
            </button>

            <button
              onClick={() => save()}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="flex gap-6">
          {/* Sidebar Navigation */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-20 space-y-1">
              {/* Upload Section */}
              <div className="mb-4 p-3 bg-white border border-gray-200 rounded-xl">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Strategy Document
                </h4>
                <StrategyDocumentUpload
                  companyId={companyId}
                  existingDocument={reviewData.uploadedDocument}
                  onDocumentUploaded={handleDocumentUploaded}
                  onAnalyzeDocument={(content) => handleAnalyzeFullDocument(content)}
                  onClearDocument={handleClearDocument}
                  isAnalyzing={isAnalyzingDocument}
                />
              </div>

              {/* Section Navigation */}
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
                Review Sections
              </h4>
              {REVIEW_SECTION_ORDER.map((sectionKey) => {
                const Icon = SECTION_ICONS[sectionKey] || FileText;
                const sectionReview = reviewData.sectionReviews[sectionKey as keyof typeof reviewData.sectionReviews];
                const isActive = activeSection === sectionKey;
                return (
                  <button
                    key={sectionKey}
                    onClick={() => setActiveSection(sectionKey)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all text-left ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-medium border border-blue-200'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className="flex-1 truncate">{REVIEW_SECTION_LABELS[sectionKey]}</span>
                    {sectionReview?.score > 0 && (
                      <span className="text-xs text-gray-400">{sectionReview.score}/5</span>
                    )}
                    {sectionReview?.status && sectionReview.status !== 'not_started' && (
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        sectionReview.status === 'approved' ? 'bg-green-500' :
                        sectionReview.status === 'in_review' ? 'bg-blue-500' :
                        sectionReview.status === 'needs_update' ? 'bg-amber-500' :
                        'bg-gray-300'
                      }`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Mobile Section Selector */}
            <div className="lg:hidden mb-4">
              <select
                value={activeSection}
                onChange={(e) => setActiveSection(e.target.value as ReviewSectionKey)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                {REVIEW_SECTION_ORDER.map(key => (
                  <option key={key} value={key}>{REVIEW_SECTION_LABELS[key]}</option>
                ))}
              </select>
            </div>

            {/* Document Upload for mobile / when no sidebar */}
            <div className="lg:hidden mb-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <StrategyDocumentUpload
                  companyId={companyId}
                  existingDocument={reviewData.uploadedDocument}
                  onDocumentUploaded={handleDocumentUploaded}
                  onAnalyzeDocument={(content) => handleAnalyzeFullDocument(content)}
                  onClearDocument={handleClearDocument}
                  isAnalyzing={isAnalyzingDocument}
                />
              </div>
            </div>

            {/* Analyzing Banner */}
            {isAnalyzingDocument && (
              <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-purple-600 animate-spin flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-purple-900">AI is analyzing your strategy document...</p>
                  <p className="text-xs text-purple-700">Claude is reviewing the document and will pre-populate sections with suggestions.</p>
                </div>
              </div>
            )}

            {/* AI Error Banner */}
            {aiError && !isAnalyzingDocument && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">AI Analysis Error</p>
                  <p className="text-xs text-red-700 mt-0.5">{aiError}</p>
                </div>
                <button
                  onClick={() => setAIError(null)}
                  className="text-red-400 hover:text-red-600 text-sm px-2"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Active Section Content */}
            {viewMode === 'editor' ? (
              <StrategyDocumentEditor
                reviewData={reviewData}
                onSectionChange={handleSectionReviewChange}
                onGoogleDocCreated={(docId, docUrl) => {
                  setReviewData(prev => ({ ...prev, googleDocId: docId, googleDocUrl: docUrl }));
                }}
                docBranding={docBranding}
                showSectionSidebar={documentSections.length > 0}
                sectionSidebar={
                  <SectionRegistryPanel
                    sections={documentSections}
                    isLoading={isSectionsLoading}
                    selectedSectionId={selectedDocumentSectionId}
                    onSectionSelect={setSelectedDocumentSectionId}
                    onAssessSection={handleAssessSection}
                    onRewriteSection={(sectionId) => handleAssessSection(sectionId)}
                    onApproveRewrite={handleApproveRewrite}
                    onRejectRewrite={handleRejectRewrite}
                    onRunFullAssessment={handleRunFullAssessment}
                    isAssessing={isAssessingSection}
                    isRunningCycle={isRunningCycle}
                  />
                }
              />
            ) : (
              renderSectionContent()
            )}

            {/* Cross-Module Context Panel */}
            <div className="mt-6">
              <CrossModuleContext companyId={companyId} subsidiaryId={selectedSubsidiaryId !== 'zeus-group' ? selectedSubsidiaryId : undefined} />
            </div>

            {/* Business Pivots Section */}
            <div className="mt-6">
              <BusinessPivotsSection
                companyId={companyId}
                userId={reviewData.createdBy || 'unknown'}
              />
            </div>

            {/* Market Intelligence Context */}
            <div className="mt-6">
              <MarketIntelligenceContext companyId={companyId} />
            </div>

            {/* Operational Gap Analysis */}
            <div className="mt-6">
              <OperationalGapAnalysis
                companyId={companyId}
                reviewId={reviewData.id}
                conversationHistory={reviewData.aiConversationHistory}
                onConversationUpdate={handleConversationUpdate}
              />
            </div>

            {/* Asset Gap Analysis */}
            <div className="mt-6">
              <AssetGapAnalysis
                companyId={companyId}
                reviewId={reviewData.id}
                conversationHistory={reviewData.aiConversationHistory}
                onConversationUpdate={handleConversationUpdate}
              />
            </div>

            {/* Section Navigation Footer */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  const currentIndex = REVIEW_SECTION_ORDER.indexOf(activeSection);
                  if (currentIndex > 0) {
                    setActiveSection(REVIEW_SECTION_ORDER[currentIndex - 1]);
                  }
                }}
                disabled={REVIEW_SECTION_ORDER.indexOf(activeSection) === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous Section
              </button>
              <button
                onClick={() => {
                  const currentIndex = REVIEW_SECTION_ORDER.indexOf(activeSection);
                  if (currentIndex < REVIEW_SECTION_ORDER.length - 1) {
                    setActiveSection(REVIEW_SECTION_ORDER[currentIndex + 1]);
                  }
                }}
                disabled={REVIEW_SECTION_ORDER.indexOf(activeSection) === REVIEW_SECTION_ORDER.length - 1}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next Section
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Strategy Assistant Panel */}
      <AIStrategyAssistant
        reviewData={reviewData}
        companyId={companyId}
        activeSection={activeSection}
        conversationHistory={reviewData.aiConversationHistory}
        onConversationUpdate={handleConversationUpdate}
        onApplySuggestion={handleApplySuggestion}
        isOpen={isAIPanelOpen}
        onToggle={() => setIsAIPanelOpen(!isAIPanelOpen)}
        selectedDocumentSectionId={selectedDocumentSectionId}
        onAssessDocumentSection={handleAssessSection}
        onRewriteDocumentSection={(sectionId) => handleAssessSection(sectionId)}
        isAssessingSection={isAssessingSection}
      />
    </div>
  );
};

export default StrategyReviewPage;
