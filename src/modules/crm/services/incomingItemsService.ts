/**
 * Incoming Manufacturing Items Service
 * Queries design items approaching manufacturing (MANUFACTURED or CUSTOM_FURNITURE_MILLWORK)
 * that have not yet been handed over to manufacturing.
 */

import { Timestamp as FirestoreTimestamp } from 'firebase/firestore';
import {
  fetchDocument,
  fetchCollection,
  fetchCollectionGroup,
  where,
  orderBy,
} from '@/shared/services/firebase/firestore';
import type { DesignItem, DesignProject } from '@/modules/design-manager/types';
import { deriveHandoverStatus } from '@/modules/design-manager/services/designItemStatusDerivation';
import type { IncomingManufacturingItem } from '../types';
import { resolveParty } from '@/shared/types/party';

const DESIGN_PROJECTS_COLLECTION = 'designProjects';

/** Manufacturing-eligible sourcingTypes */
const MANUFACTURING_SOURCING_TYPES = new Set(['MANUFACTURED', 'CUSTOM_FURNITURE_MILLWORK']);

/**
 * Fetch design items approaching manufacturing that haven't been handed over yet.
 * Tries collectionGroup first, falls back to per-project subcollection reads.
 */
export async function fetchIncomingManufacturingItems(): Promise<IncomingManufacturingItem[]> {
  try {
    let allManufacturingItems: DesignItem[] = [];

    // Try collectionGroup queries (fast path - requires COLLECTION_GROUP rule)
    try {
      const [manufacturedItems, customFurnitureItems] = await Promise.all([
        fetchCollectionGroup<DesignItem>('designItems', [
          where('sourcingType', '==', 'MANUFACTURED'),
        ]),
        fetchCollectionGroup<DesignItem>('designItems', [
          where('sourcingType', '==', 'CUSTOM_FURNITURE_MILLWORK'),
        ]),
      ]);
      allManufacturingItems = [...manufacturedItems, ...customFurnitureItems];
    } catch {
      // Fallback: fetch all projects, then get items per project
      const projects = await fetchCollection<DesignProject>(DESIGN_PROJECTS_COLLECTION, [
        orderBy('updatedAt', 'desc'),
      ]);

      const perProjectResults = await Promise.all(
        projects.map(async (project) => {
          try {
            return await fetchCollection<DesignItem>(
              `${DESIGN_PROJECTS_COLLECTION}/${project.id}/designItems`
            );
          } catch {
            return [] as DesignItem[];
          }
        })
      );

      // Flatten and filter to manufacturing types only
      allManufacturingItems = perProjectResults
        .flat()
        .filter((item) => item.sourcingType && MANUFACTURING_SOURCING_TYPES.has(item.sourcingType));
    }

    // Deduplicate
    const seen = new Set<string>();
    const uniqueItems = allManufacturingItems.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    // Filter: only items NOT yet handed over. Derive the status from the MO
    // link (P7/F10) — the stored handoverStatus field can drift behind
    // manufacturingOrderId; the derivation heals that.
    const pendingItems = uniqueItems.filter(
      (item) => deriveHandoverStatus(item) === 'pending'
    );

    if (pendingItems.length === 0) return [];

    // Fetch project info for each unique projectId
    const projectIds = [...new Set(
      pendingItems.map((item) => item.projectId).filter(Boolean)
    )];
    const projectMap = new Map<string, DesignProject>();

    await Promise.all(
      projectIds.map(async (projectId) => {
        try {
          const project = await fetchDocument<DesignProject>(DESIGN_PROJECTS_COLLECTION, projectId);
          if (project) {
            projectMap.set(projectId, { ...project, id: projectId });
          }
        } catch {
          // Skip projects we can't fetch
        }
      })
    );

    // Build the incoming items
    return pendingItems
      .map((item): IncomingManufacturingItem => {
        const project = projectMap.get(item.projectId);
        // P8/F1 (P8-3) — resolve the party ref from the project. No
        // deal/SO context is in scope at this layer, so `resolveParty`
        // always takes the finishes_customer fallback path. The field
        // exists so consumers don't have to synthesize it themselves.
        const party = project?.customerId
          ? resolveParty({ customerId: project.customerId })
          : null;
        return {
          designItemId: item.id,
          designItemName: item.name,
          projectId: item.projectId,
          projectCode: item.projectCode || project?.code || '',
          customerName: project?.customerName || 'Unknown',
          ...(party ? { party } : {}),
          sourcingType: item.sourcingType || 'MANUFACTURED',
          currentStage: item.currentStage,
          overallReadiness: item.overallReadiness ?? 0,
          ragStatus: getRagStatusString(item.ragStatus),
          estimatedCosts: {
            materialCost: item.manufacturing?.materialCost ?? 0,
            laborCost: item.manufacturing?.laborCost ?? 0,
            totalCost: item.manufacturing?.totalCost ?? 0,
          },
          // P7 phase 3 — derive so post-phase-3 docs (which no longer
          // stamp the flat field) still surface the correct state to
          // the incoming-items pipeline consumers.
          handoverStatus: deriveHandoverStatus(item),
          createdAt: item.createdAt as FirestoreTimestamp,
        };
      })
      .sort((a, b) => b.overallReadiness - a.overallReadiness);
  } catch (error) {
    console.error('Error fetching incoming manufacturing items:', error);
    return [];
  }
}

function getRagStatusString(ragStatus: unknown): string {
  if (!ragStatus) return 'not-applicable';
  if (typeof ragStatus === 'string') return ragStatus;
  if (typeof ragStatus === 'object' && ragStatus !== null) {
    const overall = (ragStatus as Record<string, unknown>).overall;
    if (overall && typeof overall === 'object') {
      return ((overall as Record<string, unknown>).status as string) || 'not-applicable';
    }
  }
  return 'not-applicable';
}
