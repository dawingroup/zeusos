# Design Studio Gaps — Implementation Plan

> Generated 2025-04-23. Addresses the 11 gaps identified in the parts
> synchronisation pipeline between Design Studio and Design Manager.
> Gap 11 (unstable part numbers) was partially resolved by the
> `partNamingService` introduced in the same session.

---

## Overview

The work is grouped into **5 phases**, ordered by impact and dependency:

| Phase | Theme | Gaps Addressed | Effort |
|-------|-------|---------------|--------|
| **P1** | Data-Model Enrichment | #3 Edge banding, #4 Joinery/profiles, #8 BoringSpec | 2–3 days |
| **P2** | Material Resolution Durability | #2 Placeholder materials, #6 Palette→Parts propagation, #10 Confidence gating | 2–3 days |
| **P3** | Reverse Sync (DM → Scene) | #1 Round-trip material edits | 3–4 days |
| **P4** | Automation & Reactivity | #7 Auto-sync triggers, #9 Per-cabinet CSV overlay | 2–3 days |
| **P5** | Geometry Accuracy | #5 Bbox-only dimensions | 2–3 days |

**Total estimated effort: ~12–16 developer-days.**

---

## Phase 1 — Data-Model Enrichment

**Goal**: Make `PartEntry` rich enough to carry everything a production shop
needs. Currently the DM type is too coarse — boolean edge banding, no
joinery fields, loosely-typed boring spec.

### P1.1 — Rich Edge Banding on PartEntry (Gap #3)

**Problem**: `ScenePart.edgeBanding` carries per-edge `{ type, length }` but
`PartEntry.edgeBanding` collapses to `{ top: boolean, material?: string }`.
Per-edge material variety and lengths are lost; front edge is dropped entirely.

**Changes**:

1. **Extend `PartEdgeBanding`** in `src/modules/design-manager/types/index.ts`:
   ```ts
   export interface PartEdgeBandingEdge {
     applied: boolean;
     material?: string;     // edge tape material name
     thickness?: number;    // tape thickness in mm
     length?: number;       // computed edge length in mm
   }

   export interface PartEdgeBanding {
     top: PartEdgeBandingEdge;
     bottom: PartEdgeBandingEdge;
     left: PartEdgeBandingEdge;
     right: PartEdgeBandingEdge;
     front?: PartEdgeBandingEdge;  // 5th edge for profiled parts
   }
   ```

2. **Update `toEdgeBanding()` in `scenePartsToDesignManager.ts`** — map the
   rich ScenePart shape straight through instead of flattening.

3. **Update CSV overlay `edgeBanding` row shape** in `scene.types.ts` to
   carry per-edge material (the PolyBoard CSV already exports edge tape codes
   per side — the parser just doesn't capture them).

4. **Update `materialHarvester.ts`** — the edge-banding linear-meters
   aggregation can now use per-edge `length` instead of re-deriving from dims.

5. **Update UI**: PartsTab edge banding columns, cut list PDF edge columns.

6. **Migration**: Write a backfill script that converts existing boolean
   `edgeBanding` → `{ applied: <bool>, material: <old shared material> }`.

**Tests**: Update `scenePartsToDesignManager.test.ts`, add migration test.

---

### P1.2 — Joinery & Edge Profile Fields (Gap #4)

**Problem**: No fields for mitered edges, edge profiles (bullnose, chamfer,
ogee), dados, rabbets, or grooves. These are critical production data.

**Changes**:

1. **Add to `PartEntry`**:
   ```ts
   /** Edge machining operations — miter, chamfer, profile, etc. */
   edgeProfiles?: {
     top?: EdgeProfileSpec;
     bottom?: EdgeProfileSpec;
     left?: EdgeProfileSpec;
     right?: EdgeProfileSpec;
   };

   /** Joinery operations — dado, rabbet, groove, tongue, etc. */
   joineryOps?: JoineryOp[];
   ```
   Where:
   ```ts
   interface EdgeProfileSpec {
     type: 'square' | 'chamfer' | 'bullnose' | 'ogee' | 'roundover'
           | 'bevel' | 'miter_45' | 'custom';
     angle?: number;       // degrees, for bevel/miter
     radius?: number;      // mm, for roundover/bullnose
     depth?: number;       // mm, for chamfer
     customProfile?: string; // reference to a profile library entry
   }

   interface JoineryOp {
     type: 'dado' | 'rabbet' | 'groove' | 'tongue' | 'biscuit_slot'
           | 'domino_slot' | 'dowel_hole' | 'pocket_hole';
     position: 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';
     width: number;        // mm
     depth: number;        // mm
     offsetFromEdge?: number; // mm from the named edge
   }
   ```

2. **Mirror on `ScenePart`** — same `edgeProfiles` and `joineryOps` fields
   so the 3D model pipeline can populate them from PolyBoard data and AI.

3. **CSV parser enhancement** (`parserCsv.ts`) — PolyBoard's advanced CSV
   export includes joint type columns. Parse them into `joineryOps`.

4. **AI recognition enhancement** — when the knowledge base `ExpectedPart`
   specifies joinery (e.g. shaker door rails always have a tongue), stamp it.

5. **Drawing integration** — the Workshop Viewer print package should render
   edge profile symbols on part detail sheets (I2xx series).

**Tests**: Parser tests for new CSV columns, naming-service integration.

---

### P1.3 — Structured BoringSpec (Gap #8)

**Problem**: `BoringSpec` is defined in `mdp.types.ts` as `{ diameter, depth }`
but actual data flows as `unknown` with three different shapes.

**Changes**:

1. **Consolidate `BoringSpec`** into a canonical shape:
   ```ts
   export interface BoringSpec {
     holes: BoringHole[];
     targets?: HardwareBoringTarget[];
   }

   interface BoringHole {
     face: 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';
     x: number;          // mm from face origin
     y: number;          // mm from face origin
     diameter: number;   // mm
     depth: number;      // mm
     through?: boolean;
   }

   interface HardwareBoringTarget {
     inventoryItemId?: string;
     label?: string;
     quantity: number;
   }
   ```

2. **Remove all `as unknown as` casts** in `partConnections.ts` — use the
   canonical type with proper narrowing.

3. **Update `ScenePart.boringSpec`** and `PartEntry.hasCNCOperations` — add
   optional `boringSpec` on PartEntry itself so CNC data survives the sync.

4. **Backfill script** — normalize legacy `{ hardware: [...] }` and
   `{ holes: [{ itemId }] }` shapes to the canonical form.

**Tests**: Update `partConnections.test.ts`, add migration test.

---

## Phase 2 — Material Resolution Durability

**Goal**: Make material mappings persistent, propagatable, and gated by
confidence so the BOM and print packages always carry trustworthy data.

### P2.1 — Persist Material Resolution in ModelPackage (Gap #2)

**Problem**: `processModel.service.ts` → `resolveMaterialsFromParsedModel()`
puts every material into `unresolved[]`. The ModelPackage saved to Firestore
has empty `mappings[]`. Resolution only lives in the ephemeral React hook.

**Changes**:

1. **Move resolution into `processModel`** — after the AI grouping step,
   call `resolveAllMaterials()` (new function in `materialResolverService`)
   which takes the parsed model's material names + the project palette and
   returns `MaterialMapping[]`.

2. **Populate `ModelPackage.materials.mappings`** before saving.

3. **Add a `resolvedAt` timestamp** so downstream consumers can tell if
   mappings are stale vs fresh.

4. **`useMaterialResolver` hook**: Read from the persisted package first;
   only run live resolution if `resolvedAt` is older than the palette's
   `updatedAt`.

**Tests**: Unit test `resolveAllMaterials`, integration test round-trip.

---

### P2.2 — Batch Palette → Parts Propagation (Gap #6)

**Problem**: When a user maps a palette entry to an inventory item, the 200+
parts referencing that material don't update. User must click per-item.

**Changes**:

1. **New service `materialPropagationService.ts`**:
   ```ts
   propagatePaletteMappingToDesignItems(
     projectId: string,
     materialName: string,
     inventoryItemId: string,
     finishLibraryId: string,
   ): Promise<{ updatedItems: number; updatedParts: number }>
   ```
   Reads all design items for the project, finds parts with matching
   `materialName`, stamps `inventoryItemId` + `materialId` +
   `materialResolutionSource: 'palette-exact'` + confidence 1.0.

2. **Trigger point**: Wire into the Material Palette editor's "Link to
   inventory" action — after the palette entry is saved, call propagation.

3. **Batch writer**: Use Firestore batched writes (max 500 ops) to update
   all matching parts atomically per item.

4. **UI feedback**: Toast showing "Updated 47 parts across 6 items".

**Tests**: Unit + integration with emulator.

---

### P2.3 — Confidence-Gated Auto-Accept (Gap #10)

**Problem**: Even 1.0-confidence matches require manual acknowledgment.
Low-confidence matches aren't flagged in any gate.

**Changes**:

1. **Add confidence thresholds** to `materialValidationService.ts`:
   ```ts
   | 'low_confidence_material'  // materialResolutionConfidence < 0.6
   ```

2. **Auto-accept logic**: Parts with `confidence >= 0.85` and
   `source = 'palette-exact'` skip the review step during sync.

3. **Escalation queue**: Parts with `confidence < 0.6` get a
   `MATERIAL_REVIEW_NEEDED` issue in partsQualityHelper, surfaced in the
   "Parts Review" UI with an amber badge.

4. **Print-package gate**: `materialValidationService` blocks print if any
   part has `confidence < configurable_threshold` (default 0.6).

**Tests**: Validator unit tests for new exception reason.

---

## Phase 3 — Reverse Sync (DM → Scene)

**Goal**: When procurement edits a material in PartsTab, the 3D viewport
re-renders with the corrected finish — closing the visual round-trip loop.

### P3.1 — Material Reverse Sync Service (Gap #1)

This is the biggest gap. The back-links (`meshNodeId`, `cabinetId`, `sceneId`)
exist on `PartEntry` but nothing reads them to write back.

**Changes**:

1. **New service `materialReverseSyncService.ts`** in `design-studio/services/`:
   ```ts
   interface ReverseSyncInput {
     sceneId: string;
     cabinetId: string;
     meshNodeId: string;
     newFinishLibraryId: string;
     newMaterialDescription: string;
     changedBy: string;
   }

   syncMaterialBackToScene(input: ReverseSyncInput): Promise<void>
   ```
   - Reads the cabinet doc from Firestore
   - Finds the `ScenePart` with matching `meshNodeId`
   - Updates `finishLibraryId` + `materialDescription`
   - Writes back with `updatedAt` timestamp

2. **Trigger point in PartsTab**: When the user changes `materialId` on a
   PartEntry that has `meshNodeId` + `sceneId`, call reverse sync.
   Wire into the existing `updatePartEntry` handler in
   `src/modules/design-manager/components/project/PartsTab.tsx`.

3. **Batch reverse sync**: When `propagatePaletteMappingToDesignItems`
   (P2.2) runs, collect all `{ sceneId, cabinetId, meshNodeId }` tuples
   from the updated parts and batch-reverse-sync.

4. **Scene viewport reactivity**: The scene workspace already has
   `onSnapshot` on cabinets — once the cabinet doc updates, the
   `finishSelections` resolve against the updated `finishLibraryId`,
   and the Three.js material refreshes.

5. **Conflict guard**: If the scene is being edited in Design Studio
   (optimistic lock), queue the reverse sync with a `pendingMaterialEdits`
   field on the scene doc. Apply on next scene load.

**Tests**: Integration test with emulator — edit material in DM, verify
ScenePart.finishLibraryId updates, verify viewport material refresh.

---

### P3.2 — Reverse Sync for Dimensions & Notes

**Scope extension**: Beyond materials, procurement may correct dimensions
(e.g. CSV had the wrong thickness) or add notes. The same `meshNodeId`
back-link enables syncing any PartEntry field back.

**Changes**:

1. **Extend `materialReverseSyncService`** → rename to `partReverseSyncService`.

2. **Diff-based sync**: Compare the PartEntry's edited fields against the
   corresponding ScenePart. Only write changed fields.

3. **Field whitelist**: Only sync fields that make sense going backward:
   `materialDescription`, `finishLibraryId`, `dimensions`, `notes`,
   `edgeBanding`, `grainDirection`. Do NOT sync `quantity` (DM multiplies
   by cabinet count, scene stores per-unit).

**Tests**: Diff unit tests, integration test.

---

## Phase 4 — Automation & Reactivity

**Goal**: Reduce manual clicks — make the system self-updating when
upstream data changes.

### P4.1 — Auto-Sync on Assembly Change (Gap #7)

**Problem**: User must manually click "Sync parts" after every change.

**Changes**:

1. **Firestore Cloud Function trigger**: `onDocumentUpdated` on
   `designScenes/{sceneId}/cabinets/{cabinetId}` — when `assemblies`
   field changes, enqueue a parts sync.

2. **Debounced client-side trigger**: In the scene workspace, when the
   `assemblies` snapshot changes (already watched), auto-fire
   `syncDesignItemPartsFromScene` after a 2s debounce.

3. **Auto-trigger on CSV upload**: After `partsCsvOverlay` is written to
   the scene doc, auto-run the CSV matching + sync pipeline.

4. **Auto-trigger on palette mapping**: After P2.2 propagation completes,
   auto-trigger cutlist invalidation + regeneration.

5. **UI indicator**: Show a "syncing…" badge on the CabinetDetailPanel
   while auto-sync is in progress. Toast on completion.

**Guard rails**:
- Skip auto-sync if cabinet is locked.
- Skip if user is actively editing (debounce).
- Rate-limit to max 1 sync per 10 seconds per cabinet.

**Tests**: Debounce logic unit test, Cloud Function integration test.

---

### P4.2 — Per-Cabinet CSV Overlay (Gap #9)

**Problem**: `ScenePartsCsvOverlay` lives on the scene doc — one slot for
the entire scene. Multi-cabinet scenes get cross-contaminated matches.

**Changes**:

1. **Move CSV overlay to cabinet level**: Add `partsCsvOverlay` to
   `SceneCabinet` type in `scene.types.ts`.

2. **Upload UX**: The CSV upload modal now asks which cabinet(s) the file
   covers. Default: all cabinets (backward compat).

3. **Matching scoping**: `CsvLookup` in `scenePartsToDesignManager.ts`
   only receives the overlay for the cabinet being synced, not the
   entire scene's overlay.

4. **Migration**: Move existing `scene.partsCsvOverlay` to the first
   cabinet (or all cabinets if the scene only has one).

**Tests**: Update matching tests with multi-cabinet scenarios.

---

## Phase 5 — Geometry Accuracy

**Goal**: Improve dimension accuracy when no CSV is uploaded.

### P5.1 — Mesh-Aware Dimensions (Gap #5)

**Problem**: Dimensions come from axis-aligned bounding boxes. Non-rectangular
parts, rotated parts, and parts with hardware sub-meshes get wrong numbers.

**Changes**:

1. **Oriented bounding box (OBB)** computation in `geometryEngine.ts`:
   Use PCA (principal component analysis) on the vertex cloud to find the
   tightest-fitting oriented box. Extract length/width/thickness from the
   OBB axes instead of the AABB.

2. **Hardware envelope subtraction**: When a mesh has child meshes (e.g.
   a door with handle geometry), compute the OBB of the panel mesh only,
   excluding hardware sub-meshes identified by the AI grouper.

3. **Confidence scoring**: Compare OBB dims vs AABB dims. If they differ
   by > 10%, flag the part with a `DIMENSION_UNCERTAIN` issue in the
   quality helper. The CSV overlay (when present) remains authoritative.

4. **Thickness inference from face analysis**: For flat panels, count
   triangle normals. The two dominant opposing normals define the panel
   faces; distance between them = accurate thickness even when the bbox
   is inflated.

**Tests**: Unit tests with known geometry (cube, rotated panel, L-shape).

---

## Dependency Graph

```
P1.1 (Edge Banding) ─────────────────────┐
P1.2 (Joinery)      ─────────────────────┤
P1.3 (BoringSpec)   ─────────────────────┤
                                          │
P2.1 (Persist Materials) ────────┐        ├─→ P3.1 (Reverse Sync)
P2.2 (Batch Propagation) ───────┤        │      │
P2.3 (Confidence Gate)  ────────┘        │      ├─→ P3.2 (Reverse Dims/Notes)
                                          │      │
                              ┌───────────┘      │
                              │                  │
P4.1 (Auto-Sync) ←───────────┴──────────────────┘
P4.2 (Per-Cabinet CSV) ──────────────────────────
                                                  
P5.1 (OBB Dimensions) ───────── (independent)
```

**Key dependency**: P3 (Reverse Sync) benefits from P1 (richer data model)
and P2 (durable material resolution) being done first. If P3 ships before
P1, the reverse sync only handles materials — still valuable, just narrower.

P5 is fully independent and can be done in parallel with any phase.

---

## Suggested Sprint Allocation

| Sprint | Work | Days |
|--------|------|------|
| Sprint 1 | **P1.1** Edge banding + **P1.3** BoringSpec consolidation | 3 |
| Sprint 2 | **P2.1** Persist materials + **P2.2** Batch propagation | 3 |
| Sprint 3 | **P3.1** Reverse sync (materials) + **P4.2** Per-cabinet CSV | 3 |
| Sprint 4 | **P1.2** Joinery fields + **P2.3** Confidence gating | 2 |
| Sprint 5 | **P4.1** Auto-sync triggers + **P3.2** Reverse dims/notes | 3 |
| Sprint 6 | **P5.1** OBB dimensions | 2 |

Total: **~16 days** across 6 sprints.

---

## Already Addressed

| Gap | Status | How |
|-----|--------|-----|
| **#11** Part numbers unstable | ✅ Resolved | `partNamingService.ts` — deterministic codes from persisted `role` + `relativePosition` |
