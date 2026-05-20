/**
 * Batches {@link ScenePart}s within one assembly through {@link nameAssemblyParts} so
 * part codes and compact names match Design Manager + Shop Traveler (peer buckets,
 * sequences). Used by `scenePartsToDesignManager` and `partsQualityHelper` so they stay
 * aligned.
 */
import type { ScenePart } from '../types/assembly.types';
import type { PartCategory } from '../constants/assembly.constants';
import type { PartRole } from '../types/workshop-viewer.types';
import {
  inferDrawerPeerBucket,
  inferPositionFromPartLabels,
  inferRoleFromCategory,
  inferRoleFromPartLabels,
  nameAssemblyParts,
  type AssemblyPartForNaming,
  type CanonicalNameResult,
} from './partNamingService';

/**
 * Full naming for every part in a single assembly: sequences shelves, sides, drawer
 * columns (PolyBoard Drawer_1 / Drawer_2), and emits stable part codes.
 */
export function nameSceneAssemblyParts(
  parts: ScenePart[],
  cabinetCode?: string,
  assemblyCode?: string,
): Map<string, CanonicalNameResult> {
  const forNaming: AssemblyPartForNaming[] = parts.map((p, i) => {
    const fromLabelRole = inferRoleFromPartLabels(p.partName, p.partCode);
    const fromLabelPos = inferPositionFromPartLabels(p.partName, p.partCode);
    const role = (p.role ?? fromLabelRole ?? inferRoleFromCategory(p.partCategory as PartCategory)) as PartRole;
    const position = p.relativePosition ?? fromLabelPos;
    const peerBucket =
      (role === 'drawer' || role === 'drawer_component')
        ? inferDrawerPeerBucket(p.partName, p.partCode)
        : undefined;
    return {
      partId: p.id,
      role,
      position: position ?? undefined,
      peerBucket,
      sortZ: 1000 - i,
      sortX: i,
    };
  });
  return nameAssemblyParts(forNaming, cabinetCode, assemblyCode);
}
