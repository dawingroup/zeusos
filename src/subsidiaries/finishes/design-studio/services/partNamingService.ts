/**
 * partNamingService — Canonical part naming + coding for the entire pipeline.
 *
 * The system currently has five independent name sources (raw mesh, AI,
 * knowledge-base, quality-helper, CSV) that each invent names ad-hoc.
 * This service centralises the logic so every surface — drawings, cutlists,
 * procurement, Design Manager PartsTab — sees the same consistent label.
 *
 * Two outputs per part:
 *
 *   1. `displayName`  — human-readable, drawing-grade name.
 *      Pattern: "{Position} {Role Label}" or "{KB Prefix} {Sequence}"
 *      Examples: "Left Side Panel", "Fixed Shelf 2", "Back Panel"
 *
 *   2. `partCode`     — compact, sortable, unique-within-cabinet identifier.
 *      Pattern: "{cabinetCode}-{assemblyCode}-{roleAbbrev}{sequence}"
 *      Examples: "KBU1-CARC-SP01", "KBU1-DRW1-DF01", "KBU1-CARC-SH02"
 *
 * Both are deterministic given the same input. Callers should invoke
 * `canonicalName()` at authoring time (AI recognition, KB matching,
 * CSV import) and persist the result on ScenePart.partName / .partCode.
 *
 * The naming service also exposes `canonicalPartCode()` separately for
 * contexts where only the code is needed (dedup, drawing labels).
 *
 * Kept pure — no Firestore, no network calls, unit-testable.
 */

import type { PartRole } from '../types/workshop-viewer.types';
import type { RelativePosition } from '../types/ai-recognition.types';
import type { NamingPatterns } from '../types/furniture-type.types';
import type { PartCategory } from '../constants/assembly.constants';

// ---------------------------------------------------------------------------
// Role → human-readable label map
// ---------------------------------------------------------------------------

/** Drawing-grade labels per role — singular form. Position prefix is
 *  prepended separately so "side" → "Side Panel", not "Left Side Panel"
 *  (the position qualifier handles that). */
const ROLE_LABELS: Record<PartRole, string> = {
  side:               'Side Panel',
  top_bottom:         'Panel',       // position prefix supplies "Top" or "Bottom"
  vertical_division:  'Vertical Division',
  shelf:              'Fixed Shelf',
  mobile_shelf:       'Adjustable Shelf',
  back:               'Back Panel',
  door:               'Door',
  drawer:             'Drawer Front',
  drawer_component:   'Drawer Component',
  bar:                'Bar',
  rail:               'Rail',
  stile:              'Stile',
  panel:              'Panel',
  muntin:             'Muntin',
  counter_front:      'Counter Front',
  cover:              'Cover Panel',
  plinth:             'Plinth',
  /** Avoid generic "Part" in drawings — use millwork/assembly context; position/sequence disambiguate. */
  other:              'Millwork',
};

// ---------------------------------------------------------------------------
// Role → two/three-character abbreviation for part codes
// ---------------------------------------------------------------------------

const ROLE_ABBREVIATIONS: Record<PartRole, string> = {
  side:               'SP',
  top_bottom:         'TB',
  vertical_division:  'VD',
  shelf:              'SH',
  mobile_shelf:       'MS',
  back:               'BK',
  door:               'DR',
  drawer:             'DF',
  drawer_component:   'DC',
  bar:                'BR',
  rail:               'RL',
  stile:              'ST',
  panel:              'PN',
  muntin:             'MN',
  counter_front:      'CF',
  cover:              'CV',
  plinth:             'PL',
  other:              'PT',
};

// ---------------------------------------------------------------------------
// Position → human-readable prefix
// ---------------------------------------------------------------------------

const POSITION_LABELS: Record<RelativePosition, string> = {
  left:   'Left',
  right:  'Right',
  top:    'Top',
  bottom: 'Bottom',
  front:  'Front',
  back:   'Back',
  center: '',
};

const POSITION_ABBREVIATIONS: Record<RelativePosition, string> = {
  left:   'L',
  right:  'R',
  top:    'T',
  bottom: 'B',
  front:  'F',
  back:   'K',  // 'K' to avoid collision with 'B' (bottom)
  center: 'C',
};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CanonicalNameInput {
  /** Structural role from AI recognition or rule-based classification. */
  role: PartRole;
  /** Spatial position within the parent assembly. */
  position?: RelativePosition;
  /** 1-based index among peers of the same role within the same assembly.
   *  E.g. if there are 3 shelves, the second one gets sequence=2. */
  sequence?: number;
  /** Total count of peers with the same role in the same assembly.
   *  Controls whether the sequence suffix is emitted (omit for singletons). */
  peerCount?: number;
  /**
   * When drawer fronts are split by {@link AssemblyPartForNaming.peerBucket},
   * each column gets its own 1..n sequence — including a single front as "1".
   */
  drawerSequencedPerBucket?: boolean;
  /**
   * PolyBoard drawer column (e.g. D1, D2). When {@link drawerSequencedPerBucket}
   * is set, the part code includes this to avoid collisions (…-D1-DF01 vs …-D2-DF01).
   */
  peerBucket?: string;
  /** Cabinet code — e.g. "KBU1", "WRD2". Used in partCode generation. */
  cabinetCode?: string;
  /** Assembly code — e.g. "CARC", "DRW1", "DOOR1". */
  assemblyCode?: string;
  /** Optional KB naming patterns — if provided, KB prefixes override
   *  the default role labels for a domain-specific convention. */
  kbPatterns?: NamingPatterns;
}

export interface CanonicalNameResult {
  /** Human-readable drawing-grade display name. */
  displayName: string;
  /** Compact sortable code unique within a cabinet. */
  partCode: string;
  /** Short label for cut lists, DM grid, and Shop Traveler. */
  compactName: string;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Produce both the display name and part code for a part.
 * This is the single canonical entry point that every naming surface
 * (AI recognition, KB matching, CSV import, quality helper, sync-to-DM)
 * should call.
 */
export function canonicalName(input: CanonicalNameInput): CanonicalNameResult {
  return {
    displayName: canonicalDisplayName(input),
    partCode: canonicalPartCode(input),
    compactName: compactPartDisplayName(input),
  };
}

/**
 * Produce a human-readable, drawing-grade display name.
 *
 * Pattern:
 *   - Position prefix (when meaningful + not a singleton)
 *   - Role label (or KB prefix override)
 *   - Sequence number (only when peerCount > 1 and position doesn't
 *     fully disambiguate — e.g. 3 shelves get "Fixed Shelf 1/2/3"
 *     but 2 side panels get "Left Side Panel" / "Right Side Panel")
 *
 * Examples:
 *   - role=side, pos=left                    → "Left Side Panel"
 *   - role=shelf, seq=2, peers=4             → "Fixed Shelf 2"
 *   - role=top_bottom, pos=top               → "Top Panel"
 *   - role=door, peers=1                     → "Door"
 *   - role=door, pos=left, peers=2           → "Left Door"
 *   - role=drawer_component, pos=left        → "Left Drawer Component"
 *   - role=back, peers=1                     → "Back Panel"
 */
export function canonicalDisplayName(input: CanonicalNameInput): string {
  const { role, position, sequence, peerCount, kbPatterns, drawerSequencedPerBucket } = input;

  // 1. Base label — KB prefix wins when provided.
  const kbPrefix = kbPatterns?.prefixes?.[role];
  let base = kbPrefix ?? ROLE_LABELS[role] ?? 'Part';

  // 2. Position prefix — only add when it conveys information.
  //    "Back Panel" already has "Back" in the role label → skip.
  //    "Top Panel" / "Bottom Panel" → the role is "Panel", position adds meaning.
  const posLabel = position ? POSITION_LABELS[position] : '';
  const roleAlreadyCarriesPosition =
    role === 'back' ||
    (role === 'plinth' && position === 'bottom');

  if (posLabel && !roleAlreadyCarriesPosition) {
    // For top_bottom, the position IS the identity — "Top Panel", "Bottom Panel".
    // For sides, position is the qualifier — "Left Side Panel".
    base = `${posLabel} ${base}`;
  }

  // 3. Sequence number — only when more peers exist than positions can
  //    disambiguate. Per-bucket drawer columns always get 1..n within the column.
  const isDrawerCol =
    drawerSequencedPerBucket && (role === 'drawer' || role === 'drawer_component');
  const needsSequence = isDrawerCol
    ? (sequence != null)
    : (peerCount ?? 1) > 2 || ((peerCount ?? 1) > 1 && !posLabel);
  if (needsSequence && sequence != null) {
    base = `${base} ${sequence}`;
  }

  return base.replace(/\s+/g, ' ').trim();
}

/**
 * Short name for cut lists, DM parts grid, and nesting labels — avoids
 * "Left Side Panel" / long PolyBoard text where space is tight.
 */
export function compactPartDisplayName(input: CanonicalNameInput): string {
  const { role, position, sequence, peerCount, drawerSequencedPerBucket } = input;
  const isDrawerCol =
    drawerSequencedPerBucket && (role === 'drawer' || role === 'drawer_component');
  const needSeq = isDrawerCol
    ? (sequence != null)
    : (peerCount ?? 1) > 1 && sequence != null;
  const pos = position && position !== 'center' ? position : undefined;

  if (role === 'side' && pos === 'left') return 'L Side';
  if (role === 'side' && pos === 'right') return 'R Side';
  if (role === 'side' && pos) return `${POSITION_ABBREVIATIONS[pos] ?? 'C'} Side`;
  if (role === 'top_bottom' && pos === 'top') return 'Top';
  if (role === 'top_bottom' && pos === 'bottom') return 'Bot';
  if (role === 'back') return 'Back';
  if (role === 'plinth') return 'Plinth';
  if (role === 'shelf' || role === 'mobile_shelf') {
    return needSeq ? `Sh ${sequence}` : 'Shelf';
  }
  if (role === 'door') {
    if (pos === 'left' || pos === 'right') {
      return needSeq ? `Door ${sequence}` : `${pos === 'left' ? 'L' : 'R'} Door`;
    }
    return needSeq ? `Door ${sequence}` : 'Door';
  }
  if (role === 'drawer' || role === 'drawer_component') {
    return needSeq ? `DF ${sequence}` : 'DF';
  }
  if (role === 'muntin') return needSeq ? `Mun ${sequence}` : 'Muntin';
  if (role === 'vertical_division') return needSeq ? `Div ${sequence}` : 'Div';
  if (role === 'rail' || role === 'stile' || role === 'bar') {
    return needSeq ? `${ROLE_ABBREVIATIONS[role]}${sequence}` : (ROLE_ABBREVIATIONS[role] ?? role);
  }
  if (role === 'panel') {
    return needSeq ? `Pn ${sequence}` : 'Panel';
  }
  if (role === 'counter_front') return 'Ctop';
  if (role === 'cover') {
    if (pos === 'left' || pos === 'right') return `${pos === 'left' ? 'L' : 'R'} Cov`;
    return 'Cov';
  }
  if (role === 'other') {
    return needSeq ? `Mwk ${sequence}` : 'Mwk';
  }
  // Fallback: compress full canonical
  const full = canonicalDisplayName(input);
  return full.length > 24 ? full.slice(0, 21) + '…' : full;
}

/**
 * Group drawer fronts that belong to different drawer *boxes* (PolyBoard
 * "Drawer_1" vs "Drawer_2") so each box gets its own 1..n sequence.
 */
export function inferDrawerPeerBucket(partName: string, partCode: string): string | undefined {
  const raw = `${partName} ${partCode}`;
  const m = raw.match(/Drawer[_\s-]*(\d+)/i) || raw.match(/Tiroir[_\s-]*(\d+)/i);
  if (m) return `D${m[1]}`;
  return undefined;
}

/**
 * Produce a compact, sortable part code.
 *
 * Pattern: {cabinetCode}-{assemblyCode}-{roleAbbrev}{posAbbrev}{seq}
 * Example: "KBU1-CARC-SPL01" (cabinet KBU1, carcass, side panel, left, #01)
 *
 * When cabinetCode / assemblyCode are missing, the code degrades
 * gracefully: "SP01", "CARC-SP01", etc.
 */
export function canonicalPartCode(input: CanonicalNameInput): string {
  const { role, position, sequence, cabinetCode, assemblyCode, peerBucket, drawerSequencedPerBucket } = input;

  const roleAbbr = ROLE_ABBREVIATIONS[role] ?? 'PT';
  const posAbbr = position && position !== 'center'
    ? POSITION_ABBREVIATIONS[position]
    : '';
  const seq = String(sequence ?? 1).padStart(2, '0');

  let code = `${roleAbbr}${posAbbr}${seq}`;

  if (
    drawerSequencedPerBucket &&
    peerBucket &&
    peerBucket !== '__' &&
    (role === 'drawer' || role === 'drawer_component')
  ) {
    code = `${peerBucket}-${code}`;
  }

  const segments: string[] = [];
  if (cabinetCode) segments.push(cabinetCode);
  if (assemblyCode) segments.push(assemblyCode);
  segments.push(code);

  return segments.join('-');
}

// ---------------------------------------------------------------------------
// Sequence assignment helper
// ---------------------------------------------------------------------------

/** Input for batch-naming all parts in a single assembly. */
export interface AssemblyPartForNaming {
  /** Unique part id (for stable output keying). */
  partId: string;
  role: PartRole;
  position?: RelativePosition;
  /**
   * Sub-groups peers when they share a role but belong to different units
   * (e.g. two drawer columns: Drawer_1 vs Drawer_2 in PolyBoard labels).
   */
  peerBucket?: string;
  /** Sort priority — Z-center descending (top-first), then X-center
   *  ascending (left-first). Computed by the geometry engine. */
  sortZ?: number;
  sortX?: number;
}

/**
 * Assign sequences and produce canonical names for every part in an
 * assembly. Groups by role, sorts spatially, and numbers.
 *
 * Returns a Map<partId, CanonicalNameResult> so callers can stamp
 * both displayName and partCode in one pass.
 */
function sortSpatially(group: AssemblyPartForNaming[]): void {
  group.sort((a, b) => {
    const za = a.sortZ ?? 0;
    const zb = b.sortZ ?? 0;
    if (Math.abs(za - zb) > 20) return zb - za;
    return (a.sortX ?? 0) - (b.sortX ?? 0);
  });
}

/**
 * Drawer / drawer_component peers are sequenced per PolyBoard drawer column
 * when {@link AssemblyPartForNaming.peerBucket} is set (e.g. D1 vs D2).
 */
function roleUsesPeerBucket(role: PartRole): boolean {
  return role === 'drawer' || role === 'drawer_component';
}

export function nameAssemblyParts(
  parts: AssemblyPartForNaming[],
  cabinetCode?: string,
  assemblyCode?: string,
  kbPatterns?: NamingPatterns,
): Map<string, CanonicalNameResult> {
  const result = new Map<string, CanonicalNameResult>();

  const byRole = new Map<PartRole, AssemblyPartForNaming[]>();
  for (const p of parts) {
    if (!byRole.has(p.role)) byRole.set(p.role, []);
    byRole.get(p.role)!.push(p);
  }

  for (const [role, roleGroup] of byRole) {
    if (roleUsesPeerBucket(role) && roleGroup.some(p => p.peerBucket)) {
      const byBucket = new Map<string, AssemblyPartForNaming[]>();
      for (const p of roleGroup) {
        const b = p.peerBucket ?? '__';
        if (!byBucket.has(b)) byBucket.set(b, []);
        byBucket.get(b)!.push(p);
      }
      for (const group of byBucket.values()) {
        sortSpatially(group);
        for (let i = 0; i < group.length; i++) {
          const p = group[i];
          result.set(p.partId, canonicalName({
            role,
            position: p.position,
            sequence: i + 1,
            peerCount: group.length,
            drawerSequencedPerBucket: true,
            peerBucket: p.peerBucket,
            cabinetCode,
            assemblyCode,
            kbPatterns,
          }));
        }
      }
    } else {
      const group = [...roleGroup];
      sortSpatially(group);
      for (let i = 0; i < group.length; i++) {
        const p = group[i];
        result.set(p.partId, canonicalName({
          role,
          position: p.position,
          sequence: i + 1,
          peerCount: group.length,
          cabinetCode,
          assemblyCode,
          kbPatterns,
        }));
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Heuristic role / position from labels (PolyBoard cutlists, CSV, mesh)
// ---------------------------------------------------------------------------

/**
 * Best-effort `PartRole` from part name + code when AI did not set `part.role`
 * (common on CSV / PolyBoard text — EN/FR).
 */
export function inferRoleFromPartLabels(partName: string, partCode: string): PartRole | null {
  const raw = `${partName} ${partCode}`.toLowerCase();
  const t = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (/\b(tablette|shelf|shelve|etagere|etager|layer|niveau)\b/i.test(t)) return 'shelf';
  if (/\b(tiroir|drawer\s*front|drawerfront|fa[cç]ade tiroir)\b/i.test(t)) return 'drawer';
  if (/\b(drawer|tir)\b/i.test(t) && !/tablette|shelf|plinthe/i.test(t)) return 'drawer';
  if (/\b(door|hinge|porte|ouvrant|fa[cç]ade(?!\s*ti))\b/i.test(t) && !/tiroir|drawer|tablette|shelf|plinthe|montant|cot/i.test(t)) {
    return 'door';
  }
  if (/\b(fond|back|arriere|dos|dorsal|fond de)\b/i.test(t)) return 'back';
  if (/\b(cot[eé]|côté|montant|gauche|droit|lateral|side|_sp_)\b/i.test(t)) return 'side';
  if (/\b(traverse|tringle|rail|stretcher)\b/i.test(t)) return 'rail';
  if (/\b(muntin|meneau|petit bois)\b/i.test(t)) return 'muntin';
  if (/\b(plinth|plinthe|toe|kick|sockle|zoccol)\b/i.test(t)) return 'plinth';
  if (/\b(separat|divis|clois|partition|colonne|upright)\b/i.test(t)) return 'vertical_division';
  if (/\b(tige|penderie|hanging|oval tube|hanging rail)\b/i.test(t)) return 'bar';
  if (/\b(cover|chant|capping|couvercle)\b/i.test(t)) return 'cover';
  if (/\b(top\s*panel|upper\s*pan|dessus|haut de caisse|top of)\b/i.test(t)) return 'top_bottom';
  if (/\b(bottom\s*pan|base\s*pan|lower\s*deck|sole)\b/i.test(t)) return 'top_bottom';
  if (/\b(counter|plan de travail|worktop|postform)\b/i.test(t)) return 'counter_front';
  return null;
}

/**
 * `RelativePosition` from common label tokens when not persisted.
 */
export function inferPositionFromPartLabels(
  partName: string,
  partCode: string,
): RelativePosition | undefined {
  const t = `${partName} ${partCode}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\b(left|gauche|gch|_l|-l\d)\b/i.test(t)) return 'left';
  if (/\b(right|droit|_r|-r\d)\b/i.test(t)) return 'right';
  if (/\b(top(?!_)|dessus|haut(?!e)|upper)\b/i.test(t) && !/bottom|bas|plinth|toe|kick|tablette|shelf|traverse|tringle/.test(t)) {
    if (/\b(shelf|tablette)\b/.test(t)) return undefined;
    return 'top';
  }
  if (/\b(bottom|bas|lower|infe|battante)\b/i.test(t) && !/\b(dessus|hauts?|upper|top)\b/i.test(t)) {
    return 'bottom';
  }
  if (/\b(front|avant|fa[cç]ade(?!\s*ti))\b/i.test(t) && !/arriere|fond|back\s*pa|dorsal|rear/.test(t) && !/dessus|dessous/.test(t)) {
    return 'front';
  }
  if (/\b(rear|arriere|arrière|dorsal)\b/i.test(t)) return 'back';
  if (/\b(center|centre|middle|milieu|central)\b/i.test(t)) return 'center';
  return undefined;
}

// ---------------------------------------------------------------------------
// Category-to-role fallback
// ---------------------------------------------------------------------------

/** When a ScenePart has a partCategory but no persisted role, infer a
 *  reasonable role. This is the "last resort" fallback for legacy parts
 *  that predate role persistence. */
export function inferRoleFromCategory(category: PartCategory): PartRole {
  const map: Partial<Record<PartCategory, PartRole>> = {
    panel:            'panel',
    edge_band:        'other',
    hardware:         'other',
    fastener:         'other',
    fitting:          'other',
    finish_consumable:'other',
    packaging:        'other',
    cover_panel:      'cover',
    toe_kick:         'plinth',
    fascia:           'cover',
    upright:          'side',
    stretcher:        'rail',
  };
  return map[category] ?? 'other';
}

// ---------------------------------------------------------------------------
// Exports for consumers
// ---------------------------------------------------------------------------

export { ROLE_LABELS, ROLE_ABBREVIATIONS, POSITION_LABELS, POSITION_ABBREVIATIONS };
