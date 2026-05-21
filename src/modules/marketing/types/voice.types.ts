/**
 * Voice (testimonial) types.
 *
 * Surfaced on the dawinfinishes.com home Voices section and project pages.
 * Mirror of docs/integrations/metaobjects/voice.json.
 */

import { Timestamp } from 'firebase/firestore';

export type VoiceTone = 'warm' | 'trade' | 'press';

export type VoiceSyncStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'unpublished';

export interface Voice {
  id: string;
  subsidiaryId: string;

  /** Free-form rich-text quote. Required. */
  quote: string;

  /** "Eric Mukasa" */
  attribution: string;
  /** "GM, Speke Group" */
  role?: string;
  /** "Speke Group" */
  company?: string;
  /** Firebase Storage URL for the company logo (square or mono SVG). */
  companyLogoUrl?: string;

  /** Optional link back to a project case study (ZeusOS id). */
  projectCaseStudyId?: string;

  /** When the quote was given. */
  quoteDate: Timestamp;

  tone?: VoiceTone;

  /** Editorial — one "lead" voice can be the hero quote on home. */
  lead: boolean;
  featured: boolean;
  /** GDPR-style affirmative consent capture (required to publish). */
  consentGiven: boolean;

  /** Editor gate — false suppresses publish/keeps as draft. */
  shouldPublishToShopify: boolean;

  // Sync state — written by the publisher
  shopifyMetaobjectGid?: string;
  shopifySyncStatus?: VoiceSyncStatus;
  shopifySyncError?: string;
  shopifyLastPublishedAt?: Timestamp;
  shopifyLogoImageGid?: string;

  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export type VoiceFormData = Omit<
  Voice,
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
