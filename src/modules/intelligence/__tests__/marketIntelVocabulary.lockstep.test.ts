/**
 * The market-intelligence vocabulary is ONE registry spelled in four places
 * (audit 2026-10, D-1): the client constants, the server module the scan and
 * the integrity audit use, the MCP tool's enum, and the canonical
 * SubsidiaryId list. This pins them to each other.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { SUBSIDIARY_IDS } from '@/core/settings/types';
import { ALL_DELIVERY_SUBSIDIARIES } from '@/core/settings/brand-capabilities';
import {
  MARKET_INTEL_SUBSIDIARY_IDS,
  MARKET_INTEL_SUBSIDIARY_CONTEXT,
  MARKET_INTEL_SUBSIDIARY_OPTIONS,
  MARKET_INTEL_COLLECTION_IDS,
  RETIRED_MARKET_INTEL_COLLECTIONS,
  isMarketIntelSubsidiaryId,
  normalizeSubsidiaryIds,
  subsidiaryNameOf,
} from '../constants/marketIntelVocabulary';
import { SUBSIDIARY_OPTIONS } from '../types/market-intelligence.types';

const require = createRequire(import.meta.url);
const server = require('../../../../functions/src/lib/marketIntelVocabulary');

describe('market-intel vocabulary — lockstep', () => {
  it('subsidiary ids: client = server = the five delivery brands ⊂ canonical SubsidiaryId', () => {
    expect([...MARKET_INTEL_SUBSIDIARY_IDS]).toEqual([...server.MARKET_INTEL_SUBSIDIARY_IDS]);
    expect([...MARKET_INTEL_SUBSIDIARY_IDS]).toEqual([...ALL_DELIVERY_SUBSIDIARIES]);
    for (const id of MARKET_INTEL_SUBSIDIARY_IDS) expect(SUBSIDIARY_IDS).toContain(id);
    expect(isMarketIntelSubsidiaryId('zeus-group')).toBe(false);
    expect(isMarketIntelSubsidiaryId('finishes')).toBe(false);
  });

  it('scan context: name, description, industries and keywords agree field for field', () => {
    expect(Object.keys(MARKET_INTEL_SUBSIDIARY_CONTEXT)).toEqual(Object.keys(server.SUBSIDIARY_CONTEXT));
    for (const id of MARKET_INTEL_SUBSIDIARY_IDS) {
      const c = MARKET_INTEL_SUBSIDIARY_CONTEXT[id];
      const s = server.SUBSIDIARY_CONTEXT[id];
      expect(c.name).toBe(s.name);
      expect(c.description).toBe(s.description);
      expect([...c.industries]).toEqual([...s.industries]);
      expect([...c.competitorKeywords]).toEqual([...s.competitorKeywords]);
    }
    expect(subsidiaryNameOf('labyrinth')).toBe(server.subsidiaryNameOf('labyrinth'));
  });

  it('the picker rows come from the registry, in registry order', () => {
    expect(SUBSIDIARY_OPTIONS).toBe(MARKET_INTEL_SUBSIDIARY_OPTIONS);
    expect(MARKET_INTEL_SUBSIDIARY_OPTIONS.map((o) => o.id)).toEqual([...MARKET_INTEL_SUBSIDIARY_IDS]);
    expect(MARKET_INTEL_SUBSIDIARY_OPTIONS[0].name).toBe('Zeus The Agency');
  });

  it('normalizeSubsidiaryIds matches the server for the same input', () => {
    const input = ['odd-gorilla', ' labyrinth ', 'finishes', 'odd-gorilla', 7, null];
    expect(normalizeSubsidiaryIds(input)).toEqual(server.normalizeSubsidiaryIds(input));
  });

  it('owned and retired collection lists agree', () => {
    expect([...MARKET_INTEL_COLLECTION_IDS]).toEqual([...server.MARKET_INTEL_COLLECTION_IDS]);
    expect([...RETIRED_MARKET_INTEL_COLLECTIONS]).toEqual([...server.RETIRED_MARKET_INTEL_COLLECTIONS]);
  });

  it('the MCP tool enum spells the same ids', () => {
    const src = readFileSync(require.resolve('../../../../zeusos-mcp-server/src/tools/finance.ts'), 'utf8');
    const m = src.match(/subsidiary_id: z\.enum\(\[([^\]]+)\]\)/);
    expect(m).not.toBeNull();
    const ids = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect(ids).toEqual([...MARKET_INTEL_SUBSIDIARY_IDS]);
  });

  it('the rules carry exactly one block per owned collection and none for a retired one', () => {
    const rules = readFileSync(require.resolve('../../../../firestore.rules'), 'utf8');
    for (const id of MARKET_INTEL_COLLECTION_IDS) {
      const blocks = rules.match(new RegExp(`match /${id}/\\{[a-zA-Z]+\\} \\{`, 'g')) || [];
      expect(blocks, id).toHaveLength(1);
    }
    for (const id of RETIRED_MARKET_INTEL_COLLECTIONS) {
      expect(rules, id).not.toMatch(new RegExp(`match /${id}/\\{`));
    }
    expect(rules).not.toMatch(/match \/executive\/market_intelligence\//);
  });
});
