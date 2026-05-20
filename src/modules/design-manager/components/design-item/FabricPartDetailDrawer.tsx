import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Save, X } from 'lucide-react';
import type { PartEntry } from '../../types';

interface FabricPartDetailDrawerProps {
  part: PartEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (partId: string, data: Partial<PartEntry>) => Promise<void>;
  saving?: boolean;
}

export function FabricPartDetailDrawer({
  part,
  isOpen,
  onClose,
  onSave,
  saving,
}: FabricPartDetailDrawerProps) {
  const [formData, setFormData] = useState({
    name: '',
    length: '',
    width: '',
    quantity: '',
    materialName: '',
    rollWidth: '',
    notes: '',
  });
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (!part) return;
    setFormData({
      name: part.name,
      length: String(part.length || ''),
      width: String(part.width || ''),
      quantity: String(part.quantity || 1),
      materialName: part.materialName || '',
      rollWidth: part.rollWidth ? String(part.rollWidth) : '',
      notes: part.notes || '',
    });
    setDirty(false);
    setSaveStatus('idle');
  }, [part]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const updateField = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const areaPreview = useMemo(() => {
    const length = Math.max(0, Number(formData.length) || 0);
    const width = Math.max(0, Number(formData.width) || 0);
    const qty = Math.max(0, Number(formData.quantity) || 0);
    const rollWidthMm = Math.max(0, Number(formData.rollWidth) || 0);

    const areaPerPiece = (length * width) / 1_000_000;
    const totalArea = areaPerPiece * qty;
    const linearMeters = rollWidthMm > 0 ? totalArea / (rollWidthMm / 1000) : 0;

    return { areaPerPiece, totalArea, linearMeters };
  }, [formData.length, formData.width, formData.quantity, formData.rollWidth]);

  const handleSave = async () => {
    if (!part || !dirty) return;
    setSaveStatus('saving');
    const data: Partial<PartEntry> = {
      name: formData.name.trim(),
      length: Math.max(0, Number(formData.length) || 0),
      width: Math.max(0, Number(formData.width) || 0),
      quantity: Math.max(1, Number(formData.quantity) || 1),
      materialName: formData.materialName.trim(),
      partType: 'fabric',
      notes: formData.notes.trim(),
    };
    const rollWidth = Number(formData.rollWidth);
    data.rollWidth = Number.isFinite(rollWidth) && rollWidth > 0 ? rollWidth : undefined;

    await onSave(part.id, data);
    setDirty(false);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  if (!part || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-violet-50">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">{part.partNumber || 'Fabric Part'}</h3>
            <p className="text-sm text-gray-600 truncate">{formData.name || 'Unnamed fabric part'}</p>
          </div>
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-amber-700">Unsaved</span>}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-xs text-green-700">
                <Check className="w-3 h-3" />
                Saved
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Part Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 uppercase mb-1">Length (mm)</label>
              <input
                type="number"
                min="0"
                value={formData.length}
                onChange={(e) => updateField('length', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-right font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 uppercase mb-1">Width (mm)</label>
              <input
                type="number"
                min="0"
                value={formData.width}
                onChange={(e) => updateField('width', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-right font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 uppercase mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => updateField('quantity', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-right font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 uppercase mb-1">Roll Width (mm)</label>
              <input
                type="number"
                min="0"
                value={formData.rollWidth}
                onChange={(e) => updateField('rollWidth', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-right font-mono"
                placeholder="Optional"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Fabric Material</label>
            <input
              type="text"
              value={formData.materialName}
              onChange={(e) => updateField('materialName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
            <p className="text-xs font-semibold text-violet-900 uppercase mb-2">Consumption Preview</p>
            <div className="space-y-1 text-sm text-violet-900">
              <div className="flex items-center justify-between">
                <span>Area / piece</span>
                <span className="font-mono">{areaPreview.areaPerPiece.toFixed(3)} m²</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total area</span>
                <span className="font-mono">{areaPreview.totalArea.toFixed(3)} m²</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Linear meters (from roll width)</span>
                <span className="font-mono">
                  {formData.rollWidth ? `${areaPreview.linearMeters.toFixed(3)} m` : 'Set roll width'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Notes</label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
            />
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || saving || saveStatus === 'saving'}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-violet-700 text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {saveStatus === 'saving' || saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FabricPartDetailDrawer;
