/**
 * IC transfer-pricing markup resolver (frontend mirror).
 *
 * Per [ADR-2026-05-25 §2.Q3](../../../../docs/ADR-2026-05-25-commercial-model.md)
 * cost-plus pricing applies when one brand receives work from another.
 * Frontend uses this to pre-fill the transfer-price field on the
 * IssueIWODialog so the AM doesn't eyeball the markup.
 *
 * Lookup order matches the backend ([`functions/src/billing/ic-markup.js`](../../../../functions/src/billing/ic-markup.js)):
 *   1. `organizations/{receivingOrgId}.icMarkupPct`
 *   2. `engine_config/global.icMarkupPctDefault`
 *   3. `DEFAULT_IC_MARKUP_PCT` (15)
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type { SubsidiaryId } from '@/core/settings/types';

export const DEFAULT_IC_MARKUP_PCT = 15;

export async function resolveIcMarkupPct(receivingOrgId: SubsidiaryId | string): Promise<number> {
  if (!receivingOrgId) return DEFAULT_IC_MARKUP_PCT;

  try {
    const orgSnap = await getDoc(doc(db, 'organizations', receivingOrgId));
    if (orgSnap.exists()) {
      const raw = (orgSnap.data() as { icMarkupPct?: number | null }).icMarkupPct;
      if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
        return raw;
      }
    }
  } catch {
    /* swallow */
  }

  try {
    const engineSnap = await getDoc(doc(db, 'engine_config', 'global'));
    if (engineSnap.exists()) {
      const raw = (engineSnap.data() as { icMarkupPctDefault?: number }).icMarkupPctDefault;
      if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
        return raw;
      }
    }
  } catch {
    /* swallow */
  }

  return DEFAULT_IC_MARKUP_PCT;
}

/**
 * Apply a markup percentage to a cost-base amount (minor units).
 * Matches the backend `applyMarkup` semantics exactly.
 */
export function applyMarkup(costMinor: number, markupPct: number): number {
  if (!Number.isFinite(costMinor) || costMinor < 0) return 0;
  if (!Number.isFinite(markupPct) || markupPct < 0) return costMinor;
  return Math.round(costMinor * (1 + markupPct / 100));
}
