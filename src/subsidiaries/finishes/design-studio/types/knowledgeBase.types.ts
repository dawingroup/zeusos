/**
 * Design Knowledge Base Types
 *
 * Types for both the Firestore DKB (serving layer) and the wiki compiler (authoring layer).
 * The dkb* fields in wiki article frontmatter map directly to these interfaces.
 */
import type { Timestamp } from 'firebase/firestore';
import type { DKBEntryType, ComponentCategory, HardwareFamily } from '../constants/knowledgeBase.constants';
import type { ProductType } from '../constants/productDefinition.constants';
import type { BoringSpec } from './mdp.types';
import type { Constraint } from './productDefinition.types';

// Re-export for convenience
export type { DKBEntryType, ComponentCategory, HardwareFamily };

/** Base DKB entry (all types extend this) */
export interface DKBEntry {
  id: string;
  entryType: DKBEntryType;
  name: string;
  description: string;
  tags: string[];
  isActive: boolean;
  version: number;
  sourceArticlePath?: string;
  lastCompiled?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

/** Dimension range for a single axis */
export interface DimensionRange {
  width: { min: number; max: number; default: number; step: number };
  depth: { min: number; max: number; default: number; step: number };
  height: { min: number; max: number; default: number; step: number };
  unit: 'mm';
}

// ── Component ──────────────────────────────────────────

export interface ComponentMaterial {
  role: string;
  defaultThicknessMm: number;
  compatibleCategories: string[];
  compatibleFinishCategories: string[];
}

export interface ComponentHardware {
  hardwareFamily: string;
  quantityPer: number;
  defaultInventoryItemId?: string;
  boringSpec?: BoringSpec;
}

export interface EdgeBandingRule {
  edge: 'top' | 'bottom' | 'left' | 'right' | 'front';
  required: boolean;
  defaultType: string;
  matchFinish: boolean;
}

export interface JointSpec {
  type: string;
  connectsTo: string[];
  notes?: string;
}

export interface ComponentEntry extends DKBEntry {
  entryType: 'component';
  componentCategory: ComponentCategory;
  dimensions: DimensionRange;
  materialRequirements: ComponentMaterial[];
  hardwareRequirements: ComponentHardware[];
  edgeBandingRules: EdgeBandingRule[];
  jointTypes: JointSpec[];
  cadQuerySnippet?: string;
}

// ── Assembly Pattern ───────────────────────────────────

export interface PatternComponent {
  role: string;
  componentEntryId: string;
  quantity: number;
  isOptional: boolean;
  conditionalOn?: string;
}

export interface ConnectionSpec {
  fromRole: string;
  toRole: string;
  jointType: string;
  hardware?: string;
  notes?: string;
}

export interface AssemblyPatternEntry extends DKBEntry {
  entryType: 'assembly_pattern';
  components: PatternComponent[];
  connections: ConnectionSpec[];
  assemblySequence: string[];
  structuralNotes: string;
}

// ── Hardware Spec ──────────────────────────────────────

export interface HardwareSpecEntry extends DKBEntry {
  entryType: 'hardware_spec';
  hardwareFamily: string;
  inventoryItemId: string;
  manufacturer?: string;
  modelNumber?: string;
  boringSpec: BoringSpec;
  mountingClearances: { top: number; bottom: number; side: number };
  weightCapacityKg?: number;
  compatibilityRules: string[];
}

// ── Material Rule ──────────────────────────────────────

export interface MaterialRuleEntry extends DKBEntry {
  entryType: 'material_rule';
  ruleCategory: 'finish_substrate' | 'edge_board' | 'adhesive_material' | 'structural';
  condition: string;
  compatiblePairs: { a: string; b: string }[];
  incompatiblePairs: { a: string; b: string; reason: string }[];
}

// ── Product Archetype ──────────────────────────────────

export interface ProductArchetypeEntry extends DKBEntry {
  entryType: 'product_archetype';
  productType: ProductType;
  standardDimensions: DimensionRange;
  assemblyPatternId: string;
  defaultFinishCategory: string;
  typicalHardware: { family: string; quantity: number; inventoryItemId?: string }[];
  bomEstimate: { materialCategory: string; quantityExpression: string; unit: string }[];
  searchTerms: string[];
  aiPromptContext: string;
  constraints?: Constraint[];
}

// ── Dimensional Standard ───────────────────────────────

export interface DimensionalStandardEntry extends DKBEntry {
  entryType: 'dimensional_standard';
  scope: 'industry' | 'dawin' | 'regional';
  standardName: string;
  values: Record<string, number>;
  unit: 'mm';
  source?: string;
}

// ── Wiki Types (not stored in Firestore) ───────────────

export interface WikiArticle {
  id: string;
  title: string;
  category: string;
  tags: string[];
  sources: string[];
  related: string[];
  confidence: 'high' | 'medium' | 'low' | 'draft';
  lastCompiled?: string;
  dkbEntryType?: DKBEntryType;
  content: string;
}

export interface CompileReport {
  timestamp: Timestamp;
  articlesScanned: number;
  entriesCompiled: number;
  entriesUpdated: number;
  entriesUnchanged: number;
  errors: { articlePath: string; error: string }[];
  memoriesSynced: number;
}
