/**
 * useRenderCapture — Manage screenshot capture workflow state
 *
 * Provides capture, download, and reset for viewport screenshots
 * with optional watermark compositing.
 */

import { useState, useCallback } from 'react';
import { addWatermark } from '../services/renderPresetService';

interface UseRenderCaptureResult {
  /** The captured image blob (null if no capture) */
  capturedImage: Blob | null;
  /** The captured image as an object URL for display */
  capturedImageUrl: string | null;
  /** Whether a capture is in progress */
  capturing: boolean;
  /** Set a captured image (called by viewport) */
  setCapturedImage: (blob: Blob, watermarkText?: string) => Promise<void>;
  /** Download the captured image */
  download: (filename?: string) => void;
  /** Copy to clipboard */
  copyToClipboard: () => Promise<boolean>;
  /** Reset capture state */
  reset: () => void;
}

export function useRenderCapture(): UseRenderCaptureResult {
  const [capturedImage, setCapturedImageState] = useState<Blob | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const setCapturedImage = useCallback(async (blob: Blob, watermarkText?: string) => {
    setCapturing(true);
    try {
      const finalBlob = watermarkText
        ? await addWatermark(blob, watermarkText)
        : blob;
      setCapturedImageState(finalBlob);
      // Revoke previous URL if any
      setCapturedImageUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(finalBlob); });
    } finally {
      setCapturing(false);
    }
  }, []);

  const download = useCallback((filename = 'viewport-capture.png') => {
    if (!capturedImage) return;
    const url = URL.createObjectURL(capturedImage);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [capturedImage]);

  const copyToClipboard = useCallback(async (): Promise<boolean> => {
    if (!capturedImage) return false;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': capturedImage }),
      ]);
      return true;
    } catch {
      return false;
    }
  }, [capturedImage]);

  const reset = useCallback(() => {
    if (capturedImageUrl) URL.revokeObjectURL(capturedImageUrl);
    setCapturedImageState(null);
    setCapturedImageUrl(null);
  }, [capturedImageUrl]);

  return {
    capturedImage,
    capturedImageUrl,
    capturing,
    setCapturedImage,
    download,
    copyToClipboard,
    reset,
  };
}
