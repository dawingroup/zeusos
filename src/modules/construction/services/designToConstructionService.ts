/**
 * Design → Construction Handoff Service
 *
 * Called automatically from `transitionStage` when a CONSTRUCTION design
 * item advances to `const-approve`. Validates readiness, mints a
 * CO-YYYY-NNNN number, creates `constructionOrders/{coId}`, and
 * back-links the DesignItem.
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { CONSTRUCTION_ORDERS_COLLECTION } from './constructionOrderService';
import type { ConstructionOrder, COStageTransition } from '../types';
import type { Approval, DesignItem } from '@/modules/design-manager/types';
import { normalizeSourcingType } from '@/modules/design-manager/types/deliverables';

const DESIGN_PROJECTS_COLLECTION = 'designProjects';
const DESIGN_ITEMS_SUBCOLLECTION = 'designItems';

export interface ReleaseToConstructionResult {
  success: boolean;
  coId?: string;
  coNumber?: string;
  error?: string;
}

/**
 * Validate + create a ConstructionOrder for a DesignItem. Idempotent:
 * if `designItem.constructionOrderId` already exists, returns the
 * existing CO without creating a new one.
 */
export async function releaseToConstruction(
  projectId: string,
  designItemId: string,
  userId: string,
  approvals?: Approval[],
): Promise<ReleaseToConstructionResult> {
  const itemRef = doc(
    db,
    DESIGN_PROJECTS_COLLECTION,
    projectId,
    DESIGN_ITEMS_SUBCOLLECTION,
    designItemId,
  );
  const itemSnap = await getDoc(itemRef);
  if (!itemSnap.exists()) {
    return { success: false, error: 'Design item not found' };
  }
  const item = { id: itemSnap.id, ...itemSnap.data() } as DesignItem;

  if (item.constructionOrderId) {
    return { success: true, coId: item.constructionOrderId, coNumber: undefined };
  }

  if (normalizeSourcingType(item.sourcingType) !== 'CONSTRUCTION') {
    return { success: false, error: 'Item is not a CONSTRUCTION deliverable' };
  }

  const pricing = item.construction;
  if (!pricing || !pricing.totalCost || pricing.totalCost <= 0) {
    return { success: false, error: 'Construction pricing must have totalCost > 0' };
  }

  // Validate client approval — if the caller passed the approvals list,
  // we enforce; otherwise we trust the stage-gate that got us here.
  if (approvals) {
    const clientApproved = approvals.some(
      (a) => a.type === 'client-approval' && a.status === 'approved',
    );
    if (!clientApproved) {
      return {
        success: false,
        error: 'Client approval must be recorded before release to construction',
      };
    }
  }

  // Fetch project for denormalised project fields
  let projectCode = '';
  let projectName = '';
  try {
    const projectSnap = await getDoc(doc(db, DESIGN_PROJECTS_COLLECTION, projectId));
    if (projectSnap.exists()) {
      const project = projectSnap.data();
      projectCode = (project.code as string) ?? '';
      projectName = (project.name as string) ?? '';
    }
  } catch {
    // Non-fatal
  }

  // Mint CO number
  const year = new Date().getFullYear();
  const existingSnap = await getDocs(
    query(collection(db, CONSTRUCTION_ORDERS_COLLECTION), where('coNumber', '>=', `CO-${year}-`), where('coNumber', '<', `CO-${year + 1}-`)),
  );
  const coNumber = `CO-${year}-${String(existingSnap.size + 1).padStart(4, '0')}`;

  const now = Timestamp.now();
  const firstTransition: COStageTransition = {
    fromStage: null,
    toStage: 'mobilisation',
    at: now,
    by: userId,
    notes: `Released from ${item.itemCode ?? designItemId}`,
  };

  const coData: Omit<ConstructionOrder, 'id'> = {
    coNumber,
    projectId,
    projectCode,
    projectName,
    designItemId,
    designItemName: item.name ?? '',
    contractorId: pricing.contractorId,
    contractorName: pricing.contractor,
    contractorContact: pricing.contractorContact,
    totalCost: pricing.totalCost,
    currency: pricing.currency ?? 'UGX',
    currentStage: 'mobilisation',
    status: 'released',
    stageHistory: [firstTransition],
    execution: {},
    scopeOfWork: pricing.scopeOfWork,
    exclusions: pricing.exclusions,
    notes: pricing.notes,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
  };

  // Strip undefined recursively so Firestore accepts the write
  const cleaned = Object.fromEntries(
    Object.entries(coData).filter(([, v]) => v !== undefined),
  );

  const coRef = await addDoc(collection(db, CONSTRUCTION_ORDERS_COLLECTION), {
    ...cleaned,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Back-link on the DesignItem
  try {
    await updateDoc(itemRef, {
      constructionOrderId: coRef.id,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[designToConstructionService] Could not back-link CO to DesignItem', err);
  }

  return { success: true, coId: coRef.id, coNumber };
}
