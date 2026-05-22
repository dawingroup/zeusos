/**
 * Status enums + transition tables — spec §6.2.
 *
 * The Cloud Functions consult `QUOTE_TRANSITIONS` and `RATE_CARD_TRANSITIONS`
 * to validate state changes inside their transactions. UI uses
 * `*_STATUS_META` for colour + label.
 */

import type { QuoteStatus } from '../types/quote.types';
import type { RateCardStatus } from '../types/rate-card.types';

export const QUOTE_STATUSES: QuoteStatus[] = ['DRAFT', 'ISSUED', 'ACCEPTED', 'VOID'];

export const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT:    ['ISSUED', 'VOID'],
  ISSUED:   ['ACCEPTED', 'VOID'],
  ACCEPTED: [],
  VOID:     [],
};

export function canTransitionQuote(from: QuoteStatus, to: QuoteStatus): boolean {
  return QUOTE_TRANSITIONS[from].includes(to);
}

export const QUOTE_STATUS_META: Record<QuoteStatus, { label: string; color: string }> = {
  DRAFT:    { label: 'Draft',    color: '#94A3B8' },
  ISSUED:   { label: 'Issued',   color: '#3B82F6' },
  ACCEPTED: { label: 'Accepted', color: '#16A34A' },
  VOID:     { label: 'Void',     color: '#94A3B8' },
};

export const RATE_CARD_STATUSES: RateCardStatus[] = ['DRAFT', 'ACTIVE', 'RETIRED'];

export const RATE_CARD_TRANSITIONS: Record<RateCardStatus, RateCardStatus[]> = {
  DRAFT:   ['ACTIVE'],
  ACTIVE:  ['RETIRED'],
  RETIRED: [],
};

export function canTransitionRateCard(from: RateCardStatus, to: RateCardStatus): boolean {
  return RATE_CARD_TRANSITIONS[from].includes(to);
}

export const RATE_CARD_STATUS_META: Record<RateCardStatus, { label: string; color: string }> = {
  DRAFT:   { label: 'Draft',   color: '#94A3B8' },
  ACTIVE:  { label: 'Active',  color: '#16A34A' },
  RETIRED: { label: 'Retired', color: '#6B7280' },
};
