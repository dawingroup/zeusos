/**
 * ShareLink — a tokenised, time-bound read-only handle to one asset
 * item or one collection.
 *
 * Collection: share_links/{token}
 *
 * The doc id IS the public token: 32 cryptographically-random bytes
 * URL-encoded (~43 chars). It's never reused. The doc itself is
 * server-side-only (Firestore rules forbid client reads); the
 * `resolveShareLink` Cloud Function looks it up with admin SDK and
 * issues a fresh signed Storage URL.
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * Exactly one of `assetItemId` / `collectionId` is set per link. The
 * tagged union mirrors the resolver's API shape so the public viewer
 * page doesn't have to guess.
 */
export type ShareLinkTarget =
  | { kind: 'asset'; assetItemId: string }
  | { kind: 'collection'; collectionId: string };

export interface ShareLink {
  /** URL-safe random token; also the Firestore doc id. */
  token: string;
  assetItemId?: string;
  collectionId?: string;
  createdBy: string;
  createdAt: Timestamp | string;
  /** Hard expiry — resolver returns 410 once `now > expiresAt`. */
  expiresAt: Timestamp | string;
  /** Manual kill-switch — set true to invalidate without waiting for expiry. */
  revoked: boolean;
  /**
   * If false, the signed URL the resolver returns uses
   * `responseDisposition=inline` so browsers preview rather than
   * trigger a download dialog. Doesn't actually stop a determined
   * recipient from saving the file — it's a UX hint.
   */
  allowDownload: boolean;
  /** Free-form note shown to staff in the share-link history view. */
  label?: string;
}

/**
 * Options accepted by `createShareLink`. Both numerics have sane
 * defaults so the dialog can call with `{}`.
 */
export interface CreateShareLinkOptions {
  /** Default: 14 days. Capped server-side at 90 days. */
  expiresInDays?: number;
  /** Default: true (allow download). */
  allowDownload?: boolean;
  label?: string;
}
