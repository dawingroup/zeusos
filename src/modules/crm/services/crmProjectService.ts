/**
 * CRM Project Service
 * Aggregates data from Design Manager, Manufacturing, and CRM collections
 * to provide unified project views for the CRM module.
 */

import { Timestamp as FirestoreTimestamp } from 'firebase/firestore';
import {
  fetchDocument,
  fetchCollection,
  fetchCollectionGroup,
  where,
  orderBy,
} from '@/shared/services/firebase/firestore';
import type { DesignProject, DesignItem } from '@/modules/design-manager/types';
import { deriveHandoverStatus } from '@/modules/design-manager/services/designItemStatusDerivation';
import type { ManufacturingOrder } from '@/modules/manufacturing/types';
import type { CRMDeal, CRMActivity, ProjectDetailAggregation, ProjectFinancialSummary } from '../types';
import { CRM_DEALS_COLLECTION, CRM_ACTIVITIES_COLLECTION } from '../constants/crm.constants';
import { resolveParty } from '@/shared/types/party';

const DESIGN_PROJECTS_COLLECTION = 'designProjects';
const MANUFACTURING_ORDERS_COLLECTION = 'manufacturingOrders';
const CUSTOMERS_COLLECTION = 'customers';

// ============================================================
// Project Tracker (list view)
// ============================================================

export interface ProjectTrackerItem {
  projectId: string;
  projectCode: string;
  projectName: string;
  customerName: string;
  customerId?: string;
  status: string;
  totalDesignItems: number;
  totalMOs: number;
  designProgress: number;
  manufacturingProgress: number;
  updatedAt: Date;
  dealId?: string;
  dealStage?: string;
}

/**
 * Fetch all design projects with summary statistics for the tracker table.
 * Tries collectionGroup query first, falls back to per-project subcollection reads.
 */
export async function fetchProjectsForTracker(): Promise<ProjectTrackerItem[]> {
  // Fetch projects, MOs, and deals (all root collections)
  const [projects, allMOs, allDeals] = await Promise.all([
    fetchCollection<DesignProject>(DESIGN_PROJECTS_COLLECTION, [
      orderBy('updatedAt', 'desc'),
    ]),
    fetchCollection<ManufacturingOrder>(MANUFACTURING_ORDERS_COLLECTION).catch(() => [] as ManufacturingOrder[]),
    fetchCollection<CRMDeal>(CRM_DEALS_COLLECTION).catch(() => [] as CRMDeal[]),
  ]);

  if (projects.length === 0) return [];

  // Index MOs by projectId
  const mosByProject = new Map<string, ManufacturingOrder[]>();
  for (const mo of allMOs) {
    if (!mo.projectId) continue;
    const list = mosByProject.get(mo.projectId) || [];
    list.push(mo);
    mosByProject.set(mo.projectId, list);
  }

  // Index deals by linkedProjectId
  const dealsByProject = new Map<string, CRMDeal>();
  for (const deal of allDeals) {
    if (deal.linkedProjectId) {
      dealsByProject.set(deal.linkedProjectId, deal);
    }
  }

  // Try collectionGroup query for all design items at once (fast path)
  let itemsByProject = new Map<string, DesignItem[]>();
  try {
    const allDesignItems = await fetchCollectionGroup<DesignItem>('designItems');
    for (const item of allDesignItems) {
      if (!item.projectId) continue;
      const list = itemsByProject.get(item.projectId) || [];
      list.push(item);
      itemsByProject.set(item.projectId, list);
    }
  } catch {
    // Fallback: fetch design items per project in parallel
    const itemResults = await Promise.all(
      projects.map(async (project) => {
        try {
          const items = await fetchCollection<DesignItem>(
            `${DESIGN_PROJECTS_COLLECTION}/${project.id}/designItems`
          );
          return { projectId: project.id, items };
        } catch {
          return { projectId: project.id, items: [] as DesignItem[] };
        }
      })
    );
    itemsByProject = new Map(itemResults.map((r) => [r.projectId, r.items]));
  }

  // Build tracker items
  return projects.map((project): ProjectTrackerItem => {
    const designItems = itemsByProject.get(project.id) || [];
    const mos = mosByProject.get(project.id) || [];
    const deal = dealsByProject.get(project.id);

    return {
      projectId: project.id,
      projectCode: project.code,
      projectName: project.name,
      customerName: project.customerName || 'Unknown',
      customerId: project.customerId,
      status: project.status,
      totalDesignItems: designItems.length,
      totalMOs: mos.length,
      designProgress: computeDesignProgress(designItems),
      manufacturingProgress: computeManufacturingProgress(mos),
      updatedAt: project.updatedAt?.toDate?.() || new Date(),
      dealId: deal?.id,
      dealStage: deal?.stage,
    };
  });
}

// ============================================================
// Project Detail (aggregated view)
// ============================================================

/**
 * Fetch full project detail with all aggregated data
 */
export async function fetchProjectDetail(projectId: string): Promise<ProjectDetailAggregation | null> {
  const project = await fetchDocument<DesignProject>(DESIGN_PROJECTS_COLLECTION, projectId);
  if (!project) return null;

  // Parallel fetches for all related data
  const [designItems, mos, deals, activities, customer] = await Promise.all([
    fetchCollection<DesignItem>(
      `${DESIGN_PROJECTS_COLLECTION}/${projectId}/designItems`
    ),
    fetchCollection<ManufacturingOrder>(MANUFACTURING_ORDERS_COLLECTION, [
      where('projectId', '==', projectId),
    ]),
    fetchCollection<CRMDeal>(CRM_DEALS_COLLECTION, [
      where('linkedProjectId', '==', projectId),
    ]).catch(() => [] as CRMDeal[]),
    fetchCollection<CRMActivity>(CRM_ACTIVITIES_COLLECTION, [
      where('projectId', '==', projectId),
      orderBy('performedAt', 'desc'),
    ]).catch(() => [] as CRMActivity[]),
    project.customerId
      ? fetchDocument<Record<string, unknown>>(CUSTOMERS_COLLECTION, project.customerId)
      : Promise.resolve(null),
  ]);

  const financials = computeFinancialSummary(designItems, mos);

  const linkedDeal = deals.length > 0
    ? {
        id: deals[0].id,
        dealNumber: deals[0].dealNumber,
        title: deals[0].title,
        stage: deals[0].stage,
        estimatedValue: deals[0].estimatedValue,
      }
    : undefined;

  // P8/F1 (P8-3) — resolve the cross-subsidiary party ref. Prefer
  // the linked deal's `party` (post-P8-2 deals carry it verbatim),
  // then fall back to the project's `customerId` as finishes_customer
  // (the universe of legacy pre-P8-2 rows). `resolveParty` handles
  // both via the same call.
  const partyRefResolved = resolveParty({
    party: deals[0]?.party,
    customerId: project.customerId,
  });

  return {
    projectId: project.id,
    projectCode: project.code,
    projectName: project.name,
    projectDescription: project.description,
    projectStatus: project.status,
    startDate: project.startDate as FirestoreTimestamp | undefined,
    dueDate: project.dueDate as FirestoreTimestamp | undefined,

    customerId: project.customerId,
    customerName: project.customerName || (customer as Record<string, unknown>)?.name as string,
    customerEmail: (customer as Record<string, unknown>)?.email as string | undefined,
    customerPhone: (customer as Record<string, unknown>)?.phone as string | undefined,
    customerType: (customer as Record<string, unknown>)?.type as string | undefined,
    // P8/F1 — resolved party ref (see `partyRefResolved` above). Null
    // when the project has no customerId and no linked deal — the
    // aggregation's consumers treat that the same as "no customer".
    party: partyRefResolved ?? undefined,
    siteLocation: project.siteLocation?.address
      ? `${project.siteLocation.address}${project.siteLocation.city ? ', ' + project.siteLocation.city : ''}`
      : undefined,

    designItems: designItems.map((item) => ({
      id: item.id,
      name: item.name,
      itemCode: item.itemCode,
      category: item.category,
      sourcingType: item.sourcingType,
      currentStage: item.currentStage,
      ragStatus: getRagStatusString(item.ragStatus),
      overallReadiness: item.overallReadiness ?? 0,
      manufacturingOrderId: item.manufacturingOrderId,
      // P7 phase 3 — derive from `manufacturingOrderId` so post-phase-3
      // docs (which no longer stamp the flat field) still report the
      // correct handover state to downstream CRM aggregations.
      handoverStatus: deriveHandoverStatus(item),
      manufacturing: item.manufacturing
        ? {
            materialCost: item.manufacturing.materialCost ?? 0,
            laborCost: item.manufacturing.laborCost ?? 0,
            totalCost: item.manufacturing.totalCost ?? 0,
          }
        : undefined,
    })),

    manufacturingOrders: mos.map((mo) => ({
      id: mo.id,
      moNumber: mo.moNumber,
      designItemName: mo.designItemName ?? mo.itemName ?? '',
      status: mo.status,
      currentStage: mo.currentStage,
      priority: mo.priority,
      costSummary: {
        materialCost: mo.costSummary?.materialCost ?? 0,
        laborCost: mo.costSummary?.laborCost ?? 0,
        totalCost: mo.costSummary?.totalCost ?? 0,
      },
    })),

    financials,

    activities: activities.map((act) => ({
      id: act.id,
      type: act.type,
      title: act.title,
      description: act.description,
      performedByName: act.performedByName,
      performedAt: act.performedAt,
    })),

    linkedDeal,
  };
}

// ============================================================
// Helper: Financial Summary
// ============================================================

export function computeFinancialSummary(
  designItems: DesignItem[],
  mos: ManufacturingOrder[]
): ProjectFinancialSummary {
  let totalManufacturingCost = 0;
  let totalMaterialCost = 0;

  // Sum manufacturing costs from design item estimates
  for (const item of designItems) {
    if (item.manufacturing) {
      totalManufacturingCost += item.manufacturing.totalCost ?? 0;
      totalMaterialCost += item.manufacturing.materialCost ?? 0;
    }
  }

  // If MOs have actual costs that exceed estimates, use the MO figures
  let moTotalCost = 0;
  let moMaterialCost = 0;
  for (const mo of mos) {
    if (mo.costSummary) {
      moTotalCost += mo.costSummary.totalCost ?? 0;
      moMaterialCost += mo.costSummary.materialCost ?? 0;
    }
  }

  // Use whichever is higher - MO actuals vs design estimates
  if (moTotalCost > totalManufacturingCost) {
    totalManufacturingCost = moTotalCost;
  }
  if (moMaterialCost > totalMaterialCost) {
    totalMaterialCost = moMaterialCost;
  }

  return {
    totalQuotedValue: 0,
    totalApprovedQuotes: 0,
    totalManufacturingCost,
    totalMaterialCost,
    estimatedProfit: 0,
    currency: 'UGX',
  };
}

// ============================================================
// Helper: Progress Calculations
// ============================================================

const DESIGN_COMPLETE_STAGES = [
  'production-ready',
  'procure-received',
  'arch-approved',
  'const-complete',
];

function computeDesignProgress(items: DesignItem[]): number {
  if (items.length === 0) return 0;
  const completed = items.filter((item) =>
    DESIGN_COMPLETE_STAGES.includes(item.currentStage)
  ).length;
  return Math.round((completed / items.length) * 100);
}

function computeManufacturingProgress(mos: ManufacturingOrder[]): number {
  if (mos.length === 0) return 0;
  const completed = mos.filter(
    (mo) => mo.status === 'completed' || mo.currentStage === 'ready'
  ).length;
  return Math.round((completed / mos.length) * 100);
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
