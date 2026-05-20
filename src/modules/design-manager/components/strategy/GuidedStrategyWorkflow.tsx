/**
 * GuidedStrategyWorkflow Component
 * Step-by-step guided workflow for completing strategy canvas
 */

import React, { useState, useEffect, Suspense } from 'react';
import { ChevronLeft, ChevronRight, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStrategyValidation } from '../../services/strategyValidation';
import { SectionCompletenessBadge, InfoBanner } from './ValidationFeedback';
import type { ProjectStrategy } from '../../types/strategy';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';

// Lazy load section components (properly handling named exports)
const ProjectContextSection = lazyWithRetry(() =>
  import('./ProjectContextSection').then(m => ({ default: m.ProjectContextSection }))
);
const DesignBriefSection = lazyWithRetry(() =>
  import('./DesignBriefSection').then(m => ({ default: m.DesignBriefSection }))
);
const ChallengesSection = lazyWithRetry(() =>
  import('./ChallengesSection').then(m => ({ default: m.ChallengesSection }))
);
const SpaceParametersSection = lazyWithRetry(() =>
  import('./SpaceParametersSection').then(m => ({ default: m.SpaceParametersSection }))
);
const BudgetFrameworkSection = lazyWithRetry(() =>
  import('./BudgetFrameworkSection').then(m => ({ default: m.BudgetFrameworkSection }))
);
const ResearchAssistant = lazyWithRetry(() =>
  import('./ResearchAssistant').then(m => ({ default: m.ResearchAssistant }))
);

// ============================================
// Workflow Step Configuration
// ============================================

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
  validation: {
    requiredFields: string[];
    sectionKey: keyof ProjectStrategy;
  };
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'project-context',
    title: 'Project & Customer Info',
    description: 'Define who the customer is and what type of project this is',
    component: ProjectContextSection,
    validation: {
      requiredFields: ['customer.name', 'project.type', 'project.location'],
      sectionKey: 'projectContext',
    },
  },
  {
    id: 'design-brief',
    title: 'Design Brief',
    description: 'Capture the project narrative and scope',
    component: DesignBriefSection,
    validation: {
      requiredFields: ['designBrief'],
      sectionKey: 'designBrief',
    },
  },
  {
    id: 'space-budget',
    title: 'Space & Budget',
    description: 'Define space parameters and budget framework',
    component: () => (
      <div className="space-y-6">
        {/* @ts-expect-error Props provided by parent context */}
        <SpaceParametersSection />
        {/* @ts-expect-error Props provided by parent context */}
        <BudgetFrameworkSection />
      </div>
    ),
    validation: {
      requiredFields: ['spaceParameters.totalArea', 'spaceParameters.spaceType', 'budgetFramework.tier'],
      sectionKey: 'spaceParameters',
    },
  },
  {
    id: 'challenges',
    title: 'Challenges & Goals',
    description: 'Identify constraints, pain points, and objectives',
    component: ChallengesSection,
    validation: {
      requiredFields: [],
      sectionKey: 'challenges',
    },
  },
  {
    id: 'research',
    title: 'Research & Insights',
    description: 'Use AI research assistant and save findings',
    component: ResearchAssistant,
    validation: {
      requiredFields: [],
      sectionKey: 'researchFindings',
    },
  },
  {
    id: 'review',
    title: 'Review & Generate Report',
    description: 'Review all inputs and generate strategy report',
    component: StrategyReview,
    validation: {
      requiredFields: [],
      sectionKey: 'designBrief',
    },
  },
];

// ============================================
// Main Guided Workflow Component
// ============================================

interface GuidedStrategyWorkflowProps {
  projectId: string;
  projectName?: string;
  projectCode?: string;
  userId?: string;
  strategy: ProjectStrategy | null;
  onUpdate: (updates: Partial<ProjectStrategy>) => Promise<void>;
  onGenerateReport?: () => void;
  onClose?: () => void;
}

export function GuidedStrategyWorkflow({
  projectId,
  projectName,
  projectCode,
  userId,
  strategy,
  onUpdate,
  onGenerateReport,
  onClose,
}: GuidedStrategyWorkflowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  // Get validation status for current strategy
  const {
    sectionCompleteness,
    overallProgress,
    isStrategyComplete: _isStrategyComplete,
  } = useStrategyValidation(strategy || {} as ProjectStrategy);

  // Update completed steps based on section completeness
  useEffect(() => {
    const newCompleted = new Set<string>();
    WORKFLOW_STEPS.forEach((step) => {
      const section = sectionCompleteness[step.validation.sectionKey as string];
      if (section?.isComplete) {
        newCompleted.add(step.id);
      }
    });
    setCompletedSteps(newCompleted);
  }, [sectionCompleteness]);

  // Check if current step can be proceeded
  const canProceed = () => {
    const step = WORKFLOW_STEPS[currentStep];

    // Last step (review) can always proceed
    if (step.id === 'review') {
      return true;
    }

    // Check if required fields are filled
    if (step.validation.requiredFields.length > 0) {
      const section = sectionCompleteness[step.validation.sectionKey as string];
      return section?.isComplete || false;
    }

    // Optional steps can always proceed
    return true;
  };

  const handleNext = () => {
    if (currentStep < WORKFLOW_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      // Save to localStorage
      localStorage.setItem(`strategy-workflow-step-${projectId}`, String(currentStep + 1));
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      localStorage.setItem(`strategy-workflow-step-${projectId}`, String(currentStep - 1));
    }
  };

  const handleStepClick = (stepIndex: number) => {
    setCurrentStep(stepIndex);
    localStorage.setItem(`strategy-workflow-step-${projectId}`, String(stepIndex));
  };

  // Restore last step from localStorage
  useEffect(() => {
    const savedStep = localStorage.getItem(`strategy-workflow-step-${projectId}`);
    if (savedStep) {
      const stepNum = parseInt(savedStep, 10);
      if (stepNum >= 0 && stepNum < WORKFLOW_STEPS.length) {
        setCurrentStep(stepNum);
      }
    }
  }, [projectId]);

  const currentStepConfig = WORKFLOW_STEPS[currentStep];
  const StepComponent = currentStepConfig.component;

  return (
    <div className="flex h-full bg-gray-50">
      {/* Left Sidebar - Progress Tracker */}
      <div className="w-80 border-r bg-white p-6 flex flex-col">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Strategy Canvas</h2>
          <p className="text-sm text-gray-600 mt-1">{projectName || 'Project'}</p>
        </div>

        {/* Overall Progress */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">Overall Progress</span>
            <span className="text-sm font-bold text-blue-900">
              {overallProgress.completed}/{overallProgress.total}
            </span>
          </div>
          <div className="w-full h-2 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{
                width: `${overallProgress.total > 0
                  ? (overallProgress.completed / overallProgress.total) * 100
                  : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Steps List */}
        <nav className="flex-1 space-y-2">
          {WORKFLOW_STEPS.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = completedSteps.has(step.id);
            const isPast = index < currentStep;

            return (
              <button
                key={step.id}
                onClick={() => handleStepClick(index)}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-lg transition-colors',
                  'flex items-center gap-3',
                  isActive && 'bg-blue-50 border border-blue-200',
                  !isActive && isPast && 'hover:bg-gray-50',
                  !isActive && !isPast && 'hover:bg-gray-50'
                )}
              >
                {/* Step indicator */}
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    'transition-colors',
                    isCompleted && 'bg-green-500 text-white',
                    !isCompleted && isActive && 'bg-blue-500 text-white',
                    !isCompleted && !isActive && 'bg-gray-200 text-gray-600'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>

                {/* Step info */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium truncate',
                      isActive && 'text-blue-900',
                      !isActive && 'text-gray-700'
                    )}
                  >
                    {step.title}
                  </p>
                  {isActive && (
                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                      {step.description}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="mt-6 w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close Workflow
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Step Header */}
        <div className="border-b bg-white px-8 py-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-900">
                {currentStepConfig.title}
              </h3>
              <p className="text-gray-600 mt-1">
                {currentStepConfig.description}
              </p>
            </div>

            {/* Completeness badge */}
            <div>
              {sectionCompleteness[currentStepConfig.validation.sectionKey as string] && (
                <SectionCompletenessBadge
                  completed={sectionCompleteness[currentStepConfig.validation.sectionKey as string].completed}
                  total={sectionCompleteness[currentStepConfig.validation.sectionKey as string].total}
                />
              )}
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <Suspense fallback={<StepLoadingFallback />}>
            <StepComponent
              projectId={projectId}
              projectName={projectName}
              projectCode={projectCode}
              userId={userId}
              strategy={strategy}
              onUpdate={onUpdate}
              onGenerateReport={onGenerateReport}
            />
          </Suspense>
        </div>

        {/* Navigation Footer */}
        <div className="border-t bg-white px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-md',
                'flex items-center gap-2',
                currentStep === 0
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <div className="text-sm text-gray-600">
              Step {currentStep + 1} of {WORKFLOW_STEPS.length}
            </div>

            {currentStep < WORKFLOW_STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md',
                  'flex items-center gap-2',
                  canProceed()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                )}
              >
                {canProceed() ? 'Continue' : 'Complete required fields'}
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onGenerateReport}
                className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Generate Report
              </button>
            )}
          </div>

          {/* Warning if required fields incomplete */}
          {!canProceed() && currentStepConfig.validation.requiredFields.length > 0 && (
            <InfoBanner
              type="warning"
              message="Please complete all required fields before proceeding to the next step."
              className="mt-4"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Strategy Review Component (Final Step)
// ============================================

function StrategyReview({
  strategy,
  onGenerateReport,
}: {
  strategy: ProjectStrategy | null;
  onGenerateReport?: () => void;
}) {
  if (!strategy) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No strategy data available</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <InfoBanner
        type="success"
        message="You've completed all the required sections! Review your inputs below and generate the strategy report when ready."
      />

      {/* Project Context Summary */}
      {strategy?.projectContext && (
        <ReviewSection title="Project & Customer">
          <ReviewItem label="Customer" value={strategy.projectContext.customer?.name} />
          <ReviewItem label="Project Type" value={strategy.projectContext.project?.type} />
          <ReviewItem label="Location" value={`${strategy.projectContext.project?.location}, ${strategy.projectContext.project?.country}`} />
          {strategy.projectContext.style?.primary && (
            <ReviewItem label="Style" value={strategy.projectContext.style.primary} />
          )}
        </ReviewSection>
      )}

      {/* Space & Budget Summary */}
      {(strategy?.spaceParameters || strategy?.budgetFramework) && (
        <ReviewSection title="Space & Budget">
          {strategy.spaceParameters?.totalArea && (
            <ReviewItem
              label="Total Area"
              value={`${strategy.spaceParameters.totalArea} ${strategy.spaceParameters.areaUnit} (${strategy.spaceParameters.spaceType})`}
            />
          )}
          {strategy.budgetFramework?.tier && (
            <ReviewItem label="Budget Tier" value={strategy.budgetFramework.tier} />
          )}
          {strategy.budgetFramework?.targetAmount && (
            <ReviewItem
              label="Target Budget"
              value={`${strategy.budgetFramework.currency} ${strategy.budgetFramework.targetAmount.toLocaleString()}`}
            />
          )}
        </ReviewSection>
      )}

      {/* Challenges Summary */}
      {strategy?.challenges && (
        <ReviewSection title="Challenges & Goals">
          {strategy.challenges.goals?.length > 0 && (
            <ReviewList label="Goals" items={strategy.challenges.goals} />
          )}
          {strategy.challenges.constraints?.length > 0 && (
            <ReviewList label="Constraints" items={strategy.challenges.constraints} />
          )}
          {strategy.challenges.painPoints?.length > 0 && (
            <ReviewList label="Pain Points" items={strategy.challenges.painPoints} />
          )}
        </ReviewSection>
      )}

      {/* Research Findings */}
      {strategy?.researchFindings && strategy.researchFindings.length > 0 && (
        <ReviewSection title="Research Insights">
          <p className="text-sm text-gray-700">
            {strategy.researchFindings.length} research {strategy.researchFindings.length === 1 ? 'finding' : 'findings'} saved
          </p>
        </ReviewSection>
      )}

      {/* Generate Report CTA */}
      <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-lg font-semibold text-blue-900 mb-2">Ready to Generate Report</h4>
        <p className="text-sm text-blue-700 mb-4">
          Your strategy canvas is complete. Generate a comprehensive AI report with trends, recommendations, and feasibility analysis.
        </p>
        <button
          onClick={onGenerateReport}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
        >
          Generate AI Strategy Report
        </button>
      </div>
    </div>
  );
}

// ============================================
// Review Section Components
// ============================================

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h4 className="text-lg font-semibold text-gray-900 mb-4">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value?: string | number }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-4">
      <span className="text-sm font-medium text-gray-600 w-32 flex-shrink-0">{label}:</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

function ReviewList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-medium text-gray-600 mb-2">{label}:</p>
      <ul className="space-y-1 ml-4">
        {items.map((item, idx) => (
          <li key={idx} className="text-sm text-gray-900 flex items-start gap-2">
            <span className="text-gray-400">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================
// Loading Fallback
// ============================================

function StepLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}

export default GuidedStrategyWorkflow;
