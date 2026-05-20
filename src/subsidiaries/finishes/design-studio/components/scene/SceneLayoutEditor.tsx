/**
 * SceneLayoutEditor — Top-down 2D editor for cabinet positioning
 *
 * Drag cabinets along walls, snap edges, rotate, set runs.
 * Displays a plan view of the scene with cabinet outlines.
 */
import { useRef, useCallback, useEffect } from 'react';
import type { SceneCabinet } from '../../types/scene.types';
import { useCabinetPositioning } from '../../hooks/useCabinetPositioning';
import type { PositioningMode } from '../../constants/scene.constants';
import { GROUND_PLANE_SIZE_MM, GROUND_PLANE_GRID_MM } from '../../constants/scene.constants';

interface SceneLayoutEditorProps {
  sceneId: string;
  cabinets: SceneCabinet[];
  selectedCabinetId?: string;
  onCabinetSelect: (cabinetId: string) => void;
  onPositionChange?: () => void;
}

const SCALE = 0.08; // mm to px conversion (10000mm → 800px)
const CANVAS_PADDING = 40;

function mmToPx(mm: number): number {
  return mm * SCALE;
}

function pxToMm(px: number): number {
  return px / SCALE;
}

export function SceneLayoutEditor({
  sceneId,
  cabinets,
  selectedCabinetId,
  onCabinetSelect,
  onPositionChange,
}: SceneLayoutEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    positioningMode,
    setPositioningMode,
    isDragging,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
  } = useCabinetPositioning(cabinets);

  const canvasWidth = mmToPx(GROUND_PLANE_SIZE_MM) + CANVAS_PADDING * 2;
  const canvasHeight = mmToPx(GROUND_PLANE_SIZE_MM) + CANVAS_PADDING * 2;
  const originX = canvasWidth / 2;
  const originZ = canvasHeight / 2;

  // Draw the scene
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    const gridPx = mmToPx(GROUND_PLANE_GRID_MM);
    for (let x = CANVAS_PADDING; x < canvasWidth - CANVAS_PADDING; x += gridPx) {
      ctx.beginPath();
      ctx.moveTo(x, CANVAS_PADDING);
      ctx.lineTo(x, canvasHeight - CANVAS_PADDING);
      ctx.stroke();
    }
    for (let y = CANVAS_PADDING; y < canvasHeight - CANVAS_PADDING; y += gridPx) {
      ctx.beginPath();
      ctx.moveTo(CANVAS_PADDING, y);
      ctx.lineTo(canvasWidth - CANVAS_PADDING, y);
      ctx.stroke();
    }

    // Origin crosshair
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(originX, CANVAS_PADDING);
    ctx.lineTo(originX, canvasHeight - CANVAS_PADDING);
    ctx.moveTo(CANVAS_PADDING, originZ);
    ctx.lineTo(canvasWidth - CANVAS_PADDING, originZ);
    ctx.stroke();
    ctx.setLineDash([]);

    // Cabinets
    for (const cab of cabinets) {
      const pos = cab.position ?? { x: 0, y: 0, z: 0 };
      const config = cab.configuration ?? {};
      const w = typeof config.width === 'number' ? config.width : 600;
      const d = typeof config.depth === 'number' ? config.depth : 560;

      const px = originX + mmToPx(pos.x);
      const pz = originZ + mmToPx(pos.z);
      const pw = mmToPx(w);
      const pd = mmToPx(d);

      ctx.save();
      ctx.translate(px, pz);
      ctx.rotate(((cab.rotation ?? 0) * Math.PI) / 180);

      // Cabinet fill
      const isSelected = cab.id === selectedCabinetId;
      ctx.fillStyle = isSelected ? '#dbeafe' : '#f3f4f6';
      ctx.strokeStyle = isSelected ? '#2563eb' : '#9ca3af';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.fillRect(-pw / 2, -pd / 2, pw, pd);
      ctx.strokeRect(-pw / 2, -pd / 2, pw, pd);

      // Front edge (thicker)
      ctx.strokeStyle = isSelected ? '#1d4ed8' : '#6b7280';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(-pw / 2, pd / 2);
      ctx.lineTo(pw / 2, pd / 2);
      ctx.stroke();

      // Label
      ctx.fillStyle = isSelected ? '#1e40af' : '#374151';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cab.cabinetCode, 0, 0);

      ctx.restore();
    }
  }, [cabinets, selectedCabinetId, canvasWidth, canvasHeight, originX, originZ]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const mz = e.clientY - rect.top;

    // Find clicked cabinet
    for (const cab of cabinets) {
      const pos = cab.position ?? { x: 0, y: 0, z: 0 };
      const config = cab.configuration ?? {};
      const w = typeof config.width === 'number' ? config.width : 600;
      const d = typeof config.depth === 'number' ? config.depth : 560;

      const px = originX + mmToPx(pos.x);
      const pz = originZ + mmToPx(pos.z);
      const pw = mmToPx(w);
      const pd = mmToPx(d);

      if (mx >= px - pw / 2 && mx <= px + pw / 2 && mz >= pz - pd / 2 && mz <= pz + pd / 2) {
        onCabinetSelect(cab.id);
        if (!cab.isLocked) {
          startDrag(cab.id, pxToMm(mx - originX), pxToMm(mz - originZ));
        }
        return;
      }
    }
  }, [cabinets, originX, originZ, onCabinetSelect, startDrag]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const mz = e.clientY - rect.top;
    updateDrag(pxToMm(mx - originX), pxToMm(mz - originZ));
    draw();
  }, [isDragging, originX, originZ, updateDrag, draw]);

  const handleMouseUp = useCallback(async () => {
    if (!isDragging) return;
    await endDrag(sceneId);
    onPositionChange?.();
    draw();
  }, [isDragging, sceneId, endDrag, onPositionChange, draw]);

  const MODES: { value: PositioningMode; label: string }[] = [
    { value: 'free', label: 'Free' },
    { value: 'grid_300mm', label: 'Grid 300' },
    { value: 'snap_wall', label: 'Wall' },
    { value: 'align_run', label: 'Run' },
  ];

  return (
    <div className="space-y-2">
      {/* Mode selector */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 mr-1">Snap:</span>
        {MODES.map(m => (
          <button
            key={m.value}
            type="button"
            onClick={() => setPositioningMode(m.value)}
            className={`px-2 py-0.5 text-xs rounded ${
              positioningMode === m.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div className="border rounded-lg overflow-auto bg-white" style={{ maxHeight: 500 }}>
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={cancelDrag}
          className="cursor-crosshair"
          style={{ width: canvasWidth, height: canvasHeight }}
        />
      </div>
    </div>
  );
}
