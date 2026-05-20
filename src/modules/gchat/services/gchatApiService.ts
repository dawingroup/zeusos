/**
 * Google Chat API Service
 * Calls Cloud Functions for Google Chat operations
 */

import { auth } from '@/shared/services/firebase/auth';
import type {
  CreateSpacePayload,
  CreateIncidentPayload,
  SendGChatMessagePayload,
} from '../types';

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
 * Send a message to a Google Chat space
 */
export async function sendGChatMessage(
  payload: SendGChatMessagePayload
): Promise<{ success: boolean; messageName?: string; error?: string }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/sendGChatMessage`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    return { success: false, error: data.error || 'Failed to send message' };
  }

  return data;
}

/**
 * Create a new Google Chat space
 */
export async function createSpace(
  payload: CreateSpacePayload
): Promise<{ success: boolean; spaceName?: string; spaceId?: string; error?: string }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/createGChatSpace`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    return { success: false, error: data.error || 'Failed to create space' };
  }

  return data;
}

/**
 * Create an incident space with AI agent capabilities
 */
export async function createIncidentSpace(
  payload: CreateIncidentPayload
): Promise<{
  success: boolean;
  spaceName?: string;
  spaceId?: string;
  membersAdded?: string[];
  error?: string;
}> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/createIncidentSpace`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    return { success: false, error: data.error || 'Failed to create incident space' };
  }

  return data;
}

/**
 * Manage members in a Google Chat space
 */
export async function manageMembers(
  spaceId: string,
  action: 'add' | 'remove',
  email: string
): Promise<{ success: boolean; error?: string }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/manageGChatMembers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ spaceId, action, email }),
  });

  const data = await response.json();

  if (!response.ok) {
    return { success: false, error: data.error || 'Failed to manage members' };
  }

  return data;
}

/**
 * Resolve an incident space
 */
export async function resolveIncident(
  spaceId: string,
  resolution: string
): Promise<{ success: boolean; error?: string }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/resolveIncidentSpace`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ spaceId, resolution }),
  });

  const data = await response.json();

  if (!response.ok) {
    return { success: false, error: data.error || 'Failed to resolve incident' };
  }

  return data;
}
