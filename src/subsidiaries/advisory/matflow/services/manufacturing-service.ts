/**
 * Manufacturing Order Service
 * CRUD operations for manufacturing/production work orders
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase';
import { stripUndefined } from '../utils/stripUndefined';
import type {
  ManufacturingOrder,
  ManufacturingOrderStatus,
  CreateManufacturingOrderInput,
  ManufacturingOrderItem,
} from '../types/manufacturing';
import { MO_STATUS_TRANSITIONS } from '../types/manufacturing';

function getOrgId(): string {
  const orgId = localStorage.getItem('selectedOrgId') || localStorage.getItem('currentOrgId');
  if (!orgId) throw new Error('No organization selected');
  return orgId;
}

function moCollection(projectId: string) {
  const orgId = getOrgId();
  return collection(db, `organizations/${orgId}/advisory_projects/${projectId}/manufacturing_orders`);
}

function moDoc(projectId: string, moId: string) {
  const orgId = getOrgId();
  return doc(db, `organizations/${orgId}/advisory_projects/${projectId}/manufacturing_orders/${moId}`);
}

/** Generate order number */
function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `MO-${year}-${seq}`;
}

/** Get all manufacturing orders for a project */
export async function getManufacturingOrders(projectId: string): Promise<ManufacturingOrder[]> {
  const q = query(moCollection(projectId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ManufacturingOrder));
}

/** Get a single manufacturing order */
export async function getManufacturingOrder(projectId: string, moId: string): Promise<ManufacturingOrder | null> {
  const snap = await getDoc(moDoc(projectId, moId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ManufacturingOrder;
}

/** Create a new manufacturing order */
export async function createManufacturingOrder(
  projectId: string,
  input: CreateManufacturingOrderInput,
  userId: string,
  userName: string
): Promise<ManufacturingOrder> {
  const now = Timestamp.now();
  const orderNumber = generateOrderNumber();

  const materials: ManufacturingOrderItem[] = input.materials.map(m => ({
    ...m,
    quantityConsumed: 0,
    totalCost: m.quantityRequired * m.unitCost,
  }));

  const materialCost = materials.reduce((sum, m) => sum + m.totalCost, 0);

  const data = {
    projectId,
    orderNumber,
    status: 'draft' as ManufacturingOrderStatus,
    priority: input.priority,
    productName: input.productName,
    productDescription: input.productDescription || '',
    quantity: input.quantity,
    unit: input.unit,
    completedQuantity: 0,
    materials,
    workCenter: input.workCenter || '',
    assignedTo: input.assignedTo || '',
    assignedToName: input.assignedToName || '',
    plannedStartDate: input.plannedStartDate ? Timestamp.fromDate(input.plannedStartDate) : null,
    plannedEndDate: input.plannedEndDate ? Timestamp.fromDate(input.plannedEndDate) : null,
    actualStartDate: null,
    actualEndDate: null,
    estimatedCost: materialCost,
    actualCost: 0,
    laborCost: 0,
    materialCost,
    currency: 'UGX',
    qualityCheckRequired: input.qualityCheckRequired ?? false,
    defectQuantity: 0,
    boqId: input.boqId || '',
    boqItemIds: input.boqItemIds || [],
    notes: input.notes || '',
    history: [{
      action: 'Created',
      timestamp: now,
      userId,
      userName,
      notes: 'Manufacturing order created',
    }],
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
  };

  const ref = await addDoc(moCollection(projectId), data);
  return { id: ref.id, ...data } as unknown as ManufacturingOrder;
}

/** Update manufacturing order status */
export async function updateManufacturingOrderStatus(
  projectId: string,
  moId: string,
  newStatus: ManufacturingOrderStatus,
  userId: string,
  userName: string,
  notes?: string
): Promise<void> {
  const order = await getManufacturingOrder(projectId, moId);
  if (!order) throw new Error('Manufacturing order not found');

  const validTransitions = MO_STATUS_TRANSITIONS[order.status];
  if (!validTransitions.includes(newStatus)) {
    throw new Error(`Cannot transition from ${order.status} to ${newStatus}`);
  }

  const now = Timestamp.now();
  const updates: Record<string, unknown> = {
    status: newStatus,
    updatedAt: now,
    updatedBy: userId,
  };

  if (newStatus === 'in_progress' && !order.actualStartDate) {
    updates.actualStartDate = now;
  }
  if (newStatus === 'completed') {
    updates.actualEndDate = now;
    updates.completedQuantity = order.quantity;
  }

  const historyEntry = {
    action: `Status changed to ${newStatus}`,
    timestamp: now,
    userId,
    userName,
    notes: notes || '',
  };

  // Firestore arrayUnion would be ideal but we'll read-modify-write for simplicity
  const history = [...(order.history || []), historyEntry];
  updates.history = history;

  await updateDoc(moDoc(projectId, moId), updates);
}

/** Update manufacturing order fields */
export async function updateManufacturingOrder(
  projectId: string,
  moId: string,
  updates: Partial<Pick<ManufacturingOrder, 'productName' | 'productDescription' | 'quantity' | 'priority' | 'workCenter' | 'assignedTo' | 'assignedToName' | 'notes' | 'completedQuantity' | 'defectQuantity' | 'laborCost'>>,
  userId: string
): Promise<void> {
  await updateDoc(moDoc(projectId, moId), {
    ...stripUndefined(updates as Record<string, any>),
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });
}
