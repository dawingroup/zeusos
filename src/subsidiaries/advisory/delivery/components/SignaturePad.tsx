/**
 * SIGNATURE PAD COMPONENT
 *
 * Canvas-based signature capture for digital signatures.
 * Supports both drawing and uploading signature images.
 * Exports signature as PNG data URL for PDF embedding.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { Eraser, PenTool, Upload, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/core/components/ui/button';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

type SignatureMode = 'draw' | 'upload';

interface SignaturePadProps {
  /** Callback when signature changes (null when cleared) */
  onSignatureChange: (dataUrl: string | null) => void;
  /** Canvas width in pixels */
  width?: number;
  /** Canvas height in pixels */
  height?: number;
  /** Line color */
  penColor?: string;
  /** Line width */
  penWidth?: number;
  /** Background color */
  backgroundColor?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Initial signature data URL (for editing) */
  initialSignature?: string;
  /** Label text */
  label?: string;
  /** Allow signature upload (default: true) */
  allowUpload?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

// High DPI multiplier for crisp signatures
const DPI_SCALE = 2;

export function SignaturePad({
  onSignatureChange,
  width = 400,
  height = 150,
  penColor = '#000000',
  penWidth = 2,
  backgroundColor = '#ffffff',
  disabled = false,
  initialSignature,
  label = 'Sign here',
  allowUpload = true,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [mode, setMode] = useState<SignatureMode>('draw');
  const [_uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize canvas with high DPI for crisp rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size at higher resolution for crisp rendering
    canvas.width = width * DPI_SCALE;
    canvas.height = height * DPI_SCALE;

    // Scale the context to draw at the higher resolution
    ctx.scale(DPI_SCALE, DPI_SCALE);

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Load initial signature if provided
    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        // Reset scale before drawing image, then restore
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.scale(DPI_SCALE, DPI_SCALE);
        setHasSignature(true);
      };
      img.src = initialSignature;
    }
  }, [width, height, backgroundColor, initialSignature]);

  // Get coordinates relative to canvas (in logical pixels, not physical)
  const getCoordinates = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      // Map to logical coordinates (not physical canvas pixels)
      // The context is already scaled by DPI_SCALE, so we just need rect-relative coords
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;

      if ('touches' in e) {
        const touch = e.touches[0];
        if (!touch) return null;
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY,
        };
      }

      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    [width, height]
  );

  // Start drawing
  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return;
      e.preventDefault();

      const coords = getCoordinates(e);
      if (!coords) return;

      setIsDrawing(true);
      lastPointRef.current = coords;
    },
    [disabled, getCoordinates]
  );

  // Draw line
  const handleMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || disabled) return;
      e.preventDefault();

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const coords = getCoordinates(e);
      if (!coords || !lastPointRef.current) return;

      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();

      lastPointRef.current = coords;
      setHasSignature(true);
    },
    [isDrawing, disabled, getCoordinates, penColor, penWidth]
  );

  // End drawing
  const handleEnd = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      lastPointRef.current = null;

      // Export signature
      const canvas = canvasRef.current;
      if (canvas && hasSignature) {
        const dataUrl = canvas.toDataURL('image/png');
        onSignatureChange(dataUrl);
      }
    }
  }, [isDrawing, hasSignature, onSignatureChange]);

  // Clear signature
  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Reset transform, clear, then restore scale
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(DPI_SCALE, DPI_SCALE);
    setHasSignature(false);
    onSignatureChange(null);
  }, [backgroundColor, onSignatureChange]);

  // Handle mouse/touch leaving canvas
  const handleLeave = useCallback(() => {
    if (isDrawing) {
      handleEnd();
    }
  }, [isDrawing, handleEnd]);

  // Handle file upload
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || disabled) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        console.error('Invalid file type. Please upload an image.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (!dataUrl) return;

        // Load image and draw to canvas for consistent output
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (!canvas || !ctx) return;

          // Reset transform for direct pixel manipulation
          ctx.setTransform(1, 0, 0, 1, 0, 0);

          // Clear canvas at full resolution
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Calculate scaling to fit image within canvas while maintaining aspect ratio
          // Use full canvas dimensions (physical pixels)
          const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
          const scaledWidth = img.width * scale;
          const scaledHeight = img.height * scale;
          const x = 0; // Left-aligned
          const y = (canvas.height - scaledHeight) / 2; // Vertically centered

          // Draw image left-aligned at full resolution
          ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

          // Restore scale for future drawing operations
          ctx.scale(DPI_SCALE, DPI_SCALE);

          setUploadedImageUrl(dataUrl);
          setHasSignature(true);

          // Export as PNG data URL
          const outputDataUrl = canvas.toDataURL('image/png');
          onSignatureChange(outputDataUrl);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [disabled, backgroundColor, onSignatureChange]
  );

  // Trigger file input click
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Switch mode and clear
  const handleModeSwitch = useCallback(
    (newMode: SignatureMode) => {
      if (newMode !== mode) {
        setMode(newMode);
        handleClear();
        setUploadedImageUrl(null);
      }
    },
    [mode, handleClear]
  );

  return (
    <div className="space-y-1.5">
      {/* Label and Mode Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
          {mode === 'draw' ? <PenTool className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
          {label}
        </label>
        <div className="flex items-center gap-2">
          {/* Mode toggle buttons */}
          {allowUpload && (
            <div className="flex items-center border rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => handleModeSwitch('draw')}
                disabled={disabled}
                className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${
                  mode === 'draw'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                <PenTool className="w-3 h-3" />
                Draw
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('upload')}
                disabled={disabled}
                className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${
                  mode === 'upload'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Upload className="w-3 h-3" />
                Upload
              </button>
            </div>
          )}
          {hasSignature && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                handleClear();
                setUploadedImageUrl(null);
              }}
              disabled={disabled}
              className="text-gray-500 hover:text-red-500"
            >
              <Eraser className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Canvas container (for both draw and upload modes) */}
      <div
        className={`relative border-2 rounded-lg overflow-hidden ${
          disabled
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
            : hasSignature
              ? 'border-green-300 bg-white'
              : 'border-dashed border-gray-300 bg-white'
        }`}
        style={{ width: '100%', maxWidth: width }}
      >
        <canvas
          ref={canvasRef}
          className={`touch-none ${
            disabled
              ? 'cursor-not-allowed'
              : mode === 'draw'
                ? 'cursor-crosshair'
                : 'cursor-default'
          }`}
          style={{
            width: '100%',
            height: 'auto',
            aspectRatio: `${width} / ${height}`,
          }}
          onMouseDown={mode === 'draw' ? handleStart : undefined}
          onMouseMove={mode === 'draw' ? handleMove : undefined}
          onMouseUp={mode === 'draw' ? handleEnd : undefined}
          onMouseLeave={mode === 'draw' ? handleLeave : undefined}
          onTouchStart={mode === 'draw' ? handleStart : undefined}
          onTouchMove={mode === 'draw' ? handleMove : undefined}
          onTouchEnd={mode === 'draw' ? handleEnd : undefined}
        />

        {/* Placeholder for draw mode */}
        {!hasSignature && !disabled && mode === 'draw' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-gray-400 text-sm">Draw your signature here</span>
          </div>
        )}

        {/* Upload prompt for upload mode */}
        {!hasSignature && !disabled && mode === 'upload' && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={handleUploadClick}
          >
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <span className="text-gray-500 text-sm font-medium">Click to upload signature</span>
            <span className="text-gray-400 text-xs mt-1">PNG, JPG, or GIF</span>
          </div>
        )}
      </div>

      {/* Helper text */}
      <p className="text-[11px] text-gray-400 leading-tight">
        {mode === 'draw'
          ? 'Use your mouse or finger to sign'
          : 'Upload an image of your signature'}
      </p>
    </div>
  );
}

export default SignaturePad;
