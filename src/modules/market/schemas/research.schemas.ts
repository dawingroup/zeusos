// ============================================================================
// MARKET RESEARCH SCHEMAS
// DawinOS v2.0 - Market Intelligence Module
// ============================================================================

import { z } from 'zod';
import {
  TREND_STATUS,
  TREND_CATEGORIES,
  TREND_BUSINESS_IMPACT,
  RESEARCH_REPORT_TYPES,
  PESTLE_SENTIMENT,
  TIME_HORIZONS,
  WATCH_STATUS,
  VELOCITY_LEVELS,
  CERTAINTY_LEVELS,
  PRIORITY_LEVELS,
  RESEARCH_SOURCE_TYPES,
  PERIOD_TYPES,
  CHART_TYPES,
} from '../constants/research.constants';
import { PESTLE_CATEGORIES } from '../constants/market.constants';

// ============================================================================
// HELPER SCHEMAS
// ============================================================================

const trendActionSchema = z.object({
  action: z.string().min(1).max(500),
  priority: z.enum(PRIORITY_LEVELS),
  timeline: z.string().max(100),
  owner: z.string().max(100).optional(),
});

const trendDataPointSchema = z.object({
  metric: z.string().min(1).max(200),
  value: z.string().min(1).max(200),
  source: z.string().min(1).max(200),
  date: z.date(),
});

const trendSourceSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url().optional().or(z.literal('')),
  type: z.string().max(100),
  publishDate: z.date().optional(),
});

const pestleSourceSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url().optional().or(z.literal('')),
  date: z.date().optional(),
});

const reportChartSchema = z.object({
  type: z.enum(CHART_TYPES),
  title: z.string().min(1).max(200),
  data: z.any(),
});

const reportSectionSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  order: z.number().int().min(0),
  charts: z.array(reportChartSchema).optional(),
});

const reportRecommendationSchema = z.object({
  recommendation: z.string().min(1).max(500),
  priority: z.enum(PRIORITY_LEVELS),
  timeline: z.string().max(100),
});

// ============================================================================
// INDUSTRY TREND SCHEMA
// ============================================================================

export const industryTrendSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  summary: z.string().min(10, 'Summary is required').max(500),
  
  category: z.enum([
    TREND_CATEGORIES.TECHNOLOGY,
    TREND_CATEGORIES.REGULATORY,
    TREND_CATEGORIES.CONSUMER,
    TREND_CATEGORIES.ECONOMIC,
    TREND_CATEGORIES.COMPETITIVE,
    TREND_CATEGORIES.DEMOGRAPHIC,
    TREND_CATEGORIES.ENVIRONMENTAL,
    TREND_CATEGORIES.POLITICAL,
  ]),
  status: z.enum([
    TREND_STATUS.EMERGING,
    TREND_STATUS.GROWING,
    TREND_STATUS.MATURE,
    TREND_STATUS.DECLINING,
    TREND_STATUS.STABLE,
  ]),
  businessImpact: z.enum([
    TREND_BUSINESS_IMPACT.OPPORTUNITY,
    TREND_BUSINESS_IMPACT.THREAT,
    TREND_BUSINESS_IMPACT.NEUTRAL,
    TREND_BUSINESS_IMPACT.MIXED,
  ]),
  
  segments: z.array(z.string()).min(1, 'At least one segment required'),
  regions: z.array(z.string()).default(['Uganda']),
  isUgandaSpecific: z.boolean().default(true),
  
  identifiedDate: z.date().default(() => new Date()),
  expectedPeakDate: z.date().optional(),
  timeHorizon: z.enum(TIME_HORIZONS),
  
  impactScore: z.number().min(1).max(10),
  certainty: z.enum(CERTAINTY_LEVELS),
  velocity: z.enum(VELOCITY_LEVELS),
  
  opportunities: z.array(z.string().max(500)).default([]),
  threats: z.array(z.string().max(500)).default([]),
  recommendedActions: z.array(trendActionSchema).default([]),
  
  dataPoints: z.array(trendDataPointSchema).default([]),
  sources: z.array(trendSourceSchema).default([]),
  
  watchStatus: z.enum(WATCH_STATUS).default('active'),
  lastReviewDate: z.date().optional(),
  nextReviewDate: z.date().optional(),
  
  relatedTrends: z.array(z.string()).optional(),
  affectedCompetitors: z.array(z.string()).optional(),
  
  tags: z.array(z.string()).default([]),
});

export type IndustryTrendInput = z.infer<typeof industryTrendSchema>;

export const industryTrendUpdateSchema = industryTrendSchema.partial();

export type IndustryTrendUpdate = z.infer<typeof industryTrendUpdateSchema>;

// ============================================================================
// PESTLE FACTOR SCHEMA
// ============================================================================

export const pestleFactorSchema = z.object({
  category: z.enum([
    PESTLE_CATEGORIES.POLITICAL,
    PESTLE_CATEGORIES.ECONOMIC,
    PESTLE_CATEGORIES.SOCIAL,
    PESTLE_CATEGORIES.TECHNOLOGICAL,
    PESTLE_CATEGORIES.LEGAL,
    PESTLE_CATEGORIES.ENVIRONMENTAL,
  ]),
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  
  sentiment: z.enum([
    PESTLE_SENTIMENT.POSITIVE,
    PESTLE_SENTIMENT.NEGATIVE,
    PESTLE_SENTIMENT.NEUTRAL,
    PESTLE_SENTIMENT.MIXED,
  ]),
  impactLevel: z.enum(PRIORITY_LEVELS),
  likelihood: z.enum(PRIORITY_LEVELS),
  
  timeframe: z.enum(['immediate', 'short_term', 'medium_term', 'long_term']),
  effectiveDate: z.date().optional(),
  
  affectedSegments: z.array(z.string()).default([]),
  affectedOperations: z.array(z.string()).default([]),
  riskScore: z.number().min(1).max(10),
  opportunityScore: z.number().min(1).max(10),
  
  currentResponse: z.string().max(1000).optional(),
  recommendedActions: z.array(z.string().max(500)).default([]),
  contingencyPlan: z.string().max(2000).optional(),
  
  sources: z.array(pestleSourceSchema).default([]),
  
  status: z.enum(WATCH_STATUS).default('active'),
});

export type PESTLEFactorInput = z.infer<typeof pestleFactorSchema>;

export const pestleFactorUpdateSchema = pestleFactorSchema.partial();

export type PESTLEFactorUpdate = z.infer<typeof pestleFactorUpdateSchema>;

// ============================================================================
// RESEARCH REPORT SCHEMA
// ============================================================================

export const researchReportSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  reportType: z.enum([
    RESEARCH_REPORT_TYPES.MARKET_SIZING,
    RESEARCH_REPORT_TYPES.COMPETITIVE_ANALYSIS,
    RESEARCH_REPORT_TYPES.INDUSTRY_OVERVIEW,
    RESEARCH_REPORT_TYPES.TREND_ANALYSIS,
    RESEARCH_REPORT_TYPES.CUSTOMER_INSIGHTS,
    RESEARCH_REPORT_TYPES.REGULATORY_UPDATE,
    RESEARCH_REPORT_TYPES.TECHNOLOGY_ASSESSMENT,
    RESEARCH_REPORT_TYPES.SWOT_ANALYSIS,
    RESEARCH_REPORT_TYPES.PESTLE_ANALYSIS,
    RESEARCH_REPORT_TYPES.OPPORTUNITY_ASSESSMENT,
  ]),
  
  executiveSummary: z.string().min(50, 'Executive summary must be at least 50 characters'),
  sections: z.array(reportSectionSchema).min(1, 'At least one section required'),
  
  segments: z.array(z.string()).min(1, 'At least one segment required'),
  competitors: z.array(z.string()).optional(),
  regions: z.array(z.string()).default(['Uganda']),
  timePeriod: z.object({
    start: z.date(),
    end: z.date(),
  }),
  
  keyFindings: z.array(z.string().max(500)).min(1, 'At least one key finding required'),
  recommendations: z.array(reportRecommendationSchema).default([]),
  
  reviewers: z.array(z.string()).default([]),
});

export type ResearchReportInput = z.infer<typeof researchReportSchema>;

export const researchReportUpdateSchema = researchReportSchema.partial();

export type ResearchReportUpdate = z.infer<typeof researchReportUpdateSchema>;

// ============================================================================
// MARKET INDICATOR SCHEMA
// ============================================================================

export const marketIndicatorSchema = z.object({
  indicatorId: z.string().min(1),
  indicatorName: z.string().min(1).max(200),
  
  value: z.number(),
  previousValue: z.number().optional(),
  
  period: z.string().min(1).max(50), // e.g., "2024-Q1", "2024-01"
  periodType: z.enum(PERIOD_TYPES),
  
  source: z.string().min(1).max(200),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  publishDate: z.date(),
  
  notes: z.string().max(1000).optional(),
});

export type MarketIndicatorInput = z.infer<typeof marketIndicatorSchema>;

// ============================================================================
// RESEARCH SOURCE SCHEMA
// ============================================================================

export const researchSourceSchema = z.object({
  name: z.string().min(2, 'Name is required').max(200),
  type: z.enum(RESEARCH_SOURCE_TYPES),
  url: z.string().url().optional().or(z.literal('')),
  
  credibilityScore: z.number().min(1).max(10),
  isVerified: z.boolean().default(false),
  
  segments: z.array(z.string()).default([]),
  regions: z.array(z.string()).default(['Uganda']),
  
  isSubscriptionRequired: z.boolean().default(false),
  subscriptionCost: z.number().positive().optional(),
  subscriptionCurrency: z.string().default('UGX'),
  
  notes: z.string().max(1000).optional(),
});

export type ResearchSourceInput = z.infer<typeof researchSourceSchema>;

export const researchSourceUpdateSchema = researchSourceSchema.partial();

export type ResearchSourceUpdate = z.infer<typeof researchSourceUpdateSchema>;
