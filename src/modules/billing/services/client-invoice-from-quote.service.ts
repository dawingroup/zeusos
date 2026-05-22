/**
 * Quote → Client Invoice rollup.
 *
 * Wires the 3.C Quote builder output into the existing
 * `generateClientInvoice()` service. Unblocks the spec §8.3 flow:
 *
 *   On client billing run for masterJob:
 *     assert exactly_one_active(ClientInvoice where master_job = mj)
 *     lines = quote.lines.map(l → ClientInvoiceLine(
 *               description = clientFriendly(l),
 *               amount      = l.client_minor))
 *     inv = ClientInvoice(amount = sum(lines), issuer = parent)
 *
 * `Quote.description` is already required-by-spec to be client-friendly
 * (no subsidiary identity, no cost basis); we still pipe through
 * `clientFriendlyDescription()` as a defence-in-depth so any future
 * leak gets neutralised at the boundary.
 *
 * SCOPE: Quote → ClientInvoice is the AM-driven path. Once the Phase
 * 3.D AM UI lands, this function is what the "Issue Invoice" button
 * calls. Until then it's exercised via the upcoming Cloud Function
 * callable in functions/src/billing/.
 */

import { getQuote, listQuoteLines } from '@/modules/pricing/services/firestore';
import { generateClientInvoice } from './client-invoice.service';
import { clientFriendlyDescription } from './client-friendly';
import type { ClientInvoice } from '../types/client-invoice.types';

export interface GenerateClientInvoiceFromQuoteInput {
  /** Accepted Quote to roll up. */
  quoteId: string;
  /** The MasterJob this Quote produced. Phase 3.D's AM UI knows this
   *  because it creates the MasterJob on Quote acceptance; we don't
   *  derive it here to avoid a second Firestore round-trip. */
  masterJobId: string;
  createdBy: string;
  /** FX consolidation date — defaults to today. Override only for
   *  back-dated invoices (rare, but the spec §11.6 allows it). */
  consolidationDate?: string;
  /** Idempotency key from the caller. The Cloud Function callable
   *  forwards the Idempotency-Key header here. */
  idempotencyKey?: string;
}

export async function generateClientInvoiceFromQuote(
  input: GenerateClientInvoiceFromQuoteInput,
): Promise<ClientInvoice> {
  const quote = await getQuote(input.quoteId);
  if (!quote) {
    throw new Error(`[client-invoice] Quote ${input.quoteId} not found`);
  }
  if (quote.status !== 'ACCEPTED') {
    throw new Error(
      `[client-invoice] Quote ${input.quoteId} is in status ${quote.status} — ` +
        'only ACCEPTED quotes can be billed (spec §8.3).',
    );
  }

  const lines = await listQuoteLines(input.quoteId);
  if (lines.length === 0) {
    throw new Error(
      `[client-invoice] Quote ${input.quoteId} has no lines — refusing to ` +
        'generate an empty invoice.',
    );
  }

  return generateClientInvoice({
    masterJobId: input.masterJobId,
    clientId: quote.clientId,
    clientCurrency: quote.currency,
    consolidationDate: input.consolidationDate,
    idempotencyKey: input.idempotencyKey,
    createdBy: input.createdBy,
    lines: lines.map((line) => ({
      id: line.id,
      quoteLineId: line.id,
      // Defence-in-depth — description is already client-friendly per
      // §4.5, but normalise anyway so a future leak is contained.
      description: clientFriendlyDescription(line.description),
      // QuoteLine carries client_minor + cost_minor in the SAME currency
      // as the Quote itself; FX consolidation is applied per-line by
      // generateClientInvoice (no-op when source === target).
      sourceAmountMinor: line.clientMinor,
      sourceCurrency: line.currency,
      costMinor: line.costMinor,
      sourceSubsidiaryId: line.subsidiaryOrgId,
    })),
  });
}
