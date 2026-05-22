/**
 * cost_minor field guard + client-friendly mapper tests.
 *
 * Per Tech Spec §4.5: `cost_minor`, `transfer_price_minor`, and
 * `source_subsidiary_id` MUST NEVER appear in a client-facing surface.
 * This test asserts the invariant at runtime — adding a leaky field to
 * the internal shape will fail here unless the mapper is also updated.
 */

import { describe, expect, it } from 'vitest';
import {
  toClientFacingInvoice,
  toClientFacingLine,
  clientFriendlyDescription,
} from '../client-friendly';
import type {
  ClientInvoice,
  ClientInvoiceLineInternal,
} from '../../types/client-invoice.types';

const FORBIDDEN_FIELDS = [
  'costMinor',
  'cost_minor',
  'transferPriceMinor',
  'transfer_price_minor',
  'sourceSubsidiaryId',
  'source_subsidiary_id',
  'masterJobId',
  'master_job_id',
  'issuerOrgId',
  'fxConsolidation',
  'uniqueGuardKey',
  'createdBy',
  'quoteLineId',
] as const;

function sampleInternalLine(overrides: Partial<ClientInvoiceLineInternal> = {}): ClientInvoiceLineInternal {
  return {
    id: 'line-1',
    quoteLineId: 'quote-line-1',
    description: 'Zeus The Agency — design hours',
    amountMinor: 5_000_000,
    costMinor: 1_200_000,
    sourceSubsidiaryId: 'zeus-the-agency',
    ...overrides,
  };
}

function sampleInvoice(overrides: Partial<ClientInvoice> = {}): ClientInvoice {
  return {
    id: 'inv-1',
    clientId: 'client-1',
    masterJobId: 'job-1',
    issuerOrgId: 'zeus-group',
    total: { amountMinor: 10_000_000, currency: 'UGX' },
    lines: [
      sampleInternalLine(),
      sampleInternalLine({
        id: 'line-2',
        description: 'Labyrinth — production hours',
        amountMinor: 5_000_000,
        costMinor: 2_400_000,
        sourceSubsidiaryId: 'labyrinth',
      }),
    ],
    taxTreatment: {
      type: 'STANDARD_VAT',
      rateBps: 1800,
      fromJurisdiction: 'UG',
      toJurisdiction: 'UG',
      note: 'VAT 18% (UG domestic)',
    },
    status: 'DRAFT',
    paidMinor: 0,
    uniqueGuardKey: 'job-1:active',
    createdBy: 'user-1',
    createdAt: '2026-05-22T10:00:00Z',
    updatedAt: '2026-05-22T10:00:00Z',
    ...overrides,
  };
}

describe('cost_minor field guard — client-facing line shape', () => {
  it('omits costMinor / cost_minor', () => {
    const out = toClientFacingLine(sampleInternalLine());
    for (const field of FORBIDDEN_FIELDS) {
      expect(out, `client-facing line must not include ${field}`).not.toHaveProperty(field);
    }
  });

  it('keeps only the allow-listed client-facing keys', () => {
    const out = toClientFacingLine(sampleInternalLine());
    expect(Object.keys(out).sort()).toEqual(['amountMinor', 'description', 'id']);
  });

  it('hides subsidiary identity in the description', () => {
    const out = toClientFacingLine(sampleInternalLine());
    expect(out.description).not.toMatch(/Zeus The Agency/i);
    expect(out.description).toBe('Creative campaign development');
  });
});

describe('cost_minor field guard — client-facing invoice shape', () => {
  it('omits every internal-only field', () => {
    const out = toClientFacingInvoice(sampleInvoice());
    for (const field of FORBIDDEN_FIELDS) {
      expect(out, `client-facing invoice must not include ${field}`).not.toHaveProperty(field);
    }
  });

  it('also strips forbidden fields on every line', () => {
    const out = toClientFacingInvoice(sampleInvoice());
    for (const line of out.lines) {
      for (const field of FORBIDDEN_FIELDS) {
        expect(line, `client-facing line must not include ${field}`).not.toHaveProperty(field);
      }
    }
  });

  it('keeps only the allow-listed client-facing keys', () => {
    const out = toClientFacingInvoice(sampleInvoice());
    const allowed = [
      'clientId',
      'id',
      'issuedAt',
      'lines',
      'paidAt',
      'paidMinor',
      'status',
      'taxTreatment',
      'total',
    ];
    // issuedAt / paidAt are optional — only assert the keys that exist
    // are a subset of the allow-list.
    for (const key of Object.keys(out)) {
      expect(allowed, `unexpected key on client-facing invoice: ${key}`).toContain(key);
    }
  });

  it('rewrites subsidiary names on multi-line invoices', () => {
    const out = toClientFacingInvoice(sampleInvoice());
    for (const line of out.lines) {
      expect(line.description).not.toMatch(/Zeus|Labyrinth|Odd Gorilla|House of Zeus/i);
    }
  });

  it('serialises to JSON without any forbidden field appearing anywhere', () => {
    // Belt-and-braces: even if a future internal-only field sneaks
    // through a nested object, the JSON serialisation will surface it.
    const out = toClientFacingInvoice(sampleInvoice());
    const json = JSON.stringify(out);
    for (const field of FORBIDDEN_FIELDS) {
      expect(json, `serialised invoice contains forbidden field ${field}`).not.toMatch(
        new RegExp(`"${field}"`),
      );
    }
  });
});

describe('clientFriendlyDescription mapper', () => {
  it('strips subsidiary names with separators', () => {
    expect(clientFriendlyDescription('Zeus The Agency — design hours'))
      .toBe('Creative campaign development');
    expect(clientFriendlyDescription('Labyrinth — production hours'))
      .toBe('Production services');
    expect(clientFriendlyDescription('Zeus Digital — paid media buying'))
      .toBe('Media planning and buying');
  });

  it('rewrites bare prefixes too', () => {
    expect(clientFriendlyDescription('design hours')).toBe('Creative campaign development');
    expect(clientFriendlyDescription('pr hours')).toBe('Public relations services');
    expect(clientFriendlyDescription('strategy hours')).toBe('Strategic planning');
  });

  it('falls back to "Professional services" for unrecognised + empty inputs', () => {
    expect(clientFriendlyDescription('')).toBe('Professional services');
    expect(clientFriendlyDescription('Zeus The Agency')).toBe('Professional services');
  });

  it('passes through neutral descriptions unchanged', () => {
    expect(clientFriendlyDescription('Influencer campaign x3'))
      .toBe('Influencer campaign x3');
  });
});
