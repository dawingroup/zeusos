/**
 * useArchetype — Fetch a product archetype with resolved components and hardware
 */
import { useQuery } from '@tanstack/react-query';
import {
  getEntry,
  getComponentsForPattern,
  getHardwareForComponent,
} from '../services/knowledgeBase.service';
import type { ProductArchetypeEntry, ComponentEntry, HardwareSpecEntry } from '../types/knowledgeBase.types';

interface ResolvedArchetype {
  archetype: ProductArchetypeEntry;
  components: ComponentEntry[];
  hardware: HardwareSpecEntry[];
}

const ARCHETYPE_KEYS = {
  detail: (id: string) => ['archetype', id] as const,
  resolved: (id: string) => ['archetype', id, 'resolved'] as const,
};

/**
 * Fetch an archetype by ID and resolve its linked components + hardware specs.
 */
export function useArchetype(archetypeId: string | undefined) {
  return useQuery<ResolvedArchetype | null>({
    queryKey: ARCHETYPE_KEYS.resolved(archetypeId || ''),
    queryFn: async (): Promise<ResolvedArchetype | null> => {
      if (!archetypeId) return null;

      const entry = await getEntry(archetypeId);
      if (!entry || entry.entryType !== 'product_archetype') return null;

      const archetype = entry as ProductArchetypeEntry;

      // Resolve components from assembly pattern
      const components = archetype.assemblyPatternId
        ? await getComponentsForPattern(archetype.assemblyPatternId)
        : [];

      // Resolve hardware for each component
      const allHardware: HardwareSpecEntry[] = [];
      for (const comp of components) {
        const hw = await getHardwareForComponent(comp.id);
        for (const h of hw) {
          if (!allHardware.some(existing => existing.id === h.id)) {
            allHardware.push(h);
          }
        }
      }

      return { archetype, components, hardware: allHardware };
    },
    enabled: !!archetypeId,
  });
}
