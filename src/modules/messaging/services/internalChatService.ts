/**
 * Native internal staff chat — Firestore service (client-direct writes).
 *
 * No Cloud Functions in the send path: messages write straight to
 * Firestore and stream back via onSnapshot. Security rules
 * (firestore.rules → chatChannels) enforce that only members can read or
 * write a channel.
 *
 * Collections:
 *   chatChannels/{channelId}
 *   chatChannels/{channelId}/messages/{messageId}
 */

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  limit as fbLimit,
  serverTimestamp,
  setDoc,
  addDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type {
  ChatChannel,
  ChatMember,
  ChatMessage,
  ChatLinkedRecord,
  ChatDriveFile,
} from '../types/internalChat';
import { dmChannelId } from '../types/internalChat';

const channelsRef = collection(db, 'chatChannels');

// ── Subscriptions ──────────────────────────────────────────────────────────

/**
 * Subscribe to all non-archived channels the user is a member of, sorted
 * by most-recent activity. Avoids a composite index by sorting client-side.
 */
export function subscribeToChannels(
  uid: string,
  callback: (channels: ChatChannel[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const q = query(channelsRef, where('memberIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => {
      const channels = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as ChatChannel)
        .filter((c) => !c.isArchived)
        .sort((a, b) => {
          const at = a.lastMessageAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
          const bt = b.lastMessageAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
          return bt - at;
        });
      callback(channels);
    },
    (err) => {
      console.error('[internalChat] channels subscription error', err);
      onError?.(err);
    },
  );
}

export function subscribeToChannel(
  channelId: string,
  callback: (channel: ChatChannel | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, 'chatChannels', channelId),
    (snap) => callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as ChatChannel) : null),
    (err) => {
      console.error('[internalChat] channel subscription error', err);
      onError?.(err);
    },
  );
}

export function subscribeToChannelMessages(
  channelId: string,
  callback: (messages: ChatMessage[]) => void,
  onError?: (e: Error) => void,
  messageLimit = 100,
): () => void {
  // Fetch the most recent N messages (descending), then reverse to ascending
  // for display. Using asc + limit would return the OLDEST N and hide recent
  // activity once a channel grows past the limit; desc + limit keeps the tail
  // and is lighter to first-paint.
  const q = query(
    collection(db, 'chatChannels', channelId, 'messages'),
    orderBy('createdAt', 'desc'),
    fbLimit(messageLimit),
  );
  return onSnapshot(
    q,
    (snap) => {
      const msgs = snap.docs.map(
        (d) => ({ id: d.id, channelId, ...d.data() }) as ChatMessage,
      );
      msgs.reverse(); // oldest → newest for the conversation view
      callback(msgs);
    },
    (err) => {
      console.error('[internalChat] messages subscription error', err);
      onError?.(err);
    },
  );
}

/** Total unread channel count for the badge (channels with newer activity
 *  than the viewer's read cursor, not sent by them). */
export function subscribeToUnreadChannelCount(
  uid: string,
  callback: (count: number) => void,
  onError?: (e: Error) => void,
): () => void {
  const q = query(channelsRef, where('memberIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => {
      let count = 0;
      for (const d of snap.docs) {
        const c = d.data() as ChatChannel;
        if (c.isArchived) continue;
        const lastMsg = c.lastMessageAt?.toMillis?.() ?? 0;
        if (!lastMsg || c.lastMessageSenderId === uid) continue;
        const lastRead = c.lastReadBy?.[uid]?.toMillis?.() ?? 0;
        if (lastMsg > lastRead) count += 1;
      }
      callback(count);
    },
    (err) => {
      console.error('[internalChat] unread subscription error', err);
      onError?.(err);
    },
  );
}

// ── Mutations ──────────────────────────────────────────────────────────────

export async function createChannel(input: {
  name: string;
  description?: string;
  members: ChatMember[];
  createdBy: string;
}): Promise<string> {
  const memberIds = input.members.map((m) => m.uid);
  const ref = await addDoc(channelsRef, {
    type: 'channel',
    name: input.name.trim(),
    description: input.description?.trim() || '',
    memberIds,
    members: input.members,
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessageText: '',
    lastMessageAt: null,
    lastMessageSenderId: '',
    lastMessageSenderName: '',
    lastReadBy: {},
    isArchived: false,
  });
  return ref.id;
}

/**
 * Get the existing 1:1 DM channel between two staff, or create it. Uses a
 * deterministic id so re-opening a DM never spawns a duplicate.
 */
export async function getOrCreateDM(
  me: ChatMember,
  peer: ChatMember,
): Promise<string> {
  const id = dmChannelId(me.uid, peer.uid);
  const ref = doc(db, 'chatChannels', id);
  const existing = await getDoc(ref);
  if (existing.exists()) return id;

  await setDoc(ref, {
    type: 'dm',
    name: '',
    description: '',
    memberIds: [me.uid, peer.uid],
    members: [me, peer],
    createdBy: me.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessageText: '',
    lastMessageAt: null,
    lastMessageSenderId: '',
    lastMessageSenderName: '',
    lastReadBy: {},
    isArchived: false,
  });
  return id;
}

/**
 * Send a message. Writes the message doc + denormalizes the preview onto
 * the channel in one batch so the list reorders immediately and the
 * sender's own read cursor advances (so it never shows unread to them).
 */
export async function sendChatMessage(
  channelId: string,
  sender: ChatMember,
  text: string,
  linkedRecord?: ChatLinkedRecord | null,
  driveFile?: ChatDriveFile | null,
): Promise<void> {
  const trimmed = text.trim();
  // Allow sending a bare attachment (record or Drive file) with no text.
  if (!trimmed && !linkedRecord && !driveFile) return;

  const batch = writeBatch(db);
  const msgRef = doc(collection(db, 'chatChannels', channelId, 'messages'));
  batch.set(msgRef, {
    senderId: sender.uid,
    senderName: sender.name,
    senderPhotoUrl: sender.photoUrl ?? null,
    text: trimmed,
    linkedRecord: linkedRecord ?? null,
    driveFile: driveFile ?? null,
    createdAt: serverTimestamp(),
  });

  const preview = trimmed
    ? trimmed.slice(0, 200)
    : driveFile
    ? `📄 ${driveFile.name}`
    : `📎 ${linkedRecord?.title ?? 'Shared a record'}`;
  const channelRef = doc(db, 'chatChannels', channelId);
  batch.update(channelRef, {
    lastMessageText: preview,
    lastMessageAt: serverTimestamp(),
    lastMessageSenderId: sender.uid,
    lastMessageSenderName: sender.name,
    updatedAt: serverTimestamp(),
    [`lastReadBy.${sender.uid}`]: serverTimestamp(),
  });

  await batch.commit();
}

/** Advance the viewer's read cursor to now. */
export async function markChannelRead(channelId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'chatChannels', channelId), {
    [`lastReadBy.${uid}`]: serverTimestamp(),
  });
}

export async function archiveChannel(channelId: string): Promise<void> {
  await updateDoc(doc(db, 'chatChannels', channelId), {
    isArchived: true,
    updatedAt: serverTimestamp(),
  });
}
