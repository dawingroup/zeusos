/**
 * ImageDraftUploader — Drag-and-drop image upload for AI mesh generation
 *
 * Accepts reference images (photos, sketches, screenshots) and optional
 * dimension inputs. Triggers Tripo API generation via Cloud Function.
 */

import { useState, useCallback, useRef } from 'react';
import { Upload, Image, Wand2, X } from 'lucide-react';
import GenerationProgress from './GenerationProgress';
import type { GenerationProgress as ProgressType } from '../../types/generation.types';

interface ImageDraftUploaderProps {
  onGenerate: (file: File, dimensions?: { width: number; depth: number; height: number }, faceLimit?: number) => Promise<void>;
  onTextGenerate?: (prompt: string, faceLimit?: number) => Promise<void>;
  progress: ProgressType;
  onLoadResult?: (glbUrl: string) => void;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function ImageDraftUploader({
  onGenerate,
  onTextGenerate,
  progress,
  onLoadResult: _onLoadResult,
}: ImageDraftUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<'image' | 'text'>('image');
  const [textPrompt, setTextPrompt] = useState('');
  const [width, setWidth] = useState<string>('');
  const [depth, setDepth] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [faceLimit, setFaceLimit] = useState(10000);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      alert('Please upload a JPG, PNG, or WebP image');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert('Image must be under 10MB');
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleSubmit = useCallback(async () => {
    const dims = width && depth && height
      ? { width: parseFloat(width), depth: parseFloat(depth), height: parseFloat(height) }
      : undefined;

    if (mode === 'image' && selectedFile) {
      await onGenerate(selectedFile, dims, faceLimit);
    } else if (mode === 'text' && textPrompt.trim() && onTextGenerate) {
      await onTextGenerate(textPrompt.trim(), faceLimit);
    }
  }, [mode, selectedFile, textPrompt, width, depth, height, faceLimit, onGenerate, onTextGenerate]);

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }, [previewUrl]);

  const isGenerating = progress.status !== 'idle' && progress.status !== 'complete' && progress.status !== 'error';
  const canSubmit = mode === 'image' ? !!selectedFile : !!textPrompt.trim();

  return (
    <div className="flex flex-col gap-3 p-2 text-xs">
      {/* Mode Toggle */}
      <div className="flex gap-1 bg-muted/30 rounded-lg p-0.5">
        <button
          onClick={() => setMode('image')}
          className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-colors flex items-center justify-center gap-1 ${
            mode === 'image' ? 'bg-background shadow-sm' : 'hover:bg-muted/50'
          }`}
        >
          <Image className="h-3 w-3" /> Image to 3D
        </button>
        <button
          onClick={() => setMode('text')}
          className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-colors flex items-center justify-center gap-1 ${
            mode === 'text' ? 'bg-background shadow-sm' : 'hover:bg-muted/50'
          }`}
        >
          <Wand2 className="h-3 w-3" /> Text to 3D
        </button>
      </div>

      {/* Image Upload Zone */}
      {mode === 'image' && (
        <>
          {!selectedFile ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                transition-colors
                ${isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/20'
                }
              `}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="font-medium">Drop reference image here</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Photo, sketch, or screenshot (JPG, PNG, WebP)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />
            </div>
          ) : (
            <div className="relative border rounded-lg overflow-hidden">
              <img
                src={previewUrl!}
                alt="Reference"
                className="w-full aspect-video object-contain bg-gray-50"
              />
              <button
                onClick={clearFile}
                className="absolute top-1 right-1 p-1 rounded-full bg-background/80 hover:bg-background shadow-sm"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Text Prompt */}
      {mode === 'text' && (
        <div>
          <textarea
            value={textPrompt}
            onChange={(e) => setTextPrompt(e.target.value)}
            placeholder="Describe the furniture piece... e.g., 'Modern 3-seat sofa with wooden legs and fabric cushions'"
            className="w-full h-20 px-2 py-1.5 text-[11px] border rounded-lg resize-none bg-background"
          />
        </div>
      )}

      {/* Dimensions (optional) */}
      <div className="border rounded-lg p-2 bg-muted/10">
        <div className="text-[10px] font-medium text-muted-foreground mb-1.5">
          Target Dimensions (optional, mm)
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div>
            <label className="text-[9px] text-muted-foreground">Width</label>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="2400"
              className="w-full px-1.5 py-1 text-[10px] border rounded bg-background"
            />
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground">Depth</label>
            <input
              type="number"
              value={depth}
              onChange={(e) => setDepth(e.target.value)}
              placeholder="900"
              className="w-full px-1.5 py-1 text-[10px] border rounded bg-background"
            />
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground">Height</label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="850"
              className="w-full px-1.5 py-1 text-[10px] border rounded bg-background"
            />
          </div>
        </div>
      </div>

      {/* Quality Setting */}
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-muted-foreground">Quality:</label>
        <div className="flex gap-1">
          {[
            { label: 'Draft', value: 5000 },
            { label: 'Standard', value: 10000 },
            { label: 'High', value: 20000 },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFaceLimit(opt.value)}
              className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                faceLimit === opt.value
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border hover:border-primary/30'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Progress */}
      {progress.status !== 'idle' && (
        <GenerationProgress progress={progress} />
      )}

      {/* Generate Button */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || isGenerating}
        className="w-full py-2 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        <Wand2 className="h-3.5 w-3.5" />
        {isGenerating ? 'Generating...' : 'Generate 3D Model'}
      </button>
    </div>
  );
}
