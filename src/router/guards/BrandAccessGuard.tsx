/**
 * BrandAccessGuard — ADR-2026-05-25 §2.Q2 (UI layer, step 4.3).
 *
 * Replaces `ParentOrgGuard` on client-scoped commercial routes. The
 * gate accepts the user when either:
 *   - they are a PARENT-org principal (admin/owner with `zeus-group`
 *     subsidiary access — preserves Phase 3.A.5 behaviour), OR
 *   - they are a SUBSIDIARY principal whose `homeOrgId` matches the
 *     client's `primaryBrandId` ("home brand AD" path).
 *
 * Routes that DON'T have a clientId in their URL (e.g. `/clients`,
 * `/master-jobs` lists) keep using ParentOrgGuard — the list views
 * are still parent-org-only since they expose the full client roster.
 * Per-client detail routes (`/clients/:clientId`, `/clients/:clientId/msas/:msaId`)
 * use this guard.
 *
 * Mirrors:
 *   • firestore.rules `canActOnClient(clientId)` (layer 1, PR #93)
 *   • assertCommercialPrincipal in Cloud Functions (layer 2, PR #95)
 */

import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import { useCurrentDawinUser } from '@/core/settings';
import { useAuth } from '@/shared/hooks';
import { FullPageLoader } from '@/shared/components/feedback/FullPageLoader';

const PARENT_ORG_ID = 'zeus-group';

interface Props {
  children: React.ReactNode;
  /**
   * Override which URL param holds the client id. Defaults to
   * `clientId` — works for `/clients/:clientId/*` routes. Pass
   * `'masterJobId'` for routes that key on the master_job and let
   * the guard resolve clientId via `master_jobs/{id}.clientId`.
   */
  clientIdParam?: string;
  /**
   * When the URL carries a masterJobId / sowId / msaId instead of a
   * clientId, set `resolveVia` and the guard will dereference the
   * FK. Defaults to 'direct' (clientIdParam IS the clientId).
   */
  resolveVia?: 'direct' | 'master_jobs' | 'msas' | 'sows';
}

type GuardState =
  | { status: 'pending' }
  | { status: 'allow' }
  | { status: 'deny' };

export function BrandAccessGuard({ children, clientIdParam = 'clientId', resolveVia = 'direct' }: Props) {
  const { user } = useAuth();
  const { dawinUser, isLoading: userLoading } = useCurrentDawinUser();
  const params = useParams<Record<string, string | undefined>>();
  const aggregateId = params[clientIdParam];
  const [state, setState] = useState<GuardState>({ status: 'pending' });

  useEffect(() => {
    let cancelled = false;

    async function evaluate() {
      if (userLoading || !user || !dawinUser) {
        setState({ status: 'pending' });
        return;
      }

      // Path 1 — parent-org principal (admin/owner with zeus-group
      // membership). Always allow.
      const isParent =
        ['admin', 'owner', 'super_admin'].includes(dawinUser.globalRole) &&
        Array.isArray(dawinUser.subsidiaryAccess) &&
        dawinUser.subsidiaryAccess.some(
          (s) => s.subsidiaryId === PARENT_ORG_ID && s.hasAccess,
        );
      if (isParent) {
        if (!cancelled) setState({ status: 'allow' });
        return;
      }

      // Path 2 — brand-direct. Need the URL param + the user's home
      // brand to evaluate.
      if (!aggregateId) {
        if (!cancelled) setState({ status: 'deny' });
        return;
      }
      const userHomeOrg = (dawinUser as { homeOrgId?: string }).homeOrgId
        ?? dawinUser.subsidiaryAccess.find((s) => s.hasAccess && s.subsidiaryId !== PARENT_ORG_ID)?.subsidiaryId;
      if (!userHomeOrg) {
        if (!cancelled) setState({ status: 'deny' });
        return;
      }

      try {
        let clientId: string | null = null;
        if (resolveVia === 'direct') {
          clientId = aggregateId;
        } else {
          // Look up the aggregate doc and read clientId off it.
          const collectionPath = resolveVia; // 'master_jobs' | 'msas' | 'sows'
          const snap = await getDoc(doc(db, collectionPath, aggregateId));
          if (snap.exists()) {
            clientId = (snap.data() as { clientId?: string }).clientId ?? null;
          }
        }
        if (!clientId) {
          if (!cancelled) setState({ status: 'deny' });
          return;
        }
        const clientSnap = await getDoc(doc(db, 'clients', clientId));
        if (!clientSnap.exists()) {
          if (!cancelled) setState({ status: 'deny' });
          return;
        }
        const primaryBrandId = (clientSnap.data() as { primaryBrandId?: string }).primaryBrandId;
        if (primaryBrandId && primaryBrandId === userHomeOrg) {
          if (!cancelled) setState({ status: 'allow' });
        } else {
          if (!cancelled) setState({ status: 'deny' });
        }
      } catch {
        if (!cancelled) setState({ status: 'deny' });
      }
    }

    evaluate();
    return () => { cancelled = true; };
  }, [user, dawinUser, userLoading, aggregateId, resolveVia]);

  if (state.status === 'pending') {
    return <FullPageLoader />;
  }
  if (state.status === 'deny') {
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
}

export default BrandAccessGuard;
