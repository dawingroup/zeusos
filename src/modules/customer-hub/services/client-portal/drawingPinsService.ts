/**
 * Drawing pin comments — staff + client annotations placed on a
 * design-signoff drawing. Stored as `drawingPins/{pinId}` with
 * `comments` as an array field updated via `arrayUnion` for race-safe
 * reply threading (status changes are whole-doc updates, single-writer
 * in practice).
 */

import {
  Timestamp,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/firebase/config';

export const DRAWING_PINS_COLLECTION = 'drawingPins';

export interface PinComment {
  id: string;
  body: string;
  at: Timestamp;
  by: string;        // uid
  byName: string;    // display name / email / phone
  isClient: boolean; // false = staff
}

export interface DrawingPin {
  id: string;
  signOffId: string;
  /** 0-100, percentage relative to viewer width/height. */
  x: number;
  y: number;
  /** 1-based pin number for the visible badge. */
  n: number;
  status: 'open' | 'resolved';
  comments: PinComment[];
  createdAt: Timestamp;
  createdBy: string;       // uid
  createdByName: string;
  createdByIsClient: boolean;
  resolvedAt?: Timestamp;
  resolvedBy?: string;
  resolvedByName?: string;
}

// ── Reads ───────────────────────────────────────────────────

export async function getPinsForSignOff(signOffId: string): Promise<DrawingPin[]> {
  try {
    const snap = await getDocs(query(
      collection(db, DRAWING_PINS_COLLECTION),
      where('signOffId', '==', signOffId),
      orderBy('n', 'asc'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DrawingPin);
  } catch {
    // permission-denied / index-not-built — return empty so the page
    // still renders. The viewer's "Add pin" affordance will still work.
    return [];
  }
}

// ── Writes ──────────────────────────────────────────────────

interface AddPinArgs {
  signOffId: string;
  x: number;
  y: number;
  /** First comment posted with the pin (required — pins are never empty). */
  firstComment: string;
  /** Highest existing pin number; new pin = max + 1. */
  highestN: number;
  user: User;
  isClient: boolean;
}

export async function addPin({
  signOffId, x, y, firstComment, highestN, user, isClient,
}: AddPinArgs): Promise<DrawingPin> {
  const ref = doc(collection(db, DRAWING_PINS_COLLECTION));
  const byName = userLabel(user);
  const now = Timestamp.now();

  const comment: PinComment = {
    id: makeId(),
    body: firstComment.trim(),
    at: now,
    by: user.uid,
    byName,
    isClient,
  };

  const data: Omit<DrawingPin, 'id'> = {
    signOffId,
    x: clampPct(x),
    y: clampPct(y),
    n: highestN + 1,
    status: 'open',
    comments: [comment],
    createdAt: now,
    createdBy: user.uid,
    createdByName: byName,
    createdByIsClient: isClient,
  };

  await setDoc(ref, data);

  return { id: ref.id, ...data };
}

interface AddCommentArgs {
  pinId: string;
  body: string;
  user: User;
  isClient: boolean;
}

export async function addComment({
  pinId, body, user, isClient,
}: AddCommentArgs): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Comment is empty.');
  const comment: PinComment = {
    id: makeId(),
    body: trimmed,
    at: Timestamp.now(),
    by: user.uid,
    byName: userLabel(user),
    isClient,
  };
  await updateDoc(doc(db, DRAWING_PINS_COLLECTION, pinId), {
    comments: arrayUnion(comment),
    updatedAt: serverTimestamp(),
  });
}

export async function resolvePin(pinId: string, user: User): Promise<void> {
  await updateDoc(doc(db, DRAWING_PINS_COLLECTION, pinId), {
    status: 'resolved',
    resolvedAt: Timestamp.now(),
    resolvedBy: user.uid,
    resolvedByName: userLabel(user),
    updatedAt: serverTimestamp(),
  });
}

export async function reopenPin(pinId: string, user: User): Promise<void> {
  await updateDoc(doc(db, DRAWING_PINS_COLLECTION, pinId), {
    status: 'open',
    resolvedAt: null,
    resolvedBy: null,
    resolvedByName: null,
    reopenedBy: user.uid,
    reopenedByName: userLabel(user),
    updatedAt: serverTimestamp(),
  });
}

export async function deletePin(pinId: string): Promise<void> {
  await deleteDoc(doc(db, DRAWING_PINS_COLLECTION, pinId));
}

// ── helpers ─────────────────────────────────────────────────

function userLabel(user: User): string {
  return user.displayName
    || user.email
    || user.phoneNumber
    || user.uid.slice(0, 8);
}

function clampPct(n: number): number {
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n * 100) / 100;
}

function makeId(): string {
  // Inline a tiny id generator — comments are array entries so they
  // don't get auto-doc-ids. Cryptographic strength isn't required;
  // collision space is the pin's own array.
  return 'c-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
