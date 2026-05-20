/**
 * Drive Folder Settings — admin service.
 *
 * Reads / writes the `systemSettings/driveFolders` doc and exposes
 * the `verifyDriveFolder` callable. All callers are the settings
 * page + the one hook below.
 */

import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  deleteField,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from '@/shared/services/firebase/firestore';
import { functions } from '@/core/services/firebase/functions';
import type {
  DriveFolderSettings,
  DriveFolderSlot,
  FolderBinding,
} from '../types/driveFolderSettings';

const DOC_PATH = ['systemSettings', 'driveFolders'] as const;
const DOC_ID = DOC_PATH[1];

// ─── Subscribe ────────────────────────────────────────────────────────

/**
 * Real-time subscription to the settings doc. Returns an unsub fn.
 * Calls back with an empty shell when the doc doesn't exist yet —
 * the admin UI always needs a value to render against.
 */
export function subscribeToDriveFolderSettings(
  callback: (settings: DriveFolderSettings) => void,
): () => void {
  const ref = doc(db, DOC_PATH[0], DOC_ID);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback({ id: DOC_ID, bindings: {} });
        return;
      }
      const data = snap.data() as Partial<DriveFolderSettings>;
      callback({
        id: DOC_ID,
        bindings: data.bindings ?? {},
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
        serviceAccountEmail: data.serviceAccountEmail,
        serviceAccountEmailSyncedAt: data.serviceAccountEmailSyncedAt,
      });
    },
    (err) => {
      console.error('[driveFolderSettings] subscribe error:', err);
      // Keep the UI alive on error — empty shell is safe.
      callback({ id: DOC_ID, bindings: {} });
    },
  );
}

// ─── Write a single slot ──────────────────────────────────────────────

/**
 * Upsert a single slot's binding. Uses `setDoc(..., { merge: true })`
 * so other slots stay intact and the parent doc is created on first
 * write. Stamps `updatedAt`/`updatedBy` at the doc level.
 */
export async function saveFolderBinding(
  slot: DriveFolderSlot,
  binding: FolderBinding | null,
  userId: string,
): Promise<void> {
  const ref = doc(db, DOC_PATH[0], DOC_ID);
  // `deleteField()` clears a slot; `null` binding means "unset".
  const slotValue = binding === null ? deleteField() : binding;
  await setDoc(
    ref,
    {
      bindings: { [slot]: slotValue },
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    },
    { merge: true },
  );
}

// ─── Verify callable ──────────────────────────────────────────────────

export interface VerifyResult {
  ok: boolean;
  folderId: string;
  name?: string;
  webViewLink?: string;
  itemCount?: number;
  driveId?: string | null;
  error?: string;
}

/**
 * Invoke the `verifyDriveFolder` callable. Returns the CF's result
 * unchanged. Throws only on transport errors (rare); validation /
 * auth / folder-not-found failures come back as `{ ok: false, error }`.
 */
export async function verifyDriveFolder(folderId: string): Promise<VerifyResult> {
  const callable = httpsCallable<{ folderId: string }, VerifyResult>(
    functions,
    'verifyDriveFolder',
  );
  const resp = await callable({ folderId: folderId.trim() });
  return resp.data;
}

/**
 * Convenience — run `verifyDriveFolder` and persist the resulting
 * folder metadata + verify timestamp onto the slot binding in one
 * shot. Returns the verify result so the UI can show a toast.
 */
export async function verifyAndRecord(
  slot: DriveFolderSlot,
  folderId: string,
  userId: string,
): Promise<VerifyResult> {
  const result = await verifyDriveFolder(folderId);
  const ref = doc(db, DOC_PATH[0], DOC_ID);

  if (result.ok) {
    // Success — write all the per-slot fields AND explicitly clear
    // any stale `lastVerifyError` via `deleteField()`. Firestore's
    // `ignoreUndefinedProperties` would otherwise silently drop
    // `undefined` and leave the error stamped from a prior failure.
    await setDoc(
      ref,
      {
        bindings: {
          [slot]: {
            folderId: result.folderId,
            folderName: result.name,
            itemCount: result.itemCount,
            lastVerifiedAt: serverTimestamp(),
            lastVerifiedBy: userId,
            lastVerifyError: deleteField(),
          },
        },
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      },
      { merge: true },
    );
  } else {
    // Persist the error so the next page load surfaces it without
    // requiring the admin to re-click Verify. Keep whatever name /
    // itemCount was last verified intact (merge-only) so the UI
    // shows "last known good: Foo" beside the fresh error.
    await setDoc(
      ref,
      {
        bindings: {
          [slot]: {
            folderId,
            lastVerifyError: result.error,
            lastVerifiedBy: userId,
          },
        },
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      },
      { merge: true },
    );
  }
  return result;
}

// ─── Parse a Drive URL into a bare folder ID ──────────────────────────

/**
 * Accept either a bare ID or a full Drive folder URL and return the
 * bare ID. Matches the patterns Drive emits for shared drives + folders:
 *   https://drive.google.com/drive/folders/<ID>?usp=sharing
 *   https://drive.google.com/drive/u/0/folders/<ID>
 *   https://drive.google.com/open?id=<ID>
 */
export function parseFolderIdFromInput(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  // URL forms
  const folderMatch = trimmed.match(/\/folders\/([A-Za-z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const openMatch = trimmed.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (openMatch) return openMatch[1];
  // Bare ID — ad-hoc Drive IDs are 25+ chars of [A-Za-z0-9_-]
  if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return trimmed; // let the callable return a clean "not found" if wrong
}
