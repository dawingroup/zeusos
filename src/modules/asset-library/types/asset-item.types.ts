/**
 * AssetItem — header record for a single creative or brand asset.
 *
 * Collection: asset_library_items/{itemId}
 *
 * The header tracks the *current* version pointer (`currentVersionId`).
 * Full version history lives in the `versions` subcollection. Where the
 * asset has been placed (campaigns, master jobs, production jobs,
 * media buys) lives in the `usages` subcollection.
 *
 * Storage upload is stubbed for Phase 4 — `storageRef` is recorded as a
 * plain string. Phase 5 wires the actual Cloud Storage path.
 */

import type { Timestamp } from 'firebase/firestore';

export type AssetCategory =
  | 'LOGO'
  | 'GUIDELINE'
  | 'PHOTO'
  | 'VIDEO'
  | 'FONT'
  | 'COLOR_PALETTE'
  | 'TEMPLATE'
  | 'OTHER';

export type AssetStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type AssetFileType =
  | 'IMAGE'   // png, jpg, svg, webp
  | 'VIDEO'   // mp4, mov
  | 'PDF'     // brand guidelines, decks
  | 'FONT'    // otf, ttf, woff
  | 'ARCHIVE' // zip, rar — bundled logo packs
  | 'OFFICE'  // pptx, docx, xlsx
  | 'OTHER';

export interface AssetItem {
  id: string;
  /** Display name, e.g. "Coca-Cola Master Logo — Knockout". */
  name: string;
  category: AssetCategory;
  /** Optional client this asset belongs to. Brand assets always have one. */
  clientId?: string;
  /** Which Zeus sub-brand owns/manages this asset. */
  subsidiaryOrgId: string;
  /** Free-form tags for search — e.g. ['logo', 'master', 'monochrome']. */
  tags: string[];
  /** Pointer into the `versions` subcollection. */
  currentVersionId: string;
  /** Cloud Storage path of the current version (mirrored for quick reads). */
  storageRef: string;
  /** Optional thumbnail Storage path for grid previews. */
  thumbnailRef?: string;
  fileType: AssetFileType;
  /** Size in bytes of the current version. */
  fileSizeBytes: number;
  /** Pixel or page dimensions, e.g. "1920x1080" or "A4". */
  dimensions?: string;
  status: AssetStatus;
  uploadedBy: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
