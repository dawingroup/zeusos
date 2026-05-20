/**
 * usePortalProjectShell — minimal hook for the shared portal pages
 * (Snags / Interactions / Reports / Messages / Matflow). Resolves the
 * project from the URL `:code` param into a `PortalProject` suitable
 * for the desktop shell (breadcrumb + sidebar). Falls back to the
 * Vela fixture when there's no `:code` (rendered inside `/portal/preview`).
 *
 * Doesn't load any pane-specific data — pages that need approvals /
 * change-orders / programme details should still call their own
 * hooks alongside this.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { DesignProject } from '@/modules/design-manager/types';
import type { PortalProject } from '../components/DesktopShell';
import { VELA_PROJECT, NAQAA_PROJECT } from '../fixtures/projects';
import { getPortalProjectByCode } from '@/modules/customer-hub/services/client-portal/clientPortalAccess';

export interface PortalProjectShell {
  /** The shell-friendly project (sidebar + breadcrumb). */
  project: PortalProject;
  /** True while resolving the project from Firestore. */
  loading: boolean;
  /** Raw DesignProject when available (live mode) — null in mock mode. */
  raw: DesignProject | null;
}

export function usePortalProjectShell(): PortalProjectShell {
  const params = useParams<{ code?: string }>();
  const [state, setState] = useState<PortalProjectShell>({
    project: VELA_PROJECT,
    loading: !!params.code,
    raw: null,
  });

  useEffect(() => {
    if (!params.code) {
      setState({ project: VELA_PROJECT, loading: false, raw: null });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = await getPortalProjectByCode(params.code!);
        if (cancelled) return;
        if (!p) {
          // Project not found — fall back to a stub so the shell still
          // renders rather than throwing the page on the floor.
          setState({
            project: {
              slug: params.code!,
              name: params.code!,
              tag: params.code!,
              sub: '',
              line: 'finishes',
            },
            loading: false,
            raw: null,
          });
          return;
        }
        setState({
          project: {
            slug: p.code,
            name: p.name,
            tag: p.code,
            sub: p.customerName,
            line: p.subsidiaryId === 'advisory' ? 'advisory' : 'finishes',
          },
          loading: false,
          raw: p,
        });
      } catch {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [params.code]);

  return state;
}

// Convenience for the named-wrapper exports that still want to fall
// back to a fixed line-specific fixture (used by /portal/preview).
export const PORTAL_LINE_FIXTURES = {
  finishes: VELA_PROJECT,
  advisory: NAQAA_PROJECT,
} as const;
