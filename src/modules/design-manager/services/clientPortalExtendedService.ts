/**
 * Extended Client Portal Service
 * Handles messaging, approvals, deliverables, payments, and SketchUp integration
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  limit,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '@/shared/services/firebase';
import { storage } from '@/shared/services/firebase';
import { nanoid } from 'nanoid';
import type {
  ClientPortalMessage,
  MessageContext,
  MessageSenderType,
  ProjectDeliverable,
  DeliverableType,
  DeliverableStatus,
  ClientApprovalItem,
  ApprovalItemType,
  ApprovalItemStatus,
  ClientPayment,
  PaymentMethod,
  SketchUpModel,
  ExtendedClientPortalData,
} from '../types/clientPortal';

// ============================================================================
// MESSAGING SERVICE
// ============================================================================

/**
 * Send a message in the client portal
 */
export async function sendPortalMessage(
  projectId: string,
  quoteId: string | undefined,
  senderType: MessageSenderType,
  senderName: string,
  content: string,
  context: MessageContext = 'general',
  options?: {
    senderId?: string;
    senderEmail?: string;
    subject?: string;
    contextId?: string;
    attachments?: Array<{ name: string; url: string; type: string; size: number }>;
  }
): Promise<ClientPortalMessage> {
  const messagesRef = collection(db, 'clientPortalMessages');
  
  const message: Omit<ClientPortalMessage, 'id'> = {
    projectId,
    senderType,
    senderName,
    content,
    context,
    isRead: false,
    createdAt: Timestamp.now(),
  };
  
  // Add optional fields
  if (quoteId) message.quoteId = quoteId;
  if (options?.senderId) message.senderId = options.senderId;
  if (options?.senderEmail) message.senderEmail = options.senderEmail;
  if (options?.subject) message.subject = options.subject;
  if (options?.contextId) message.contextId = options.contextId;
  if (options?.attachments?.length) {
    message.attachments = options.attachments.map(att => ({
      id: nanoid(10),
      ...att,
    }));
  }
  
  const docRef = await addDoc(messagesRef, {
    ...message,
    createdAt: serverTimestamp(),
  });
  
  return { id: docRef.id, ...message };
}

/**
 * Get messages for a project/quote
 */
export async function getPortalMessages(
  projectId: string,
  quoteId?: string,
  limitCount: number = 50
): Promise<ClientPortalMessage[]> {
  const messagesRef = collection(db, 'clientPortalMessages');
  
  let q;
  if (quoteId) {
    q = query(
      messagesRef,
      where('projectId', '==', projectId),
      where('quoteId', '==', quoteId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
  } else {
    q = query(
      messagesRef,
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as ClientPortalMessage[];
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(
  messageIds: string[]
): Promise<void> {
  const updates = messageIds.map(id => 
    updateDoc(doc(db, 'clientPortalMessages', id), {
      isRead: true,
      readAt: serverTimestamp(),
    })
  );
  await Promise.all(updates);
}

/**
 * Get unread message count
 */
export async function getUnreadMessageCount(
  projectId: string,
  forClient: boolean = true
): Promise<number> {
  const messagesRef = collection(db, 'clientPortalMessages');
  const senderType = forClient ? 'team' : 'client';
  
  const q = query(
    messagesRef,
    where('projectId', '==', projectId),
    where('senderType', '==', senderType),
    where('isRead', '==', false)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.size;
}

// ============================================================================
// DELIVERABLES SERVICE
// ============================================================================

/**
 * Create a project deliverable
 */
export async function createDeliverable(
  projectId: string,
  name: string,
  type: DeliverableType,
  file: File,
  userId: string,
  options?: {
    quoteId?: string;
    description?: string;
    requiresPayment?: boolean;
    paymentAmount?: number;
    paymentCurrency?: string;
    requiresApproval?: boolean;
  }
): Promise<ProjectDeliverable> {
  // Upload file to storage
  const fileId = nanoid(12);
  const fileExt = file.name.split('.').pop();
  const storagePath = `projects/${projectId}/deliverables/${fileId}.${fileExt}`;
  const storageRef = ref(storage, storagePath);
  
  await uploadBytes(storageRef, file);
  const fileUrl = await getDownloadURL(storageRef);
  
  const deliverablesRef = collection(db, 'projectDeliverables');
  
  const deliverable: Omit<ProjectDeliverable, 'id'> = {
    projectId,
    name,
    type,
    version: 1,
    fileName: file.name,
    fileUrl,
    fileSize: file.size,
    mimeType: file.type,
    status: options?.requiresPayment ? 'pending_payment' : 'available',
    requiresPayment: options?.requiresPayment || false,
    downloadCount: 0,
    createdAt: Timestamp.now(),
    createdBy: userId,
  };
  
  // Add optional fields
  if (options?.quoteId) deliverable.quoteId = options.quoteId;
  if (options?.description) deliverable.description = options.description;
  if (options?.paymentAmount) deliverable.paymentAmount = options.paymentAmount;
  if (options?.paymentCurrency) deliverable.paymentCurrency = options.paymentCurrency;
  if (options?.requiresApproval) {
    deliverable.requiresApproval = true;
    deliverable.approvalStatus = 'pending';
  }
  
  const docRef = await addDoc(deliverablesRef, {
    ...deliverable,
    createdAt: serverTimestamp(),
  });
  
  return { id: docRef.id, ...deliverable };
}

/**
 * Get deliverables for a project
 */
export async function getProjectDeliverables(
  projectId: string,
  quoteId?: string
): Promise<ProjectDeliverable[]> {
  const deliverablesRef = collection(db, 'projectDeliverables');
  
  let q;
  if (quoteId) {
    q = query(
      deliverablesRef,
      where('projectId', '==', projectId),
      where('quoteId', '==', quoteId),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(
      deliverablesRef,
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc')
    );
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as ProjectDeliverable[];
}

/**
 * Update deliverable status
 */
export async function updateDeliverableStatus(
  deliverableId: string,
  status: DeliverableStatus
): Promise<void> {
  await updateDoc(doc(db, 'projectDeliverables', deliverableId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Track deliverable download
 */
export async function trackDeliverableDownload(
  deliverableId: string,
  downloadedBy?: string
): Promise<void> {
  const deliverableRef = doc(db, 'projectDeliverables', deliverableId);
  const deliverableDoc = await getDoc(deliverableRef);
  
  if (!deliverableDoc.exists()) {
    throw new Error('Deliverable not found');
  }
  
  const data = deliverableDoc.data();
  const updates: Record<string, unknown> = {
    downloadCount: (data.downloadCount || 0) + 1,
    lastDownloadedAt: serverTimestamp(),
  };
  
  if (downloadedBy) {
    updates.lastDownloadedBy = downloadedBy;
  }
  
  // Update status if first download
  if (data.status === 'available') {
    updates.status = 'downloaded';
  }
  
  await updateDoc(deliverableRef, updates);
}

/**
 * Check if deliverable can be downloaded
 */
export async function canDownloadDeliverable(
  deliverableId: string,
  projectId: string
): Promise<{ canDownload: boolean; reason?: string }> {
  const deliverableDoc = await getDoc(doc(db, 'projectDeliverables', deliverableId));
  
  if (!deliverableDoc.exists()) {
    return { canDownload: false, reason: 'Deliverable not found' };
  }
  
  const deliverable = deliverableDoc.data() as ProjectDeliverable;
  
  if (deliverable.status === 'pending_payment') {
    // Check if payment has been made
    const paymentsRef = collection(db, 'clientPayments');
    const q = query(
      paymentsRef,
      where('projectId', '==', projectId),
      where('status', '==', 'completed'),
      where('unlockedDeliverableIds', 'array-contains', deliverableId)
    );
    const paymentSnapshot = await getDocs(q);
    
    if (paymentSnapshot.empty) {
      return { canDownload: false, reason: 'Payment required' };
    }
  }
  
  if (deliverable.status === 'draft') {
    return { canDownload: false, reason: 'Deliverable not yet available' };
  }
  
  if (deliverable.status === 'superseded') {
    return { canDownload: false, reason: 'This version has been superseded' };
  }
  
  if (deliverable.requiresApproval && deliverable.approvalStatus !== 'approved') {
    return { canDownload: false, reason: 'Approval required' };
  }
  
  return { canDownload: true };
}

// ============================================================================
// APPROVAL ITEMS SERVICE
// ============================================================================

/**
 * Create an approval item
 */
export async function createApprovalItem(
  projectId: string,
  type: ApprovalItemType,
  name: string,
  quantity: number,
  unitCost: number,
  userId: string,
  options?: {
    quoteId?: string;
    designItemId?: string;
    designItemName?: string;
    description?: string;
    sku?: string;
    unit?: string;
    currency?: string;
    vendor?: string;
    leadTime?: string;
    imageUrl?: string;
    specificationUrl?: string;
    material?: ClientApprovalItem['material'];
    part?: ClientApprovalItem['part'];
    alternativeOptions?: ClientApprovalItem['alternativeOptions'];
    priority?: ClientApprovalItem['priority'];
    dueDate?: Date;
    internalNotes?: string;
    // Design option specific fields
    designOption?: ClientApprovalItem['designOption'];
    isOptionGroup?: boolean;
    sourceOptionId?: string;
    sourceGroupId?: string;
  }
): Promise<ClientApprovalItem> {
  const approvalsRef = collection(db, 'clientApprovalItems');
  
  const totalCost = quantity * unitCost;
  
  const item: Omit<ClientApprovalItem, 'id'> = {
    projectId,
    type,
    name,
    quantity,
    unit: options?.unit || 'units',
    unitCost,
    totalCost,
    currency: options?.currency || 'UGX',
    status: 'pending',
    priority: options?.priority || 'medium',
    createdAt: Timestamp.now(),
    createdBy: userId,
  };
  
  // Add optional fields
  if (options?.quoteId) item.quoteId = options.quoteId;
  if (options?.designItemId) item.designItemId = options.designItemId;
  if (options?.designItemName) item.designItemName = options.designItemName;
  if (options?.description) item.description = options.description;
  if (options?.sku) item.sku = options.sku;
  if (options?.vendor) item.vendor = options.vendor;
  if (options?.leadTime) item.leadTime = options.leadTime;
  if (options?.imageUrl) item.imageUrl = options.imageUrl;
  if (options?.specificationUrl) item.specificationUrl = options.specificationUrl;
  if (options?.material) item.material = options.material;
  if (options?.part) item.part = options.part;
  if (options?.alternativeOptions) item.alternativeOptions = options.alternativeOptions;
  if (options?.dueDate) item.dueDate = Timestamp.fromDate(options.dueDate);
  if (options?.internalNotes) item.internalNotes = options.internalNotes;
  // Design option specific fields
  if (options?.designOption) item.designOption = options.designOption;
  if (options?.isOptionGroup) item.isOptionGroup = options.isOptionGroup;
  if (options?.sourceOptionId) item.sourceOptionId = options.sourceOptionId;
  if (options?.sourceGroupId) item.sourceGroupId = options.sourceGroupId;

  const docRef = await addDoc(approvalsRef, {
    ...item,
    createdAt: serverTimestamp(),
  });
  
  return { id: docRef.id, ...item };
}

/**
 * Get approval items for a project
 */
export async function getApprovalItems(
  projectId: string,
  options?: {
    quoteId?: string;
    type?: ApprovalItemType;
    status?: ApprovalItemStatus;
  }
): Promise<ClientApprovalItem[]> {
  const approvalsRef = collection(db, 'clientApprovalItems');
  
  let q = query(approvalsRef, where('projectId', '==', projectId));
  
  if (options?.quoteId) {
    q = query(q, where('quoteId', '==', options.quoteId));
  }
  if (options?.type) {
    q = query(q, where('type', '==', options.type));
  }
  if (options?.status) {
    q = query(q, where('status', '==', options.status));
  }
  
  q = query(q, orderBy('createdAt', 'desc'));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as ClientApprovalItem[];
}

/**
 * Submit client approval response
 */
export async function submitApprovalResponse(
  itemId: string,
  status: ApprovalItemStatus,
  respondedBy: string,
  options?: {
    selectedAlternativeId?: string;
    notes?: string;
  }
): Promise<void> {
  const itemRef = doc(db, 'clientApprovalItems', itemId);
  
  const clientResponse: ClientApprovalItem['clientResponse'] = {
    status,
    respondedAt: Timestamp.now(),
    respondedBy,
  };
  
  if (options?.selectedAlternativeId) {
    clientResponse.selectedAlternativeId = options.selectedAlternativeId;
  }
  if (options?.notes) {
    clientResponse.notes = options.notes;
  }
  
  await updateDoc(itemRef, {
    status,
    clientResponse,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get pending approval count
 */
export async function getPendingApprovalCount(
  projectId: string
): Promise<number> {
  const approvalsRef = collection(db, 'clientApprovalItems');
  const q = query(
    approvalsRef,
    where('projectId', '==', projectId),
    where('status', '==', 'pending')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.size;
}

// ============================================================================
// PAYMENTS SERVICE
// ============================================================================

/**
 * Record a payment
 */
export async function recordPayment(
  projectId: string,
  quoteId: string,
  amount: number,
  method: PaymentMethod,
  paymentType: ClientPayment['paymentType'],
  options?: {
    currency?: string;
    reference?: string;
    transactionId?: string;
    description?: string;
    unlockedDeliverableIds?: string[];
  }
): Promise<ClientPayment> {
  const paymentsRef = collection(db, 'clientPayments');
  
  const payment: Omit<ClientPayment, 'id'> = {
    projectId,
    quoteId,
    amount,
    currency: options?.currency || 'UGX',
    method,
    status: 'pending',
    paymentType,
    createdAt: Timestamp.now(),
  };
  
  if (options?.reference) payment.reference = options.reference;
  if (options?.transactionId) payment.transactionId = options.transactionId;
  if (options?.description) payment.description = options.description;
  if (options?.unlockedDeliverableIds) {
    payment.unlockedDeliverableIds = options.unlockedDeliverableIds;
  }
  
  const docRef = await addDoc(paymentsRef, {
    ...payment,
    createdAt: serverTimestamp(),
  });
  
  return { id: docRef.id, ...payment };
}

/**
 * Confirm a payment
 */
export async function confirmPayment(
  paymentId: string,
  confirmedBy: string,
  receiptUrl?: string
): Promise<void> {
  const paymentRef = doc(db, 'clientPayments', paymentId);
  const paymentDoc = await getDoc(paymentRef);
  
  if (!paymentDoc.exists()) {
    throw new Error('Payment not found');
  }
  
  const updates: Record<string, unknown> = {
    status: 'completed',
    paidAt: serverTimestamp(),
    confirmedAt: serverTimestamp(),
    confirmedBy,
  };
  
  if (receiptUrl) {
    updates.receiptUrl = receiptUrl;
  }
  
  await updateDoc(paymentRef, updates);
  
  // Unlock deliverables if any
  const payment = paymentDoc.data() as ClientPayment;
  if (payment.unlockedDeliverableIds?.length) {
    const unlockPromises = payment.unlockedDeliverableIds.map(id =>
      updateDeliverableStatus(id, 'available')
    );
    await Promise.all(unlockPromises);
  }
}

/**
 * Get payments for a project
 */
export async function getProjectPayments(
  projectId: string,
  quoteId?: string
): Promise<ClientPayment[]> {
  const paymentsRef = collection(db, 'clientPayments');
  
  let q;
  if (quoteId) {
    q = query(
      paymentsRef,
      where('projectId', '==', projectId),
      where('quoteId', '==', quoteId),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(
      paymentsRef,
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc')
    );
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as ClientPayment[];
}

/**
 * Calculate payment summary
 */
export async function getPaymentSummary(
  projectId: string,
  quoteTotal: number
): Promise<{ totalPaid: number; balanceDue: number }> {
  const payments = await getProjectPayments(projectId);
  const completedPayments = payments.filter(p => p.status === 'completed');
  const totalPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0);
  
  return {
    totalPaid,
    balanceDue: quoteTotal - totalPaid,
  };
}

// ============================================================================
// SKETCHUP INTEGRATION
// ============================================================================

/**
 * Register a SketchUp model
 */
export async function registerSketchUpModel(
  projectId: string,
  name: string,
  modelFileUrl: string,
  options?: {
    designItemId?: string;
    description?: string;
    thumbnailUrl?: string;
    viewerEmbedUrl?: string;
    scenes?: SketchUpModel['scenes'];
    annotations?: SketchUpModel['annotations'];
    isPublic?: boolean;
  }
): Promise<SketchUpModel> {
  const modelsRef = collection(db, 'sketchupModels');
  
  const model: Omit<SketchUpModel, 'id'> = {
    projectId,
    name,
    version: 1,
    modelFileUrl,
    isPublic: options?.isPublic || false,
    createdAt: Timestamp.now(),
  };
  
  if (options?.designItemId) model.designItemId = options.designItemId;
  if (options?.description) model.description = options.description;
  if (options?.thumbnailUrl) model.thumbnailUrl = options.thumbnailUrl;
  if (options?.viewerEmbedUrl) model.viewerEmbedUrl = options.viewerEmbedUrl;
  if (options?.scenes) model.scenes = options.scenes;
  if (options?.annotations) model.annotations = options.annotations;
  if (!options?.isPublic) {
    model.accessToken = nanoid(32);
  }
  
  const docRef = await addDoc(modelsRef, {
    ...model,
    createdAt: serverTimestamp(),
  });
  
  return { id: docRef.id, ...model };
}

/**
 * Get SketchUp models for a project
 */
export async function getProjectSketchUpModels(
  projectId: string
): Promise<SketchUpModel[]> {
  const modelsRef = collection(db, 'sketchupModels');
  const q = query(
    modelsRef,
    where('projectId', '==', projectId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as SketchUpModel[];
}

/**
 * Generate SketchUp Viewer embed URL
 * Uses Trimble's SketchUp Viewer API
 */
export function generateSketchUpViewerUrl(modelFileUrl: string): string {
  // SketchUp Viewer API endpoint
  // Note: Actual implementation requires SketchUp API credentials
  const encodedUrl = encodeURIComponent(modelFileUrl);
  return `https://3dwarehouse.sketchup.com/embed.html?mid=${encodedUrl}`;
}

// ============================================================================
// EXTENDED PORTAL DATA
// ============================================================================

/**
 * Get extended client portal data for team management
 * Simplified version that only requires projectId
 */
export async function getExtendedClientPortalData(
  projectId: string
): Promise<{
  messages: ClientPortalMessage[];
  deliverables: ProjectDeliverable[];
  approvalItems: ClientApprovalItem[];
  sketchupModels: SketchUpModel[];
}> {
  const [
    messages,
    deliverables,
    approvalItems,
    sketchupModels,
  ] = await Promise.all([
    getPortalMessages(projectId),
    getProjectDeliverables(projectId),
    getApprovalItems(projectId, {}),
    getProjectSketchUpModels(projectId),
  ]);
  
  return {
    messages,
    deliverables,
    approvalItems,
    sketchupModels,
  };
}

/**
 * Get complete extended client portal data with payment info
 */
export async function getExtendedPortalData(
  projectId: string,
  quoteId: string,
  quoteTotal: number
): Promise<Partial<ExtendedClientPortalData>> {
  const [
    messages,
    deliverables,
    approvalItems,
    payments,
    sketchupModels,
    unreadCount,
    pendingApprovals,
  ] = await Promise.all([
    getPortalMessages(projectId, quoteId),
    getProjectDeliverables(projectId, quoteId),
    getApprovalItems(projectId, { quoteId }),
    getProjectPayments(projectId, quoteId),
    getProjectSketchUpModels(projectId),
    getUnreadMessageCount(projectId, true),
    getPendingApprovalCount(projectId),
  ]);
  
  const { totalPaid, balanceDue } = await getPaymentSummary(projectId, quoteTotal);
  
  return {
    messages,
    unreadMessageCount: unreadCount,
    deliverables,
    approvalItems,
    pendingApprovalCount: pendingApprovals,
    payments,
    totalPaid,
    balanceDue,
    sketchupModels,
  };
}
