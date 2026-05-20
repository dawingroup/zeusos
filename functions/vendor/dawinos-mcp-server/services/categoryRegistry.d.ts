/**
 * Category Registry — Dynamic category validation with caching.
 *
 * Replaces the hardcoded INVENTORY_CATEGORIES enum. Fetches active categories
 * from Firestore's inventoryCategories collection and caches for 60s.
 */
interface CategoryInfo {
    slug: string;
    name: string;
    allowItems: boolean;
    expenseOnIssue: boolean;
    parentSlug: string | null;
}
/**
 * Get the current list of valid category slugs (active + allowItems).
 * Cached for 60s.
 */
export declare function getValidCategorySlugs(): Promise<string[]>;
/**
 * Get full category info list (active + allowItems).
 */
export declare function getValidCategories(): Promise<CategoryInfo[]>;
/**
 * Get a pipe-separated description string for tool schema descriptions.
 */
export declare function getCategoryDescription(): Promise<string>;
/**
 * Validate a category slug. Returns error string or null if valid.
 */
export declare function validateCategorySlug(slug: string): Promise<string | null>;
/**
 * Force cache refresh — call after category CRUD operations.
 */
export declare function invalidateCategoryCache(): void;
export {};
//# sourceMappingURL=categoryRegistry.d.ts.map