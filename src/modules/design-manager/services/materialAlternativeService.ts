/**
 * Material Alternative Service
 * Manages quality-tier material alternatives on the material palette.
 * Enables budget-tier-based quoting with real material cost substitutions.
 */

import {
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  MaterialPalette,
  MaterialAlternativeMapping,
  MaterialQualityTier,
} from '@/shared/types';
import { markEstimateStale } from './estimateService';

/**
 * Map a material alternative for a specific quality tier on a palette entry.
 * The base inventoryId/unitCost remains the standard mapping.
 * Upserts: replaces if same tier exists, appends if new.
 */
export async function mapMaterialAlternative(
  projectId: string,
  paletteEntryId: string,
  alternative: MaterialAlternativeMapping,
  _userId: string
): Promise<void> {
  const projectRef = doc(db, 'designProjects', projectId);
  const projectSnap = await getDoc(projectRef);

  if (!projectSnap.exists()) {
    throw new Error(`Project ${projectId} not found`);
  }

  const data = projectSnap.data();
  const palette: MaterialPalette = data.materialPalette || { entries: [], unmappedCount: 0, mappedCount: 0 };

  const entryIndex = palette.entries.findIndex(e => e.id === paletteEntryId);
  if (entryIndex === -1) {
    throw new Error(`Palette entry ${paletteEntryId} not found`);
  }

  const entry = palette.entries[entryIndex];

  // Initialize alternatives array if not present
  const alternatives = entry.alternatives || [];

  // Upsert: replace if same tier exists
  const existingIndex = alternatives.findIndex(a => a.qualityTier === alternative.qualityTier);
  if (existingIndex >= 0) {
    alternatives[existingIndex] = alternative;
  } else {
    alternatives.push(alternative);
  }

  // Update palette entry
  palette.entries[entryIndex] = {
    ...entry,
    alternatives,
    updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any,
  };

  await updateDoc(projectRef, {
    materialPalette: palette,
  });

  // Invalidate estimation since costs have changed
  await markEstimateStale(projectId, 'Material alternative mapping changed');
}

/**
 * Remove a material alternative mapping for a specific tier.
 */
export async function removeMaterialAlternative(
  projectId: string,
  paletteEntryId: string,
  qualityTier: MaterialQualityTier
): Promise<void> {
  const projectRef = doc(db, 'designProjects', projectId);
  const projectSnap = await getDoc(projectRef);

  if (!projectSnap.exists()) {
    throw new Error(`Project ${projectId} not found`);
  }

  const data = projectSnap.data();
  const palette: MaterialPalette = data.materialPalette || { entries: [], unmappedCount: 0, mappedCount: 0 };

  const entryIndex = palette.entries.findIndex(e => e.id === paletteEntryId);
  if (entryIndex === -1) return;

  const entry = palette.entries[entryIndex];
  if (!entry.alternatives) return;

  entry.alternatives = entry.alternatives.filter(a => a.qualityTier !== qualityTier);
  palette.entries[entryIndex] = entry;

  await updateDoc(projectRef, {
    materialPalette: palette,
  });

  await markEstimateStale(projectId, 'Material alternative mapping removed');
}

/**
 * Get all alternative mappings for a specific palette entry.
 */
export function getAlternativesForEntry(
  palette: MaterialPalette,
  paletteEntryId: string
): MaterialAlternativeMapping[] {
  const entry = palette.entries.find(e => e.id === paletteEntryId);
  return entry?.alternatives || [];
}

/**
 * Get quality tiers that have at least one material alternative mapped
 * across all palette entries.
 */
export function getAvailableTiers(palette: MaterialPalette): MaterialQualityTier[] {
  const tiers = new Set<MaterialQualityTier>();

  for (const entry of palette.entries) {
    if (entry.alternatives) {
      for (const alt of entry.alternatives) {
        tiers.add(alt.qualityTier);
      }
    }
  }

  return Array.from(tiers).sort((a, b) => {
    const order: Record<MaterialQualityTier, number> = { economy: 0, standard: 1, premium: 2, luxury: 3 };
    return order[a] - order[b];
  });
}

/**
 * Check how many palette entries have alternatives for each tier.
 * Returns coverage stats useful for UI badges.
 */
export function getAlternativeCoverage(palette: MaterialPalette): Record<MaterialQualityTier, { mapped: number; total: number }> {
  const mappedEntries = palette.entries.filter(e => e.inventoryId);
  const total = mappedEntries.length;

  const coverage: Record<MaterialQualityTier, { mapped: number; total: number }> = {
    economy: { mapped: 0, total },
    standard: { mapped: total, total }, // standard is always the base
    premium: { mapped: 0, total },
    luxury: { mapped: 0, total },
  };

  for (const entry of mappedEntries) {
    if (entry.alternatives) {
      for (const alt of entry.alternatives) {
        coverage[alt.qualityTier].mapped++;
      }
    }
  }

  return coverage;
}
