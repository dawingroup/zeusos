/**
 * Press mention types.
 *
 * External publications that have covered Zeus Group. Surfaced on
 * the home Press section. Mirror of docs/integrations/metaobjects/press_mention.json.
 */

import { Timestamp } from 'firebase/firestore';

export type PressMentionSyncStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'unpublished';

export interface PressMention {
  id: string;
  subsidiaryId: string;

  publication: string;            // "Daily Monitor"
  publicationLogoUrl: string;     // SVG mono preferred — Firebase Storage URL
  title: string;                  // article title
  url?: string;                   // outbound link
  datePublished: Timestamp;
  pullQuote?: string;
  featured: boolean;
  shouldPublishToShopify: boolean;

  shopifyMetaobjectGid?: string;
  shopifySyncStatus?: PressMentionSyncStatus;
  shopifySyncError?: string;
  shopifyLastPublishedAt?: Timestamp;
  shopifyLogoImageGid?: string;

  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export type PressMentionFormData = Omit<
  PressMention,
  | 'id'
  | 'createdAt'
  | 'createdBy'
  | 'updatedAt'
  | 'updatedBy'
  | 'shopifyMetaobjectGid'
  | 'shopifySyncStatus'
  | 'shopifySyncError'
  | 'shopifyLastPublishedAt'
  | 'shopifyLogoImageGid'
>;
