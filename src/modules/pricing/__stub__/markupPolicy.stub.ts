/**
 * PHASE 3.A.5 PLACEHOLDER — markup-policy lookup.
 *
 * Spec §8.1 calls `markupPolicy(subsidiaryOrgId, sow.client)`. Until 3.A.5
 * persists this table (and plan §14.15 question 1 resolves who owns it),
 * the lookup is a flat in-memory map. Replace with a Firestore-backed
 * lookup when 3.A.5 introduces `markup_policy/{id}`.
 */

import type { SubsidiaryId } from '@/core/settings/types';
import type { MarkupPolicyEntry } from './phase-3a5-types';

const DEFAULT_TABLE: MarkupPolicyEntry[] = [
  { subsidiaryId: 'zeus-the-agency', clientId: '*', markupPct: 35 },
  { subsidiaryId: 'zeus-digital',    clientId: '*', markupPct: 40 },
  { subsidiaryId: 'labyrinth',       clientId: '*', markupPct: 45 },
  { subsidiaryId: 'odd-gorilla',     clientId: '*', markupPct: 45 },
  { subsidiaryId: 'house-of-zeus',   clientId: '*', markupPct: 50 },
];

export function lookupMarkupPct(
  subsidiaryId: SubsidiaryId,
  clientId: string,
  table: MarkupPolicyEntry[] = DEFAULT_TABLE,
): number {
  const direct = table.find(e => e.subsidiaryId === subsidiaryId && e.clientId === clientId);
  if (direct) return direct.markupPct;
  const wildcard = table.find(e => e.subsidiaryId === subsidiaryId && e.clientId === '*');
  if (wildcard) return wildcard.markupPct;
  throw new Error(`No markup policy entry for subsidiary=${subsidiaryId} client=${clientId}`);
}

export const STUB_MARKUP_TABLE = DEFAULT_TABLE;
