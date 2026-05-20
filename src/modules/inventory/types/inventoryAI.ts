/**
 * AI Inventory Enhancement Types
 * Types for Claude-powered inventory item analysis, health auditing,
 * duplicate detection, batch corrections, and configurable agent instructions.
 */

import type { InventoryCategory } from './inventory';

// === Enhancement Types ===

export interface FieldSuggestion<T = string> {
  current: T;
  suggested: T;
  confidence: number; // 0-1
  reason: string;
}

export interface EnhancementSuggestions {
  name: FieldSuggestion<string>;
  displayName: FieldSuggestion<string>;
  description: FieldSuggestion<string>;
  category: FieldSuggestion<InventoryCategory>;
  subcategory: FieldSuggestion<string>;
  tags: FieldSuggestion<string[]>;
  aliases: FieldSuggestion<string[]>;
  classification: FieldSuggestion<string>;
  brand: FieldSuggestion<string>;
  structuredName: FieldSuggestion<{
    function?: string;
    keySpecs?: string;
    qualityTier?: string;
    brandName?: string;
  }>;
}

export interface DataQualityIssue {
  field: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestedFix?: string;
}

export interface EnhancementResult {
  suggestions: EnhancementSuggestions;
  dataQualityIssues: DataQualityIssue[];
  overallConfidence: number;
  aiNotes: string;
}

export interface EnhanceInventoryItemRequest {
  item: {
    id: string;
    sku: string;
    name: string;
    displayName?: string;
    description?: string;
    classification?: string;
    category: InventoryCategory;
    subcategory?: string;
    brand?: string;
    tags: string[];
    aliases?: string[];
    dimensions?: { length: number; width: number; thickness: number };
    grainPattern?: string;
    pricing: { costPerUnit: number; currency: string; unit: string };
    inventory: { inStock: number; reorderLevel?: number };
    supplierPricing?: Array<{ supplierName: string; unitPrice: number; currency: string }>;
    status: string;
  };
  inventoryContext?: {
    existingItems: Array<{ name: string; sku: string; category: string; subcategory?: string }>;
  };
}

export interface EnhanceInventoryItemResponse {
  success: boolean;
  suggestions: EnhancementSuggestions;
  dataQualityIssues: DataQualityIssue[];
  overallConfidence: number;
  aiNotes: string;
}

// === Audit Types ===

export type AuditIssueCategory =
  | 'incomplete-data'
  | 'potential-duplicate'
  | 'naming-inconsistency'
  | 'miscategorized'
  | 'pricing-concern'
  | 'low-stock'
  | 'stale-data'
  | 'orphan-sku'
  | 'unit-mismatch'
  | 'phantom-stock'
  | 'brand-in-title'
  | 'missing-structured-name'
  | 'family-candidate';

export interface AuditIssue {
  itemId: string;
  itemName: string;
  itemSku: string;
  severity: 'critical' | 'warning' | 'info';
  category: AuditIssueCategory;
  message: string;
  suggestedAction: string;
  relatedItemIds?: string[];
  confidence: number;
  /** If this issue has an auto-correctable fix, the correction is attached */
  correction?: CorrectionAction;
}

export interface AuditRecommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedItemIds: string[];
  actionType: 'enhance' | 'merge' | 'recategorize' | 'update-pricing' | 'restock' | 'correct' | 'archive' | 'create-family' | 'extract-brands';
}

export interface AuditSummary {
  totalItems: number;
  itemsWithIssues: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  duplicateGroupCount: number;
  correctableCount: number;
  /** Number of items skipped because they were audited recently */
  skippedRecentlyAudited?: number;
}

export interface AuditBatchProgress {
  currentBatch: number;
  totalBatches: number;
  itemsProcessed: number;
  totalItems: number;
}

export interface InventoryAuditResult {
  summary: AuditSummary;
  issues: AuditIssue[];
  recommendations: AuditRecommendation[];
  duplicateGroups: DuplicateGroup[];
  corrections: CorrectionAction[];
  aiNotes: string;
}

export interface AuditInventoryHealthRequest {
  items: Array<{
    id: string;
    sku: string;
    name: string;
    description?: string;
    category: InventoryCategory;
    subcategory?: string;
    brand?: string;
    tags: string[];
    aliases?: string[];
    dimensions?: { length: number; width: number; thickness: number };
    pricing: { costPerUnit: number; currency: string; unit: string };
    inventory: { inStock: number; reorderLevel?: number };
    supplierPricing?: Array<{ supplierName: string; unitPrice: number }>;
    status: string;
    familyId?: string;
    isFamily?: boolean;
    vendorSources?: Array<{ mpn: string; supplierSku?: string; brandName?: string }>;
    displayName?: string;
    structuredName?: { function?: string; keySpecs?: string; qualityTier?: string; brandName?: string };
  }>;
  options?: {
    maxItems?: number;
    focusAreas?: ('data-quality' | 'duplicates' | 'categorization' | 'pricing' | 'stock' | 'corrections')[];
    agentInstructions?: AgentInstructions;
  };
}

export interface AuditInventoryHealthResponse {
  success: boolean;
  audit: InventoryAuditResult;
}

// === Duplicate Detection Types ===

export interface DuplicateCandidate {
  itemId: string;
  itemName: string;
  itemSku: string;
  category: string;
  subcategory?: string;
  /** Why the AI thinks this is a duplicate */
  matchReason: string;
}

export interface DuplicateGroup {
  id: string;
  /** Confidence that these items are true duplicates (0-1) */
  confidence: number;
  /** The type of duplication detected */
  duplicateType: 'exact-name' | 'fuzzy-name' | 'same-mpn' | 'same-specs' | 'sku-variant';
  /** The primary/canonical item to keep */
  primaryItemId: string;
  /** All items in the group (including primary) */
  candidates: DuplicateCandidate[];
  /** AI-generated summary explaining the duplication */
  summary: string;
  /** Suggested resolution strategy */
  suggestedResolution: 'merge' | 'create-family' | 'alias' | 'review';
}

export type DuplicateMergeStrategy = 'keep-primary' | 'merge-best-fields' | 'create-parent';

export interface DuplicateMergeRequest {
  groupId: string;
  primaryItemId: string;
  itemsToMerge: string[];
  strategy: DuplicateMergeStrategy;
  /** Whether to archive (soft-delete) merged duplicates instead of hard-deleting */
  archiveDuplicates: boolean;
}

export interface DuplicateMergeResult {
  success: boolean;
  primaryItemId: string;
  mergedItemIds: string[];
  archivedItemIds: string[];
  updatedFields: string[];
  aiNotes: string;
}

// === Correction Types ===

export type CorrectionType =
  | 'field-update'
  | 'recategorize'
  | 'fix-sku'
  | 'fix-unit'
  | 'fill-missing'
  | 'standardize-name'
  | 'archive-stale'
  | 'extract-brand'
  | 'populate-structured-name';

export interface CorrectionAction {
  id: string;
  itemId: string;
  itemName: string;
  itemSku: string;
  type: CorrectionType;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  /** The field(s) to change */
  field: string;
  currentValue: string | number | string[] | null;
  suggestedValue: string | number | string[];
  confidence: number;
  /** Whether this was auto-detected or AI-suggested */
  source: 'deterministic' | 'ai';
  /** Group ID linking related corrections that should be applied together (e.g., brand extraction produces 3 field corrections) */
  correctionGroup?: string;
}

export type CorrectionStatus = 'pending' | 'accepted' | 'rejected' | 'applied';

export interface CorrectionReviewItem extends CorrectionAction {
  status: CorrectionStatus;
}

export interface ApplyCorrectionsRequest {
  corrections: Array<{
    id: string;
    itemId: string;
    field: string;
    newValue: string | number | string[];
  }>;
}

export interface ApplyCorrectionsResponse {
  success: boolean;
  appliedCount: number;
  failedCount: number;
  failures: Array<{ id: string; error: string }>;
}

// === Agent Instructions Types ===

export interface AgentInstructions {
  /** Custom system-level context to inject into the AI audit prompt */
  customContext: string;
  /** Naming conventions the agent should enforce */
  namingRules: AgentNamingRules;
  /** Categories and subcategories specific to this business */
  categoryGuidance: string;
  /** Known acceptable duplicates the agent should ignore */
  knownAliases: AgentKnownAlias[];
  /** Severity overrides — raise or lower severity for specific issue types */
  severityOverrides: AgentSeverityOverride[];
  /** Focus areas to prioritise or skip */
  focusPriorities: AgentFocusPriority[];
  /** Free-form rules the agent should follow */
  additionalRules: string[];
  /** Known brand names for brand-in-title detection and extraction */
  knownBrands: string[];
}

export interface AgentNamingRules {
  /** Preferred capitalisation style */
  capitalisation: 'title-case' | 'sentence-case' | 'uppercase' | 'as-is';
  /** Whether to use abbreviations (mm, kg) or spell out (millimetres, kilograms) */
  abbreviationStyle: 'abbreviate' | 'spell-out' | 'as-is';
  /** Whether brand should appear in item name */
  includeBrandInName: boolean;
  /** Preferred separator for structured names */
  nameSeparator: ' - ' | ' | ' | ' / ' | ', ';
  /** Any prefix/suffix conventions */
  prefixSuffix?: string;
}

export interface AgentKnownAlias {
  /** Primary item name or SKU */
  primary: string;
  /** Known aliases that are NOT duplicates */
  aliases: string[];
  /** Why these are not duplicates */
  reason: string;
}

export interface AgentSeverityOverride {
  /** The issue category to override */
  category: AuditIssueCategory;
  /** Override the severity for this category */
  severity: 'critical' | 'warning' | 'info' | 'ignore';
  /** Optional condition — only override when this pattern matches */
  condition?: string;
}

export interface AgentFocusPriority {
  area: 'data-quality' | 'duplicates' | 'categorization' | 'pricing' | 'stock' | 'corrections';
  priority: 'high' | 'normal' | 'skip';
}

export const DEFAULT_AGENT_INSTRUCTIONS: AgentInstructions = {
  customContext: '',
  namingRules: {
    capitalisation: 'title-case',
    abbreviationStyle: 'abbreviate',
    includeBrandInName: false,
    nameSeparator: ' - ',
  },
  categoryGuidance: '',
  knownAliases: [],
  severityOverrides: [],
  focusPriorities: [
    { area: 'data-quality', priority: 'high' },
    { area: 'duplicates', priority: 'high' },
    { area: 'categorization', priority: 'normal' },
    { area: 'pricing', priority: 'normal' },
    { area: 'stock', priority: 'normal' },
    { area: 'corrections', priority: 'normal' },
  ],
  additionalRules: [],
  knownBrands: [],
};

// === Agent Instructions Persistence ===

export interface SavedAgentInstructions {
  id: string;
  name: string;
  instructions: AgentInstructions;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}
