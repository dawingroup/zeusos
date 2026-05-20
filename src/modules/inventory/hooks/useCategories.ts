/**
 * useCategories Hook
 * Subscribe to inventory categories from Firestore with tree-building utilities.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  subscribeToCategories,
  type CategoryDoc,
} from '../services/categoryService';

export interface CategoryNode extends CategoryDoc {
  children: CategoryNode[];
}

interface UseCategoriesResult {
  categories: CategoryDoc[];
  tree: CategoryNode[];
  loading: boolean;
  error: Error | null;
  /** Flat list of active categories that allow items (for dropdowns). */
  selectableCategories: CategoryDoc[];
  /** Map of slug → CategoryDoc for quick lookup. */
  bySlug: Map<string, CategoryDoc>;
}

function buildTree(categories: CategoryDoc[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];

  // Create nodes
  for (const cat of categories) {
    map.set(cat.slug, { ...cat, children: [] });
  }

  // Build parent-child relationships
  for (const cat of categories) {
    const node = map.get(cat.slug)!;
    if (cat.parentSlug && map.has(cat.parentSlug)) {
      map.get(cat.parentSlug)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function useCategories(): UseCategoriesResult {
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToCategories(
      (cats) => {
        setCategories(cats);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  const tree = useMemo(() => buildTree(categories), [categories]);

  const selectableCategories = useMemo(
    () => categories.filter((c) => c.isActive && c.allowItems),
    [categories],
  );

  const bySlug = useMemo(() => {
    const m = new Map<string, CategoryDoc>();
    for (const c of categories) m.set(c.slug, c);
    return m;
  }, [categories]);

  return { categories, tree, loading, error, selectableCategories, bySlug };
}
