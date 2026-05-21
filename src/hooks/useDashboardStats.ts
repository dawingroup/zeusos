/**
 * useDashboardStats Hook
 * Fetches real Firestore counts for the unified dashboard
 * Only queries collections the user has access to
 */

import { useState, useEffect } from 'react';
import { db } from '@/shared/services/firebase/firestore';
import {
  collection,
  query,
  where,
  getDocs,
  getCountFromServer,
} from 'firebase/firestore';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import type { SubsidiaryModule } from '@/types/subsidiary';

export interface DashboardStats {
  activeProjects: number;
  totalEmployees: number;
  openOrders: number;
  pendingTasks: number;
}

const EMPTY_STATS: DashboardStats = {
  activeProjects: 0,
  totalEmployees: 0,
  openOrders: 0,
  pendingTasks: 0,
};

async function safeCount(
  collectionPath: string,
  constraints: Parameters<typeof where>[] = []
): Promise<number> {
  try {
    const ref = collection(db, collectionPath);
    const whereConstraints = constraints.map((c) => where(...c));
    const q = query(ref, ...whereConstraints);
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch {
    // Collection may not exist or user may lack permission
    return 0;
  }
}

async function safeDocs(
  collectionPath: string,
  constraints: Parameters<typeof where>[] = []
): Promise<number> {
  try {
    const ref = collection(db, collectionPath);
    const whereConstraints = constraints.map((c) => where(...c));
    const q = query(ref, ...whereConstraints);
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch {
    return 0;
  }
}

export function useDashboardStats(accessibleModuleIds: SubsidiaryModule[]) {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const { currentSubsidiary } = useSubsidiary();

  const hasModule = (id: SubsidiaryModule) => accessibleModuleIds.includes(id);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      setIsLoading(true);

      const results: DashboardStats = { ...EMPTY_STATS };

      try {
        const promises: Promise<void>[] = [];

        // Active campaigns (Phase 1.C: design-manager removed; Phase 3 wires
        // these to the new `campaigns` collection)
        if (hasModule('campaigns')) {
          promises.push(
            safeCount('campaigns').then((n) => {
              results.activeProjects += n;
            })
          );
        }

        // Employees count
        if (hasModule('hr')) {
          promises.push(
            safeCount('employees', [
              ['isDeleted', '==', false],
            ]).then((n) => {
              results.totalEmployees = n;
            })
          );
        }

        // Production jobs (open) — Phase 3 will define the exact collection
        if (hasModule('production')) {
          promises.push(
            safeDocs('productionJobs', [
              ['status', 'in', ['draft', 'approved', 'in-progress']],
            ]).then((n) => {
              results.openOrders += n;
            })
          );
        }

        // Media buys (pending) — Phase 4 (Media Plan & Buying)
        if (hasModule('media')) {
          promises.push(
            safeDocs('mediaBuys', [
              ['status', 'in', ['draft', 'pending', 'ordered']],
            ]).then((n) => {
              results.openOrders += n;
            })
          );
        }

        // Intelligence layer tasks (pending for user)
        promises.push(
          safeCount('businessEvents', [
            ['status', '==', 'pending'],
          ]).then((n) => {
            results.pendingTasks = n;
          })
        );

        await Promise.all(promises);
      } catch {
        // Fail gracefully — dashboard shows 0s
      }

      if (!cancelled) {
        setStats(results);
        setIsLoading(false);
      }
    }

    if (accessibleModuleIds.length > 0) {
      fetchStats();
    } else {
      setStats(EMPTY_STATS);
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [accessibleModuleIds.join(','), currentSubsidiary?.id]);

  return { stats, isLoading };
}
