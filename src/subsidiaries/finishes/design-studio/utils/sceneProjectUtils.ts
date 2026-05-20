/**
 * Scene Project Utilities
 *
 * Shared helpers for reasoning about whether a scene is "project-backed"
 * (has a real DesignProject attachment) or "standalone" (the legacy
 * quick-review escape hatch).
 *
 * The distinction matters because Slice 6 of the P2 work flipped
 * `SceneCabinet.designItemId` from optional to required — BUT only on
 * project-backed scenes. Standalone scenes remain exempt at the
 * Firestore rule level and therefore at the type level too. Every place
 * that checks the regime has to agree on the predicate, so this file
 * is the single source of truth.
 *
 * Previously the check was inlined as `!projectId || projectId === 'standalone'`
 * in 7+ files. A future contributor adding a third sentinel value (say,
 * 'draft' or 'review') only has to update one function now, instead of
 * grepping the codebase and hoping.
 */
import type { DesignScene, ProjectBoundSceneCabinet, SceneCabinet } from '../types/scene.types';

/** The sentinel projectId value stamped on quick-review / legacy scenes. */
export const STANDALONE_PROJECT_SENTINEL = 'standalone';

/**
 * True when the scene has no real DesignProject attachment.
 *
 * Standalone scenes are the legacy quick-review escape hatch: cabinets
 * under them don't need a DesignItem FK because there's no project to
 * file one under. The Slice 6 Firestore rule and the service-layer
 * `addCabinetToScene` guard both exempt this regime.
 */
export function isStandaloneProjectId(projectId: unknown): boolean {
  return (
    !projectId || projectId === '' || projectId === STANDALONE_PROJECT_SENTINEL
  );
}

/**
 * Type-narrowing inverse of {@link isStandaloneProjectId}. Returns true
 * (and narrows `projectId` to `string`) when the id refers to a real
 * DesignProject — i.e. it's a non-empty string that isn't the standalone
 * sentinel. Lets callers avoid `?? ''` / non-null coercions when they
 * need to pass the id straight into a Firestore lookup.
 */
export function isProjectBoundProjectId(
  projectId: string | null | undefined,
): projectId is string {
  return !isStandaloneProjectId(projectId);
}

/**
 * Convenience wrapper that takes a scene-shaped object. Accepts `null`/
 * `undefined` so callers don't have to guard before calling — an absent
 * scene is treated as standalone (conservative default).
 */
export function isStandaloneScene(
  scene: Pick<DesignScene, 'projectId'> | null | undefined,
): boolean {
  return isStandaloneProjectId(scene?.projectId);
}

/**
 * True when the cabinet carries a non-empty DesignItem FK — i.e. it
 * satisfies the project-backed invariant. Narrows the type so the caller
 * can access `cabinet.designItemId` without a `?.` or non-null assertion.
 *
 * This does NOT prove the parent scene is project-backed; it only proves
 * the FK field is set. A correctly-written caller that's iterating
 * cabinets under a known project-backed scene can assume every cabinet
 * passes this guard (post-Slice-6 rule enforcement). In mixed contexts
 * (e.g. a roster that spans both regimes), the guard lets you fork
 * cleanly.
 */
export function isProjectBoundCabinet(
  cabinet: SceneCabinet,
): cabinet is ProjectBoundSceneCabinet {
  return (
    typeof cabinet.designItemId === 'string' && cabinet.designItemId.length > 0
  );
}

/**
 * P21.10 — deterministic scene name derived from the parent project.
 *
 * The New Scene dialog used to ask users to invent a name from scratch
 * ("Mukasa Kitchen — V1") which meant inconsistent names across a project
 * and extra friction for what is often a throwaway staging scene. The
 * project is always the parent in the hierarchy, so the default name
 * should reference it and enumerate within it.
 *
 * Format: `{projectName} - Scene {N+1}` where N = number of *existing*
 * scenes on the project (whether active, draft, or archived — we pick the
 * next unused sequence so renaming mid-flight doesn't collide).
 *
 * Users can still override the suggestion in the dialog input. Empty
 * override at submit time falls back to the suggestion.
 *
 * @param projectName  Human-readable project name. Empty string is legal
 *                     and yields `"Scene {N+1}"` — the caller should
 *                     usually have a name before reaching this helper.
 * @param existingNames  All existing scene names on the project (case-
 *                     insensitive collision check). Order doesn't matter.
 */
export function suggestSceneName(
  projectName: string,
  existingNames: readonly string[],
): string {
  const base = projectName.trim();
  const prefix = base ? `${base} - Scene ` : 'Scene ';
  // Find the lowest N ≥ 1 such that `${prefix}${N}` isn't taken. Handles
  // gaps (Scene 1 + Scene 3 → next is Scene 2) and renames cleanly.
  const taken = new Set(
    existingNames.map(n => n.trim().toLowerCase()),
  );
  for (let i = 1; i <= existingNames.length + 1; i++) {
    const candidate = `${prefix}${i}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  // Fallback that won't loop even with pathological input.
  return `${prefix}${existingNames.length + 1}`;
}
