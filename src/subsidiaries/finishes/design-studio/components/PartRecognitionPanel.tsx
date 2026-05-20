/**
 * PartRecognitionPanel — AI part recognition review UI
 *
 * Shows AI-identified parts with suggested names, confidence badges,
 * inline rename editing, and a "Confirm & Write to Project" action.
 */

import { useState } from 'react';
import { Brain, Check, AlertTriangle, Edit2, RotateCcw, Upload, Loader2, Sparkles } from 'lucide-react';
import FurnitureTypeSelector from './FurnitureTypeSelector';
import type { RecognitionState } from '../types/ai-recognition.types';
import type { WriteResult } from '../services/partWriteService';

interface PartRecognitionPanelProps {
  state: RecognitionState;
  selectedTypeId: string | null;
  onSelectType: (typeId: string | null) => void;
  onAnalyze: () => void;
  onRenamePart: (originalName: string, newName: string) => void;
  onConfirmAndSync: () => Promise<WriteResult | null>;
  onReset: () => void;
  hasProjectContext: boolean;
  hasModel: boolean;
}

export default function PartRecognitionPanel({
  state,
  selectedTypeId,
  onSelectType,
  onAnalyze,
  onRenamePart,
  onConfirmAndSync,
  onReset,
  hasProjectContext,
  hasModel,
}: PartRecognitionPanelProps) {
  const [editingPart, setEditingPart] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [writeResult, setWriteResult] = useState<WriteResult | null>(null);
  const [syncing, setSyncing] = useState(false);

  const handleStartEdit = (originalName: string, currentName: string) => {
    setEditingPart(originalName);
    setEditValue(currentName);
  };

  const handleSaveEdit = () => {
    if (editingPart && editValue.trim()) {
      onRenamePart(editingPart, editValue.trim());
    }
    setEditingPart(null);
  };

  const handleSync = async () => {
    setSyncing(true);
    const result = await onConfirmAndSync();
    setWriteResult(result);
    setSyncing(false);
  };

  // Idle state — show type selector + "Recognize Parts" button
  if (state.status === 'idle') {
    return (
      <div className="p-3 space-y-3">
        {!hasProjectContext && (
          <p className="text-[10px] text-amber-600">
            Link a project to enable writing parts to the design item.
          </p>
        )}

        <FurnitureTypeSelector
          selectedTypeId={selectedTypeId}
          onSelect={onSelectType}
        />

        <button
          onClick={onAnalyze}
          disabled={!hasModel || !selectedTypeId}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          <Brain className="h-3.5 w-3.5" />
          {selectedTypeId ? 'Recognize Parts' : 'Select a type first'}
        </button>
      </div>
    );
  }

  // Analyzing state
  if (state.status === 'analyzing') {
    return (
      <div className="p-3 flex flex-col items-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Analyzing model geometry...</p>
      </div>
    );
  }

  // Error state
  if (state.status === 'error') {
    return (
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-destructive text-xs">
          <AlertTriangle className="h-3.5 w-3.5" />
          {state.error || 'Recognition failed'}
        </div>
        <button
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 border rounded-md text-xs hover:bg-muted"
        >
          <RotateCcw className="h-3 w-3" /> Try Again
        </button>
      </div>
    );
  }

  // Synced state
  if (state.status === 'synced' && writeResult) {
    return (
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2 text-green-600 text-xs font-medium">
          <Check className="h-4 w-4" />
          {writeResult.synced} parts written to project
        </div>

        {writeResult.dfm.warnCount > 0 && (
          <div className="text-xs text-amber-600">
            {writeResult.dfm.warnCount} DFM warning(s) — review in Design Manager
          </div>
        )}
        {writeResult.dfm.failCount > 0 && (
          <div className="text-xs text-destructive">
            {writeResult.dfm.failCount} DFM error(s) — fix before manufacturing
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          {writeResult.learningStored} identifications stored for learning
        </div>

        <button
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 border rounded-md text-xs hover:bg-muted"
        >
          <RotateCcw className="h-3 w-3" /> Start Over
        </button>
      </div>
    );
  }

  // Reviewed state — show parts list with editing
  const result = state.result;
  if (!result) return null;

  const confidenceColor = (c: number) =>
    c >= 0.8 ? 'text-green-600' : c >= 0.5 ? 'text-amber-600' : 'text-red-500';

  const confidenceLabel = (c: number) =>
    c >= 0.8 ? 'High' : c >= 0.5 ? 'Med' : 'Low';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">
            {result.parts.length} Parts Identified
          </span>
          <span className={`text-[10px] ${confidenceColor(result.confidence)}`}>
            ({Math.round(result.confidence * 100)}% {result.source})
          </span>
        </div>
        <button
          onClick={onReset}
          className="text-muted-foreground hover:text-foreground"
          title="Reset"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </div>

      {/* Model summary */}
      {result.modelSummary && (
        <div className="px-3 py-1.5 bg-muted/50 text-[10px] text-muted-foreground border-b">
          {result.modelSummary}
        </div>
      )}

      {/* Parts list */}
      <div className="flex-1 overflow-auto">
        {result.assemblies.map(asm => {
          const asmParts = result.parts.filter(p => p.assemblyGroup === asm.name);
          if (asmParts.length === 0) return null;

          return (
            <div key={asm.name} className="border-b last:border-b-0">
              <div className="px-3 py-1 bg-muted/30 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {asm.name} ({asm.category})
              </div>
              {asmParts.map(part => {
                const displayName = state.renames[part.originalName] || part.suggestedName;
                const isEditing = editingPart === part.originalName;

                return (
                  <div
                    key={part.originalName}
                    className="px-3 py-1.5 flex items-center gap-2 hover:bg-muted/20 text-xs"
                  >
                    {isEditing ? (
                      <input
                        className="flex-1 px-1.5 py-0.5 border rounded text-xs bg-background"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                        autoFocus
                      />
                    ) : (
                      <>
                        <span className="flex-1 truncate" title={part.originalName}>
                          {displayName}
                        </span>
                        <button
                          onClick={() => handleStartEdit(part.originalName, displayName)}
                          className="text-muted-foreground hover:text-foreground shrink-0"
                          title="Rename"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                    <span className={`text-[10px] shrink-0 ${confidenceColor(part.confidence)}`}>
                      {confidenceLabel(part.confidence)}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Ungrouped parts */}
        {(() => {
          const groupedNames = new Set(result.assemblies.flatMap(a => a.partNames));
          const ungrouped = result.parts.filter(p => !groupedNames.has(p.originalName) &&
            !result.assemblies.some(a => result.parts.filter(pp => pp.assemblyGroup === a.name).some(pp => pp.originalName === p.originalName)));
          if (ungrouped.length === 0) return null;

          return (
            <div className="border-b">
              <div className="px-3 py-1 bg-muted/30 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Other
              </div>
              {ungrouped.map(part => {
                const displayName = state.renames[part.originalName] || part.suggestedName;
                return (
                  <div key={part.originalName} className="px-3 py-1.5 flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate">{displayName}</span>
                    <span className={`text-[10px] ${confidenceColor(part.confidence)}`}>
                      {confidenceLabel(part.confidence)}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Action bar */}
      <div className="p-3 border-t space-y-2">
        {hasProjectContext ? (
          <button
            onClick={handleSync}
            disabled={syncing || state.status === 'syncing'}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Confirm & Write to Project
          </button>
        ) : (
          <p className="text-[10px] text-amber-600 text-center">
            Link a design item to write parts to the project
          </p>
        )}
      </div>
    </div>
  );
}
