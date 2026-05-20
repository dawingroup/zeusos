/**
 * Design Knowledge Base Service — Runtime API
 *
 * Provides the runtime API for consuming DKB data from Firestore (serving layer).
 * Wiki authoring and compilation are handled by the compiler tool (compile-dkb.ts).
 */
import {
  collection, doc, getDoc, getDocs,
  query, where, orderBy, limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type {
  DKBEntry,
  ComponentEntry,
  AssemblyPatternEntry,
  HardwareSpecEntry,
  MaterialRuleEntry,
  ProductArchetypeEntry,
  DimensionalStandardEntry,
} from '../types/knowledgeBase.types';
import type { DKBEntryType } from '../constants/knowledgeBase.constants';

const COLLECTION = 'designKnowledgeBase';

/**
 * Fetch a single DKB entry by ID with type discrimination.
 */
export async function getEntry(entryId: string): Promise<DKBEntry | null> {
  const snap = await getDoc(doc(db, COLLECTION, entryId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as DKBEntry;
}

/**
 * Search DKB entries by text query across name, description, and tags.
 */
export async function searchEntries(
  searchQuery: string,
  entryType?: DKBEntryType,
  maxResults = 20,
): Promise<DKBEntry[]> {
  // Mixed Firestore constraints — type as QueryConstraint to allow where + orderBy + limit together
  const constraints: import('firebase/firestore').QueryConstraint[] = [where('isActive', '==', true)];
  if (entryType) constraints.push(where('entryType', '==', entryType));
  constraints.push(orderBy('name'));
  constraints.push(firestoreLimit(100)); // Fetch more, filter client-side

  const q = query(collection(db, COLLECTION), ...constraints);
  const snap = await getDocs(q);

  const lowerQuery = searchQuery.toLowerCase();
  const results = snap.docs
    .map(d => ({ id: d.id, ...d.data() } as DKBEntry))
    .filter(entry =>
      entry.name.toLowerCase().includes(lowerQuery) ||
      entry.description.toLowerCase().includes(lowerQuery) ||
      entry.tags.some(t => t.toLowerCase().includes(lowerQuery))
    )
    .slice(0, maxResults);

  return results;
}

/**
 * Semantic search for product archetype matching a description.
 * Uses DawinOS memory store with DKB tags for similarity matching.
 */
export async function getArchetypeForProduct(
  description: string,
): Promise<ProductArchetypeEntry | null> {
  // First try direct Firestore search
  const archetypes = await searchEntries(description, 'product_archetype', 5);
  if (archetypes.length > 0) {
    return archetypes[0] as ProductArchetypeEntry;
  }

  // Fallback: search by individual terms
  const terms = description.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  for (const term of terms) {
    const results = await searchEntries(term, 'product_archetype', 3);
    if (results.length > 0) {
      return results[0] as ProductArchetypeEntry;
    }
  }

  return null;
}

/**
 * Enrich a Tripo AI prompt with archetype context and dimensional standards.
 */
export async function enrichTripoPrompt(
  userDescription: string,
  overallDimensions?: { width: number; depth: number; height: number },
): Promise<string> {
  const archetype = await getArchetypeForProduct(userDescription);

  const parts: string[] = [userDescription];

  if (archetype) {
    parts.push(`\n[Design Context from ${archetype.name}]`);
    parts.push(archetype.aiPromptContext);

    if (!overallDimensions) {
      const dims = archetype.standardDimensions;
      parts.push(
        `Standard dimensions: ${dims.width.default}mm W x ${dims.depth.default}mm D x ${dims.height.default}mm H`
      );
    }

    if (archetype.defaultFinishCategory) {
      parts.push(`Typical finish: ${archetype.defaultFinishCategory}`);
    }
  }

  if (overallDimensions) {
    parts.push(
      `Target dimensions: ${overallDimensions.width}mm W x ${overallDimensions.depth}mm D x ${overallDimensions.height}mm H`
    );
  }

  // Fetch relevant dimensional standards
  const standards = await getDimensionalStandards();
  if (standards.length > 0) {
    const relevantStandards = standards
      .filter(s =>
        s.tags.some(t => userDescription.toLowerCase().includes(t.toLowerCase()))
      )
      .slice(0, 2);

    if (relevantStandards.length > 0) {
      parts.push('\n[Dimensional Standards]');
      for (const std of relevantStandards) {
        const vals = Object.entries(std.values)
          .map(([k, v]) => `${k}: ${v}mm`)
          .join(', ');
        parts.push(`${std.standardName}: ${vals}`);
      }
    }
  }

  return parts.join('\n');
}

/**
 * Get all components referenced by an assembly pattern.
 */
export async function getComponentsForPattern(
  patternId: string,
): Promise<ComponentEntry[]> {
  const pattern = await getEntry(patternId);
  if (!pattern || pattern.entryType !== 'assembly_pattern') return [];

  const assemblyPattern = pattern as AssemblyPatternEntry;
  const components: ComponentEntry[] = [];

  for (const pc of assemblyPattern.components) {
    const comp = await getEntry(pc.componentEntryId);
    if (comp && comp.entryType === 'component') {
      components.push(comp as ComponentEntry);
    }
  }

  return components;
}

/**
 * Get hardware specs for a component's hardware requirements.
 */
export async function getHardwareForComponent(
  componentId: string,
): Promise<HardwareSpecEntry[]> {
  const component = await getEntry(componentId);
  if (!component || component.entryType !== 'component') return [];

  const comp = component as ComponentEntry;
  const q = query(
    collection(db, COLLECTION),
    where('entryType', '==', 'hardware_spec'),
    where('isActive', '==', true),
  );
  const snap = await getDocs(q);
  const allHardware = snap.docs.map(d => ({ id: d.id, ...d.data() } as HardwareSpecEntry));

  // Filter to hardware families referenced by this component
  const neededFamilies = comp.hardwareRequirements.map(hr => hr.hardwareFamily);
  return allHardware.filter(hw => neededFamilies.includes(hw.hardwareFamily));
}

/**
 * Get material compatibility rules for a finish + substrate combination.
 */
export async function getMaterialRules(
  finishCategory: string,
  substrateCategory: string,
): Promise<MaterialRuleEntry[]> {
  const q = query(
    collection(db, COLLECTION),
    where('entryType', '==', 'material_rule'),
    where('isActive', '==', true),
  );
  const snap = await getDocs(q);
  const allRules = snap.docs.map(d => ({ id: d.id, ...d.data() } as MaterialRuleEntry));

  return allRules.filter(rule =>
    rule.compatiblePairs.some(p =>
      (p.a === finishCategory && p.b === substrateCategory) ||
      (p.a === substrateCategory && p.b === finishCategory)
    ) ||
    rule.incompatiblePairs.some(p =>
      (p.a === finishCategory && p.b === substrateCategory) ||
      (p.a === substrateCategory && p.b === finishCategory)
    )
  );
}

/**
 * Get wiki article content for display in the KB browser.
 */
export async function getWikiArticleContent(
  articlePath: string,
): Promise<string | null> {
  // Wiki content is stored in Firebase Storage when uploaded from git
  try {
    const { getStorage, ref, getDownloadURL } = await import('firebase/storage');
    const storage = getStorage();
    const fileRef = ref(storage, `design-kb/${articlePath}`);
    const url = await getDownloadURL(fileRef);
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

/**
 * Fetch all dimensional standards.
 */
async function getDimensionalStandards(): Promise<DimensionalStandardEntry[]> {
  const q = query(
    collection(db, COLLECTION),
    where('entryType', '==', 'dimensional_standard'),
    where('isActive', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DimensionalStandardEntry));
}
