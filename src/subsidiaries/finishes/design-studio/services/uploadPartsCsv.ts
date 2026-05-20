/**
 * uploadPartsCsv — upload a PolyBoard / SketchUp / generic cutlist CSV
 * and cache the parsed rows on the scene doc as `partsCsvOverlay`.
 *
 * Deliberately reuses Design Manager's `parseCSV` + grain/edge schema
 * so a CSV that imports cleanly in DM's Parts Import dialog imports
 * identically here. No second parser to keep in sync.
 *
 * During `syncDesignItemPartsFromScene` the overlay overrides
 * geometry-derived dimensions (because the GLB bbox is envelope-
 * including-hardware while the CSV is the authoritative cut spec),
 * material name, grain direction, and edge banding.
 */
import { doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { parseCSV } from '@/modules/design-manager/services/csvParser';
import type { ScenePartsCsvOverlay } from '../types/scene.types';

const SCENES = 'designScenes';

export interface UploadPartsCsvResult {
  rows: number;
  sourceType: string;
  warnings: string[];
  errors: Array<{ row: number; message: string }>;
  skipped: number;
}

/** Parse + cache a CSV on the scene. Throws on fatal parse failure. */
export async function uploadPartsCsv(
  sceneId: string,
  file: File,
  userId: string,
): Promise<UploadPartsCsvResult> {
  const text = await file.text();
  const parsed = parseCSV(text, file.name);

  if (!parsed.success || parsed.parts.length === 0) {
    throw new Error(
      parsed.errors[0]?.message
      ?? `Could not parse ${file.name} — detected format "${parsed.sourceType}" but no rows came through.`,
    );
  }

  const overlay: ScenePartsCsvOverlay = {
    fileName: file.name,
    sourceType: parsed.sourceType,
    rows: parsed.parts.map(p => ({
      name: p.name,
      length: p.length,
      width: p.width,
      thickness: p.thickness,
      quantity: p.quantity,
      materialName: p.materialName,
      materialCode: p.materialCode,
      grainDirection: p.grainDirection,
      edgeBanding: {
        top: !!p.edgeBanding?.top,
        bottom: !!p.edgeBanding?.bottom,
        left: !!p.edgeBanding?.left,
        right: !!p.edgeBanding?.right,
        ...(p.edgeBanding?.material ? { material: p.edgeBanding.material } : {}),
      },
      notes: p.notes,
      partType: p.partType,
      barProfile: p.barProfile,
    })),
    uploadedBy: userId,
    uploadedAt: Timestamp.now(),
  };

  // Firestore rejects undefined — build the write payload defensively.
  // Only materialCode / notes / barProfile can be undefined on a row;
  // strip them so the write doesn't blow up mid-save.
  const clean = {
    ...overlay,
    rows: overlay.rows.map(r => {
      const out: Record<string, unknown> = { ...r };
      if (r.materialCode === undefined) delete out.materialCode;
      if (r.notes === undefined) delete out.notes;
      if (r.barProfile === undefined) delete out.barProfile;
      if (r.edgeBanding?.material === undefined) {
        out.edgeBanding = {
          top: r.edgeBanding.top,
          bottom: r.edgeBanding.bottom,
          left: r.edgeBanding.left,
          right: r.edgeBanding.right,
        };
      }
      return out;
    }),
  };

  await updateDoc(doc(db, SCENES, sceneId), {
    partsCsvOverlay: clean,
    updatedAt: serverTimestamp(),
  });

  return {
    rows: parsed.parts.length,
    sourceType: parsed.sourceType,
    warnings: parsed.warnings,
    errors: parsed.errors,
    skipped: parsed.metadata.skippedRows,
  };
}

/** Remove an uploaded overlay from a scene. */
export async function clearPartsCsv(sceneId: string): Promise<void> {
  await updateDoc(doc(db, SCENES, sceneId), {
    // Firestore deletes a field when you set it to `null` via the
    // admin SDK only — from the client we use FieldValue.delete().
    // Spelt out here with `null` because that's what the existing
    // scene readers treat as "absent".
    partsCsvOverlay: null,
    updatedAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// P4.2 — Per-cabinet CSV overlay
// ---------------------------------------------------------------------------

const CABINETS = 'cabinets';

/**
 * Upload a CSV overlay scoped to a single cabinet. Uses the same
 * parser as the scene-level `uploadPartsCsv` but writes to the
 * cabinet doc instead of the scene doc.
 */
export async function uploadCabinetPartsCsv(
  sceneId: string,
  cabinetId: string,
  file: File,
  userId: string,
): Promise<UploadPartsCsvResult> {
  const text = await file.text();
  const parsed = parseCSV(text, file.name);

  if (!parsed.success || parsed.parts.length === 0) {
    throw new Error(
      parsed.errors[0]?.message
      ?? `Could not parse ${file.name} — detected format "${parsed.sourceType}" but no rows came through.`,
    );
  }

  const overlay: ScenePartsCsvOverlay = {
    fileName: file.name,
    sourceType: parsed.sourceType,
    rows: parsed.parts.map(p => ({
      name: p.name,
      length: p.length,
      width: p.width,
      thickness: p.thickness,
      quantity: p.quantity,
      materialName: p.materialName,
      materialCode: p.materialCode,
      grainDirection: p.grainDirection,
      edgeBanding: {
        top: !!p.edgeBanding?.top,
        bottom: !!p.edgeBanding?.bottom,
        left: !!p.edgeBanding?.left,
        right: !!p.edgeBanding?.right,
        ...(p.edgeBanding?.material ? { material: p.edgeBanding.material } : {}),
      },
      notes: p.notes,
      partType: p.partType,
      barProfile: p.barProfile,
    })),
    uploadedBy: userId,
    uploadedAt: Timestamp.now(),
  };

  const clean = {
    ...overlay,
    rows: overlay.rows.map(r => {
      const out: Record<string, unknown> = { ...r };
      if (r.materialCode === undefined) delete out.materialCode;
      if (r.notes === undefined) delete out.notes;
      if (r.barProfile === undefined) delete out.barProfile;
      if (r.edgeBanding?.material === undefined) {
        out.edgeBanding = {
          top: r.edgeBanding.top,
          bottom: r.edgeBanding.bottom,
          left: r.edgeBanding.left,
          right: r.edgeBanding.right,
        };
      }
      return out;
    }),
  };

  await updateDoc(doc(db, SCENES, sceneId, CABINETS, cabinetId), {
    partsCsvOverlay: clean,
    updatedAt: serverTimestamp(),
  });

  return {
    rows: parsed.parts.length,
    sourceType: parsed.sourceType,
    warnings: parsed.warnings,
    errors: parsed.errors,
    skipped: parsed.metadata.skippedRows,
  };
}

/** Remove a per-cabinet CSV overlay. */
export async function clearCabinetPartsCsv(
  sceneId: string,
  cabinetId: string,
): Promise<void> {
  await updateDoc(doc(db, SCENES, sceneId, CABINETS, cabinetId), {
    partsCsvOverlay: null,
    updatedAt: serverTimestamp(),
  });
}
