/**
 * Google Chat Module - Types
 * Mirrors Firestore gchatSpaces collection schema
 */

import { Timestamp } from 'firebase/firestore';

// ============================================
// Space Types
// ============================================

export type GChatSpaceType = 'SPACE' | 'DIRECT_MESSAGE';
export type GChatSpaceCategory = 'incident' | 'project' | 'general';
export type GChatSpaceStatus = 'active' | 'archived';

export interface GChatSpace {
  id: string;
  spaceName: string; // "spaces/AAAA..."
  displayName: string;
  spaceType: GChatSpaceType;
  description?: string;

  // ZeusOS context
  incidentId?: string | null;
  projectId?: string | null;
  type: GChatSpaceCategory;
  severity?: string;

  // Members
  members: string[]; // Email addresses
  memberCount: number;

  // State
  status: GChatSpaceStatus;
  lastMessageAt: Timestamp;
  lastMessageText: string;
  unreadCount: number;

  // Resolution (for incidents)
  resolution?: string;
  resolvedBy?: string;
  resolvedByName?: string;
  resolvedAt?: Timestamp;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
}

// ============================================
// Message Types
// ============================================

export type GChatMessageType = 'text' | 'card' | 'image';
export type GChatSenderType = 'human' | 'bot' | 'system';

export interface GChatMessage {
  id: string;
  gchatMessageName: string; // "spaces/AAAA/messages/BBBB"
  direction: 'inbound' | 'outbound';
  senderType: GChatSenderType;
  senderEmail: string;
  senderName: string;

  messageType: GChatMessageType;
  textContent: string;
  cardPayload?: Record<string, unknown> | null;

  // Thread support
  threadName?: string | null;

  createdAt: Timestamp;
}

// ============================================
// Config Types
// ============================================

export interface GChatConfig {
  enabled: boolean;
  botRegistered: boolean;
  webhookUrl?: string;
  serviceAccountConfigured: boolean;
  allowedDomains: string[];
}

// ============================================
// UI / Form Types
// ============================================

export interface SpaceFilter {
  type?: GChatSpaceCategory;
  status?: GChatSpaceStatus;
  search?: string;
}

export interface CreateSpacePayload {
  displayName: string;
  description?: string;
  members: string[];
  type?: GChatSpaceCategory;
  projectId?: string;
}

export interface CreateIncidentPayload {
  title: string;
  description?: string;
  severity?: string;
  assignees: string[];
  sourceModule?: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
}

export interface SendGChatMessagePayload {
  spaceId: string;
  text?: string;
  cardsV2?: Record<string, unknown>[];
  threadKey?: string;
}
