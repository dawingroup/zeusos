/**
 * Deal Sync Service
 * Auto-creates CRM deals for Design Manager projects that don't already have one.
 * Idempotent (won't create duplicates).
 */

import {
  fetchCollection,
} from '@/shared/services/firebase/firestore';
import type { DesignProject } from '@/modules/design-manager/types';
import type { CRMDeal, CRMDealFormData, CRMDealStage } from '../types';
import { CRM_DEALS_COLLECTION, CRM_DEFAULT_CURRENCY } from '../constants/crm.constants';
import { createDeal } from './crmDealService';

const DESIGN_PROJECTS_COLLECTION = 'designProjects';

/**
 * Map Design Manager project status → CRM deal stage.
 */
function mapProjectStatusToDealStage(status: string): CRMDealStage {
  switch (status) {
    case 'active':    return 'design_proposal';
    case 'on-hold':   return 'on_hold';
    case 'completed': return 'won';
    case 'cancelled': return 'lost';
    default:          return 'design_proposal';
  }
}

export interface DealSyncResult {
  created: number;
  skipped: number;
  total: number;
  errors: string[];
  debug: string[];
}

/**
 * Sync CRM deals for all design projects that don't already have one.
 * Idempotent — uses linkedProjectId to prevent duplicate deals.
 */
export async function syncDealsForProjects(
  userId: string,
  userName: string,
  subsidiaryId: string = 'dawin-finishes'
): Promise<DealSyncResult> {
  const result: DealSyncResult = { created: 0, skipped: 0, total: 0, errors: [], debug: [] };

  result.debug.push(`Starting sync for user: ${userName} (${userId})`);

  // 1. Fetch all projects and existing deals in parallel — NO orderBy to avoid index issues
  let projects: DesignProject[] = [];
  let existingDeals: CRMDeal[] = [];

  try {
    projects = await fetchCollection<DesignProject>(DESIGN_PROJECTS_COLLECTION);
    result.debug.push(`Fetched ${projects.length} design projects`);
  } catch (err) {
    const msg = `Failed to fetch projects: ${(err as Error).message}`;
    result.errors.push(msg);
    result.debug.push(msg);
    return result;
  }

  try {
    existingDeals = await fetchCollection<CRMDeal>(CRM_DEALS_COLLECTION);
    result.debug.push(`Fetched ${existingDeals.length} existing deals`);
  } catch (err) {
    const msg = `Failed to fetch deals: ${(err as Error).message}`;
    result.errors.push(msg);
    result.debug.push(msg);
    return result;
  }

  result.total = projects.length;
  if (projects.length === 0) {
    result.debug.push('No projects found — nothing to sync');
    return result;
  }

  // 2. Build lookup: linkedProjectId → deal (to detect existing links)
  const dealsByProjectId = new Map<string, CRMDeal>();
  for (const deal of existingDeals) {
    if (deal.linkedProjectId) {
      dealsByProjectId.set(deal.linkedProjectId, deal);
    }
  }
  result.debug.push(`${dealsByProjectId.size} deals already linked to projects`);

  // 3. Create deals for projects that lack one
  for (const project of projects) {
    // Already has a deal linked
    if (dealsByProjectId.has(project.id)) {
      result.skipped++;
      continue;
    }

    // P5/F4: a deal must be linked to a real customer. If the project is
    // a legacy orphan (no `customerId`), skip instead of minting a synthetic
    // `proj_${id}` stand-in — that fallback was the exact pattern the audit
    // flagged as silent data corruption.
    if (!project.customerId || typeof project.customerId !== 'string' || project.customerId.trim() === '') {
      result.skipped++;
      result.debug.push(
        `Skipped "${project.name}" (${project.id}) — project has no customerId; backfill via ` +
        `scripts/audit-design-projects-customer.cjs before re-running sync.`,
      );
      continue;
    }

    try {
      const stage = mapProjectStatusToDealStage(project.status);
      const customerId = project.customerId;
      const customerName = project.customerName || project.name || 'Unlinked Client';

      // Use the project's consolidated estimate total if available
      const projectAny = project as unknown as Record<string, unknown>;
      const estimate = projectAny.consolidatedEstimate as { total?: number; currency?: string } | undefined;
      const estimateTotal = estimate?.total ?? 0;
      const estimateCurrency = estimate?.currency ?? CRM_DEFAULT_CURRENCY;

      result.debug.push(`Creating deal for "${project.name}" (${project.id}) → stage: ${stage}, value: ${estimateCurrency} ${estimateTotal.toLocaleString()}`);

      const dealData: CRMDealFormData = {
        title: project.name,
        description: `Auto-created from Design Manager project ${project.code}`,
        customerId,
        customerName,
        stage,
        probability: 0,
        priority: 'medium',
        source: 'repeat_client',
        estimatedValue: estimateTotal,
        currency: estimateCurrency,
        linkedProjectId: project.id,
        linkedQuoteIds: [],
        linkedMOIds: [],
        ownerId: userId,
        ownerName: userName,
        teamMemberIds: [],
        siteLocation: project.siteLocation
          ? {
              address: project.siteLocation.address,
              city: project.siteLocation.city,
              country: project.siteLocation.country,
            }
          : undefined,
        tags: ['auto-synced', 'design-project'],
        subsidiaryId,
      };

      await createDeal(dealData, userId, userName);
      result.created++;
      result.debug.push(`  -> Deal created OK for "${project.name}"`);
    } catch (err) {
      const msg = `Failed to create deal for ${project.code || project.id}: ${(err as Error).message}`;
      result.errors.push(msg);
      result.debug.push(`  -> ERROR: ${msg}`);
    }
  }

  result.debug.push(`Sync complete: ${result.created} created, ${result.skipped} skipped, ${result.errors.length} errors`);
  if (import.meta.env.DEV) {
    console.debug('[DealSync] Result:', result);
  }
  return result;
}
