/**
 * CRM Integration Service
 * Links WhatsApp conversations with CRM deals and logs activities
 */

import {
  doc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';

export type WhatsAppActivityType =
  | 'message_sent'
  | 'quote_shared'
  | 'file_shared'
  | 'order_update'
  | 'order_confirmation'
  | 'order_confirmation_sent'
  | 'deposit_request_sent'
  | 'payment_receipt_sent'
  | 'ai_interaction'
  | 'conversation_linked';

/**
 * Link a WhatsApp conversation to a CRM deal (bidirectional)
 */
export async function linkConversationToDeal(
  conversationId: string,
  dealId: string,
  dealTitle: string,
  linkedBy: string
): Promise<void> {
  // Update conversation with deal link
  await updateDoc(doc(db, 'whatsappConversations', conversationId), {
    linkedDealId: dealId,
    linkedDealTitle: dealTitle,
    updatedAt: serverTimestamp(),
  });

  // Update deal with conversation link
  await updateDoc(doc(db, 'deals', dealId), {
    whatsappConversationId: conversationId,
    updatedAt: serverTimestamp(),
  });

  // Log the activity
  await logWhatsAppActivity(dealId, 'conversation_linked', {
    conversationId,
    linkedBy,
  });
}

/**
 * Unlink a WhatsApp conversation from a CRM deal
 */
export async function unlinkConversationFromDeal(
  conversationId: string,
  dealId: string
): Promise<void> {
  await updateDoc(doc(db, 'whatsappConversations', conversationId), {
    linkedDealId: null,
    linkedDealTitle: null,
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'deals', dealId), {
    whatsappConversationId: null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Strip undefined values from an object (Firestore rejects undefined)
 */
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

/**
 * Log a WhatsApp activity to a CRM deal's activity timeline
 */
export async function logWhatsAppActivity(
  dealId: string,
  activityType: WhatsAppActivityType,
  details: Record<string, unknown>
): Promise<void> {
  await addDoc(collection(db, 'deals', dealId, 'activities'), {
    type: activityType,
    source: 'whatsapp',
    details: stripUndefined(details),
    createdAt: serverTimestamp(),
  });
}

/**
 * Search CRM deals by title or deal number
 */
export async function searchDeals(searchText: string): Promise<Array<{
  id: string;
  title: string;
  dealNumber?: string;
  customerName?: string;
  stage?: string;
}>> {
  // Firestore doesn't support full-text search, so we'll load recent deals and filter client-side
  const q = query(collection(db, 'deals'));
  const snap = await getDocs(q);

  const lower = searchText.toLowerCase();
  return snap.docs
    .map((doc) => ({
      id: doc.id,
      title: doc.data().title || '',
      dealNumber: doc.data().dealNumber,
      customerName: doc.data().customerName,
      stage: doc.data().stage,
    }))
    .filter(
      (d) =>
        d.title.toLowerCase().includes(lower) ||
        (d.dealNumber && d.dealNumber.toLowerCase().includes(lower)) ||
        (d.customerName && d.customerName.toLowerCase().includes(lower))
    )
    .slice(0, 10);
}
