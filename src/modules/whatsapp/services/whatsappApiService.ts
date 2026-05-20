/**
 * WhatsApp API Service
 * Calls Cloud Functions for WhatsApp messaging operations
 * Backend sends via Meta Cloud API
 */

import { auth } from '@/shared/services/firebase/auth';
import type { SendMessagePayload, SendMessageResult } from '../types';

// Cloud Functions base URL for WhatsApp endpoints
const API_BASE = 'https://us-central1-dawinos.cloudfunctions.net';

/**
 * Get authentication headers with Firebase ID token
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.warn('Failed to get auth token:', error);
    }
  }

  return headers;
}

/**
 * Send a WhatsApp message (text, template, image, interactive, or location)
 * Sends via Meta Cloud API
 */
export async function sendWhatsAppMessage(payload: SendMessagePayload): Promise<SendMessageResult> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/sendWhatsAppMessage`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    // Surface Meta-specific error details when available
    const errorDetail = data.metaDetail ? `${data.error}: ${data.metaDetail}` : data.error || 'Failed to send message';
    return {
      success: false,
      conversationId: payload.conversationId || '',
      messageId: '',
      error: errorDetail,
      windowClosed: data.windowClosed,
      metaErrorCode: data.metaErrorCode,
    };
  }

  return data as SendMessageResult;
}

/**
 * Trigger template sync from Meta Cloud API (admin only)
 */
export async function syncTemplates(): Promise<{ synced: number; removed: number }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/syncWhatsAppTemplatesMeta`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Template sync failed');
  }

  return response.json();
}

/**
 * Execute a broadcast campaign (admin only)
 */
export async function executeBroadcast(broadcastId: string): Promise<{ sentCount: number; failedCount: number }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/executeBroadcast`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ broadcastId }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Broadcast execution failed');
  }

  return response.json();
}

/**
 * Create a WhatsApp template in Meta Business Manager
 * Supports both predefined and custom templates.
 * Uses httpsCallable with extended timeout — DOCUMENT header templates
 * require PDF generation + upload to Meta which can take >70s.
 */
export async function createWhatsAppTemplate(data: {
  predefinedTemplate?: string;
  name?: string;
  category?: string;
  language?: string;
  components?: Record<string, unknown>[];
}): Promise<{ success: boolean; templateId: string; templateName: string; status: string }> {
  const { httpsCallable } = await import('firebase/functions');
  const { functions } = await import('@/shared/services/firebase');

  const callable = httpsCallable(functions, 'createWhatsAppTemplate', { timeout: 150_000 });
  const result = await callable(data);
  return result.data as { success: boolean; templateId: string; templateName: string; status: string };
}

/**
 * Delete a WhatsApp template from Meta Business Manager
 */
export async function deleteWhatsAppTemplate(
  templateName: string
): Promise<{ success: boolean; deleted: string }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/deleteWhatsAppTemplate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data: { templateName } }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error?.message || result.error || 'Failed to delete template');
  }

  return result.result || result;
}

/**
 * List available predefined templates that can be submitted to Meta
 */
export async function listPredefinedTemplates(): Promise<{
  templates: Array<{
    key: string;
    name: string;
    category: string;
    language: string;
    description: string;
    bodyPreview: string;
    hasButtons: boolean;
    parameterCount: number;
  }>;
}> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/listPredefinedTemplates`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data: {} }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error?.message || result.error || 'Failed to list predefined templates');
  }

  return result.result || result;
}

/**
 * Trigger AI processing for a conversation (testing/manual)
 */
export async function triggerAIAgent(
  conversationId: string,
  messageText: string,
  customerName: string,
  phoneNumber: string
): Promise<{ success: boolean }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/processWhatsAppWithAI`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversationId, messageText, customerName, phoneNumber }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'AI processing failed');
  }

  return response.json();
}
