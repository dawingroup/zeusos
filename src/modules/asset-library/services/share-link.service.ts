/**
 * Share Link service — client-side helpers for the DAM-lite
 * "share with client" flow (Phase 5.C).
 *
 * Writes go through Firestore directly (gated by rules to staff
 * principals). Reads do NOT — the `share_links` collection is
 * server-side-only; the public viewer page calls the
 * `resolveShareLink` HTTPS Function which validates expiry + revoke
 * state and issues a fresh signed Storage URL.
 */

import {
  doc,
  setDoc,
  updateDoc,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '@/shared/services/firebase';
import type {
  CreateShareLinkOptions,
  ShareLink,
  ShareLinkTarget,
} from '../types/share-link.types';

const SHARE_LINKS_COLL = 'share_links';
const DEFAULT_TTL_DAYS = 14;
/** Hard cap — the resolver also enforces this. */
const MAX_TTL_DAYS = 90;

/**
 * Generate a 32-byte URL-safe random token. Uses the Web Crypto API
 * (available in modern browsers); base64url-encoded so it fits in a
 * URL path segment without escaping.
 */
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createShareLink(
  target: ShareLinkTarget,
  opts: CreateShareLinkOptions = {},
): Promise<ShareLink> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('You must be signed in to create a share link.');
  }
  const ttlDays = Math.min(
    Math.max(1, opts.expiresInDays ?? DEFAULT_TTL_DAYS),
    MAX_TTL_DAYS,
  );
  const expiresAtMs = Date.now() + ttlDays * 24 * 60 * 60 * 1000;

  const token = generateToken();
  const payload = {
    token,
    assetItemId: target.kind === 'asset' ? target.assetItemId : null,
    collectionId: target.kind === 'collection' ? target.collectionId : null,
    createdBy: uid,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(expiresAtMs),
    revoked: false,
    allowDownload: opts.allowDownload ?? true,
    label: opts.label ?? null,
  };

  await setDoc(doc(db, SHARE_LINKS_COLL, token), payload);

  // Return a synthesised ShareLink (the server timestamp resolves on
  // the next read; callers only need the token + URL to copy to
  // clipboard).
  return {
    token,
    assetItemId: payload.assetItemId ?? undefined,
    collectionId: payload.collectionId ?? undefined,
    createdBy: uid,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
    revoked: false,
    allowDownload: payload.allowDownload,
    label: opts.label,
  };
}

export async function revokeShareLink(token: string): Promise<void> {
  await updateDoc(doc(db, SHARE_LINKS_COLL, token), { revoked: true });
}

/**
 * Build the public viewer URL for a given token. Uses
 * `window.location.origin` so the link works the same in dev (port
 * 3000) and in production (zeusos.web.app / os.zeustheagency.com).
 */
export function buildShareUrl(token: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://os.zeustheagency.com';
  return `${origin}/share/${token}`;
}
