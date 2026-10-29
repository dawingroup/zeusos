import { useEffect, useState } from 'react';

import { subscribeToApprovalRouting } from './service';
import { DEFAULT_APPROVAL_ROUTING, type ApprovalRoutingConfig } from './types';

/**
 * Live approval-routing config. `exists` is false while no document has been
 * saved — the config returned is then the built-in fallback, which is what
 * the Cloud Function is using too.
 */
export function useApprovalRouting(): { config: ApprovalRoutingConfig; exists: boolean; loading: boolean; error: Error | null } {
  const [config, setConfig] = useState<ApprovalRoutingConfig>(DEFAULT_APPROVAL_ROUTING);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsub = subscribeToApprovalRouting(
      (next, docExists) => {
        setConfig(next);
        setExists(docExists);
        setLoading(false);
      },
      (err) => setError(err),
    );
    return unsub;
  }, []);

  return { config, exists, loading, error };
}
