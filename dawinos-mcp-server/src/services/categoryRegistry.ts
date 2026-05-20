/**
 * Category Registry — Dynamic category validation with caching.
 *
 * Replaces the hardcoded INVENTORY_CATEGORIES enum. Fetches active categories
 * from Firestore's inventoryCategories collection and caches for 60s.
 */

import { getDb } from './firebase.js';

interface CategoryInfo {
  slug: string;
  name: string;
  allowItems: boolean;
  expenseOnIssue: boolean;
  parentSlug: string | null;
}

let cachedSlugs: string[] = [];
let cachedCategories: CategoryInfo[] = [];
let lastRefresh = 0;
const CACHE_TTL_MS = 60_000;

/**
 * Get the current list of valid category slugs (active + allowItems).
 * Cached for 60s.
 */
export async function getValidCategorySlugs(): Promise<string[]> {
  await refreshIfStale();
  return cachedSlugs;
}

/**
 * Get full category info list (active + allowItems).
 */
export async function getValidCategories(): Promise<CategoryInfo[]> {
  await refreshIfStale();
  return cachedCategories;
}

/**
 * Get a pipe-separated description string for tool schema descriptions.
 */
export async function getCategoryDescription(): Promise<string> {
  const slugs = await getValidCategorySlugs();
  return slugs.join(' | ');
}

/**
 * Validate a category slug. Returns error string or null if valid.
 */
export async function validateCategorySlug(slug: string): Promise<string | null> {
  const valid = await getValidCategorySlugs();
  if (valid.includes(slug)) return null;
  return `Invalid category "${slug}". Valid categories: ${valid.join(', ')}`;
}

/**
 * Force cache refresh — call after category CRUD operations.
 */
export function invalidateCategoryCache(): void {
  lastRefresh = 0;
}

async function refreshIfStale(): Promise<void> {
  if (Date.now() - lastRefresh < CACHE_TTL_MS && cachedSlugs.length > 0) return;

  const db = getDb();
  // Single equality filter + orderBy → satisfied by Firestore's automatic
  // single-field index. `allowItems` is applied in-memory below. The collection
  // is small (<50 docs) and results are cached for CACHE_TTL_MS, so the extra
  // rows cost nothing and we avoid a composite-index dependency on this query.
  const snap = await db.collection('inventoryCategories')
    .where('isActive', '==', true)
    .orderBy('sortOrder')
    .get();

  cachedCategories = snap.docs
    .map(d => {
      const data = d.data();
      return {
        slug: d.id,
        name: data.name,
        allowItems: data.allowItems === true,
        expenseOnIssue: data.expenseOnIssue ?? false,
        parentSlug: data.parentSlug ?? null,
      };
    })
    .filter(c => c.allowItems);
  cachedSlugs = cachedCategories.map(c => c.slug);
  lastRefresh = Date.now();
}
