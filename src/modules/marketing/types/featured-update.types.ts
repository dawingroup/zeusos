/**
 * Featured Update types ("Today in the studio" section).
 *
 * Weekly rotating workshop snippet on dawinfinishes.com home. Mirror of
 * docs/integrations/metaobjects/featured_update.json.
 */

import { Timestamp } from 'firebase/firestore';

export type FeaturedUpdateCategory = 'bench' | 'shipment' | 'delivery' | 'press' | 'launch';
export type FeaturedUpdateTone = 'warm' | 'cool' | 'bold' | 'raw';

export type FeaturedUpdateSyncStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'unpublished';

export interface FeaturedUpdate {
  id: string;
  subsidiaryId: string;

  /** kebab-case identifier, e.g. "wk-19-walnut-credenza". */
  handle: string;

  headline: string;                 // "Walnut credenza."
  subhead: string;                  // "Hand-rubbed oil · day 4 of 7"
  eyebrow?: string;                 // "Bench 03"
  imageUrl: string;                 // 1:1 — Firebase Storage URL
  linkUrl?: string;                 // optional link target on the storefront
  linkLabel?: string;               // "See on the bench ↗"

  /** Cross-references manufacturing order id (ZeusOS-side). */
  benchId?: string;
  /** Linked project case study id (ZeusOS-side). */
  projectCaseStudyId?: string;

  liveFrom: Timestamp;
  liveUntil?: Timestamp;            // auto-expires when set
  priority: number;                 // 1–10 sort priority
  category: FeaturedUpdateCategory;
  tone?: FeaturedUpdateTone;

  published: boolean;
  shouldPublishToShopify: boolean;

  shopifyMetaobjectGid?: string;
  shopifySyncStatus?: FeaturedUpdateSyncStatus;
  shopifySyncError?: string;
  shopifyLastPublishedAt?: Timestamp;
  shopifyImageGid?: string;

  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export type FeaturedUpdateFormData = Omit<
  FeaturedUpdate,
  | 'id'
  | 'createdAt'
  | 'createdBy'
  | 'updatedAt'
  | 'updatedBy'
  | 'shopifyMetaobjectGid'
  | 'shopifySyncStatus'
  | 'shopifySyncError'
  | 'shopifyLastPublishedAt'
  | 'shopifyImageGid'
>;
