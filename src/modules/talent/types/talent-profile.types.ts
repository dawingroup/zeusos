/**
 * TalentProfile — record in the Talent Roster.
 *
 * Phase 4 scope: the roster covers four kinds of talent —
 *   - STAFF / FREELANCER  (carried over from the original DawinOS shape)
 *   - INFLUENCER          (creators / content makers; social-first)
 *   - MODEL               (face / body work; agency-represented or freelance)
 *
 * Collection: talent_profiles/{profileId}
 *
 * Note on bankDetails: the field is write-restricted to admin-only in
 * Firestore rules. The type includes it as optional for reads that
 * satisfy that restriction.
 *
 * Kind-specific fields (`influencerProfile`, `modelProfile`) are optional
 * and only meaningful when `type` matches. Storing the kind-specific
 * detail on a single doc keeps the roster queryable by name/status
 * without a join, at the cost of some sparse fields per row.
 */

import type { Timestamp } from 'firebase/firestore';

export type TalentType =
  | 'STAFF'
  | 'FREELANCER'
  | 'INFLUENCER'
  | 'MODEL';

export type TalentStatus = 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED';

/** Social platforms tracked for influencers. Add to the union when new
 *  channels become commercially relevant. */
export type SocialPlatform =
  | 'INSTAGRAM'
  | 'TIKTOK'
  | 'YOUTUBE'
  | 'TWITTER_X'
  | 'FACEBOOK'
  | 'LINKEDIN'
  | 'TWITCH'
  | 'SNAPCHAT';

export interface SocialHandle {
  platform: SocialPlatform;
  /** Public handle (e.g. "@beats_by_zee"). */
  handle: string;
  /** Full URL to the profile (optional but preferred for click-through). */
  url?: string;
  /** Snapshot of followers at the last verification. */
  followerCount?: number;
  /** Reach (12-month avg of monthly reach) if known. */
  monthlyReach?: number;
  /** Average engagement rate as a fraction (e.g. 0.045 = 4.5%). */
  engagementRate?: number;
  /** ISO date of the last metric refresh. Audit aid for stale data. */
  lastVerifiedAt?: string;
}

export interface AudienceDemographics {
  /** Primary country (ISO 3166-1 alpha-2). */
  primaryCountry?: string;
  /** Top 1–3 cities by audience share. */
  topCities?: string[];
  /** Age bracket the bulk of the audience falls into. */
  primaryAgeBracket?: '13-17' | '18-24' | '25-34' | '35-44' | '45-54' | '55+';
  /** Approximate split between female / male / non-binary, all 0–1. */
  audienceSplit?: { female?: number; male?: number; nonBinary?: number };
  /** Languages spoken by the bulk of the audience. */
  languages?: string[];
}

export interface InfluencerProfile {
  /** Niche tags — e.g. ["fashion","beauty","lifestyle"] or ["sports","football"]. */
  niches?: string[];
  /** Aggregate follower count across all listed platforms. Maintained by
   *  the service layer; clients should not write directly. */
  totalFollowerCount?: number;
  audienceDemographics?: AudienceDemographics;
  /** Rate card per deliverable type (in minor units of currency). */
  rateCard?: {
    /** Single in-feed post. */
    postRateMinor?: number;
    /** Single story (typically lower-priced and ephemeral). */
    storyRateMinor?: number;
    /** Short-form video reel / TikTok. */
    reelRateMinor?: number;
    /** Long-form YouTube integration. */
    longFormVideoRateMinor?: number;
    /** Per appearance / event. */
    appearanceRateMinor?: number;
    /** Custom-package rate for bundled deliverables. */
    bundleRateMinor?: number;
  };
  /** Free-form notes on exclusivity / brand conflicts. */
  exclusivityNotes?: string;
  /** Talent manager / agency contact, if managed. */
  managerContact?: {
    name?: string;
    email?: string;
    phone?: string;
    agency?: string;
  };
}

export interface ModelProfile {
  /** Modeling agency that represents this model, if any. */
  agency?: {
    name: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
  };
  /** Physical attributes used for casting briefs. All optional. */
  attributes?: {
    /** Height in centimetres. */
    heightCm?: number;
    /** Bust / chest in cm. */
    bustCm?: number;
    /** Waist in cm. */
    waistCm?: number;
    /** Hips in cm. */
    hipsCm?: number;
    /** Shoe size — kept as string to allow EU/UK/US notation. */
    shoeSize?: string;
    /** Free-form hair colour. */
    hairColor?: string;
    /** Free-form eye colour. */
    eyeColor?: string;
    /** Open-vocabulary skin-tone descriptor (e.g. "deep umber", "fair"). */
    skinTone?: string;
  };
  /** Storage reference to a recent portfolio / comp card PDF. */
  portfolioStorageRef?: string;
  /** Specialties — e.g. ["runway","editorial","commercial","fitness"]. */
  specialties?: string[];
  /** Languages spoken — useful for international shoots. */
  languages?: string[];
  /** Rate card per booking type. */
  rateCard?: {
    /** Half-day rate (≤4 hours). */
    halfDayRateMinor?: number;
    /** Full-day rate (>4 hours, up to 10). */
    fullDayRateMinor?: number;
    /** Usage / buy-out fee for a 12-month exclusivity. */
    usage12mRateMinor?: number;
  };
}

export interface TalentProfile {
  id: string;
  name: string;
  email: string;
  type: TalentType;
  /** Sub-brand affiliation, if applicable. */
  subsidiaryOrgId?: string;
  /** Roles this talent can fulfil. For INFLUENCER/MODEL this is typically
   *  empty; the kind-specific profile carries the relevant detail. */
  roles: string[];
  /** Daily rate in minor units (e.g. UGX cents). Generic / fallback rate;
   *  influencers + models will typically rely on their `rateCard` blocks. */
  dailyRateMinor?: number;
  currency?: string;
  /** Storage reference to a signed NDA document. */
  ndaStorageRef?: string;
  /** Bank details — write-restricted to admin; treated as sensitive. */
  bankDetails?: string;
  status: TalentStatus;
  notes?: string;
  /** ── Kind-specific extensions (Phase 4) ──────────────────────────── */
  /** Populated when `type === 'INFLUENCER'`. Ignored otherwise. */
  influencerProfile?: InfluencerProfile;
  /** Populated when `type === 'MODEL'`. Ignored otherwise. */
  modelProfile?: ModelProfile;
  /** Social handles — primarily for INFLUENCER but also useful for any
   *  talent whose social presence is part of their bookability. */
  socialHandles?: SocialHandle[];
  createdBy: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
