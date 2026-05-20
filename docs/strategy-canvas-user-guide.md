## # Strategy Canvas User Guide

**A comprehensive guide to using the enhanced Strategy Canvas for project planning and scoping.**

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Guided Workflow](#guided-workflow)
4. [Understanding Budget Tiers](#understanding-budget-tiers)
5. [AI-Powered Project Scoping](#ai-powered-project-scoping)
6. [Budget Tracking & Variance](#budget-tracking--variance)
7. [Constraint Validation](#constraint-validation)
8. [Bottom-Up Pricing Integration](#bottom-up-pricing-integration)
9. [Tips & Best Practices](#tips--best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Introduction

The Strategy Canvas is your central hub for defining project requirements, capturing client expectations, and generating accurate deliverable estimates. With the recent enhancements, it now features:

- **Guided 6-step workflow** to eliminate cognitive overload
- **Real-time validation** to catch errors before you save
- **AI confidence scoring** to highlight items needing clarification
- **Budget tier pricing** to align costs with client expectations
- **Constraint validation** to prevent scope creep and budget overruns

---

## Getting Started

### Accessing the Strategy Canvas

1. Navigate to a project in Design Manager
2. Click on the **"Strategy"** tab in the project navigation
3. You'll see the Strategy Canvas interface with two view options:
   - **Guided Workflow** (recommended for new users)
   - **All Sections** (for experienced users)

### Choosing Your View Mode

#### Guided Workflow (Recommended)
- Step-by-step progression through 6 logical sections
- Built-in validation at each step
- Progress indicators to track completion
- **Best for:** New projects, complex requirements, ensuring completeness

#### All Sections View
- All sections visible at once
- Collapse/expand sections as needed
- Section completeness badges
- **Best for:** Quick updates, experienced users, familiar projects

**💡 Tip:** You can switch between views at any time using the toggle in the top right.

---

## Guided Workflow

The guided workflow breaks down strategy creation into 6 manageable steps:

### Step 1: Project & Customer Info

**Purpose:** Capture essential project context

**What to enter:**
- **Project Type**: Hospitality, Office, Residential, Retail, Restaurant
- **Location**: City and country
- **Timeline**: Start and end dates
- **Customer Information**: If linked to a customer record, preferences auto-populate

**Customer Intelligence Auto-Population:**
If you have customer intelligence data, you'll see a notification banner:
> ✨ **Customer preferences available** - Apply material preferences, budget hints, and quality expectations to this strategy. [Apply Now]

Click "Apply Now" to automatically fill:
- Material preferences from customer history
- Budget tier inference from price sensitivity
- Quality expectations

**Required Fields:** Marked with a red asterisk (\*)
**Help Icons:** Hover over ℹ️ for explanations of why fields are required

### Step 2: Design Brief

**Purpose:** Capture the narrative description of the project

**What to enter:**
- Free-form text describing the project vision
- Client requirements and expectations
- Any specific constraints or challenges
- Reference materials or inspiration

**💡 Tip:** The more detail you provide here, the better the AI scoping will perform in Step 3.

### Step 3: Space & Budget

**Purpose:** Define physical and financial parameters

**Space Parameters:**
- **Total Area**: Enter the total project area
- **Area Unit**: Select sqm or sqft
- **Space Type**: Hotel, Office, Residential, etc.
- **Circulation %**: Percentage of space for hallways, corridors (typically 20-30%)

**Budget Framework:**
- **Budget Tier**: Economy, Standard, Premium, or Luxury
  - **Economy**: 0.7x standard pricing (cost-conscious projects)
  - **Standard**: 1.0x baseline pricing (most projects)
  - **Premium**: 1.5x standard pricing (high-quality projects)
  - **Luxury**: 2.5x standard pricing (ultra-high-end projects)
- **Target Budget**: Total budget amount in UGX
- **Priorities**: Quality, Timeline, Sustainability, Cost, etc.

**Validation:**
- Area must be greater than 0
- Circulation % must be between 0-100
- Budget amount must be positive

### Step 4: Challenges & Goals

**Purpose:** Identify potential issues and objectives

**What to enter:**
- **Pain Points**: Current challenges or problems to solve
- **Goals**: What success looks like for this project
- **Constraints**: Limitations (budget, timeline, materials, site conditions)
- **Risks**: Potential issues to mitigate

**💡 Tip:** This section helps the AI provide more contextual recommendations.

### Step 5: Research & Insights (Optional)

**Purpose:** Capture market research and trend analysis

**What to enter:**
- Trend insights from AI research (auto-generated if enabled)
- Competitor analysis
- Material/supplier research
- Design references

**💡 Tip:** Enable "Research Mode" in Project Scoping AI to get automatic trend insights.

### Step 6: Review & Generate Report

**Purpose:** Review all strategy data and generate documentation

**What you'll see:**
- Summary of all sections
- Completeness indicators
- Validation warnings
- Option to generate PDF strategy report

**Actions:**
- **Save Strategy**: Save current progress
- **Generate Report**: Create PDF summary
- **Export Data**: Download as JSON

**Progress Indicator:** Shows X/6 steps complete

---

## Understanding Budget Tiers

Budget tiers are the most powerful feature for aligning estimates with client expectations.

### How Budget Tiers Work

When you select a budget tier for your project, it automatically adjusts pricing across:
- **Manufactured items**: Materials, labor, finishing quality
- **Procured items**: Specification level, brand positioning
- **Design documents**: Time allocation, detail level, iterations

### Budget Tier Multipliers

| Tier | Multiplier | Use Case | Example |
|------|------------|----------|---------|
| **Economy** | 0.7x | Cost-conscious clients, basic finishes | Student housing, budget hotels |
| **Standard** | 1.0x | Mid-market projects, balanced quality | Corporate offices, standard hotels |
| **Premium** | 1.5x | High-quality materials, detailed craftsmanship | Boutique hotels, executive offices |
| **Luxury** | 2.5x | Ultra-high-end, bespoke everything | 5-star hotels, luxury residences |

### Example: How Tiers Affect Pricing

**Base Item:** Wardrobe (1 unit) - 100,000 UGX standard cost

- **Economy Tier**: 100,000 × 0.7 = **70,000 UGX**
  - Laminate finish, standard hardware, basic design
- **Standard Tier**: 100,000 × 1.0 = **100,000 UGX**
  - Melamine/veneer finish, good hardware, clean design
- **Premium Tier**: 100,000 × 1.5 = **150,000 UGX**
  - Natural wood veneer, premium hardware, custom details
- **Luxury Tier**: 100,000 × 2.5 = **250,000 UGX**
  - Solid wood/exotic veneer, luxury hardware, fully bespoke

### Setting the Right Budget Tier

**Ask yourself:**
1. What is the client's price sensitivity? (Low = luxury, High = economy)
2. What quality expectations did they express? (Basic vs. high-end)
3. What is the project positioning? (Mass market vs. boutique)
4. What materials did they request? (Laminate vs. solid wood)

**💡 Tip:** You can override the project tier for individual items if needed (e.g., luxury lobby furniture in a standard-tier hotel).

---

## AI-Powered Project Scoping

The Project Scoping AI uses a hybrid regex + LLM approach to extract deliverables from your design brief.

### How It Works

**Step 1: Regex Extraction (Fast)**
- Scans brief for structured patterns: "32 rooms, each with a wardrobe"
- Extracts quantities, room types, and explicit items
- Uses hospitality ontology for template expansion

**Step 2: LLM Enhancement (Smart)**
- Validates regex results for accuracy
- Catches items regex missed (natural language descriptions)
- Suggests specifications (dimensions, materials, finishes)
- Flags ambiguities requiring clarification

**Step 3: Strategy Enrichment**
- Applies budget tier from your strategy
- Uses material preferences to suggest finishes
- Adjusts quantity estimates based on space parameters
- Links deliverables to budget tracking

### Understanding Confidence Scores

Each extracted deliverable has a confidence score:

| Score | Badge | Meaning | Action |
|-------|-------|---------|--------|
| 0.80-1.00 | **High** (Green) | Regex + LLM validated, Feature Library matched | ✅ Ready to use |
| 0.60-0.79 | **Medium** (Yellow) | LLM extracted or missing specs | ⚠️ Review specifications |
| 0.00-0.59 | **Low** (Red) | Uncertain extraction or custom item | ❌ Requires clarification |

### Confidence Score Details

Click the info icon (ℹ️) next to a confidence badge to see:
- **Reasoning**: Why this score was assigned
- **Ambiguities**: What needs clarification
- **Extraction Method**: Regex, LLM, or Hybrid

**Example:**
> **Confidence: Medium (75%)**
> *Reasoning*: Extracted via structured pattern matching; Matched to Standard Guest Room template; Validated by AI model
> *Ambiguities*: Dimensions need clarification
> *Method*: hybrid-regex

### Improving Scoping Accuracy

**✅ DO:**
- Use structured language: "32 guest rooms, each with..."
- Specify quantities clearly: "2 nightstands per room"
- Mention room types: "standard room", "suite", "office"
- Reference materials: "timber wardrobe", "stone countertops"

**❌ AVOID:**
- Vague descriptions: "some furniture"
- Ambiguous quantities: "a few chairs"
- Missing context: "wardrobes" (how many? where?)

---

## Budget Tracking & Variance

Budget tracking helps you stay on target throughout the project lifecycle.

### How Budget Tracking Works

For each design item:
1. **Allocated Budget**: Target budget from strategy (set manually or via scoping hints)
2. **Actual Cost**: Calculated from manufacturing/procurement/construction data
3. **Variance**: Actual - Allocated (positive = over budget, negative = under)

### Budget Summary

At the estimate level, you'll see a consolidated budget summary:
- **Total Allocated**: Sum of all item budgets
- **Total Actual**: Total estimate (with tier multipliers applied)
- **Variance**: Overall difference
- **Variance %**: (Variance / Allocated) × 100
- **Items Over Budget**: Count of items exceeding allocation

### Example Budget Summary

```
📊 Budget Summary

Budget Tier: Premium (1.5x)
Total Allocated: 500,000,000 UGX
Total Actual:    512,000,000 UGX
Variance:        +12,000,000 UGX (+2.4%)
Items Over Budget: 3 of 42 items

⚠️ Action Required: Review items over budget
```

### Managing Budget Variance

**When Over Budget:**
1. **Review high-variance items**: Sort estimate by variance
2. **Consider tier adjustments**: Can some items use standard instead of premium?
3. **Renegotiate scope**: Remove or simplify items
4. **Value engineer**: Find cost-effective alternatives

**When Under Budget:**
1. **Reallocate savings**: Upgrade key items to next tier
2. **Add scope**: Include nice-to-have items
3. **Increase contingency**: Buffer for unknowns

---

## Constraint Validation

Constraint validation prevents issues before they become problems.

### Types of Constraints

#### 1. Budget Constraints
**Checks:**
- Total cost vs. target budget
- Item costs vs. allocated budgets
- Tier consistency with budget

**Violations:**
- Project 15% over target budget
- Wardrobe 20% over allocated budget

#### 2. Space Constraints
**Checks:**
- Item footprint vs. available space
- Total area vs. usable area (accounting for circulation %)
- Room capacity vs. furniture quantity

**Violations:**
- 32 wardrobes require 320 sqm, but only 250 sqm available
- Guest room furniture exceeds 40 sqm standard room size

#### 3. Material Constraints
**Checks:**
- Item materials vs. material preferences
- Item materials vs. avoid list
- Style alignment

**Violations:**
- Item uses plastic finish, but client prefers natural materials
- Item uses laminate, but strategy specifies timber

#### 4. Timeline Constraints
**Checks:**
- Lead times vs. project timeline
- Production capacity vs. quantity required
- Delivery dates vs. installation schedule

**Violations:**
- Custom items need 12 weeks, but project timeline is 8 weeks
- Procurement lead time exceeds project end date

#### 5. Quality Constraints
**Checks:**
- Finish quality vs. budget tier
- Specifications vs. quality expectations
- Material grade vs. tier

**Violations:**
- Economy-tier item in luxury project
- Basic finish when high-end specified

### Viewing Constraint Violations

Navigate to **Design Items** > **Constraint Validation** panel:

```
⚠️ 5 Constraint Violations Found

❌ Critical (1):
- Budget: Project 15% over target (7.5M UGX excess)

⚠️ Important (3):
- Space: 32 wardrobes exceed room capacity by 70 sqm
- Material: 12 items use laminate (client prefers timber)
- Timeline: Custom millwork lead time exceeds deadline by 4 weeks

ℹ️ Minor (1):
- Quality: 2 items below expected tier for project
```

### Fixing Violations

**Critical (❌):**
- Must fix before generating final estimate
- Blocks estimate approval

**Important (⚠️):**
- Should fix, but estimate can proceed
- Warn user before approval

**Minor (ℹ️):**
- Nice to fix, informational only
- No blocking

---

## Bottom-Up Pricing Integration

The Bottom-Up Pricing Calculator now integrates with your strategy for automatic population.

### How It Works

1. **Run Project Scoping AI** to generate scoped deliverables
2. Filter for **DESIGN_DOCUMENT** category items (A&E services)
3. **Automatically infer**:
   - Staff role (Principal, Senior Engineer, Mid-Level Architect, Junior Drafter)
   - Design stage (Concept, Schematic, Design Development, Construction Docs)
   - Estimated hours (based on deliverable type and budget tier)
4. **Group by discipline**: Architecture, Interior Design, MEP, Structural

### Using Strategy Integration

In the Bottom-Up Pricing Calculator:

1. Click **"Import from Strategy Scoping"**
2. Select deliverables to import (only DESIGN_DOCUMENT items shown)
3. Review auto-populated:
   - Deliverable names
   - Estimated hours (adjusted for budget tier)
   - Assigned roles and stages
4. Adjust as needed
5. Calculate pricing

### Budget Tier Impact on Hours

The calculator applies your budget tier multiplier to hour estimates:

**Example:** Floor Plans (base: 40 hours)
- **Economy**: 40 × 0.7 = 28 hours (less detail, faster)
- **Standard**: 40 × 1.0 = 40 hours (normal detail)
- **Premium**: 40 × 1.5 = 60 hours (more iterations, higher detail)
- **Luxury**: 40 × 2.5 = 100 hours (fully bespoke, extensive iterations)

---

## Tips & Best Practices

### 1. Start with the Guided Workflow
Even experienced users should use the guided workflow for new projects to ensure completeness.

### 2. Set Budget Tier Early
Choose your budget tier in Step 3 before running scoping AI. This ensures accurate hour estimates and pricing from the start.

### 3. Review AI Confidence Scores
Don't blindly accept deliverables with low confidence (<0.75). Click to see ambiguities and address them.

### 4. Use Customer Intelligence
If you have customer data, always click "Apply Customer Preferences" to save time and ensure alignment.

### 5. Validate Against Constraints
Run constraint validation before finalizing your estimate. Fix critical violations first.

### 6. Track Budget Variance Weekly
Check the budget summary weekly during the project. Catch overruns early when they're easier to fix.

### 7. Document Assumptions
Use the "Notes" fields to document assumptions, especially for low-confidence items. This helps during client reviews.

### 8. Keep Strategy Updated
As the project evolves, update your strategy. Changes automatically flow through to estimates and validation.

### 9. Generate Reports for Client Reviews
Use the "Generate Report" feature to create professional PDFs for client presentations.

### 10. Learn from Past Projects
Review completed projects' strategies to understand patterns in budget variance and scoping accuracy.

---

## Troubleshooting

### Q: The scoping AI missed items in my brief
**A:** The AI uses a hybrid approach, but it's not perfect. Check:
- Did you use clear, structured language? ("32 rooms with wardrobes" vs. "some storage")
- Are the items mentioned explicitly? Implied items may be missed
- Try rephrasing and re-running the scoping

You can always add missed items manually.

### Q: My budget variance is way off
**A:** Check:
1. Is the budget tier consistent across items and project strategy?
2. Have allocated budgets been set for all items?
3. Are actual costs up-to-date with latest manufacturing/procurement data?

### Q: Validation errors won't go away
**A:** For persistent validation errors:
1. Read the error message carefully - it tells you exactly what's wrong
2. Check required fields (marked with \*)
3. Ensure dates are in correct order (start before end)
4. Verify numeric values are positive and within ranges

### Q: Customer preferences didn't auto-populate
**A:** Ensure:
1. The customer record is linked to the project
2. Customer intelligence data exists for this customer
3. The feature flag `STRATEGY_CUSTOMER_INTELLIGENCE_AUTO_POPULATE` is enabled

### Q: Constraint validation shows false positives
**A:** Constraint validation uses heuristics. For false positives:
1. Verify your space parameters are correct (area, circulation %)
2. Check that material preferences are up-to-date
3. You can acknowledge and dismiss minor violations

### Q: Bottom-up pricing shows 0 deliverables
**A:** The integration only imports DESIGN_DOCUMENT category items. If you see 0:
1. Ensure your scoped deliverables include A&E services
2. Check that items are categorized correctly
3. Manually add deliverables if needed

---

## Need Help?

- **Feature Flags Documentation**: Run `npm run features:list`
- **Migration Guide**: See `scripts/MIGRATION_GUIDE.md`
- **Developer Guide**: See `docs/dev/strategy-architecture.md`
- **Contact Support**: Reach out to the development team

---

**Version:** 2.0
**Last Updated:** January 2026
**Feedback:** Report issues at [GitHub Issues](https://github.com/yourusername/yourrepo/issues)
