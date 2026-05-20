/**
 * AddCabinetDialog — Modal for adding a cabinet to a scene
 *
 * Step 1: PDD picker (browse active PDDs)
 * Step 2: Configure parameters + finishes (reuses ParameterControls) +
 *         DesignItem selection (P2 Slice 3 — every cabinet must belong to
 *         a DesignItem; picker surfaces "select existing" + "create new")
 * Step 3: Confirm — creates SceneCabinet in scene
 */
import { useState, useCallback } from 'react';
import { useProductDefinitions } from '../../hooks/useProductDefinition';
import type { ProductDefinitionDocument } from '../../types/productDefinition.types';
import type { AddCabinetInput } from '../../schemas/scene.schemas';
import { DesignItemPicker, type DesignItemPickerValue } from './DesignItemPicker';
import { isStandaloneProjectId } from '../../utils/sceneProjectUtils';

interface AddCabinetDialogProps {
  sceneId: string;
  /** P2: used by DesignItemPicker to load / create DesignItems. */
  projectId: string;
  /** P2: required by createDesignItem audit fields. */
  userId: string;
  onAdd: (input: AddCabinetInput) => Promise<void>;
  onClose: () => void;
  existingCodes: string[];
}

type Step = 'select_pdd' | 'configure' | 'confirm';

export function AddCabinetDialog({ projectId, userId, onAdd, onClose, existingCodes }: AddCabinetDialogProps) {
  const [step, setStep] = useState<Step>('select_pdd');
  const [selectedPDD, setSelectedPDD] = useState<ProductDefinitionDocument | null>(null);
  const [cabinetCode, setCabinetCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedDesignItem, setSelectedDesignItem] = useState<DesignItemPickerValue | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // P2 Slice 3: every new cabinet must belong to a DesignItem (unless the
  // scene is a standalone/quick-review scene — the picker renders a
  // disabled state in that case and we don't enforce here).
  const isStandaloneScene = isStandaloneProjectId(projectId);
  const canAddCabinet =
    !!cabinetCode &&
    !existingCodes.includes(cabinetCode) &&
    !!displayName &&
    (isStandaloneScene || !!selectedDesignItem) &&
    !isAdding;

  const { data: pdds, isLoading: pddsLoading } = useProductDefinitions({ status: 'active' });

  const handleSelectPDD = useCallback((pdd: ProductDefinitionDocument) => {
    setSelectedPDD(pdd);
    // Auto-generate cabinet code suggestion
    const typePrefix = pdd.productType?.slice(0, 3).toUpperCase() ?? 'CAB';
    const nameShort = pdd.name?.replace(/[^A-Z0-9]/gi, '').slice(0, 5).toUpperCase() ?? '';
    const base = `${typePrefix}${nameShort}`.slice(0, 8);

    // Find next available suffix
    let suffix = 'A';
    for (let i = 0; i < 26; i++) {
      const candidate = `${base}-${String.fromCharCode(65 + i)}`;
      if (!existingCodes.includes(candidate)) {
        suffix = String.fromCharCode(65 + i);
        break;
      }
    }
    setCabinetCode(`${base}-${suffix}`);
    setDisplayName(pdd.name ?? '');
    setStep('configure');
  }, [existingCodes]);

  const handleConfirm = useCallback(async () => {
    if (!selectedPDD || !cabinetCode) return;

    setIsAdding(true);
    setError(null);
    try {
      // Build default configuration from PDD parameters
      const configuration: Record<string, unknown> = {};
      for (const param of selectedPDD.parameters ?? []) {
        configuration[param.key] = param.default;
      }

      const finishSelections: Record<string, string> = {};
      const defaults = (selectedPDD as unknown as { defaultFinishMappings?: Record<string, string> }).defaultFinishMappings;
      if (defaults) {
        Object.assign(finishSelections, defaults);
      }

      await onAdd({
        pddId: selectedPDD.id,
        cabinetCode,
        displayName,
        configuration,
        finishSelections,
        ...(selectedDesignItem ? { designItemId: selectedDesignItem.id } : {}),
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsAdding(false);
    }
  }, [selectedPDD, cabinetCode, displayName, selectedDesignItem, onAdd, onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">
            {step === 'select_pdd' && 'Select Product Template'}
            {step === 'configure' && 'Configure Cabinet'}
            {step === 'confirm' && 'Confirm'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 'select_pdd' && (
            <PDDPicker
              pdds={pdds ?? []}
              isLoading={pddsLoading}
              onSelect={handleSelectPDD}
            />
          )}

          {step === 'configure' && selectedPDD && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cabinet Code</label>
                <input
                  type="text"
                  value={cabinetCode}
                  onChange={e => setCabinetCode(e.target.value.toUpperCase())}
                  className="w-full border rounded-md px-3 py-2 text-sm font-mono"
                  placeholder="KB600-A"
                />
                {existingCodes.includes(cabinetCode) && (
                  <p className="text-xs text-red-500 mt-1">Code already in use</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  placeholder="Kitchen Base 600 — Sink Run"
                />
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Template</p>
                <p className="text-sm font-medium">{selectedPDD.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{selectedPDD.description}</p>
                <div className="flex gap-3 mt-2 text-xs text-gray-400">
                  <span>{selectedPDD.parameters?.length ?? 0} parameters</span>
                  <span>{selectedPDD.productType}</span>
                </div>
              </div>

              {/* P2 Slice 3 — DesignItem binding. Required for project-backed
                  scenes; picker renders its own standalone-scene warning. */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Design Item <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Which logical grouping does this cabinet belong to? (e.g. "Kitchen",
                  "Master Wardrobes"). Picks up existing items or creates a new one.
                </p>
                <DesignItemPicker
                  projectId={projectId}
                  userId={userId}
                  value={selectedDesignItem}
                  onChange={setSelectedDesignItem}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 mt-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between px-6 py-3 border-t bg-gray-50">
          <div>
            {step !== 'select_pdd' && (
              <button
                type="button"
                onClick={() => setStep('select_pdd')}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
            >
              Cancel
            </button>
            {step === 'configure' && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canAddCabinet}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {isAdding ? 'Adding...' : 'Add Cabinet'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PDD Picker ──

function PDDPicker({
  pdds,
  isLoading,
  onSelect,
}: {
  pdds: ProductDefinitionDocument[];
  isLoading: boolean;
  onSelect: (pdd: ProductDefinitionDocument) => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = pdds.filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.productType?.toLowerCase().includes(search.toLowerCase()),
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search templates..."
        className="w-full border rounded-md px-3 py-2 text-sm"
        autoFocus
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No active templates found</p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {filtered.map(pdd => (
            <button
              key={pdd.id}
              type="button"
              onClick={() => onSelect(pdd)}
              className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <p className="text-sm font-medium">{pdd.name}</p>
              {pdd.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{pdd.description}</p>
              )}
              <div className="flex gap-2 mt-1 text-xs text-gray-400">
                <span className="px-1.5 py-0.5 bg-gray-100 rounded">{pdd.productType}</span>
                <span>{pdd.parameters?.length ?? 0} params</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
