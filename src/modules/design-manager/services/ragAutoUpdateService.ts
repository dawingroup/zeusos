/**
 * RAG Auto-Update Service
 *
 * Automatically updates RAG status aspects based on system events:
 * - Cutlist generation → marks process documentation and production drawings green
 * - Production optimization → marks tooling, tolerances, assembly, joinery green
 * - Parts fully defined → marks dimensions and material specs green
 * - Estimate calculated → marks cost validation green
 * - Deliverable uploaded → marks corresponding aspects green based on file type
 *
 * Also provides sourcing-type-based N/A defaults so irrelevant aspects
 * don't block stage advancement for non-manufacturing items.
 */

import { Timestamp as FirestoreTimestamp } from 'firebase/firestore';
import type { RAGStatus, RAGStatusValue, RAGValue, PartEntry } from '../types';
import {
  updateRAGAspect as updateRAGAspectUtil,
} from '../utils/rag-calculations';

// ============================================
// Types
// ============================================

export type RAGAutoTrigger =
  | 'cutlist-generated'
  | 'production-optimization-completed'
  | 'parts-fully-defined'
  | 'estimate-calculated';

interface RAGAutoMapping {
  aspectPath: string;
  status: 'green';
  noteTemplate: string;
}

// ============================================
// Trigger-to-Aspect Mappings
// ============================================

const RAG_AUTO_TRIGGER_MAP: Record<RAGAutoTrigger, RAGAutoMapping[]> = {
  'cutlist-generated': [
    {
      aspectPath: 'designCompleteness.productionDrawings',
      status: 'green',
      noteTemplate: 'Auto-verified: Cutlist generated with production-ready part data',
    },
    {
      aspectPath: 'manufacturingReadiness.processDocumentation',
      status: 'green',
      noteTemplate: 'Auto-verified: Cut list generated (CNC program only required if parts have CNC operations)',
    },
  ],

  'production-optimization-completed': [
    {
      aspectPath: 'designCompleteness.productionDrawings',
      status: 'green',
      noteTemplate: 'Auto-verified: Production optimization generated cutting maps',
    },
    {
      aspectPath: 'designCompleteness.tolerances',
      status: 'green',
      noteTemplate: 'Auto-verified: Optimization handles kerf and cutting tolerances',
    },
    {
      aspectPath: 'designCompleteness.assemblyInstructions',
      status: 'green',
      noteTemplate: 'Auto-verified: Shop traveler provides part labels and assembly sequence',
    },
    {
      aspectPath: 'designCompleteness.joineryDetails',
      status: 'green',
      noteTemplate: 'Auto-verified: Edge banding schedule generated from optimization',
    },
    {
      aspectPath: 'manufacturingReadiness.processDocumentation',
      status: 'green',
      noteTemplate: 'Auto-verified: Shop traveler generated (cut list + BOM + assembly). CNC program only required if parts have CNC operations.',
    },
    {
      aspectPath: 'manufacturingReadiness.toolingReadiness',
      status: 'green',
      noteTemplate: 'Auto-verified: Optimization validated material and tooling fit',
    },
  ],

  'parts-fully-defined': [
    {
      aspectPath: 'designCompleteness.overallDimensions',
      status: 'green',
      noteTemplate: 'Auto-verified: All parts have dimensions defined',
    },
    {
      aspectPath: 'designCompleteness.materialSpecs',
      status: 'green',
      noteTemplate: 'Auto-verified: All parts have materials assigned',
    },
  ],

  'estimate-calculated': [
    {
      aspectPath: 'manufacturingReadiness.costValidation',
      status: 'green',
      noteTemplate: 'Auto-verified: Project estimate calculated with costs',
    },
  ],
};

// ============================================
// Deliverable-Type-to-RAG Mappings
// ============================================

const DELIVERABLE_TO_RAG_MAP: Record<string, RAGAutoMapping[]> = {
  'shop-drawing': [
    {
      aspectPath: 'designCompleteness.productionDrawings',
      status: 'green',
      noteTemplate: 'Auto-verified: Shop drawing uploaded',
    },
  ],
  'cut-list': [
    {
      aspectPath: 'designCompleteness.productionDrawings',
      status: 'green',
      noteTemplate: 'Auto-verified: Cut list uploaded',
    },
    {
      aspectPath: 'manufacturingReadiness.processDocumentation',
      status: 'green',
      noteTemplate: 'Auto-verified: Cut list uploaded as process documentation',
    },
  ],
  'bom': [
    {
      aspectPath: 'manufacturingReadiness.processDocumentation',
      status: 'green',
      noteTemplate: 'Auto-verified: Bill of Materials uploaded',
    },
  ],
  'assembly-instructions': [
    {
      aspectPath: 'designCompleteness.assemblyInstructions',
      status: 'green',
      noteTemplate: 'Auto-verified: Assembly instructions uploaded',
    },
  ],
  '3d-model': [
    {
      aspectPath: 'designCompleteness.model3D',
      status: 'green',
      noteTemplate: 'Auto-verified: 3D model uploaded',
    },
  ],
  'specification-sheet': [
    {
      aspectPath: 'designCompleteness.materialSpecs',
      status: 'green',
      noteTemplate: 'Auto-verified: Specification sheet uploaded',
    },
  ],
  // Phase 3 — the handoff bundle is the canonical "everything production needs"
  // snapshot, so its arrival implies production-drawing completeness.
  // Assembly instructions + process docs aren't guaranteed to be in every
  // bundle, so we don't flip those aspects here; individual deliverable
  // uploads continue to do that.
  'handoff-bundle': [
    {
      aspectPath: 'designCompleteness.productionDrawings',
      status: 'green',
      noteTemplate: 'Auto-verified: Handoff bundle created (all approved drawings snapshotted)',
    },
  ],
};

// ============================================
// Sourcing-Type N/A Defaults
// ============================================

const SOURCING_NA_DEFAULTS: Record<string, string[]> = {
  CUSTOM_FURNITURE_MILLWORK: [
    'qualityGates.prototypeValidation',
  ],

  PROCURED: [
    'designCompleteness.model3D',
    'designCompleteness.productionDrawings',
    'designCompleteness.joineryDetails',
    'designCompleteness.tolerances',
    'designCompleteness.assemblyInstructions',
    'manufacturingReadiness.toolingReadiness',
    'manufacturingReadiness.processDocumentation',
    'manufacturingReadiness.qualityCriteria',
    'qualityGates.manufacturingReview',
    'qualityGates.prototypeValidation',
  ],

  DESIGN_DOCUMENT: [
    'designCompleteness.joineryDetails',
    'designCompleteness.tolerances',
    'designCompleteness.assemblyInstructions',
    'manufacturingReadiness.materialAvailability',
    'manufacturingReadiness.hardwareAvailability',
    'manufacturingReadiness.toolingReadiness',
    'manufacturingReadiness.processDocumentation',
    'manufacturingReadiness.qualityCriteria',
    'manufacturingReadiness.costValidation',
    'qualityGates.manufacturingReview',
    'qualityGates.prototypeValidation',
  ],

  CONSTRUCTION: [
    'designCompleteness.model3D',
    'designCompleteness.joineryDetails',
    'designCompleteness.assemblyInstructions',
    'manufacturingReadiness.materialAvailability',
    'manufacturingReadiness.hardwareAvailability',
    'manufacturingReadiness.toolingReadiness',
    'manufacturingReadiness.processDocumentation',
    'manufacturingReadiness.qualityCriteria',
    'manufacturingReadiness.costValidation',
    'qualityGates.manufacturingReview',
    'qualityGates.prototypeValidation',
  ],
};

// Legacy type mapping
const LEGACY_TYPE_MAP: Record<string, string> = {
  MANUFACTURED: 'CUSTOM_FURNITURE_MILLWORK',
  ARCHITECTURAL: 'DESIGN_DOCUMENT',
};

// ============================================
// Exported Functions
// ============================================

/**
 * Get the N/A default aspect paths for a sourcing type.
 */
export function getSourcingTypeNADefaults(sourcingType?: string | null): string[] {
  if (!sourcingType) return SOURCING_NA_DEFAULTS['CUSTOM_FURNITURE_MILLWORK'] || [];
  const normalized = LEGACY_TYPE_MAP[sourcingType] || sourcingType;
  return SOURCING_NA_DEFAULTS[normalized] || [];
}

/**
 * Apply sourcing-type N/A defaults to a RAGStatus object.
 * Only sets aspects to 'not-applicable' if they are currently 'red' (initial state).
 * Never overwrites green, amber, or existing not-applicable.
 */
export function applyNADefaults(
  ragStatus: RAGStatus,
  sourcingType: string | undefined | null,
  userId: string
): RAGStatus {
  const naPaths = getSourcingTypeNADefaults(sourcingType);
  if (naPaths.length === 0) return ragStatus;

  let updated = { ...ragStatus };
  const naValue: RAGValue = {
    status: 'not-applicable',
    notes: `Not applicable for ${sourcingType || 'CUSTOM_FURNITURE_MILLWORK'} items`,
    updatedAt: FirestoreTimestamp.now(),
    updatedBy: userId,
  };

  for (const path of naPaths) {
    const [category, aspect] = path.split('.') as [keyof RAGStatus, string];
    const current = (updated[category] as unknown as Record<string, RAGValue>)?.[aspect];

    // Only apply N/A to red (initial) aspects — don't override manual settings
    if (current && current.status === 'red') {
      updated = updateRAGAspectUtil(updated, path, naValue);
    }
  }

  return updated;
}

/**
 * Check if all parts in a list are fully defined (dimensions + material).
 */
export function arePartsFullyDefined(parts: PartEntry[]): boolean {
  if (parts.length === 0) return false;
  return parts.every(p =>
    p.length > 0 &&
    (p.partType === 'bar' || p.partType === 'timber' || p.width > 0) &&
    (p.materialName || p.materialId)
  );
}

/**
 * Auto-update RAG aspects for design items based on a system trigger.
 *
 * Guards:
 * - Skips aspects already 'green' (idempotent)
 * - Skips aspects set to 'not-applicable' (respects manual overrides)
 * - Never throws — failures are logged and swallowed
 */
export async function autoUpdateRAGForItems(
  projectId: string,
  trigger: RAGAutoTrigger,
  itemIds: string[],
  userId: string
): Promise<void> {
  const mappings = RAG_AUTO_TRIGGER_MAP[trigger];
  if (!mappings || mappings.length === 0 || itemIds.length === 0) return;

  // Dynamic import to avoid circular dependencies
  const { getDesignItem, batchUpdateRAGAspects } = await import('./firestore');

  const updates: Array<{
    itemId: string;
    aspectPath: string;
    value: { status: RAGStatusValue; notes: string };
  }> = [];

  for (const itemId of itemIds) {
    let item;
    try {
      item = await getDesignItem(projectId, itemId);
    } catch {
      continue;
    }
    if (!item) continue;

    for (const mapping of mappings) {
      const [category, aspect] = mapping.aspectPath.split('.') as [keyof RAGStatus, string];
      const current = (item.ragStatus?.[category] as unknown as Record<string, RAGValue> | undefined)?.[aspect];

      // Skip if already green or not-applicable
      if (current && (current.status === 'green' || current.status === 'not-applicable')) {
        continue;
      }

      updates.push({
        itemId,
        aspectPath: mapping.aspectPath,
        value: {
          status: mapping.status,
          notes: mapping.noteTemplate,
        },
      });
    }
  }

  if (updates.length > 0) {
    await batchUpdateRAGAspects(projectId, updates, userId);
  }
}

/**
 * Auto-update RAG aspects when a deliverable file is uploaded.
 *
 * Maps deliverable types (shop-drawing, cut-list, bom, etc.) to the
 * RAG aspects they satisfy. Same guards as autoUpdateRAGForItems:
 * skips already-green or not-applicable, never throws.
 */
export async function autoUpdateRAGForDeliverable(
  projectId: string,
  itemId: string,
  deliverableType: string,
  userId: string
): Promise<void> {
  const mappings = DELIVERABLE_TO_RAG_MAP[deliverableType];
  if (!mappings || mappings.length === 0) return;

  const { getDesignItem, batchUpdateRAGAspects } = await import('./firestore');

  let item;
  try {
    item = await getDesignItem(projectId, itemId);
  } catch {
    return;
  }
  if (!item) return;

  const updates: Array<{
    itemId: string;
    aspectPath: string;
    value: { status: RAGStatusValue; notes: string };
  }> = [];

  for (const mapping of mappings) {
    const [category, aspect] = mapping.aspectPath.split('.') as [keyof RAGStatus, string];
    const current = (item.ragStatus?.[category] as unknown as Record<string, RAGValue> | undefined)?.[aspect];

    if (current && (current.status === 'green' || current.status === 'not-applicable')) {
      continue;
    }

    updates.push({
      itemId,
      aspectPath: mapping.aspectPath,
      value: {
        status: mapping.status,
        notes: mapping.noteTemplate,
      },
    });
  }

  if (updates.length > 0) {
    await batchUpdateRAGAspects(projectId, updates, userId);
  }
}
