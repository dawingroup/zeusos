/**
 * FileUploadDialog
 * Upload with policy-compliant naming, version/replace intent, deliverable type selection
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { Upload, X, FileText, Loader2, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { cn } from '@/shared/lib/utils';
import type { FileCategory, ManagedFile } from '@/shared/services/fileManager';
import {
  uploadManagedFile,
  replaceFile,
  overwriteFile,
  validateFile,
  formatFileSize,
  CATEGORY_LABELS,
} from '@/shared/services/fileManager';
import {
  ALL_TYPE_CODES,
  DELIVERABLE_CODES,
  ITEM_CODES,
  DELIVERABLE_TYPE_CODES,
  buildPolicyName,
  toKebab,
  getExtension,
  formatVersion,
} from '@/shared/services/fileManager/namingPolicy';

interface FileUploadDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectCode?: string;
  itemId?: string;
  itemName?: string;
  module?: 'design-manager' | 'manufacturing' | 'shared';
  /** If set, we're replacing/versioning this file */
  replaceTarget?: ManagedFile;
  onUploadComplete: () => void;
  userId: string;
  userName?: string;
}

type ReplaceMode = 'new-version' | 'overwrite';

export function FileUploadDialog({
  open,
  onClose,
  projectId,
  projectCode,
  itemId,
  itemName,
  module = 'design-manager',
  replaceTarget,
  onUploadComplete,
  userId,
  userName,
}: FileUploadDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<FileCategory>(replaceTarget?.category || 'deliverable');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── New form fields ──
  const [replaceMode, setReplaceMode] = useState<ReplaceMode>('new-version');
  const [typeCode, setTypeCode] = useState<string>(
    replaceTarget?.deliverableType
      ? DELIVERABLE_TYPE_CODES[replaceTarget.deliverableType] || ''
      : ''
  );
  const [description, setDescription] = useState<string>(
    replaceTarget ? toKebab(replaceTarget.name.split('-').slice(2).join('-') || replaceTarget.name) : ''
  );
  const [isFinal, setIsFinal] = useState(false);
  // Admin override for the approval lock. The service accepts an
  // `allowApprovedOverride` flag which the Firestore rule ALSO gates
  // on admin role — so ticking this checkbox as a non-admin produces
  // a clear rule-side rejection rather than a silent success. We
  // don't detect admin client-side (AuthContext doesn't expose it);
  // we let the rule be the source of truth.
  const [overrideApproved, setOverrideApproved] = useState(false);

  // Next version number (for replace mode)
  const nextVersion = replaceTarget ? replaceTarget.version + 1 : 1;
  const targetIsApproved = replaceTarget?.status === 'approved';

  // Auto-generated policy name preview
  const policyNamePreview = useMemo(() => {
    if (!projectCode) return null;
    const ext = files[0] ? getExtension(files[0].name) : 'pdf';
    const version = replaceTarget
      ? (replaceMode === 'new-version' ? nextVersion : replaceTarget.version)
      : 1;
    return buildPolicyName({
      projectCode,
      typeCode: typeCode || undefined,
      description: description || 'untitled',
      version,
      isFinal,
      extension: ext,
    });
  }, [projectCode, typeCode, description, isFinal, files, replaceTarget, replaceMode, nextVersion]);

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    if (replaceTarget) {
      setFiles(fileArray.slice(0, 1));
    } else {
      setFiles((prev) => [...prev, ...fileArray]);
    }
    setError(null);
  }, [replaceTarget]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      if (replaceTarget && files[0]) {
        // ── Replace / Version / Overwrite ──
        const validation = validateFile(files[0], replaceTarget.category);
        if (!validation.valid) {
          setError(validation.error || 'Invalid file');
          setUploading(false);
          return;
        }

        // The approval lock guards against silent post-sign-off edits;
        // admins can override by ticking the checkbox. The Firestore
        // rule enforces the admin check — if the current user isn't
        // one, the service call throws and we surface the message.
        const allowOverride = targetIsApproved && overrideApproved;

        if (replaceMode === 'overwrite') {
          await overwriteFile(
            replaceTarget.id,
            files[0],
            policyNamePreview || undefined,
            userId,
            userName,
            allowOverride,
          );
        } else {
          await replaceFile(replaceTarget.id, files[0], userId, userName, allowOverride);
        }
      } else {
        // ── New file upload ──
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const validation = validateFile(file, category);
          if (!validation.valid) {
            setError(`${file.name}: ${validation.error}`);
            continue;
          }

          // Build policy name for this specific file
          const ext = getExtension(file.name);
          const filePolicyName = projectCode
            ? buildPolicyName({
                projectCode,
                typeCode: typeCode || undefined,
                description: description || toKebab(file.name.replace(/\.[^.]+$/, '')),
                version: 1,
                isFinal,
                extension: ext,
              })
            : undefined;

          const { promise } = uploadManagedFile(
            file,
            {
              projectId,
              projectCode,
              itemId,
              itemName,
              module,
              category,
              deliverableType: typeCode || undefined,
              policyName: filePolicyName,
              uploadedBy: userId,
              uploadedByName: userName,
            },
            (p) => {
              const fileProgress = ((i + p.percentage / 100) / files.length) * 100;
              setProgress(fileProgress);
            }
          );

          await promise;
        }
      }

      onUploadComplete();
      setFiles([]);
      setDescription('');
      setTypeCode('');
      setIsFinal(false);
      setOverrideApproved(false);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const categories: FileCategory[] = ['deliverable', 'client-document', 'production-doc', 'report'];
  const showTypeSelector = category === 'deliverable' || !!replaceTarget?.deliverableType;

  // Cancel / backdrop-close path — reset transient flags so they
  // don't leak into the next dialog open (particularly
  // `overrideApproved`, which is a security-relevant sticky state).
  const handleClose = useCallback(() => {
    if (uploading) return;
    setOverrideApproved(false);
    setError(null);
    onClose();
  }, [uploading, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {replaceTarget ? `Replace: ${replaceTarget.name}` : 'Upload Files'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── Version intent (replace mode only) ── */}
          {replaceTarget && (
            <div className="bg-[var(--bg-sunken)] rounded-lg p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Current: <span className="font-medium text-muted-foreground">{replaceTarget.name}</span>
                {' · '}
                {formatVersion(replaceTarget.version)}
              </p>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="replaceMode"
                    value="new-version"
                    checked={replaceMode === 'new-version'}
                    onChange={() => setReplaceMode('new-version')}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-sm">New version ({formatVersion(nextVersion)})</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="replaceMode"
                    value="overwrite"
                    checked={replaceMode === 'overwrite'}
                    onChange={() => setReplaceMode('overwrite')}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-sm text-[var(--rag-amber)]">Overwrite current</span>
                </label>
              </div>
              {/* Approval lock (Phase 1 F-E2) — when replacing an
                  approved file, non-admins are blocked at the rule
                  layer. Surface the gate + an admin-override checkbox
                  so the escalation path is explicit rather than
                  hidden behind a cryptic "permission denied" error. */}
              {targetIsApproved && (
                <div className="mt-2 border-t border-[var(--border-subtle)] pt-2">
                  <p className="text-xs text-[var(--rag-amber)] font-medium">
                    This file is marked Approved.
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Non-admins can&rsquo;t replace approved files. Mark it for review
                    first, or tick the override below if you have admin rights.
                  </p>
                  <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overrideApproved}
                      onChange={(e) => setOverrideApproved(e.target.checked)}
                      className="accent-[var(--rag-amber)]"
                    />
                    <span className="text-xs text-[var(--rag-amber)] font-medium">
                      Admin override — replace this approved file
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* ── Category selector (new upload only) ── */}
          {!replaceTarget && (
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-full border transition-colors',
                    category === cat
                      ? 'bg-gray-900 text-white border-[var(--border-strong)]'
                      : 'bg-card text-muted-foreground border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                  )}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          )}

          {/* ── Type code selector (deliverables) ── */}
          {showTypeSelector && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Document Type</label>
              <div className="flex gap-1.5 flex-wrap">
                {Object.entries(DELIVERABLE_CODES).map(([code, label]) => (
                  <button
                    key={code}
                    onClick={() => setTypeCode(typeCode === code ? '' : code)}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded border transition-colors',
                      typeCode === code
                        ? 'bg-[var(--rag-blue)] text-white border-[var(--rag-blue)]'
                        : 'bg-card text-muted-foreground border-[var(--border-subtle)] hover:border-[var(--rag-blue)]'
                    )}
                    title={label}
                  >
                    {code}
                  </button>
                ))}
                <span className="text-[var(--fg-tertiary)] self-center mx-1">|</span>
                {Object.entries(ITEM_CODES).map(([code, label]) => (
                  <button
                    key={code}
                    onClick={() => setTypeCode(typeCode === code ? '' : code)}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded border transition-colors',
                      typeCode === code
                        ? 'bg-[var(--rag-green)] text-white border-[var(--rag-green)]'
                        : 'bg-card text-muted-foreground border-[var(--border-subtle)] hover:border-[var(--rag-green)]'
                    )}
                    title={label}
                  >
                    {code}
                  </button>
                ))}
              </div>
              {typeCode && (
                <p className="text-xs text-[var(--fg-tertiary)] mt-1">{ALL_TYPE_CODES[typeCode]}</p>
              )}
            </div>
          )}

          {/* ── Description field ── */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => setDescription(toKebab(description))}
              placeholder="e.g. kitchen-layout"
              className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--border-default)]"
            />
          </div>

          {/* ── Mark as Final ── */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isFinal}
              onChange={(e) => setIsFinal(e.target.checked)}
              className="accent-[var(--accent)] rounded"
            />
            <span className="text-sm text-muted-foreground">Mark as Final</span>
          </label>

          {/* ── Policy name preview ── */}
          {policyNamePreview && (
            <div className="flex items-start gap-2 bg-[var(--rag-blue-soft)] rounded-lg p-2.5">
              <Info className="h-3.5 w-3.5 text-[var(--rag-blue)] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-[var(--rag-blue)] font-medium">File name (auto)</p>
                <p className="text-xs text-[var(--rag-blue)] font-mono break-all">{policyNamePreview}</p>
              </div>
            </div>
          )}

          {/* ── Drop zone ── */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
              dragOver ? 'border-[var(--rag-blue)] bg-[var(--rag-blue-soft)]' : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
            )}
          >
            <Upload className="h-6 w-6 mx-auto text-[var(--fg-tertiary)] mb-1.5" />
            <p className="text-sm text-muted-foreground">
              {replaceTarget ? 'Drop replacement file here' : 'Drop files here or click to browse'}
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple={!replaceTarget}
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              className="hidden"
            />
          </div>

          {/* ── File list ── */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {files.map((file, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-[var(--bg-sunken)] rounded-lg">
                  <FileText className="h-4 w-4 text-[var(--fg-tertiary)] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{file.name}</p>
                    <p className="text-xs text-[var(--fg-tertiary)]">{formatFileSize(file.size)}</p>
                  </div>
                  {!uploading && (
                    <button onClick={() => removeFile(i)} className="p-1 hover:bg-[var(--bg-sunken)] rounded">
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Progress ── */}
          {uploading && (
            <div className="w-full bg-[var(--bg-sunken)] rounded-full h-2">
              <div
                className="bg-[var(--rag-blue)] h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* ── Error ── */}
          {error && <p className="text-sm text-[var(--rag-red)]">{error}</p>}

          {/* ── Actions ── */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleClose}
              disabled={uploading}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className={cn(
                'px-4 py-2 text-sm text-white rounded-lg transition-colors',
                replaceMode === 'overwrite' && replaceTarget
                  ? 'bg-[var(--rag-amber)] hover:bg-[var(--rag-amber)]'
                  : 'bg-gray-900 hover:bg-gray-800',
                (uploading || files.length === 0) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Uploading...
                </span>
              ) : replaceTarget ? (
                replaceMode === 'overwrite' ? 'Overwrite File' : `Upload ${formatVersion(nextVersion)}`
              ) : (
                `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
