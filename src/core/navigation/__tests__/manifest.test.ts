/**
 * Phase 6.UI.0 — navigation manifest tests.
 *
 * Pinned acceptance from the brief:
 *   • resolveNav(PARENT, 'zeus-group') returns PARENT manifest in order
 *   • resolveNav(SUBSIDIARY, 'labyrinth') has Production above Campaigns
 *   • resolveNav(SUBSIDIARY, 'zeus-digital') has Media above Production
 *   • Odd Gorilla returns full 360° but signals isolation
 *   • Items with `requiresCapability: 'media'` are filtered out for
 *     Labyrinth
 */

import { describe, expect, it } from 'vitest';
import {
  NAV_MANIFEST_PARENT,
  resolveNav,
  isConflictIsolated,
  adaptManifestToLegacyNavItem,
  MANIFEST_TO_LEGACY_ID,
  type NavItem,
} from '../manifest';

function moduleIds(items: { moduleId: string }[]): string[] {
  return items.map((i) => i.moduleId);
}

describe('resolveNav — PARENT', () => {
  it('returns the parent manifest in declared order', () => {
    const items = resolveNav('PARENT', 'zeus-group');
    expect(moduleIds(items)).toEqual(moduleIds(NAV_MANIFEST_PARENT));
    // First and last anchors so accidental reorders fail loudly.
    expect(items[0]?.moduleId).toBe('dashboard');
    expect(items[items.length - 1]?.moduleId).toBe('admin');
  });

  it('exposes Traffic and Conflict Firewall (Phase 6.UI.B/C surfaces)', () => {
    const ids = moduleIds(resolveNav('PARENT', 'zeus-group'));
    expect(ids).toContain('traffic');
    expect(ids).toContain('conflict-firewall');
  });

  it('returns an empty list for SUBSIDIARY against zeus-group', () => {
    // zeus-group is the parent legal entity; SUBSIDIARY here would be
    // a misuse — guard against it returning either manifest.
    expect(resolveNav('SUBSIDIARY', 'zeus-group')).toEqual([]);
  });
});

describe('resolveNav — SUBSIDIARY: per-brand ordering', () => {
  it('Labyrinth puts Production above Campaigns', () => {
    const ids = moduleIds(resolveNav('SUBSIDIARY', 'labyrinth'));
    const production = ids.indexOf('production');
    const campaigns = ids.indexOf('campaigns');
    expect(production).toBeGreaterThanOrEqual(0);
    expect(campaigns).toBeGreaterThanOrEqual(0);
    expect(production).toBeLessThan(campaigns);
  });

  it('Zeus Digital puts Media above Production', () => {
    const ids = moduleIds(resolveNav('SUBSIDIARY', 'zeus-digital'));
    const media = ids.indexOf('media');
    const production = ids.indexOf('production');
    expect(media).toBeGreaterThanOrEqual(0);
    expect(production).toBeGreaterThanOrEqual(0);
    expect(media).toBeLessThan(production);
  });

  it('Zeus The Agency leads with Campaigns', () => {
    const ids = moduleIds(resolveNav('SUBSIDIARY', 'zeus-the-agency'));
    // Universal head (Inbox / ECD Review / Active Work) first, then
    // Campaigns leads the per-brand middle.
    expect(ids.slice(0, 3)).toEqual(['delivery-inbox', 'ecd-review', 'active-work']);
    expect(ids[3]).toBe('campaigns');
  });
});

describe('resolveNav — SUBSIDIARY: head + tail are universal', () => {
  it.each([
    ['zeus-the-agency'],
    ['zeus-digital'],
    ['labyrinth'],
    ['odd-gorilla'],
    ['house-of-zeus'],
  ] as const)('%s carries head + tail', (subId) => {
    const ids = moduleIds(resolveNav('SUBSIDIARY', subId));
    expect(ids.slice(0, 3)).toEqual(['delivery-inbox', 'ecd-review', 'active-work']);
    expect(ids.slice(-3)).toEqual(['burn-sla', 'hr', 'reports']);
  });
});

describe('resolveNav — capability filtering', () => {
  it('hides items with requiresCapability: media for Labyrinth', () => {
    const items = resolveNav('SUBSIDIARY', 'labyrinth');
    const media = items.find((i) => i.moduleId === 'media');
    expect(media).toBeUndefined();
  });

  it('keeps Media for Zeus Digital via the media_buy capability', () => {
    const items = resolveNav('SUBSIDIARY', 'zeus-digital');
    const media = items.find((i) => i.moduleId === 'media');
    expect(media).toBeDefined();
    // Media accepts either `media` (full-service brands) or
    // `media_buy` (digital-first); the array form keeps the rule
    // explicit at the manifest level.
    expect(media?.requiresCapability).toEqual(['media', 'media_buy']);
  });
});

describe('resolveNav — SUBSIDIARY_SELLING (ADR §3.2 step 5)', () => {
  it('returns delivery head + per-brand middle + commercial entries + universal tail', () => {
    const ids = moduleIds(resolveNav('SUBSIDIARY_SELLING', 'zeus-the-agency'));
    // Delivery head still leads.
    expect(ids.slice(0, 3)).toEqual(['delivery-inbox', 'ecd-review', 'active-work']);
    // Universal tail still trails.
    expect(ids.slice(-3)).toEqual(['burn-sla', 'hr', 'reports']);
    // Commercial trio appears between middle and tail.
    expect(ids).toContain('account-management');
    expect(ids).toContain('pricing');
    expect(ids).toContain('billing');
  });

  it('places commercial entries AFTER the per-brand middle', () => {
    const ids = moduleIds(resolveNav('SUBSIDIARY_SELLING', 'zeus-the-agency'));
    const lastMiddleIdx = ids.indexOf('crm');                  // last middle item per ZTA's order
    const firstCommercialIdx = ids.indexOf('account-management');
    expect(firstCommercialIdx).toBeGreaterThan(lastMiddleIdx);
  });

  it('places commercial entries BEFORE the universal tail', () => {
    const ids = moduleIds(resolveNav('SUBSIDIARY_SELLING', 'labyrinth'));
    const lastCommercialIdx = ids.indexOf('billing');
    const firstTailIdx = ids.indexOf('burn-sla');
    expect(lastCommercialIdx).toBeGreaterThan(0);
    expect(firstTailIdx).toBeGreaterThan(lastCommercialIdx);
  });

  it('SUBSIDIARY_SELLING + zeus-group returns empty (commercial-only orgs use PARENT)', () => {
    expect(resolveNav('SUBSIDIARY_SELLING', 'zeus-group')).toEqual([]);
  });
});

describe('adaptManifestToLegacyNavItem', () => {
  interface Legacy {
    id: string;
    label: string;
    href: string;
    icon: string;
    children?: Legacy[];
  }

  it('reuses the legacy entry when one exists, overlaying label + routePath', () => {
    const legacy: Legacy = {
      id: 'talent',
      label: 'Talent Roster',
      href: '/talent',
      icon: 'Star',
      children: [
        { id: 'talent-roster', label: 'Roster', href: '/talent', icon: 'Star' },
        { id: 'talent-invoices', label: 'Invoices', href: '/talent/invoices', icon: 'FileText' },
      ],
    };
    const lookup = new Map<string, Legacy>([['talent', legacy]]);
    const manifestItem: NavItem = {
      moduleId: 'talent',
      label: 'Talent',
      icon: 'Star',
      routePath: '/talent',
    };
    const adapted = adaptManifestToLegacyNavItem<Legacy>(manifestItem, lookup);
    expect(adapted.id).toBe('talent');
    expect(adapted.label).toBe('Talent');
    expect(adapted.href).toBe('/talent');
    // Children survive the adaptation so the dropdown still works.
    expect(adapted.children).toHaveLength(2);
  });

  it('synthesises a flat item when no legacy match exists', () => {
    const lookup = new Map<string, Legacy>();
    const manifestItem: NavItem = {
      moduleId: 'traffic',
      label: 'Traffic',
      icon: 'Workflow',
      routePath: '/traffic',
    };
    const adapted = adaptManifestToLegacyNavItem<Legacy>(manifestItem, lookup);
    expect(adapted).toEqual({
      id: 'traffic',
      label: 'Traffic',
      href: '/traffic',
      icon: 'Workflow',
    });
  });

  it('maps account-management → clients (the legacy commercial id)', () => {
    expect(MANIFEST_TO_LEGACY_ID['account-management']).toBe('clients');
  });
});

describe('Odd Gorilla — conflict-isolated workspace', () => {
  it('returns the full 360° middle (mirrors Zeus The Agency capability set)', () => {
    const ids = moduleIds(resolveNav('SUBSIDIARY', 'odd-gorilla'));
    // Same modules as Zeus The Agency in the middle.
    const expectMiddle = ['campaigns', 'media', 'production', 'talent', 'asset-library', 'crm'];
    for (const moduleId of expectMiddle) {
      expect(ids).toContain(moduleId);
    }
  });

  it('flags isolation via isConflictIsolated', () => {
    expect(isConflictIsolated('odd-gorilla')).toBe(true);
    expect(isConflictIsolated('zeus-the-agency')).toBe(false);
    expect(isConflictIsolated('zeus-digital')).toBe(false);
    expect(isConflictIsolated('labyrinth')).toBe(false);
    expect(isConflictIsolated('house-of-zeus')).toBe(false);
    expect(isConflictIsolated('zeus-group')).toBe(false);
  });
});
