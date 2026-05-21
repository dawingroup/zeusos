// ============================================================================
// ENVIRONMENT SCANNING SCHEMAS
// ZeusOS v2.0 - Market Intelligence Module
// ============================================================================

import { z } from 'zod';
import {
  PESTEL_DIMENSIONS,
  IMPACT_LEVELS,
  PROBABILITY_LEVELS,
  SIGNAL_TYPES,
  SIGNAL_SOURCES,
  REGULATORY_CATEGORIES,
  REGULATORY_STATUSES,
  COMPLIANCE_STATUSES,
  SCENARIO_TYPES,
  TIME_HORIZONS,
  ALERT_PRIORITIES,
  TRIGGER_CONDITIONS,
  UGANDA_ECONOMIC_INDICATORS,
  AFFECTED_BUSINESS_AREAS,
} from '../constants/scanning.constants';

// ----------------------------------------------------------------------------
// HELPER SCHEMAS
// ----------------------------------------------------------------------------

const timestampSchema = z.object({
  seconds: z.number(),
  nanoseconds: z.number(),
});

const pestelDimensionEnum = z.enum(Object.values(PESTEL_DIMENSIONS) as [string, ...string[]]);
const impactLevelEnum = z.enum(Object.values(IMPACT_LEVELS) as [string, ...string[]]);
const probabilityLevelEnum = z.enum(Object.values(PROBABILITY_LEVELS) as [string, ...string[]]);
const timeHorizonEnum = z.enum(Object.values(TIME_HORIZONS) as [string, ...string[]]);
const alertPriorityEnum = z.enum(Object.values(ALERT_PRIORITIES) as [string, ...string[]]);
const affectedAreaEnum = z.enum(Object.values(AFFECTED_BUSINESS_AREAS) as [string, ...string[]]);
const signalTypeEnum = z.enum(Object.values(SIGNAL_TYPES) as [string, ...string[]]);
const signalSourceEnum = z.enum(Object.values(SIGNAL_SOURCES) as [string, ...string[]]);
const regulatoryCategoryEnum = z.enum(Object.values(REGULATORY_CATEGORIES) as [string, ...string[]]);
const regulatoryStatusEnum = z.enum(Object.values(REGULATORY_STATUSES) as [string, ...string[]]);
const complianceStatusEnum = z.enum(Object.values(COMPLIANCE_STATUSES) as [string, ...string[]]);
const scenarioTypeEnum = z.enum(Object.values(SCENARIO_TYPES) as [string, ...string[]]);
const triggerConditionEnum = z.enum(Object.values(TRIGGER_CONDITIONS) as [string, ...string[]]);
const economicIndicatorEnum = z.enum(Object.values(UGANDA_ECONOMIC_INDICATORS) as [string, ...string[]]);

// ----------------------------------------------------------------------------
// PESTEL ANALYSIS SCHEMAS
// ----------------------------------------------------------------------------

export const factorEvidenceSchema = z.object({
  type: z.enum(['statistic', 'trend', 'event', 'regulation', 'expert_opinion', 'research']),
  title: z.string().min(1, 'Evidence title is required').max(200),
  description: z.string().min(1, 'Evidence description is required').max(1000),
  source: z.string().min(1, 'Source is required').max(200),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  date: timestampSchema,
  reliability: z.enum(['high', 'medium', 'low']),
});

export const strategicResponseSchema = z.object({
  recommendation: z.string().min(1, 'Recommendation is required').max(500),
  actions: z.array(z.string().min(1).max(300)).min(1, 'At least one action required'),
  owner: z.string().optional(),
  deadline: timestampSchema.optional(),
  status: z.enum(['pending', 'in_progress', 'completed']),
});

export const pestelFactorSchema = z.object({
  dimension: pestelDimensionEnum,
  subFactor: z.string().min(1, 'Sub-factor is required').max(100),
  title: z.string().min(1, 'Factor title is required').max(200),
  description: z.string().min(1, 'Factor description is required').max(2000),
  currentState: z.string().min(1, 'Current state is required').max(1000),
  futureOutlook: z.string().min(1, 'Future outlook is required').max(1000),
  impact: z.object({
    level: impactLevelEnum,
    probability: probabilityLevelEnum,
    timeToImpact: timeHorizonEnum,
  }),
  type: z.enum(['opportunity', 'threat', 'neutral']),
  affectedAreas: z.array(affectedAreaEnum).min(1, 'At least one affected area required'),
  evidence: z.array(factorEvidenceSchema).optional().default([]),
  strategicResponse: strategicResponseSchema.optional(),
  watchPriority: alertPriorityEnum,
});

export const pestelAnalysisSchema = z.object({
  title: z.string().min(1, 'Analysis title is required').max(200),
  description: z.string().min(1, 'Description is required').max(2000),
  scope: z.object({
    industries: z.array(z.string()).min(1, 'At least one industry required'),
    geographies: z.array(z.string()).min(1, 'At least one geography required'),
    timeHorizon: timeHorizonEnum,
    targetDate: timestampSchema,
  }),
  factors: z.array(pestelFactorSchema).optional().default([]),
});

export const pestelAnalysisUpdateSchema = pestelAnalysisSchema.partial();

// ----------------------------------------------------------------------------
// SIGNAL SCHEMAS
// ----------------------------------------------------------------------------

export const signalSourceDetailsSchema = z.object({
  name: z.string().min(1, 'Source name is required').max(200),
  url: z.string().url().optional().or(z.literal('')),
  author: z.string().max(100).optional(),
  publicationDate: timestampSchema.optional(),
});

export const signalAssessmentSchema = z.object({
  impactLevel: impactLevelEnum,
  probability: probabilityLevelEnum,
  timeToImpact: timeHorizonEnum,
  confidenceLevel: z.number().min(0).max(100),
  strengthScore: z.number().min(1).max(10),
});

export const signalImplicationsSchema = z.object({
  opportunities: z.array(z.string().max(500)).optional().default([]),
  threats: z.array(z.string().max(500)).optional().default([]),
  strategicImplications: z.array(z.string().max(500)).optional().default([]),
});

export const signalActionItemSchema = z.object({
  action: z.string().min(1, 'Action is required').max(500),
  assignee: z.string().optional(),
  dueDate: timestampSchema.optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
  priority: alertPriorityEnum,
  notes: z.string().max(1000).optional(),
});

export const signalSchema = z.object({
  title: z.string().min(1, 'Signal title is required').max(200),
  description: z.string().min(1, 'Signal description is required').max(2000),
  signalType: signalTypeEnum,
  source: signalSourceEnum,
  sourceDetails: signalSourceDetailsSchema,
  pestelDimension: pestelDimensionEnum,
  industries: z.array(z.string()).min(1, 'At least one industry required'),
  geographies: z.array(z.string()).min(1, 'At least one geography required'),
  affectedAreas: z.array(affectedAreaEnum).min(1, 'At least one affected area required'),
  assessment: signalAssessmentSchema,
  implications: signalImplicationsSchema.optional(),
  tags: z.array(z.string().max(50)).optional().default([]),
});

export const signalUpdateSchema = signalSchema.partial();

// ----------------------------------------------------------------------------
// REGULATORY SCHEMAS
// ----------------------------------------------------------------------------

export const regulatoryDatesSchema = z.object({
  proposed: timestampSchema.optional(),
  consultationStart: timestampSchema.optional(),
  consultationEnd: timestampSchema.optional(),
  enacted: timestampSchema.optional(),
  effectiveDate: timestampSchema.optional(),
  amendedDate: timestampSchema.optional(),
  repealedDate: timestampSchema.optional(),
});

export const financialImpactSchema = z.object({
  estimatedCost: z.number().optional(),
  currency: z.string().default('UGX'),
  costType: z.enum(['one_time', 'recurring', 'both']),
  notes: z.string().max(500).optional(),
});

export const regulatoryImpactSchema = z.object({
  level: impactLevelEnum,
  affectedAreas: z.array(affectedAreaEnum).min(1),
  affectedSubsidiaries: z.array(z.string()).optional().default([]),
  financialImpact: financialImpactSchema.optional(),
});

export const complianceRequirementSchema = z.object({
  requirement: z.string().min(1, 'Requirement is required').max(500),
  description: z.string().max(1000),
  complianceStatus: complianceStatusEnum,
  responsiblePerson: z.string().optional(),
  dueDate: timestampSchema.optional(),
  evidence: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
});

export const complianceSchema = z.object({
  status: complianceStatusEnum,
  requirements: z.array(complianceRequirementSchema).optional().default([]),
  gapAnalysis: z.string().max(2000).optional(),
  remediationPlan: z.string().max(2000).optional(),
  dueDate: timestampSchema.optional(),
});

export const regulatoryDocumentSchema = z.object({
  title: z.string().min(1, 'Document title is required').max(200),
  type: z.enum(['full_text', 'summary', 'guidance', 'form', 'commentary']),
  url: z.string().url().optional().or(z.literal('')),
});

export const regulatoryItemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  officialName: z.string().min(1, 'Official name is required').max(300),
  referenceNumber: z.string().max(100).optional(),
  description: z.string().min(1, 'Description is required').max(2000),
  category: regulatoryCategoryEnum,
  subcategory: z.string().max(100).optional(),
  jurisdiction: z.string().min(1, 'Jurisdiction is required').max(100),
  issuingAuthority: z.string().min(1, 'Issuing authority is required').max(200),
  status: regulatoryStatusEnum,
  dates: regulatoryDatesSchema.optional(),
  impact: regulatoryImpactSchema,
  compliance: complianceSchema.optional(),
  documents: z.array(regulatoryDocumentSchema).optional().default([]),
  notes: z.string().max(2000).optional(),
});

export const regulatoryItemUpdateSchema = regulatoryItemSchema.partial();

// ----------------------------------------------------------------------------
// SCENARIO SCHEMAS
// ----------------------------------------------------------------------------

export const drivingForceSchema = z.object({
  force: z.string().min(1, 'Force is required').max(200),
  description: z.string().min(1, 'Description is required').max(1000),
  pestelDimension: pestelDimensionEnum,
  certainty: z.enum(['high', 'medium', 'low']),
  impact: impactLevelEnum,
  direction: z.enum(['positive', 'negative', 'uncertain']),
});

export const scenarioAssumptionSchema = z.object({
  assumption: z.string().min(1, 'Assumption is required').max(500),
  basis: z.string().min(1, 'Basis is required').max(500),
  sensitivity: z.enum(['high', 'medium', 'low']),
  alternativeValues: z.array(z.string().max(200)).optional(),
});

export const economicProjectionSchema = z.object({
  indicator: economicIndicatorEnum,
  baselineValue: z.number(),
  projectedValue: z.number(),
  unit: z.string().max(50),
  confidence: z.number().min(0).max(100),
  notes: z.string().max(500).optional(),
});

export const businessImpactSchema = z.object({
  revenueImpact: z.number().min(-100).max(1000),
  costImpact: z.number().min(-100).max(1000),
  marketShareImpact: z.number().min(-100).max(100),
  employmentImpact: z.number().min(-100).max(1000),
  qualitativeImpacts: z.array(z.string().max(500)).optional().default([]),
});

export const strategicOptionSchema = z.object({
  option: z.string().min(1, 'Option is required').max(200),
  description: z.string().min(1, 'Description is required').max(1000),
  advantages: z.array(z.string().max(300)).min(1),
  disadvantages: z.array(z.string().max(300)).optional().default([]),
  resourceRequirements: z.string().max(500),
  timeToImplement: timeHorizonEnum,
  recommendedIf: z.string().max(500),
  priority: alertPriorityEnum,
});

export const signpostSchema = z.object({
  indicator: z.string().min(1, 'Indicator is required').max(200),
  description: z.string().min(1, 'Description is required').max(500),
  threshold: z.number().optional(),
  unit: z.string().max(50).optional(),
  currentValue: z.number().optional(),
  targetValue: z.number().optional(),
  direction: z.enum(['above', 'below', 'equals', 'changes']),
});

export const scenarioSchema = z.object({
  title: z.string().min(1, 'Scenario title is required').max(200),
  description: z.string().min(1, 'Description is required').max(2000),
  type: scenarioTypeEnum,
  scope: z.object({
    industries: z.array(z.string()).min(1),
    geographies: z.array(z.string()).min(1),
    timeHorizon: timeHorizonEnum,
    targetYear: z.number().min(2024).max(2050),
  }),
  probability: z.number().min(0).max(100),
  probabilityRationale: z.string().min(1, 'Probability rationale is required').max(1000),
  drivingForces: z.array(drivingForceSchema).optional().default([]),
  assumptions: z.array(scenarioAssumptionSchema).optional().default([]),
  economicProjections: z.array(economicProjectionSchema).optional().default([]),
  businessImpact: businessImpactSchema.optional(),
  strategicOptions: z.array(strategicOptionSchema).optional().default([]),
  signposts: z.array(signpostSchema).optional().default([]),
});

export const scenarioUpdateSchema = scenarioSchema.partial();

// ----------------------------------------------------------------------------
// EARLY WARNING SCHEMAS
// ----------------------------------------------------------------------------

export const alertTriggerSchema = z.object({
  name: z.string().min(1, 'Trigger name is required').max(100),
  description: z.string().min(1, 'Description is required').max(500),
  isActive: z.boolean().default(true),
  condition: triggerConditionEnum,
  threshold: z.number().optional(),
  thresholdUnit: z.string().max(50).optional(),
  pattern: z.string().max(500).optional(),
  monitoringFrequency: z.enum(['real_time', 'hourly', 'daily', 'weekly', 'monthly']),
  targetType: z.enum(['indicator', 'signal', 'regulation', 'scenario', 'custom']),
  targetId: z.string().optional(),
  alertPriority: alertPriorityEnum,
  notifyRoles: z.array(z.string()).optional().default([]),
  notifyUsers: z.array(z.string()).optional().default([]),
});

export const alertTriggerUpdateSchema = alertTriggerSchema.partial();

export const earlyWarningAlertSchema = z.object({
  title: z.string().min(1, 'Alert title is required').max(200),
  description: z.string().min(1, 'Description is required').max(1000),
  priority: alertPriorityEnum,
  trigger: alertTriggerSchema,
  sourceType: z.enum(['signal', 'regulation', 'scenario', 'indicator', 'custom']),
  sourceId: z.string().optional(),
  affectedAreas: z.array(affectedAreaEnum).min(1),
});

// ----------------------------------------------------------------------------
// INDICATOR SCHEMAS
// ----------------------------------------------------------------------------

export const indicatorThresholdsSchema = z.object({
  critical_high: z.number().optional(),
  warning_high: z.number().optional(),
  warning_low: z.number().optional(),
  critical_low: z.number().optional(),
});

export const indicatorDataPointSchema = z.object({
  date: timestampSchema,
  value: z.number(),
  source: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export const trackedIndicatorSchema = z.object({
  indicator: economicIndicatorEnum,
  currentValue: z.number(),
  thresholds: indicatorThresholdsSchema.optional(),
  source: z.string().min(1, 'Source is required').max(100),
});

// ----------------------------------------------------------------------------
// TYPE EXPORTS
// ----------------------------------------------------------------------------

export type FactorEvidenceFormData = z.infer<typeof factorEvidenceSchema>;
export type StrategicResponseFormData = z.infer<typeof strategicResponseSchema>;
export type PESTELFactorFormData = z.infer<typeof pestelFactorSchema>;
export type PESTELAnalysisFormData = z.infer<typeof pestelAnalysisSchema>;
export type SignalFormData = z.infer<typeof signalSchema>;
export type SignalActionItemFormData = z.infer<typeof signalActionItemSchema>;
export type RegulatoryItemFormData = z.infer<typeof regulatoryItemSchema>;
export type ComplianceRequirementFormData = z.infer<typeof complianceRequirementSchema>;
export type ScenarioFormData = z.infer<typeof scenarioSchema>;
export type DrivingForceFormData = z.infer<typeof drivingForceSchema>;
export type ScenarioAssumptionFormData = z.infer<typeof scenarioAssumptionSchema>;
export type EconomicProjectionFormData = z.infer<typeof economicProjectionSchema>;
export type StrategicOptionFormData = z.infer<typeof strategicOptionSchema>;
export type SignpostFormData = z.infer<typeof signpostSchema>;
export type AlertTriggerFormData = z.infer<typeof alertTriggerSchema>;
export type EarlyWarningAlertFormData = z.infer<typeof earlyWarningAlertSchema>;
export type TrackedIndicatorFormData = z.infer<typeof trackedIndicatorSchema>;
