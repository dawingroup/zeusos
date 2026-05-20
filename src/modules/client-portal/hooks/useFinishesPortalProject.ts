/**
 * useFinishesPortalProject — loads everything the Finishes dashboard,
 * approvals card, financials snapshot, and "Up next" table need to
 * render, from a project `code` (slug used in `/portal/p/:code/...`).
 *
 * Returns `null` while loading, throws if the user doesn't have access.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import type { DesignProject, ProjectMilestone } from '@/modules/design-manager/types';
import type { SalesOrder } from '@/modules/sales-orders/types';
import {
  getPortalProjectByCode,
  getSalesOrderForProject,
  getSalesOrderById,
  getOpenApprovalsForSalesOrder,
} from '@/modules/customer-hub/services/client-portal/clientPortalAccess';
import { assertProjectAccess, isPortalStaff } from '@/modules/customer-hub/services/client-portal/portalAccessGate';

export interface PortalDashboardData {
  project: DesignProject;
  salesOrder: SalesOrder | null;
  openApprovals: { signOffCount: number; changeOrderCount: number; nextDue: Date | null };
  nextMilestones: ProjectMilestone[];
}

interface State {
  data: PortalDashboardData | null;
  loading: boolean;
  error: Error | null;
}

export function useFinishesPortalProject(code: string | undefined): State {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    if (!code) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    (async () => {
      try {
        const project = await getPortalProjectByCode(code);
        if (!project) throw new Error(`Project ${code} not found`);

        assertProjectAccess(user, project);

        // Resolve the SO either via the link on the project or by reverse-lookup.
        let salesOrder: SalesOrder | null = null;
        if (project.linkedSalesOrderId) {
          salesOrder = await getSalesOrderById(project.linkedSalesOrderId);
        }
        if (!salesOrder) {
          salesOrder = await getSalesOrderForProject(project.id);
        }

        const openApprovals = salesOrder
          ? await getOpenApprovalsForSalesOrder(salesOrder.id)
          : { signOffCount: 0, changeOrderCount: 0, nextDue: null };

        const nextMilestones = sortMilestones(project.milestones ?? []).slice(0, 6);

        if (cancelled) return;
        setState({
          data: { project, salesOrder, openApprovals, nextMilestones },
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState({ data: null, loading: false, error: err as Error });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, user?.uid]);

  return state;
}

function sortMilestones(ms: ProjectMilestone[]): ProjectMilestone[] {
  return [...ms].sort((a, b) => {
    const aMs = a.date?.toMillis?.() ?? 0;
    const bMs = b.date?.toMillis?.() ?? 0;
    return aMs - bMs;
  });
}

/**
 * Lists projects the current authenticated user has portal access to.
 */
export function useUserPortalProjects(): { projects: DesignProject[]; loading: boolean; error: Error | null } {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<{ projects: DesignProject[]; loading: boolean; error: Error | null }>({
    projects: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user?.uid) {
      setState({ projects: [], loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));

    (async () => {
      try {
        const { getPortalProjectsForUser, getAllPortalProjectsForStaff } = await import('@/modules/customer-hub/services/client-portal/clientPortalAccess');
        // Staff see every active project (preview-as-client); clients see
        // only the projects they're whitelisted on.
        const projects = isPortalStaff(user)
          ? await getAllPortalProjectsForStaff()
          : await getPortalProjectsForUser(user.uid);
        if (cancelled) return;
        setState({ projects, loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setState({ projects: [], loading: false, error: err as Error });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, authLoading]);

  return state;
}
