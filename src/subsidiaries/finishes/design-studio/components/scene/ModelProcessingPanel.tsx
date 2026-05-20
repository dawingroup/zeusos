/**
 * ModelProcessingPanel — AI model processing UI
 *
 * Shows status, progress, AI reasoning, and actions for a cabinet's
 * ModelPackage. Triggers the unified processing pipeline.
 */
import { useCallback, useState } from 'react';
import { useModelProcessor } from '../../hooks/useModelProcessor';
import { useModelPackage } from '../../hooks/useModelPackage';
import type { SceneCabinet } from '../../types/scene.types';
import type { ParsedModel } from '../../types/workshop-viewer.types';

interface ModelProcessingPanelProps {
  sceneId: string;
  cabinet: SceneCabinet;
  parsedModel?: ParsedModel;
  /** After a successful save (model package + cabinet assemblies), so the scene can refetch. */
  onProcessComplete?: () => void | Promise<void>;
}

const STEP_LABELS: Record<string, string> = {
  grouping: 'Grouping assemblies',
  recognition: 'Recognizing parts',
  materials: 'Resolving materials',
  bom: 'Computing BOM',
  renders: 'Generating renders',
  save: 'Saving package',
};

export function ModelProcessingPanel({ sceneId, cabinet, parsedModel, onProcessComplete }: ModelProcessingPanelProps) {
  const { modelPackage, refetch } = useModelPackage(sceneId, cabinet.id);
  const { status, currentStep, progress, message, result, error, process, reset } = useModelProcessor();
  const [showReasoning, setShowReasoning] = useState(false);

  const canProcess = !!parsedModel && parsedModel.objects && parsedModel.objects.length > 0;

  const handleProcess = useCallback(async () => {
    if (!parsedModel) return;
    const result = await process({
      sceneId,
      cabinetId: cabinet.id,
      cabinet,
      parsedModel,
      archetypeKey: cabinet.archetypeId,
      modelName: cabinet.displayName,
      fileType: 'glb',
    });
    await refetch();
    if (result) await onProcessComplete?.();
  }, [parsedModel, sceneId, cabinet, process, refetch, onProcessComplete]);

  const pkg = result ? null : modelPackage; // show result if just processed
  const grouping = result?.grouping ?? pkg?.grouping;
  const source = grouping?.source;
  const confidence = grouping?.confidence ?? 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">AI Processing</h4>
        {pkg && (
          <span className="text-[10px] text-gray-400">v{pkg.version}</span>
        )}
      </div>

      {/* Status / summary */}
      {status === 'idle' && pkg && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <SourceBadge source={source} />
            <ConfidenceBar confidence={confidence} />
          </div>
          <p className="text-[11px] text-gray-500">
            {pkg.grouping.assemblies.length} assembl{pkg.grouping.assemblies.length === 1 ? 'y' : 'ies'}, {pkg.grouping.parts.length} parts
          </p>
          {grouping?.reasoning && (
            <button
              type="button"
              onClick={() => setShowReasoning(!showReasoning)}
              className="text-[10px] text-blue-600 hover:underline"
            >
              {showReasoning ? 'Hide' : 'Show'} AI reasoning
            </button>
          )}
          {showReasoning && grouping?.reasoning && (
            <p className="text-[11px] text-gray-600 bg-gray-50 rounded p-2 italic">
              "{grouping.reasoning}"
            </p>
          )}
        </div>
      )}

      {status === 'idle' && !pkg && (
        <p className="text-[11px] text-gray-400">Not yet processed. {canProcess ? 'Click Process to run AI grouping.' : 'Load a 3D model first.'}</p>
      )}

      {/* Running */}
      {status === 'processing' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600" />
            <span className="text-gray-700">{currentStep ? STEP_LABELS[currentStep] : 'Starting...'}</span>
          </div>
          <div className="h-1 bg-gray-100 rounded overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400">{message}</p>
        </div>
      )}

      {/* Done */}
      {status === 'done' && result && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-green-700">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Processed in {Math.round(result.durationMs / 1000)}s
          </div>
          <div className="flex items-center gap-2 text-xs">
            <SourceBadge source={result.grouping.source} />
            <ConfidenceBar confidence={result.grouping.confidence} />
          </div>
          {result.validation.issues.length > 0 && (
            <p className="text-[10px] text-amber-600">{result.validation.issues[0]}</p>
          )}
        </div>
      )}

      {/* Error */}
      {status === 'error' && error && (
        <p className="text-[11px] text-red-600">{error.message}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {(status === 'idle' || status === 'done' || status === 'error') && (
          <button
            type="button"
            onClick={handleProcess}
            disabled={!canProcess}
            className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pkg ? 'Reprocess' : 'Process with AI'}
          </button>
        )}
        {status === 'done' && (
          <button
            type="button"
            onClick={reset}
            className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const config = {
    ai: { label: 'AI', color: 'bg-purple-100 text-purple-700' },
    heuristic: { label: 'Heuristic', color: 'bg-gray-100 text-gray-600' },
    manual: { label: 'Manual', color: 'bg-blue-100 text-blue-700' },
  }[source] ?? { label: source, color: 'bg-gray-100 text-gray-600' };

  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${config.color}`}>
      {config.label}
    </span>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = confidence >= 0.8 ? 'bg-green-500' : confidence >= 0.5 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5 flex-1">
      <div className="flex-1 h-1 bg-gray-100 rounded overflow-hidden min-w-[40px] max-w-[80px]">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 font-mono">{pct}%</span>
    </div>
  );
}
