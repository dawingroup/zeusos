/**
 * Read-side Firestore helpers for the pricing UI. Writes go via the
 * Cloud Functions in `firebase.ts` so margin/floor + transition invariants
 * are enforced server-side.
 *
 * PHASE 3.A.5 PLACEHOLDER: collection paths are stubbed at the root. When
 * 3.A.5 lands, re-point to `organizations/{orgId}/rate_cards/...` etc.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type { RateCard, RateCardLine, Quote, QuoteLine } from '../types';
import type { SubsidiaryId } from '@/core/settings/types';

export async function listRateCardsForSubsidiary(orgId: SubsidiaryId): Promise<RateCard[]> {
  const q = query(collection(db, 'rate_cards'), where('orgId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RateCard, 'id'>) }));
}

export function subscribeRateCardsForSubsidiary(
  orgId: SubsidiaryId,
  cb: (cards: RateCard[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'rate_cards'), where('orgId', '==', orgId));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RateCard, 'id'>) })));
  });
}

export async function getRateCard(rateCardId: string): Promise<RateCard | null> {
  const snap = await getDoc(doc(db, 'rate_cards', rateCardId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<RateCard, 'id'>) };
}

export async function listRateCardLines(rateCardId: string): Promise<RateCardLine[]> {
  const snap = await getDocs(collection(db, `rate_cards/${rateCardId}/rate_card_lines`));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RateCardLine, 'id'>) }));
}

export async function getQuote(quoteId: string): Promise<Quote | null> {
  const snap = await getDoc(doc(db, 'quotes', quoteId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Quote, 'id'>) };
}

export async function listQuoteLines(quoteId: string): Promise<QuoteLine[]> {
  const snap = await getDocs(collection(db, `quotes/${quoteId}/quote_lines`));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<QuoteLine, 'id'>) }));
}
