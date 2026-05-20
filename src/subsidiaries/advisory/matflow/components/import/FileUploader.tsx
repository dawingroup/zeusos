/**
 * File Uploader Component
 * Drag-and-drop file upload for BOQ documents
 */

import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileSpreadsheet, FileText, File, X, Loader2 } from 'lucide-react';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
  maxSizeMB?: number;
}

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.pdf', '.csv'];

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelect,
  isUploading = false,
  maxSizeMB = 10,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = (file: File): string | null => {
    // Check file type
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return 'Invalid file type. Please upload Excel, PDF, or CSV files.';
    }
    
    // Check file size
    if (file.size > maxSizeBytes) {
      return `File is too large. Maximum size is ${maxSizeMB}MB.`;
    }
    
    return null;
  };

  const handleFile = useCallback((file: File) => {
    setError(null);
    
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setSelectedFile(file);
  }, [maxSizeBytes]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (isUploading) return;
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile, isUploading]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!isUploading) {
      setIsDragOver(true);
    }
  }, [isUploading]);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleClick = () => {
    if (!isUploading) {
      inputRef.current?.click();
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['xlsx', 'xls', 'csv'].includes(ext || '')) {
      return <FileSpreadsheet className="h-10 w-10 text-green-600" />;
    }
    if (ext === 'pdf') {
      return <FileText className="h-10 w-10 text-red-600" />;
    }
    return <File className="h-10 w-10 text-gray-600" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragOver ? 'border-amber-500 bg-amber-50' : 'border-gray-300 hover:border-amber-400'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          onChange={handleInputChange}
          className="hidden"
          disabled={isUploading}
        />
        
        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        
        {isDragOver ? (
          <p className="text-amber-600 font-medium">Drop the file here...</p>
        ) : (
          <>
            <p className="text-gray-600 font-medium">
              Drag & drop your BOQ file here
            </p>
            <p className="text-gray-400 text-sm mt-1">
              or click to browse
            </p>
          </>
        )}
        
        <p className="text-gray-400 text-xs mt-4">
          Supported: Excel (.xlsx, .xls), PDF, CSV • Max size: {maxSizeMB}MB
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Selected File Preview */}
      {selectedFile && !error && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {getFileIcon(selectedFile.name)}
              <div>
                <p className="font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearSelection}
                disabled={isUploading}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
              
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading}
                className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Parse BOQ'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
