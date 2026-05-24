/**
 * Single-slot row on the Drive Folder Settings page.
 *
 * Displays the slot label + policy path + live binding state, lets
 * the admin paste a folder ID (or URL, which is auto-parsed), and
 * exposes two actions:
 *   - **Verify**: round-trips the ID through the service account. On
 *     success, persists the folder name + timestamp. On failure,
 *     persists the error so it's visible on next page load.
 *   - **Clear**: removes the binding entirely (slot falls back to
 *     env-var / Phase-0 state).
 */

import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Trash2,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import {
  parseFolderIdFromInput,
  saveFolderBinding,
  verifyAndRecord,
  type VerifyResult,
} from '../services/driveFolderSettingsService';
import type {
  FolderBinding,
  SlotDescriptor,
} from '../types/driveFolderSettings';

interface DriveFolderSlotCardProps {
  descriptor: SlotDescriptor;
  binding: FolderBinding | undefined;
  userId: string;
  disabled?: boolean;
}

function formatTimestamp(
  ts: FolderBinding['lastVerifiedAt'] | undefined,
): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : null;
  return d ? d.toLocaleString() : '';
}

export function DriveFolderSlotCard({
  descriptor,
  binding,
  userId,
  disabled = false,
}: DriveFolderSlotCardProps) {
  const [draftId, setDraftId] = useState(binding?.folderId || '');
  const [verifying, setVerifying] = useState(false);
  const [lastVerify, setLastVerify] = useState<VerifyResult | null>(null);
  const [clearing, setClearing] = useState(false);

  // Keep `draftId` in sync when the doc updates out-of-band (e.g.
  // another admin edits the same slot). Only overwrite when the user
  // isn't actively editing an unsaved value.
  useEffect(() => {
    if (!verifying && binding?.folderId !== undefined && draftId !== binding.folderId) {
      // If the input still matches the previously-saved value, take
      // the new one. Otherwise respect the admin's in-progress edit.
      setDraftId(binding.folderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally narrow
  }, [binding?.folderId]);

  const draftParsed = parseFolderIdFromInput(draftId);
  const hasUnsavedChanges = draftParsed !== (binding?.folderId || '');
  const verifiedAt = formatTimestamp(binding?.lastVerifiedAt);

  const onVerify = async () => {
    if (!draftParsed) return;
    setVerifying(true);
    setLastVerify(null);
    try {
      const result = await verifyAndRecord(descriptor.slot, draftParsed, userId);
      setLastVerify(result);
    } catch (err) {
      setLastVerify({
        ok: false,
        folderId: draftParsed,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setVerifying(false);
    }
  };

  const onClear = async () => {
    if (!window.confirm(`Clear the "${descriptor.label}" folder ID? The Drive bridge will fall back to the env-var value (if any).`)) {
      return;
    }
    setClearing(true);
    try {
      await saveFolderBinding(descriptor.slot, null, userId);
      setDraftId('');
      setLastVerify(null);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div
      className={cn(
        'border border-[var(--border-subtle)] rounded-lg p-4 bg-card',
        descriptor.parentSlot && 'ml-6 border-l-2 border-l-gray-100',
      )}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">{descriptor.label}</h3>
            <span className="text-[10px] uppercase tracking-wide bg-[var(--bg-sunken)] text-muted-foreground px-1.5 py-0.5 rounded">
              Phase {descriptor.phase}
            </span>
            {descriptor.pendingPolicyAmendment && (
              <span
                className="text-[10px] uppercase tracking-wide bg-[var(--rag-amber-soft)] text-[var(--rag-amber)] px-1.5 py-0.5 rounded"
                title="This folder is not in v3 yet — requires a formal v3.1 §3 amendment before it's created. Bindings here are permitted but the policy doc should catch up."
              >
                Policy pending
              </span>
            )}
            {binding?.folderId && !binding.lastVerifyError && (
              <CheckCircle2 className="h-4 w-4 text-[var(--rag-green)]" />
            )}
            {binding?.lastVerifyError && (
              <AlertCircle className="h-4 w-4 text-[var(--rag-red)]" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{descriptor.hint}</p>
          <p className="text-[11px] font-mono text-[var(--fg-tertiary)] mt-0.5">
            {descriptor.policyPath}
          </p>
        </div>
        {binding?.folderId && (
          <a
            href={`https://drive.google.com/drive/folders/${binding.folderId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--rag-blue)] hover:underline inline-flex items-center gap-1 shrink-0"
            title="Open in Drive"
          >
            Open <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="space-y-2 mt-3">
        <Label htmlFor={`folder-${descriptor.slot}`} className="text-xs">
          Folder ID or URL
        </Label>
        <div className="flex gap-2">
          <Input
            id={`folder-${descriptor.slot}`}
            value={draftId}
            onChange={(e) => setDraftId(e.target.value)}
            placeholder="1AbCdEf… or paste the folder URL"
            disabled={disabled || verifying || clearing}
            className="font-mono text-xs"
          />
          <Button
            onClick={onVerify}
            disabled={!draftParsed || verifying || disabled}
            size="sm"
            variant="default"
          >
            {verifying ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Verifying
              </>
            ) : (
              'Verify & Save'
            )}
          </Button>
          {binding?.folderId && (
            <Button
              onClick={onClear}
              disabled={disabled || clearing}
              size="sm"
              variant="ghost"
              title="Clear this binding"
            >
              {clearing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>

        {hasUnsavedChanges && draftParsed && !verifying && (
          <p className="text-xs text-[var(--rag-amber)]">
            Unsaved change — click Verify &amp; Save to apply.
          </p>
        )}

        {/* Last verify result — either from this session's Verify click
            or from a prior session (via binding.lastVerifyError). */}
        {lastVerify?.ok && (
          <div className="text-xs text-[var(--rag-green)] bg-[var(--rag-green-soft)] border border-[var(--rag-green)] rounded-md p-2">
            <div className="flex items-center gap-1 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> {lastVerify.name}
            </div>
            <p className="text-[var(--rag-green)] mt-0.5">
              {lastVerify.itemCount} item{lastVerify.itemCount === 1 ? '' : 's'} at verify time.
            </p>
          </div>
        )}
        {lastVerify && !lastVerify.ok && (
          <div className="text-xs text-[var(--rag-red)] bg-[var(--rag-red-soft)] border border-[var(--rag-red)] rounded-md p-2">
            <div className="flex items-center gap-1 font-medium">
              <AlertCircle className="h-3.5 w-3.5" /> Verification failed
            </div>
            <p className="text-[var(--rag-red)] mt-0.5 whitespace-pre-wrap">{lastVerify.error}</p>
          </div>
        )}
        {!lastVerify && binding?.lastVerifyError && (
          <div className="text-xs text-[var(--rag-red)] bg-[var(--rag-red-soft)] border border-[var(--rag-red)] rounded-md p-2">
            <div className="flex items-center gap-1 font-medium">
              <AlertCircle className="h-3.5 w-3.5" /> Last verify failed
            </div>
            <p className="text-[var(--rag-red)] mt-0.5 whitespace-pre-wrap">
              {binding.lastVerifyError}
            </p>
          </div>
        )}
        {!lastVerify && !binding?.lastVerifyError && binding?.folderName && verifiedAt && (
          <p className="text-[11px] text-muted-foreground">
            Resolved to <span className="font-medium text-muted-foreground">{binding.folderName}</span>{' '}
            · verified {verifiedAt}
          </p>
        )}
      </div>
    </div>
  );
}
