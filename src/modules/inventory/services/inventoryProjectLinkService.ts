/**
 * Inventory Project Link Service
 *
 * Bridges inventory items (products) to Design Manager projects.
 * Allows adding finished products to projects for manufacturing or procurement.
 */

import {
  doc,
  updateDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { InventoryItem } from '../types/inventory';

const INVENTORY_COLLECTION = 'inventoryItems';
const PROJECTS_COLLECTION = 'designProjects';
const DESIGN_ITEMS_SUBCOLLECTION = 'designItems';

/**
 * Project summary for selection UI
 */
export interface ProjectSummary {
  id: string;
  code: string;
  name: string;
  customerId?: string;
  customerName?: string;
  status: string;
}

/**
 * Design item summary for selection UI
 */
export interface DesignItemSummary {
  id: string;
  name: string;
  projectId: string;
  sourcingType?: string;
  status: string;
}

/**
 * Link an inventory product to a Design Manager project
 */
export async function addProductToProject(
  inventoryItemId: string,
  projectId: string,
  designItemId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Update the inventory item's linkedProjectIds
    const itemRef = doc(db, INVENTORY_COLLECTION, inventoryItemId);
    await updateDoc(itemRef, {
      linkedProjectIds: arrayUnion(projectId),
      updatedAt: serverTimestamp(),
    });

    // If a design item is specified, update it to reference this inventory item
    if (designItemId) {
      const designItemRef = doc(db, PROJECTS_COLLECTION, projectId, DESIGN_ITEMS_SUBCOLLECTION, designItemId);
      await updateDoc(designItemRef, {
        linkedInventoryItemId: inventoryItemId,
        updatedAt: serverTimestamp(),
      });
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to link' };
  }
}

/**
 * Remove a product from a project
 */
export async function removeProductFromProject(
  inventoryItemId: string,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const itemRef = doc(db, INVENTORY_COLLECTION, inventoryItemId);
    await updateDoc(itemRef, {
      linkedProjectIds: arrayRemove(projectId),
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to unlink' };
  }
}

/**
 * Get all projects that use an inventory product
 */
export async function getProjectsUsingProduct(inventoryItemId: string): Promise<ProjectSummary[]> {
  const itemRef = doc(db, INVENTORY_COLLECTION, inventoryItemId);
  const itemDoc = await getDoc(itemRef);

  if (!itemDoc.exists()) {
    return [];
  }

  const item = itemDoc.data() as InventoryItem;
  const projectIds = item.linkedProjectIds || [];

  if (projectIds.length === 0) {
    return [];
  }

  const projects: ProjectSummary[] = [];
  for (const projectId of projectIds) {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    const projectDoc = await getDoc(projectRef);

    if (projectDoc.exists()) {
      const data = projectDoc.data();
      projects.push({
        id: projectDoc.id,
        code: data.code || data.projectCode,
        name: data.name || data.projectName,
        customerId: data.customerId,
        customerName: data.customerName,
        status: data.status,
      });
    }
  }

  return projects;
}

/**
 * Get products used in a specific project
 */
export async function getProductsInProject(projectId: string): Promise<InventoryItem[]> {
  const q = query(
    collection(db, INVENTORY_COLLECTION),
    where('linkedProjectIds', 'array-contains', projectId)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as InventoryItem));
}

/**
 * Get recent projects for selection UI
 */
export async function getRecentProjects(limit: number = 20): Promise<ProjectSummary[]> {
  const q = query(
    collection(db, PROJECTS_COLLECTION),
    where('status', 'in', ['active', 'planning', 'in-progress']),
  );

  const snapshot = await getDocs(q);
  const projects: ProjectSummary[] = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      code: data.code || data.projectCode,
      name: data.name || data.projectName,
      customerId: data.customerId,
      customerName: data.customerName,
      status: data.status,
    };
  });

  // Sort by most recent and limit
  return projects.slice(0, limit);
}

/**
 * Get design items in a project that can be linked to inventory
 */
export async function getDesignItemsForProject(projectId: string): Promise<DesignItemSummary[]> {
  const itemsRef = collection(db, PROJECTS_COLLECTION, projectId, DESIGN_ITEMS_SUBCOLLECTION);
  const snapshot = await getDocs(itemsRef);
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name || data.itemName,
      projectId,
      sourcingType: data.sourcingType,
      status: data.status,
    };
  });
}

/**
 * Search projects by name or code
 */
export async function searchProjects(searchTerm: string): Promise<ProjectSummary[]> {
  // Get all active projects and filter client-side
  // (Firestore doesn't support full-text search natively)
  const q = query(
    collection(db, PROJECTS_COLLECTION),
    where('status', 'in', ['active', 'planning', 'in-progress']),
  );

  const snapshot = await getDocs(q);
  const term = searchTerm.toLowerCase();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        code: data.code || data.projectCode,
        name: data.name || data.projectName,
        customerId: data.customerId,
        customerName: data.customerName,
        status: data.status,
      };
    })
    .filter(
      (project) =>
        project.code?.toLowerCase().includes(term) ||
        project.name?.toLowerCase().includes(term) ||
        project.customerName?.toLowerCase().includes(term)
    )
    .slice(0, 20);
}
