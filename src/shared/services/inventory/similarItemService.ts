/**
 * Shared Similar Item Service
 *
 * Generalised inventory item similarity search used by:
 * - PO line item alternative finder (procurement)
 * - BOM substitution (manufacturing)
 *
 * Five-tier matching (highest confidence first):
 *   1. Family siblings (same familyId)
 *   2. Engineering parent siblings (same engineeringParentId)
 *   3. Alias / tag overlap (items whose aliases or tags match the query name/description)
 *   4. Category + subcategory peers
 *   5. Optional AI semantic search via Gemini embeddings
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';

const INVENTORY_ITEMS_COLLECTION = 'inventoryItems';

// ============================================
// Types
// ============================================

/**
 * Generic query input — works for both PO line items and BOM entries.
 */
export interface SimilarItemQuery {
  inventoryItemId?: string;
  category?: string;
  subcategory?: string;
  description?: string;
  sku?: string;
  name?: string;
}

/**
 * A potential substitute inventory item.
 */
export interface SimilarInventoryItem {
  id: string;
  sku: string;
  name: string;
  displayName?: string;
  category: string;
  subcategory?: string;
  brand?: string;
  unitCost: number;
  currency: string;
  unit: string;
  inStock: number;
  matchReason: string;
  familyId?: string;
  /** Relevance score 0-1 — used for sorting when multiple match tiers are combined */
  relevance?: number;
  /** Quality tier from vendor sources or structured name */
  qualityTier?: string;
}

// ============================================
// Core structural search
// ============================================

/**
 * Find inventory items that can substitute for a given item.
 * Matches by: family → engineering parent → aliases/tags → category+subcategory.
 */
export async function findSimilarItems(
  itemQuery: SimilarItemQuery,
): Promise<SimilarInventoryItem[]> {
  const results: SimilarInventoryItem[] = [];
  const seenIds = new Set<string>();

  const sourceItemId = itemQuery.inventoryItemId;

  // 1. If we have a source item, fetch it for metadata
  let sourceItem: Record<string, unknown> | null = null;
  if (sourceItemId && !sourceItemId.includes(':')) {
    const snap = await getDoc(doc(db, INVENTORY_ITEMS_COLLECTION, sourceItemId));
    if (snap.exists()) {
      sourceItem = { id: snap.id, ...snap.data() };
      seenIds.add(snap.id);
    }
  }

  const category = (sourceItem?.category as string) ?? itemQuery.category;
  const subcategory = (sourceItem?.subcategory as string) ?? itemQuery.subcategory;
  const familyId = sourceItem?.familyId as string | undefined;
  const engineeringParentId = sourceItem?.engineeringParentId as string | undefined;
  const sourceTags = (sourceItem?.tags as string[]) ?? [];
  const sourceAliases = (sourceItem?.aliases as string[]) ?? [];

  // Build keywords from query for alias/tag matching
  const queryKeywords = buildKeywords(
    itemQuery.name,
    itemQuery.description,
    sourceItem?.name as string | undefined,
    sourceItem?.displayName as string | undefined,
  );

  // Helper: skip discontinued items (items without a status field are treated as active)
  const isAvailable = (data: Record<string, unknown>) => data.status !== 'discontinued';

  // 2. Query by same family (sibling SKUs) — highest confidence
  if (familyId) {
    const familyQ = query(
      collection(db, INVENTORY_ITEMS_COLLECTION),
      where('familyId', '==', familyId),
    );
    const familySnap = await getDocs(familyQ);
    for (const d of familySnap.docs) {
      if (seenIds.has(d.id)) continue;
      const data = d.data();
      if (!isAvailable(data)) continue;
      seenIds.add(d.id);
      results.push(mapToSimilarItem(d.id, data, 'Same product family', 1.0));
    }
  }

  // 3. Query by same engineering parent (purchasing-tier siblings)
  if (engineeringParentId) {
    const engQ = query(
      collection(db, INVENTORY_ITEMS_COLLECTION),
      where('engineeringParentId', '==', engineeringParentId),
    );
    const engSnap = await getDocs(engQ);
    for (const d of engSnap.docs) {
      if (seenIds.has(d.id)) continue;
      const data = d.data();
      if (!isAvailable(data)) continue;
      seenIds.add(d.id);
      results.push(mapToSimilarItem(d.id, data, 'Same engineering group', 0.9));
    }
  }

  // 4. Query by same category + subcategory — then score by alias/tag/keyword overlap
  if (category) {
    const constraints: QueryConstraint[] = [
      where('category', '==', category),
    ];
    if (subcategory) {
      constraints.push(where('subcategory', '==', subcategory));
    }
    const catQ = query(collection(db, INVENTORY_ITEMS_COLLECTION), ...constraints);
    const catSnap = await getDocs(catQ);
    for (const d of catSnap.docs) {
      if (seenIds.has(d.id)) continue;
      const data = d.data();
      if (!isAvailable(data)) continue;
      if (data.isFamily || data.isOrderable === false) continue;
      seenIds.add(d.id);

      // Check for alias/tag overlap to boost relevance
      const itemTags = (data.tags as string[]) ?? [];
      const itemAliases = (data.aliases as string[]) ?? [];
      const itemName = (data.name as string) ?? '';
      const itemDisplayName = (data.displayName as string) ?? '';

      const { score, reason } = scoreMatch(
        queryKeywords,
        sourceTags,
        sourceAliases,
        itemTags,
        itemAliases,
        itemName,
        itemDisplayName,
        category,
        subcategory,
      );

      results.push(mapToSimilarItem(d.id, data, reason, score));
    }
  }

  // Sort: relevance desc → in-stock first → unit cost ascending
  return results.sort((a, b) => {
    const relDiff = (b.relevance ?? 0) - (a.relevance ?? 0);
    if (Math.abs(relDiff) > 0.05) return relDiff;
    if (a.inStock > 0 && b.inStock <= 0) return -1;
    if (a.inStock <= 0 && b.inStock > 0) return 1;
    return a.unitCost - b.unitCost;
  });
}

// ============================================
// Enhanced search with optional semantic layer
// ============================================

/**
 * Find similar items with an optional semantic search enhancement.
 * Structural matches are returned first, semantic matches appended.
 */
export async function findSimilarItemsEnhanced(
  itemQuery: SimilarItemQuery,
  options?: { semanticSearch?: boolean },
): Promise<SimilarInventoryItem[]> {
  // Always run structural search
  const structuralResults = await findSimilarItems(itemQuery);

  if (!options?.semanticSearch) return structuralResults;

  // Semantic search — lazy-import to avoid loading embedding code on every call
  try {
    const { searchInventoryBySimilarity } = await import(
      '@/shared/services/ai/semanticSearchService'
    );

    const searchText = [
      itemQuery.name,
      itemQuery.description,
      itemQuery.sku,
      itemQuery.category,
      itemQuery.subcategory,
    ]
      .filter(Boolean)
      .join(' ');

    if (!searchText.trim()) return structuralResults;

    const semanticResults = await searchInventoryBySimilarity(searchText, 10);

    // Merge: deduplicate by id, structural results take priority
    const seenIds = new Set(structuralResults.map((r) => r.id));
    if (itemQuery.inventoryItemId) seenIds.add(itemQuery.inventoryItemId);

    for (const sr of semanticResults) {
      if (seenIds.has(sr.id)) continue;
      seenIds.add(sr.id);
      structuralResults.push({
        ...sr,
        matchReason: `AI similarity (${Math.round(sr.score * 100)}%)`,
        relevance: sr.score * 0.7, // scale AI scores below structural matches
      });
    }

    return structuralResults;
  } catch (err) {
    console.warn('Semantic search unavailable, returning structural results only:', err);
    return structuralResults;
  }
}

// ============================================
// Keyword / alias / tag scoring
// ============================================

/**
 * Build a normalised keyword set from names and descriptions.
 */
function buildKeywords(...texts: (string | undefined)[]): Set<string> {
  const keywords = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);
    for (const w of words) keywords.add(w);
  }
  return keywords;
}

/**
 * Score a candidate item against the source item's keywords, tags, and aliases.
 * Returns a relevance score (0-1) and a human-readable match reason.
 */
function scoreMatch(
  queryKeywords: Set<string>,
  sourceTags: string[],
  sourceAliases: string[],
  itemTags: string[],
  itemAliases: string[],
  itemName: string,
  itemDisplayName: string,
  category: string,
  subcategory?: string,
): { score: number; reason: string } {
  let score = 0.4; // base score for category match
  const reasons: string[] = [];

  if (subcategory) {
    score += 0.1;
  }

  // Tag overlap
  const tagOverlap = sourceTags.filter((t) =>
    itemTags.some((it) => it.toLowerCase() === t.toLowerCase()),
  );
  if (tagOverlap.length > 0) {
    score += Math.min(tagOverlap.length * 0.1, 0.2);
    reasons.push(`${tagOverlap.length} shared tag${tagOverlap.length > 1 ? 's' : ''}`);
  }

  // Alias match — check if any source alias appears in the candidate name/aliases
  const aliasMatch = sourceAliases.some(
    (a) =>
      itemName.toLowerCase().includes(a.toLowerCase()) ||
      itemDisplayName.toLowerCase().includes(a.toLowerCase()) ||
      itemAliases.some((ia) => ia.toLowerCase() === a.toLowerCase()),
  );
  if (aliasMatch) {
    score += 0.15;
    reasons.push('alias match');
  }

  // Keyword overlap — how many query keywords appear in the candidate name
  if (queryKeywords.size > 0) {
    const candidateKeywords = buildKeywords(itemName, itemDisplayName);
    const overlap = [...queryKeywords].filter((k) => candidateKeywords.has(k));
    const overlapRatio = overlap.length / queryKeywords.size;
    if (overlapRatio > 0.3) {
      score += overlapRatio * 0.15;
      reasons.push(`${Math.round(overlapRatio * 100)}% keyword match`);
    }
  }

  const reason =
    reasons.length > 0
      ? `${subcategory ? `${subcategory}` : category} — ${reasons.join(', ')}`
      : subcategory
        ? `Same category & subcategory (${subcategory})`
        : `Same category (${category})`;

  return { score: Math.min(score, 0.85), reason };
}

// ============================================
// Helpers
// ============================================

function mapToSimilarItem(
  id: string,
  data: Record<string, unknown>,
  matchReason: string,
  relevance: number,
): SimilarInventoryItem {
  const pricing = data.pricing as Record<string, unknown> | undefined;
  const inventory = data.inventory as Record<string, unknown> | undefined;
  const structuredName = data.structuredName as Record<string, string> | undefined;
  return {
    id,
    sku: (data.sku as string) ?? '',
    name: (data.name as string) ?? '',
    displayName: data.displayName as string | undefined,
    category: (data.category as string) ?? '',
    subcategory: data.subcategory as string | undefined,
    brand: data.brand as string | undefined,
    unitCost: (pricing?.costPerUnit as number) ?? 0,
    currency: (pricing?.currency as string) ?? 'UGX',
    unit: (pricing?.unit as string) ?? 'ea',
    inStock: (inventory?.inStock as number) ?? 0,
    matchReason,
    familyId: data.familyId as string | undefined,
    relevance,
    qualityTier: structuredName?.qualityTier,
  };
}
