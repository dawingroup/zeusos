/**
 * SearchIndexMount — zero-DOM component that wires the SearchIndexManager
 * singleton to React state.
 *
 * Mount once near the root of the authenticated tree (inside AppShell, after
 * GlobalProvider + SubsidiaryProvider). It:
 *
 *   1. Reads the active organizationId + subsidiaryId.
 *   2. Reads the GLOBAL_SEARCH_V2 feature flag.
 *   3. When flag is ON and both ids are present, calls
 *      `searchIndex.attachSubsidiary(orgId, subsidiaryId)`.
 *   4. Re-attaches on subsidiary change (singleton handles teardown).
 *   5. Detaches on unmount or when the flag flips off.
 */

import { useEffect } from 'react';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import { useAuth } from '@/integration/store';
import { searchIndex } from '@/core/services/search/searchIndex';

export function SearchIndexMount(): null {
  const enabled = useFeatureFlag('GLOBAL_SEARCH_V2');
  const { currentSubsidiary } = useSubsidiary();
  const { user } = useAuth();
  const organizationId =
    (user as { organizationId?: string } | null)?.organizationId || 'default';
  const subsidiaryId = currentSubsidiary?.id;

  useEffect(() => {
    if (!enabled || !subsidiaryId) {
      searchIndex.detach();
      return;
    }
    void searchIndex.attachSubsidiary(organizationId, subsidiaryId);
    return () => {
      // We don't detach on every effect tear-down; the singleton's
      // attachSubsidiary is idempotent and will tear down on key change.
      // Detach only when the component is unmounted.
    };
  }, [enabled, organizationId, subsidiaryId]);

  // Detach on unmount.
  useEffect(() => {
    return () => searchIndex.detach();
  }, []);

  return null;
}
