/**
 * furnitureDomains — the layer of context that turns "one more archetype"
 * into "AI actually knows what this thing is".
 *
 * Why: today the AI grouper gets a `archetypeKey` (string) + an
 * `archetypeContext` (list of expected assembly types). For a kitchen
 * that's enough because the model has seen thousands of kitchens; for
 * a pharmacy dispensary it isn't. The domain layer adds:
 *
 *   - **FurnitureDomain** — a coarse grouping (kitchen / workspace /
 *     retail / pharmacy / storage / display). Lets us author a prompt
 *     paragraph once per domain and reuse it across archetypes.
 *
 *   - **Archetype definition** — per-archetype structural hints the AI
 *     can reason over: typical dimensions, distinctive assemblies,
 *     common mesh-name tokens, parts that are easy to miss
 *     (cover panels, cable trays, modesty boards).
 *
 *   - **Mesh-name token → PartCategory table** — domain-aware lookup.
 *     "cover" on a desk → cover_panel; "shelf" in a pharmacy →
 *     display_shelf_pack's shelf panel; "upright" in a retail
 *     gondola → upright part, not generic panel.
 *
 * The AI payload carries the domain description verbatim so the Cloud
 * Function prompt can inject it without having to know every domain.
 */
import type { AssemblyTypeEnum, PartCategory } from './assembly.constants';

export const FURNITURE_DOMAINS = [
  'kitchen', 'wardrobe', 'workspace', 'reception',
  'retail', 'pharmacy', 'storage', 'library', 'display',
] as const;
export type FurnitureDomain = (typeof FURNITURE_DOMAINS)[number];

/** Per-archetype structural hints the AI prompt pipes in verbatim. */
export interface ArchetypeDefinition {
  /** Coarse grouping — drives per-domain prompt paragraph. */
  domain: FurnitureDomain;
  /** Human-readable label shown in UI pickers. */
  label: string;
  /** One-sentence description the Cloud Function prompt uses when
   *  telling the AI what kind of furniture it's looking at. */
  description: string;
  /** Ordered list of assemblies the AI should try to produce. Mirrors
   *  `DEFAULT_ASSEMBLY_HIERARCHIES` but typed. */
  expectedAssemblies: readonly AssemblyTypeEnum[];
  /** Part categories especially common in this archetype. Lets the
   *  AI prefer `cover_panel` over generic `panel` when the meshes
   *  are consistent with that hint. */
  expectedPartCategories: readonly PartCategory[];
  /** Ballpark physical envelope, mm. Used as a sanity check only —
   *  the AI is not asked to reject out-of-envelope models, just warned. */
  typicalDimensions?: { width?: [number, number]; depth?: [number, number]; height?: [number, number] };
  /** Cover-panel / facing hints: what mesh names to watch for in this
   *  archetype where the default reading would be "generic panel" but
   *  the truth is a cover / fascia / toe-kick. The heuristic detector
   *  uses this in addition to the global token table below. */
  coverPanelHints?: readonly string[];
}

/**
 * Archetype library. Keyed by the value stored on
 * `SceneCabinet.archetypeId` + echoed in `DEFAULT_ASSEMBLY_HIERARCHIES`.
 * Missing archetypes fall through to the `unknown` entry.
 */
export const ARCHETYPE_LIBRARY: Record<string, ArchetypeDefinition> = {
  // ── Kitchen ────────────────────────────────────────────────────
  kitchen_base: {
    domain: 'kitchen',
    label: 'Kitchen base cabinet',
    description:
      'Floor-standing base cabinet. Has a carcass, optional drawer box stack, ' +
      'one or two doors, a toe-kick plinth, and hardware. Countertop is NOT part ' +
      'of the cabinet itself.',
    expectedAssemblies: ['carcass', 'drawer_box', 'door_assembly', 'plinth_assembly', 'hardware_kit'],
    expectedPartCategories: ['panel', 'edge_band', 'toe_kick', 'hardware', 'fastener'],
    typicalDimensions: { width: [300, 1200], depth: [560, 600], height: [720, 920] },
    coverPanelHints: ['toe_kick', 'kickboard', 'plinth'],
  },
  kitchen_wall: {
    domain: 'kitchen',
    label: 'Kitchen wall cabinet',
    description:
      'Wall-mounted cabinet. Has a carcass, internal shelves, and doors. ' +
      'May have a cornice / pelmet on top.',
    expectedAssemblies: ['carcass', 'door_assembly', 'shelf_pack', 'cornice_run', 'hardware_kit'],
    expectedPartCategories: ['panel', 'edge_band', 'hardware'],
    typicalDimensions: { width: [300, 1200], depth: [300, 380], height: [600, 900] },
    coverPanelHints: ['cornice', 'pelmet', 'light_rail'],
  },

  drawer_unit: {
    domain: 'kitchen',
    label: 'Drawer unit',
    description:
      'Standalone drawer stack. Carcass with a tower of drawers (typically 3–5), ' +
      'visible drawer fronts, runners.',
    expectedAssemblies: ['carcass', 'drawer_box', 'drawer_front', 'hardware_kit'],
    expectedPartCategories: ['panel', 'edge_band', 'hardware', 'fitting'],
    typicalDimensions: { width: [300, 900], depth: [560, 600], height: [720, 920] },
  },

  // ── Wardrobe ──────────────────────────────────────────────────
  wardrobe: {
    domain: 'wardrobe',
    label: 'Wardrobe',
    description:
      'Tall standing wardrobe. Carcass with hanging rail, shelves, optional drawer ' +
      'stack, and doors (hinged or sliding). May have a top cornice and bottom plinth.',
    expectedAssemblies: ['carcass', 'door_assembly', 'shelf_pack', 'drawer_box', 'cornice_run', 'hardware_kit'],
    expectedPartCategories: ['panel', 'edge_band', 'hardware', 'fitting'],
    typicalDimensions: { width: [600, 3000], depth: [550, 650], height: [1800, 2400] },
  },

  // ── Workspace ─────────────────────────────────────────────────
  desk: {
    domain: 'workspace',
    label: 'Desk',
    description:
      'Work desk. Horizontal work surface (the top), modesty panel at the front, ' +
      'optional drawer pedestal, cable tray / grommet. Legs or sides support the ' +
      'top. Cover panels may conceal cable runs or structural joins.',
    expectedAssemblies: ['carcass', 'work_surface', 'modesty_panel', 'drawer_box', 'cable_tray', 'cover_panel_run', 'hardware_kit'],
    expectedPartCategories: ['panel', 'cover_panel', 'edge_band', 'hardware'],
    typicalDimensions: { width: [1000, 2000], depth: [600, 800], height: [720, 760] },
    coverPanelHints: ['cover', 'cable_cover', 'modesty', 'back_panel', 'rear_cover'],
  },
  workstation: {
    domain: 'workspace',
    label: 'Workstation (shared / clustered)',
    description:
      'Multi-user workstation. Like a desk but typically longer with shared cable ' +
      'tray, partial privacy screens, and cover panels hiding shared cable routing ' +
      'between adjacent positions.',
    expectedAssemblies: ['carcass', 'work_surface', 'modesty_panel', 'cable_tray', 'cover_panel_run', 'shelf_pack', 'hardware_kit'],
    expectedPartCategories: ['panel', 'cover_panel', 'edge_band', 'hardware'],
    typicalDimensions: { width: [2400, 6000], depth: [1200, 1600], height: [720, 760] },
    coverPanelHints: ['cover', 'cable_cover', 'modesty', 'screen', 'divider', 'shroud'],
  },

  // ── Reception ─────────────────────────────────────────────────
  reception_counter: {
    domain: 'reception',
    label: 'Reception counter',
    description:
      'Reception / transaction counter. Two-zone: staff-side work surface + client-side ' +
      'front facing panel (often branded). Staff side has carcass + drawers; ' +
      'client side has a continuous fascia / cover panel run. Often a cable tray.',
    expectedAssemblies: ['carcass', 'work_surface', 'counter_front', 'cover_panel_run', 'cable_tray', 'drawer_box', 'hardware_kit'],
    expectedPartCategories: ['panel', 'cover_panel', 'fascia', 'edge_band', 'hardware'],
    typicalDimensions: { width: [1800, 6000], depth: [600, 900], height: [1100, 1200] },
    coverPanelHints: ['fascia', 'front_panel', 'client_side', 'cover', 'reveal', 'apron'],
  },

  // ── Retail ────────────────────────────────────────────────────
  retail_gondola: {
    domain: 'retail',
    label: 'Retail gondola',
    description:
      'Double-sided retail display gondola. Two vertical gable uprights at the ends, ' +
      'a slatwall / pegboard back panel (or two, back to back), adjustable display ' +
      'shelves, a bottom plinth, and cover panels at the ends concealing structural ' +
      'brackets.',
    expectedAssemblies: ['gable_run', 'display_back', 'display_shelf_pack', 'plinth_assembly', 'cover_panel_run', 'hardware_kit'],
    expectedPartCategories: ['upright', 'panel', 'cover_panel', 'display_shelf_pack' as PartCategory, 'hardware'],
    typicalDimensions: { width: [900, 1500], depth: [600, 900], height: [1500, 2400] },
    coverPanelHints: ['end_cap', 'gable_cover', 'cover', 'side_panel', 'valance'],
  },
  wall_display: {
    domain: 'retail',
    label: 'Wall display / slatwall run',
    description:
      'Wall-mounted retail display. Vertical gable uprights anchor horizontal slatwall ' +
      'or pegboard backing; display shelves clip in. Often a top cornice / fascia ' +
      'and cover panels concealing the anchor brackets at each gable end.',
    expectedAssemblies: ['gable_run', 'display_back', 'display_shelf_pack', 'cornice_run', 'cover_panel_run', 'hardware_kit'],
    expectedPartCategories: ['upright', 'panel', 'cover_panel', 'fascia', 'hardware'],
    typicalDimensions: { width: [1200, 6000], depth: [300, 500], height: [1800, 3000] },
    coverPanelHints: ['fascia', 'cornice', 'cover', 'end_cap', 'trim'],
  },
  display_case: {
    domain: 'display',
    label: 'Display case / showcase',
    description:
      'Glass-fronted display case. Carcass with lockable glass doors, internal ' +
      'adjustable shelves (often glass), LED strip recesses in the cornice.',
    expectedAssemblies: ['carcass', 'door_assembly', 'display_shelf_pack', 'cornice_run', 'hardware_kit'],
    expectedPartCategories: ['panel', 'edge_band', 'hardware', 'fitting'],
    typicalDimensions: { width: [600, 2000], depth: [400, 600], height: [1500, 2400] },
  },

  // ── Pharmacy ──────────────────────────────────────────────────
  pharmacy_shelving: {
    domain: 'pharmacy',
    label: 'Pharmacy dispensary shelving',
    description:
      'Tall dispensary shelving. Uprights + adjustable shelves every 50–100mm, often ' +
      'a security roller grille or lockable sliding doors overnight, cover panels at the ' +
      'gable ends and along the base plinth. Very dense shelving (regulatory reasons).',
    expectedAssemblies: ['gable_run', 'display_shelf_pack', 'security_grille', 'cover_panel_run', 'plinth_assembly', 'hardware_kit'],
    expectedPartCategories: ['upright', 'panel', 'cover_panel', 'hardware', 'fitting'],
    typicalDimensions: { width: [600, 1200], depth: [300, 500], height: [1800, 2400] },
    coverPanelHints: ['cover', 'gable_cover', 'end_cap', 'kickboard', 'toe_kick'],
  },
  dispensary_back_bar: {
    domain: 'pharmacy',
    label: 'Dispensary back bar',
    description:
      'Counter-high back-bar storage behind the dispensary counter. Carcass with a ' +
      'mix of drawers, doors, and open display-shelf bays, often with a security ' +
      'grille that drops overnight.',
    expectedAssemblies: ['carcass', 'display_shelf_pack', 'drawer_box', 'door_assembly', 'security_grille', 'hardware_kit'],
    expectedPartCategories: ['panel', 'edge_band', 'hardware', 'fitting'],
    typicalDimensions: { width: [1800, 6000], depth: [400, 600], height: [900, 1100] },
  },

  // ── Library / storage ─────────────────────────────────────────
  bookshelf: {
    domain: 'library',
    label: 'Bookshelf / bookcase',
    description:
      'Open-fronted bookcase frame with fixed / adjustable shelves.',
    expectedAssemblies: ['bookcase_frame', 'shelf_pack', 'plinth_assembly', 'hardware_kit'],
    expectedPartCategories: ['panel', 'edge_band', 'hardware'],
    typicalDimensions: { width: [600, 1200], depth: [250, 400], height: [1000, 2400] },
  },
  storage_wall: {
    domain: 'storage',
    label: 'Storage wall',
    description:
      'Floor-to-ceiling storage system. Mix of doors, drawers, open shelves, and ' +
      'cover panels concealing structural joins between bays.',
    expectedAssemblies: ['carcass', 'door_assembly', 'shelf_pack', 'drawer_box', 'cover_panel_run', 'hardware_kit'],
    expectedPartCategories: ['panel', 'cover_panel', 'edge_band', 'hardware'],
    typicalDimensions: { width: [1200, 6000], depth: [400, 600], height: [2100, 2700] },
    coverPanelHints: ['cover', 'filler', 'infill', 'end_cap'],
  },
};

/**
 * Fallback used when the archetypeKey isn't in the library. Tells
 * the AI it's "something generic" and lists every assembly type so
 * it can pick the right ones rather than being constrained.
 */
export const UNKNOWN_ARCHETYPE: ArchetypeDefinition = {
  domain: 'storage',
  label: 'Unknown furniture',
  description:
    'Furniture item of unspecified type. Infer structure from mesh geometry + names. ' +
    'Look for the full range of assembly types.',
  expectedAssemblies: [
    'carcass', 'drawer_box', 'door_assembly', 'shelf_pack', 'work_surface',
    'cover_panel_run', 'hardware_kit',
  ],
  expectedPartCategories: ['panel', 'cover_panel', 'edge_band', 'hardware'],
};

export function getArchetypeDefinition(
  archetypeKey: string | undefined | null,
): ArchetypeDefinition {
  if (!archetypeKey) return UNKNOWN_ARCHETYPE;
  return ARCHETYPE_LIBRARY[archetypeKey] ?? UNKNOWN_ARCHETYPE;
}

/**
 * Collapse the legacy `archetypeId` singular + the new `archetypeIds`
 * array into one canonical list. Dedupes, drops blanks, preserves the
 * primary (archetypeId) as the first entry so prompt paragraphs still
 * see a meaningful "head" archetype.
 */
export function resolveCabinetArchetypes(cabinet: {
  archetypeId?: string;
  archetypeIds?: string[];
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (id: string | undefined | null) => {
    if (!id) return;
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  };
  push(cabinet.archetypeId);
  for (const id of cabinet.archetypeIds ?? []) push(id);
  return out;
}

export interface MergedArchetypeContext {
  /** Primary archetype — drives `domain` + first paragraph.  */
  primary: ArchetypeDefinition;
  /** Every archetype key that resolved cleanly (primary + extras). */
  keys: string[];
  /** Every archetype label — for the UI + AI prompt to name them. */
  labels: string[];
  /** Set of domains covered. Most cabinets = 1 domain; cross-domain
   *  fixtures (workstation + retail display) = multiple. */
  domains: FurnitureDomain[];
  /** Union of every archetype's expectedAssemblies, deduped. */
  expectedAssemblies: AssemblyTypeEnum[];
  /** Union of every archetype's expectedPartCategories, deduped. */
  expectedPartCategories: PartCategory[];
  /** Union of every archetype's coverPanelHints, deduped. */
  coverPanelHints: string[];
  /** Joined domain prompt paragraphs, newline-separated. */
  domainPrompt: string;
  /** Joined archetype descriptions, newline-separated. */
  archetypeDescription: string;
}

/**
 * Merge every archetype's context into one object the AI payload can
 * ship as-is. When only one archetype is provided (or none), behaves
 * identically to `getArchetypeDefinition` with the merged-view fields
 * just mirroring the single definition.
 */
export function mergeArchetypeContext(keys: string[] | undefined | null): MergedArchetypeContext {
  const resolved = (keys ?? [])
    .map(k => [k, ARCHETYPE_LIBRARY[k]] as const)
    .filter((pair): pair is readonly [string, ArchetypeDefinition] => !!pair[1]);

  // Always have a primary. If none of the keys hit, use UNKNOWN.
  const primary = resolved[0]?.[1] ?? UNKNOWN_ARCHETYPE;

  const labels: string[] = [];
  const domains: FurnitureDomain[] = [];
  const domainSet = new Set<FurnitureDomain>();
  const asmSet = new Set<AssemblyTypeEnum>();
  const partSet = new Set<PartCategory>();
  const hintSet = new Set<string>();
  const descBits: string[] = [];

  const defs = resolved.length > 0 ? resolved.map(([, d]) => d) : [UNKNOWN_ARCHETYPE];

  for (const def of defs) {
    labels.push(def.label);
    if (!domainSet.has(def.domain)) {
      domainSet.add(def.domain);
      domains.push(def.domain);
    }
    for (const a of def.expectedAssemblies) asmSet.add(a);
    for (const c of def.expectedPartCategories) partSet.add(c);
    for (const h of def.coverPanelHints ?? []) hintSet.add(h);
    descBits.push(def.description);
  }

  const domainPrompt = domains.map(d => DOMAIN_PROMPT_HINTS[d]).join('\n\n');

  return {
    primary,
    keys: resolved.map(([k]) => k),
    labels,
    domains,
    expectedAssemblies: Array.from(asmSet),
    expectedPartCategories: Array.from(partSet),
    coverPanelHints: Array.from(hintSet),
    domainPrompt,
    archetypeDescription: descBits.join('\n\n'),
  };
}

/** List every archetype keyed by its canonical id, for UI pickers. */
export function listArchetypes(): Array<{ id: string } & ArchetypeDefinition> {
  return Object.entries(ARCHETYPE_LIBRARY).map(([id, def]) => ({ id, ...def }));
}

// ---------------------------------------------------------------------------
// Per-domain prompt paragraph — injected into the AI system prompt so the
// model gets a consistent description of what the domain implies
// regardless of which archetype within it was picked.
// ---------------------------------------------------------------------------

export const DOMAIN_PROMPT_HINTS: Record<FurnitureDomain, string> = {
  kitchen:
    'Kitchen cabinets: carcass (sides + top + bottom + back), doors, drawers, ' +
    'shelves, toe-kick plinth. Countertop meshes are typically NOT part of the ' +
    'cabinet itself.',
  wardrobe:
    'Wardrobes: tall carcass, hanging rail + fittings, hinged or sliding doors, ' +
    'internal shelves + drawer stack. May have top cornice.',
  workspace:
    'Workspace furniture (desks, workstations): horizontal work surfaces, modesty ' +
    'panels at the front, optional drawer pedestals, cable trays. COVER PANELS are ' +
    'common — they hide cable routing, structural joins, or partition attachments. ' +
    'Meshes named with "cover", "cable_cover", "modesty", "screen", "shroud" are ' +
    'cover panels, not carcass sides.',
  reception:
    'Reception / transaction counters: two-zone design. Staff side has carcass + ' +
    'drawers + work surface. Client side has a tall continuous fascia / cover panel ' +
    '(often branded). The fascia is a distinct cover_panel_run assembly, not part ' +
    'of the carcass.',
  retail:
    'Retail displays (gondolas, wall displays): vertical UPRIGHTS (gables) anchor ' +
    'everything. DISPLAY SHELVES are adjustable and clip into notches. Cover panels ' +
    'at the gable ends conceal mounting brackets. Slatwall / pegboard backing panels ' +
    'are a separate display_back assembly.',
  pharmacy:
    'Pharmacy dispensary fixtures: dense adjustable display shelving, security ' +
    'roller grilles or lockable overlays that drop overnight. Cover panels at gable ' +
    'ends are standard. Base plinth kickboards are visually important.',
  storage:
    'General storage systems: mix of carcasses, doors, drawers, shelves, plus filler ' +
    'and cover panels that conceal structural joins between bays.',
  library:
    'Library / bookcase fixtures: open-fronted frames with fixed or adjustable shelves. ' +
    'Side gables are structural.',
  display:
    'Display cases: glass-fronted lockable carcass with internal (often glass) shelves ' +
    'and cornice LED recesses.',
};

// ---------------------------------------------------------------------------
// Mesh-name token → PartCategory table — domain-aware.
//
// Token matching is substring + lowercase. More specific tokens (longer,
// rarer) come first so they win over generic ones.
// ---------------------------------------------------------------------------

export interface PartCategoryHint {
  tokens: readonly string[];
  category: PartCategory;
  /** When set, hint only applies within these domains — e.g. "upright"
   *  means a structural post in retail/pharmacy but could be anything
   *  in kitchen. */
  domains?: readonly FurnitureDomain[];
}

/**
 * Ordered list — iterate top to bottom. First match wins so COVER /
 * TOE_KICK / FASCIA beat generic PANEL.
 */
export const PART_CATEGORY_HINTS: readonly PartCategoryHint[] = [
  // Cover / facing family — these need to beat generic panel matches.
  {
    tokens: ['toe_kick', 'toekick', 'kickboard', 'kick_board', 'kick_plate', 'plinth_cover'],
    category: 'toe_kick',
  },
  {
    tokens: ['fascia', 'valance', 'light_rail', 'brow_panel'],
    category: 'fascia',
  },
  {
    tokens: [
      'cover', 'cable_cover', 'rear_cover', 'back_cover', 'end_cap',
      'infill', 'filler', 'modesty', 'screen_panel', 'shroud', 'apron',
      'gable_cover', 'client_side',
    ],
    category: 'cover_panel',
  },

  // Linear structural — retail / pharmacy / library.
  {
    tokens: ['upright', 'gable', 'standard_post', 'gondola_post', 'standard_upright'],
    category: 'upright',
    domains: ['retail', 'pharmacy', 'library', 'display'],
  },
  {
    tokens: ['stretcher', 'apron_rail', 'cross_rail'],
    category: 'stretcher',
  },

  // Hardware / fitting family (tokens borrowed from existing heuristic
  // so both detectors see the same picture).
  {
    tokens: ['hinge', 'handle', 'runner', 'slide', 'cam_lock', 'dowel', 'bracket', 'leg_level'],
    category: 'hardware',
  },
  {
    tokens: ['screw', 'bolt', 'dowel', 'staple'],
    category: 'fastener',
  },
  {
    tokens: ['rail_hanging', 'basket', 'wire_shelf', 'pull_out'],
    category: 'fitting',
  },
  {
    tokens: ['edge_band', 'edging', 'abs_strip'],
    category: 'edge_band',
  },
];

/**
 * Resolve a mesh name + domain to the most specific PartCategory. Returns
 * `'panel'` when no hint matches — matches the existing heuristic's
 * default so callers can treat the return as the authoritative category.
 */
export function detectPartCategoryFromName(
  meshName: string | undefined | null,
  domain: FurnitureDomain = 'storage',
): PartCategory {
  if (!meshName) return 'panel';
  const lower = meshName.toLowerCase();
  for (const hint of PART_CATEGORY_HINTS) {
    if (hint.domains && !hint.domains.includes(domain)) continue;
    for (const t of hint.tokens) {
      if (lower.includes(t)) return hint.category;
    }
  }
  return 'panel';
}
