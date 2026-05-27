/**
 * Brief validation helpers — Phase 6.D (closes Addendum v1.1 C6).
 *
 * The 24h-document-before-verbal rule: per profile §2.3, the documented
 * brief must precede the verbal briefing by at least 24 hours so the
 * client team has time to absorb it. This validator returns structured
 * warnings (NOT hard errors) so intake screens can surface them
 * inline without blocking save — the rule is a guideline, not a gate.
 *
 * Co-authorship completeness check: returns a warning if a brief lacks
 * agency contributions (Account-Mgmt may then prompt the AM lead to
 * add their pre-call notes).
 */

import type { Brief, BriefAuthorContribution } from '../types/campaign.types';

export interface BriefValidationWarning {
  code: 'DOC_VERBAL_TOO_CLOSE' | 'NO_AGENCY_CONTRIBUTION' | 'NO_CLIENT_CONTRIBUTION' | 'NO_DOCUMENT_DELIVERED';
  message: string;
  field?: string;
}

const MIN_DOC_TO_VERBAL_MS = 24 * 60 * 60 * 1000;   // 24h

function toMs(t: unknown): number | null {
  if (!t) return null;
  if (typeof t === 'string') {
    const ms = Date.parse(t);
    return Number.isNaN(ms) ? null : ms;
  }
  // Firestore Timestamp — { seconds, nanoseconds }
  if (typeof t === 'object' && t !== null) {
    const ts = t as { seconds?: number; toMillis?: () => number };
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  }
  return null;
}

/**
 * Run all advisory checks on a Brief. Returns [] when the brief is
 * clean. Callers (intake form, master-job opener) can surface the
 * warnings inline or post-submit.
 */
export function validateBrief(brief: Brief | undefined | null): BriefValidationWarning[] {
  if (!brief) return [];
  const warnings: BriefValidationWarning[] = [];

  warnings.push(...validateBriefingCadence(brief));
  warnings.push(...validateCoAuthorship(brief));

  return warnings;
}

/**
 * Validate the 24h-doc-before-verbal rule.
 *
 *   - Both timestamps missing → no warning (intake hasn't started)
 *   - Only documentDeliveredAt set → no warning (verbal not yet happened)
 *   - Only verbalBriefingAt set → warns DOC_VERBAL_TOO_CLOSE
 *   - Both set, gap ≥ 24h → no warning
 *   - Both set, gap < 24h → warns DOC_VERBAL_TOO_CLOSE
 *
 * Tier exemption: TIER_3 may legitimately skip the doc-before-verbal
 * step (per profile §2.3 — "Call, then email"). Tier 3 briefs get
 * NO_DOCUMENT_DELIVERED instead of DOC_VERBAL_TOO_CLOSE when verbal
 * happens without a doc.
 */
export function validateBriefingCadence(brief: Brief): BriefValidationWarning[] {
  const docMs = toMs(brief.documentDeliveredAt);
  const verbalMs = toMs(brief.verbalBriefingAt);

  if (!docMs && !verbalMs) return [];     // intake hasn't started
  if (docMs && !verbalMs) return [];      // verbal not yet happened

  if (!docMs && verbalMs) {
    // Verbal without doc — OK for Tier 3 (profile §2.3: "Call, then
    // email"), warn for Tier 1/2.
    if (brief.tier === 3) return [];
    return [{
      code: 'NO_DOCUMENT_DELIVERED',
      message: 'Verbal briefing scheduled without a documented brief. ' +
               `Tier ${brief.tier} expects a doc ≥ 24h before the call.`,
      field: 'documentDeliveredAt',
    }];
  }

  // Both set — check the gap.
  const gapMs = (verbalMs as number) - (docMs as number);
  if (gapMs < MIN_DOC_TO_VERBAL_MS) {
    return [{
      code: 'DOC_VERBAL_TOO_CLOSE',
      message: `Verbal briefing is only ${Math.floor(gapMs / (60 * 60 * 1000))}h ` +
               `after the documented brief landed — the rule expects ≥ 24h. ` +
               `Reschedule the verbal or backdate the document.`,
      field: 'verbalBriefingAt',
    }];
  }

  return [];
}

/**
 * Validate the co-authorship expectation. Returns a warning when one
 * side hasn't contributed (the spec calls for client+agency co-author).
 */
export function validateCoAuthorship(brief: Brief): BriefValidationWarning[] {
  const contributions = (brief.authorContributions || []) as BriefAuthorContribution[];
  if (contributions.length === 0) return [];   // legacy brief, no record

  const warnings: BriefValidationWarning[] = [];
  const hasAgency = contributions.some((c) => c.principalKind === 'agency');
  const hasClient = contributions.some((c) => c.principalKind === 'client');

  if (!hasAgency) {
    warnings.push({
      code: 'NO_AGENCY_CONTRIBUTION',
      message: 'Brief is co-authorship-tagged but no agency-side contribution recorded. ' +
               'Add the AM lead\'s pre-call input.',
      field: 'authorContributions',
    });
  }
  if (!hasClient) {
    warnings.push({
      code: 'NO_CLIENT_CONTRIBUTION',
      message: 'Brief is co-authorship-tagged but no client-side contribution recorded. ' +
               'At least the client lead should appear.',
      field: 'authorContributions',
    });
  }

  return warnings;
}
