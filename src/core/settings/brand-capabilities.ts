/**
 * Brand capabilities — frontend mirror of `BRAND_CAPABILITIES` in
 * `functions/src/assignment/services/route-brand.service.js` (Addendum
 * v1.1 §2.1). Keep the two in sync — the navigation manifest, brand
 * routing UI, and any other UI that filters by capability all key off
 * this list.
 *
 * Capability tags are lowercase + snake-case (e.g. `media_buy`,
 * `sem_seo`). When the `brand_capability` Firestore collection ships,
 * swap the hardcoded registry for a Firestore read on both halves.
 */

import type { SubsidiaryId } from './types';

/**
 * Sub-brand subsidiaries that actually deliver work (i.e. the 5
 * operating agencies — excludes the parent `zeus-group`).
 */
export type DeliverySubsidiaryId = Exclude<SubsidiaryId, 'zeus-group'>;

/**
 * Canonical capability tags. The union mirrors the unique values
 * across all five brand sets in `BRAND_CAPABILITIES`.
 */
export type Capability =
  // Zeus The Agency / Odd Gorilla / House of Zeus shared 360° core
  | 'creative'
  | 'btl'
  | 'digital'
  | 'pr'
  | 'media'
  | 'production'
  // Zeus Digital extras
  | 'content'
  | 'sem_seo'
  | 'influencer'
  | 'media_buy'
  | 'innovation'
  // Labyrinth extras
  | 'sound'
  | 'photography'
  | 'podcast'
  | 'film'
  | 'documentary';

/**
 * Brand → declared capabilities. Mirrors
 * `functions/src/assignment/services/route-brand.service.js`.
 */
export const BRAND_CAPABILITIES: Record<DeliverySubsidiaryId, ReadonlySet<Capability>> = {
  'zeus-the-agency': new Set<Capability>([
    'creative', 'btl', 'digital', 'pr', 'media', 'production',
  ]),
  'zeus-digital': new Set<Capability>([
    'content', 'sem_seo', 'influencer', 'media_buy', 'innovation',
    'digital', 'creative',
  ]),
  'labyrinth': new Set<Capability>([
    'sound', 'photography', 'podcast', 'film', 'documentary',
    'production',
  ]),
  'odd-gorilla': new Set<Capability>([
    'creative', 'btl', 'digital', 'pr', 'media', 'production',
  ]),
  'house-of-zeus': new Set<Capability>([
    'creative', 'btl', 'digital', 'pr', 'media', 'production',
  ]),
};

export const ALL_DELIVERY_SUBSIDIARIES: DeliverySubsidiaryId[] = Object.keys(
  BRAND_CAPABILITIES,
) as DeliverySubsidiaryId[];

export function brandHasCapability(
  subsidiaryId: DeliverySubsidiaryId,
  capability: Capability,
): boolean {
  return BRAND_CAPABILITIES[subsidiaryId]?.has(capability) ?? false;
}

/**
 * Odd Gorilla is the "conflict agency" — clients walled off from the
 * rest of the consortium go here. The UI surfaces this with a badge
 * on the org-switcher chip + a one-line banner on the Inbox.
 */
export function isConflictIsolated(subsidiaryId: SubsidiaryId): boolean {
  return subsidiaryId === 'odd-gorilla';
}
