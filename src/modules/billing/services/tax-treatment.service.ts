/**
 * Tax treatment resolver — domestic VAT vs cross-border reverse-charge.
 *
 * Pure function; no Firestore I/O. Called whenever an invoice (IC or
 * client) is created so the rate-in-force at issue time is stamped on
 * the document for audit.
 *
 * Jurisdiction rules below are the spec-author's working assumptions
 * (UG 18%, KE 16%, cross-border B2B services reverse-charge). They
 * SHOULD be reviewed before go-live — see plan §14.15 open questions.
 */

import type { TaxTreatment } from '../types/tax.types';

/**
 * ISO-2 jurisdiction code derived from a subsidiary's base country.
 * Centralised so the per-organisation `base_country` field that lands
 * in Phase 3.A.5 has one canonical mapping site.
 */
export type Jurisdiction = 'UG' | 'KE' | 'TZ' | 'RW' | 'US' | 'OTHER';

interface DomesticRate {
  rateBps: number;
  note: string;
}

const DOMESTIC_VAT: Record<Jurisdiction, DomesticRate | null> = {
  UG: { rateBps: 1800, note: 'VAT 18% (UG domestic)' },
  KE: { rateBps: 1600, note: 'VAT 16% (KE domestic)' },
  TZ: { rateBps: 1800, note: 'VAT 18% (TZ domestic)' },
  RW: { rateBps: 1800, note: 'VAT 18% (RW domestic)' },
  US: { rateBps: 0,    note: 'No federal VAT (US)' },
  OTHER: null,
};

/**
 * Resolve the tax treatment for an invoice raised from `from` to `to`.
 *
 * Rules:
 *  - Same jurisdiction → domestic VAT at that country's rate.
 *  - Cross-border within EAC for B2B services → REVERSE_CHARGE 0%; the
 *    recipient self-accounts via reverse-charge.
 *  - Cross-border to/from US/OTHER → EXEMPT (out of scope for our VAT
 *    regime; recipient handles per their local rules).
 */
export function taxTreatmentFor(
  from: Jurisdiction,
  to: Jurisdiction,
): TaxTreatment {
  if (from === to) {
    const domestic = DOMESTIC_VAT[from];
    if (domestic && domestic.rateBps > 0) {
      return {
        type: 'STANDARD_VAT',
        rateBps: domestic.rateBps,
        fromJurisdiction: from,
        toJurisdiction: to,
        note: domestic.note,
      };
    }
    return {
      type: 'EXEMPT',
      rateBps: 0,
      fromJurisdiction: from,
      toJurisdiction: to,
      note: domestic?.note ?? 'Out of VAT scope',
    };
  }

  // Cross-border within EAC member states — reverse charge applies.
  const eac: Jurisdiction[] = ['UG', 'KE', 'TZ', 'RW'];
  if (eac.includes(from) && eac.includes(to)) {
    return {
      type: 'REVERSE_CHARGE',
      rateBps: 0,
      fromJurisdiction: from,
      toJurisdiction: to,
      note: `Reverse charge — ${from}→${to} B2B services`,
    };
  }

  // Everything else (e.g. UG→US, KE→OTHER) is out of our VAT regime.
  return {
    type: 'EXEMPT',
    rateBps: 0,
    fromJurisdiction: from,
    toJurisdiction: to,
    note: `Out of scope (${from}→${to})`,
  };
}

/**
 * Map a ZeusOS subsidiary ID to its tax jurisdiction. Today every Zeus
 * sub-brand is registered in Uganda; KE/TZ/RW expansion will extend this
 * once the spin-out flag (§11.9) ships. Until then this mapping is
 * authoritative and is the only place subsidiary→country lives.
 */
const SUBSIDIARY_JURISDICTION: Record<string, Jurisdiction> = {
  'zeus-group':       'UG',
  'zeus-the-agency':  'UG',
  'zeus-digital':     'UG',
  'labyrinth':        'UG',
  'odd-gorilla':      'UG',
  'house-of-zeus':    'UG',
};

export function jurisdictionForOrg(orgId: string): Jurisdiction {
  return SUBSIDIARY_JURISDICTION[orgId] ?? 'OTHER';
}
