/**
 * Workshop Viewer ↔ Unified File Manager bridge.
 *
 * P21.5 — before this, a 3DS/DXF uploaded inside the Workshop Viewer
 * lived only in the bespoke `workshop-viewer/{timestamp}/` storage path
 * attached to a `ViewerSession`. Design Manager's File Manager never
 * saw it, so the model couldn't be re-opened from the project page, and
 * two sibling projects could each end up with a copy of "kitchen.3ds"
 * nobody knew was shared.
 *
 * This service funnels viewer-uploaded CAD files into the unified
 * `projectFiles` collection as `category: 'cad-model'` docs, linked to
 * the currently-bound DesignItem. Callers are expected to skip the
 * persist step when the file *came from* projectFiles originally
 * (auto-load from `?fileUrl=…`), so we don't create duplicates.
 *
 * Design choices:
 *   - Persist fires-and-forgets from the UI — the viewer UX can't block
 *     on a 200MB upload. Errors are surfaced via the returned promise
 *     for the caller to log.
 *   - We dedupe on `autoGenHash = sha256(file)` at the File Manager
 *     level where available; for now the naive check is "does the
 *     project already have a non-archived cad-model with the same
 *     filename?", which matches user intent (overwriting my latest
 *     kitchen model) without tracking bit-identity.
 */
import {
  uploadManagedFile,
  getProjectFiles,
  isCadModelFileName,
} from '@/shared/services/fileManager';
import type { ManagedFile, FileUploadProgress } from '@/shared/services/fileManager/types';

export interface PersistWorkshopUploadContext {
  projectId: string;
  /** Policy-compliant project code (e.g. `DF-2025-001`) — forwarded to `projectFiles` for Drive/policy joins. */
  projectCode?: string;
  itemId: string;
  itemName?: string;
  userId: string;
  /** Uploader display name — forwarded for UI (File Manager version history shows this). */
  userName?: string;
  /**
   * When set, the service will NOT re-upload a file whose name matches
   * an existing latest `cad-model` under this item. Useful to avoid
   * duplicating the file the viewer just auto-loaded from a URL.
   * Defaults to `true` — safer than aggressive uploads.
   */
  skipIfNameExists?: boolean;
  onProgress?: (progress: FileUploadProgress) => void;
}

export interface PersistWorkshopUploadResult {
  /** The managed file doc (newly created or the dedupe hit). */
  file: ManagedFile | null;
  /** True when we short-circuited via `skipIfNameExists`. */
  skipped: boolean;
  reason?: string;
}

/**
 * Save a Workshop Viewer–sourced CAD file into the unified File Manager.
 *
 * Returns `{ file: null, skipped: true }` for any case where we
 * intentionally didn't write — dedupe hit, non-CAD filename, missing
 * context. Callers should treat those as success (not an error).
 */
export async function persistWorkshopUploadToProjectFiles(
  file: File,
  ctx: PersistWorkshopUploadContext,
): Promise<PersistWorkshopUploadResult> {
  if (!isCadModelFileName(file.name)) {
    return {
      file: null,
      skipped: true,
      reason: `Not a CAD model filename (${file.name})`,
    };
  }
  if (!ctx.projectId || !ctx.itemId) {
    return {
      file: null,
      skipped: true,
      reason: 'Missing projectId or itemId — viewer session is standalone',
    };
  }

  const skipIfNameExists = ctx.skipIfNameExists ?? true;
  if (skipIfNameExists) {
    const existing = await getProjectFiles(ctx.projectId, {
      itemId: ctx.itemId,
      category: 'cad-model',
      isLatest: true,
    });
    const hit = existing.find(f => f.fileName === file.name);
    if (hit) {
      return {
        file: hit,
        skipped: true,
        reason: `Item already has a latest cad-model named "${file.name}" — leaving it`,
      };
    }
  }

  const { promise } = uploadManagedFile(
    file,
    {
      projectId: ctx.projectId,
      projectCode: ctx.projectCode,
      itemId: ctx.itemId,
      itemName: ctx.itemName,
      module: 'design-manager',
      category: 'cad-model',
      // Mark Studio CAD uploads as a design deliverable too so
      // Design Manager matrices + RAG auto-updates recognize them.
      deliverableType: '3d-model',
      uploadedBy: ctx.userId,
      uploadedByName: ctx.userName,
      tags: ['workshop-viewer-upload'],
    },
    ctx.onProgress,
  );

  const saved = await promise;
  return { file: saved, skipped: false };
}
