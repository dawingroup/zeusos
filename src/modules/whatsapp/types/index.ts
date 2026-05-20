/**
 * WhatsApp Communication Module - Types
 * Mirrors Firestore collection schemas for Meta Cloud API
 */

import { Timestamp } from 'firebase/firestore';

// ============================================
// Provider Types
// ============================================

/** @deprecated 'zoko' retained for reading legacy Firestore data */
export type WhatsAppProvider = 'meta' | 'zoko';

// ============================================
// Conversation Types
// ============================================

export interface WhatsAppConversation {
  id: string;
  customerId: string | null;
  customerName: string;
  phoneNumber: string; // Normalized format e.g. '256XXXXXXXXX'

  // Provider info
  provider?: WhatsAppProvider;
  waProfileName?: string; // WhatsApp profile name from Meta webhook
  /** @deprecated Legacy Zoko field — read-only for existing data */
  zokoContactId?: string;

  // 24-hour window tracking
  lastInboundAt: Timestamp | null;
  windowExpiresAt: Timestamp | null;
  isWindowOpen: boolean;

  // Conversation state
  status: ConversationStatus;
  unreadCount: number;
  lastMessageText: string;
  lastMessageAt: Timestamp;
  lastMessageDirection: MessageDirection;

  // Assignment
  assignedTo?: string;
  assignedToName?: string;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ConversationStatus = 'active' | 'archived' | 'blocked';
export type MessageDirection = 'inbound' | 'outbound';

// ============================================
// Message Types
// ============================================

export interface WhatsAppMessage {
  id: string;
  conversationId: string;

  direction: MessageDirection;
  messageType: WhatsAppMessageType;
  textContent?: string;

  // Template info
  templateId?: string;
  templateName?: string;
  templateParams?: Record<string, string>;
  templateButtons?: string[]; // Button labels e.g. ['Approve', 'Reject']
  templateFooter?: string;
  templateHeaderText?: string;

  // Media
  imageUrl?: string;
  imageCaption?: string;

  // Document
  documentUrl?: string;
  documentCaption?: string;
  documentFilename?: string;

  // Location (Meta Cloud API)
  locationLatitude?: number;
  locationLongitude?: number;
  locationName?: string;
  locationAddress?: string;

  // Interactive (Meta Cloud API)
  interactiveType?: string;
  interactiveBody?: Record<string, unknown>;

  // Delivery status
  status: MessageDeliveryStatus;
  waMessageId?: string; // Meta Cloud API message ID (wamid.xxx)
  /** @deprecated Legacy Zoko field — read-only for existing data */
  zokoMessageId?: string;
  provider?: WhatsAppProvider;
  errorMessage?: string;

  // Sender info
  senderType: SenderType;
  senderId?: string;
  senderName?: string;

  // Timestamps
  sentAt: Timestamp;
  deliveredAt?: Timestamp;
  readAt?: Timestamp;
  createdAt: Timestamp;
}

export type WhatsAppMessageType = 'text' | 'template' | 'image' | 'document' | 'greeting' | 'interactive' | 'location';
export type MessageDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type SenderType = 'system' | 'employee' | 'customer';

// ============================================
// Template Types
// ============================================

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  bodyText: string; // With {{1}}, {{2}} placeholders
  headerType?: 'text' | 'image' | 'document' | null;
  headerText?: string | null;
  footerText?: string | null;
  parameterCount: number;
  status: TemplateStatus;
  lastSyncedAt: Timestamp;
  createdAt?: Timestamp;

  // Meta Cloud API fields
  metaTemplateId?: string;
  metaTemplateName?: string;
  components?: Record<string, unknown>[];
  buttons?: TemplateButton[];
  provider?: 'meta' | 'manual';

  /** @deprecated Legacy Zoko field — read-only for existing data */
  zokoTemplateId?: string;
}

export interface TemplateButton {
  type: string;
  text: string;
  url?: string | null;
  phoneNumber?: string | null;
}

export type TemplateStatus = 'approved' | 'pending' | 'rejected' | 'removed';

// ============================================
// Config Types
// ============================================

export type MigrationStatus = 'complete';

export interface WhatsAppConfig {
  enabled: boolean;
  activeProvider: WhatsAppProvider;
  webhookRegistered: boolean;
  webhookUrl?: string;
  defaultCountryCode: string;
  rateLimitPerMinute: number;
  allowedSenderRoles: string[];
  lastTemplateSyncAt?: Timestamp;

  // Meta Cloud API config
  metaAccessTokenConfigured?: boolean;
  metaPhoneNumberId?: string;
  metaBusinessAccountId?: string;
  metaWebhookVerified?: boolean;
  migrationStatus?: MigrationStatus;

  /** @deprecated Zoko migration complete */
  zokoApiKeyConfigured?: boolean;

  // Template header images (stored in Firebase Storage)
  templateHeaderImages?: {
    quoteSubmission?: string;
    changeOrderSubmission?: string;
    orderUpdate?: string;
    orderConfirmation?: string;
    depositRequest?: string;
    paymentReceipt?: string;
    welcome?: string;
    default?: string;
  };
}

// ============================================
// UI / Form Types
// ============================================

export interface SendMessagePayload {
  conversationId?: string;
  customerId?: string;
  customerName?: string;
  phoneNumber: string;
  messageType: WhatsAppMessageType;
  text?: string;
  templateId?: string;
  templateName?: string;
  templateParams?: Record<string, string>;
  imageUrl?: string;
  imageCaption?: string;
  // Document message
  documentUrl?: string;
  documentCaption?: string;
  documentFilename?: string;
  // Header config for template media headers (image, document, video)
  headerConfig?: {
    format: 'image' | 'document' | 'video' | 'text';
    url?: string;
    filename?: string;
    text?: string;
  };
  // Meta Cloud API additions
  interactive?: Record<string, unknown>;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAddress?: string;
}

export interface SendMessageResult {
  success: boolean;
  conversationId: string;
  messageId: string;
  waMessageId?: string; // Meta Cloud API
  /** @deprecated Legacy Zoko field */
  zokoMessageId?: string;
  error?: string;
  windowClosed?: boolean;
  metaErrorCode?: number;
}

export interface TemplateFormData {
  templateId: string;
  templateName: string;
  params: Record<string, string>;
}

export interface ConversationFilter {
  status?: ConversationStatus;
  assignedTo?: string;
  customerId?: string;
  search?: string;
}

export interface WindowState {
  isOpen: boolean;
  expiresAt: Date | null;
  timeRemainingMs: number;
  isExpiringSoon: boolean; // Less than 2 hours
}

// ============================================
// Broadcast Types
// ============================================

export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';

export interface WhatsAppBroadcast {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  templateLanguage: string;
  parameters: Record<string, string>;
  audience: BroadcastAudience;
  status: BroadcastStatus;
  scheduledAt?: Timestamp | null;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  createdBy: string;
  createdByName?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp | null;
}

export interface BroadcastAudience {
  type: 'manual' | 'filter';
  phones?: string[];
  filter?: Record<string, unknown>;
  totalCount?: number;
}

export interface BroadcastRecipient {
  phone: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  waMessageId?: string;
  sentAt?: Timestamp;
  error?: string;
}

// ============================================
// Automation Types
// ============================================

export interface WhatsAppAutomation {
  aiAgentEnabled: boolean;
  aiSystemPrompt: string;
  welcomeMessageEnabled: boolean;
  welcomeTemplateId?: string;
  awayMessageEnabled: boolean;
  awayTemplateId?: string;
  businessHours: BusinessHours;
  keywordTriggers: KeywordTrigger[];
}

export interface BusinessHours {
  start: string; // e.g. '09:00'
  end: string; // e.g. '17:00'
  timezone: string; // e.g. 'Africa/Kampala'
  days: number[]; // 0=Sun, 1=Mon, ... 6=Sat
}

export interface KeywordTrigger {
  id?: string;
  keyword: string;
  templateId: string;
  templateName?: string;
  exact: boolean; // exact match vs contains
}

// ============================================
// Commerce Types
// ============================================

export interface WhatsAppProduct {
  id: string;
  shopifyProductId: string;
  title: string;
  description: string;
  imageUrl?: string;
  price: number;
  currency: string;
  variants: WhatsAppProductVariant[];
  available: boolean;
}

export interface WhatsAppProductVariant {
  id: string;
  title: string;
  price: number;
  sku?: string;
  available: boolean;
}

// ============================================
// CRM Integration Types
// ============================================

export interface ConversationDealLink {
  conversationId: string;
  dealId: string;
  dealTitle?: string;
  linkedAt: Timestamp;
  linkedBy: string;
}
