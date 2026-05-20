/**
 * draftStorefront — client-side wrapper around the `draftStorefrontContent`
 * callable Cloud Function. Returns a map of dotted-key fields to drafted
 * strings, which each storefront drawer applies to its local form state
 * (the user reviews + edits before saving — no auto-write to Firestore).
 *
 * See functions/src/integrations/ai/draftStorefrontContent.js for the
 * server-side prompt + entity context loading.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/services/firebase';

export type DraftableEntity =
  | 'project'
  | 'finish'
  | 'material'
  | 'voice'
  | 'press_mention'
  | 'featured_update';

export interface DraftStorefrontInput {
  entityType: DraftableEntity;
  entityId: string;
  /** Optional whitelist of fields to draft (dotted-key form, e.g. "narrative.body"). */
  sections?: string[];
  /** Optional tone override. Default = house voice. */
  tone?: string;
}

export interface DraftStorefrontResult {
  drafts: Record<string, string>;
  model: string;
  entityType: DraftableEntity;
  sourceFields: string[];
}

export async function draftStorefrontContent(
  input: DraftStorefrontInput
): Promise<DraftStorefrontResult> {
  const callable = httpsCallable<DraftStorefrontInput, DraftStorefrontResult>(
    functions,
    'draftStorefrontContent'
  );
  const result = await callable(input);
  return result.data;
}

/**
 * Create a brand-new ProjectCaseStudy by drafting from an existing
 * DesignProject. Returns the new caseStudyId so the caller can navigate
 * the user straight to the form to review + edit.
 */
export interface DraftCaseStudyFromProjectInput {
  projectId: string;
  subsidiaryId?: string;
  tone?: string;
}

export interface DraftCaseStudyFromProjectResult {
  caseStudyId: string;
  handle: string;
  draftedFields: string[];
  sourceProject: {
    id: string;
    name: string;
    customerName: string;
    completedYear: number | null;
  };
  model: string;
}

export async function draftCaseStudyFromProject(
  input: DraftCaseStudyFromProjectInput
): Promise<DraftCaseStudyFromProjectResult> {
  const callable = httpsCallable<DraftCaseStudyFromProjectInput, DraftCaseStudyFromProjectResult>(
    functions,
    'draftCaseStudyFromProject'
  );
  const result = await callable(input);
  return result.data;
}

/**
 * Helper to apply a dotted-key draft map onto a nested object.
 * Returns a new object (no mutation).
 *   applyDottedDrafts({a: 1}, {"b.c": "x"}) → {a: 1, b: {c: "x"}}
 */
export function applyDottedDrafts<T extends Record<string, unknown>>(
  base: T,
  drafts: Record<string, string>
): T {
  const next: Record<string, unknown> = JSON.parse(JSON.stringify(base ?? {}));
  for (const [key, value] of Object.entries(drafts)) {
    if (!value) continue; // skip empty drafts
    const parts = key.split('.');
    let cursor: Record<string, unknown> = next;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (cursor[p] == null || typeof cursor[p] !== 'object') cursor[p] = {};
      cursor = cursor[p] as Record<string, unknown>;
    }
    cursor[parts[parts.length - 1]] = value;
  }
  return next as T;
}
