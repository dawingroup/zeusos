/**
 * useUnassignedWork — open work that belongs to nobody.
 *
 * The daily focus loop can only plan work that has an owner. The hygiene run
 * places `pending_assignment` work every 30 minutes; what it could not place
 * (a role nobody holds, no owner configured) sits here until a manager acts.
 * Read-only: assigning stays a deliberate act.
 */

import { useCallback, useEffect, useState } from 'react';

import { EMPTY_UNASSIGNED, fetchUnassignedSummary, type UnassignedSummary } from '../services/tasksService';

export function useUnassignedWork() {
  const [summary, setSummary] = useState<UnassignedSummary>(EMPTY_UNASSIGNED);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchUnassignedSummary());
    } catch (err) {
      console.warn('[useUnassignedWork] load failed:', err);
      setError(err instanceof Error ? err.message : 'Could not read unassigned work');
      setSummary(EMPTY_UNASSIGNED);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { summary, loading, error, reload: load };
}
