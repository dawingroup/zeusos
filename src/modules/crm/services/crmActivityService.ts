/**
 * CRM Activity Service
 * CRUD operations for CRM activities (manual + auto-generated)
 */

import {
  fetchCollection,
  saveDocument,
  where,
  orderBy,
} from '@/shared/services/firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import type { CRMActivity } from '../types';
import { CRM_ACTIVITIES_COLLECTION } from '../constants/crm.constants';

/**
 * Log a new CRM activity
 */
export async function logActivity(
  activity: Omit<CRMActivity, 'id' | 'createdAt'>
): Promise<string> {
  const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Timestamp.now();

  await saveDocument(CRM_ACTIVITIES_COLLECTION, id, {
    ...activity,
    createdAt: now,
  });

  return id;
}

/**
 * Fetch all activities (ordered by most recent first)
 */
export async function fetchAllActivities(): Promise<CRMActivity[]> {
  return fetchCollection<CRMActivity>(CRM_ACTIVITIES_COLLECTION, [
    orderBy('performedAt', 'desc'),
  ]);
}

/**
 * Fetch activities for a project (ordered by most recent first)
 */
export async function fetchActivitiesByProject(projectId: string): Promise<CRMActivity[]> {
  return fetchCollection<CRMActivity>(CRM_ACTIVITIES_COLLECTION, [
    where('projectId', '==', projectId),
    orderBy('performedAt', 'desc'),
  ]);
}

/**
 * Fetch activities for a customer
 */
export async function fetchActivitiesByCustomer(customerId: string): Promise<CRMActivity[]> {
  return fetchCollection<CRMActivity>(CRM_ACTIVITIES_COLLECTION, [
    where('customerId', '==', customerId),
    orderBy('performedAt', 'desc'),
  ]);
}

/**
 * Fetch activities for a deal
 */
export async function fetchActivitiesByDeal(dealId: string): Promise<CRMActivity[]> {
  return fetchCollection<CRMActivity>(CRM_ACTIVITIES_COLLECTION, [
    where('dealId', '==', dealId),
    orderBy('performedAt', 'desc'),
  ]);
}
