/**
 * CabinetRenderQueue — Shows render generation status per cabinet
 *
 * Lists cabinets without cached renders. Progress per cabinet.
 * Bulk regenerate button.
 */
import { useState, useCallback } from 'react';
import type { SceneCabinet } from '../../types/scene.types';
import { generateCabinetRender } from '../../services/projectPdf.service';

interface CabinetRenderQueueProps {
  sceneId: string;
  cabinets: SceneCabinet[];
  onComplete?: () => void;
}

interface RenderStatus {
  cabinetId: string;
  status: 'pending' | 'rendering' | 'done' | 'error';
  renderUrl?: string;
  error?: string;
}

export function CabinetRenderQueue({ cabinets, onComplete }: CabinetRenderQueueProps) {
  const [statuses, setStatuses] = useState<Record<string, RenderStatus>>({});
  const [isRunning, setIsRunning] = useState(false);

  const cabinetsNeedingRender = cabinets.filter(c => !c.renderUrl);
  const completedCount = Object.values(statuses).filter(s => s.status === 'done').length;

  const generateAll = useCallback(async () => {
    setIsRunning(true);

    // Initialize statuses
    const initial: Record<string, RenderStatus> = {};
    for (const cab of cabinetsNeedingRender) {
      initial[cab.id] = { cabinetId: cab.id, status: 'pending' };
    }
    setStatuses(initial);

    // Render sequentially
    for (const cab of cabinetsNeedingRender) {
      setStatuses(prev => ({ ...prev, [cab.id]: { ...prev[cab.id], status: 'rendering' } }));

      try {
        const renderUrl = await generateCabinetRender(cab.id);
        setStatuses(prev => ({
          ...prev,
          [cab.id]: { ...prev[cab.id], status: 'done', renderUrl },
        }));
      } catch (err) {
        setStatuses(prev => ({
          ...prev,
          [cab.id]: { ...prev[cab.id], status: 'error', error: (err as Error).message },
        }));
      }
    }

    setIsRunning(false);
    onComplete?.();
  }, [cabinetsNeedingRender, onComplete]);

  if (cabinetsNeedingRender.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 text-green-700 text-sm">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        All cabinet renders are cached
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {cabinetsNeedingRender.length} cabinet{cabinetsNeedingRender.length !== 1 ? 's' : ''} need renders
        </p>
        <button
          type="button"
          onClick={generateAll}
          disabled={isRunning}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isRunning ? `Rendering (${completedCount}/${cabinetsNeedingRender.length})...` : 'Generate All'}
        </button>
      </div>

      {Object.keys(statuses).length > 0 && (
        <div className="space-y-1">
          {cabinetsNeedingRender.map(cab => {
            const s = statuses[cab.id];
            return (
              <div key={cab.id} className="flex items-center gap-2 text-xs">
                {s?.status === 'rendering' && (
                  <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600" />
                )}
                {s?.status === 'done' && (
                  <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {s?.status === 'error' && (
                  <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {(!s || s.status === 'pending') && (
                  <span className="w-3 h-3 rounded-full bg-gray-200" />
                )}
                <span className="font-mono text-gray-500">{cab.cabinetCode}</span>
                <span className="text-gray-400">{cab.displayName}</span>
                {s?.error && <span className="text-red-400">{s.error}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
