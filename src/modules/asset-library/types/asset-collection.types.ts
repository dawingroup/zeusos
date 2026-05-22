/**
 * AssetCollection — a curated grouping of AssetItems.
 *
 * Collection: asset_library_collections/{collectionId}
 *
 * Examples: "Coca-Cola brand pack 2026", "Zeus Digital social templates",
 * "Studio shoot — September lookbook". Items can belong to multiple
 * collections; the collection just stores a flat array of item IDs.
 */

import type { Timestamp } from 'firebase/firestore';

export interface AssetCollection {
  id: string;
  name: string;
  description?: string;
  /** Flat list of AssetItem IDs in this collection. Order is preserved. */
  itemIds: string[];
  /** Optional client scope, if the collection is brand-specific. */
  clientId?: string;
  /** Which Zeus sub-brand owns this collection. */
  subsidiaryOrgId: string;
  createdBy: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
