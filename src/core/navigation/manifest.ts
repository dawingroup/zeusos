/**
 * Navigation manifest — Phase 6.UI.0.
 *
 * Resolves `(OrganizationKind, SubsidiaryId)` to an ordered list of
 * sidebar items so every subsidiary sees a sidebar tuned to its
 * actual workflow. Replaces the legacy "one static module list for
 * everyone" pattern in `src/config/navigation.unified.ts` (which
 * stays around for the command palette, header pills, and legacy
 * call-sites until they migrate).
 *
 * Ordering rules — kept in lock-step with the Phase 6.UI brief:
 *
 *   PARENT (zeus-group)
 *     Dashboard, Account Mgmt, Traffic, Pricing & Quotes,
 *     Billing & Inter-Co, Conflict Firewall, CRM, Talent,
 *     Procurement, Finance, HR Central, Strategy & Intelligence,
 *     Asset Library, Admin
 *
 *   SUBSIDIARY — universal head
 *     Inbox, ECD Review, Active Work
 *
 *   SUBSIDIARY — capability-ordered middle (per brand)
 *     labyrinth         Production, Asset Library, Talent, Campaigns, CRM
 *     zeus-digital      Media, Campaigns, Talent, Asset Library, Production, CRM
 *     zeus-the-agency   Campaigns, Media, Production, Talent, Asset Library, CRM
 *     house-of-zeus     Campaigns, Media, Production, Talent, Asset Library, CRM
 *     odd-gorilla       Campaigns, Media, Production, Talent, Asset Library, CRM
 *
 *   SUBSIDIARY — universal tail
 *     Burn & SLA, HR, Reports
 *
 * Items declared with `requiresCapability` are filtered out for
 * brands that lack the capability (so Labyrinth — which has no
 * `media` capability — won't see Media even if a future
 * subsidiary order accidentally includes it).
 */

import type { OrganizationKind, SubsidiaryId } from '@/core/settings/types';
import {
  BRAND_CAPABILITIES,
  isConflictIsolated,
  type Capability,
  type DeliverySubsidiaryId,
} from '@/core/settings/brand-capabilities';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface NavItem {
  /** Stable id — used for active-state matching, favourites, and tests. */
  moduleId: string;
  label: string;
  /** Lucide icon name; resolved via `getIconByName` in the renderer. */
  icon?: string;
  /** Path the item links to. May be a placeholder for routes that
   *  ship in a later 6.UI PR — the manifest doesn't gate on route
   *  existence. */
  routePath: string;
  /** When set, the item is hidden for any subsidiary that doesn't
   *  declare the capability in `BRAND_CAPABILITIES`. Accepts an array
   *  for OR-semantics — e.g. the Media surface accepts either `media`
   *  (full-service brands) or `media_buy` (digital-first brands). */
  requiresCapability?: Capability | Capability[];
  /** Show only when `OrganizationKind === 'PARENT'`. */
  parentOrgOnly?: boolean;
  /** Show only when `OrganizationKind === 'SUBSIDIARY'`. */
  subsidiaryOnly?: boolean;
}

// ----------------------------------------------------------------------------
// PARENT (zeus-group) manifest
// ----------------------------------------------------------------------------

export const NAV_MANIFEST_PARENT: NavItem[] = [
  { moduleId: 'dashboard',         label: 'Dashboard',                 icon: 'LayoutDashboard', routePath: '/' },
  { moduleId: 'account-management', label: 'Account Mgmt',             icon: 'Briefcase',       routePath: '/clients' },
  { moduleId: 'traffic',           label: 'Traffic',                   icon: 'Workflow',        routePath: '/traffic' },
  { moduleId: 'pricing',           label: 'Pricing & Quotes',          icon: 'Tag',             routePath: '/pricing/rate-cards' },
  { moduleId: 'billing',           label: 'Billing & Inter-Co',        icon: 'Receipt',         routePath: '/billing/client-invoices' },
  { moduleId: 'conflict-firewall', label: 'Conflict Firewall',         icon: 'Shield',          routePath: '/conflict-firewall/categories' },
  { moduleId: 'crm',               label: 'CRM',                       icon: 'Target',          routePath: '/crm' },
  { moduleId: 'talent',            label: 'Talent',                    icon: 'Star',            routePath: '/talent' },
  { moduleId: 'procurement',       label: 'Procurement',               icon: 'ShoppingCart',    routePath: '/procurement/purchase-orders' },
  // Suppliers: routed (/suppliers) + present in navigation.unified, but was
  // absent from the parent manifest so the live page had no sidebar entry.
  { moduleId: 'suppliers',         label: 'Suppliers',                 icon: 'Package',         routePath: '/suppliers' },
  { moduleId: 'finance',           label: 'Finance',                   icon: 'DollarSign',      routePath: '/finance/overview' },
  { moduleId: 'hr-central',        label: 'HR Central',                icon: 'Users',           routePath: '/hr/employees' },
  { moduleId: 'strategy',          label: 'Strategy & Intelligence',   icon: 'Brain',           routePath: '/strategy' },
  // Market Intel: routed (/market-intel) competitor/insights surface — was
  // missing from the manifest despite the design placing it after Strategy.
  { moduleId: 'market-intel',      label: 'Market Intel',              icon: 'Sparkles',        routePath: '/market-intel' },
  // AI Assistant: full-page cross-module NL assistant (Phase 3.1).
  { moduleId: 'ai-assistant',      label: 'AI Assistant',              icon: 'Bot',             routePath: '/ai-assistant' },
  // Business Memory: the group-brain store the assistant + briefs draw on (Phase 3.2).
  { moduleId: 'business-memory',   label: 'Business Memory',           icon: 'Brain',           routePath: '/intelligence/memory' },
  // Comms: internal team chat — universal (also in the subsidiary head). (Phase 4.1)
  { moduleId: 'comms',             label: 'Comms',                     icon: 'MessagesSquare',  routePath: '/comms' },
  { moduleId: 'asset-library',     label: 'Asset Library',             icon: 'FolderOpen',      routePath: '/assets' },
  { moduleId: 'reports',           label: 'Reports',                   icon: 'BarChart3',       routePath: '/reports' },
  // Compliance: routed (/compliance) dashboard + documents + obligations —
  // present in navigation.unified but never surfaced in the parent sidebar.
  { moduleId: 'compliance',        label: 'Compliance',                icon: 'Shield',          routePath: '/compliance' },
  // Phase 5.D — parent-org admins log time against IWOs too (e.g. AM
  // running a brief workshop) so My Time appears here as well as in
  // the subsidiary head. Team Time is the parent-org-only cross-brand
  // roll-up (subsidiary leads don't get it — their personal My Time
  // covers their own work, and the cross-brand query is parent-org-only).
  { moduleId: 'my-time',           label: 'My Time',                   icon: 'Clock',           routePath: '/time' },
  { moduleId: 'team-time',         label: 'Team Time',                 icon: 'Users',           routePath: '/time/team' },
  { moduleId: 'admin',             label: 'Admin',                     icon: 'Settings',        routePath: '/admin/users' },
];

// ----------------------------------------------------------------------------
// SUBSIDIARY head / tail (universal across all 5 brands)
// ----------------------------------------------------------------------------

export const NAV_MANIFEST_SUBSIDIARY_HEAD: NavItem[] = [
  // IWOInboxPage already shows two sections — "Awaiting acceptance"
  // (ISSUED) and "In-flight" (ACCEPTED / IN_PROGRESS / DELIVERED) — so
  // the historical "Active Work" entry pointing at /delivery/active
  // was duplicating the bottom half of the same page. Dropped in the
  // Phase 6.UI close-out; /delivery/active redirects to /delivery/inbox
  // for any deep-links that survived.
  { moduleId: 'delivery-inbox', label: 'Inbox',       icon: 'Inbox',          routePath: '/delivery/inbox',      subsidiaryOnly: true },
  { moduleId: 'ecd-review',     label: 'ECD Review',  icon: 'ClipboardCheck', routePath: '/delivery/ecd-review', subsidiaryOnly: true },
  // Phase 5.D — cross-IWO "My Time This Week" read view. Posting still
  // happens from /delivery/iwo/:id; this is the staff-side visibility.
  { moduleId: 'my-time',        label: 'My Time',     icon: 'Clock',          routePath: '/time',                subsidiaryOnly: true },
  // Phase 5.D depth — brand-scoped Team Time (TeamTimePage adapts to the
  // subsidiary's own brand; rules enforce the scope).
  { moduleId: 'team-time',      label: 'Team Time',   icon: 'Users',          routePath: '/time/team',           subsidiaryOnly: true },
];

export const NAV_MANIFEST_SUBSIDIARY_TAIL: NavItem[] = [
  // Comms: internal team chat — universal (also in NAV_MANIFEST_PARENT). In the
  // tail (not head) so the head's first four + the per-brand middle ordering
  // stay stable. (Phase 4.1)
  { moduleId: 'comms',          label: 'Comms',       icon: 'MessagesSquare', routePath: '/comms' },
  // Burn & SLA is the per-brand reporting surface for subsidiary users.
  // The cross-brand Reports page (`/reports`) is parent-org-gated and
  // lives in `NAV_MANIFEST_PARENT`; subsidiary nav doesn't include it
  // because BurnAndSlaPage already covers what one brand head needs.
  // Compliance: brand leads see their OWN obligations/documents (the
  // ComplianceDashboardPage renders the single-brand view for subsidiary
  // principals; parent-org gets the group rollup). Placed ahead of the
  // Burn & SLA + HR pair, which remain the trailing universal items. (Phase 2.1)
  { moduleId: 'compliance', label: 'Compliance', icon: 'Shield', routePath: '/compliance', subsidiaryOnly: true },
  { moduleId: 'burn-sla', label: 'Burn & SLA', icon: 'Flame', routePath: '/delivery/burn', subsidiaryOnly: true },
  { moduleId: 'hr',       label: 'HR',         icon: 'Users', routePath: '/hr/employees',  subsidiaryOnly: true },
];

// ----------------------------------------------------------------------------
// Capability-keyed middle items
// ----------------------------------------------------------------------------
//
// Each capability bundles the module(s) it brings to a sub-brand's
// sidebar. Brands with the capability get the bundle; brands without
// it don't. CRM, Campaigns, and Asset Library aren't capabilities
// per se — they're universal to every delivery sub-brand — but we
// model them here under a synthetic `'__universal'` key so the
// per-brand `MIDDLE_ORDER` can reference them by id.

export const NAV_MANIFEST_CAPABILITY_TAIL: Record<Capability, NavItem[]> = {
  creative: [],
  btl: [],
  digital: [],
  pr: [],
  media: [
    { moduleId: 'media', label: 'Media', icon: 'Megaphone', routePath: '/media', requiresCapability: ['media', 'media_buy'] },
  ],
  production: [
    // No `requiresCapability` — every delivery sub-brand in the brief
    // has Production in its middle order, including the digital-first
    // brands. Per-brand `SUBSIDIARY_MIDDLE_ORDER` is the gate; if a
    // future brand omits Production from its order, it won't render.
    { moduleId: 'production', label: 'Production', icon: 'Clapperboard', routePath: '/production' },
  ],
  content: [],
  sem_seo: [],
  influencer: [],
  media_buy: [],
  innovation: [],
  sound: [],
  photography: [],
  podcast: [],
  film: [],
  documentary: [],
};

// Universal middle items (every delivery sub-brand sees these).
const UNIVERSAL_CAMPAIGNS: NavItem = {
  moduleId: 'campaigns', label: 'Campaigns', icon: 'Megaphone', routePath: '/master-jobs', subsidiaryOnly: true,
};
const UNIVERSAL_TALENT: NavItem = {
  moduleId: 'talent', label: 'Talent', icon: 'Star', routePath: '/talent',
};
const UNIVERSAL_ASSET_LIBRARY: NavItem = {
  moduleId: 'asset-library', label: 'Asset Library', icon: 'FolderOpen', routePath: '/assets',
};
const UNIVERSAL_CRM: NavItem = {
  moduleId: 'crm', label: 'CRM', icon: 'Target', routePath: '/crm',
};

/**
 * Lookup so the per-brand `MIDDLE_ORDER` arrays below can refer to
 * any middle item by moduleId. Capability-derived items pull from
 * `NAV_MANIFEST_CAPABILITY_TAIL`; universal items are inlined here.
 */
const MIDDLE_ITEM_BY_ID: Record<string, NavItem> = {
  media: NAV_MANIFEST_CAPABILITY_TAIL.media[0],
  production: NAV_MANIFEST_CAPABILITY_TAIL.production[0],
  campaigns: UNIVERSAL_CAMPAIGNS,
  talent: UNIVERSAL_TALENT,
  'asset-library': UNIVERSAL_ASSET_LIBRARY,
  crm: UNIVERSAL_CRM,
};

/**
 * Per-brand middle ordering. The ids point into `MIDDLE_ITEM_BY_ID`.
 * Items whose `requiresCapability` isn't declared on the brand are
 * filtered out by `resolveNav` — so the lists below state the
 * intended order rather than the canonical capability set.
 */
const SUBSIDIARY_MIDDLE_ORDER: Record<DeliverySubsidiaryId, string[]> = {
  'labyrinth':       ['production', 'asset-library', 'talent', 'campaigns', 'crm'],
  'zeus-digital':    ['media', 'campaigns', 'talent', 'asset-library', 'production', 'crm'],
  'zeus-the-agency': ['campaigns', 'media', 'production', 'talent', 'asset-library', 'crm'],
  'house-of-zeus':   ['campaigns', 'media', 'production', 'talent', 'asset-library', 'crm'],
  'odd-gorilla':     ['campaigns', 'media', 'production', 'talent', 'asset-library', 'crm'],
};

// ----------------------------------------------------------------------------
// resolveNav
// ----------------------------------------------------------------------------

/**
 * Extended org-kind for `resolveNav`. Same set as Tech-Spec v1.0 plus
 * the `SUBSIDIARY_SELLING` variant introduced by
 * [ADR-2026-05-25 §3.2 step 5](../../../docs/ADR-2026-05-25-commercial-model.md):
 * brand-direct ADs who own client relationships get a hybrid sidebar
 * (delivery head + per-brand middle + commercial tail with brand-scoped
 * Account Mgmt / Pricing / Billing entries).
 */
export type ResolveNavKind = OrganizationKind | 'SUBSIDIARY_SELLING';

/**
 * Commercial entries surfaced to `SUBSIDIARY_SELLING` ADs in their
 * sidebar tail. These point at the same routes the parent-org AMs
 * use; the `BrandAccessGuard` on each route gates the data scope
 * to "clients with primaryBrandId == caller.homeOrgId".
 */
const NAV_MANIFEST_SUBSIDIARY_SELLING_COMMERCIAL: NavItem[] = [
  { moduleId: 'account-management', label: 'My Clients',         icon: 'Briefcase', routePath: '/clients' },
  { moduleId: 'pricing',            label: 'Pricing & Quotes',   icon: 'Tag',       routePath: '/pricing/rate-cards' },
  { moduleId: 'billing',            label: 'Billing & Inter-Co', icon: 'Receipt',   routePath: '/billing/client-invoices' },
];

/**
 * Returns the ordered sidebar items for a given `(orgKind, subsidiaryId)`.
 *
 * - PARENT principals on `zeus-group` get `NAV_MANIFEST_PARENT`.
 * - SUBSIDIARY principals get `HEAD + per-brand middle + TAIL`, with
 *   capability-gated items filtered against `BRAND_CAPABILITIES`.
 * - SUBSIDIARY_SELLING principals (ADR §3.2 step 5) get the same as
 *   SUBSIDIARY plus brand-scoped commercial entries (My Clients,
 *   Pricing, Billing) inserted before the universal tail.
 *
 * Unknown subsidiary ids fall back to an empty list — the caller is
 * expected to combine this with route-level guards.
 */
export function resolveNav(
  orgKind: ResolveNavKind,
  subsidiaryId: SubsidiaryId,
): NavItem[] {
  if (orgKind === 'PARENT' && subsidiaryId === 'zeus-group') {
    return NAV_MANIFEST_PARENT.filter((item) => !item.subsidiaryOnly);
  }

  if (orgKind !== 'SUBSIDIARY' && orgKind !== 'SUBSIDIARY_SELLING') return [];
  if (subsidiaryId === 'zeus-group') return [];

  const subId = subsidiaryId as DeliverySubsidiaryId;
  const middleOrder = SUBSIDIARY_MIDDLE_ORDER[subId];
  if (!middleOrder) return [];

  const brandCaps = BRAND_CAPABILITIES[subId] ?? new Set<Capability>();

  const middle = middleOrder
    .map((id) => MIDDLE_ITEM_BY_ID[id])
    .filter((item): item is NavItem => !!item)
    .filter((item) => !item.parentOrgOnly)
    .filter((item) => {
      if (!item.requiresCapability) return true;
      const required = Array.isArray(item.requiresCapability)
        ? item.requiresCapability
        : [item.requiresCapability];
      return required.some((cap) => brandCaps.has(cap));
    });

  const head = NAV_MANIFEST_SUBSIDIARY_HEAD.filter((item) => !item.parentOrgOnly);
  const tail = NAV_MANIFEST_SUBSIDIARY_TAIL.filter((item) => !item.parentOrgOnly);

  // ADR-2026-05-25 §3.2 step 5 — brand-direct ADs see brand-scoped
  // commercial entries before the universal tail. The routes go to
  // the same paths as the parent-org sidebar; BrandAccessGuard on
  // each route narrows the data to "clients where primaryBrandId
  // matches the caller's homeOrgId".
  if (orgKind === 'SUBSIDIARY_SELLING') {
    return [...head, ...middle, ...NAV_MANIFEST_SUBSIDIARY_SELLING_COMMERCIAL, ...tail];
  }

  return [...head, ...middle, ...tail];
}

// ----------------------------------------------------------------------------
// Convenience flag for the org-switcher chip + inbox banner.
// ----------------------------------------------------------------------------

export { isConflictIsolated };

// ----------------------------------------------------------------------------
// Legacy NavItem adapter
// ----------------------------------------------------------------------------
//
// The AppShell renderer still consumes the legacy NavItem shape from
// `src/config/navigation.unified.ts` (children, badge, description,
// keywords). To avoid a renderer rewrite in this PR we adapt each
// manifest item into the legacy shape — reusing the legacy entry
// when one exists (preserving child dropdowns), and synthesising a
// flat one otherwise (for net-new items like `traffic`, `ecd-review`,
// `conflict-firewall`, `burn-sla`).

interface LegacyNavItemLike {
  id: string;
  label: string;
  href: string;
  icon: string;
  description?: string;
  module?: string;
  roles?: string[];
  children?: LegacyNavItemLike[];
  badge?: number | string;
  keywords?: string[];
  shortcut?: string;
}

/**
 * Manifest moduleId → legacy NavItem id. Manifest ids that have no
 * legacy match fall through to the synthetic shape (id + href + icon
 * only).
 */
export const MANIFEST_TO_LEGACY_ID: Record<string, string> = {
  'account-management': 'clients',
  'billing': 'billing',
  'crm': 'crm',
  'talent': 'talent',
  'procurement': 'procurement',
  'pricing': 'pricing',
  'media': 'media',
  'production': 'production',
  'delivery-inbox': 'delivery-inbox',
  'admin': 'admin',
};

/**
 * Adapt a manifest NavItem into a legacy NavItem-shaped object the
 * existing AppShell renderer understands. If a legacy entry exists
 * for the manifest's moduleId (via `MANIFEST_TO_LEGACY_ID`), we reuse
 * it — preserving any child dropdowns and the original icon — but
 * overlay the manifest's label and routePath. Otherwise we
 * synthesise a flat legacy-shaped item.
 */
export function adaptManifestToLegacyNavItem<T extends LegacyNavItemLike>(
  item: NavItem,
  legacyLookup: Map<string, T>,
): T {
  const legacyId = MANIFEST_TO_LEGACY_ID[item.moduleId] ?? item.moduleId;
  const legacy = legacyLookup.get(legacyId);
  if (legacy) {
    return { ...legacy, label: item.label, href: item.routePath };
  }
  return {
    id: item.moduleId,
    label: item.label,
    href: item.routePath,
    icon: item.icon ?? 'Circle',
  } as T;
}

