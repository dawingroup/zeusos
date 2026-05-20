/**
 * alignmentCommands — factory helpers for undo/undo-able alignment
 * mutations. Each function returns an `AlignmentCommand` the caller
 * can push onto `useCommandStack` right after performing the forward
 * action.
 *
 * Commands don't know about React — they capture the pre-state
 * values at construction and invoke the provided mutation functions
 * at replay time.
 */
import type { AlignmentCommand } from '../hooks/useCommandStack';
import type { SceneCabinet, CabinetPosition } from '../types/scene.types';

/** Snapshot of every field the alignment system mutates for one cabinet. */
export interface CabinetSnapshot {
  id: string;
  position: CabinetPosition;
  rotation: number;
}

/** Extract the fields we need to reverse a position/rotation/mirror edit. */
export function snapshot(cabinet: SceneCabinet): CabinetSnapshot {
  return {
    id: cabinet.id,
    // Clone so the caller can't mutate the stored snapshot by accident.
    position: { ...(cabinet.position ?? { x: 0, y: 0, z: 0 }) },
    rotation: cabinet.rotation ?? 0,
  };
}

/**
 * Command: one or more cabinets moved / rotated / mirrored. The
 * snapshot arrays let us revert exactly what changed (including
 * group-aware batch moves where several cabinets shifted together).
 */
export function positionCommand(
  before: CabinetSnapshot[],
  after: CabinetSnapshot[],
  applyMove: (cabinetId: string, position: CabinetPosition, rotation?: number) => Promise<void>,
  label = 'Move',
): AlignmentCommand {
  const replay = async (snaps: CabinetSnapshot[]) => {
    // Sequential so later writes see the results of earlier ones —
    // matters when a downstream effect refetches state between.
    for (const s of snaps) {
      await applyMove(s.id, s.position, s.rotation);
    }
  };
  return {
    label,
    do: () => replay(after),
    undo: () => replay(before),
  };
}

/**
 * Command: a group was created and cabinets were assigned to it.
 * Undo deletes the group (each member's `groupId` is cleared by
 * `ungroup`); redo re-creates it from the captured id + member list.
 */
export function createGroupCommand(
  cabinetIds: string[],
  name: string | undefined,
  runCreate: (cabinetIds: string[], name?: string) => Promise<string>,
  runUngroup: (groupId: string) => Promise<void>,
  initialGroupId: string,
): AlignmentCommand {
  // Groups may be re-created on redo — capture the id so we can
  // refer to the "same" group semantically even after undo deleted
  // the original doc. (The NEW id is stored on redo because Firestore
  // will assign a fresh one; we treat the command as "un-group →
  // re-group" idempotently.)
  let currentGroupId: string = initialGroupId;
  return {
    label: `Group ${cabinetIds.length} cabinets`,
    undo: async () => {
      await runUngroup(currentGroupId);
    },
    do: async () => {
      currentGroupId = await runCreate(cabinetIds, name);
    },
  };
}

/**
 * Command: a group was dissolved. Undo re-creates it with the same
 * member list; redo dissolves it again. Symmetric to createGroupCommand.
 */
export function ungroupCommand(
  groupId: string,
  cabinetIds: string[],
  name: string | undefined,
  runCreate: (cabinetIds: string[], name?: string) => Promise<string>,
  runUngroup: (groupId: string) => Promise<void>,
): AlignmentCommand {
  let currentGroupId: string = groupId;
  return {
    label: `Ungroup (${cabinetIds.length} members)`,
    undo: async () => {
      currentGroupId = await runCreate(cabinetIds, name);
    },
    do: async () => {
      await runUngroup(currentGroupId);
    },
  };
}
