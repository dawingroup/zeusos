/**
 * Tests for the furniture-domains knowledge base.
 *
 * Two invariants pinned here:
 *   1. Every archetype key listed in `DEFAULT_ASSEMBLY_HIERARCHIES`
 *      has a matching `ArchetypeDefinition` — otherwise the AI
 *      grouper's context-enrichment step would fall through to
 *      `UNKNOWN_ARCHETYPE` for an archetype we actually support.
 *   2. `detectPartCategoryFromName` picks the most specific category
 *      across the non-kitchen domains we just added — cover_panel /
 *      toe_kick / fascia / upright win over generic `panel`.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_ASSEMBLY_HIERARCHIES } from '../assembly.constants';
import {
  ARCHETYPE_LIBRARY,
  getArchetypeDefinition,
  detectPartCategoryFromName,
  DOMAIN_PROMPT_HINTS,
  FURNITURE_DOMAINS,
  resolveCabinetArchetypes,
  mergeArchetypeContext,
  listArchetypes,
} from '../furnitureDomains';

describe('archetype library coverage', () => {
  it('every DEFAULT_ASSEMBLY_HIERARCHIES key has a matching definition', () => {
    const hierarchyKeys = Object.keys(DEFAULT_ASSEMBLY_HIERARCHIES);
    const missing = hierarchyKeys.filter(k => !(k in ARCHETYPE_LIBRARY));
    expect(missing).toEqual([]);
  });

  it('every library entry points to a known domain', () => {
    for (const [key, def] of Object.entries(ARCHETYPE_LIBRARY)) {
      expect(FURNITURE_DOMAINS).toContain(def.domain);
      expect(def.label, `missing label for ${key}`).toBeTruthy();
      expect(def.description, `missing description for ${key}`).toBeTruthy();
      expect(def.expectedAssemblies.length).toBeGreaterThan(0);
    }
  });

  it('every domain has a prompt hint paragraph', () => {
    for (const d of FURNITURE_DOMAINS) {
      expect(DOMAIN_PROMPT_HINTS[d]).toBeTruthy();
      expect(DOMAIN_PROMPT_HINTS[d].length).toBeGreaterThan(30);
    }
  });

  it('falls back to UNKNOWN_ARCHETYPE cleanly for unknown keys', () => {
    expect(getArchetypeDefinition('made_up_archetype').label).toBe('Unknown furniture');
    expect(getArchetypeDefinition(undefined).label).toBe('Unknown furniture');
    expect(getArchetypeDefinition(null).label).toBe('Unknown furniture');
  });
});

describe('detectPartCategoryFromName — cover / facing family wins', () => {
  it('classifies cable_cover as cover_panel', () => {
    expect(detectPartCategoryFromName('cable_cover_front', 'workspace')).toBe('cover_panel');
  });

  it('classifies gable_cover as cover_panel', () => {
    expect(detectPartCategoryFromName('Gable_Cover_L', 'retail')).toBe('cover_panel');
  });

  it('classifies modesty panel as cover_panel', () => {
    expect(detectPartCategoryFromName('Desk_Modesty_Panel', 'workspace')).toBe('cover_panel');
  });

  it('classifies toe-kick variants as toe_kick', () => {
    expect(detectPartCategoryFromName('toe_kick_front', 'kitchen')).toBe('toe_kick');
    expect(detectPartCategoryFromName('Kickboard-L', 'pharmacy')).toBe('toe_kick');
  });

  it('classifies fascia / valance as fascia', () => {
    expect(detectPartCategoryFromName('reception_fascia', 'reception')).toBe('fascia');
    expect(detectPartCategoryFromName('light_rail', 'retail')).toBe('fascia');
  });
});

describe('detectPartCategoryFromName — domain-aware structural', () => {
  it('classifies upright in retail', () => {
    expect(detectPartCategoryFromName('gondola_post_L', 'retail')).toBe('upright');
  });

  it('classifies upright in pharmacy', () => {
    expect(detectPartCategoryFromName('Dispensary_Upright_R', 'pharmacy')).toBe('upright');
  });

  it('does NOT classify upright in kitchen (too generic outside retail)', () => {
    // The hint is domain-gated, so "upright" tokens in a kitchen fall
    // through to the default 'panel'.
    expect(detectPartCategoryFromName('kitchen_upright_divider', 'kitchen')).toBe('panel');
  });

  it('defaults to panel when no hint matches', () => {
    expect(detectPartCategoryFromName('side_L', 'kitchen')).toBe('panel');
    expect(detectPartCategoryFromName('bottom_panel', 'kitchen')).toBe('panel');
  });

  it('handles empty / null names safely', () => {
    expect(detectPartCategoryFromName('', 'kitchen')).toBe('panel');
    expect(detectPartCategoryFromName(null, 'kitchen')).toBe('panel');
    expect(detectPartCategoryFromName(undefined, 'kitchen')).toBe('panel');
  });
});

describe('resolveCabinetArchetypes', () => {
  it('merges legacy singular + new list, dedupes, filters blanks', () => {
    expect(resolveCabinetArchetypes({ archetypeId: 'desk' })).toEqual(['desk']);
    expect(resolveCabinetArchetypes({
      archetypeId: 'desk',
      archetypeIds: ['desk', 'workstation', ''],
    })).toEqual(['desk', 'workstation']);
    expect(resolveCabinetArchetypes({
      archetypeIds: ['retail_gondola', 'retail_gondola'],
    })).toEqual(['retail_gondola']);
    expect(resolveCabinetArchetypes({})).toEqual([]);
  });
});

describe('mergeArchetypeContext', () => {
  it('returns UNKNOWN when no keys resolve', () => {
    const ctx = mergeArchetypeContext([]);
    expect(ctx.primary.label).toBe('Unknown furniture');
    expect(ctx.keys).toEqual([]);
    expect(ctx.domains).toContain('storage');
  });

  it('for a single known key mirrors that archetype', () => {
    const ctx = mergeArchetypeContext(['desk']);
    expect(ctx.primary.label).toBe('Desk');
    expect(ctx.keys).toEqual(['desk']);
    expect(ctx.domains).toEqual(['workspace']);
    expect(ctx.expectedAssemblies).toContain('work_surface');
    expect(ctx.coverPanelHints).toContain('modesty');
  });

  it('for multiple keys unions assemblies, hints, domains', () => {
    const ctx = mergeArchetypeContext(['workstation', 'retail_gondola']);
    expect(ctx.keys).toEqual(['workstation', 'retail_gondola']);
    expect(ctx.labels).toHaveLength(2);
    expect(ctx.domains).toContain('workspace');
    expect(ctx.domains).toContain('retail');
    // Union of both — work_surface (workstation) + gable_run (gondola).
    expect(ctx.expectedAssemblies).toContain('work_surface');
    expect(ctx.expectedAssemblies).toContain('gable_run');
    // Cover hints from both.
    expect(ctx.coverPanelHints).toContain('modesty');
    expect(ctx.coverPanelHints).toContain('end_cap');
    // Domain prompt concatenates (not empty).
    expect(ctx.domainPrompt.length).toBeGreaterThan(50);
  });

  it('dedupes union entries', () => {
    const ctx = mergeArchetypeContext(['desk', 'workstation']);
    // Both are workspace domain — domains should have one entry.
    expect(ctx.domains).toEqual(['workspace']);
    // expectedAssemblies contains each only once.
    const uniq = new Set(ctx.expectedAssemblies);
    expect(uniq.size).toBe(ctx.expectedAssemblies.length);
  });

  it('ignores unknown keys cleanly', () => {
    const ctx = mergeArchetypeContext(['desk', 'does_not_exist']);
    expect(ctx.keys).toEqual(['desk']);
    expect(ctx.labels).toEqual(['Desk']);
  });
});

describe('listArchetypes', () => {
  it('returns every library entry with id + definition fields', () => {
    const list = listArchetypes();
    expect(list.length).toBe(Object.keys(ARCHETYPE_LIBRARY).length);
    for (const entry of list) {
      expect(entry.id).toBeTruthy();
      expect(entry.label).toBeTruthy();
      expect(entry.domain).toBeTruthy();
    }
  });
});

describe('detectPartCategoryFromName — cover-family ordering', () => {
  it('toe_kick beats cover_panel when both tokens could match', () => {
    // "kick_cover" contains both "kick" (toe-kick family) and "cover"
    // (cover-panel family). The table order puts toe_kick first so
    // the more specific classification wins.
    expect(detectPartCategoryFromName('toe_kick_cover', 'kitchen')).toBe('toe_kick');
  });

  it('fascia beats cover_panel when both tokens could match', () => {
    expect(detectPartCategoryFromName('fascia_cover_panel', 'reception')).toBe('fascia');
  });
});
