/**
 * Strategy Components
 */

export { StrategyCanvas } from './StrategyCanvas';
export { ChallengesSection } from './ChallengesSection';
export { SpaceParametersSection } from './SpaceParametersSection';
export { BudgetFrameworkSection } from './BudgetFrameworkSection';
export { ResearchAssistant } from './ResearchAssistant';
export { TrendInsightsPanel } from './TrendInsightsPanel';
export { ProductRecommendationsSection } from './ProductRecommendationsSection';
export { ProjectContextSection } from './ProjectContextSection';
export { DesignBriefSection } from './DesignBriefSection';
export { useStrategyResearch } from './useStrategyResearch';
export type { ProjectStrategy, ResearchFinding, ResearchMessage } from './useStrategyResearch';

// NEW: Guided Workflow & Validation Components
export { GuidedStrategyWorkflow } from './GuidedStrategyWorkflow';
export {
  ValidatedInput,
  ValidatedTextarea,
  SectionCompletenessBadge,
  ValidationSummary,
  HelpTooltip,
  RequiredFieldIndicator,
  InfoBanner,
  ProgressIndicator,
} from './ValidationFeedback';
export {
  SaveStatusIndicator,
  CompactSaveStatus,
  DetailedSaveStatus,
} from './SaveStatusIndicator';
export type { SaveStatus } from './useStrategyResearch';
