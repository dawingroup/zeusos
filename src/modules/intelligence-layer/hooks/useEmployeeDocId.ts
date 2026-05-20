/**
 * useEmployeeDocId Hook
 * Resolves Firebase Auth UID to the corresponding employee document ID.
 * Tasks are assigned using employee doc IDs, but useAuth() returns the Firebase Auth UID.
 *
 * Resolution chain:
 *   1. Direct doc lookup (authUid might be the doc ID itself)
 *   2. Query by systemAccess.userId (Firebase Auth UID stored on employee)
 *   3. Query by email (top-level email field on employee)
 *   4. Fallback to authUid (last resort — will likely not match tasks)
 */

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  limit,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';

let cachedMapping: { authUid: string; employeeDocId: string } | null = null;

export function useEmployeeDocId(
  authUid: string | null | undefined,
  email?: string | null
): {
  employeeDocId: string | null;
  loading: boolean;
} {
  const [employeeDocId, setEmployeeDocId] = useState<string | null>(
    cachedMapping && cachedMapping.authUid === authUid ? cachedMapping.employeeDocId : null
  );
  const [loading, setLoading] = useState(!employeeDocId);

  useEffect(() => {
    if (!authUid) {
      setEmployeeDocId(null);
      setLoading(false);
      return;
    }

    if (cachedMapping && cachedMapping.authUid === authUid) {
      setEmployeeDocId(cachedMapping.employeeDocId);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function resolve() {
      setLoading(true);
      try {
        // 1. Try direct doc lookup (authUid might be the doc ID itself)
        const directRef = doc(db, 'employees', authUid!);
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) {
          if (!cancelled) {
            cachedMapping = { authUid: authUid!, employeeDocId: authUid! };
            setEmployeeDocId(authUid!);
            setLoading(false);
          }
          return;
        }

        // 2. Look up by systemAccess.userId
        const uidQuery = query(
          collection(db, 'employees'),
          where('systemAccess.userId', '==', authUid),
          limit(1)
        );
        const uidSnap = await getDocs(uidQuery);
        if (!uidSnap.empty) {
          const docId = uidSnap.docs[0].id;
          if (!cancelled) {
            cachedMapping = { authUid: authUid!, employeeDocId: docId };
            setEmployeeDocId(docId);
            setLoading(false);
          }
          return;
        }

        // 3. Look up by email (top-level email field on employee doc)
        if (email) {
          const emailQuery = query(
            collection(db, 'employees'),
            where('email', '==', email),
            limit(1)
          );
          const emailSnap = await getDocs(emailQuery);
          if (!emailSnap.empty) {
            const docId = emailSnap.docs[0].id;
            if (!cancelled) {
              cachedMapping = { authUid: authUid!, employeeDocId: docId };
              setEmployeeDocId(docId);
              setLoading(false);
            }
            return;
          }
        }

        // 4. Not found — fall back to authUid itself
        console.warn(
          '[useEmployeeDocId] Could not resolve employee doc for authUid:',
          authUid,
          '/ email:',
          email,
          '— falling back to authUid. Tasks may not load correctly.'
        );
        if (!cancelled) {
          cachedMapping = { authUid: authUid!, employeeDocId: authUid! };
          setEmployeeDocId(authUid!);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error resolving employee doc ID:', err);
        if (!cancelled) {
          setEmployeeDocId(authUid!);
          setLoading(false);
        }
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [authUid, email]);

  return { employeeDocId, loading };
}
