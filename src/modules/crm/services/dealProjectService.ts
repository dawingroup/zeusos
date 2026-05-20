/**
 * Deal-Project Integration Service
 * Creates Design Manager projects from CRM deals and adds inventory products as design items.
 */

import { Timestamp } from 'firebase/firestore';
import { saveDocument } from '@/shared/services/firebase/firestore';
import { createProject, createDesignItem } from '@/modules/design-manager/services/firestore';
import { formatProjectCode } from '@/modules/design-manager/utils/formatting';
import { linkProjectToDeal } from './crmDealService';
import { addProductToProject } from '@/modules/inventory/services/inventoryProjectLinkService';
import { CRM_ACTIVITIES_COLLECTION } from '../constants/crm.constants';
import type { CRMDeal } from '../types';
import type { InventoryListItem } from '@/modules/inventory/types/inventory';
import type { DesignCategory } from '@/modules/design-manager/types';
import { stampDesignProjectDealId } from '@/shared/utils/fkResolvers';

export interface CreateProjectFromDealResult {
  projectId: string;
  projectCode: string;
}

/**
 * Map inventory category to design category.
 * Falls back to 'fixtures' for unmapped categories.
 */
const CATEGORY_MAP: Record<string, DesignCategory> = {
  casework: 'casework',
  furniture: 'furniture',
  millwork: 'millwork',
  doors: 'doors',
  fixtures: 'fixtures',
  specialty: 'specialty',
};

/**
 * Create a new Design Manager project from a CRM deal.
 * 1. Creates the project with customer info auto-populated from the deal.
 * 2. Links the deal to the project (deal.linkedProjectId).
 * 3. Logs a CRM activity.
 */
export async function createProjectFromDeal(
  deal: CRMDeal,
  userId: string,
  userName: string,
  overrides?: {
    projectName?: string;
    description?: string;
  }
): Promise<CreateProjectFromDealResult> {
  const year = new Date().getFullYear();
  const sequence = Math.floor(Math.random() * 900) + 100;
  const projectCode = formatProjectCode(year, sequence);

  const projectName = overrides?.projectName?.trim() || deal.title;
  const description =
    overrides?.description?.trim() ||
    `Design project for deal ${deal.dealNumber}`;

  // 1. Create the Design Manager project
  const projectId = await createProject(
    {
      code: projectCode,
      name: projectName,
      description,
      customerId: deal.customerId,
      customerName: deal.customerName,
      status: 'active',
      siteLocation: deal.siteLocation
        ? {
            address: deal.siteLocation.address,
            city: deal.siteLocation.city,
            country: deal.siteLocation.country,
          }
        : undefined,
      // P16/F13 — canonical deal FK. Legacy `linkedDealId` was dropped
      // post-backfill (2026-04-18); the stamp helper now emits only
      // `{ dealId }` but stays as the centralized writer idiom.
      ...stampDesignProjectDealId(deal.id),
    },
    userId
  );

  // 2. Link the deal to the project (deal side)
  await linkProjectToDeal(deal.id, projectId, userId);

  // 3. Log CRM activity. P8/F1 — forward the deal's party ref when
  // present; legacy deals leave it undefined and readers fall back to
  // `customerId` via `resolveParty`.
  const now = Timestamp.now();
  const activityId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await saveDocument(CRM_ACTIVITIES_COLLECTION, activityId, {
    dealId: deal.id,
    customerId: deal.customerId,
    ...(deal.party ? { party: deal.party } : {}),
    projectId,
    type: 'project_created',
    title: `Design project created: ${projectCode}`,
    description: `Project "${projectName}" created from deal ${deal.dealNumber}`,
    source: 'auto_design_manager',
    performedBy: userId,
    performedByName: userName,
    performedAt: now,
    createdAt: now,
  });

  return { projectId, projectCode };
}

/**
 * Add a published inventory product to a project as a PROCURED design item.
 * 1. Creates a design item in the project.
 * 2. Links the inventory item to the project.
 */
export async function addProductAsDesignItem(
  projectId: string,
  inventoryItem: Pick<InventoryListItem, 'id' | 'name' | 'sku' | 'category'>,
  userId: string
): Promise<string> {
  const category: DesignCategory =
    CATEGORY_MAP[inventoryItem.category] || 'fixtures';

  // 1. Create design item
  const designItemId = await createDesignItem(
    projectId,
    {
      name: inventoryItem.name,
      description: `From inventory: ${inventoryItem.sku}`,
      category,
      sourcingType: 'PROCURED',
      currentStage: 'procure-identify',
    },
    userId
  );

  // 2. Link inventory item to project
  await addProductToProject(inventoryItem.id, projectId, designItemId);

  return designItemId;
}
