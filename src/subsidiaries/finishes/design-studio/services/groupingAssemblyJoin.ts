/**
 * Reattach flat `grouping.parts` onto `grouping.assemblies` for denormalized
 * storage on `SceneCabinet.assemblies` (and for DM sync hydration).
 */
import type { SceneAssembly, ScenePart } from '../types/assembly.types';

/**
 * modelPackage stores assemblies with `parts: []` and a flat `parts` list
 * with `assemblyId` back-links. Expand to nested `parts` per assembly.
 */
export function joinPartsIntoAssemblies(
  assemblies: SceneAssembly[],
  parts: ScenePart[],
  cabinetId: string,
): SceneAssembly[] {
  if (parts.length === 0) return assemblies;
  const byAssembly = new Map<string, ScenePart[]>();
  for (const p of parts) {
    const key = p.assemblyId || '__unassigned__';
    const bucket = byAssembly.get(key);
    if (bucket) bucket.push(p);
    else byAssembly.set(key, [p]);
  }
  const out: SceneAssembly[] = assemblies.map(a => ({
    ...a,
    parts: byAssembly.get(a.id) ?? [],
  }));
  const unassigned = byAssembly.get('__unassigned__');
  if (unassigned && unassigned.length > 0) {
    out.push({
      id: `${cabinetId}-unassigned`,
      cabinetId,
      assemblyType: 'carcass',
      displayName: 'Unassigned parts',
      parts: unassigned,
      meshNodeIds: unassigned.map(p => p.meshNodeId).filter((m): m is string => !!m),
      boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 }, center: { x: 0, y: 0, z: 0 }, size: { x: 0, y: 0, z: 0 } },
      jointSpec: [],
      assemblySequence: [],
      isComplete: false,
      totalPartCount: unassigned.length,
      totalArea: 0,
      totalCost: 0,
      sequence: out.length,
    } as unknown as SceneAssembly);
  }
  return out;
}
