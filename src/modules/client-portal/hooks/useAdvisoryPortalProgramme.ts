/**
 * useAdvisoryPortalProgramme — feeds the portal Advisory dashboard
 * (Naqaa Retail Rollout 2026 and similar multi-store programmes).
 *
 * Reads the same `designProjects` collection as the Finishes line, but
 * looks for `subsidiaryId === 'advisory'` and consumes the optional
 * `programme` + `programmeStores` fields. This keeps the access path
 * (security rules, clientPortalUserIds gate) identical to Finishes —
 * staff don't need to onboard a new collection to expose an advisory
 * project in the portal.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import type {
  DesignProject,
  ProjectProgramme,
  ProgrammeStore,
} from '@/modules/design-manager/types';
import { getPortalProjectByCode } from '@/modules/customer-hub/services/client-portal/clientPortalAccess';
import { assertProjectAccess } from '@/modules/customer-hub/services/client-portal/portalAccessGate';

export interface PortalAdvisoryData {
  project: DesignProject;
  programme: ProjectProgramme;
  stores: ProgrammeStore[];
  openApprovalDueDate: Date | null;
}

interface State {
  data: PortalAdvisoryData | null;
  loading: boolean;
  error: Error | null;
}

export function useAdvisoryPortalProgramme(code: string | undefined): State {
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

        if (project.subsidiaryId !== 'advisory') {
          throw new Error(`Project ${code} is not an advisory programme`);
        }

        if (!project.programme) {
          throw new Error('This advisory project has no programme data yet');
        }

        const stores = project.programmeStores ?? [];
        const due = project.programme.openApproval?.dueDate;
        const openApprovalDueDate = due && typeof (due as any).toDate === 'function'
          ? (due as any).toDate() as Date
          : null;

        if (cancelled) return;
        setState({
          data: { project, programme: project.programme, stores, openApprovalDueDate },
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState({ data: null, loading: false, error: err as Error });
      }
    })();

    return () => { cancelled = true; };
  }, [code, user?.uid]);

  return state;
}
