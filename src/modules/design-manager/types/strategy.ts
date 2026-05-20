/**
 * Strategy Canvas Types
 * Enhanced type definitions for strategy canvas with AI context and validation
 */

import type { Timestamp } from '@/shared/types';

// ============================================
// Budget Tier Types
// ============================================

export type BudgetTier = 'economy' | 'standard' | 'premium' | 'luxury';

export const BUDGET_TIER_LABELS: Record<BudgetTier, string> = {
  economy: 'Economy',
  standard: 'Standard',
  premium: 'Premium',
  luxury: 'Luxury',
};

export const BUDGET_TIER_MULTIPLIERS: Record<BudgetTier, number> = {
  economy: 0.7,
  standard: 1.0,
  premium: 1.5,
  luxury: 2.5,
};

// ============================================
// AI Confidence & Scoring
// ============================================

/**
 * Confidence scoring for AI outputs with explanations
 */
export interface AIConfidence {
  score: number; // 0-1 (0 = no confidence, 1 = very confident)
  level: 'low' | 'medium' | 'high'; // Computed from score
  reasoning: string; // Why this confidence level?
  requiresClarification: boolean; // Should user review?
  ambiguities: string[]; // Specific unclear aspects
  suggestions?: string[]; // How to improve confidence
}

/**
 * Extraction method tracking
 */
export type ExtractionMethod = 'regex' | 'llm' | 'hybrid' | 'manual';

// ============================================
// Unified AI Context
// ============================================

/**
 * Unified context object shared across all AI tools
 * Aggregates data from strategy, project context, and customer intelligence
 */
export interface StrategyAIContext {
  // Customer information (from ProjectContext + CustomerIntelligence)
  customer: {
    name: string;
    company?: string;
    industry?: string;
    segment?: string; // From customer intelligence
    materialPreferences?: string[];
    preferredSuppliers?: string[];
    qualityExpectations?: string;
    priceSensitivity?: number; // 0-1 scale
    previousProjects?: number;
    preferredStyle?: string;
  };

  // Project details
  project: {
    type: string; // hospitality, residential, retail, etc.
    subType?: string;
    location: string;
    country: string;
    region?: string;
  };

  // Timeline context
  timeline?: {
    startDate?: string;
    targetCompletion?: string;
    urgency: 'flexible' | 'normal' | 'urgent' | 'critical';
    milestones?: string[];
  };

  // Style preferences
  style?: {
    primary: string;
    secondary?: string;
    colorPreferences?: string[];
    materialPreferences?: string[];
    avoidStyles?: string[];
    inspirationNotes?: string;
  };

  // Target users/guests
  targetUsers?: {
    demographic?: string;
    capacity?: number;
    usagePattern?: string;
    specialNeeds?: string[];
  };

  // Special requirements
  requirements?: {
    sustainability?: boolean;
    localSourcing?: boolean;
    accessibilityCompliant?: boolean;
    brandGuidelines?: boolean;
    customFinishes?: boolean;
    notes?: string;
  };

  // Challenges (from strategy form)
  challenges: {
    painPoints: string[];
    goals: string[];
    constraints: string[];
  };

  // Space parameters
  spaceParameters: {
    totalArea: number;
    areaUnit: 'sqm' | 'sqft';
    spaceType: string;
    circulationPercent: number;
    calculatedCapacity?: {
      minimum: number;
      optimal: number;
      maximum: number;
    };
  };

  // Budget framework
  budgetFramework: {
    tier: BudgetTier;
    targetAmount?: number;
    currency?: string;
    priorities: string[];
  };

  // Design brief
  designBrief?: string;

  // Research findings (from Research Assistant)
  researchFindings?: ResearchFinding[];
}

/**
 * Research finding from strategy research
 */
export interface ResearchFinding {
  id: string;
  title: string;
  content: string;
  sources: string[];
  category: 'trend' | 'benchmark' | 'recommendation' | 'insight';
  createdAt: Date | Timestamp;
}

// ============================================
// Scoped Deliverable Types
// ============================================

/**
 * Enhanced deliverable with strategy context and pricing hints
 * Output from ProjectScopingAI with full context linkage
 */
export interface ScopedDeliverable {
  id: string;
  name: string;
  description?: string;
  category: 'MANUFACTURED' | 'PROCURED' | 'DESIGN_DOCUMENT' | 'CONSTRUCTION' | 'CUSTOM_FURNITURE_MILLWORK';
  quantity: number;
  complexity?: string;            // Complexity level (used by bottomUpPricingService)

  // Room/space context (if applicable)
  roomContext?: {
    roomType?: string; // guest_room_standard, suite, kitchen, etc.
    roomCount?: number; // Number of rooms this applies to
    unitQuantityPerRoom?: number; // Quantity per room
  };

  // Strategy context linkage
  strategyContext?: {
    budgetTier: BudgetTier;
    spaceType: string;
    areaMultiplier?: number; // Derived from space parameters
    constraints?: string[]; // Applicable constraints from strategy
  };

  // Specifications
  specifications?: {
    dimensions?: {
      width?: number;
      height?: number;
      depth?: number;
      unit: 'mm' | 'inches';
    };
    material?: string;
    finish?: string;
    complexity?: 'low' | 'medium' | 'high';
  };

  // Manufacturing context
  manufacturing?: {
    featureLibraryMatches?: string[]; // Matched features from library
    capabilityVerified?: boolean; // Can we manufacture this?
    estimatedHours?: number;
  };

  // AI metadata
  aiMetadata: {
    confidenceScore: number; // 0-1
    confidence?: AIConfidence; // Full confidence object
    extractionMethod: ExtractionMethod;
    requiresClarification: boolean;
    clarifications: string[]; // Specific questions to resolve
    validationErrors: string[]; // Issues found during validation
    extractedFrom?: string; // Which part of brief this came from
  };

  // Pricing hints from strategy
  pricingHints?: {
    estimatedUnitCost?: number; // Based on budget tier and complexity
    budgetAllocation?: number; // Suggested budget for this item
    priorityLevel?: 'must-have' | 'nice-to-have' | 'optional';
    costBasis?: string; // How estimate was calculated
  };
}

// ============================================
// Validation Schema Types
// ============================================

/**
 * Field validation rule
 */
export interface ValidationRule {
  required?: boolean;
  minValue?: number;
  maxValue?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
  message?: string;
}

/**
 * Section validation schema
 */
export interface SectionValidation {
  fields: Record<string, ValidationRule>;
  crossFieldRules?: {
    validator: (values: Record<string, any>) => boolean | string;
    message: string;
  }[];
}

/**
 * Complete validation schema for strategy
 */
export interface StrategyValidationSchema {
  projectContext: SectionValidation;
  designBrief: SectionValidation;
  challenges: SectionValidation;
  spaceParameters: SectionValidation;
  budgetFramework: SectionValidation;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>; // Field path -> error messages
  warnings?: Record<string, string[]>;
}

// ============================================
// Project Strategy (Firestore Document)
// ============================================

/**
 * Project strategy document stored in Firestore
 * Location: /projectStrategy/{projectId}
 */
export interface ProjectStrategy {
  id: string;
  projectId: string;

  // Project context (expanded from old structure)
  projectContext?: {
    customer: StrategyAIContext['customer'];
    project: StrategyAIContext['project'];
    timeline?: StrategyAIContext['timeline'];
    style?: StrategyAIContext['style'];
    targetUsers?: StrategyAIContext['targetUsers'];
    requirements?: StrategyAIContext['requirements'];
  };

  // Core strategy sections
  challenges: {
    painPoints: string[];
    goals: string[];
    constraints: string[];
  };

  spaceParameters: {
    totalArea: number;
    areaUnit: 'sqm' | 'sqft';
    spaceType: string;
    circulationPercent: number;
    calculatedCapacity?: {
      minimum: number;
      optimal: number;
      maximum: number;
    };
  };

  budgetFramework: {
    tier: BudgetTier;
    targetAmount?: number;
    currency?: string;
    priorities: string[];
  };

  // Design brief
  designBrief?: string;

  // Research findings
  researchFindings: ResearchFinding[];

  // Scoping results (NEW - store scoping output)
  scopingResult?: {
    deliverables: ScopedDeliverable[];
    summary: {
      totalDeliverables: number;
      totalUnits: number;
      byCategory: Record<string, number>;
      estimatedTotalHours?: number;
      itemsRequiringClarification: number;
    };
    scopedAt: Timestamp;
    scopedBy: string;
  };

  // Metadata
  updatedAt?: Timestamp | Date;
  updatedBy?: string;
  createdAt?: Timestamp | Date;
  createdBy?: string;
}

// ============================================
// Design Item Extensions (for index.ts)
// ============================================

/**
 * Strategy context attached to design items
 * Links design items back to their strategic origin
 */
export interface DesignItemStrategyContext {
  strategyId: string; // Reference to projectStrategy document
  budgetTier?: BudgetTier;
  spaceMultiplier?: number; // For quantity calculations (e.g., per-room × room count)
  scopingConfidence?: number; // Confidence score from scoping AI
  deliverableType?: string; // Type from scoping (manufactured, procured, etc.)
  roomType?: string; // If scoped from room template
  extractionMethod?: ExtractionMethod; // How this item was created
  derivedFrom?: 'scoping' | 'manual' | 'template'; // Source of item
}

/**
 * Budget tracking for design items
 * Tracks allocated vs. actual costs
 */
export interface DesignItemBudgetTracking {
  allocatedBudget?: number; // Budget allocated from strategy
  actualCost?: number; // Current calculated cost
  variance?: number; // actualCost - allocatedBudget
  variancePercent?: number; // (variance / allocatedBudget) * 100
  lastUpdated?: Timestamp;
}

// ============================================
// Save Status Types
// ============================================

/**
 * Save status for auto-save indicator
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Save metadata
 */
export interface SaveMetadata {
  status: SaveStatus;
  lastSaved?: Date;
  error?: string;
  isSynced: boolean;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate confidence level from score
 */
export function getConfidenceLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

/**
 * Calculate budget tier multiplier
 */
export function getBudgetTierMultiplier(tier?: BudgetTier): number {
  return tier ? BUDGET_TIER_MULTIPLIERS[tier] : 1.0;
}

/**
 * Format budget tier for display
 */
export function formatBudgetTier(tier: BudgetTier): string {
  return BUDGET_TIER_LABELS[tier];
}
