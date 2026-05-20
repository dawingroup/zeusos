# Strategy Canvas Architecture Guide

**Developer documentation for the Strategy Canvas module and its integration with Design Manager.**

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Type System](#type-system)
4. [Services](#services)
5. [Components](#components)
6. [Data Flow](#data-flow)
7. [AI Integration](#ai-integration)
8. [Feature Flags](#feature-flags)
9. [Testing](#testing)
10. [Extending the System](#extending-the-system)

---

## Overview

The Strategy Canvas module is a comprehensive project planning and scoping system that integrates with:
- **Design Manager**: For deliverable tracking and estimation
- **Customer Intelligence**: For auto-population of preferences
- **AI Services**: For project scoping and research
- **Bottom-Up Pricing**: For A&E fee calculation

### Key Features

1. **Guided Workflow**: 6-step process for strategy creation
2. **Hybrid AI Scoping**: Regex + LLM extraction of deliverables
3. **Budget Tier Pricing**: 4-tier multiplier system (economy, standard, premium, luxury)
4. **Constraint Validation**: Budget, space, material, timeline, quality checks
5. **Real-Time Validation**: Zod-based schema validation
6. **Save Status Tracking**: Auto-save with visual feedback

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Strategy Canvas UI                          │
│  ┌────────────────┐         ┌──────────────────────────────┐   │
│  │ Guided         │    OR   │ All Sections View            │   │
│  │ Workflow       │         │ (Expandable Sections)        │   │
│  │ (6 steps)      │         │                               │   │
│  └────────────────┘         └──────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Validation Feedback Components                           │  │
│  │ - ValidatedInput                                         │  │
│  │ - SectionCompletenessBadge                               │  │
│  │ - SaveStatusIndicator                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Strategy Services Layer                       │
│  ┌────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ Validation     │  │ AI Context       │  │ Constraint     │ │
│  │ Service        │  │ Service          │  │ Validation     │ │
│  │ (Zod schemas)  │  │ (Unified ctx)    │  │ (5 types)      │ │
│  └────────────────┘  └──────────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data & AI Layer                             │
│  ┌────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ Firestore      │  │ Cloud Functions  │  │ Pricing        │ │
│  │ - projectStrategy│ │ - projectScoping │  │ Services       │ │
│  │ - designItems  │  │   (hybrid AI)    │  │ - estimateService│
│  │ - customer     │  │ - taskGeneration │  │ - bottomUpPricing│
│  └────────────────┘  └──────────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Type System

### Core Types

#### `ProjectStrategy`
Main strategy document stored in `projectStrategy` collection.

```typescript
interface ProjectStrategy {
  id: string;
  projectId: string;

  // Project context
  projectContext?: {
    type?: string;
    location?: string;
    country?: string;
    timeline?: { startDate: Date; endDate: Date };
    style?: {
      aestheticDirection?: string;
      materialPreferences?: string[];
      avoidMaterials?: string[];
    };
    requirements?: {
      qualityExpectations?: string;
    };
  };

  // Space parameters
  spaceParameters?: {
    totalArea?: number;
    areaUnit?: 'sqm' | 'sqft';
    spaceType?: string;
    circulationPercent?: number;
  };

  // Budget framework
  budgetFramework?: {
    tier?: BudgetTier;
    targetAmount?: number;
    currency?: string;
    priorities?: string[];
  };

  // Research & insights
  designBrief?: string;
  researchFindings?: any[];
  challengesAndGoals?: {
    painPoints?: string[];
    goals?: string[];
    constraints?: string[];
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `BudgetTier`
4-tier budget classification with multipliers.

```typescript
type BudgetTier = 'economy' | 'standard' | 'premium' | 'luxury';

const BUDGET_TIER_MULTIPLIERS: Record<BudgetTier, number> = {
  economy: 0.7,
  standard: 1.0,
  premium: 1.5,
  luxury: 2.5,
};
```

#### `DesignItem` (Extended)
Design items now include strategy context and budget tracking.

```typescript
interface DesignItem {
  // ... existing fields

  // NEW: Strategy linkage
  strategyContext?: {
    strategyId: string;              // Links to projectStrategy doc
    budgetTier?: BudgetTier;         // Item-specific tier override
    spaceMultiplier?: number;        // For quantity calculations (per-room items)
    scopingConfidence?: number;      // AI confidence score (0-1)
    deliverableType?: string;        // From scoping AI
  };

  // NEW: Budget tracking
  budgetTracking?: {
    allocatedBudget?: number;        // Target budget from strategy
    actualCost?: number;             // Calculated from manufacturing/procurement
    variance?: number;               // actualCost - allocatedBudget
    lastUpdated?: Timestamp;
  };
}
```

#### `StrategyAIContext`
Unified context object passed to AI tools.

```typescript
interface StrategyAIContext {
  customer?: {
    name?: string;
    company?: string;
    materialPreferences?: string[];
    priceSensitivity?: string;
  };
  project: {
    type?: string;
    location?: string;
    country?: string;
    timeline?: { startDate: Date; endDate: Date };
  };
  challenges?: {
    painPoints?: string[];
    goals?: string[];
    constraints?: string[];
  };
  spaceParameters?: {
    totalArea?: number;
    areaUnit?: 'sqm' | 'sqft';
    spaceType?: string;
    circulationPercent?: number;
  };
  budgetFramework?: {
    tier?: BudgetTier;
    targetAmount?: number;
    currency?: string;
    priorities?: string[];
  };
  designBrief?: string;
  researchFindings?: any[];
}
```

#### `ScopedDeliverable`
Deliverable extracted from design brief with AI metadata.

```typescript
interface ScopedDeliverable {
  id: string;
  name: string;
  category: 'MANUFACTURED' | 'PROCURED' | 'DESIGN_DOCUMENT' | 'CONSTRUCTION';
  quantity: number;
  complexity?: 'low' | 'medium' | 'high';
  aiMetadata?: {
    confidenceScore: number;
    reasoning?: string;
    ambiguities?: string[];
    extractionMethod?: 'regex' | 'llm' | 'hybrid-regex' | 'hybrid-llm';
    requiresClarification?: boolean;
  };
}
```

---

## Services

### strategyValidation.ts

Zod-based validation service for real-time form validation.

**Key Exports:**
```typescript
// Schemas
export const SpaceParametersSchema: z.ZodObject;
export const BudgetFrameworkSchema: z.ZodObject;
export const ProjectContextSchema: z.ZodObject;
export const ProjectStrategySchema: z.ZodObject;

// Validation functions
export function validateField(value: any, schema: z.ZodSchema): FieldValidationResult;
export function validateSection(data: any, schema: z.ZodSchema): ValidationResult;

// Hooks
export function useFieldValidation(value: any, schema: z.ZodSchema, debounceMs?: number);
export function useStrategyValidation(strategy: Partial<ProjectStrategy>);
```

**Usage:**
```typescript
import { useFieldValidation, SpaceParametersSchema } from '@/modules/design-manager/services/strategyValidation';

const { isValid, error } = useFieldValidation(
  totalArea,
  SpaceParametersSchema.shape.totalArea,
  300 // debounce ms
);
```

### aiContextService.ts

Builds unified AI context from multiple data sources.

**Key Exports:**
```typescript
export function buildUnifiedStrategyAIContext(
  strategy: ProjectStrategy | null,
  customerIntelligence?: CustomerIntelligence
): StrategyAIContext | null;

export function useUnifiedStrategyAIContext(
  strategy: ProjectStrategy | null,
  customerIntelligence?: CustomerIntelligence
);

export function useCustomerIntelligenceSuggestions(
  customerIntelligence?: CustomerIntelligence,
  currentStrategy?: Partial<ProjectStrategy> | null
);

export function applyCustomerIntelligenceSuggestions(
  currentStrategy: Partial<ProjectStrategy>,
  suggestions: CustomerIntelligenceSuggestions
): Partial<ProjectStrategy>;
```

**Usage:**
```typescript
const aiContext = useUnifiedStrategyAIContext(strategy, customerIntelligence);

// Pass to AI tools
const scopingResult = await projectScoping({
  briefText: strategy.designBrief,
  strategyContext: aiContext,
});
```

### constraintValidation.ts

Validates design items against strategy constraints.

**Key Exports:**
```typescript
export function validateBudgetConstraints(
  items: DesignItem[],
  strategy: ProjectStrategy | null
): ConstraintViolation[];

export function validateSpaceConstraints(
  items: DesignItem[],
  strategy: ProjectStrategy | null
): ConstraintViolation[];

export function validateMaterialConstraints(
  items: DesignItem[],
  strategy: ProjectStrategy | null
): ConstraintViolation[];

export function validateTimelineConstraints(
  items: DesignItem[],
  strategy: ProjectStrategy | null
): ConstraintViolation[];

export function validateQualityConstraints(
  items: DesignItem[],
  strategy: ProjectStrategy | null
): ConstraintViolation[];

export async function validateDesignItemsAgainstStrategy(
  projectId: string,
  items: DesignItem[],
  strategy: ProjectStrategy | null
): Promise<ValidationReport>;
```

**Violation Structure:**
```typescript
interface ConstraintViolation {
  type: 'budget' | 'space' | 'material' | 'timeline' | 'quality';
  severity: 'critical' | 'important' | 'minor';
  itemId?: string;
  message: string;
  suggestedAction?: string;
  details?: any;
}
```

### estimateService.ts (Enhanced)

Calculate estimates with budget tier multipliers.

**Key Changes:**
```typescript
// NEW: Get budget tier multiplier for an item
function getBudgetTierMultiplier(
  item: DesignItem,
  projectStrategy: ProjectStrategy | null
): number {
  // 1. Use item-specific tier if set
  const itemTier = item.strategyContext?.budgetTier;
  if (itemTier && itemTier in BUDGET_TIER_MULTIPLIERS) {
    return BUDGET_TIER_MULTIPLIERS[itemTier];
  }

  // 2. Fallback to project strategy tier
  const projectTier = projectStrategy?.budgetFramework?.tier;
  if (projectTier && projectTier in BUDGET_TIER_MULTIPLIERS) {
    return BUDGET_TIER_MULTIPLIERS[projectTier];
  }

  // 3. Default to standard tier
  return BUDGET_TIER_MULTIPLIERS.standard;
}

// Applied in cost calculations
const baseUnitCost = item.procurement.landedCostPerUnit;
const tierMultiplier = getBudgetTierMultiplier(item, strategy);
const unitCost = Math.round(baseUnitCost * tierMultiplier);
```

**Budget Summary:**
```typescript
interface ConsolidatedEstimate {
  // ... existing fields

  budgetSummary?: {
    totalAllocated?: number;        // Sum of allocated budgets
    totalActual: number;            // Total estimate with tier multipliers
    variance: number;               // totalActual - totalAllocated
    variancePercent: number;        // (variance / totalAllocated) × 100
    itemsOverBudget: number;        // Count of items exceeding allocation
    budgetTier?: BudgetTier;        // Project budget tier
  };
}
```

### bottomUpPricingService.ts (Enhanced)

Strategy integration for A&E pricing.

**Key Exports:**
```typescript
// Inference functions
export function inferRoleFromDeliverableType(
  deliverableName: string,
  complexity?: string
): StaffRole;

export function inferStageFromDeliverableType(
  deliverableName: string
): PricingDesignStage;

export function estimateDeliverableHours(
  deliverableName: string,
  budgetTier?: BudgetTier,
  complexity?: string
): number;

export function inferDisciplineFromDeliverableType(
  deliverableName: string
): PricingDiscipline;

// Conversion functions
export function convertScopedDeliverablesToPricingDeliverables(
  scopedDeliverables: ScopedDeliverable[],
  budgetTier?: BudgetTier
): PricingDeliverable[];

export function prepopulateFromStrategy(
  scopedDeliverables: ScopedDeliverable[],
  budgetTier?: BudgetTier
): {
  disciplines: Array<{ discipline: PricingDiscipline; deliverables: PricingDeliverable[] }>;
  totalDeliverables: number;
  totalEstimatedHours: number;
};
```

---

## Components

### GuidedStrategyWorkflow.tsx

6-step guided workflow component.

**Props:**
```typescript
interface GuidedStrategyWorkflowProps {
  projectId: string;
  strategy: ProjectStrategy | null;
  onUpdate: (updates: Partial<ProjectStrategy>) => Promise<void>;
  onGenerateReport: () => void;
}
```

**State:**
```typescript
const [currentStep, setCurrentStep] = useState(0);
const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
```

**Steps:**
1. Project & Customer Info
2. Design Brief
3. Space & Budget
4. Challenges & Goals
5. Research & Insights
6. Review & Generate Report

**Validation:**
- Each step validates its section before allowing progression
- Progress sidebar shows completion status
- "Continue" button disabled until step is valid

### ValidationFeedback.tsx

Reusable validation UI components.

**Components:**
```typescript
// Validated input with inline errors
<ValidatedInput
  label="Total Area"
  value={totalArea}
  onChange={setTotalArea}
  error={validation.error}
  isValid={validation.isValid}
  required={true}
  helpText="The total project area in square meters"
/>

// Section completeness badge
<SectionCompletenessBadge completed={3} total={5} />

// Validation summary panel
<ValidationSummary
  validationResult={result}
  onDismiss={() => setShow(false)}
/>

// Help tooltip
<HelpTooltip content="Why is this required? ..." />
```

### SaveStatusIndicator.tsx

Visual save status with time ago display.

**Usage:**
```typescript
<SaveStatusIndicator
  saveStatus={saveStatus}
  lastSaved={lastSaved}
  showLabel={true}
/>
```

**States:**
- **idle**: No recent saves
- **saving**: Save in progress (spinner)
- **saved**: Recently saved (green checkmark, auto-hides after 2s)
- **error**: Save failed (red X, stays visible, retry button)

---

## Data Flow

### Strategy Creation Flow

```
1. User creates/opens project
   ↓
2. Load project strategy (if exists)
   ↓
3. Load customer intelligence (if customer linked)
   ↓
4. Show Strategy Canvas (guided or all sections)
   ↓
5. User fills sections with real-time validation
   ↓
6. Save to Firestore (auto-save every 2s if dirty)
   ↓
7. Update save status indicator
```

### AI Scoping Flow (Hybrid)

```
1. User enters design brief
   ↓
2. Click "Generate Scoping"
   ↓
3. Frontend calls projectScoping Cloud Function with:
   - briefText
   - projectId
   - strategyId (if available)
   ↓
4. Cloud Function:
   a. Fetch project strategy (if strategyId provided)
   b. Build StrategyAIContext
   c. STEP 1: Regex extraction (fast)
      - Extract quantities, room types, explicit items
      - Expand using ROOM_ONTOLOGY templates
   d. STEP 2: LLM enhancement (smart)
      - Validate regex results
      - Extract items regex missed
      - Suggest specifications
      - Flag ambiguities
   e. STEP 3: Confidence scoring
      - Calculate score for each deliverable
      - Add reasoning and ambiguities
   f. STEP 4: Strategy enrichment
      - Apply budget tier multipliers
      - Add strategyContext to deliverables
   ↓
5. Return scoped deliverables to frontend
   ↓
6. User reviews deliverables:
   - Green badges (high confidence): ✅ Accept
   - Yellow badges (medium): ⚠️ Review specs
   - Red badges (low): ❌ Clarify or remove
   ↓
7. User adds accepted deliverables to project
   ↓
8. DesignItems created with strategyContext attached
```

### Budget Tier Pricing Flow

```
1. DesignItem created with strategyContext.budgetTier
   ↓
2. Manufacturing/Procurement/Construction data entered
   ↓
3. Estimate calculation triggered
   ↓
4. For each item:
   a. Get base cost (manufacturing.totalCost, procurement.totalLandedCost, etc.)
   b. Get budget tier (item tier → project tier → standard fallback)
   c. Apply multiplier: adjustedCost = baseCost × BUDGET_TIER_MULTIPLIERS[tier]
   d. Calculate budget variance: variance = actualCost - allocatedBudget
   ↓
5. Aggregate budget summary:
   - totalAllocated = Σ(item.budgetTracking.allocatedBudget)
   - totalActual = Σ(adjusted costs with tier multipliers)
   - variance = totalActual - totalAllocated
   - variancePercent = (variance / totalAllocated) × 100
   - itemsOverBudget = count(item.budgetTracking.variance > 0)
   ↓
6. Return ConsolidatedEstimate with budgetSummary
```

### Constraint Validation Flow

```
1. User navigates to Design Items
   ↓
2. Load project strategy
   ↓
3. Load all design items for project
   ↓
4. Run constraint validation:
   validateDesignItemsAgainstStrategy(projectId, items, strategy)
   ↓
5. Parallel validation:
   - validateBudgetConstraints()
   - validateSpaceConstraints()
   - validateMaterialConstraints()
   - validateTimelineConstraints()
   - validateQualityConstraints()
   ↓
6. Aggregate violations:
   - Group by severity (critical, important, minor)
   - Sort by severity + type
   ↓
7. Display violations panel:
   - ❌ Critical: Red, blocking
   - ⚠️ Important: Yellow, warning
   - ℹ️ Minor: Blue, informational
   ↓
8. User clicks violation to jump to affected item(s)
   ↓
9. User fixes issue (edit item, adjust strategy, etc.)
   ↓
10. Re-validate automatically
```

---

## AI Integration

### Hybrid Regex + LLM Approach

The project scoping AI uses a hybrid approach for maximum accuracy:

**Why Hybrid?**
- **Regex alone**: Fast but brittle, misses natural language
- **LLM alone**: Accurate but slow and expensive
- **Hybrid**: Best of both worlds

**Implementation:**

```javascript
// functions/src/ai/projectScoping.js

// STEP 1: Regex extraction (fast, structured patterns)
function extractEntities(briefText) {
  const entities = {
    roomGroups: [],
    explicitItems: [],
    quantities: {},
  };

  // Pattern: "32 rooms, each with..."
  const roomPatterns = [
    { pattern: /(\d+)\s*guest\s*rooms?/gi, type: 'guest_room_standard' },
    { pattern: /(\d+)\s*suites?/gi, type: 'guest_room_suite' },
    // ...
  ];

  for (const { pattern, type } of roomPatterns) {
    let match;
    while ((match = pattern.exec(briefText)) !== null) {
      const qty = parseInt(match[1], 10);
      if (qty > 0) {
        entities.roomGroups.push({ type, quantity: qty, source: match[0] });
      }
    }
  }

  return entities;
}

// STEP 2: LLM enhancement (smart, catches edge cases)
const enhancementPrompt = `
You are a manufacturing expert. Review these regex-extracted deliverables.

REGEX-EXTRACTED: ${JSON.stringify(deliverables)}
STRATEGY CONTEXT: ${JSON.stringify(strategyContext)}
DESIGN BRIEF: ${briefText}

TASKS:
1. Validate regex results (are they accurate?)
2. Extract items regex missed (natural language descriptions)
3. Suggest specifications (dimensions, materials, finishes)
4. Flag ambiguities

Return JSON with:
{
  "validation": { regexAccuracy, duplicates, corrections },
  "llmExtractedItems": [{ name, category, quantity, reasoning, confidence }],
  "specifications": { itemType: { dimensions, material, finish, complexity } },
  "ambiguities": [{ itemType, question, severity }]
}
`;

const result = await model.generateContent(enhancementPrompt);
const aiEnhancement = JSON.parse(result.response.text);

// STEP 3: Merge results
// Regex deliverables + LLM-extracted items
// Apply specifications to all deliverables
// Calculate confidence scores with reasoning

// STEP 4: Strategy enrichment
for (const deliverable of deliverables) {
  deliverable.strategyContext = {
    budgetTier: strategyContext?.budgetFramework?.tier || 'standard',
    spaceMultiplier: deliverable.roomCount || 1,
    scopingConfidence: deliverable.aiMetadata.confidenceScore,
    deliverableType: deliverable.itemType,
  };
}
```

### Confidence Scoring Logic

```javascript
function calculateConfidence(deliverable, extractionMethod) {
  let score = 0.5; // Base
  const reasoning = [];
  const ambiguities = [];

  // Regex match: +0.25
  if (extractionMethod.method === 'regex') {
    score += 0.25;
    reasoning.push('Extracted via structured pattern matching');
  }

  // Template match: +0.15
  if (deliverable.roomType && ROOM_ONTOLOGY[deliverable.roomType]) {
    score += 0.15;
    reasoning.push(`Matched to ${ROOM_ONTOLOGY[deliverable.roomType].name} template`);
  }

  // Feature Library match: +0.1
  if (deliverable.manufacturing?.capabilityVerified) {
    score += 0.1;
    reasoning.push('Verified against Feature Library');
  } else if (deliverable.category === 'MANUFACTURED') {
    ambiguities.push('No Feature Library match - custom fabrication required');
  }

  // LLM validation: +0.1
  if (extractionMethod.llmValidated) {
    score += 0.1;
    reasoning.push('Validated by AI model');
  }

  // Penalties
  if (!deliverable.specifications?.dimensions) {
    score -= 0.05;
    ambiguities.push('Dimensions need clarification');
  }

  if (deliverable.itemType === 'custom') {
    score -= 0.15;
    ambiguities.push('Custom item requires detailed specification');
  }

  // Clamp to [0, 1]
  score = Math.max(0, Math.min(1, score));

  return {
    score: Math.round(score * 100) / 100,
    reasoning: reasoning.join('; '),
    ambiguities,
    extractionMethod: extractionMethod.method,
  };
}
```

---

## Feature Flags

All strategy features are controlled by feature flags for gradual rollout.

**Location:** `src/shared/constants/index.ts`

**Flags:**
```typescript
export const FEATURES = {
  STRATEGY_GUIDED_WORKFLOW: true,                    // 6-step workflow
  STRATEGY_VALIDATION_UI: true,                      // Real-time validation
  STRATEGY_SAVE_STATUS_INDICATORS: true,             // Enhanced save feedback
  STRATEGY_CUSTOMER_INTELLIGENCE_AUTO_POPULATE: true, // Auto-fill from customer data
  STRATEGY_BUDGET_TIER_PRICING: true,                // Tier multipliers in estimates
  STRATEGY_CONSTRAINT_VALIDATION: true,              // 5-type validation
  STRATEGY_BOTTOM_UP_PRICING_INTEGRATION: true,      // A&E pricing integration
  STRATEGY_LLM_SCOPING: false,                       // Hybrid AI (requires backend)
} as const;
```

**Usage:**
```typescript
import { useFeatureFlag } from '@/shared/hooks';

const isGuidedWorkflowEnabled = useFeatureFlag('STRATEGY_GUIDED_WORKFLOW');

if (isGuidedWorkflowEnabled) {
  return <GuidedStrategyWorkflow />;
}
```

**Rollout Strategy:**
1. **Week 1**: UI enhancements (validation, save status, guided workflow)
2. **Week 2**: Run migration + enable budget tier pricing
3. **Week 3**: Enable advanced features (constraints, bottom-up pricing)
4. **Future**: Backend upgrade + enable LLM scoping

---

## Testing

### Unit Tests

**Location:** `src/testing/unit/`

**Files:**
- `strategy-validation.test.ts` - Zod schema validation
- `budget-tier-pricing.test.ts` - Tier multiplier calculations
- `bottom-up-pricing-strategy.test.ts` - Strategy integration functions

**Run:**
```bash
npm run test:unit
```

**Coverage:**
- Validation schemas (SpaceParameters, BudgetFramework, ProjectContext)
- Budget tier multipliers and calculations
- Role/stage/discipline/hours inference
- Scoped deliverable conversion
- Edge cases and error handling

### Integration Tests

**Location:** `src/testing/integration/`

**Files:**
- `strategy-to-pricing.test.ts` - End-to-end strategy → estimate flow

**Run:**
```bash
npm run test:integration
```

**Coverage:**
- Budget tier application to manufactured/procured items
- Strategy context linkage
- Budget variance calculation
- Consolidated estimate with budget summary
- Mixed tiers in same project

### E2E Tests

**Location:** `e2e/` (if implemented)

**Scenarios:**
1. Create strategy with guided workflow
2. Run project scoping AI
3. Add scoped deliverables to project
4. Calculate estimate with tier pricing
5. Validate constraints
6. Generate strategy report

---

## Extending the System

### Adding a New Budget Tier

1. **Update type:**
   ```typescript
   // src/modules/design-manager/types/strategy.ts
   export type BudgetTier = 'economy' | 'standard' | 'premium' | 'luxury' | 'ultra-luxury';
   ```

2. **Add multiplier:**
   ```typescript
   export const BUDGET_TIER_MULTIPLIERS: Record<BudgetTier, number> = {
     economy: 0.7,
     standard: 1.0,
     premium: 1.5,
     luxury: 2.5,
     'ultra-luxury': 3.5,
   };
   ```

3. **Update validation schema:**
   ```typescript
   // src/modules/design-manager/services/strategyValidation.ts
   budgetTier: z.enum(['economy', 'standard', 'premium', 'luxury', 'ultra-luxury']).optional(),
   ```

4. **Update UI:**
   - Add option to BudgetFrameworkSection dropdown
   - Update tier descriptions
   - Update user guide

5. **Test:**
   - Add test cases for new tier
   - Verify estimate calculations
   - Check constraint validation

### Adding a New Constraint Type

1. **Define constraint interface:**
   ```typescript
   // src/modules/design-manager/services/constraintValidation.ts
   export function validateCustomConstraint(
     items: DesignItem[],
     strategy: ProjectStrategy | null
   ): ConstraintViolation[] {
     const violations: ConstraintViolation[] = [];

     // Your validation logic here

     return violations;
   }
   ```

2. **Integrate into main validator:**
   ```typescript
   export async function validateDesignItemsAgainstStrategy(
     projectId: string,
     items: DesignItem[],
     strategy: ProjectStrategy | null
   ): Promise<ValidationReport> {
     const budgetViolations = validateBudgetConstraints(items, strategy);
     const spaceViolations = validateSpaceConstraints(items, strategy);
     const materialViolations = validateMaterialConstraints(items, strategy);
     const timelineViolations = validateTimelineConstraints(items, strategy);
     const qualityViolations = validateQualityConstraints(items, strategy);
     const customViolations = validateCustomConstraint(items, strategy); // NEW

     return {
       isValid: allViolations.length === 0,
       violations: allViolations,
       byType: { budget, space, material, timeline, quality, custom }, // Add custom
       bySeverity: { critical, important, minor },
     };
   }
   ```

3. **Update UI:**
   - Add constraint type to violation display
   - Add icon/color for new constraint
   - Update user guide

4. **Test:**
   - Unit tests for new validation logic
   - Integration tests for constraint flow
   - E2E test for violation display

### Adding a New Validation Field

1. **Update Zod schema:**
   ```typescript
   // src/modules/design-manager/services/strategyValidation.ts
   export const CustomSectionSchema = z.object({
     newField: z.string().min(1, 'New field is required'),
     // ...
   });
   ```

2. **Update type:**
   ```typescript
   // src/modules/design-manager/types/strategy.ts
   export interface ProjectStrategy {
     // ...
     customSection?: {
       newField?: string;
     };
   }
   ```

3. **Update UI:**
   ```tsx
   // Add ValidatedInput in relevant component
   <ValidatedInput
     label="New Field"
     value={strategy.customSection?.newField || ''}
     onChange={(value) => handleUpdate({ customSection: { newField: value } })}
     error={validation.errors.newField}
     isValid={validation.isValid}
     required={true}
   />
   ```

4. **Test:**
   - Unit test for schema validation
   - Component test for UI
   - Integration test for save flow

---

## Performance Considerations

### Firestore Reads
- **Real-time listeners**: Only for active project strategy
- **Caching**: Use React Query or similar for customer intelligence
- **Pagination**: Not needed (strategy is single document)

### AI API Calls
- **Debouncing**: Scoping AI only triggered on explicit user action
- **Caching**: Feature Library cached in Firestore for 24h
- **Timeouts**: 180s timeout for scoping Cloud Function
- **Rate limiting**: 10 requests per user per minute

### Client-Side Validation
- **Debouncing**: Field validation debounced 300ms
- **Memoization**: useMemo for expensive calculations
- **Lazy loading**: Constraint validation only when panel opened

### Bundle Size
- **Code splitting**: Lazy load guided workflow vs all sections
- **Tree shaking**: Import only needed Zod schemas
- **Feature flags**: Exclude disabled features from bundle (if using vite plugin)

---

## Migration

Before enabling `STRATEGY_BUDGET_TIER_PRICING`, run the migration script to add strategy fields to existing design items.

**Command:**
```bash
# Dry run (preview)
npm run migrate:strategy:dry-run

# Execute
npm run migrate:strategy:execute

# Help
npm run migrate:strategy:help
```

**What it does:**
1. Fetches all projects
2. For each project, fetches project strategy (if exists)
3. For each design item:
   - Adds `strategyContext` with strategyId, budgetTier, spaceMultiplier, scopingConfidence
   - Adds `budgetTracking` with allocatedBudget=0, actualCost (estimated), variance
4. Batch writes (100 items per batch)
5. Prints summary report

**See:** `scripts/MIGRATION_GUIDE.md` for full details

---

## Support

**Documentation:**
- User Guide: `docs/strategy-canvas-user-guide.md`
- Feature Flags: `docs/FEATURE_FLAGS.md`
- Migration: `scripts/MIGRATION_GUIDE.md`
- Examples: `docs/examples/FeatureFlagExample.tsx`

**Commands:**
```bash
npm run features:list      # View feature flags
npm run migrate:strategy:help  # Migration guide
npm run test:unit          # Run unit tests
npm run test:integration   # Run integration tests
```

**Contact:**
- GitHub Issues: [Project Issues](https://github.com/yourusername/yourrepo/issues)
- Development Team: team@dawingroup.com

---

**Version:** 2.0
**Last Updated:** January 2026
