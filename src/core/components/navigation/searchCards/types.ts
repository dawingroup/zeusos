/**
 * SearchCard contract — every type-aware card implements this interface.
 *
 * The palette renders one common row shell (selected styling, click handler,
 * keyboard focus) and delegates the middle content to a card resolved by
 * `resolveCard(hit.cardKind)`. This keeps keyboard navigation identical
 * across every entity type.
 */

import type { SearchHit } from '@/core/services/search/searchIndex';

export interface SearchCardProps {
  hit: SearchHit;
  selected: boolean;
  onSelect: () => void;
  /** Raw query string — useful for highlight rendering. */
  query: string;
}

export type SearchCardComponent = (props: SearchCardProps) => JSX.Element;
