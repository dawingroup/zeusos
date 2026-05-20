/**
 * RECEIPT SCANNER COMPONENT
 *
 * Dedicated camera UI for capturing receipt photos with real-time corner
 * detection preview. Uses getUserMedia for camera access with graceful
 * fallback to file input. Mobile-first design.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Camera,
  RotateCcw,
  Scan,
  X,
  Upload,
  Smartphone,
  AlertCircle,
  Check,
} from 'lucide-react';
import { DocumentScannerService } from '../../services/document-scanner-service';

export interface ReceiptScannerProps {
  onCapture: (file: File, scannedFile?: File) => void;
  onCancel: () => void;
  /** If true, shows as a full-screen overlay */
  fullScreen?: boolean;
}

type ScannerState = 'camera' | 'preview' | 'scanning' | 'error';

export function ReceiptScanner({
  onCapture,
  onCancel,
  fullScreen = true,
}: ReceiptScannerProps) {
  const [state, setState] = useState<ScannerState>('camera');
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─────────────────────────────────────────────────────────────
  // CAMERA SETUP
  // ─────────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraAvailable(true);
      setState('camera');
    } catch (err) {
      console.warn('Camera not available:', err);
      setCameraAvailable(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // ─────────────────────────────────────────────────────────────
  // CAPTURE
  // ─────────────────────────────────────────────────────────────

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(dataUrl);
    setState('preview');

    stopCamera();
  }, [stopCamera]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCapturedImage(reader.result as string);
      setState('preview');
      stopCamera();
    };
    reader.readAsDataURL(file);
  }, [stopCamera]);

  // ─────────────────────────────────────────────────────────────
  // SCAN & PROCESS
  // ─────────────────────────────────────────────────────────────

  const processImage = useCallback(async () => {
    if (!capturedImage) return;

    setState('scanning');
    setScanError(null);

    try {
      const scanner = DocumentScannerService.getInstance();
      const scanResult = await scanner.scan(capturedImage);
      setScannedImage(scanResult.dataUrl);

      // Convert both to File objects
      const rawBlob = await fetch(capturedImage).then((r) => r.blob());
      const rawFile = new File([rawBlob], 'receipt-raw.jpg', { type: 'image/jpeg' });

      const scannedBlob = await fetch(scanResult.dataUrl).then((r) => r.blob());
      const scannedFile = new File([scannedBlob], 'receipt-scanned.jpg', { type: 'image/jpeg' });

      onCapture(rawFile, scannedFile);
    } catch (err) {
      console.error('Scan processing failed:', err);
      setScanError(
        err instanceof Error ? err.message : 'Failed to process image'
      );
      setState('preview');
    }
  }, [capturedImage, onCapture]);

  const useWithoutScan = useCallback(async () => {
    if (!capturedImage) return;

    const blob = await fetch(capturedImage).then((r) => r.blob());
    const file = new File([blob], 'receipt.jpg', { type: 'image/jpeg' });
    onCapture(file);
  }, [capturedImage, onCapture]);

  const retake = useCallback(() => {
    setCapturedImage(null);
    setScannedImage(null);
    setScanError(null);
    setState('camera');
    startCamera();
  }, [startCamera]);

  const handleCancel = useCallback(() => {
    stopCamera();
    onCancel();
  }, [stopCamera, onCancel]);

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  const containerClass = fullScreen
    ? 'fixed inset-0 z-50 bg-black flex flex-col'
    : 'relative bg-black rounded-xl overflow-hidden';

  return (
    <div className={containerClass}>
      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden file input for fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50 text-white z-10">
        <button
          onClick={handleCancel}
          className="p-2 hover:bg-white/10 rounded-full"
        >
          <X className="w-6 h-6" />
        </button>
        <span className="text-sm font-medium">
          {state === 'camera' && 'Position receipt in frame'}
          {state === 'preview' && 'Review capture'}
          {state === 'scanning' && 'Processing...'}
          {state === 'error' && 'Camera unavailable'}
        </span>
        <div className="w-10" /> {/* spacer */}
      </div>

      {/* Main content area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Camera view */}
        {state === 'camera' && cameraAvailable && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}

        {/* Camera not available — file picker fallback */}
        {(state === 'camera' && cameraAvailable === false) && (
          <div className="flex flex-col items-center justify-center gap-6 p-8 text-white">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
              <Smartphone className="w-10 h-10" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">
                Camera Not Available
              </h3>
              <p className="text-sm text-white/70 max-w-xs">
                Camera access was denied or isn't available. You can still
                upload a photo from your gallery.
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full font-medium hover:bg-white/90"
            >
              <Upload className="w-5 h-5" />
              Choose Photo
            </button>
          </div>
        )}

        {/* Loading camera */}
        {state === 'camera' && cameraAvailable === null && (
          <div className="flex flex-col items-center justify-center gap-4 text-white">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            <p className="text-sm text-white/70">Starting camera...</p>
          </div>
        )}

        {/* Preview captured image */}
        {(state === 'preview' || state === 'scanning') && capturedImage && (
          <div className="relative w-full h-full">
            <img
              src={scannedImage || capturedImage}
              alt="Captured receipt"
              className="w-full h-full object-contain"
            />
            {state === 'scanning' && (
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 border-4 border-white/30 border-t-blue-400 rounded-full animate-spin" />
                <p className="text-white text-sm font-medium">
                  Detecting corners & enhancing...
                </p>
              </div>
            )}
          </div>
        )}

        {/* Scan error */}
        {scanError && (
          <div className="absolute bottom-4 left-4 right-4 bg-red-500/90 text-white p-3 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Scan failed</p>
              <p className="text-xs opacity-80">{scanError}</p>
            </div>
          </div>
        )}

        {/* Document frame guide overlay (camera mode only) */}
        {state === 'camera' && cameraAvailable && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Corner brackets */}
            <div className="absolute top-[15%] left-[10%] w-12 h-12 border-t-3 border-l-3 border-white/60 rounded-tl-lg" />
            <div className="absolute top-[15%] right-[10%] w-12 h-12 border-t-3 border-r-3 border-white/60 rounded-tr-lg" />
            <div className="absolute bottom-[15%] left-[10%] w-12 h-12 border-b-3 border-l-3 border-white/60 rounded-bl-lg" />
            <div className="absolute bottom-[15%] right-[10%] w-12 h-12 border-b-3 border-r-3 border-white/60 rounded-br-lg" />
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="bg-black/80 p-6 pb-safe">
        {/* Camera mode controls */}
        {state === 'camera' && (
          <div className="flex items-center justify-center gap-8">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-white/10 rounded-full text-white hover:bg-white/20"
              title="Choose from gallery"
            >
              <Upload className="w-6 h-6" />
            </button>
            <button
              onClick={capturePhoto}
              disabled={!cameraAvailable}
              className="w-16 h-16 bg-white rounded-full flex items-center justify-center hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Capture"
            >
              <Camera className="w-8 h-8 text-black" />
            </button>
            <div className="w-12" /> {/* spacer for alignment */}
          </div>
        )}

        {/* Preview mode controls */}
        {state === 'preview' && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={retake}
              className="flex items-center gap-2 px-5 py-3 bg-white/10 text-white rounded-full hover:bg-white/20"
            >
              <RotateCcw className="w-5 h-5" />
              Retake
            </button>
            <button
              onClick={processImage}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 font-medium"
            >
              <Scan className="w-5 h-5" />
              Scan & Enhance
            </button>
            <button
              onClick={useWithoutScan}
              className="flex items-center gap-2 px-5 py-3 bg-white/10 text-white rounded-full hover:bg-white/20"
            >
              <Check className="w-5 h-5" />
              Use As-Is
            </button>
          </div>
        )}

        {/* Scanning mode — no controls */}
        {state === 'scanning' && (
          <div className="flex justify-center">
            <p className="text-white/50 text-sm">Processing image...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReceiptScanner;
