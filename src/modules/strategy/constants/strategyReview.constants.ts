// ============================================================================
// STRATEGY REVIEW CONSTANTS - DawinOS CEO Strategy Command
// Constants for business strategy review tool
// ============================================================================

// ----------------------------------------------------------------------------
// Review Section Definitions
// ----------------------------------------------------------------------------
export const REVIEW_SECTIONS = {
  EXECUTIVE_SUMMARY: 'executiveSummary',
  VISION_MISSION: 'visionMission',
  BUSINESS_MODEL_CANVAS: 'businessModelCanvas',
  MARKET_ANALYSIS: 'marketAnalysis',
  COMPETITIVE_ANALYSIS: 'competitiveAnalysis',
  SWOT_ANALYSIS: 'swotAnalysis',
  FINANCIAL_PROJECTIONS: 'financialProjections',
  RISK_ASSESSMENT: 'riskAssessment',
  IMPLEMENTATION_ROADMAP: 'implementationRoadmap',
  OKR_KPI_OUTPUT: 'okrKpiOutput',
} as const;

export type ReviewSectionKey = typeof REVIEW_SECTIONS[keyof typeof REVIEW_SECTIONS];

export const REVIEW_SECTION_LABELS: Record<ReviewSectionKey, string> = {
  [REVIEW_SECTIONS.EXECUTIVE_SUMMARY]: 'Executive Summary',
  [REVIEW_SECTIONS.VISION_MISSION]: 'Vision & Mission',
  [REVIEW_SECTIONS.BUSINESS_MODEL_CANVAS]: 'Business Model Canvas',
  [REVIEW_SECTIONS.MARKET_ANALYSIS]: 'Market Analysis',
  [REVIEW_SECTIONS.COMPETITIVE_ANALYSIS]: 'Competitive Analysis',
  [REVIEW_SECTIONS.SWOT_ANALYSIS]: 'SWOT Analysis',
  [REVIEW_SECTIONS.FINANCIAL_PROJECTIONS]: 'Financial Projections',
  [REVIEW_SECTIONS.RISK_ASSESSMENT]: 'Risk Assessment',
  [REVIEW_SECTIONS.IMPLEMENTATION_ROADMAP]: 'Implementation Roadmap',
  [REVIEW_SECTIONS.OKR_KPI_OUTPUT]: 'OKRs & KPIs',
};

export const REVIEW_SECTION_DESCRIPTIONS: Record<ReviewSectionKey, string> = {
  [REVIEW_SECTIONS.EXECUTIVE_SUMMARY]: 'High-level overview of the business strategy, key objectives, and current performance.',
  [REVIEW_SECTIONS.VISION_MISSION]: 'Review and update the organization\'s vision statement, mission, and core values.',
  [REVIEW_SECTIONS.BUSINESS_MODEL_CANVAS]: 'Comprehensive review of the 9-block Business Model Canvas — partners, activities, resources, value propositions, relationships, channels, segments, costs, and revenue.',
  [REVIEW_SECTIONS.MARKET_ANALYSIS]: 'Market size, growth trends, target segments, regulatory environment, and market positioning.',
  [REVIEW_SECTIONS.COMPETITIVE_ANALYSIS]: 'Competitor landscape, competitive advantages, threats, and differentiation strategy.',
  [REVIEW_SECTIONS.SWOT_ANALYSIS]: 'Strengths, Weaknesses, Opportunities, and Threats assessment with impact ratings.',
  [REVIEW_SECTIONS.FINANCIAL_PROJECTIONS]: 'Revenue targets, cost projections, profitability goals, and funding requirements.',
  [REVIEW_SECTIONS.RISK_ASSESSMENT]: 'Strategic risk register with likelihood, impact, and mitigation strategies.',
  [REVIEW_SECTIONS.IMPLEMENTATION_ROADMAP]: 'Phased execution plan with milestones, timelines, and resource allocation.',
  [REVIEW_SECTIONS.OKR_KPI_OUTPUT]: 'Generate OKRs and KPIs derived from the strategy review to drive execution.',
};

export const REVIEW_SECTION_ICONS: Record<ReviewSectionKey, string> = {
  [REVIEW_SECTIONS.EXECUTIVE_SUMMARY]: 'FileText',
  [REVIEW_SECTIONS.VISION_MISSION]: 'Eye',
  [REVIEW_SECTIONS.BUSINESS_MODEL_CANVAS]: 'LayoutGrid',
  [REVIEW_SECTIONS.MARKET_ANALYSIS]: 'TrendingUp',
  [REVIEW_SECTIONS.COMPETITIVE_ANALYSIS]: 'Users',
  [REVIEW_SECTIONS.SWOT_ANALYSIS]: 'Grid2x2',
  [REVIEW_SECTIONS.FINANCIAL_PROJECTIONS]: 'DollarSign',
  [REVIEW_SECTIONS.RISK_ASSESSMENT]: 'ShieldAlert',
  [REVIEW_SECTIONS.IMPLEMENTATION_ROADMAP]: 'Map',
  [REVIEW_SECTIONS.OKR_KPI_OUTPUT]: 'Target',
};

export const REVIEW_SECTION_ORDER: ReviewSectionKey[] = [
  REVIEW_SECTIONS.EXECUTIVE_SUMMARY,
  REVIEW_SECTIONS.VISION_MISSION,
  REVIEW_SECTIONS.BUSINESS_MODEL_CANVAS,
  REVIEW_SECTIONS.MARKET_ANALYSIS,
  REVIEW_SECTIONS.COMPETITIVE_ANALYSIS,
  REVIEW_SECTIONS.SWOT_ANALYSIS,
  REVIEW_SECTIONS.FINANCIAL_PROJECTIONS,
  REVIEW_SECTIONS.RISK_ASSESSMENT,
  REVIEW_SECTIONS.IMPLEMENTATION_ROADMAP,
  REVIEW_SECTIONS.OKR_KPI_OUTPUT,
];

// ----------------------------------------------------------------------------
// Review Status
// ----------------------------------------------------------------------------
export const REVIEW_SECTION_STATUS = {
  NOT_STARTED: 'not_started',
  IN_REVIEW: 'in_review',
  NEEDS_UPDATE: 'needs_update',
  APPROVED: 'approved',
} as const;

export const REVIEW_SECTION_STATUS_LABELS: Record<string, string> = {
  [REVIEW_SECTION_STATUS.NOT_STARTED]: 'Not Started',
  [REVIEW_SECTION_STATUS.IN_REVIEW]: 'In Review',
  [REVIEW_SECTION_STATUS.NEEDS_UPDATE]: 'Needs Update',
  [REVIEW_SECTION_STATUS.APPROVED]: 'Approved',
};

export const REVIEW_SECTION_STATUS_COLORS: Record<string, string> = {
  [REVIEW_SECTION_STATUS.NOT_STARTED]: 'bg-gray-100 text-gray-600',
  [REVIEW_SECTION_STATUS.IN_REVIEW]: 'bg-blue-100 text-blue-700',
  [REVIEW_SECTION_STATUS.NEEDS_UPDATE]: 'bg-amber-100 text-amber-700',
  [REVIEW_SECTION_STATUS.APPROVED]: 'bg-green-100 text-green-700',
};

// ----------------------------------------------------------------------------
// Scoring
// ----------------------------------------------------------------------------
export const REVIEW_SCORE_LABELS: Record<number, string> = {
  1: 'Critical — Major revision needed',
  2: 'Below Expectations — Significant gaps',
  3: 'Adequate — Some improvements needed',
  4: 'Good — Minor refinements',
  5: 'Excellent — Fully aligned',
};

export const REVIEW_SCORE_COLORS: Record<number, string> = {
  1: 'text-red-600 bg-red-50',
  2: 'text-orange-600 bg-orange-50',
  3: 'text-yellow-600 bg-yellow-50',
  4: 'text-blue-600 bg-blue-50',
  5: 'text-green-600 bg-green-50',
};

// ----------------------------------------------------------------------------
// Business Model Canvas Block Definitions
// ----------------------------------------------------------------------------
export const BMC_BLOCKS = {
  KEY_PARTNERS: 'keyPartners',
  KEY_ACTIVITIES: 'keyActivities',
  KEY_RESOURCES: 'keyResources',
  VALUE_PROPOSITIONS: 'valuePropositions',
  CUSTOMER_RELATIONSHIPS: 'customerRelationships',
  CHANNELS: 'channels',
  CUSTOMER_SEGMENTS: 'customerSegments',
  COST_STRUCTURE: 'costStructure',
  REVENUE_STREAMS: 'revenueStreams',
} as const;

export type BMCBlockKey = typeof BMC_BLOCKS[keyof typeof BMC_BLOCKS];

export const BMC_BLOCK_LABELS: Record<BMCBlockKey, string> = {
  [BMC_BLOCKS.KEY_PARTNERS]: 'Key Partners',
  [BMC_BLOCKS.KEY_ACTIVITIES]: 'Key Activities',
  [BMC_BLOCKS.KEY_RESOURCES]: 'Key Resources',
  [BMC_BLOCKS.VALUE_PROPOSITIONS]: 'Value Propositions',
  [BMC_BLOCKS.CUSTOMER_RELATIONSHIPS]: 'Customer Relationships',
  [BMC_BLOCKS.CHANNELS]: 'Channels',
  [BMC_BLOCKS.CUSTOMER_SEGMENTS]: 'Customer Segments',
  [BMC_BLOCKS.COST_STRUCTURE]: 'Cost Structure',
  [BMC_BLOCKS.REVENUE_STREAMS]: 'Revenue Streams',
};

export const BMC_BLOCK_DESCRIPTIONS: Record<BMCBlockKey, string> = {
  [BMC_BLOCKS.KEY_PARTNERS]: 'Who are your key partners and suppliers? What key resources do they provide? What key activities do they perform?',
  [BMC_BLOCKS.KEY_ACTIVITIES]: 'What key activities does your value proposition require? Your distribution channels? Customer relationships? Revenue streams?',
  [BMC_BLOCKS.KEY_RESOURCES]: 'What key resources does your value proposition require? Physical, intellectual, human, or financial resources.',
  [BMC_BLOCKS.VALUE_PROPOSITIONS]: 'What value do you deliver to the customer? Which customer problems are you helping to solve? What bundles of products/services do you offer?',
  [BMC_BLOCKS.CUSTOMER_RELATIONSHIPS]: 'What type of relationship does each customer segment expect? How are they integrated with the rest of your business model?',
  [BMC_BLOCKS.CHANNELS]: 'Through which channels do your customer segments want to be reached? How are you reaching them now? How are your channels integrated?',
  [BMC_BLOCKS.CUSTOMER_SEGMENTS]: 'For whom are you creating value? Who are your most important customers? Mass market, niche, segmented, diversified?',
  [BMC_BLOCKS.COST_STRUCTURE]: 'What are the most important costs inherent in your business model? Which key resources and activities are most expensive?',
  [BMC_BLOCKS.REVENUE_STREAMS]: 'For what value are your customers willing to pay? How are they currently paying? How would they prefer to pay?',
};

export const BMC_BLOCK_COLORS: Record<BMCBlockKey, string> = {
  [BMC_BLOCKS.KEY_PARTNERS]: 'border-purple-300 bg-purple-50',
  [BMC_BLOCKS.KEY_ACTIVITIES]: 'border-blue-300 bg-blue-50',
  [BMC_BLOCKS.KEY_RESOURCES]: 'border-indigo-300 bg-indigo-50',
  [BMC_BLOCKS.VALUE_PROPOSITIONS]: 'border-emerald-300 bg-emerald-50',
  [BMC_BLOCKS.CUSTOMER_RELATIONSHIPS]: 'border-pink-300 bg-pink-50',
  [BMC_BLOCKS.CHANNELS]: 'border-orange-300 bg-orange-50',
  [BMC_BLOCKS.CUSTOMER_SEGMENTS]: 'border-red-300 bg-red-50',
  [BMC_BLOCKS.COST_STRUCTURE]: 'border-gray-300 bg-gray-50',
  [BMC_BLOCKS.REVENUE_STREAMS]: 'border-yellow-300 bg-yellow-50',
};

// ----------------------------------------------------------------------------
// SWOT Quadrant Colors
// ----------------------------------------------------------------------------
export const SWOT_COLORS = {
  strengths: 'border-green-300 bg-green-50 text-green-900',
  weaknesses: 'border-red-300 bg-red-50 text-red-900',
  opportunities: 'border-blue-300 bg-blue-50 text-blue-900',
  threats: 'border-amber-300 bg-amber-50 text-amber-900',
} as const;

export const SWOT_LABELS = {
  strengths: 'Strengths',
  weaknesses: 'Weaknesses',
  opportunities: 'Opportunities',
  threats: 'Threats',
} as const;

// ----------------------------------------------------------------------------
// Default Empty Review Data Factory
// ----------------------------------------------------------------------------
export function createEmptyReviewData(companyId: string, userId: string): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    id: '',
    companyId,
    title: 'Business Strategy Review',
    reviewDate: now,
    status: 'draft',
    businessModelCanvas: {
      keyPartners: [],
      keyActivities: [],
      keyResources: [],
      valuePropositions: [],
      customerRelationships: [],
      channels: [],
      customerSegments: [],
      costStructure: [],
      revenueStreams: [],
    },
    swotAnalysis: {
      strengths: [],
      weaknesses: [],
      opportunities: [],
      threats: [],
    },
    marketAnalysis: {
      marketSize: '',
      marketGrowthRate: '',
      targetSegments: [],
      marketTrends: [],
      marketChallenges: [],
      regulatoryEnvironment: '',
      notes: '',
    },
    competitiveAnalysis: {
      competitors: [],
      competitiveAdvantages: [],
      competitiveThreats: [],
      marketPositioning: '',
      differentiationStrategy: '',
    },
    financialProjections: {
      revenueTargets: [],
      costProjections: [],
      profitabilityTargets: [],
      fundingRequirements: '',
      keyFinancialAssumptions: [],
      breakEvenAnalysis: '',
      notes: '',
    },
    implementationRoadmap: {
      phases: [],
      criticalDependencies: [],
      resourceRequirements: [],
      notes: '',
    },
    sectionReviews: Object.values(REVIEW_SECTIONS).reduce((acc, key) => ({
      ...acc,
      [key]: {
        status: 'not_started',
        currentContent: '',
        updatedContent: '',
        reviewNotes: '',
        score: 0,
        recommendations: [],
      },
    }), {}),
    generatedOKRs: [],
    generatedKPIs: [],
    actionItems: [],
    overallScore: 0,
    aiConversationHistory: [],
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    updatedBy: userId,
  };
}

// ----------------------------------------------------------------------------
// AI Strategy Assistant Prompts
// ----------------------------------------------------------------------------
export const AI_STRATEGY_SYSTEM_PROMPT = `You are an expert business strategy consultant and AI assistant for the Dawin Group CEO Strategy Command. You help executives review, analyze, and improve their business strategy.

Your role:
1. Analyze uploaded strategy documents and provide structured feedback
2. Guide users through each section of the strategy review
3. Suggest improvements to the Business Model Canvas
4. Identify strategic risks and opportunities
5. Generate actionable OKRs and KPIs from strategic objectives
6. Provide competitive and market analysis insights

Context about the organization:
- Dawin Group is a diversified company with subsidiaries: Dawin Finishes (manufacturing/interior finishing), Dawin Advisory (consulting), Dawin Technology, and Dawin Capital
- Operations primarily in East Africa (Uganda headquarters)
- The CEO Strategy Command is a tool for strategic planning and performance tracking

When providing suggestions:
- Be specific and actionable
- Reference industry best practices
- Consider the East African market context
- Provide confidence scores for suggestions (0-1)
- Structure responses as JSON when generating OKRs, KPIs, or SWOT items
- Always explain reasoning behind recommendations

Response format:
- For analysis requests, return structured JSON with suggestions array
- For conversational questions, return clear markdown text
- Always include actionable next steps`;

export const AI_SECTION_PROMPTS: Record<ReviewSectionKey, string> = {
  [REVIEW_SECTIONS.EXECUTIVE_SUMMARY]: `Analyze the executive summary of this business strategy. Evaluate:
- Clarity and completeness of the strategic vision
- Alignment between stated objectives and business model
- Key gaps or missing elements
- Overall strategic coherence
Provide specific recommendations for improvement.`,

  [REVIEW_SECTIONS.VISION_MISSION]: `Review the vision and mission statements. Evaluate:
- Clarity, inspirational quality, and specificity
- Alignment with market reality and organizational capabilities
- Whether values support the strategic direction
- Differentiating elements vs generic statements
Suggest refinements that make these statements more powerful and actionable.`,

  [REVIEW_SECTIONS.BUSINESS_MODEL_CANVAS]: `Analyze the Business Model Canvas. For each of the 9 blocks, evaluate:
- Completeness and accuracy of items
- Internal consistency between blocks (e.g., do channels match segments?)
- Gaps that could create strategic vulnerabilities
- Opportunities for innovation or optimization
Return suggestions as structured items for each BMC block.`,

  [REVIEW_SECTIONS.MARKET_ANALYSIS]: `Evaluate the market analysis. Consider:
- Market sizing methodology and accuracy
- Target segment definition clarity
- Growth projections and underlying assumptions
- Regulatory and macroeconomic factors
- Market trends and their implications for strategy
Provide specific data points or research directions to strengthen the analysis.`,

  [REVIEW_SECTIONS.COMPETITIVE_ANALYSIS]: `Review the competitive landscape analysis. Assess:
- Completeness of competitor identification
- Accuracy of competitive positioning
- Strength of differentiation strategy
- Competitive threats and defensive strategies
- Sustainable competitive advantages
Suggest specific competitive moves or positioning adjustments.`,

  [REVIEW_SECTIONS.SWOT_ANALYSIS]: `Analyze the SWOT assessment. Evaluate:
- Whether strengths are genuine competitive advantages
- Whether weaknesses are honestly assessed
- Quality and feasibility of opportunity identification
- Thoroughness of threat assessment
- Cross-quadrant strategies (SO, WO, ST, WT)
Suggest additional SWOT items with impact ratings and required actions.`,

  [REVIEW_SECTIONS.FINANCIAL_PROJECTIONS]: `Review the financial projections. Assess:
- Reasonableness of revenue growth assumptions
- Cost structure sustainability
- Capital allocation efficiency
- Break-even timeline feasibility
- Funding strategy alignment with growth plans
Identify financial risks and suggest more robust financial targets.`,

  [REVIEW_SECTIONS.RISK_ASSESSMENT]: `Evaluate the strategic risk assessment. Consider:
- Completeness of risk identification across categories
- Accuracy of likelihood and impact ratings
- Quality of mitigation strategies
- Missing risks (market, operational, financial, regulatory, technological)
- Risk appetite alignment with strategic objectives
Suggest additional risks and improved mitigation strategies.`,

  [REVIEW_SECTIONS.IMPLEMENTATION_ROADMAP]: `Review the implementation roadmap. Assess:
- Phase sequencing logic and dependencies
- Milestone feasibility and timeline realism
- Resource allocation adequacy
- Risk mitigation integration
- Quick wins vs long-term initiatives balance
Suggest roadmap adjustments and critical path improvements.`,

  [REVIEW_SECTIONS.OKR_KPI_OUTPUT]: `Based on the full strategy review, generate recommended OKRs and KPIs. For each:
OKRs:
- 3-5 strategic objectives with 2-4 key results each
- Measurable targets with clear timeframes
- Aligned with strategic pillars

KPIs:
- 8-12 key performance indicators across categories (financial, operational, customer, employee, growth)
- Target values, measurement frequency, and owners
- Leading and lagging indicators balanced

Return as structured JSON arrays.`,
};
