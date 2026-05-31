/**
 * Native internal staff chat — types.
 *
 * Distinct from the Google Chat (`gchat`) mirror: this is staff-to-staff
 * messaging that writes straight to Firestore (no Google API). Members are
 * keyed on Firebase Auth uid, not email.
 *
 * Collections:
 *   chatChannels/{channelId}
 *   chatChannels/{channelId}/messages/{messageId}
 */

import type { Timestamp } from 'firebase/firestore';

export type ChatChannelType = 'channel' | 'dm';

export interface ChatMember {
  uid: string;
  name: string;
  photoUrl?: string | null;
}

export interface ChatChannel {
  id: string;
  type: ChatChannelType;
  /** Channel display name. For DMs this stays empty — the UI derives the
   *  label from the other member. */
  name: string;
  description?: string;
  /** Auth uids — the source of truth for membership + security rules. */
  memberIds: string[];
  /** Denormalized member profiles so the list can render names/avatars
   *  without N lookups. Kept in sync on membership change. */
  members: ChatMember[];
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  // Denormalized last-message preview for the list.
  lastMessageText: string;
  lastMessageAt: Timestamp | null;
  lastMessageSenderId: string;
  lastMessageSenderName: string;
  /** Per-member read cursor. unread = lastMessageAt > lastReadBy[uid]. */
  lastReadBy: Record<string, Timestamp>;
  isArchived: boolean;
}

/** A record attached to a chat message — points at any module's entity. */
export interface ChatLinkedRecord {
  /** SEARCH_CONFIGS type, e.g. 'crm_deal' | 'sales_order' | 'manufacturing_order'. */
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  /** Ready-to-use route, e.g. /crm/deals/abc123. */
  path: string;
  /** Lucide-ish icon name from the search config. */
  icon?: string;
}

/** A Google Drive file shared into a chat message. Stores just enough to
 *  render a card and open the file — never the file contents. */
export interface ChatDriveFile {
  id: string;
  name: string;
  mimeType: string;
  /** Drive web URL to open the file in a new tab. */
  webViewLink: string;
  /** Drive's small type icon (16px) and optional thumbnail. */
  iconLink?: string | null;
  thumbnailLink?: string | null;
  /** Owner-friendly size string if Drive returned one. */
  sizeLabel?: string | null;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderPhotoUrl?: string | null;
  text: string;
  createdAt: Timestamp | null;
  editedAt?: Timestamp | null;
  /** Cross-module record attached to this message (deal / SO / MO / …). */
  linkedRecord?: ChatLinkedRecord | null;
  /** Google Drive file shared into this message. */
  driveFile?: ChatDriveFile | null;
  /** Phase 2 placeholders — declared now so readers are forward-compatible. */
  reactions?: Record<string, string[]>; // emoji -> uids
  mentions?: string[]; // uids
}

/** Friendly label for common Drive mime types. */
export function driveTypeLabel(mimeType: string): string {
  if (mimeType === 'application/vnd.google-apps.document') return 'Google Doc';
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'Google Sheet';
  if (mimeType === 'application/vnd.google-apps.presentation') return 'Google Slides';
  if (mimeType === 'application/vnd.google-apps.folder') return 'Folder';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType.startsWith('video/')) return 'Video';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'Spreadsheet';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'Document';
  return 'File';
}

// ── Presence ────────────────────────────────────────────────────────────────

export type PresenceState = 'online' | 'away' | 'offline';

export interface PresenceDoc {
  uid: string;
  name?: string;
  state: 'online' | 'away';
  lastActiveAt: Timestamp | null;
}

/** Heartbeat is written every 45s; treat as online within 90s, away within 5m. */
export const PRESENCE_ONLINE_MS = 90_000;
export const PRESENCE_AWAY_MS = 5 * 60_000;

export function presenceStateFrom(doc: PresenceDoc | undefined | null): PresenceState {
  if (!doc) return 'offline';
  const last = doc.lastActiveAt?.toMillis?.() ?? 0;
  const age = Date.now() - last;
  if (age > PRESENCE_AWAY_MS) return 'offline';
  if (doc.state === 'away' || age > PRESENCE_ONLINE_MS) return 'away';
  return 'online';
}

export function presenceColor(state: PresenceState): string {
  return state === 'online' ? '#4e8a4a' : state === 'away' ? '#e18425' : '#9c9aa1';
}

/** Per-message read state for the viewer's own outbound messages. */
export interface MessageReadState {
  /** uids (excluding sender) whose read cursor is >= this message. */
  readByUids: string[];
  /** Total other members in the channel. */
  totalOthers: number;
}

export function computeReadState(
  channel: ChatChannel,
  message: ChatMessage,
  viewerUid: string,
): MessageReadState | null {
  // Only meaningful for the viewer's own messages.
  if (message.senderId !== viewerUid) return null;
  const msgAt = message.createdAt?.toMillis?.() ?? 0;
  if (!msgAt) return null;
  const others = channel.memberIds.filter((u) => u !== viewerUid);
  const readByUids = others.filter((u) => {
    const read = channel.lastReadBy?.[u]?.toMillis?.() ?? 0;
    return read >= msgAt;
  });
  return { readByUids, totalOthers: others.length };
}

/** Deterministic DM channel id so two staff never get duplicate DM rooms. */
export function dmChannelId(uidA: string, uidB: string): string {
  return `dm_${[uidA, uidB].sort().join('_')}`;
}

/** Display label for a channel given the viewer's uid (DMs show the peer). */
export function channelLabel(channel: ChatChannel, viewerUid: string): string {
  if (channel.type === 'channel') return channel.name || 'Untitled channel';
  const peer = channel.members.find((m) => m.uid !== viewerUid);
  return peer?.name || 'Direct message';
}

/** Whether the channel is unread for the given viewer. */
export function isChannelUnread(channel: ChatChannel, viewerUid: string): boolean {
  const lastMsg = channel.lastMessageAt?.toMillis?.() ?? 0;
  if (!lastMsg) return false;
  // Your own last message never counts as unread.
  if (channel.lastMessageSenderId === viewerUid) return false;
  const lastRead = channel.lastReadBy?.[viewerUid]?.toMillis?.() ?? 0;
  return lastMsg > lastRead;
}
