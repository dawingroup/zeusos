/**
 * changeOrderNotificationService — outbound delivery for Change Order
 * client-approval requests.
 *
 * All channels share a single portal URL (with `?src=<channel>` query
 * param so the approval event log can attribute which deep-link the
 * client used). This file currently implements the WhatsApp path and
 * exposes generic helpers (`getOrCreatePortalTokenForCO`, `buildPortalUrl`,
 * `previewChangeOrderMessage`) that the email / in-person paths will
 * reuse when they land.
 *
 * Delivery outcomes are persisted onto `ChangeOrder.deliveryTracking`
 * so the detail UI can render "Sent via WhatsApp at 14:22, delivered
 * 14:22, read 14:25" without re-hitting the channel.
 */

import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  getDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import { deepStripUndefined } from '@/subsidiaries/advisory/core/firebase/converters';
import type {
  ChangeOrder,
  ChangeOrderDeliveryTracking,
  SalesOrder,
  WhatsAppDeliveryStatus,
} from '../types';
import {
  CHANGE_ORDERS_COLLECTION,
  CLIENT_PORTAL_TOKENS_COLLECTION,
  SO_COLLECTION,
} from '../constants';
import { sendWhatsAppMessage } from '@/modules/whatsapp/services/whatsappApiService';
import { uploadFile } from '@/shared/services/firebase/storage';
import { getSubsidiaryBrandingLogoUrl } from '@/shared/services/branding.service';
import { getChangeOrder, getApprovalEvents, submitToClient } from './changeOrderService';
import { changeOrderPdfService } from './changeOrderPdfGenerator';

// ============================================================================
// PORTAL TOKEN
// ============================================================================

const TOKEN_TTL_DAYS = 30;

/**
 * Fetch the existing portal token for a CO, or mint a new one. Tokens
 * are stored in `clientPortalTokens` and keyed by CO id + type — the
 * same token is reused across channels so revoking it (future work)
 * flips every outbound link at once.
 */
export async function getOrCreatePortalTokenForCO(
  co: ChangeOrder,
  createdBy: string,
): Promise<{ tokenId: string; token: string; expiresAt: Timestamp }> {
  // Look for an existing, non-expired token first
  const existingQ = query(
    collection(db, CLIENT_PORTAL_TOKENS_COLLECTION),
    where('type', '==', 'change_order'),
    where('entityId', '==', co.id),
    where('expiresAt', '>', Timestamp.now()),
    orderBy('expiresAt', 'desc'),
    // Firestore rules require list queries on this collection
    // to be explicitly bounded.
    limit(1),
  );
  const existingSnap = await getDocs(existingQ);
  for (const d of existingSnap.docs) {
    const data = d.data() as { token: string; expiresAt: Timestamp };
    return {
      tokenId: d.id,
      token: data.token,
      expiresAt: data.expiresAt,
    };
  }

  // Mint a fresh token
  const token = mintToken();
  const expiresAt = defaultExpiresAt();
  const ref = await addDoc(collection(db, CLIENT_PORTAL_TOKENS_COLLECTION), {
    token,
    type: 'change_order',
    entityId: co.id,
    salesOrderId: co.salesOrderId,
    createdAt: Timestamp.now(),
    createdBy,
    expiresAt,
  });

  // Stamp token id back onto the CO so the detail UI can cross-link
  await updateDoc(doc(db, CHANGE_ORDERS_COLLECTION, co.id), {
    portalTokenId: ref.id,
  });

  return { tokenId: ref.id, token, expiresAt };
}

function mintToken(): string {
  // 22-char urlsafe-ish — collision risk is fine for short-lived portal use
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function defaultExpiresAt(): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() + TOKEN_TTL_DAYS);
  return Timestamp.fromDate(d);
}

// ============================================================================
// URL + MESSAGE BUILDERS
// ============================================================================

export function buildPortalUrl(args: {
  token: string;
  coId: string;
  channel: 'whatsapp' | 'email' | 'portal';
  baseUrl?: string;
}): string {
  const base = args.baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/client-portal/${args.token}/change-order/${args.coId}?src=${args.channel}`;
}

export interface COMessagePreview {
  text: string;
  portalUrl: string;
  phoneNumber: string | null;
  recipientName: string;
  channel: 'whatsapp' | 'email' | 'portal';
  templateName?: string;
  templateHeaderType?: 'image' | 'text' | null;
  templateHeaderImageUrl?: string;
  templateParams?: {
    customerName: string;
    changeOrderNumber: string;
    changeOrderTitle: string;
    salesOrderNumber: string;
    impactAmountAbs: string;
    impactDirection: 'increase' | 'decrease';
    newOrderTotal: string;
    approvalUrl: string;
    negotiatedAdjustmentNote?: string;
  };
}

/**
 * Build the text body + deep-link for a CO approval request. Called
 * by both the live send paths and the "preview before sending" UI.
 *
 * Text body is intentionally short — WhatsApp Business templates have
 * a 1024-char body cap, and short messages read better on mobile.
 * Customers outside the 24-hour service window still see the CTA; any
 * Meta template replacing this body should keep the link parameter.
 */
export async function previewChangeOrderMessage(
  coId: string,
  channel: 'whatsapp' | 'email' | 'portal',
  userId: string,
): Promise<COMessagePreview> {
  const co = await getChangeOrder(coId);
  if (!co) throw new Error('Change order not found');

  const so = await loadSO(co.salesOrderId);
  if (!so) throw new Error('Sales order not found');

  const { token } = await getOrCreatePortalTokenForCO(co, userId);
  const portalUrl = buildPortalUrl({ token, coId: co.id, channel });
  const resolvedPhone = await resolveCustomerPhone(so);

  const amountLabel = formatCurrency(co.priceImpact, so.currency);
  const totalLabel = formatCurrency(co.newOrderTotal, so.currency);
  const signed = co.priceImpact >= 0 ? `+${amountLabel}` : amountLabel;
  const impactAmountAbs = formatCurrency(Math.abs(co.priceImpact), so.currency);
  const impactDirection = co.priceImpact >= 0 ? 'increase' : 'decrease';

  let templateHeaderType: 'image' | 'text' | null = null;
  let templateHeaderImageUrl: string | undefined;
  if (channel === 'whatsapp') {
    try {
      const templateConfigSnap = await getDoc(doc(db, 'whatsappTemplates', 'change_order_submission'));
      const ht = templateConfigSnap.exists() ? templateConfigSnap.data()?.headerType : null;
      if (ht === 'image' || ht === 'text') templateHeaderType = ht;

      const waConfigSnap = await getDoc(doc(db, 'systemConfig', 'whatsappConfig'));
      if (waConfigSnap.exists()) {
        templateHeaderImageUrl = waConfigSnap.data()?.templateHeaderImages?.changeOrderSubmission
          || waConfigSnap.data()?.templateHeaderImages?.default;
      }
    } catch {
      // Non-blocking for preview generation.
    }
  }

  const text =
    `Hi ${so.customerName},\n\n` +
    `We have a change order on your project ${so.orderNumber} — ${co.changeOrderNumber}: ${co.title}.\n\n` +
    `Net change: ${signed}\n` +
    `${co.negotiatedAdjustmentNote ? `Negotiation note: ${co.negotiatedAdjustmentNote}\n` : ''}` +
    `New order total: ${totalLabel}\n\n` +
    `Please review and approve:\n${portalUrl}\n\n` +
    `Questions? Just reply to this message.`;

  return {
    text,
    portalUrl,
    phoneNumber: resolvedPhone,
    recipientName: so.customerName,
    channel,
    ...(channel === 'whatsapp' ? {
      templateName: 'change_order_submission',
      templateHeaderType,
      ...(templateHeaderImageUrl ? { templateHeaderImageUrl } : {}),
      templateParams: {
        customerName: so.customerName,
        changeOrderNumber: co.changeOrderNumber,
        changeOrderTitle: co.title,
        salesOrderNumber: so.orderNumber,
        impactAmountAbs,
        impactDirection,
        newOrderTotal: totalLabel,
        approvalUrl: portalUrl,
        ...(co.negotiatedAdjustmentNote
          ? { negotiatedAdjustmentNote: co.negotiatedAdjustmentNote }
          : {}),
      },
    } : {}),
  };
}

// ============================================================================
// SEND — WHATSAPP
// ============================================================================

export interface SendResult {
  success: boolean;
  error?: string;
  windowClosed?: boolean;
  messageId?: string;
  waMessageId?: string;
  pdfUrl?: string;
}

/**
 * Send a CO approval request via WhatsApp. Writes delivery metadata
 * onto `ChangeOrder.deliveryTracking.whatsapp`, appends `'whatsapp'`
 * to `sentToClientVia`, and (if the CO is still in `pending_internal`
 * or `draft`) transitions it to `pending_client` via the standard
 * `submitToClient` so the approval event log stays consistent.
 *
 * Returns a `SendResult` so the UI can show a friendly error when
 * Meta's 24-hour customer-service window is closed.
 */
export async function sendChangeOrderViaWhatsApp(
  coId: string,
  userId: string,
  userName?: string,
): Promise<SendResult> {
  const co = await getChangeOrder(coId);
  if (!co) return { success: false, error: 'Change order not found' };

  const so = await loadSO(co.salesOrderId);
  if (!so) return { success: false, error: 'Sales order not found' };
  const resolvedPhone = await resolveCustomerPhone(so);
  if (!resolvedPhone) {
    return {
      success: false,
      error: 'Customer has no phone number on file — add one before sending via WhatsApp.',
    };
  }

  const { token } = await getOrCreatePortalTokenForCO(co, userId);
  const portalUrl = buildPortalUrl({ token, coId: co.id, channel: 'whatsapp' });
  const phone = normalizePhone(resolvedPhone);
  const amountLabel = formatCurrency(co.priceImpact, so.currency);
  const totalLabel = formatCurrency(co.newOrderTotal, so.currency);
  const signed = co.priceImpact >= 0 ? `+${amountLabel}` : amountLabel;
  const absImpact = formatCurrency(Math.abs(co.priceImpact), so.currency);
  const impactDirection = co.priceImpact >= 0 ? 'increase' : 'decrease';

  let logoUrl: string | undefined;
  try {
    logoUrl = await getSubsidiaryBrandingLogoUrl(so.subsidiaryId);
  } catch {
    logoUrl = undefined;
  }

  const events = await getApprovalEvents(co.id).catch(() => []);
  const pdfBlob = await changeOrderPdfService.generateBlob({
    changeOrder: co,
    salesOrder: so,
    approvalEvents: events,
    generatedBy: userName || userId || undefined,
    company: {
      name: 'Dawin Finishes',
      ...(logoUrl ? { logoUrl } : {}),
      addressLine1: 'Kayondo Road, Kyambogo Upper Estate Ground Floor, Jordan House',
      addressLine2: 'Kampala, Uganda',
      website: 'dawinfinishes.com',
    },
  });
  const pdfFilename = changeOrderPdfService.buildFilename(co);
  const pdfStoragePath = `change-orders/${co.id}/${pdfFilename}`;
  let pdfUrl: string | undefined;
  try {
    const uploadResult = await uploadFile(pdfStoragePath, pdfBlob);
    pdfUrl = uploadResult.url;
  } catch (err) {
    // Don't block the outbound WhatsApp submission when storage rules
    // don't allow this user to upload CO PDFs from the client.
    console.warn('[changeOrderNotificationService] CO PDF upload skipped', err);
  }

  let headerType: 'image' | 'text' | null = null;
  let headerImageUrl: string | undefined;
  try {
    const templateConfigSnap = await getDoc(doc(db, 'whatsappTemplates', 'change_order_submission'));
    headerType = templateConfigSnap.exists()
      ? ((templateConfigSnap.data()?.headerType as 'image' | 'text' | null) ?? null)
      : null;
    const waConfigSnap = await getDoc(doc(db, 'systemConfig', 'whatsappConfig'));
    headerImageUrl = waConfigSnap.exists()
      ? waConfigSnap.data()?.templateHeaderImages?.changeOrderSubmission
        || waConfigSnap.data()?.templateHeaderImages?.default
      : undefined;
  } catch (err) {
    // Some roles can send templates but cannot read WhatsApp config docs.
    console.warn('[changeOrderNotificationService] WhatsApp template config fallback', err);
  }

  const templateComponents: Record<string, unknown>[] = [];
  if (headerType === 'image' && headerImageUrl) {
    templateComponents.push({
      type: 'header',
      parameters: [{ type: 'image', image: { link: headerImageUrl } }],
    });
  } else if (headerType === 'text') {
    templateComponents.push({
      type: 'header',
      parameters: [{ type: 'text', text: co.changeOrderNumber }],
    });
  }
  templateComponents.push({
    type: 'body',
    parameters: [
      { type: 'text', text: so.customerName },
      { type: 'text', text: co.changeOrderNumber },
      { type: 'text', text: co.title },
      { type: 'text', text: so.orderNumber },
      { type: 'text', text: absImpact },
      { type: 'text', text: impactDirection },
      { type: 'text', text: totalLabel },
      { type: 'text', text: portalUrl },
    ],
  });

  const templateResult = await sendWhatsAppMessage({
    phoneNumber: phone,
    customerId: so.customerId,
    customerName: so.customerName,
    messageType: 'template',
    templateName: 'change_order_submission',
    templateParams: {
      '1': so.customerName,
      '2': co.changeOrderNumber,
      '3': co.title,
      '4': so.orderNumber,
      '5': absImpact,
      '6': impactDirection,
      '7': totalLabel,
      '8': portalUrl,
    },
    interactive: { templateComponents } as Record<string, unknown>,
  });

  let result = templateResult;
  if (result.success && pdfUrl) {
    const pdfTemplateResult = await sendWhatsAppMessage({
      conversationId: result.conversationId || undefined,
      phoneNumber: phone,
      customerId: so.customerId,
      customerName: so.customerName,
      messageType: 'template',
      templateName: 'change_order_document',
      templateParams: {
        '1': so.customerName,
        '2': co.changeOrderNumber,
        '3': co.title,
        '4': signed,
      },
      headerConfig: {
        format: 'document',
        url: pdfUrl,
        filename: pdfFilename,
      },
    });

    if (!pdfTemplateResult.success) {
      // Fallback to regular document message if document template isn't available.
      const docResult = await sendWhatsAppMessage({
        conversationId: result.conversationId || undefined,
        phoneNumber: phone,
        customerId: so.customerId,
        customerName: so.customerName,
        messageType: 'document',
        documentUrl: pdfUrl,
        documentCaption: `Change Order ${co.changeOrderNumber} — ${co.title}`,
        documentFilename: pdfFilename,
      });
      if (!docResult.success) {
        console.warn('[changeOrderNotificationService] CO PDF follow-up failed', {
          templateError: pdfTemplateResult.error,
          documentError: docResult.error,
        });
      }
    }
  }

  const now = Timestamp.now();

  const existingTracking: ChangeOrderDeliveryTracking = co.deliveryTracking ?? {};
  const whatsappTracking: WhatsAppDeliveryStatus = {
    ...(existingTracking.whatsapp ?? {}),
    conversationId: result.conversationId || existingTracking.whatsapp?.conversationId,
    messageId: result.messageId || existingTracking.whatsapp?.messageId,
    waMessageId: result.waMessageId || existingTracking.whatsapp?.waMessageId,
    phoneNumber: phone,
    sentAt: result.success ? now : existingTracking.whatsapp?.sentAt,
    lastError: result.success ? undefined : result.error,
    sentBy: userId,
  };

  await updateDoc(doc(db, CHANGE_ORDERS_COLLECTION, co.id), deepStripUndefined({
    deliveryTracking: { ...existingTracking, whatsapp: whatsappTracking },
    sentToClientVia: Array.from(new Set([...(co.sentToClientVia ?? []), 'whatsapp'])),
    updatedAt: now,
  }));

  // If the CO was still internal, kick it to pending_client so the
  // client-portal flow can resolve it. Swallowed errors — the message
  // already went out.
  if (result.success && (co.status === 'draft' || co.status === 'pending_internal')) {
    try {
      await submitToClient(
        co.id,
        userId,
        ['whatsapp'],
        userName,
        'Auto-submitted by WhatsApp notification',
      );
    } catch (err) {
      console.warn('[changeOrderNotificationService] submitToClient failed', err);
    }
  }

  return {
    success: result.success,
    error: result.error,
    windowClosed: result.windowClosed,
    messageId: result.messageId,
    waMessageId: result.waMessageId,
    ...(pdfUrl ? { pdfUrl } : {}),
  };
}

// ============================================================================
// HELPERS
// ============================================================================

async function loadSO(salesOrderId: string): Promise<SalesOrder | null> {
  const snap = await getDoc(doc(db, SO_COLLECTION, salesOrderId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as SalesOrder;
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, '');
}

async function resolveCustomerPhone(so: SalesOrder): Promise<string | null> {
  if (so.customerPhone?.trim()) return so.customerPhone.trim();
  if (!so.customerId) return null;

  try {
    const { getCustomer } = await import('@/modules/customer-hub/services/customerService');
    const customer = await getCustomer(so.customerId);
    if (!customer) return null;

    const phone =
      customer.phone ||
      customer.contacts?.find((c: { isPrimary: boolean; phone?: string }) => c.isPrimary)?.phone ||
      customer.contacts?.[0]?.phone ||
      '';

    const normalized = String(phone).trim();
    return normalized || null;
  } catch (err) {
    console.warn('[changeOrderNotificationService] customer phone lookup failed', err);
    return null;
  }
}

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
