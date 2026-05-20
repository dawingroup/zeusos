/**
 * Project Case Study Types
 *
 * Curated long-form write-ups of completed projects. Authored in DawinOS
 * Marketing → published to Shopify (dawinfinishes.com) via the publish
 * pipeline. The shape mirrors the Shopify `project-detail` section blocks
 * so a case study maps 1:1 to a Shopify page on publish.
 */

import { Timestamp } from 'firebase/firestore';

export type CaseStudyStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'archived';

export type CaseStudyCategory =
  | 'residential'
  | 'hospitality'
  | 'commercial'
  | 'retail'
  | 'institutional'
  | 'other';

export interface CaseStudyHero {
  imagePath?: string;
  imageUrl?: string;
  eyebrow?: string;
  title: string;
  summary?: string;
  client?: string;
  location?: string;
  year?: string;
  scope?: string;
}

export interface CaseStudyNarrative {
  heading?: string;
  body?: string;
  asideHeading?: string;
  asideContent?: string;
}

export interface CaseStudyStat {
  value: string;
  label: string;
}

export interface CaseStudyGallery {
  heading?: string;
  imagePaths: string[];
}

export interface CaseStudyQuote {
  quote: string;
  attribution?: string;
}

export interface CaseStudyMaterial {
  label: string;
  /** Shopify URL — product, collection, or external. Leave blank for plain chip. */
  linkUrl?: string;
}

export interface CaseStudyActionPoint {
  headline: string;
  body?: string;
  linkText?: string;
  linkUrl?: string;
}

export interface CaseStudyCTA {
  eyebrow?: string;
  headline?: string;
  body?: string;
  primaryText?: string;
  primaryUrl?: string;
  secondaryText?: string;
  secondaryUrl?: string;
}

// ============================================
// Shopify metaobject extension
// ============================================
// Mirrors docs/integrations/metaobjects/project.json. Editorial fields that
// don't have a clean source in the rest of the case-study schema live here.
// The publisher writes a Shopify `project` metaobject to dawinfinishes.com
// at /projects/{handle}.

export type ProjectStorefrontSector =
  | 'Residential'
  | 'Hospitality'
  | 'Commercial'
  | 'Exhibition'
  | 'Cultural';

export type ProjectStorefrontBudgetBand = 'S' | 'M' | 'L' | 'XL';

export type ProjectStorefrontCommissionedBy = 'client' | 'architect' | 'studio';

export type ShopifyMetaobjectSyncStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'unpublished';

export interface ProjectStorefrontBlock {
  sector: ProjectStorefrontSector;
  subSector?: string;
  locationCity: string;
  locationCountry: string;       // ISO-2, e.g. "UG"
  yearCompleted: number;
  monthCompleted?: number;       // 1–12
  areaSqm: number;
  scope: string[];               // e.g. ["design","fitout","furniture"]
  teamLead?: string;
  teamSize?: number;
  durationWeeks?: number;
  budgetBand?: ProjectStorefrontBudgetBand;
  commissionedBy?: ProjectStorefrontCommissionedBy;
  partnerArchitect?: string;

  /**
   * Linked metaobject refs (DawinOS-side ids; publisher resolves to GIDs).
   */
  finishesUsedIds?: string[];    // finishLibrary doc ids with dawinFinishes set
  materialsUsedIds?: string[];   // inventoryItems doc ids with shopifyMetaobjectGid set
  pressMentionIds?: string[];    // pressMentions doc ids
  productsUsedShopifyIds?: string[];  // Shopify product GIDs

  beforeImageUrl?: string;
  afterImageUrl?: string;
  floorPlanImageUrl?: string;
  /** JSON-encodable timeline of bench-log entries (timestamped photos + captions). */
  benchLog?: Array<{ at: string; caption: string; imageUrl?: string }>;

  /** Editorial visibility — overrides `status: published` for the storefront only. */
  storefrontPublished: boolean;
  sortIndex?: number;
  shouldPublishToShopify: boolean;

  // Sync state — written by the publisher
  shopifyMetaobjectGid?: string;
  shopifySyncStatus?: ShopifyMetaobjectSyncStatus;
  shopifySyncError?: string;
  shopifyLastPublishedAt?: Timestamp;
  shopifyHeroImageGid?: string;
  shopifyGalleryImageGids?: string[];
  shopifyBeforeImageGid?: string;
  shopifyAfterImageGid?: string;
  shopifyFloorPlanImageGid?: string;
}

export const PROJECT_STOREFRONT_SECTORS: { value: ProjectStorefrontSector; label: string }[] = [
  { value: 'Residential', label: 'Residential' },
  { value: 'Hospitality', label: 'Hospitality' },
  { value: 'Commercial', label: 'Commercial' },
  { value: 'Exhibition', label: 'Exhibition' },
  { value: 'Cultural', label: 'Cultural' },
];

export interface ProjectCaseStudy {
  id: string;
  subsidiaryId: string;

  /** URL-safe slug. Becomes the Shopify page handle on publish. */
  handle: string;

  status: CaseStudyStatus;
  category: CaseStudyCategory;
  tags: string[];

  hero: CaseStudyHero;
  narrative?: CaseStudyNarrative;
  stats: CaseStudyStat[];
  gallery?: CaseStudyGallery;
  quote?: CaseStudyQuote;
  materials: CaseStudyMaterial[];
  actionPoints: CaseStudyActionPoint[];
  cta?: CaseStudyCTA;

  /** Linked CRM deal that originated this work (for attribution). */
  linkedDealId?: string;
  /** Linked design/manufacturing project (DawinOS internal). */
  linkedProjectId?: string;

  /**
   * Storefront publishing block (Shopify `project` metaobject). When set
   * with `shouldPublishToShopify`, the publisher writes a metaobject to
   * dawinfinishes.com at /projects/{handle}. See
   * docs/integrations/metaobjects/project.json.
   */
  storefront?: ProjectStorefrontBlock;

  /**
   * Legacy article-publish state (Shopify blog `projects` → article). This
   * path is being deprecated in favour of the `storefront` metaobject path.
   * Kept for one release so in-flight studies don't lose their link.
   * @deprecated Use `storefront.shopifyMetaobjectGid` instead.
   */
  shopifyArticleId?: string;
  /** @deprecated kept for legacy article-publish path */
  shopifyPageId?: string;
  /** @deprecated kept for legacy article-publish path */
  shopifyPageHandle?: string;
  /** @deprecated kept for legacy article-publish path */
  shopifyPageUrl?: string;
  lastPublishedAt?: Timestamp;
  publishedBy?: string;

  /** Editorial. */
  authorId: string;
  authorName: string;
  approverId?: string;
  approverName?: string;
  approvedAt?: Timestamp;

  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export type ProjectCaseStudyFormData = Omit<
  ProjectCaseStudy,
  | 'id'
  | 'createdAt'
  | 'createdBy'
  | 'updatedAt'
  | 'updatedBy'
  | 'shopifyPageId'
  | 'shopifyPageHandle'
  | 'shopifyPageUrl'
  | 'lastPublishedAt'
  | 'publishedBy'
  | 'approvedAt'
>;

export interface CaseStudyFilters {
  status?: CaseStudyStatus;
  category?: CaseStudyCategory;
  authorId?: string;
  search?: string;
}
