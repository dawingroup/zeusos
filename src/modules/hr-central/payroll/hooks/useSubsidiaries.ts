/**
 * useSubsidiaries
 *
 * Lightweight one-shot fetcher for the `subsidiaries` collection.
 * Returns both an array (for menus / iteration) and an ID-to-name map
 * (for resolving snapshotted IDs on payroll records and the cost-
 * allocation footnote on payslips). Cached at module scope so the
 * common pages don't re-hit Firestore on every mount.
 */

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';

export interface SubsidiarySummary {
  id: string;
  name: string;
  code?: string;
}

let cache: SubsidiarySummary[] | null = null;
let inflight: Promise<SubsidiarySummary[]> | null = null;

async function fetchSubsidiaries(): Promise<SubsidiarySummary[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    // Prefer active records when the field exists; fall back to all if
    // not (some seed data predates the field).
    let snap;
    try {
      snap = await getDocs(query(collection(db, 'subsidiaries'), where('active', '==', true)));
      if (snap.empty) {
        snap = await getDocs(collection(db, 'subsidiaries'));
      }
    } catch {
      snap = await getDocs(collection(db, 'subsidiaries'));
    }
    const list: SubsidiarySummary[] = snap.docs.map(d => {
      const data = d.data() as { name?: string; code?: string };
      return { id: d.id, name: data.name || d.id, code: data.code };
    });
    list.sort((a, b) => a.name.localeCompare(b.name));
    cache = list;
    return list;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

interface UseSubsidiariesReturn {
  subsidiaries: SubsidiarySummary[];
  nameMap: Record<string, string>;
  loading: boolean;
  error: string | null;
}

export function useSubsidiaries(): UseSubsidiariesReturn {
  const [subsidiaries, setSubsidiaries] = useState<SubsidiarySummary[]>(cache || []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    fetchSubsidiaries()
      .then(list => { if (!cancelled) { setSubsidiaries(list); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Failed'); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const nameMap = subsidiaries.reduce<Record<string, string>>((acc, s) => {
    acc[s.id] = s.name;
    return acc;
  }, {});

  return { subsidiaries, nameMap, loading, error };
}
