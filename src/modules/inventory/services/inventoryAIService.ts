/**
 * Inventory AI Service
 * Frontend wrapper for Claude-powered inventory enhancement, health auditing,
 * duplicate resolution, batch corrections, and agent instructions.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/services/firebase/functions';
import {
  doc,
  getDoc,
  setDoc,
  writeBatch,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import type {
  EnhanceInventoryItemRequest,
  EnhanceInventoryItemResponse,
  AuditInventoryHealthRequest,
  AuditInventoryHealthResponse,
  EnhancementResult,
  InventoryAuditResult,
  AuditBatchProgress,
  DuplicateMergeRequest,
  DuplicateMergeResult,
  ApplyCorrectionsRequest,
  ApplyCorrectionsResponse,
  AgentInstructions,
  SavedAgentInstructions,
} from '../types/inventoryAI';
import type { InventoryItem } from '../types/inventory';

// ============================================
// Enhancement
// ============================================

/**
 * Call the enhanceInventoryItem cloud function.
 * Returns structured enhancement suggestions for a single item.
 */
export async function enhanceInventoryItemAI(
  item: InventoryItem,
  existingItems?: Array<{ name: string; sku: string; category: string; subcategory?: string }>
): Promise<EnhancementResult> {
  const enhanceFn = httpsCallable<EnhanceInventoryItemRequest, EnhanceInventoryItemResponse>(
    functions,
    'enhanceInventoryItem'
  );

  const slimItem = {
    id: item.id,
    sku: item.sku,
    name: item.name,
    displayName: item.displayName,
    description: item.description,
    classification: item.classification,
    category: item.category,
    subcategory: item.subcategory,
    brand: item.brand,
    tags: item.tags || [],
    aliases: item.aliases,
    dimensions: item.dimensions,
    grainPattern: item.grainPattern,
    pricing: {
      costPerUnit: item.pricing?.costPerUnit || 0,
      currency: item.pricing?.currency || 'UGX',
      unit: item.pricing?.unit || 'ea',
    },
    inventory: {
      inStock: item.inventory?.inStock ?? 0,
      reorderLevel: item.inventory?.reorderLevel,
    },
    supplierPricing: item.supplierPricing?.map(sp => ({
      supplierName: sp.supplierName,
      unitPrice: sp.unitPrice,
      currency: sp.currency,
    })),
    status: item.status,
  };

  const result = await enhanceFn({
    item: slimItem,
    inventoryContext: existingItems ? { existingItems } : undefined,
  });

  if (!result.data.success) {
    throw new Error('AI enhancement returned unsuccessful response');
  }

  return {
    suggestions: result.data.suggestions,
    dataQualityIssues: result.data.dataQualityIssues,
    overallConfidence: result.data.overallConfidence,
    aiNotes: result.data.aiNotes,
  };
}

// ============================================
// Audit (batched with skip-recently-audited)
// ============================================

const AUDIT_BATCH_SIZE = 30;
const AUDIT_SKIP_DAYS_DEFAULT = 7;

function toSlimItem(item: InventoryItem): AuditInventoryHealthRequest['items'][number] {
  return {
    id: item.id,
    sku: item.sku,
    name: item.name,
    description: item.description,
    category: item.category,
    subcategory: item.subcategory,
    brand: item.brand,
    tags: item.tags || [],
    aliases: item.aliases,
    dimensions: item.dimensions,
    pricing: {
      costPerUnit: item.pricing?.costPerUnit || 0,
      currency: item.pricing?.currency || 'UGX',
      unit: item.pricing?.unit || 'ea',
    },
    inventory: {
      inStock: item.inventory?.inStock ?? 0,
      reorderLevel: item.inventory?.reorderLevel,
    },
    supplierPricing: item.supplierPricing?.map(sp => ({
      supplierName: sp.supplierName,
      unitPrice: sp.unitPrice,
    })),
    status: item.status,
    familyId: item.familyId || undefined,
    isFamily: item.isFamily,
    vendorSources: item.vendorSources?.map(vs => ({
      mpn: vs.mpn,
      supplierSku: vs.supplierSku,
    })),
  };
}

/**
 * Merge multiple batch audit results into a single combined result.
 */
function mergeAuditResults(results: InventoryAuditResult[]): InventoryAuditResult {
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };

  const allIssues = results.flatMap(r => r.issues)
    .sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));

  // Deduplicate duplicate groups by primaryItemId
  const seenPrimary = new Set<string>();
  const allDuplicateGroups = results.flatMap(r => r.duplicateGroups).filter(g => {
    if (seenPrimary.has(g.primaryItemId)) return false;
    seenPrimary.add(g.primaryItemId);
    return true;
  });

  // Deduplicate corrections by itemId:field
  const seenCorrections = new Set<string>();
  const allCorrections = results.flatMap(r => r.corrections).filter(c => {
    const key = `${c.itemId}:${c.field}`;
    if (seenCorrections.has(key)) return false;
    seenCorrections.add(key);
    return true;
  });

  const allRecommendations = results.flatMap(r => r.recommendations);
  const aiNotes = results.map((r, i) => `Batch ${i + 1}: ${r.aiNotes}`).join('\n');

  const totalItems = results.reduce((sum, r) => sum + r.summary.totalItems, 0);

  return {
    summary: {
      totalItems,
      itemsWithIssues: new Set(allIssues.map(i => i.itemId)).size,
      criticalCount: allIssues.filter(i => i.severity === 'critical').length,
      warningCount: allIssues.filter(i => i.severity === 'warning').length,
      infoCount: allIssues.filter(i => i.severity === 'info').length,
      duplicateGroupCount: allDuplicateGroups.length,
      correctableCount: allCorrections.length,
    },
    issues: allIssues,
    recommendations: allRecommendations,
    duplicateGroups: allDuplicateGroups,
    corrections: allCorrections,
    aiNotes,
  };
}

/**
 * Write lastAuditedAt timestamp to all audited items.
 */
async function stampAuditedItems(itemIds: string[]): Promise<void> {
  // Firestore writeBatch supports max 500 operations
  for (let i = 0; i < itemIds.length; i += 450) {
    const batch = writeBatch(db);
    const chunk = itemIds.slice(i, i + 450);
    for (const id of chunk) {
      batch.update(doc(db, 'inventoryItems', id), { lastAuditedAt: serverTimestamp() });
    }
    await batch.commit();
  }
}

const AUDIT_RESULTS_DOC = 'inventoryAuditResults/latest';

/**
 * Save audit results to Firestore so they persist across page loads.
 */
export async function saveAuditResult(result: InventoryAuditResult): Promise<void> {
  await setDoc(doc(db, AUDIT_RESULTS_DOC), {
    ...result,
    savedAt: serverTimestamp(),
  });
}

/**
 * Load the last saved audit result from Firestore.
 */
export async function loadLastAuditResult(): Promise<InventoryAuditResult | null> {
  const snap = await getDoc(doc(db, AUDIT_RESULTS_DOC));
  if (!snap.exists()) return null;
  const data = snap.data();
  // Strip the savedAt field we added
  const { savedAt, ...auditData } = data;
  return auditData as InventoryAuditResult;
}

export interface AuditOptions {
  maxItems?: number;
  focusAreas?: ('data-quality' | 'duplicates' | 'categorization' | 'pricing' | 'stock' | 'corrections')[];
  agentInstructions?: AgentInstructions;
  /** Skip items audited within this many days (0 = audit everything). Default 7. */
  skipIfAuditedWithinDays?: number;
  /** Items per batch sent to the cloud function. Default 30. */
  batchSize?: number;
  /** Progress callback for UI updates */
  onProgress?: (progress: AuditBatchProgress) => void;
}

/**
 * Audit inventory health in batches.
 * Skips items audited within the configured window (default 7 days).
 * Calls the cloud function once per batch and merges results.
 */
export async function auditInventoryHealthAI(
  items: InventoryItem[],
  options?: AuditOptions
): Promise<InventoryAuditResult> {
  const skipDays = options?.skipIfAuditedWithinDays ?? AUDIT_SKIP_DAYS_DEFAULT;
  const batchSize = options?.batchSize ?? AUDIT_BATCH_SIZE;
  const onProgress = options?.onProgress;

  // Filter out recently audited items
  const cutoff = skipDays > 0 ? Date.now() - skipDays * 24 * 60 * 60 * 1000 : 0;
  const eligible: InventoryItem[] = [];
  let skippedCount = 0;

  for (const item of items) {
    if (skipDays > 0 && item.lastAuditedAt) {
      const auditedMs = item.lastAuditedAt.toMillis();
      if (auditedMs > cutoff) {
        skippedCount++;
        continue;
      }
    }
    eligible.push(item);
  }

  if (eligible.length === 0) {
    return {
      summary: {
        totalItems: items.length,
        itemsWithIssues: 0,
        criticalCount: 0,
        warningCount: 0,
        infoCount: 0,
        duplicateGroupCount: 0,
        correctableCount: 0,
        skippedRecentlyAudited: skippedCount,
      },
      issues: [],
      recommendations: [],
      duplicateGroups: [],
      corrections: [],
      aiNotes: `All ${skippedCount} items were audited within the last ${skipDays} days. No new audit needed.`,
    };
  }

  // Chunk eligible items
  const chunks: InventoryItem[][] = [];
  for (let i = 0; i < eligible.length; i += batchSize) {
    chunks.push(eligible.slice(i, i + batchSize));
  }

  const auditFn = httpsCallable<AuditInventoryHealthRequest, AuditInventoryHealthResponse>(
    functions,
    'auditInventoryHealth',
    { timeout: 300_000 }
  );

  // Strip audit-specific options before passing to cloud function
  const cloudOptions: AuditInventoryHealthRequest['options'] = options
    ? { maxItems: options.maxItems, focusAreas: options.focusAreas, agentInstructions: options.agentInstructions }
    : undefined;

  const batchResults: InventoryAuditResult[] = [];
  const auditedItemIds: string[] = [];

  for (let b = 0; b < chunks.length; b++) {
    onProgress?.({
      currentBatch: b + 1,
      totalBatches: chunks.length,
      itemsProcessed: b * batchSize,
      totalItems: eligible.length,
    });

    const slimItems = chunks[b].map(toSlimItem);

    try {
      const result = await auditFn({ items: slimItems, options: cloudOptions });
      if (result.data.success) {
        batchResults.push(result.data.audit);
        auditedItemIds.push(...chunks[b].map(i => i.id));
      }
    } catch (err) {
      console.error(`Audit batch ${b + 1}/${chunks.length} failed:`, err);
      // Continue with remaining batches — partial results are still useful
    }
  }

  // Final progress update
  onProgress?.({
    currentBatch: chunks.length,
    totalBatches: chunks.length,
    itemsProcessed: eligible.length,
    totalItems: eligible.length,
  });

  if (batchResults.length === 0) {
    throw new Error('All audit batches failed');
  }

  // Merge results from all batches
  const merged = mergeAuditResults(batchResults);
  merged.summary.skippedRecentlyAudited = skippedCount;

  // Stamp audited items with lastAuditedAt
  try {
    await stampAuditedItems(auditedItemIds);
  } catch (err) {
    console.warn('Failed to stamp lastAuditedAt on audited items:', err);
  }

  // Merge with previous results for skipped items before saving
  try {
    const previous = await loadLastAuditResult();
    if (previous && skippedCount > 0) {
      // Keep previous issues/corrections/duplicates for items NOT in the current audit
      const auditedIdSet = new Set(auditedItemIds);

      const prevIssues = previous.issues.filter(i => !auditedIdSet.has(i.itemId));
      const prevCorrections = previous.corrections.filter(c => !auditedIdSet.has(c.itemId));
      const prevDuplicateGroups = previous.duplicateGroups.filter(
        g => !auditedIdSet.has(g.primaryItemId)
      );
      const prevRecommendations = previous.recommendations.filter(
        r => !r.affectedItemIds?.length || !r.affectedItemIds.every(id => auditedIdSet.has(id))
      );

      // Combine: new results first, then preserved old results
      merged.issues = [...merged.issues, ...prevIssues];
      merged.corrections = [...merged.corrections, ...prevCorrections];
      merged.duplicateGroups = [...merged.duplicateGroups, ...prevDuplicateGroups];
      merged.recommendations = [...merged.recommendations, ...prevRecommendations];

      // Recalculate summary
      merged.summary.itemsWithIssues = new Set(merged.issues.map(i => i.itemId)).size;
      merged.summary.criticalCount = merged.issues.filter(i => i.severity === 'critical').length;
      merged.summary.warningCount = merged.issues.filter(i => i.severity === 'warning').length;
      merged.summary.infoCount = merged.issues.filter(i => i.severity === 'info').length;
      merged.summary.duplicateGroupCount = merged.duplicateGroups.length;
      merged.summary.correctableCount = merged.corrections.length;
      merged.summary.totalItems = items.length;
      merged.aiNotes = `${merged.aiNotes}\n(Preserved ${skippedCount} previously-audited items' results)`;
    }

    await saveAuditResult(merged);
  } catch (err) {
    console.warn('Failed to save audit results:', err);
  }

  return merged;
}

// ============================================
// Duplicate Resolution
// ============================================

/**
 * Merge duplicate items via cloud function.
 * Combines data from duplicates into primary, optionally archives the rest.
 */
export async function mergeDuplicateItems(
  request: DuplicateMergeRequest
): Promise<DuplicateMergeResult> {
  const mergeFn = httpsCallable<DuplicateMergeRequest, DuplicateMergeResult>(
    functions,
    'mergeInventoryDuplicates',
    { timeout: 120_000 }
  );

  const result = await mergeFn(request);

  if (!result.data.success) {
    throw new Error('Duplicate merge returned unsuccessful response');
  }

  return result.data;
}

// ============================================
// Batch Corrections
// ============================================

/**
 * Apply a batch of corrections to inventory items via cloud function.
 */
export async function applyInventoryCorrections(
  request: ApplyCorrectionsRequest
): Promise<ApplyCorrectionsResponse> {
  const correctFn = httpsCallable<ApplyCorrectionsRequest, ApplyCorrectionsResponse>(
    functions,
    'applyInventoryCorrections',
    { timeout: 120_000 }
  );

  const result = await correctFn(request);

  if (!result.data.success) {
    throw new Error('Corrections returned unsuccessful response');
  }

  return result.data;
}

// ============================================
// Agent Instructions (Firestore persistence)
// ============================================

const AGENT_INSTRUCTIONS_COLLECTION = 'inventoryAgentInstructions';

/**
 * Load saved agent instructions for the current subsidiary/org.
 * Returns the default instructions profile, or built-in defaults if none saved.
 */
export async function loadAgentInstructions(
  subsidiaryId?: string
): Promise<SavedAgentInstructions | null> {
  const colRef = collection(db, AGENT_INSTRUCTIONS_COLLECTION);
  const q = subsidiaryId
    ? query(colRef, where('isDefault', '==', true), where('subsidiaryId', '==', subsidiaryId))
    : query(colRef, where('isDefault', '==', true));

  const snap = await getDocs(q);
  if (snap.empty) return null;

  return { id: snap.docs[0].id, ...snap.docs[0].data() } as SavedAgentInstructions;
}

/**
 * Save or update agent instructions profile.
 */
export async function saveAgentInstructions(
  instructions: AgentInstructions,
  userId: string,
  profileName = 'Default',
  existingId?: string
): Promise<string> {
  const id = existingId || doc(collection(db, AGENT_INSTRUCTIONS_COLLECTION)).id;
  const docRef = doc(db, AGENT_INSTRUCTIONS_COLLECTION, id);

  await setDoc(
    docRef,
    {
      name: profileName,
      instructions,
      isDefault: true,
      updatedAt: serverTimestamp(),
      ...(existingId ? {} : { createdAt: serverTimestamp(), createdBy: userId }),
    },
    { merge: true }
  );

  return id;
}

/**
 * Load all agent instruction profiles.
 */
export async function listAgentInstructionProfiles(): Promise<SavedAgentInstructions[]> {
  const colRef = collection(db, AGENT_INSTRUCTIONS_COLLECTION);
  const snap = await getDocs(colRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedAgentInstructions));
}
