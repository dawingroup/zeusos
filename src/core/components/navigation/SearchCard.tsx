/**
 * SearchCard — palette-facing wrapper that picks the right card component
 * for a hit. Keeps the palette code dumb: render `<SearchCard hit=... />`
 * and the right entity-specific layout shows up.
 */

import type { SearchCardProps } from './searchCards/types';
import { resolveCard } from './searchCards';

export function SearchCard(props: SearchCardProps) {
  const Card = resolveCard(props.hit.record.cardKind);
  return <Card {...props} />;
}

export type { SearchCardProps };
