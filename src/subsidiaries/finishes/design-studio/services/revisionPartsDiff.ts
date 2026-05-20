/**
 * revisionPartsDiff — pure helper that compares a cabinet's current
 * parts against a dry-run re-parse of a new revision, producing an
 * accept/reject-ready diff.
 *
 * Identity matching mirrors `scenePartsToDesignManager.partEntryIdentityKey`:
 *   1. meshNodeId wins when both sides have one (stable across renames).
 *   2. partCode + dimensions + material as an attribute fallback
 *      (covers the case where mesh ids shifted between GLB exports).
 *
 * "Changed" parts surface a field-level delta so the diff modal can
 * show the user exactly what moved (dimensions? material? quantity?).
 * Overrides flagged on `cabinet.partOverrides` are threaded into the
 * preserved part so the caller can skip fields the user explicitly
 * locked (manual rename, manual material pick).
 */
import type { ScenePart } from '../types/assembly.types';
import type { SceneCabinet } from '../types/scene.types';

export type PartOverrideLocks = NonNullable<SceneCabinet['partOverrides']>[string];

/** One field that differs between the current part and the incoming one. */
export interface PartFieldChange {
  field: 'partName' | 'partCode' | 'materialId' | 'materialName'
       | 'quantity' | 'length' | 'width' | 'thickness' | 'grainDirection';
  before: string | number | null | undefined;
  after: string | number | null | undefined;
  /** If the user has locked this field on the current part, we flag it
   *  here so the modal defaults to NOT applying the incoming value. */
  locked?: boolean;
}

export interface PartChange {
  /** The current part in the cabinet (present for 'removed' + 'changed'). */
  current?: ScenePart;
  /** The incoming part from the dry-run (present for 'added' + 'changed'). */
  incoming?: ScenePart;
  /** Kind of change — drives UI grouping + default action. */
  kind: 'added' | 'removed' | 'changed' | 'unchanged';
  /** Only populated when kind === 'changed'. */
  changes: PartFieldChange[];
  /** Stable id surfaced to the UI — prefers incoming then current. */
  id: string;
  /** User-facing label for list rendering. */
  label: string;
  /** Lock record from cabinet.partOverrides for the matched current part. */
  overrides?: PartOverrideLocks;
}

export interface PartsDiff {
  changes: PartChange[];
  summary: {
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
  };
}

// ---------------------------------------------------------------------------
// Identity key — mirror of scenePartsToDesignManager.partEntryIdentityKey but
// over ScenePart shape. Small duplication; kept local so this module stays
// pure-TS (no cross-import into the design-manager types).
// ---------------------------------------------------------------------------

function identityKey(p: ScenePart): string {
  if (p.meshNodeId) return `mesh:${p.meshNodeId}`;
  const d = p.dimensions;
  return [
    'attr',
    p.partCode ?? '',
    p.inventoryItemId ?? '',
    d?.length ?? '',
    d?.width ?? '',
    d?.thickness ?? '',
  ].join('|');
}

function flattenParts(cabinet: Pick<SceneCabinet, 'assemblies'>): ScenePart[] {
  const out: ScenePart[] = [];
  for (const asm of cabinet.assemblies ?? []) {
    for (const p of asm.parts ?? []) out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Field-level compare
// ---------------------------------------------------------------------------

function compareFields(current: ScenePart, incoming: ScenePart, locks?: PartOverrideLocks): PartFieldChange[] {
  const changes: PartFieldChange[] = [];
  const cd = current.dimensions; const id = incoming.dimensions;

  if (current.partName !== incoming.partName) {
    changes.push({
      field: 'partName', before: current.partName, after: incoming.partName,
      locked: !!locks?.nameLocked,
    });
  }
  if (current.partCode !== incoming.partCode) {
    changes.push({ field: 'partCode', before: current.partCode, after: incoming.partCode });
  }
  if (current.inventoryItemId !== incoming.inventoryItemId) {
    changes.push({
      field: 'materialId', before: current.inventoryItemId, after: incoming.inventoryItemId,
      locked: !!locks?.materialLocked,
    });
  }
  if (current.inventoryItemName !== incoming.inventoryItemName) {
    changes.push({
      field: 'materialName', before: current.inventoryItemName, after: incoming.inventoryItemName,
      locked: !!locks?.materialLocked,
    });
  }
  if (current.quantity !== incoming.quantity) {
    changes.push({
      field: 'quantity', before: current.quantity, after: incoming.quantity,
      locked: !!locks?.quantityLocked,
    });
  }
  if (cd?.length !== id?.length) {
    changes.push({ field: 'length', before: cd?.length, after: id?.length });
  }
  if (cd?.width !== id?.width) {
    changes.push({ field: 'width', before: cd?.width, after: id?.width });
  }
  if (cd?.thickness !== id?.thickness) {
    changes.push({ field: 'thickness', before: cd?.thickness, after: id?.thickness });
  }
  if (cd?.grainDirection !== id?.grainDirection) {
    changes.push({ field: 'grainDirection', before: cd?.grainDirection, after: id?.grainDirection });
  }
  return changes;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function diffCabinetParts(
  cabinet: Pick<SceneCabinet, 'assemblies' | 'partOverrides'>,
  incomingParts: ScenePart[],
): PartsDiff {
  const currentParts = flattenParts(cabinet);
  const overrides = cabinet.partOverrides ?? {};

  // Index current by identity key (mesh-preferred, attr fallback).
  const currentByKey = new Map<string, ScenePart>();
  for (const p of currentParts) currentByKey.set(identityKey(p), p);

  const changes: PartChange[] = [];
  const consumed = new Set<string>();

  for (const inc of incomingParts) {
    const key = identityKey(inc);
    const cur = currentByKey.get(key);
    if (!cur) {
      changes.push({
        kind: 'added',
        incoming: inc,
        id: inc.id,
        label: inc.partName || inc.partCode || inc.id,
        changes: [],
      });
      continue;
    }
    consumed.add(key);
    const locks = overrides[cur.id];
    const fieldChanges = compareFields(cur, inc, locks);
    changes.push({
      kind: fieldChanges.length === 0 ? 'unchanged' : 'changed',
      current: cur,
      incoming: inc,
      id: cur.id,
      label: cur.partName || cur.partCode || cur.id,
      changes: fieldChanges,
      overrides: locks,
    });
  }

  // Any current parts not matched → removed by this revision.
  for (const cur of currentParts) {
    const key = identityKey(cur);
    if (consumed.has(key)) continue;
    changes.push({
      kind: 'removed',
      current: cur,
      id: cur.id,
      label: cur.partName || cur.partCode || cur.id,
      changes: [],
      overrides: overrides[cur.id],
    });
  }

  const summary = {
    added:     changes.filter(c => c.kind === 'added').length,
    removed:   changes.filter(c => c.kind === 'removed').length,
    changed:   changes.filter(c => c.kind === 'changed').length,
    unchanged: changes.filter(c => c.kind === 'unchanged').length,
  };
  return { changes, summary };
}

// ---------------------------------------------------------------------------
// Merge — produce the final parts array given user selections
// ---------------------------------------------------------------------------

/**
 * Caller-visible policy: for each PartChange the user can either apply
 * the incoming version (default for added/changed), keep the current
 * one (default for `unchanged` and for rows with locked fields), or
 * drop the row entirely (default for `removed` — cabinet loses that part).
 */
export type ChangeDecision = 'apply' | 'keep' | 'drop';

export interface MergeOptions {
  /** Per-change user decision, keyed by `PartChange.id`. Missing → default. */
  decisions: Record<string, ChangeDecision>;
}

export function defaultDecisionFor(change: PartChange): ChangeDecision {
  switch (change.kind) {
    case 'added':     return 'apply';
    case 'removed':   return 'drop';      // Revision says this mesh is gone.
    case 'unchanged': return 'keep';
    case 'changed': {
      // If every differing field is locked, keep the current part;
      // otherwise apply the incoming one (and we'll restore locked fields).
      const hasUnlocked = change.changes.some(c => !c.locked);
      return hasUnlocked ? 'apply' : 'keep';
    }
  }
}

/**
 * Compute the final parts array from a diff + decision set.
 *
 * Returns BOTH the new parts list and the per-part "preserved fields"
 * audit so the orchestrator can log what survived.
 */
export function mergeDiff(
  diff: PartsDiff,
  opts: MergeOptions,
): { parts: ScenePart[]; fieldsPreserved: number } {
  const out: ScenePart[] = [];
  let fieldsPreserved = 0;

  for (const ch of diff.changes) {
    const decision = opts.decisions[ch.id] ?? defaultDecisionFor(ch);
    if (decision === 'drop') continue;

    if (decision === 'keep') {
      if (ch.current) out.push(ch.current);
      continue;
    }

    // decision === 'apply'
    if (!ch.incoming) continue;           // defensive — 'apply' on a removed-only row.
    let merged: ScenePart = { ...ch.incoming };

    // Preserve locked fields from the current version.
    if (ch.current && ch.overrides) {
      if (ch.overrides.nameLocked && ch.current.partName) {
        merged.partName = ch.current.partName;
        fieldsPreserved++;
      }
      if (ch.overrides.materialLocked) {
        merged.inventoryItemId = ch.current.inventoryItemId;
        merged.inventoryItemName = ch.current.inventoryItemName;
        merged.materialDescription = ch.current.materialDescription;
        if (ch.current.finishLibraryId) {
          merged.finishLibraryId = ch.current.finishLibraryId;
        }
        fieldsPreserved++;
      }
      if (ch.overrides.quantityLocked) {
        merged.quantity = ch.current.quantity;
        fieldsPreserved++;
      }
    }

    // Keep the original part id when we had one — it's what
    // DesignManager's parts sync uses as the stable doc identity.
    if (ch.current) merged = { ...merged, id: ch.current.id };

    out.push(merged);
  }

  return { parts: out, fieldsPreserved };
}
