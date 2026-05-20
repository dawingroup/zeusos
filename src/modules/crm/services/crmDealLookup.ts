/**
 * Resolve CRM deal ↔ design project when only one side of the FK is populated.
 * Some projects were linked from the deal (`linkedProjectId`) before `dealId`
 * was stamped on `designProjects`, or sync created the deal without backfilling.
 */

import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { CRMDealStage } from '@/modules/crm/types';

const CRM_DEALS_COLLECTION = 'crmDeals';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * Find a CRM deal whose `linkedProjectId` matches this design project.
 * @returns Deal document id, or null if none.
 */
export async function fetchDealIdByLinkedProjectId(projectId: string): Promise<string | null> {
  if (!projectId.trim()) return null;
  try {
    const q = query(
      collection(db, CRM_DEALS_COLLECTION),
      where('linkedProjectId', '==', projectId),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].id;
  } catch {
    return null;
  }
}

/**
 * Batch: design project id → CRM stage for deals that only set `linkedProjectId`
 * (no `dealId` on the design project).
 */
export async function fetchCrmDealStagesByLinkedProjectIds(
  projectIds: string[],
): Promise<Map<string, CRMDealStage>> {
  const out = new Map<string, CRMDealStage>();
  const ids = [...new Set(projectIds.filter((id) => typeof id === 'string' && id.length > 0))];
  if (ids.length === 0) return out;

  try {
    for (const part of chunk(ids, 10)) {
      const q = query(collection(db, CRM_DEALS_COLLECTION), where('linkedProjectId', 'in', part));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const data = d.data();
        const pid = data.linkedProjectId as string | undefined;
        const stage = data.stage as CRMDealStage | undefined;
        if (pid && stage && !out.has(pid)) {
          out.set(pid, stage);
        }
      }
    }
  } catch {
    /* rules / index */
  }
  return out;
}
