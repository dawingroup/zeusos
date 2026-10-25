/**
 * useDirectReports — the people a manager plans for.
 *
 * The resolution chain is deliberately forgiving: reporting lines are
 * incompletely filled in on real employee docs, and a manager who sees nobody
 * cannot run the evening review at all.
 *
 *   1. `position.reportingTo == <my employee doc id>` — the real line.
 *   2. A parent-org principal (Account Management) with no reports of their
 *      own sees every working employee, flagged `isFallback`.
 *
 * Each report resolves to the uid their tasks and plans are keyed by:
 * `systemAccess.userId`, else the shared people directory (by email).
 */

import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';

import { db } from '@/shared/services/firebase/firestore';
import { useCurrentDawinUser } from '@/core/settings';
import { lookupPerson } from '@/shared/people';
import { isParentOrgUser } from '@/modules/delivery/components/deliveryAccess';
import { withTimeout } from '@/shared/utils/withTimeout';

const WORKING_STATUSES = ['active', 'probation', 'notice_period'];
const MAX_TEAM = 60;

export interface DirectReport {
  /** Employee doc id. */
  id: string;
  /** The sign-in uid plans and tasks are keyed by, when the person has one. */
  uid: string | null;
  name: string;
  email?: string | null;
  jobTitle?: string;
  department?: string;
  subsidiaryId?: string | null;
  /** Their manager's employee doc id (`position.reportingTo`), when filled in. */
  managerEmployeeId?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toReport(id: string, e: Record<string, any>): DirectReport {
  const email: string | null = e.email || e.workEmail || e.systemAccess?.email || null;
  const linked: string | null = e.systemAccess?.userId ?? null;
  const fromDirectory = lookupPerson(email)?.uid || lookupPerson(id)?.uid || null;
  return {
    id,
    uid: fromDirectory || linked || null,
    name: e.fullName || [e.firstName, e.lastName].filter(Boolean).join(' ') || e.displayName || 'Unnamed',
    email,
    jobTitle: e.position?.title || '',
    department: e.position?.departmentId || '',
    subsidiaryId: e.subsidiaryId || e.subsidiary || null,
    managerEmployeeId: e.position?.reportingTo || e.reportingTo || null,
  };
}

/** My employee doc id: a doc linked to my uid, else one with my email. */
async function resolveMyEmployeeId(uid: string, email: string | null | undefined): Promise<string | null> {
  const employeesRef = collection(db, 'employees');
  const byUid = await getDocs(query(employeesRef, where('systemAccess.userId', '==', uid), limit(1)));
  if (!byUid.empty) return byUid.docs[0].id;
  if (email) {
    const byEmail = await getDocs(query(employeesRef, where('email', '==', email), limit(1)));
    if (!byEmail.empty) return byEmail.docs[0].id;
  }
  return null;
}

export function useDirectReports() {
  const { dawinUser } = useCurrentDawinUser();
  const uid = dawinUser?.uid ?? null;
  const email = dawinUser?.email ?? null;
  const parentOrg = dawinUser ? isParentOrgUser(dawinUser) : false;

  const [reports, setReports] = useState<DirectReport[]>([]);
  const [isFallback, setIsFallback] = useState(false);
  const [myEmployeeId, setMyEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) {
      setReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const employeesRef = collection(db, 'employees');
      const mine = await withTimeout(resolveMyEmployeeId(uid, email), 'Load');
      setMyEmployeeId(mine);
      let docs: { id: string; data: () => Record<string, unknown> }[] = [];
      let fallback = false;
      if (mine) {
        const teamQuery = query(
          employeesRef,
          where('employmentStatus', 'in', WORKING_STATUSES),
          where('position.reportingTo', '==', mine),
          limit(MAX_TEAM),
        );
        docs = (await withTimeout(getDocs(teamQuery), 'Load')).docs;
      }
      if (docs.length === 0 && parentOrg) {
        const allActive = query(employeesRef, where('employmentStatus', 'in', WORKING_STATUSES), limit(MAX_TEAM));
        docs = (await withTimeout(getDocs(allActive), 'Load')).docs;
        fallback = true;
      }
      setReports(
        docs
          .map((d) => toReport(d.id, d.data()))
          .filter((r) => r.id !== mine && r.uid !== uid)
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setIsFallback(fallback);
    } catch (err) {
      console.error('[useDirectReports] failed to load team:', err);
      setError(err instanceof Error ? err.message : 'Failed to load team');
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [uid, email, parentOrg]);

  useEffect(() => {
    void load();
  }, [load]);

  return { reports, isFallback, loading, error, managerUid: uid, myEmployeeId, isParentOrg: parentOrg, reload: load };
}
