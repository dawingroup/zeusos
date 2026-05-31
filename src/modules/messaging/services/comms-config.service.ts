/**
 * Comms config service — Phase 4.5.
 *
 * Reads/writes the commsConfig/{channel} docs that gate the comms backend:
 *   commsConfig/whatsapp — { enabled, activeProvider, allowedSenderRoles }
 *                          (read by metaWhatsAppWebhook kill-switch + sendMessage)
 *   commsConfig/email    — { enabled, provider, fromByBrand }  (Phase 4.3 target)
 *
 * Writes are gated to parent-org principals by firestore.rules (commsConfig).
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';

export interface WhatsAppConfig {
  enabled: boolean;
  activeProvider: 'meta' | 'zoko';
  allowedSenderRoles: string[];
}

export interface EmailConfig {
  enabled: boolean;
  provider: 'resend' | 'sendgrid' | '';
  /** brandId → from-address (e.g. zeus-digital → hello@zeusdigital.co). */
  fromByBrand: Record<string, string>;
}

const WHATSAPP_DEFAULTS: WhatsAppConfig = {
  enabled: false,
  activeProvider: 'meta',
  allowedSenderRoles: ['admin', 'owner'],
};
const EMAIL_DEFAULTS: EmailConfig = { enabled: false, provider: '', fromByBrand: {} };

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  const snap = await getDoc(doc(db, 'commsConfig', 'whatsapp'));
  return snap.exists() ? { ...WHATSAPP_DEFAULTS, ...(snap.data() as Partial<WhatsAppConfig>) } : { ...WHATSAPP_DEFAULTS };
}

export async function saveWhatsAppConfig(patch: Partial<WhatsAppConfig>): Promise<void> {
  await setDoc(doc(db, 'commsConfig', 'whatsapp'), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getEmailConfig(): Promise<EmailConfig> {
  const snap = await getDoc(doc(db, 'commsConfig', 'email'));
  return snap.exists() ? { ...EMAIL_DEFAULTS, ...(snap.data() as Partial<EmailConfig>) } : { ...EMAIL_DEFAULTS };
}

export async function saveEmailConfig(patch: Partial<EmailConfig>): Promise<void> {
  await setDoc(doc(db, 'commsConfig', 'email'), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}
