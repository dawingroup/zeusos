/**
 * useMOCascadeTree — real-time parent+children tree for a single MO.
 *
 * Built for the Phase 4 cascade panel on ManufacturingOrderDetailPage.
 * Returns the parent (if any), the root MO itself, all direct children
 * spawned by change-order cascades, and the set of distinct CO ids
 * that produced those children.
 */

import { useEffect, useState } from 'react';
import {
  subscribeToCascadeTree,
  type MOCascadeTree,
} from '../services/moCascadeService';

export interface UseMOCascadeTreeResult {
  tree: MOCascadeTree | null;
  loading: boolean;
}

export function useMOCascadeTree(moId: string | undefined | null): UseMOCascadeTreeResult {
  const [tree, setTree] = useState<MOCascadeTree | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(moId));

  useEffect(() => {
    if (!moId) {
      setTree(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToCascadeTree(moId, (t) => {
      setTree(t);
      setLoading(false);
    });
    return unsub;
  }, [moId]);

  return { tree, loading };
}
