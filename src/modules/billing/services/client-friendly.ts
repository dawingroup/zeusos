/**
 * Client-facing shape mappers — strip every internal field before the
 * data leaves the AM/Finance surface area.
 *
 * SCHEMA INVARIANT (Tech Spec §4.5): `cost_minor`,
 * `transfer_price_minor`, `source_subsidiary_id`, and any
 * subsidiary-naming description (e.g. "Zeus The Agency design hours")
 * MUST NEVER appear in a client-facing surface. These mappers are the
 * single allow-listing site enforcing that rule.
 *
 * Tests in `__tests__/client-friendly.test.ts` assert the invariant
 * automatically — adding a new internal field elsewhere will not break
 * the guard, so contributors must update this mapper whenever the
 * internal shapes change.
 */

import type {
  ClientInvoice,
  ClientInvoiceLineInternal,
  ClientFacingInvoice,
  ClientFacingInvoiceLine,
} from '../types/client-invoice.types';

/**
 * Map an internal client-invoice line to its client-facing form.
 * Construct a fresh object — never spread the internal one — so
 * accidental future additions don't leak through.
 */
export function toClientFacingLine(
  internal: ClientInvoiceLineInternal,
): ClientFacingInvoiceLine {
  return {
    id: internal.id,
    description: clientFriendlyDescription(internal.description),
    amountMinor: internal.amountMinor,
  };
}

/**
 * Map an internal client invoice to its client-facing form. Drops
 * masterJobId, fxConsolidation, uniqueGuardKey, issuerOrgId, audit
 * metadata, and every per-line cost/source field.
 */
export function toClientFacingInvoice(internal: ClientInvoice): ClientFacingInvoice {
  return {
    id: internal.id,
    clientId: internal.clientId,
    total: internal.total,
    lines: internal.lines.map(toClientFacingLine),
    taxTreatment: internal.taxTreatment,
    status: internal.status,
    paidMinor: internal.paidMinor,
    issuedAt: internal.issuedAt,
    paidAt: internal.paidAt,
  };
}

/**
 * Rewrite any subsidiary-naming text to a neutral, client-facing
 * description. We keep a small allow-list of canonical descriptions
 * keyed by the recognisable internal prefixes; everything that doesn't
 * match passes through unchanged but is scanned to ensure no
 * subsidiary name leaks.
 */
const SUBSIDIARY_NAMES = [
  'Zeus The Agency',
  'Zeus Digital',
  'Labyrinth',
  'Odd Gorilla',
  'House of Zeus',
  'Zeus Group',
] as const;

const CLIENT_FRIENDLY_PREFIXES: Array<{ match: RegExp; rewrite: string }> = [
  { match: /design\s+hours?/i,             rewrite: 'Creative campaign development' },
  { match: /production\s+hours?/i,         rewrite: 'Production services' },
  { match: /media\s+(buy|buying|planning)/i, rewrite: 'Media planning and buying' },
  { match: /pr\s+hours?/i,                 rewrite: 'Public relations services' },
  { match: /strategy\s+hours?/i,           rewrite: 'Strategic planning' },
  { match: /talent\s+booking/i,            rewrite: 'Talent and influencer services' },
];

export function clientFriendlyDescription(raw: string): string {
  let result = raw;
  for (const name of SUBSIDIARY_NAMES) {
    if (result.includes(name)) {
      // Strip the subsidiary name and any leading "  — " / " / "
      // separators that would otherwise leave an awkward orphan.
      result = result
        .split(`${name} — `).join('')
        .split(`${name} - `).join('')
        .split(`${name}: `).join('')
        .split(name).join('')
        .trim();
    }
  }

  for (const { match, rewrite } of CLIENT_FRIENDLY_PREFIXES) {
    if (match.test(result)) {
      return rewrite;
    }
  }

  // No subsidiary leak detected and no prefix matched → keep as-is.
  return result || 'Professional services';
}
