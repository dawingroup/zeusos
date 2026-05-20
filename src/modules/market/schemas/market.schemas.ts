// ============================================================================
// MARKET INTELLIGENCE SCHEMAS
// DawinOS v2.0 - Market Intelligence Module
// ============================================================================

import { z } from 'zod';
import {
  COMPETITOR_STATUS,
  THREAT_LEVELS,
  INTELLIGENCE_SOURCES,
  SIGNAL_TYPES,
  IMPACT_LEVELS,
  PESTLE_CATEGORIES,
  CONFIDENCE_LEVELS,
  RELEVANCE_LEVELS,
  TIMEFRAMES,
  IMPORTANCE_LEVELS,
} from '../constants/market.constants';

// Key Person Schema
const keyPersonSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(100),
  linkedIn: z.string().url().optional().or(z.literal('')),
});

// Product Schema
const productSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200),
  description: z.string().max(500),
  category: z.string().max(100),
  pricing: z.string().max(200).optional(),
});

// Funding Round Schema
const fundingRoundSchema = z.object({
  date: z.date(),
  amount: z.number().positive(),
  type: z.string().max(50),
  investors: z.array(z.string()).optional(),
});

// Social Media Schema
const socialMediaSchema = z.object({
  linkedin: z.string().url().optional().or(z.literal('')),
  twitter: z.string().url().optional().or(z.literal('')),
  facebook: z.string().url().optional().or(z.literal('')),
  instagram: z.string().url().optional().or(z.literal('')),
});

// Competitor Schema
export const competitorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  legalName: z.string().max(200).optional(),
  description: z.string().max(2000),
  website: z.string().url().optional().or(z.literal('')),
  
  status: z.enum([
    COMPETITOR_STATUS.ACTIVE,
    COMPETITOR_STATUS.MONITORING,
    COMPETITOR_STATUS.EMERGING,
    COMPETITOR_STATUS.DECLINING,
    COMPETITOR_STATUS.INACTIVE,
  ]).default(COMPETITOR_STATUS.MONITORING),
  
  threatLevel: z.enum([
    THREAT_LEVELS.CRITICAL,
    THREAT_LEVELS.HIGH,
    THREAT_LEVELS.MEDIUM,
    THREAT_LEVELS.LOW,
    THREAT_LEVELS.MINIMAL,
  ]).default(THREAT_LEVELS.MEDIUM),
  
  segments: z.array(z.string()).min(1, 'At least one segment required'),
  
  headquarters: z.string().min(1, 'Headquarters is required').max(100),
  locations: z.array(z.string()).optional(),
  ugandaPresence: z.boolean().default(false),
  
  employeeCount: z.number().positive().optional(),
  estimatedRevenue: z.number().positive().optional(),
  revenueCurrency: z.string().default('UGX'),
  marketShare: z.number().min(0).max(100).optional(),
  
  foundedYear: z.number().min(1800).max(new Date().getFullYear()).optional(),
  founders: z.array(z.string()).optional(),
  ceoName: z.string().max(100).optional(),
  keyPeople: z.array(keyPersonSchema).optional(),
  
  products: z.array(productSchema).default([]),
  
  strengths: z.array(z.string().max(500)).default([]),
  weaknesses: z.array(z.string().max(500)).default([]),
  differentiators: z.array(z.string().max(500)).default([]),
  
  fundingTotal: z.number().positive().optional(),
  fundingRounds: z.array(fundingRoundSchema).optional(),
  
  socialMedia: socialMediaSchema.optional(),
  
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string()).optional(),
});

export type CompetitorInput = z.infer<typeof competitorSchema>;

// Competitor Update Schema
export const competitorUpdateSchema = competitorSchema.partial();

export type CompetitorUpdate = z.infer<typeof competitorUpdateSchema>;

// Market Signal Schema
export const marketSignalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(2000),
  
  signalType: z.enum([
    SIGNAL_TYPES.PRODUCT_LAUNCH,
    SIGNAL_TYPES.PRICING_CHANGE,
    SIGNAL_TYPES.EXPANSION,
    SIGNAL_TYPES.PARTNERSHIP,
    SIGNAL_TYPES.FUNDING,
    SIGNAL_TYPES.LEADERSHIP_CHANGE,
    SIGNAL_TYPES.REGULATORY,
    SIGNAL_TYPES.MARKET_ENTRY,
    SIGNAL_TYPES.MARKET_EXIT,
    SIGNAL_TYPES.ACQUISITION,
    SIGNAL_TYPES.TECHNOLOGY,
    SIGNAL_TYPES.MARKETING,
  ]),
  
  source: z.enum([
    INTELLIGENCE_SOURCES.NEWS,
    INTELLIGENCE_SOURCES.SOCIAL_MEDIA,
    INTELLIGENCE_SOURCES.INDUSTRY_REPORT,
    INTELLIGENCE_SOURCES.GOVERNMENT,
    INTELLIGENCE_SOURCES.FINANCIAL_FILING,
    INTELLIGENCE_SOURCES.FIELD_RESEARCH,
    INTELLIGENCE_SOURCES.CUSTOMER_FEEDBACK,
    INTELLIGENCE_SOURCES.COMPETITOR_WEBSITE,
    INTELLIGENCE_SOURCES.INTERNAL,
  ]),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  sourceName: z.string().max(200).optional(),
  
  competitorId: z.string().optional(),
  segments: z.array(z.string()).default([]),
  
  impactLevel: z.enum([
    IMPACT_LEVELS.MAJOR,
    IMPACT_LEVELS.MODERATE,
    IMPACT_LEVELS.MINOR,
    IMPACT_LEVELS.UNKNOWN,
  ]).default(IMPACT_LEVELS.UNKNOWN),
  
  confidence: z.enum(CONFIDENCE_LEVELS).default('medium'),
  
  signalDate: z.date(),
  
  requiresAction: z.boolean().default(false),
  implications: z.string().max(2000).optional(),
  recommendations: z.array(z.string().max(500)).optional(),
});

export type MarketSignalInput = z.infer<typeof marketSignalSchema>;

// Intelligence Item Schema
export const intelligenceItemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  summary: z.string().min(1, 'Summary is required').max(1000),
  content: z.string().max(10000).optional(),
  
  category: z.enum([
    PESTLE_CATEGORIES.POLITICAL,
    PESTLE_CATEGORIES.ECONOMIC,
    PESTLE_CATEGORIES.SOCIAL,
    PESTLE_CATEGORIES.TECHNOLOGICAL,
    PESTLE_CATEGORIES.LEGAL,
    PESTLE_CATEGORIES.ENVIRONMENTAL,
    'competitor',
    'market',
    'customer',
  ]),
  segments: z.array(z.string()).default([]),
  
  source: z.enum([
    INTELLIGENCE_SOURCES.NEWS,
    INTELLIGENCE_SOURCES.SOCIAL_MEDIA,
    INTELLIGENCE_SOURCES.INDUSTRY_REPORT,
    INTELLIGENCE_SOURCES.GOVERNMENT,
    INTELLIGENCE_SOURCES.FINANCIAL_FILING,
    INTELLIGENCE_SOURCES.FIELD_RESEARCH,
    INTELLIGENCE_SOURCES.CUSTOMER_FEEDBACK,
    INTELLIGENCE_SOURCES.COMPETITOR_WEBSITE,
    INTELLIGENCE_SOURCES.INTERNAL,
  ]),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  
  relevance: z.enum(RELEVANCE_LEVELS).default('medium'),
  timeframe: z.enum(TIMEFRAMES).default('short_term'),
  
  relatedCompetitorIds: z.array(z.string()).optional(),
});

export type IntelligenceItemInput = z.infer<typeof intelligenceItemSchema>;

// SWOT Item Schema
export const swotItemSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500),
  importance: z.enum(IMPORTANCE_LEVELS).default('medium'),
  evidence: z.string().max(1000).optional(),
});

export type SWOTItemInput = z.infer<typeof swotItemSchema>;

// SWOT Analysis Schema
export const swotAnalysisSchema = z.object({
  targetType: z.enum(['company', 'product', 'competitor', 'market']),
  targetId: z.string().optional(),
  targetName: z.string().min(1, 'Target name is required').max(200),
  
  strengths: z.array(swotItemSchema).min(1, 'At least one strength required'),
  weaknesses: z.array(swotItemSchema).min(1, 'At least one weakness required'),
  opportunities: z.array(swotItemSchema).min(1, 'At least one opportunity required'),
  threats: z.array(swotItemSchema).min(1, 'At least one threat required'),
  
  overallAssessment: z.string().max(2000).optional(),
  strategicPriorities: z.array(z.string().max(500)).optional(),
});

export type SWOTAnalysisInput = z.infer<typeof swotAnalysisSchema>;

// Report Section Schema
const reportSectionSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  charts: z.array(z.string()).optional(),
});

// Market Report Schema
export const marketReportSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  reportType: z.enum(['competitive_landscape', 'market_analysis', 'industry_trends', 'quarterly_review']),
  
  segments: z.array(z.string()).min(1, 'At least one segment required'),
  period: z.object({
    start: z.date(),
    end: z.date(),
  }),
  
  executiveSummary: z.string().min(1, 'Executive summary is required').max(5000),
  sections: z.array(reportSectionSchema).default([]),
  
  keyFindings: z.array(z.string().max(500)).default([]),
  recommendations: z.array(z.string().max(500)).default([]),
});

export type MarketReportInput = z.infer<typeof marketReportSchema>;
