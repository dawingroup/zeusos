/**
 * BulkFileUploadDialog Component
 * Upload a design file and assign it as a deliverable to multiple design items.
 * Updates RAG status based on deliverable type and optional manual overrides.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  FileUp,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import type { DesignItem, DeliverableType, RAGStatusValue } from '../../types';
import { StageBadge } from '../design-item/StageBadge';
import {
  uploadFileForMultipleItems,
  type BulkFileUploadResult,
} from '../../services/bulkDesignOperationsService';
import { validateDeliverableFile } from '../../services/storage';
import type { UploadProgress } from '../../services/storage';
import {
  DELIVERABLE_TYPES,
  DELIVERABLE_RAG_PATHS as AUTO_RAG_PREVIEW,
  ALL_RAG_ASPECTS as RAG_ASPECTS,
} from '../../constants/deliverableConstants';

// ============================================
// Component
// ============================================

interface BulkFileUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  selectedIds: Set<string>;
  allItems: DesignItem[];
  projectId: string;
  userId: string;
  /** Pre-select deliverable type when opened from the deliverables matrix */
  defaultDeliverableType?: DeliverableType;
}

type Step = 'configure' | 'uploading' | 'done' | 'error';

export function BulkFileUploadDialog({
  open,
  onClose,
  onComplete,
  selectedIds,
  allItems,
  projectId,
  userId,
  defaultDeliverableType,
}: BulkFileUploadDialogProps) {
  const [step, setStep] = useState<Step>('configure');
  const [file, setFile] = useState<File | null>(null);
  const [deliverableType, setDeliverableType] = useState<DeliverableType>(defaultDeliverableType || 'other');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coversTypes, setCoversTypes] = useState<Set<DeliverableType>>(new Set());
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set(selectedIds));
  const [showRagSection, setShowRagSection] = useState(false);
  const [ragOverrides, setRagOverrides] = useState<Record<string, RAGStatusValue>>({});
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [assignmentProgress, setAssignmentProgress] = useState('');
  const [result, setResult] = useState<BulkFileUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const selectedItems = useMemo(
    () => allItems.filter((item) => selectedIds.has(item.id)),
    [allItems, selectedIds]
  );

  const autoRagAspects = useMemo(
    () => AUTO_RAG_PREVIEW[deliverableType] || [],
    [deliverableType]
  );

  const manualRagAspects = useMemo(
    () => RAG_ASPECTS.filter((a) => !autoRagAspects.includes(a.path)),
    [autoRagAspects]
  );

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      const validation = validateDeliverableFile(selectedFile, deliverableType);
      if (!validation.valid) {
        setFileError(validation.error || 'Invalid file');
        return;
      }
      setFile(selectedFile);
      setFileError(null);
      if (!name) {
        setName(selectedFile.name.replace(/\.[^.]+$/, ''));
      }
    },
    [deliverableType, name]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect]
  );

  const toggleCoverType = useCallback((type: DeliverableType) => {
    setCoversTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const toggleItem = useCallback((itemId: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file || checkedItems.size === 0) return;

    setStep('uploading');
    setAssignmentProgress('Uploading file...');

    try {
      const ragAspectUpdates = Object.entries(ragOverrides)
        .filter(([, status]) => status !== ('none' as RAGStatusValue))
        .map(([aspectPath, status]) => ({
          aspectPath,
          status,
          notes: `Bulk upload: ${name || file.name}`,
        }));

      const res = await uploadFileForMultipleItems(
        projectId,
        Array.from(checkedItems),
        {
          file,
          deliverableType,
          name: name || file.name,
          description: description || undefined,
          coversTypes: coversTypes.size > 0 ? Array.from(coversTypes) : undefined,
          ragAspectUpdates: ragAspectUpdates.length > 0 ? ragAspectUpdates : undefined,
        },
        userId,
        (progress) => {
          setUploadProgress(progress);
          if (progress.state === 'success') {
            setAssignmentProgress('Assigning to design items...');
          }
        }
      );

      setResult(res);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setStep('error');
    }
  }, [
    file,
    checkedItems,
    ragOverrides,
    projectId,
    deliverableType,
    name,
    description,
    coversTypes,
    userId,
  ]);

  const handleClose = useCallback(() => {
    if (step === 'done') {
      onComplete();
    } else {
      onClose();
    }
    // Reset state
    setStep('configure');
    setFile(null);
    setDeliverableType('other');
    setName('');
    setDescription('');
    setCoversTypes(new Set());
    setCheckedItems(new Set(selectedIds));
    setShowRagSection(false);
    setRagOverrides({});
    setUploadProgress(null);
    setAssignmentProgress('');
    setResult(null);
    setError(null);
    setFileError(null);
  }, [step, onClose, onComplete, selectedIds]);

  const canUpload = file && checkedItems.size > 0 && name.trim();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Bulk File Upload
          </DialogTitle>
        </DialogHeader>

        {/* Configure step */}
        {step === 'configure' && (
          <div className="space-y-5">
            {/* File picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Design File
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  isDragOver
                    ? 'border-blue-400 bg-blue-50'
                    : file
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileUp className="w-5 h-5 text-green-600" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setFile(null);
                        setFileError(null);
                      }}
                      className="text-xs text-gray-500 hover:text-red-600 ml-2"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      Drag & drop a file here, or{' '}
                      <label className="text-blue-600 cursor-pointer hover:underline">
                        browse
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFileSelect(f);
                          }}
                        />
                      </label>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Max 100MB</p>
                  </div>
                )}
              </div>
              {fileError && (
                <p className="text-xs text-red-600 mt-1">{fileError}</p>
              )}
            </div>

            {/* Deliverable type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deliverable Type
                </label>
                <select
                  value={deliverableType}
                  onChange={(e) => {
                    setDeliverableType(e.target.value as DeliverableType);
                    // Re-validate file if already selected
                    if (file) {
                      const validation = validateDeliverableFile(
                        file,
                        e.target.value as DeliverableType
                      );
                      if (!validation.valid) {
                        setFileError(validation.error || 'Invalid file for this type');
                      } else {
                        setFileError(null);
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {DELIVERABLE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Deliverable name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                placeholder="Optional notes about this file..."
              />
            </div>

            {/* Also covers */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                This file also covers:
              </label>
              <div className="flex flex-wrap gap-2">
                {DELIVERABLE_TYPES.filter((t) => t.value !== deliverableType).map(
                  (t) => (
                    <label
                      key={t.value}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs cursor-pointer border transition-colors ${
                        coversTypes.has(t.value)
                          ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={coversTypes.has(t.value)}
                        onChange={() => toggleCoverType(t.value)}
                      />
                      {t.label}
                    </label>
                  )
                )}
              </div>
            </div>

            {/* Item assignment */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Assign to Items ({checkedItems.size} of {selectedItems.length})
                </label>
                <button
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => {
                    if (checkedItems.size === selectedItems.length) {
                      setCheckedItems(new Set());
                    } else {
                      setCheckedItems(new Set(selectedItems.map((i) => i.id)));
                    }
                  }}
                >
                  {checkedItems.size === selectedItems.length
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
              </div>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {selectedItems.map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                      checkedItems.has(item.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checkedItems.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">
                        {item.itemCode} — {item.name}
                      </span>
                    </div>
                    <StageBadge stage={item.currentStage} size="xs" />
                  </label>
                ))}
              </div>
            </div>

            {/* RAG aspect updates */}
            <div className="border border-gray-200 rounded-lg">
              <button
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setShowRagSection(!showRagSection)}
              >
                <span>Update Design Readiness</span>
                {showRagSection ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showRagSection && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-200">
                  {/* Auto-updated preview */}
                  {autoRagAspects.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-1.5">
                        Automatically set to Green:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {autoRagAspects.map((path) => {
                          const aspect = RAG_ASPECTS.find(
                            (a) => a.path === path
                          );
                          return (
                            <span
                              key={path}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {aspect?.label || path}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Manual overrides */}
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-2">
                      Additional aspects to update:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {manualRagAspects.map((aspect) => (
                        <div
                          key={aspect.path}
                          className="flex items-center gap-2"
                        >
                          <span className="text-xs text-gray-600 flex-1 truncate">
                            {aspect.label}
                          </span>
                          <select
                            value={ragOverrides[aspect.path] || ''}
                            onChange={(e) => {
                              const val = e.target.value as RAGStatusValue | '';
                              setRagOverrides((prev) => {
                                const next = { ...prev };
                                if (val) {
                                  next[aspect.path] = val;
                                } else {
                                  delete next[aspect.path];
                                }
                                return next;
                              });
                            }}
                            className="w-28 px-1.5 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">Don't update</option>
                            <option value="green">Green</option>
                            <option value="amber">Amber</option>
                            <option value="not-applicable">
                              Not Applicable
                            </option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Uploading step */}
        {step === 'uploading' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            {uploadProgress && uploadProgress.state !== 'success' ? (
              <div className="w-64">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Uploading...</span>
                  <span>{Math.round(uploadProgress.percentage)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress.percentage}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">{assignmentProgress}</p>
            )}
          </div>
        )}

        {/* Done step */}
        {step === 'done' && result && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-6 gap-2">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
              <p className="text-lg font-medium">Upload Complete</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <p>
                <span className="text-gray-500">File:</span>{' '}
                <span className="font-medium">{file?.name}</span>
              </p>
              <p>
                <span className="text-gray-500">Size:</span>{' '}
                {((result.fileSize || 0) / (1024 * 1024)).toFixed(2)} MB
              </p>
              <p className="text-green-700">
                Assigned to {result.successCount} item
                {result.successCount !== 1 ? 's' : ''} successfully
              </p>
              {result.failureCount > 0 && (
                <p className="text-red-700">
                  {result.failureCount} item{result.failureCount !== 1 ? 's' : ''} failed
                </p>
              )}
            </div>

            {result.results.some((r) => !r.success) && (
              <div className="bg-red-50 rounded-lg p-3">
                <h4 className="text-sm font-medium text-red-700 mb-1">
                  Failed Items
                </h4>
                {result.results
                  .filter((r) => !r.success)
                  .map((r) => (
                    <p key={r.itemId} className="text-xs text-red-600">
                      {r.itemName}: {r.error}
                    </p>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Error step */}
        {step === 'error' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <XCircle className="w-10 h-10 text-red-500" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <DialogFooter>
          {step === 'configure' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={!canUpload}>
                <Upload className="w-4 h-4 mr-1.5" />
                Upload & Assign to {checkedItems.size} Item
                {checkedItems.size !== 1 ? 's' : ''}
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={handleClose}>Done</Button>
          )}
          {step === 'error' && (
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
