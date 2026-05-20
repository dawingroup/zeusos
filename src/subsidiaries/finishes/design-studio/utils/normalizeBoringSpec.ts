/**
 * normalizeBoringSpec — reads Firestore `boringSpec` data (which may
 * be one of several legacy ad-hoc shapes) and returns the canonical
 * `CNCBoringSpec`, or `undefined` if the input is empty / unrecognisable.
 *
 * Legacy shapes handled:
 *   1. `{ targets: [{ inventoryItemId, label, quantity }] }`
 *   2. `{ hardware: [{ inventoryItemId, label, quantity }] }`
 *   3. `{ holes: [{ hardwareId, description, diameter, depth, ... }] }`
 *   4. `{ diameter, depth, offsetFromEdge, pattern }` (old BoringSpec)
 *   5. Already-canonical `CNCBoringSpec { holes: BoringHole[] }`
 */

import type {
  CNCBoringSpec,
  BoringHole,
  BoringFace,
  HardwareBoringTarget,
} from '../types/mdp.types';

type LooseObj = Record<string, unknown>;

/** Convert any legacy or canonical boringSpec payload to `CNCBoringSpec`. */
export function normalizeBoringSpec(raw: unknown): CNCBoringSpec | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const spec = raw as LooseObj;

  // Already canonical? Quick check: holes is an array of objects with `face`.
  if (Array.isArray(spec.holes) && spec.holes.length > 0
      && typeof (spec.holes[0] as LooseObj)?.face === 'string') {
    return {
      holes: spec.holes as BoringHole[],
      targets: normalizeTargets(spec.targets),
    };
  }

  const holes: BoringHole[] = [];
  const targets: HardwareBoringTarget[] = [];

  // Shape 4: single-hole BoringSpec { diameter, depth, offsetFromEdge, pattern }
  if (typeof spec.diameter === 'number' && typeof spec.depth === 'number') {
    const face: BoringFace = 'top'; // sensible default — we don't know which face
    if (spec.pattern === 'line_32mm' && typeof spec.offsetFromEdge === 'number') {
      // 32mm system: generate holes at 32mm spacing from offset
      const offset = spec.offsetFromEdge as number;
      for (let i = 0; i < 10; i++) {
        const y = offset + i * 32;
        if (y > 2400) break; // safety cap
        holes.push({
          face,
          x: 0,
          y,
          diameter: spec.diameter as number,
          depth: spec.depth as number,
        });
      }
    } else if (Array.isArray(spec.positions)) {
      for (const pos of spec.positions) {
        if (typeof pos === 'number') {
          holes.push({
            face,
            x: 0,
            y: pos,
            diameter: spec.diameter as number,
            depth: spec.depth as number,
          });
        }
      }
    } else {
      // Single hole
      holes.push({
        face,
        x: 0,
        y: typeof spec.offsetFromEdge === 'number' ? spec.offsetFromEdge as number : 0,
        diameter: spec.diameter as number,
        depth: spec.depth as number,
      });
    }
  }

  // Shape 1 & 2: targets / hardware arrays with inventory refs
  const targetArrays = [spec.targets, spec.hardware].filter(Array.isArray);
  for (const arr of targetArrays) {
    for (const item of arr as LooseObj[]) {
      if (!item || typeof item !== 'object') continue;
      const inventoryItemId =
        (typeof item.inventoryItemId === 'string' ? item.inventoryItemId : undefined)
        ?? (typeof item.hardwareId === 'string' ? item.hardwareId : undefined)
        ?? (typeof item.itemId === 'string' ? item.itemId : undefined);
      const label =
        (typeof item.label === 'string' ? item.label : undefined)
        ?? (typeof item.description === 'string' ? item.description : undefined)
        ?? (typeof item.name === 'string' ? item.name : undefined);
      const quantity = typeof item.quantity === 'number' ? item.quantity
        : typeof item.qty === 'number' ? item.qty
        : 1;
      targets.push({ inventoryItemId, label, quantity });
    }
  }

  // Shape 3: holes array with legacy hole objects (no `face`)
  if (Array.isArray(spec.holes)) {
    for (const h of spec.holes as LooseObj[]) {
      if (!h || typeof h !== 'object') continue;
      // Legacy hole may have { hardwareId, description, diameter, depth, x, y }
      if (typeof h.diameter === 'number') {
        holes.push({
          face: (typeof h.face === 'string' ? h.face : 'top') as BoringFace,
          x: typeof h.x === 'number' ? h.x : 0,
          y: typeof h.y === 'number' ? h.y : 0,
          diameter: h.diameter as number,
          depth: typeof h.depth === 'number' ? h.depth as number : 10,
          through: typeof h.through === 'boolean' ? h.through : undefined,
        });
      }
      // If the legacy hole also has an inventoryItemId, add as target
      const hId = (typeof h.hardwareId === 'string' && h.hardwareId)
        || (typeof h.inventoryItemId === 'string' && h.inventoryItemId)
        || (typeof h.itemId === 'string' && h.itemId);
      if (hId) {
        const existing = targets.find(t => t.inventoryItemId === hId);
        if (!existing) {
          targets.push({
            inventoryItemId: hId,
            label: typeof h.description === 'string' ? h.description : hId,
            quantity: typeof h.quantity === 'number' ? h.quantity : 1,
          });
        }
      }
    }
  }

  if (holes.length === 0 && targets.length === 0) return undefined;
  return {
    holes,
    targets: targets.length > 0 ? targets : undefined,
  };
}

function normalizeTargets(raw: unknown): HardwareBoringTarget[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw
    .filter((t): t is LooseObj => !!t && typeof t === 'object')
    .map(t => ({
      inventoryItemId: typeof t.inventoryItemId === 'string' ? t.inventoryItemId : undefined,
      label: typeof t.label === 'string' ? t.label : undefined,
      quantity: typeof t.quantity === 'number' ? t.quantity : 1,
    }));
}
