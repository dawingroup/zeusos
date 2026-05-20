/**
 * Deliverable Upload Component
 * File upload with drag-and-drop for product deliverables
 */

import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, File, Image, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import type { DeliverableType, PipelineStage } from '../../types/stage.types';
import { formatDeliverableType } from '../../utils/formatting';

interface UploadFile {
  id: string;
  file: File;
  name: string;
  type: DeliverableType;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  altText?: string;
}

interface DeliverableUploadProps {
  stage: PipelineStage;
  requiredTypes?: DeliverableType[];
  onUpload: (files: { file: File; type: DeliverableType; altText?: string }[]) => Promise<void>;
  maxFileSize?: number; // in bytes
  acceptedTypes?: string; // MIME types
  className?: string;
}

// Deliverable types that are typically images
const IMAGE_DELIVERABLE_TYPES: DeliverableType[] = [
  'reference_images',
  'hero_images',
  'detail_shots',
  'lifestyle_photos',
  '360_views',
];

// Auto-detect deliverable type from file
const detectDeliverableType = (file: File, stage: PipelineStage): DeliverableType => {
  const isImage = file.type.startsWith('image/');
  const fileName = file.name.toLowerCase();

  // Stage-specific defaults
  const stageDefaults: Record<PipelineStage, DeliverableType> = {
    idea: 'concept_brief',
    research: 'competitor_analysis',
    design: 'cad_files',
    prototype: 'qc_notes',
    photography: 'hero_images',
    documentation: 'product_description',
    launched: 'product_description',
  };

  // File name hints
  if (fileName.includes('hero') || fileName.includes('main')) return 'hero_images';
  if (fileName.includes('detail') || fileName.includes('closeup')) return 'detail_shots';
  if (fileName.includes('lifestyle')) return 'lifestyle_photos';
  if (fileName.includes('360')) return '360_views';
  if (fileName.includes('cad') || fileName.includes('.skp')) return 'cad_files';
  if (fileName.includes('drawing')) return 'technical_drawings';
  if (fileName.includes('bom')) return 'bom_draft';
  if (fileName.includes('cutlist')) return 'cutlist';
  if (fileName.includes('competitor')) return 'competitor_analysis';
  if (fileName.includes('pricing')) return 'pricing_strategy';

  // Default by file type and stage
  if (isImage && IMAGE_DELIVERABLE_TYPES.some(t => stageDefaults[stage] === t)) {
    return stageDefaults[stage];
  }

  return stageDefaults[stage];
};

const generateId = () => Math.random().toString(36).substring(2, 9);

export const DeliverableUpload: React.FC<DeliverableUploadProps> = ({
  stage,
  requiredTypes,
  onUpload,
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  acceptedTypes = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.skp,.dwg',
  className = '',
}) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);

    const uploadFiles: UploadFile[] = fileArray.map((file) => {
      const id = generateId();
      let error: string | undefined;

      if (file.size > maxFileSize) {
        error = `File too large (max ${Math.round(maxFileSize / 1024 / 1024)}MB)`;
      }

      return {
        id,
        file,
        name: file.name,
        type: detectDeliverableType(file, stage),
        progress: 0,
        status: error ? 'error' : 'pending',
        error,
      };
    });

    setFiles((prev) => [...prev, ...uploadFiles]);
  }, [stage, maxFileSize]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files.length) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addFiles(e.target.files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [addFiles]);

  const updateFile = (id: string, updates: Partial<UploadFile>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleUpload = async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    // Mark all pending as uploading
    pendingFiles.forEach((f) => updateFile(f.id, { status: 'uploading', progress: 0 }));

    try {
      await onUpload(
        pendingFiles.map((f) => ({
          file: f.file,
          type: f.type,
          altText: f.altText,
        }))
      );

      // Mark as success
      pendingFiles.forEach((f) => updateFile(f.id, { status: 'success', progress: 100 }));

      // Clear successful uploads after a delay
      setTimeout(() => {
        setFiles((prev) => prev.filter((f) => f.status !== 'success'));
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      pendingFiles.forEach((f) => updateFile(f.id, { status: 'error', error: message }));
    } finally {
      setIsUploading(false);
    }
  };

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const hasErrors = files.some((f) => f.status === 'error');

  return (
    <div className={className}>
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-lg p-8
          transition-colors cursor-pointer
          ${isDragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
          }
        `.trim()}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes}
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="text-center">
          <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
          <p className="text-sm text-gray-600">
            <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Images, PDFs, CAD files up to {Math.round(maxFileSize / 1024 / 1024)}MB
          </p>

          {/* Required types hint */}
          {requiredTypes && requiredTypes.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-1">
              {requiredTypes.map((type) => (
                <span
                  key={type}
                  className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                >
                  {formatDeliverableType(type)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((uploadFile) => (
            <div
              key={uploadFile.id}
              className={`
                flex items-center gap-3 p-3 rounded-lg border
                ${uploadFile.status === 'error' ? 'border-red-200 bg-red-50' : 'border-gray-200'}
              `.trim()}
            >
              {/* File icon */}
              <div className="flex-shrink-0">
                {uploadFile.file.type.startsWith('image/') ? (
                  <Image className="w-8 h-8 text-gray-400" />
                ) : (
                  <File className="w-8 h-8 text-gray-400" />
                )}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {uploadFile.name}
                </p>
                <div className="flex items-center gap-2">
                  {/* Type selector */}
                  <select
                    value={uploadFile.type}
                    onChange={(e) => updateFile(uploadFile.id, { type: e.target.value as DeliverableType })}
                    disabled={uploadFile.status !== 'pending'}
                    className="text-xs border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="concept_brief">Concept Brief</option>
                    <option value="market_positioning">Market Positioning</option>
                    <option value="reference_images">Reference Images</option>
                    <option value="competitor_analysis">Competitor Analysis</option>
                    <option value="pricing_strategy">Pricing Strategy</option>
                    <option value="cad_files">CAD Files</option>
                    <option value="technical_drawings">Technical Drawings</option>
                    <option value="bom_draft">Bill of Materials</option>
                    <option value="cutlist">Cut List</option>
                    <option value="qc_notes">QC Notes</option>
                    <option value="hero_images">Hero Images</option>
                    <option value="detail_shots">Detail Shots</option>
                    <option value="lifestyle_photos">Lifestyle Photos</option>
                    <option value="360_views">360° Views</option>
                    <option value="product_description">Product Description</option>
                    <option value="seo_metadata">SEO Metadata</option>
                    <option value="specifications">Specifications</option>
                    <option value="care_instructions">Care Instructions</option>
                  </select>

                  {uploadFile.error && (
                    <span className="text-xs text-red-600">{uploadFile.error}</span>
                  )}
                </div>

                {/* Alt text for images */}
                {uploadFile.file.type.startsWith('image/') && uploadFile.status === 'pending' && (
                  <input
                    type="text"
                    placeholder="Alt text (for accessibility)"
                    value={uploadFile.altText || ''}
                    onChange={(e) => updateFile(uploadFile.id, { altText: e.target.value })}
                    className="mt-1 w-full text-xs border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                )}

                {/* Progress bar */}
                {uploadFile.status === 'uploading' && (
                  <div className="mt-1 h-1 bg-gray-200 rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${uploadFile.progress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Status icon */}
              <div className="flex-shrink-0">
                {uploadFile.status === 'uploading' && (
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                )}
                {uploadFile.status === 'success' && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {uploadFile.status === 'error' && (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
                {uploadFile.status === 'pending' && (
                  <button
                    onClick={() => removeFile(uploadFile.id)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {pendingCount > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleUpload}
            disabled={isUploading || hasErrors}
            className={`
              inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium
              ${isUploading || hasErrors
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }
            `.trim()}
          >
            {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
            Upload {pendingCount} file{pendingCount !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
};

export default DeliverableUpload;
