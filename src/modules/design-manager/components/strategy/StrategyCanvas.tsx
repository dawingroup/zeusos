/**
 * Strategy Canvas Component
 * Main canvas for project strategy research with AI report generation
 */

import { useState, useCallback, Suspense, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Ruler, DollarSign, Search, Lightbulb, X, FileText, Download, Sparkles, Package, User, LayoutGrid, Workflow, Edit, Share2 } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { functions } from '@/shared/services/firebase';
import { useStrategyResearch } from './useStrategyResearch';
import { ChallengesSection } from './ChallengesSection';
import { SpaceParametersSection } from './SpaceParametersSection';
import { BudgetFrameworkSection } from './BudgetFrameworkSection';
import { ResearchAssistant } from './ResearchAssistant';
import { TrendInsightsPanel } from './TrendInsightsPanel';
import { ProjectContextSection, DEFAULT_PROJECT_CONTEXT, type ProjectContext } from './ProjectContextSection';
import { DesignBriefSection } from './DesignBriefSection';
import { SaveStatusIndicator } from './SaveStatusIndicator';
import { GuidedStrategyWorkflow } from './GuidedStrategyWorkflow';
import { InlineRecommendations } from '@/shared/components/recommendations';
import { useStrategyRecommendations } from '@/shared/hooks/useRecommendations';
import { StrategyPDF } from '@/modules/strategy/components/StrategyPDF';
import type { RecommendationItem } from '@/shared/services/recommendationService';
import type { StrategyReport, GenerateStrategyInput } from '@/modules/strategy/types';
import { useCustomerIntelligenceSuggestions, applyCustomerIntelligenceSuggestions } from '../../services/aiContextService';
import { createStrategyReportFromGeneration } from '../../services/strategyReportService';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';

// Lazy load AI components
const ProjectScopingAI = lazyWithRetry(() =>
  import('../ai/ProjectScopingAI').then(m => ({ default: m.ProjectScopingAI }))
);
const CustomerIntelligenceAI = lazyWithRetry(() =>
  import('../ai/CustomerIntelligenceAI').then(m => ({ default: m.CustomerIntelligenceAI }))
);

interface StrategyCanvasProps {
  projectId: string;
  projectName?: string;
  projectCode?: string;
  clientBrief?: string;
  userId?: string;
  companyId?: string;
  onClose?: () => void;
}

export function StrategyCanvas({ projectId, projectName, projectCode, clientBrief, userId, companyId, onClose }: StrategyCanvasProps) {
  const navigate = useNavigate();

  const {
    strategy,
    messages,
    isLoading,
    isSending,
    error,
    saveStatus,
    lastSaved,
    isSynced: _isSynced,
    updateStrategy,
    sendQuery,
    saveFinding,
    deleteFinding,
    clearError,
  } = useStrategyResearch(projectId, userId, companyId);

  // View mode toggle (Guided vs All Sections)
  const [viewMode, setViewMode] = useState<'guided' | 'all-sections'>(() => {
    // Load from localStorage
    const saved = localStorage.getItem(`strategy-view-mode-${projectId}`);
    return (saved as 'guided' | 'all-sections') || 'all-sections';
  });

  const handleViewModeChange = (mode: 'guided' | 'all-sections') => {
    localStorage.setItem(`strategy-view-mode-${projectId}`, mode);
    startTransition(() => {
      setViewMode(mode);
    });
  };

  // Reserved for future panel switching
  const [_activePanel] = useState<'research' | 'findings'>('research');

  // AI Report generation state
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<StrategyReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [showReportPanel, setShowReportPanel] = useState(false);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  // Project Scoping AI state - used to feed into Strategy Report
  const [scopingResult, setScopingResult] = useState<any>(null);

  // Design brief → AI Scoping bridge
  const [briefForScoping, setBriefForScoping] = useState<string | undefined>(undefined);

  // Enhanced context state
  const [projectContext, setProjectContext] = useState<ProjectContext>(DEFAULT_PROJECT_CONTEXT);
  const [selectedRecommendations, setSelectedRecommendations] = useState<RecommendationItem[]>([]);
  
  // Customer intelligence state
  const [customerIntelligence, setCustomerIntelligence] = useState<{
    materialPreferences?: string[];
    preferredSuppliers?: string[];
    qualityExpectations?: string;
    priceSensitivity?: number;
    segment?: string;
  } | null>(null);

  // Customer intelligence suggestions
  const { hasSuggestions, suggestions, canApply } = useCustomerIntelligenceSuggestions(customerIntelligence ?? undefined, strategy ?? undefined);
  const [showSuggestionsBanner, setShowSuggestionsBanner] = useState(false);

  // Handle applying customer intelligence suggestions
  const handleApplySuggestions = useCallback(() => {
    if (!strategy || !canApply) return;

    const updatedStrategy = applyCustomerIntelligenceSuggestions(strategy as any, suggestions) as any;
    updateStrategy(updatedStrategy);
    setShowSuggestionsBanner(false);
  }, [strategy, suggestions, canApply, updateStrategy]);

  // Handle customer intelligence data
  const handleCustomerContextReady = useCallback((context: any) => {
    console.log('Customer context ready:', context);
    setCustomerIntelligence({
      materialPreferences: context.materialPreferences,
      preferredSuppliers: context.preferredSuppliers,
      qualityExpectations: context.qualityExpectations,
      priceSensitivity: context.priceSensitivity,
      segment: context.segment,
    });
    // Enrich project context with customer preferences
    if (context.materialPreferences?.length) {
      setProjectContext(prev => ({
        ...prev,
        style: {
          ...prev.style,
          materialPreferences: [
            ...new Set([...(prev.style.materialPreferences || []), ...context.materialPreferences])
          ],
        },
      }));
    }
    // Show suggestions banner when customer intelligence is loaded
    setShowSuggestionsBanner(true);
  }, []);

  // Contextual recommendations based on strategy data
  const { recommendations, isLoading: isLoadingRecommendations } = useStrategyRecommendations({
    projectType: projectContext.project.type,
    style: projectContext.style.primary,
    materials: projectContext.style.materialPreferences,
    budgetTier: strategy?.budgetFramework?.tier,
    keywords: [
      projectContext.project.subType,
      strategy?.spaceParameters?.spaceType,
      ...(projectContext.style.colorPreferences || []),
    ].filter(Boolean) as string[],
  });

  const handleSelectRecommendation = (item: RecommendationItem) => {
    if (!selectedRecommendations.find(r => r.id === item.id)) {
      setSelectedRecommendations(prev => [...prev, item]);
    }
  };

  
  // Generate AI Strategy Report
  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    setReportError(null);

    try {
      // Extract research excerpts from assistant messages
      const researchExcerpts = messages
        .filter(m => m.role === 'assistant' && m.content.length > 100)
        .slice(-5) // Last 5 significant responses
        .map(m => m.content.substring(0, 500)); // Truncate to avoid token limits

      // Build space details string
      const spaceDetails = strategy?.spaceParameters 
        ? `${strategy.spaceParameters.totalArea} ${strategy.spaceParameters.areaUnit} ${strategy.spaceParameters.spaceType} with ${strategy.spaceParameters.circulationPercent}% circulation`
        : undefined;

      // Format research findings
      const researchFindings = strategy?.researchFindings?.map(f => ({
        title: f.title,
        content: f.content,
        category: f.category,
      })) || [];

      // Build scoping context if available
      const scopingContext = scopingResult ? {
        deliverables: scopingResult.deliverables?.slice(0, 20)?.map((d: any) => ({
          name: d.name,
          category: d.category,
          quantity: d.quantity,
          roomType: d.roomTypeName,
        })),
        summary: scopingResult.summary,
        entities: scopingResult.entities,
        trendInsights: scopingResult.aiEnhancement?.trendInsights,
      } : null;

      const generateStrategy = httpsCallable<GenerateStrategyInput, StrategyReport>(
        functions,
        'generateStrategyReport'
      );

      const result = await generateStrategy({
        projectName: projectName || 'Untitled Project',
        projectType: projectContext.project.type || scopingResult?.entities?.projectType || strategy?.spaceParameters?.spaceType || 'Custom Millwork',
        clientBrief: clientBrief || 'Custom millwork project',
        location: projectContext.project.location || scopingResult?.entities?.location || 'East Africa',
        year: new Date().getFullYear(),
        // Enhanced inputs
        constraints: strategy?.challenges?.constraints || [],
        painPoints: strategy?.challenges?.painPoints || [],
        goals: strategy?.challenges?.goals || [],
        budgetTier: strategy?.budgetFramework?.tier,
        spaceDetails,
        researchFindings,
        researchExcerpts,
        // Include scoping output
        scopingContext: scopingContext || undefined,
        // Enhanced project context
        projectContext: {
          customer: projectContext.customer,
          timeline: projectContext.timeline,
          style: projectContext.style,
          targetUsers: projectContext.targetUsers,
          requirements: projectContext.requirements,
        },
        // Customer intelligence enrichment
        customerIntelligence: customerIntelligence ? {
          segment: customerIntelligence.segment,
          materialPreferences: customerIntelligence.materialPreferences,
          preferredSuppliers: customerIntelligence.preferredSuppliers,
          qualityExpectations: customerIntelligence.qualityExpectations,
          priceSensitivity: customerIntelligence.priceSensitivity,
        } : undefined,
        // Product recommendations from contextual service
        recommendedProducts: selectedRecommendations
          .filter(r => r.type === 'product')
          .map(p => ({
            productId: p.id,
            productName: p.name,
            category: p.category || 'general',
            quantity: 1,
            reason: p.matchReason,
          })),
      });

      setGeneratedReport(result.data);

      // NEW: Persist generated report to Firestore
      if (userId) {
        try {
          const savedReport = await createStrategyReportFromGeneration(
            projectId,
            result.data,
            userId,
            {
              projectName: projectName || 'Untitled Project',
              projectType: projectContext.project.type || scopingResult?.entities?.projectType || strategy?.spaceParameters?.spaceType || 'Custom Millwork',
              clientBrief: clientBrief || 'Custom millwork project',
              location: projectContext.project.location || scopingResult?.entities?.location || 'East Africa',
              year: new Date().getFullYear(),
              constraints: strategy?.challenges?.constraints || [],
              painPoints: strategy?.challenges?.painPoints || [],
              goals: strategy?.challenges?.goals || [],
              budgetTier: strategy?.budgetFramework?.tier,
            },
            strategy
          );
          setActiveReportId(savedReport.id);
          console.log('Strategy report persisted:', savedReport.id);
        } catch (persistError) {
          console.error('Failed to persist report:', persistError);
          // Don't fail the whole operation if persistence fails
        }
      }

      setShowReportPanel(true);
    } catch (err) {
      console.error('Report generation error:', err);
      setReportError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-full">
      {/* Header - sticky below AppShell header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Project Strategy</h1>
                {projectName && (
                  <p className="text-sm text-gray-500 mt-1">{projectName}</p>
                )}
              </div>

              {/* Save Status Indicator */}
              <SaveStatusIndicator
                saveStatus={saveStatus}
                lastSaved={lastSaved}
                className="ml-4"
              />
            </div>
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => handleViewModeChange('guided')}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'guided'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Guided workflow (step-by-step)"
                >
                  <Workflow className="w-4 h-4" />
                  Guided
                </button>
                <button
                  onClick={() => handleViewModeChange('all-sections')}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'all-sections'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="All sections (free-form)"
                >
                  <LayoutGrid className="w-4 h-4" />
                  All Sections
                </button>
              </div>
              {/* Generate AI Report Button */}
              <button
                onClick={handleGenerateReport}
                disabled={isGeneratingReport}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50"
              >
                {isGeneratingReport ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate AI Report
                  </>
                )}
              </button>

              {/* View Report Button (if generated) */}
              {generatedReport && !showReportPanel && (
                <button
                  onClick={() => setShowReportPanel(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-50"
                >
                  <FileText className="w-4 h-4" />
                  View Report
                </button>
              )}

              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Banners */}
      {(error || reportError) && (
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
            <p className="text-sm text-red-600">{error || reportError}</p>
            <button onClick={() => { clearError(); setReportError(null); }} className="text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Customer Intelligence Suggestions Banner */}
      {showSuggestionsBanner && hasSuggestions && suggestions && (
        <div className="px-4 sm:px-6 py-3">
          <div className="p-4 bg-gradient-to-r from-teal-50 to-cyan-50 border-2 border-teal-200 rounded-lg shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 p-2 bg-teal-100 rounded-lg">
                <User className="w-5 h-5 text-teal-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-teal-900 mb-1">
                  Customer Intelligence Available
                </h3>
                <p className="text-sm text-teal-700 mb-3">
                  We've analyzed customer preferences. Apply these suggestions to auto-populate your strategy:
                </p>
                <ul className="space-y-1 text-sm text-teal-800 mb-3">
                  {suggestions.materialPreferences && suggestions.materialPreferences.length > 0 && (
                    <li className="flex items-start gap-2">
                      <span className="text-teal-500 mt-0.5">•</span>
                      <span>Material preferences: {suggestions.materialPreferences!.join(', ')}</span>
                    </li>
                  )}
                  {suggestions.budgetTier && (
                    <li className="flex items-start gap-2">
                      <span className="text-teal-500 mt-0.5">•</span>
                      <span>Budget tier: {suggestions.budgetTier}</span>
                    </li>
                  )}
                  {suggestions.qualityExpectations && (
                    <li className="flex items-start gap-2">
                      <span className="text-teal-500 mt-0.5">•</span>
                      <span>Quality expectations: {suggestions.qualityExpectations}</span>
                    </li>
                  )}
                </ul>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleApplySuggestions}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Apply Customer Preferences
                  </button>
                  <button
                    onClick={() => setShowSuggestionsBanner(false)}
                    className="px-4 py-2 text-sm text-teal-700 hover:text-teal-900 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowSuggestionsBanner(false)}
                className="flex-shrink-0 text-teal-400 hover:text-teal-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {viewMode === 'guided' ? (
        /* Guided Workflow View */
        <GuidedStrategyWorkflow
          projectId={projectId}
          projectName={projectName}
          projectCode={projectCode}
          userId={userId}
          strategy={strategy}
          onUpdate={updateStrategy as any}
          onGenerateReport={handleGenerateReport}
          onClose={onClose}
        />
      ) : (
        /* All Sections View (Traditional) */
        <div className="px-4 sm:px-6 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Column - Strategy Inputs */}
            <div className="lg:col-span-8 space-y-4">
            {/* Project Context - Customer & Project Details */}
            <div className="bg-white rounded-xl border-2 border-blue-200 p-4 bg-gradient-to-br from-blue-50 to-white">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-gray-900">Project Context</h2>
                <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">ENHANCED DATA</span>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Capture detailed customer and project information to provide better AI context.
              </p>
              <ProjectContextSection
                context={projectContext}
                onUpdate={setProjectContext}
                customerName={projectContext.customer.name}
                projectName={projectName}
              />
            </div>

            {/* Design Document Brief */}
            <div className="bg-white rounded-xl border-2 border-teal-200 p-4 bg-gradient-to-br from-teal-50 to-white">
              <DesignBriefSection
                brief={strategy?.designBrief || ''}
                onUpdate={(value) => updateStrategy({ designBrief: value })}
                onSendToScoping={(text) => setBriefForScoping(text)}
              />
            </div>

            {/* Project Scoping AI */}
            <div className="bg-white rounded-xl border-2 border-purple-200 p-4 bg-gradient-to-br from-purple-50 to-white">
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-5 h-5 text-purple-500" />
                <h2 className="text-lg font-semibold text-gray-900">Project Scoping AI</h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Enter your design brief to automatically extract deliverables. The output will be used to generate your strategy report.
              </p>
              <Suspense fallback={
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-600 border-t-transparent"></div>
                </div>
              }>
                <ProjectScopingAI
                  projectId={projectId}
                  projectName={projectName}
                  initialBriefText={briefForScoping}
                  onScopingComplete={(result) => {
                    console.log('Scoping complete:', result);
                    setScopingResult(result);
                  }}
                />
              </Suspense>
            </div>

            {/* Challenges Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-semibold text-gray-900">Challenges & Goals</h2>
              </div>
              <ChallengesSection
                challenges={strategy?.challenges || { painPoints: [], goals: [], constraints: [] }}
                onUpdate={(challenges) => updateStrategy({ challenges })}
              />
            </div>

            {/* Space Parameters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Ruler className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-gray-900">Space Parameters</h2>
              </div>
              <SpaceParametersSection
                params={strategy?.spaceParameters || {
                  totalArea: 0,
                  areaUnit: 'sqm',
                  spaceType: 'restaurant',
                  circulationPercent: 30,
                }}
                onUpdate={(spaceParameters) => updateStrategy({ spaceParameters })}
              />
            </div>

            {/* Budget Framework */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-semibold text-gray-900">Budget Framework</h2>
              </div>
              <BudgetFrameworkSection
                budget={strategy?.budgetFramework || { tier: 'standard', priorities: [] }}
                onUpdate={(budgetFramework) => updateStrategy({ budgetFramework })}
              />
            </div>

            {/* Research Findings */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-gray-900">Research Findings</h2>
                <span className="ml-auto text-sm text-gray-500">
                  {strategy?.researchFindings?.length || 0} saved
                </span>
              </div>
              <TrendInsightsPanel
                findings={strategy?.researchFindings || []}
                onDelete={deleteFinding}
              />
            </div>

          </div>

          {/* Right Column - Research Assistant & Customer Intelligence */}
          <div className="lg:col-span-4 space-y-4">
            {/* Customer Intelligence - Now properly integrated */}
            <div className="bg-white rounded-xl border-2 border-teal-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-teal-500 to-cyan-600">
                <User className="w-4 h-4 text-white" />
                <span className="font-medium text-white text-sm">Customer Intelligence</span>
                {customerIntelligence?.segment && (
                  <span className="ml-auto px-2 py-0.5 bg-white/20 text-white text-xs rounded">
                    {customerIntelligence.segment}
                  </span>
                )}
              </div>
              <div className="p-3">
                <Suspense fallback={
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-teal-600 border-t-transparent"></div>
                  </div>
                }>
                  <CustomerIntelligenceAI
                    customerId={projectContext.customer.company ? undefined : undefined}
                    customerName={projectContext.customer.name || projectContext.customer.company || 'Customer'}
                    onContextReady={handleCustomerContextReady}
                  />
                </Suspense>
              </div>
            </div>

            {/* Contextual Recommendations */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                <InlineRecommendations
                  recommendations={recommendations}
                  isLoading={isLoadingRecommendations}
                  showTypes={['product', 'inspiration', 'feature']}
                  onSelect={handleSelectRecommendation}
                  title="Suggested for this project"
                  maxVisible={3}
                />
                {selectedRecommendations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">
                      Selected ({selectedRecommendations.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selectedRecommendations.map(item => (
                        <span 
                          key={item.id}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full"
                        >
                          {item.name}
                          <button
                            onClick={() => setSelectedRecommendations(prev => prev.filter(r => r.id !== item.id))}
                            className="hover:text-indigo-900"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            {/* Research Assistant */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 p-3 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">
                <Search className="w-5 h-5 text-white" />
                <h2 className="font-semibold text-white">Research Assistant</h2>
              </div>
              <ResearchAssistant
                messages={messages}
                isSending={isSending}
                onSendQuery={sendQuery}
                onSaveFinding={saveFinding}
              />
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Generated Report Slide-out Panel */}
      {showReportPanel && generatedReport && (
        <div className="fixed inset-0 z-[60] overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowReportPanel(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl overflow-y-auto">
            {/* Report Header */}
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{generatedReport.reportTitle}</h2>
                  <p className="text-indigo-200 text-sm mt-1">
                    {generatedReport.trends.length} trends • {generatedReport.recommendations.length} recommendations
                  </p>
                </div>
                <button
                  onClick={() => setShowReportPanel(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Report Content */}
            <div className="p-6 space-y-6">
              {/* Executive Summary */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Executive Summary</h3>
                <p className="text-gray-600 text-sm">{generatedReport.executiveSummary}</p>
              </div>

              {/* Key Trends */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Key Trends</h3>
                <div className="space-y-3">
                  {generatedReport.trends.map((trend, i) => (
                    <div key={i} className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-blue-900">{trend.name}</p>
                        <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                          {trend.relevanceScore}% match
                        </span>
                      </div>
                      <p className="text-sm text-blue-700">{trend.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Recommendations</h3>
                <div className="space-y-3">
                  {generatedReport.recommendations.map((rec, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-gray-900">{rec.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                          rec.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {rec.priority} priority
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>~{rec.estimatedDays} days</span>
                        <span>{rec.complexity} complexity</span>
                        <span>{rec.matchedFeatures.length} features</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Production Feasibility */}
              <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-teal-900">Production Feasibility</h3>
                    <p className="text-sm text-teal-700 mt-1">{generatedReport.productionFeasibility.notes}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-teal-600">
                      {generatedReport.productionFeasibility.overallScore}%
                    </p>
                    <p className="text-xs text-teal-600">Score</p>
                  </div>
                </div>
              </div>

              {/* Color Scheme */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Suggested Color Scheme</h3>
                <div className="flex gap-3">
                  <div
                    className="w-16 h-16 rounded-lg shadow-inner flex items-center justify-center"
                    style={{ backgroundColor: generatedReport.colorScheme.primary }}
                  >
                    <span className="text-white text-xs font-medium drop-shadow">Primary</span>
                  </div>
                  <div
                    className="w-16 h-16 rounded-lg shadow-inner flex items-center justify-center"
                    style={{ backgroundColor: generatedReport.colorScheme.secondary }}
                  >
                    <span className="text-white text-xs font-medium drop-shadow">Secondary</span>
                  </div>
                  <div
                    className="w-16 h-16 rounded-lg shadow-inner flex items-center justify-center"
                    style={{ backgroundColor: generatedReport.colorScheme.accent }}
                  >
                    <span className="text-white text-xs font-medium drop-shadow">Accent</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2">{generatedReport.colorScheme.description}</p>
              </div>

              {/* Next Steps */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Next Steps</h3>
                <ul className="space-y-1">
                  {generatedReport.nextSteps.map((step, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-indigo-500 mt-1">•</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Report Footer with Actions */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex justify-between items-center">
              <button
                onClick={() => setShowReportPanel(false)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                {/* Open in Editor Button */}
                {activeReportId && (
                  <button
                    onClick={() => navigate(`/projects/${projectId}/strategy-report/${activeReportId}`)}
                    className="flex items-center gap-2 px-4 py-2 border border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-50"
                    title="Open in full editor to review and update"
                  >
                    <Edit className="w-4 h-4" />
                    Open in Editor
                  </button>
                )}

                {/* Share to Client Button (placeholder - will implement modal later) */}
                {activeReportId && (
                  <button
                    onClick={async () => {
                      const clientEmail = prompt('Enter client email to share with:');
                      if (!clientEmail) return;
                      try {
                        const { doc, updateDoc, arrayUnion, Timestamp } = await import('firebase/firestore');
                        const { db } = await import('../../../../firebase/config');
                        await updateDoc(doc(db, 'strategy_reports', activeReportId!), {
                          sharedWith: arrayUnion(clientEmail),
                          lastSharedAt: Timestamp.now(),
                        });
                        alert(`Report shared with ${clientEmail}`);
                      } catch (error) {
                        console.error('Failed to share:', error);
                        alert('Failed to share report. Please try again.');
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-600 rounded-lg hover:bg-green-50"
                    title="Share with client via portal"
                  >
                    <Share2 className="w-4 h-4" />
                    Share to Client
                  </button>
                )}

                {/* Download PDF Button */}
                <PDFDownloadLink
                  document={<StrategyPDF report={generatedReport} />}
                  fileName={`${projectCode || projectId}-strategy-${new Date().toISOString().split('T')[0]}.pdf`}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  {({ loading }) => (
                    loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        Preparing...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download PDF
                      </>
                    )
                  )}
                </PDFDownloadLink>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
