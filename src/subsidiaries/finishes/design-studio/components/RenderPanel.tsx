/**
 * RenderPanel — Render presets and viewport capture controls
 *
 * Shows four render preset cards and a PNG capture button
 * with resolution options and watermark toggle.
 */

import { useState } from 'react';
import { Camera, Download, Sun, Home, Layers, Cloud } from 'lucide-react';
import { RENDER_PRESETS, type RenderPreset } from '../services/renderPresetService';

const PRESET_ICONS: Record<string, typeof Sun> = {
  studio: Sun,
  room: Home,
  transparent: Layers,
  outdoor: Cloud,
};

interface RenderPanelProps {
  activePresetId: string | null;
  onSelectPreset: (preset: RenderPreset) => void;
  onCapture: (options: { scale: number; watermark: boolean }) => void;
  capturing: boolean;
  capturedImageUrl: string | null;
  onDownload: (filename?: string) => void;
  onCopyToClipboard: () => Promise<boolean>;
  onResetCapture: () => void;
}

export default function RenderPanel({
  activePresetId,
  onSelectPreset,
  onCapture,
  capturing,
  capturedImageUrl,
  onDownload,
  onCopyToClipboard,
  onResetCapture,
}: RenderPanelProps) {
  const [scale, setScale] = useState(2);
  const [watermark, setWatermark] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopy = async () => {
    const ok = await onCopyToClipboard();
    if (ok) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 1500);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-2 text-xs">
      {/* Render Presets */}
      <div>
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
          Render Presets
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {RENDER_PRESETS.map((preset) => {
            const Icon = PRESET_ICONS[preset.id] || Sun;
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onSelectPreset(preset)}
                className={`
                  flex flex-col items-center gap-1 p-2 rounded-lg border transition-all
                  ${isActive
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border hover:border-primary/30 hover:bg-muted/30'
                  }
                `}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`font-medium ${isActive ? 'text-primary' : ''}`}>{preset.name}</span>
                <span className="text-[9px] text-muted-foreground text-center leading-tight">
                  {preset.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Capture Controls */}
      <div className="border rounded-lg p-2 bg-muted/10">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Screenshot
        </div>

        <div className="flex items-center gap-2 mb-2">
          <label className="text-[10px] text-muted-foreground">Resolution:</label>
          <div className="flex gap-1">
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setScale(s)}
                className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                  scale === s
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-1.5 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={watermark}
            onChange={(e) => setWatermark(e.target.checked)}
            className="rounded border-border h-3 w-3"
          />
          <span className="text-[10px]">Add watermark</span>
        </label>

        <button
          onClick={() => onCapture({ scale, watermark })}
          disabled={capturing}
          className="w-full py-1.5 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <Camera className="h-3.5 w-3.5" />
          {capturing ? 'Capturing...' : 'Capture PNG'}
        </button>
      </div>

      {/* Captured Image Preview */}
      {capturedImageUrl && (
        <div className="border rounded-lg overflow-hidden">
          <img
            src={capturedImageUrl}
            alt="Captured viewport"
            className="w-full aspect-video object-contain bg-gray-50"
          />
          <div className="flex gap-1 p-1.5">
            <button
              onClick={() => onDownload()}
              className="flex-1 py-1 rounded text-[10px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1"
            >
              <Download className="h-3 w-3" />
              Download
            </button>
            <button
              onClick={handleCopy}
              className="flex-1 py-1 rounded text-[10px] font-medium border border-border hover:bg-muted/30 flex items-center justify-center gap-1"
            >
              {copySuccess ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={onResetCapture}
              className="px-2 py-1 rounded text-[10px] border border-border hover:bg-muted/30"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
