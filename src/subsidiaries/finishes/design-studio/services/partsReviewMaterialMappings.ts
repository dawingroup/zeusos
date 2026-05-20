import type { MaterialMappingLite, ModelPackage } from '../types/modelPackage.types';
import { getModelPackage } from './modelPackage.service';

type CabinetLike = { id: string };

type GetModelPackageFn = (
  sceneId: string,
  cabinetId: string,
) => Promise<ModelPackage | null>;

const inFlightByKey = new Map<string, Promise<MaterialMappingLite[]>>();

function buildLoadKey(sceneId: string, cabinets: ReadonlyArray<CabinetLike>): string {
  return `${sceneId}::${cabinets.map(c => c.id).join('|')}`;
}

/**
 * Load persisted material mappings for scene cabinets and deduplicate by
 * 3DS material name, keeping the highest-confidence mapping per key.
 */
export async function loadPartsReviewMaterialMappings(
  sceneId: string,
  cabinets: ReadonlyArray<CabinetLike>,
  getPackage: GetModelPackageFn = getModelPackage,
): Promise<MaterialMappingLite[]> {
  const key = buildLoadKey(sceneId, cabinets);
  const hit = inFlightByKey.get(key);
  if (hit) return hit;

  const pending = (async () => {
    const dedup = new Map<string, MaterialMappingLite>();

    const results = await Promise.allSettled(
      cabinets.map(cab => getPackage(sceneId, cab.id)),
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') {
        // A cabinet might not have a model package yet; ignore and continue.
        continue;
      }
      const pkg: ModelPackage | null = result.value;
      for (const mapping of pkg?.materials?.mappings ?? []) {
        const mapKey = mapping.threeDSName.trim().toLowerCase();
        const prev = dedup.get(mapKey);
        if (!prev || mapping.confidence > prev.confidence) {
          dedup.set(mapKey, mapping);
        }
      }
    }

    return Array.from(dedup.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, mapping]) => mapping);
  })();
  inFlightByKey.set(key, pending);
  try {
    return await pending;
  } finally {
    if (inFlightByKey.get(key) === pending) {
      inFlightByKey.delete(key);
    }
  }
}
