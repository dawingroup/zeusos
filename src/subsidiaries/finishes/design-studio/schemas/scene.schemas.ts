/**
 * Scene Zod Schemas — Validation for scene CRUD and cabinet operations
 */
import { z } from 'zod';
import { GROUND_PLANE_SIZE_MM } from '../constants/scene.constants';

/** Schema for creating a new design scene */
export const createSceneSchema = z.object({
  name: z.string().min(3).max(100),
  projectId: z.string().min(1),
  customerId: z.string().min(1),
  description: z.string().max(500).optional(),
  status: z.enum(['draft', 'active', 'archived', 'in_production']).optional(),
});

/** Schema for updating a scene */
export const updateSceneSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['draft', 'active', 'archived', 'in_production']).optional(),
});

/** Schema for adding a cabinet to a scene */
export const addCabinetToSceneSchema = z.object({
  pddId: z.string().min(1),
  cabinetCode: z.string().min(2).max(9),
  displayName: z.string().min(1).max(200),
  configuration: z.record(z.string(), z.unknown()),
  finishSelections: z.record(z.string(), z.string()),
  position: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
    anchoredTo: z.enum(['floor', 'wall', 'ceiling', 'free']).optional(),
    alignedWithCabinetId: z.string().optional(),
    alignmentEdge: z.enum(['left', 'right', 'front', 'back']).optional(),
  }).optional(),
  rotation: z.number().min(0).max(360).optional(),
  notes: z.string().max(1000).optional(),
  /**
   * FK to the DesignItem this cabinet belongs to. Accepts a non-empty
   * string or omission; no empty strings allowed.
   *
   * The schema is the union of both regimes; the service
   * (`addCabinetToScene`) decides which rule applies based on the parent
   * scene's `projectId`:
   *   - **Project-backed scene**: the service throws if omitted. The
   *     Firestore rule rejects the write as a second line of defense.
   *   - **Standalone scene** (no real projectId): omission is required —
   *     there's no project under which to file a DesignItem.
   *
   * Keeping it optional at the schema level means one type for both UIs
   * (the cabinet-creation forms switch based on `isStandaloneScene`).
   * See `utils/sceneProjectUtils.ts` for the predicate.
   */
  designItemId: z.string().min(1).optional(),
  /** URL of a shared source GLB (e.g. the user's uploaded multi-cabinet model). */
  sourceModelUrl: z.string().url().optional(),
  /** Mesh names (from the source GLB) that belong to this cabinet. */
  sourceMeshNames: z.array(z.string()).optional(),
});

/**
 * P2 (Slice 1): schema for reassigning an existing cabinet to a different
 * DesignItem. Wired up in Slice 2 via `assignCabinetToDesignItem`.
 */
export const updateCabinetDesignItemSchema = z.object({
  designItemId: z.string().min(1),
});

/** Schema for updating a cabinet position */
export const updateCabinetPositionSchema = z.object({
  position: z.object({
    x: z.number().min(-GROUND_PLANE_SIZE_MM / 2).max(GROUND_PLANE_SIZE_MM / 2),
    y: z.number().min(0).max(5000),
    z: z.number().min(-GROUND_PLANE_SIZE_MM / 2).max(GROUND_PLANE_SIZE_MM / 2),
    anchoredTo: z.enum(['floor', 'wall', 'ceiling', 'free']).optional(),
    alignedWithCabinetId: z.string().optional(),
    alignmentEdge: z.enum(['left', 'right', 'front', 'back']).optional(),
  }),
  rotation: z.number().min(0).max(360).optional(),
});

/** Schema for duplicating a cabinet */
export const duplicateCabinetSchema = z.object({
  sourceCabinetId: z.string().min(1),
  newPosition: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }).optional(),
});

export type CreateSceneInput = z.infer<typeof createSceneSchema>;
export type UpdateSceneInput = z.infer<typeof updateSceneSchema>;
export type AddCabinetInput = z.infer<typeof addCabinetToSceneSchema>;
export type UpdateCabinetPositionInput = z.infer<typeof updateCabinetPositionSchema>;
export type DuplicateCabinetInput = z.infer<typeof duplicateCabinetSchema>;
export type UpdateCabinetDesignItemInput = z.infer<typeof updateCabinetDesignItemSchema>;
