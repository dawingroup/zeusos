/**
 * Feature Flag Usage Examples
 *
 * This file demonstrates various patterns for using feature flags
 * in the application. Copy these patterns into your components.
 */

import { useFeatureFlag, useFeatureFlags } from '@/shared/hooks';
import { isFeatureEnabled } from '@/shared/hooks/useFeatureFlag';

// ============================================
// Example 1: Single Feature Flag
// ============================================

export function StrategyCanvasExample1() {
  const isGuidedWorkflowEnabled = useFeatureFlag('STRATEGY_GUIDED_WORKFLOW');

  return (
    <div>
      {isGuidedWorkflowEnabled ? (
        <div>
          <h1>Guided Workflow</h1>
          {/* New guided workflow UI */}
        </div>
      ) : (
        <div>
          <h1>Traditional View</h1>
          {/* Original all-sections view */}
        </div>
      )}
    </div>
  );
}

// ============================================
// Example 2: Multiple Feature Flags
// ============================================

export function StrategyCanvasExample2() {
  const features = useFeatureFlags([
    'STRATEGY_GUIDED_WORKFLOW',
    'STRATEGY_VALIDATION_UI',
    'STRATEGY_SAVE_STATUS_INDICATORS',
  ]);

  return (
    <div>
      <h1>Strategy Canvas</h1>

      {/* Conditionally render validation UI */}
      {features.STRATEGY_VALIDATION_UI && (
        <div className="validation-panel">
          <ValidationFeedback />
        </div>
      )}

      {/* Conditionally render save status */}
      {features.STRATEGY_SAVE_STATUS_INDICATORS && (
        <div className="save-status">
          <SaveStatusIndicator />
        </div>
      )}

      {/* Main content based on workflow flag */}
      {features.STRATEGY_GUIDED_WORKFLOW ? (
        <GuidedWorkflow />
      ) : (
        <AllSectionsView />
      )}
    </div>
  );
}

// ============================================
// Example 3: Feature Flag in Service/Utility
// ============================================

export function calculateEstimateExample(
  items: DesignItem[],
  strategy: ProjectStrategy | null
): number {
  let total = calculateBaseTotal(items);

  // Check feature flag in non-React code
  if (isFeatureEnabled('STRATEGY_BUDGET_TIER_PRICING')) {
    total = applyBudgetTierMultipliers(total, items, strategy);
  }

  return total;
}

// ============================================
// Example 4: Progressive Enhancement
// ============================================

export function DesignItemFormExample() {
  const isConstraintValidationEnabled = useFeatureFlag('STRATEGY_CONSTRAINT_VALIDATION');
  const isCustomerIntelligenceEnabled = useFeatureFlag('STRATEGY_CUSTOMER_INTELLIGENCE_AUTO_POPULATE');

  function handleSubmit(data: DesignItem) {
    // Base functionality (always runs)
    saveDesignItem(data);

    // Enhanced functionality (only if flag enabled)
    if (isConstraintValidationEnabled) {
      validateConstraints(data);
    }

    if (isCustomerIntelligenceEnabled) {
      enrichWithCustomerData(data);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}

      {/* Show validation feedback only if enabled */}
      {isConstraintValidationEnabled && (
        <div className="constraint-violations">
          <ConstraintWarnings />
        </div>
      )}

      {/* Show customer suggestions only if enabled */}
      {isCustomerIntelligenceEnabled && (
        <div className="customer-suggestions">
          <SuggestedMaterials />
        </div>
      )}

      <button type="submit">Save</button>
    </form>
  );
}

// ============================================
// Example 5: Feature Flag with Fallback
// ============================================

export function PricingCalculatorExample() {
  const isBottomUpPricingEnabled = useFeatureFlag('STRATEGY_BOTTOM_UP_PRICING_INTEGRATION');

  return (
    <div>
      <h2>Pricing Calculator</h2>

      {isBottomUpPricingEnabled ? (
        // Enhanced pricing with strategy integration
        <BottomUpPricingWithStrategy />
      ) : (
        // Basic pricing calculator (fallback)
        <BasicPricingCalculator />
      )}
    </div>
  );
}

// ============================================
// Example 6: Conditional Feature Loading
// ============================================

export function StrategyCanvasExample6() {
  const isSaveStatusEnabled = useFeatureFlag('STRATEGY_SAVE_STATUS_INDICATORS');

  return (
    <div>
      <header>
        <h1>Strategy Canvas</h1>

        {/* Only render save status if feature is enabled */}
        {/* This reduces bundle size and runtime overhead */}
        {isSaveStatusEnabled && <SaveStatusIndicator />}
      </header>

      <main>
        {/* Main content */}
      </main>
    </div>
  );
}

// ============================================
// Example 7: Debugging - Show All Enabled Features
// ============================================

export function DebugPanelExample() {
  const { getEnabledFeatures } = useFeatureFlags([]);
  const enabledFeatures = getEnabledFeatures();

  return (
    <div className="debug-panel">
      <h3>Enabled Features</h3>
      <ul>
        {enabledFeatures.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
    </div>
  );
}

// ============================================
// Example 8: A/B Testing Pattern
// ============================================

export function ABTestExample() {
  const isNewDesignEnabled = useFeatureFlag('STRATEGY_GUIDED_WORKFLOW');

  // Track which variant user sees for analytics
  React.useEffect(() => {
    analytics.track('feature_flag_variant', {
      flag: 'STRATEGY_GUIDED_WORKFLOW',
      variant: isNewDesignEnabled ? 'new_design' : 'old_design',
    });
  }, [isNewDesignEnabled]);

  return (
    <div>
      {isNewDesignEnabled ? (
        <NewGuidedWorkflowDesign />
      ) : (
        <OldAllSectionsDesign />
      )}
    </div>
  );
}

// ============================================
// Example 9: Feature Flag with Data Migration Check
// ============================================

export function EstimateCalculatorExample({ projectId }: { projectId: string }) {
  const isBudgetTierPricingEnabled = useFeatureFlag('STRATEGY_BUDGET_TIER_PRICING');
  const [isMigrated, setIsMigrated] = React.useState(false);

  // Check if project data has been migrated
  React.useEffect(() => {
    async function checkMigration() {
      const items = await fetchDesignItems(projectId);
      const hasStrategyContext = items.every((item) => item.strategyContext !== undefined);
      setIsMigrated(hasStrategyContext);
    }
    checkMigration();
  }, [projectId]);

  // Only apply budget tier pricing if feature enabled AND data migrated
  const shouldApplyBudgetTier = isBudgetTierPricingEnabled && isMigrated;

  return (
    <div>
      {!isMigrated && isBudgetTierPricingEnabled && (
        <div className="warning">
          ⚠️ Budget tier pricing requires data migration. Run: npm run migrate:strategy:execute
        </div>
      )}

      <PricingCalculator applyBudgetTier={shouldApplyBudgetTier} />
    </div>
  );
}

// ============================================
// Example 10: Gradual Feature Rollout
// ============================================

export function GradualRolloutExample() {
  const isLLMScopingEnabled = useFeatureFlag('STRATEGY_LLM_SCOPING');

  // Show beta badge if feature is in gradual rollout
  const isBeta = !isLLMScopingEnabled;

  return (
    <div>
      <h2>
        Project Scoping AI
        {isBeta && <span className="badge beta">Beta</span>}
      </h2>

      {isLLMScopingEnabled ? (
        // New hybrid regex + LLM approach
        <HybridScopingAI />
      ) : (
        // Old regex-only approach (fallback)
        <RegexScopingAI />
      )}

      {isBeta && (
        <p className="note">
          🚧 This feature is in beta. The enhanced LLM-powered scoping will be available soon.
        </p>
      )}
    </div>
  );
}

// ============================================
// Type-safe Feature Flag Helper (Advanced)
// ============================================

/**
 * Type-safe wrapper for feature flags with compile-time checking
 */
export function useTypedFeatureFlag<T extends keyof typeof FEATURES>(flag: T): boolean {
  return useFeatureFlag(flag);
}

// Usage:
export function TypedExample() {
  // TypeScript will autocomplete and validate the flag name
  const isEnabled = useTypedFeatureFlag('STRATEGY_GUIDED_WORKFLOW');

  // TypeScript will error if you use an invalid flag name
  // const invalid = useTypedFeatureFlag('INVALID_FLAG'); // ❌ Error

  return <div>{isEnabled ? 'Enabled' : 'Disabled'}</div>;
}

// ============================================
// Mocked Imports (for example purposes)
// ============================================

// These are just placeholders for the examples above
type DesignItem = any;
type ProjectStrategy = any;
const React = { useEffect: () => {}, useState: () => [false, () => {}] };
const FEATURES = {} as const;
const ValidationFeedback = () => null;
const SaveStatusIndicator = () => null;
const GuidedWorkflow = () => null;
const AllSectionsView = () => null;
const ConstraintWarnings = () => null;
const SuggestedMaterials = () => null;
const BottomUpPricingWithStrategy = () => null;
const BasicPricingCalculator = () => null;
const NewGuidedWorkflowDesign = () => null;
const OldAllSectionsDesign = () => null;
const HybridScopingAI = () => null;
const RegexScopingAI = () => null;
const PricingCalculator = ({ applyBudgetTier }: { applyBudgetTier: boolean }) => null;

const calculateBaseTotal = (items: any[]) => 0;
const applyBudgetTierMultipliers = (total: number, items: any[], strategy: any) => total;
const saveDesignItem = (data: any) => {};
const validateConstraints = (data: any) => {};
const enrichWithCustomerData = (data: any) => {};
const fetchDesignItems = async (projectId: string) => [] as any[];
const analytics = { track: (event: string, data: any) => {} };
