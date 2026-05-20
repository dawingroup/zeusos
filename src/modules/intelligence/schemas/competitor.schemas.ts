// ============================================================================
// COMPETITOR SCHEMAS
// DawinOS v2.0 - Market Intelligence Module
// Zod validation schemas for Competitor Analysis
// ============================================================================

import { z } from 'zod';
import {
  COMPETITOR_TYPES,
  THREAT_LEVELS,
  COMPETITOR_STATUSES,
  INDUSTRIES,
  GEOGRAPHIES,
  COMPANY_SIZES,
  SWOT_FACTOR_TYPES,
  COMPETITIVE_MOVE_TYPES,
  IMPACT_SIGNIFICANCE,
  WIN_LOSS_OUTCOMES,
  WIN_LOSS_REASONS,
  INTELLIGENCE_SOURCES,
  ANALYSIS_PERIODS,
} from '../constants/competitor.constants';

// ----------------------------------------------------------------------------
// HELPER SCHEMAS
// ----------------------------------------------------------------------------

const competitorTypeSchema = z.enum([
  COMPETITOR_TYPES.DIRECT,
  COMPETITOR_TYPES.INDIRECT,
  COMPETITOR_TYPES.POTENTIAL,
  COMPETITOR_TYPES.SUBSTITUTE,
  COMPETITOR_TYPES.EMERGING,
  COMPETITOR_TYPES.DORMANT,
]);

const threatLevelSchema = z.enum([
  THREAT_LEVELS.MINIMAL,
  THREAT_LEVELS.LOW,
  THREAT_LEVELS.MODERATE,
  THREAT_LEVELS.HIGH,
  THREAT_LEVELS.CRITICAL,
]);

export const competitorStatusSchema = z.enum([
  COMPETITOR_STATUSES.ACTIVE,
  COMPETITOR_STATUSES.WATCHING,
  COMPETITOR_STATUSES.INACTIVE,
  COMPETITOR_STATUSES.ACQUIRED,
  COMPETITOR_STATUSES.BANKRUPT,
  COMPETITOR_STATUSES.MERGED,
  COMPETITOR_STATUSES.EXITED_MARKET,
]);

const industrySchema = z.enum([
  INDUSTRIES.INFRASTRUCTURE,
  INDUSTRIES.CONSTRUCTION,
  INDUSTRIES.REAL_ESTATE,
  INDUSTRIES.ADVISORY,
  INDUSTRIES.INVESTMENT,
  INDUSTRIES.PROCUREMENT,
  INDUSTRIES.HEALTHCARE,
  INDUSTRIES.AGRICULTURE,
  INDUSTRIES.FINANCIAL_SERVICES,
  INDUSTRIES.TECHNOLOGY,
  INDUSTRIES.TELECOMMUNICATIONS,
  INDUSTRIES.ENERGY,
  INDUSTRIES.MANUFACTURING,
  INDUSTRIES.EDUCATION,
  INDUSTRIES.TRANSPORT,
  INDUSTRIES.MINING,
]);

const geographySchema = z.enum([
  GEOGRAPHIES.UGANDA,
  GEOGRAPHIES.KENYA,
  GEOGRAPHIES.TANZANIA,
  GEOGRAPHIES.RWANDA,
  GEOGRAPHIES.ETHIOPIA,
  GEOGRAPHIES.DRC,
  GEOGRAPHIES.SOUTH_SUDAN,
  GEOGRAPHIES.BURUNDI,
  GEOGRAPHIES.EAST_AFRICA,
  GEOGRAPHIES.WEST_AFRICA,
  GEOGRAPHIES.SOUTHERN_AFRICA,
  GEOGRAPHIES.NORTH_AFRICA,
  GEOGRAPHIES.PAN_AFRICA,
  GEOGRAPHIES.GLOBAL,
]);

const companySizeSchema = z.enum([
  COMPANY_SIZES.STARTUP,
  COMPANY_SIZES.SMALL,
  COMPANY_SIZES.MEDIUM,
  COMPANY_SIZES.LARGE,
  COMPANY_SIZES.ENTERPRISE,
  COMPANY_SIZES.MULTINATIONAL,
]);

const swotFactorTypeSchema = z.enum([
  // Strengths
  SWOT_FACTOR_TYPES.BRAND_RECOGNITION,
  SWOT_FACTOR_TYPES.MARKET_SHARE,
  SWOT_FACTOR_TYPES.FINANCIAL_STRENGTH,
  SWOT_FACTOR_TYPES.TECHNOLOGY_CAPABILITY,
  SWOT_FACTOR_TYPES.TALENT_POOL,
  SWOT_FACTOR_TYPES.CUSTOMER_BASE,
  SWOT_FACTOR_TYPES.OPERATIONAL_EFFICIENCY,
  SWOT_FACTOR_TYPES.PRODUCT_QUALITY,
  SWOT_FACTOR_TYPES.DISTRIBUTION_NETWORK,
  SWOT_FACTOR_TYPES.PARTNERSHIPS,
  // Weaknesses
  SWOT_FACTOR_TYPES.LIMITED_RESOURCES,
  SWOT_FACTOR_TYPES.WEAK_BRAND,
  SWOT_FACTOR_TYPES.HIGH_COSTS,
  SWOT_FACTOR_TYPES.POOR_TECHNOLOGY,
  SWOT_FACTOR_TYPES.TALENT_GAPS,
  SWOT_FACTOR_TYPES.CUSTOMER_SERVICE,
  SWOT_FACTOR_TYPES.LIMITED_REACH,
  SWOT_FACTOR_TYPES.QUALITY_ISSUES,
  SWOT_FACTOR_TYPES.MANAGEMENT_ISSUES,
  SWOT_FACTOR_TYPES.FINANCIAL_CONSTRAINTS,
  // Opportunities
  SWOT_FACTOR_TYPES.MARKET_GROWTH,
  SWOT_FACTOR_TYPES.NEW_MARKETS,
  SWOT_FACTOR_TYPES.TECHNOLOGY_ADOPTION,
  SWOT_FACTOR_TYPES.REGULATORY_CHANGES,
  SWOT_FACTOR_TYPES.PARTNERSHIP_OPPORTUNITIES,
  SWOT_FACTOR_TYPES.ACQUISITION_TARGETS,
  SWOT_FACTOR_TYPES.TALENT_AVAILABILITY,
  SWOT_FACTOR_TYPES.COMPETITOR_WEAKNESS,
  SWOT_FACTOR_TYPES.ECONOMIC_CONDITIONS,
  SWOT_FACTOR_TYPES.INNOVATION_POTENTIAL,
  // Threats
  SWOT_FACTOR_TYPES.NEW_ENTRANTS,
  SWOT_FACTOR_TYPES.PRICE_COMPETITION,
  SWOT_FACTOR_TYPES.REGULATORY_RISK,
  SWOT_FACTOR_TYPES.TECHNOLOGY_DISRUPTION,
  SWOT_FACTOR_TYPES.ECONOMIC_DOWNTURN,
  SWOT_FACTOR_TYPES.TALENT_COMPETITION,
  SWOT_FACTOR_TYPES.SUPPLIER_ISSUES,
  SWOT_FACTOR_TYPES.CUSTOMER_PREFERENCES,
  SWOT_FACTOR_TYPES.POLITICAL_INSTABILITY,
  SWOT_FACTOR_TYPES.SUBSTITUTE_PRODUCTS,
]);

const competitiveMoveTypeSchema = z.enum([
  COMPETITIVE_MOVE_TYPES.PRODUCT_LAUNCH,
  COMPETITIVE_MOVE_TYPES.PRICE_CHANGE,
  COMPETITIVE_MOVE_TYPES.MARKET_ENTRY,
  COMPETITIVE_MOVE_TYPES.MARKET_EXIT,
  COMPETITIVE_MOVE_TYPES.ACQUISITION,
  COMPETITIVE_MOVE_TYPES.PARTNERSHIP,
  COMPETITIVE_MOVE_TYPES.LEADERSHIP_CHANGE,
  COMPETITIVE_MOVE_TYPES.FUNDING_ROUND,
  COMPETITIVE_MOVE_TYPES.EXPANSION,
  COMPETITIVE_MOVE_TYPES.RESTRUCTURING,
  COMPETITIVE_MOVE_TYPES.MARKETING_CAMPAIGN,
  COMPETITIVE_MOVE_TYPES.TECHNOLOGY_LAUNCH,
  COMPETITIVE_MOVE_TYPES.REGULATORY_FILING,
  COMPETITIVE_MOVE_TYPES.IPO_LISTING,
  COMPETITIVE_MOVE_TYPES.TALENT_HIRE,
]);

const impactSignificanceSchema = z.enum([
  IMPACT_SIGNIFICANCE.NEGLIGIBLE,
  IMPACT_SIGNIFICANCE.MINOR,
  IMPACT_SIGNIFICANCE.MODERATE,
  IMPACT_SIGNIFICANCE.SIGNIFICANT,
  IMPACT_SIGNIFICANCE.MAJOR,
  IMPACT_SIGNIFICANCE.TRANSFORMATIVE,
]);

const winLossOutcomeSchema = z.enum([
  WIN_LOSS_OUTCOMES.WON,
  WIN_LOSS_OUTCOMES.LOST,
  WIN_LOSS_OUTCOMES.NO_DECISION,
  WIN_LOSS_OUTCOMES.PARTIAL_WIN,
  WIN_LOSS_OUTCOMES.WALKED_AWAY,
  WIN_LOSS_OUTCOMES.PENDING,
]);

const winLossReasonSchema = z.enum([
  WIN_LOSS_REASONS.PRICE,
  WIN_LOSS_REASONS.QUALITY,
  WIN_LOSS_REASONS.RELATIONSHIP,
  WIN_LOSS_REASONS.CAPABILITY,
  WIN_LOSS_REASONS.TIMING,
  WIN_LOSS_REASONS.EXPERIENCE,
  WIN_LOSS_REASONS.INNOVATION,
  WIN_LOSS_REASONS.SERVICE_LEVEL,
  WIN_LOSS_REASONS.REFERENCES,
  WIN_LOSS_REASONS.LOCAL_PRESENCE,
  WIN_LOSS_REASONS.FINANCING,
  WIN_LOSS_REASONS.RISK_PERCEPTION,
  WIN_LOSS_REASONS.POLITICAL,
  WIN_LOSS_REASONS.TECHNOLOGY,
  WIN_LOSS_REASONS.OTHER,
]);

const intelligenceSourceSchema = z.enum([
  INTELLIGENCE_SOURCES.PUBLIC_FILING,
  INTELLIGENCE_SOURCES.NEWS_ARTICLE,
  INTELLIGENCE_SOURCES.INDUSTRY_REPORT,
  INTELLIGENCE_SOURCES.FIELD_INTELLIGENCE,
  INTELLIGENCE_SOURCES.CUSTOMER_FEEDBACK,
  INTELLIGENCE_SOURCES.EMPLOYEE_INTEL,
  INTELLIGENCE_SOURCES.TRADE_SHOW,
  INTELLIGENCE_SOURCES.SOCIAL_MEDIA,
  INTELLIGENCE_SOURCES.WEBSITE,
  INTELLIGENCE_SOURCES.PRESS_RELEASE,
  INTELLIGENCE_SOURCES.REGULATORY_FILING,
  INTELLIGENCE_SOURCES.ANALYST_REPORT,
  INTELLIGENCE_SOURCES.PATENT_FILING,
  INTELLIGENCE_SOURCES.JOB_POSTING,
  INTELLIGENCE_SOURCES.OTHER,
]);

const analysisPeriodSchema = z.enum([
  ANALYSIS_PERIODS.MONTHLY,
  ANALYSIS_PERIODS.QUARTERLY,
  ANALYSIS_PERIODS.SEMI_ANNUAL,
  ANALYSIS_PERIODS.ANNUAL,
]);

// ----------------------------------------------------------------------------
// COMPETITOR SCHEMAS
// ----------------------------------------------------------------------------

export const keyExecutiveSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  title: z.string().min(1, 'Title is required').max(100),
  linkedInUrl: z.string().url('Invalid LinkedIn URL').optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  previousCompanies: z.array(z.string()).optional(),
  notes: z.string().max(500).optional(),
});

export const headquartersSchema = z.object({
  city: z.string().min(1, 'City is required').max(100),
  country: z.string().min(1, 'Country is required').max(100),
  address: z.string().max(200).optional(),
  region: z.string().max(100).optional(),
});

export const positionScoreSchema = z.object({
  dimension: z.string(),
  score: z.number().min(1).max(10),
  notes: z.string().max(500).optional(),
});

export const competitorFormInputSchema = z.object({
  name: z.string()
    .min(1, 'Company name is required')
    .max(200, 'Name too long'),
  legalName: z.string().max(200).optional(),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description too long'),
  website: z.string()
    .url('Invalid website URL')
    .optional()
    .or(z.literal('')),
  type: competitorTypeSchema,
  threatLevel: threatLevelSchema,
  industries: z.array(industrySchema)
    .min(1, 'Select at least one industry'),
  geographies: z.array(geographySchema)
    .min(1, 'Select at least one geography'),
  companySize: companySizeSchema,
  estimatedRevenue: z.number().positive().optional(),
  revenueCurrency: z.string().default('USD'),
  employeeCount: z.number().int().positive().optional(),
  headquarters: headquartersSchema,
  foundedYear: z.number()
    .int()
    .min(1800)
    .max(new Date().getFullYear())
    .optional(),
  products: z.array(z.string().max(100)),
  services: z.array(z.string().max(100)),
  subsidiariesCompeting: z.array(z.string()),
  monitoringFrequency: z.enum(['weekly', 'monthly', 'quarterly']),
});

// ----------------------------------------------------------------------------
// SWOT SCHEMAS
// ----------------------------------------------------------------------------

export const swotFactorInputSchema = z.object({
  factorType: swotFactorTypeSchema,
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description too long'),
  impact: z.number()
    .min(1, 'Impact must be between 1-5')
    .max(5, 'Impact must be between 1-5'),
  timeframe: z.enum(['immediate', 'short_term', 'medium_term', 'long_term']),
  confidence: z.number()
    .min(0, 'Confidence must be between 0-100')
    .max(100, 'Confidence must be between 0-100'),
});

export const swotFormInputSchema = z.object({
  competitorId: z.string().min(1, 'Competitor is required'),
  analysisPeriod: analysisPeriodSchema,
  strengths: z.array(swotFactorInputSchema),
  weaknesses: z.array(swotFactorInputSchema),
  opportunities: z.array(swotFactorInputSchema),
  threats: z.array(swotFactorInputSchema),
  overallAssessment: z.string()
    .min(50, 'Assessment must be at least 50 characters')
    .max(2000, 'Assessment too long'),
  strategicImplications: z.array(z.string().min(10).max(500))
    .min(1, 'Add at least one strategic implication'),
  recommendedActions: z.array(z.string().min(10).max(500))
    .min(1, 'Add at least one recommended action'),
}).refine(
  (data) => 
    data.strengths.length + data.weaknesses.length + 
    data.opportunities.length + data.threats.length >= 4,
  {
    message: 'Add at least 4 SWOT factors total',
    path: ['strengths'],
  }
);

// ----------------------------------------------------------------------------
// COMPETITIVE MOVE SCHEMAS
// ----------------------------------------------------------------------------

export const competitiveMoveFormInputSchema = z.object({
  competitorId: z.string().min(1, 'Competitor is required'),
  moveType: competitiveMoveTypeSchema,
  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title too long'),
  description: z.string()
    .min(20, 'Description must be at least 20 characters')
    .max(2000, 'Description too long'),
  dateObserved: z.date(),
  impactSignificance: impactSignificanceSchema,
  impactedMarkets: z.array(geographySchema),
  impactedIndustries: z.array(industrySchema),
  impactedSubsidiaries: z.array(z.string()),
  strategicImplications: z.array(z.string().min(10).max(500)),
});

// ----------------------------------------------------------------------------
// WIN/LOSS SCHEMAS
// ----------------------------------------------------------------------------

export const winLossFormInputSchema = z.object({
  opportunityName: z.string()
    .min(3, 'Opportunity name is required')
    .max(200, 'Name too long'),
  clientName: z.string()
    .min(1, 'Client name is required')
    .max(200, 'Name too long'),
  projectType: z.string().min(1, 'Project type is required'),
  estimatedValue: z.number()
    .positive('Value must be positive'),
  currency: z.string().default('USD'),
  competitorName: z.string()
    .min(1, 'Competitor name is required')
    .max(200, 'Name too long'),
  competitorId: z.string().optional(),
  additionalCompetitors: z.array(z.string().max(200)),
  outcome: winLossOutcomeSchema,
  decisionDate: z.date(),
  primaryReasons: z.array(winLossReasonSchema)
    .min(1, 'Select at least one primary reason'),
  secondaryReasons: z.array(winLossReasonSchema),
  detailedAnalysis: z.string()
    .min(50, 'Analysis must be at least 50 characters')
    .max(5000, 'Analysis too long'),
  clientFeedback: z.string().max(2000).optional(),
  internalLessons: z.array(z.string().min(10).max(500)),
  improvementActions: z.array(z.string().min(10).max(500)),
  dawinSubsidiary: z.string().min(1, 'Subsidiary is required'),
});

// ----------------------------------------------------------------------------
// MARKET SHARE SCHEMAS
// ----------------------------------------------------------------------------

export const marketShareEntrySchema = z.object({
  companyName: z.string().min(1).max(200),
  competitorId: z.string().optional(),
  marketShare: z.number().min(0).max(100),
  revenue: z.number().positive().optional(),
  rank: z.number().int().positive(),
  isEstimate: z.boolean(),
  notes: z.string().max(500).optional(),
});

export const marketShareFormInputSchema = z.object({
  marketName: z.string().min(1).max(200),
  industry: industrySchema,
  geography: geographySchema,
  year: z.number().int().min(2000).max(2100),
  quarter: z.number().int().min(1).max(4).optional(),
  totalMarketSize: z.number().positive(),
  marketSizeCurrency: z.string().default('USD'),
  marketGrowthRate: z.number(),
  shares: z.array(marketShareEntrySchema)
    .min(2, 'Add at least 2 market share entries'),
  methodology: z.string().min(20).max(1000),
  confidence: z.number().min(0).max(100),
}).refine(
  (data) => {
    const totalShare = data.shares.reduce((sum, s) => sum + s.marketShare, 0);
    return totalShare <= 100;
  },
  {
    message: 'Total market share cannot exceed 100%',
    path: ['shares'],
  }
);

// ----------------------------------------------------------------------------
// PRICING INTELLIGENCE SCHEMAS
// ----------------------------------------------------------------------------

export const pricingIntelligenceFormInputSchema = z.object({
  competitorId: z.string().min(1),
  productService: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  pricePoint: z.number().positive(),
  currency: z.string().default('USD'),
  pricingModel: z.enum([
    'fixed', 'hourly', 'daily', 'project', 
    'retainer', 'subscription', 'cost_plus', 'value_based'
  ]),
  priceUnit: z.string().max(50).optional(),
  priceRangeLow: z.number().positive().optional(),
  priceRangeHigh: z.number().positive().optional(),
  ourPrice: z.number().positive().optional(),
  volumeDiscounts: z.string().max(500).optional(),
  paymentTerms: z.string().max(500).optional(),
  inclusions: z.array(z.string().max(200)),
  exclusions: z.array(z.string().max(200)),
  source: intelligenceSourceSchema,
  sourceDetails: z.string().max(500).optional(),
  confidence: z.number().min(0).max(100),
}).refine(
  (data) => !data.priceRangeLow || !data.priceRangeHigh || 
    data.priceRangeLow <= data.priceRangeHigh,
  {
    message: 'Price range low must be less than or equal to high',
    path: ['priceRangeLow'],
  }
);

// ----------------------------------------------------------------------------
// INTELLIGENCE ITEM SCHEMA
// ----------------------------------------------------------------------------

export const intelligenceItemSchema = z.object({
  source: intelligenceSourceSchema,
  sourceUrl: z.string().url().optional().or(z.literal('')),
  sourceName: z.string().max(200).optional(),
  title: z.string().min(1).max(200),
  summary: z.string().min(10).max(2000),
  reliability: z.number().min(0).max(100),
  tags: z.array(z.string().max(50)),
});

// ----------------------------------------------------------------------------
// EXPORT TYPE INFERENCE
// ----------------------------------------------------------------------------

export type CompetitorFormInputSchema = z.infer<typeof competitorFormInputSchema>;
export type SWOTFormInputSchema = z.infer<typeof swotFormInputSchema>;
export type SWOTFactorInputSchema = z.infer<typeof swotFactorInputSchema>;
export type CompetitiveMoveFormInputSchema = z.infer<typeof competitiveMoveFormInputSchema>;
export type WinLossFormInputSchema = z.infer<typeof winLossFormInputSchema>;
export type MarketShareFormInputSchema = z.infer<typeof marketShareFormInputSchema>;
export type MarketShareEntrySchema = z.infer<typeof marketShareEntrySchema>;
export type PricingIntelligenceFormInputSchema = z.infer<typeof pricingIntelligenceFormInputSchema>;
export type IntelligenceItemSchema = z.infer<typeof intelligenceItemSchema>;
export type KeyExecutiveSchema = z.infer<typeof keyExecutiveSchema>;
