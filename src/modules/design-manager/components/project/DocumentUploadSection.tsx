/**
 * Document Upload Section
 * Drag-and-drop upload UI for client documents with AI analysis
 */

import { useState, useCallback, useRef } from 'react';
import { Upload, FileImage, FileText, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type {
  ClientDocument,
  ClientDocumentCategory,
  UploadProgress,
} from '../../types/document.types';
import {
  getCategoryDisplayName,
  formatFileSize,
} from '../../types/document.types';
import { uploadDocument } from '../../services/documentUpload';

export interface DocumentUploadSectionProps {
  projectId: string;
  projectCode: string;
  userId: string;
  userName: string;
  onUploadComplete?: (document: ClientDocument) => void;
  onUploadError?: (error: string) => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
  document?: ClientDocument;
}

export function DocumentUploadSection({
  projectId,
  projectCode,
  userId,
  userName,
  onUploadComplete,
  onUploadError,
}: DocumentUploadSectionProps) {
  const [category, setCategory] = useState<ClientDocumentCategory>('reference-images');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, UploadingFile>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories: ClientDocumentCategory[] = [
    'reference-images',
    'cad-drawings',
    'pdf-plans',
    'design-briefs',
    'other',
  ];

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    },
    [category]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const files = Array.from(e.target.files);
        handleFiles(files);
      }
    },
    [category]
  );

  const handleFiles = async (files: File[]) => {
    for (const file of files) {
      const fileId = `${file.name}-${Date.now()}`;

      // Initialize upload state
      setUploadingFiles((prev) => {
        const next = new Map(prev);
        next.set(fileId, {
          file,
          progress: 0,
          status: 'uploading',
        });
        return next;
      });

      try {
        // Start upload
        const { promise } = await uploadDocument(
          {
            file,
            category,
            projectId,
            projectCode,
            triggerAI: true,
          },
          userId,
          userName,
          (progress: UploadProgress) => {
            setUploadingFiles((prev) => {
              const next = new Map(prev);
              const existing = next.get(fileId);
              if (existing) {
                next.set(fileId, {
                  ...existing,
                  progress: progress.percentage,
                });
              }
              return next;
            });
          }
        );

        const result = await promise;

        if (result.success && result.document) {
          // Update to success
          setUploadingFiles((prev) => {
            const next = new Map(prev);
            next.set(fileId, {
              file,
              progress: 100,
              status: 'success',
              document: result.document,
            });
            return next;
          });

          onUploadComplete?.(result.document);

          // Remove from list after 3 seconds
          setTimeout(() => {
            setUploadingFiles((prev) => {
              const next = new Map(prev);
              next.delete(fileId);
              return next;
            });
          }, 3000);
        } else {
          throw new Error(result.error || 'Upload failed');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        setUploadingFiles((prev) => {
          const next = new Map(prev);
          next.set(fileId, {
            file,
            progress: 0,
            status: 'error',
            error: errorMessage,
          });
          return next;
        });

        onUploadError?.(errorMessage);

        // Remove from list after 5 seconds
        setTimeout(() => {
          setUploadingFiles((prev) => {
            const next = new Map(prev);
            next.delete(fileId);
            return next;
          });
        }, 5000);
      }
    }
  };

  const getCategoryIcon = (cat: ClientDocumentCategory) => {
    switch (cat) {
      case 'reference-images':
        return '🖼️';
      case 'cad-drawings':
        return '📐';
      case 'pdf-plans':
        return '📄';
      case 'design-briefs':
        return '📋';
      case 'other':
        return '📎';
    }
  };

  const getCategoryDescription = (cat: ClientDocumentCategory) => {
    switch (cat) {
      case 'reference-images':
        return 'JPEG, PNG, WebP (max 20MB) • Triggers Image Analysis AI';
      case 'cad-drawings':
        return 'DWG, DXF (max 100MB) • No AI analysis';
      case 'pdf-plans':
        return 'PDF (max 50MB) • No AI analysis';
      case 'design-briefs':
        return 'PDF (max 10MB) • Triggers Project Scoping AI';
      case 'other':
        return 'Any file type (max 50MB)';
    }
  };

  return (
    <div className="space-y-4">
      {/* Category Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Document Category
        </label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all',
                category === cat
                  ? 'border-[#0A7C8E] bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <span className="text-2xl mb-1">{getCategoryIcon(cat)}</span>
              <span className="text-xs font-medium text-gray-900">
                {getCategoryDisplayName(cat)}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {getCategoryDescription(category)}
        </p>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all',
          isDragging
            ? 'border-[#0A7C8E] bg-gray-50'
            : 'border-gray-300 hover:border-gray-400'
        )}
      >
        <Upload className={cn('w-12 h-12 mx-auto mb-4', isDragging ? 'text-[#0A7C8E]' : 'text-gray-400')} />
        <p className="text-sm font-medium text-gray-900 mb-1">
          Drop files here or click to browse
        </p>
        <p className="text-xs text-gray-500">
          {getCategoryDescription(category)}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept={
            category === 'reference-images'
              ? 'image/jpeg,image/png,image/webp'
              : category === 'cad-drawings'
              ? '.dwg,.dxf'
              : category === 'pdf-plans' || category === 'design-briefs'
              ? 'application/pdf'
              : undefined
          }
        />
      </div>

      {/* Uploading Files */}
      {uploadingFiles.size > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-900">Uploading Files</h3>
          <div className="space-y-2">
            {Array.from(uploadingFiles.values()).map((uploadingFile, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                {/* Icon */}
                <div className="flex-shrink-0">
                  {uploadingFile.file.type.startsWith('image/') ? (
                    <FileImage className="w-8 h-8 text-gray-400" />
                  ) : (
                    <FileText className="w-8 h-8 text-gray-400" />
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {uploadingFile.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(uploadingFile.file.size)}
                  </p>

                  {/* Progress Bar */}
                  {uploadingFile.status === 'uploading' && (
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-[#0A7C8E] h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${uploadingFile.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Error Message */}
                  {uploadingFile.status === 'error' && uploadingFile.error && (
                    <p className="mt-1 text-xs text-red-600">{uploadingFile.error}</p>
                  )}
                </div>

                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {uploadingFile.status === 'uploading' && (
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  )}
                  {uploadingFile.status === 'success' && (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  )}
                  {uploadingFile.status === 'error' && (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentUploadSection;
