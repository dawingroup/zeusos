/**
 * Client Portal access — resolves which DesignProjects a signed-in
 * client user is allowed to see, and loads them.
 *
 * Access model:
 *   - `DesignProject.clientPortalUserIds: string[]` lists Firebase Auth
 *     UIDs that may view the project in the portal.
 *   - A user with internal-staff custom claims would normally bypass this
 *     gate, but the portal deliberately enforces it anyway so internal
 *     accounts get a clean "no projects" view unless explicitly listed.
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { DesignProject } from '@/modules/design-manager/types';
import type { SalesOrder } from '@/modules/sales-orders/types';
import type { ClientQuote } from '@/modules/design-manager/types/clientPortal';

const DESIGN_PROJECTS = 'designProjects';
const SALES_ORDERS = 'salesOrders';
const CLIENT_QUOTES = 'clientQuotes';

export async function getPortalProjectsForUser(uid: string): Promise<DesignProject[]> {
  if (!uid) return [];
  const q = query(
    collection(db, DESIGN_PROJECTS),
    where('clientPortalUserIds', 'array-contains', uid),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DesignProject);
}

/**
 * Staff preview: returns every non-archived DesignProject in the portal-
 * eligible subsidiaries (Finishes + Advisory). Used by the project picker
 * when the signed-in user is internal staff so they can see what each
 * client sees — including projects that were never explicitly opened to
 * the portal. Firestore rules independently gate this via `isAdmin()`,
 * so a client signing in here would just get an empty list.
 */
export async function getAllPortalProjectsForStaff(): Promise<DesignProject[]> {
  const snap = await getDocs(collection(db, DESIGN_PROJECTS));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as DesignProject)
    .filter((p) => !p.archived);
}

export async function getPortalProjectByCode(code: string): Promise<DesignProject | null> {
  if (!code) return null;
  const q = query(collection(db, DESIGN_PROJECTS), where('code', '==', code));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as DesignProject;
}

export async function getSalesOrderForProject(
  designProjectId: string,
): Promise<SalesOrder | null> {
  if (!designProjectId) return null;
  // Two patterns observed in the codebase: SO has designProjectId, or
  // DesignProject has linkedSalesOrderId. Cover both.
  const q = query(
    collection(db, SALES_ORDERS),
    where('designProjectId', '==', designProjectId),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as SalesOrder;
}

/**
 * Returns every ClientQuote (pre-contract quote) tied to the given
 * design project. Used by the portal Quotations screen, which lists
 * the original quotes alongside post-contract change orders.
 */
export async function getClientQuotesForProject(designProjectId: string): Promise<ClientQuote[]> {
  if (!designProjectId) return [];
  try {
    const snap = await getDocs(query(
      collection(db, CLIENT_QUOTES),
      where('projectId', '==', designProjectId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClientQuote);
  } catch {
    return [];
  }
}

export async function getSalesOrderById(id: string): Promise<SalesOrder | null> {
  if (!id) return null;
  const ref = doc(db, SALES_ORDERS, id);
  const s = await getDoc(ref);
  if (!s.exists()) return null;
  return { id: s.id, ...s.data() } as SalesOrder;
}

/**
 * Confirms a user has access to a project. Used by route guards so that
 * a direct URL like `/portal/p/VELA-001/dashboard` can't be loaded by a
 * different client.
 */
export async function userCanAccessProject(uid: string, projectId: string): Promise<boolean> {
  if (!uid || !projectId) return false;
  const s = await getDoc(doc(db, DESIGN_PROJECTS, projectId));
  if (!s.exists()) return false;
  const data = s.data() as DesignProject;
  return Array.isArray(data.clientPortalUserIds) && data.clientPortalUserIds.includes(uid);
}

/**
 * Approval counts for the portal dashboard.
 *
 * Reads (canonical collection + status names — see SalesOrder types):
 *   - `designSignOffs` (capital O) filtered by salesOrderId where
 *     status is `sent_to_client` (the one "awaiting client" state)
 *   - `changeOrders` filtered by salesOrderId where status is
 *     `pending_client`
 *
 * Returns counts + a representative "next due" Date if available.
 */
export async function getOpenApprovalsForSalesOrder(
  salesOrderId: string,
): Promise<{ signOffCount: number; changeOrderCount: number; nextDue: Date | null }> {
  if (!salesOrderId) return { signOffCount: 0, changeOrderCount: 0, nextDue: null };

  const [signOffs, changeOrders] = await Promise.all([
    getDocs(query(
      collection(db, 'designSignOffs'),
      where('salesOrderId', '==', salesOrderId),
      where('status', '==', 'sent_to_client'),
    )).catch(() => ({ docs: [] as any[] })),
    getDocs(query(
      collection(db, 'changeOrders'),
      where('salesOrderId', '==', salesOrderId),
      where('status', '==', 'pending_client'),
    )).catch(() => ({ docs: [] as any[] })),
  ]);

  let nextDue: Date | null = null;
  for (const d of [...signOffs.docs, ...changeOrders.docs]) {
    const data: any = d.data();
    const due: Timestamp | undefined = data.dueDate ?? data.expiresAt;
    if (due && typeof due.toDate === 'function') {
      const date = due.toDate();
      if (!nextDue || date < nextDue) nextDue = date;
    }
  }

  return {
    signOffCount: signOffs.docs.length,
    changeOrderCount: changeOrders.docs.length,
    nextDue,
  };
}
