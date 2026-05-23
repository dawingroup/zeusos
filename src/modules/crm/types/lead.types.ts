/**
 * Lead — sales-pipeline entry in the ZeusOS CRM.
 *
 * Collection: crm_leads/{leadId}
 *
 * This is the marketing-agency successor to the DawinOS CRM module
 * (construction-shaped deal tracker, removed in Phase 1.C). The new
 * model is light: a 5-stage funnel and an activity sub-collection.
 *
 * Pipeline stages and transitions
 * ───────────────────────────────
 *   PROSPECT  → QUALIFIED   (we've made first contact + qualified fit)
 *   QUALIFIED → PITCH       (a proposal / pitch is in market)
 *   PITCH     → WON         (signed; convert to Client via AM module)
 *   PITCH     → LOST        (declined / dead)
 *   QUALIFIED → LOST        (disqualified before pitching)
 *   LOST      → PROSPECT    (re-open; allowed for nurture cycles)
 *
 * Backward transitions are blocked in the service layer to keep the
 * funnel report honest. Re-opening from LOST is the one exception.
 */

import type { Timestamp } from 'firebase/firestore';

export type LeadStage =
  | 'PROSPECT'
  | 'QUALIFIED'
  | 'PITCH'
  | 'WON'
  | 'LOST';

export type LeadSource =
  | 'REFERRAL'
  | 'INBOUND'      // contact form, website
  | 'OUTBOUND'     // cold email / call
  | 'EVENT'        // conference / networking
  | 'EXISTING_CLIENT' // upsell / cross-sell
  | 'OTHER';

export type CurrencyCode = 'UGX' | 'USD' | 'KES' | 'EUR' | 'GBP';

export interface Lead {
  id: string;
  /** Display name — typically the prospect company. */
  name: string;
  /** Primary contact details. */
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  /** Where the lead came from (audit / reporting). */
  source: LeadSource;
  stage: LeadStage;
  /** Estimated deal value in minor units. */
  estimatedValueMinor?: number;
  currency: CurrencyCode;
  /** Probability of closing (0–1). Used for weighted pipeline reports. */
  probability?: number;
  /** Owner / responsible AM. uid of the parent-org principal. */
  ownerUserId?: string;
  /** Parent org id (the CRM is parent-org-only, so orgId == parent org). */
  orgId: string;
  /** Free-form notes. */
  notes?: string;
  /** Tags for ad-hoc reporting (e.g. ["FMCG","banking","retainer"]). */
  tags?: string[];
  /** Next action — a single line + ISO date. Drives the AM follow-up
   *  dashboard. */
  nextActionLabel?: string;
  nextActionDate?: string; // ISO YYYY-MM-DD
  /** Timestamp of the last activity (call/email/meeting/note). */
  lastActivityAt?: Timestamp | string;
  /** When the lead moved into WON or LOST. Used for funnel metrics. */
  closedAt?: Timestamp | string;
  /** If converted to a Client (Phase 3.D), this is the resulting clientId. */
  convertedClientId?: string;
  /** Reason captured when stage moved to LOST. */
  lostReason?: string;
  createdBy: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

/**
 * Activity — one event in a lead's history (call, email, meeting, note).
 *
 * Sub-collection: crm_leads/{leadId}/activities/{activityId}
 */
export type ActivityKind =
  | 'CALL'
  | 'EMAIL'
  | 'MEETING'
  | 'NOTE'
  | 'STAGE_CHANGE'  // automatic — emitted by the service when stage moves
  | 'TASK';

export interface LeadActivity {
  id: string;
  leadId: string;
  kind: ActivityKind;
  /** One-line summary shown in the timeline. */
  summary: string;
  /** Free-form longer body — meeting notes, email contents, etc. */
  detail?: string;
  performedBy: string;
  /** When the activity happened (vs createdAt = when it was logged). */
  performedAt: Timestamp | string;
  /** For STAGE_CHANGE auto-activities — the from/to pair. */
  stageFrom?: LeadStage;
  stageTo?: LeadStage;
  createdAt: Timestamp | string;
}
