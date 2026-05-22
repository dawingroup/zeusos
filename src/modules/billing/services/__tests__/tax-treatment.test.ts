/**
 * Tax-treatment matrix — UG↔UG, UG↔KE, etc.
 * Pure function; no Firestore mocking required.
 */

import { describe, expect, it } from 'vitest';
import {
  jurisdictionForOrg,
  taxTreatmentFor,
} from '../tax-treatment.service';

describe('taxTreatmentFor', () => {
  it('UG → UG: 18% standard VAT', () => {
    const t = taxTreatmentFor('UG', 'UG');
    expect(t.type).toBe('STANDARD_VAT');
    expect(t.rateBps).toBe(1800);
    expect(t.note).toMatch(/18%/);
  });

  it('KE → KE: 16% standard VAT', () => {
    const t = taxTreatmentFor('KE', 'KE');
    expect(t.type).toBe('STANDARD_VAT');
    expect(t.rateBps).toBe(1600);
  });

  it('UG → KE: reverse charge, 0%', () => {
    const t = taxTreatmentFor('UG', 'KE');
    expect(t.type).toBe('REVERSE_CHARGE');
    expect(t.rateBps).toBe(0);
    expect(t.note).toMatch(/UG→KE/);
  });

  it('KE → UG: reverse charge, 0% (symmetric)', () => {
    const t = taxTreatmentFor('KE', 'UG');
    expect(t.type).toBe('REVERSE_CHARGE');
    expect(t.rateBps).toBe(0);
  });

  it('UG → US: out-of-scope EXEMPT', () => {
    const t = taxTreatmentFor('UG', 'US');
    expect(t.type).toBe('EXEMPT');
    expect(t.rateBps).toBe(0);
  });

  it('preserves from/to jurisdictions on the result', () => {
    const t = taxTreatmentFor('UG', 'KE');
    expect(t.fromJurisdiction).toBe('UG');
    expect(t.toJurisdiction).toBe('KE');
  });

  it('different EAC pairs all reverse-charge', () => {
    for (const from of ['UG', 'KE', 'TZ', 'RW'] as const) {
      for (const to of ['UG', 'KE', 'TZ', 'RW'] as const) {
        const t = taxTreatmentFor(from, to);
        if (from === to) {
          expect(t.type).toBe('STANDARD_VAT');
        } else {
          expect(t.type).toBe('REVERSE_CHARGE');
        }
      }
    }
  });
});

describe('jurisdictionForOrg', () => {
  it('maps every Zeus subsidiary to UG today', () => {
    expect(jurisdictionForOrg('zeus-group')).toBe('UG');
    expect(jurisdictionForOrg('zeus-the-agency')).toBe('UG');
    expect(jurisdictionForOrg('labyrinth')).toBe('UG');
    expect(jurisdictionForOrg('odd-gorilla')).toBe('UG');
    expect(jurisdictionForOrg('house-of-zeus')).toBe('UG');
  });

  it('returns OTHER for unknown orgs', () => {
    expect(jurisdictionForOrg('some-future-acquisition')).toBe('OTHER');
  });
});
