# Feature Flags Guide

This guide explains how to use feature flags for gradual rollout and A/B testing in the application.

## Overview

Feature flags allow you to enable/disable features without code changes, making it easy to:
- Gradually roll out new features to production
- Test features with specific user groups
- Quickly disable problematic features
- Run A/B experiments

## Available Feature Flags

### Strategy Canvas Enhancements

All strategy-related feature flags can be found in [src/shared/constants/index.ts](../src/shared/constants/index.ts):

#### `STRATEGY_GUIDED_WORKFLOW`
**Status:** ✅ Enabled by default
**Description:** Enables the guided 6-step workflow for strategy canvas
**Components:** `GuidedStrategyWorkflow`, `StrategyCanvas` (view mode toggle)

Provides a step-by-step workflow:
1. Project & Customer Info
2. Design Brief
3. Space & Budget
4. Challenges & Goals
5. Research & Insights
6. Review & Generate Report

**Recommendation:** Enable for all users to reduce cognitive overload from 8+ scattered sections

---

#### `STRATEGY_VALIDATION_UI`
**Status:** ✅ Enabled by default
**Description:** Enables real-time validation feedback UI
**Components:** `ValidatedInput`, `ValidatedTextarea`, `SectionCompletenessBadge`, `ValidationSummary`

Features:
- Inline error messages
- Required field indicators (red asterisk)
- "Why is this required?" tooltips
- Section completeness badges
- Form validation before save

**Recommendation:** Enable for all users to improve data quality

---

#### `STRATEGY_SAVE_STATUS_INDICATORS`
**Status:** ✅ Enabled by default
**Description:** Enables enhanced save status indicators
**Components:** `SaveStatusIndicator`, `CompactSaveStatus`, `DetailedSaveStatus`

Features:
- Visual save states: idle → saving → saved → error
- "Last saved: 2m ago" timestamps
- Toast notifications for errors with retry
- Auto-reset timers (2s for saved, 5s for error)

**Recommendation:** Enable for all users for better save feedback

---

#### `STRATEGY_CUSTOMER_INTELLIGENCE_AUTO_POPULATE`
**Status:** ✅ Enabled by default
**Description:** Enables auto-population from customer intelligence
**Components:** `StrategyCanvas` (suggestions banner), `useCustomerIntelligenceSuggestions`

Features:
- Auto-populate material preferences from customer data
- Budget tier inference from price sensitivity
- Quality expectations mapping
- "Apply Customer Preferences" notification

**Recommendation:** Enable for all users to reduce duplicate data entry

---

#### `STRATEGY_BUDGET_TIER_PRICING`
**Status:** ✅ Enabled by default
**Description:** Enables budget tier multipliers in estimates
**Services:** `estimateService`, `ConsolidatedEstimate`

Features:
- Applies budget tier multipliers to all item types
  - Economy: 0.7x
  - Standard: 1.0x
  - Premium: 1.5x
  - Luxury: 2.5x
- Budget variance tracking (allocated vs. actual)
- Budget summary in consolidated estimates
- Items over budget reporting

**Recommendation:** Enable after migrating existing design items with migration script

---

#### `STRATEGY_CONSTRAINT_VALIDATION`
**Status:** ✅ Enabled by default
**Description:** Enables validation of items against strategy constraints
**Services:** `constraintValidation`, validation hooks

Features:
- Budget constraint validation
- Space constraint validation (with circulation %)
- Material constraint validation (style preferences, avoid list)
- Timeline constraint validation (lead times vs. deadlines)
- Quality constraint validation

**Recommendation:** Enable after strategy data is well-populated

---

#### `STRATEGY_BOTTOM_UP_PRICING_INTEGRATION`
**Status:** ✅ Enabled by default
**Description:** Enables strategy integration in bottom-up pricing
**Services:** `bottomUpPricingService`, hooks: `useBottomUpPricing`

Features:
- Pre-populate deliverables from scoped items
- Infer role and design stage from deliverable type
- Adjust hour estimates based on budget tier
- Group deliverables by discipline

**Recommendation:** Enable for all users to reduce manual entry

---

#### `STRATEGY_LLM_SCOPING`
**Status:** 🚧 Disabled (requires backend implementation)
**Description:** Enables hybrid regex + LLM scoping
**Services:** `functions/src/ai/projectScoping.js`

Features:
- Hybrid regex + LLM extraction
- Confidence scoring with reasoning
- Handles natural language variations
- Strategy context enrichment

**Recommendation:** Enable after implementing backend Cloud Function upgrade

---

## Usage in Code

### React Components

Use the `useFeatureFlag` hook to check if a feature is enabled:

```typescript
import { useFeatureFlag } from '@/shared/hooks';

function StrategyCanvas() {
  const isGuidedWorkflowEnabled = useFeatureFlag('STRATEGY_GUIDED_WORKFLOW');

  return (
    <div>
      {isGuidedWorkflowEnabled ? (
        <GuidedStrategyWorkflow />
      ) : (
        <TraditionalAllSectionsView />
      )}
    </div>
  );
}
```

### Check Multiple Flags

Use `useFeatureFlags` to check multiple flags at once:

```typescript
import { useFeatureFlags } from '@/shared/hooks';

function StrategyCanvas() {
  const features = useFeatureFlags([
    'STRATEGY_GUIDED_WORKFLOW',
    'STRATEGY_VALIDATION_UI',
    'STRATEGY_SAVE_STATUS_INDICATORS'
  ]);

  return (
    <div>
      {features.STRATEGY_GUIDED_WORKFLOW && <GuidedWorkflow />}
      {features.STRATEGY_VALIDATION_UI && <ValidationFeedback />}
      {features.STRATEGY_SAVE_STATUS_INDICATORS && <SaveStatus />}
    </div>
  );
}
```

### Non-React Code

Use `isFeatureEnabled` for services and utilities:

```typescript
import { isFeatureEnabled } from '@/shared/hooks/useFeatureFlag';

export function calculateEstimate(items: DesignItem[], strategy: ProjectStrategy | null) {
  let total = calculateBaseTotal(items);

  if (isFeatureEnabled('STRATEGY_BUDGET_TIER_PRICING')) {
    total = applyBudgetTierMultipliers(total, items, strategy);
  }

  return total;
}
```

### Debugging

Get all enabled features:

```typescript
import { getEnabledFeatures } from '@/shared/hooks';

console.log('Enabled features:', getEnabledFeatures());
// Output: ['STRATEGY_GUIDED_WORKFLOW', 'STRATEGY_VALIDATION_UI', ...]
```

---

## Rollout Strategy

### Phase 1: Development & Staging ✅
All flags enabled in development and staging environments to test integration.

### Phase 2: Production Soft Launch (Recommended)
Enable flags one at a time in production:

1. **Week 1:** Enable UI enhancements (low risk)
   - `STRATEGY_VALIDATION_UI`
   - `STRATEGY_SAVE_STATUS_INDICATORS`
   - `STRATEGY_GUIDED_WORKFLOW`

2. **Week 2:** Enable data integration (after migration)
   - Run migration script: `npm run migrate:strategy:execute`
   - Enable `STRATEGY_BUDGET_TIER_PRICING`
   - Enable `STRATEGY_CUSTOMER_INTELLIGENCE_AUTO_POPULATE`

3. **Week 3:** Enable advanced features
   - `STRATEGY_CONSTRAINT_VALIDATION`
   - `STRATEGY_BOTTOM_UP_PRICING_INTEGRATION`

4. **Future:** Backend upgrade
   - Implement hybrid regex + LLM scoping in Cloud Functions
   - Enable `STRATEGY_LLM_SCOPING`

### Phase 3: Monitor & Iterate
- Monitor user feedback and error rates
- Adjust flags based on real-world usage
- Disable problematic features quickly if needed

---

## Migration Prerequisites

Before enabling `STRATEGY_BUDGET_TIER_PRICING`:

1. **Run the migration script** to add strategy fields to existing design items:
   ```bash
   # Dry run first (preview changes)
   npm run migrate:strategy:dry-run

   # Execute migration
   npm run migrate:strategy:execute
   ```

2. **Verify migration** in Firestore Console:
   - Check that design items have `strategyContext` and `budgetTracking`
   - Verify budget tiers are set correctly

3. **Set allocated budgets** for existing projects (optional):
   - The migration sets `allocatedBudget` to 0 by default
   - Users can manually set target budgets in the UI
   - This enables accurate variance tracking

See [scripts/MIGRATION_GUIDE.md](../scripts/MIGRATION_GUIDE.md) for detailed migration instructions.

---

## Toggling Flags

### During Development

Edit [src/shared/constants/index.ts](../src/shared/constants/index.ts):

```typescript
export const FEATURES = {
  STRATEGY_GUIDED_WORKFLOW: true,  // Change to false to disable
  // ... other flags
} as const;
```

### For Production (Future Enhancement)

Consider implementing environment-based flags:

```typescript
export const FEATURES = {
  STRATEGY_GUIDED_WORKFLOW: import.meta.env.VITE_FEATURE_GUIDED_WORKFLOW !== 'false',
  // Defaults to true unless explicitly disabled via env var
} as const;
```

Or remote config (Firebase Remote Config, LaunchDarkly, etc.) for runtime toggling without deployments.

---

## Troubleshooting

### Feature flag not working

1. **Check the flag is enabled** in [src/shared/constants/index.ts](../src/shared/constants/index.ts)
2. **Verify the flag name** matches exactly (case-sensitive)
3. **Clear browser cache** and hard reload (Cmd+Shift+R)
4. **Check for TypeScript errors** with `npm run typecheck`

### Migration required error

Some features require migrated data:
- `STRATEGY_BUDGET_TIER_PRICING` needs `strategyContext` on design items
- Run migration script: `npm run migrate:strategy:execute`

### Unexpected behavior after enabling

1. **Check browser console** for errors
2. **Disable the flag** immediately if critical
3. **Review recent code changes** related to the feature
4. **Test in development/staging** before re-enabling

---

## Best Practices

1. **Always test in development first** before enabling in production
2. **Enable one flag at a time** to isolate issues
3. **Run migration scripts in maintenance windows** for data-heavy changes
4. **Monitor error rates** after enabling new features
5. **Have a rollback plan** (disable flag if issues arise)
6. **Document feature dependencies** (e.g., migration required)
7. **Use gradual rollout** for high-risk features

---

## Support

For issues or questions:
1. Check this guide first
2. Review feature-specific documentation in `docs/`
3. Check TypeScript types and comments in source code
4. Contact the development team

---

**⚠️ Important:** Always run a dry run of migrations before executing on production data. Feature flags provide safety, but data migrations are irreversible.
