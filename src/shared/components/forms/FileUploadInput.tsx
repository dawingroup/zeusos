/**
 * FileUploadInput Component
 * Drag and drop file upload with preview
 */

import { useState, useRef } from 'react';
import { Upload, X, FileIcon } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { cn } from '@/shared/lib/utils';

interface FileUploadInputProps {
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
}

export function FileUploadInput({
  accept,
  multiple = false,
  maxSize = 10,
  onFilesChange,
  disabled = false,
  className,
}: FileUploadInputProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    setError(null);

    const validFiles: File[] = [];
    for (const file of Array.from(newFiles)) {
      if (file.size > maxSize * 1024 * 1024) {
        setError(`File "${file.name}" exceeds ${maxSize}MB limit`);
        continue;
      }
      validFiles.push(file);
    }

    const updatedFiles = multiple ? [...files, ...validFiles] : validFiles;
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  };

  const removeFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
          className="hidden"
        />
        <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
        <p className="text-sm text-muted-foreground mb-2">
          Drag and drop files here, or
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          Browse Files
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          Max file size: {maxSize}MB
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-muted rounded-lg"
            >
              <div className="flex items-center gap-3">
                <FileIcon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
