/**
 * PartDetailDrawer Component
 * Slide-out drawer for viewing and inline-editing a part's dimensions, edging, grain, and notes.
 * Eliminates the two-step edit flow — changes save on blur or explicit save.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Save, Loader2, Check, Plus, Search } from 'lucide-react';
import type { PartEntry } from '../../types';
import { useFeatureLibrary } from '../../hooks/useFeatureLibrary';
import { calculatePartFeatureCost, scaleFeatureCostByQuantity } from '../../utils/featureCost';
import { DEFAULT_ESTIMATE_CONFIG } from '../../types/estimate';

interface PartDetailDrawerProps {
  part: PartEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (partId: string, data: Partial<PartEntry>) => Promise<void>;
  saving?: boolean;
}

export function PartDetailDrawer({ part, isOpen, onClose, onSave, saving }: PartDetailDrawerProps) {
  const [formData, setFormData] = useState({
    name: '',
    length: '',
    width: '',
    thickness: '',
    quantity: '',
    materialName: '',
    grainDirection: 'none' as 'length' | 'width' | 'none',
    edgeBanding: { top: false, bottom: false, left: false, right: false },
    notes: '',
    manufacturingPriority: '' as string,
    // P17 slice 3: features linked to this part from the library.
    // Kept as a string[] so the multi-select is trivial — order preserved
    // so the UI renders in the order the user added them.
    featureIds: [] as string[],
  });
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Sync form when part changes
  useEffect(() => {
    if (part) {
      setFormData({
        name: part.name,
        length: part.length.toString(),
        width: part.width.toString(),
        thickness: part.thickness.toString(),
        quantity: part.quantity.toString(),
        materialName: part.materialName,
        grainDirection: part.grainDirection,
        edgeBanding: { ...part.edgeBanding },
        notes: part.notes || '',
        manufacturingPriority: (part as any).manufacturingPriority?.toString() || '',
        featureIds: part.featureIds ?? [],
      });
      setDirty(false);
      setSaveStatus('idle');
    }
  }, [part]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const updateField = useCallback(<K extends keyof typeof formData>(key: K, value: typeof formData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const toggleEdge = useCallback((edge: 'top' | 'bottom' | 'left' | 'right') => {
    setFormData(prev => ({
      ...prev,
      edgeBanding: { ...prev.edgeBanding, [edge]: !prev.edgeBanding[edge] },
    }));
    setDirty(true);
  }, []);

  const setAllEdges = useCallback((value: boolean) => {
    setFormData(prev => ({
      ...prev,
      edgeBanding: { top: value, bottom: value, left: value, right: value },
    }));
    setDirty(true);
  }, []);

  const handleSave = async () => {
    if (!part || !dirty) return;
    setSaveStatus('saving');
    const data: Partial<PartEntry> & { manufacturingPriority?: number } = {
      name: formData.name,
      length: parseFloat(formData.length),
      width: parseFloat(formData.width),
      thickness: parseFloat(formData.thickness),
      quantity: parseInt(formData.quantity, 10),
      materialName: formData.materialName,
      grainDirection: formData.grainDirection,
      edgeBanding: formData.edgeBanding,
    };
    if (formData.notes) data.notes = formData.notes;
    if (formData.manufacturingPriority) {
      data.manufacturingPriority = parseInt(formData.manufacturingPriority);
    }
    // Always write featureIds — an empty array is a meaningful signal
    // ("the user cleared the features") and must propagate to Firestore
    // so downstream estimates stop counting the removed feature hours.
    data.featureIds = formData.featureIds;
    await onSave(part.id, data);
    setDirty(false);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  // P17 slice 3 — feature library integration.
  // We load the full library at drawer open. The picker is a small
  // searchable list; selected features render as removable chips. The
  // rate displayed is just a preview using DEFAULT_ESTIMATE_CONFIG —
  // the authoritative cost is recomputed at estimate time by
  // `calculateFeatureLaborFromParts`, so any drift between this
  // preview and the final estimate is only visual.
  const { features, isLoading: featuresLoading } = useFeatureLibrary();
  const [featureSearch, setFeatureSearch] = useState('');
  const [featurePickerOpen, setFeaturePickerOpen] = useState(false);

  const featureById = useMemo(() => new Map(features.map((f) => [f.id, f])), [features]);
  const linkedFeatures = useMemo(
    () =>
      formData.featureIds
        .map((id) => featureById.get(id))
        .filter((f): f is NonNullable<typeof f> => Boolean(f)),
    [formData.featureIds, featureById],
  );
  const unresolvedFeatureIds = useMemo(
    () => formData.featureIds.filter((id) => !featureById.has(id)),
    [formData.featureIds, featureById],
  );
  const featureSearchResults = useMemo(() => {
    const term = featureSearch.trim().toLowerCase();
    const selected = new Set(formData.featureIds);
    return features
      .filter((f) => !selected.has(f.id))
      .filter(
        (f) =>
          !term ||
          f.name.toLowerCase().includes(term) ||
          f.code.toLowerCase().includes(term) ||
          f.category.toLowerCase().includes(term),
      )
      .slice(0, 8);
  }, [features, featureSearch, formData.featureIds]);

  const qty = Math.max(1, parseInt(formData.quantity, 10) || 1);
  const featureCostPreview = useMemo(() => {
    if (formData.featureIds.length === 0) return null;
    const base = calculatePartFeatureCost(formData.featureIds, features, {
      laborRatePerHour: DEFAULT_ESTIMATE_CONFIG.laborRatePerHour,
      currency: 'UGX',
    });
    return scaleFeatureCostByQuantity(base, qty, features);
  }, [formData.featureIds, features, qty]);

  const toggleFeature = useCallback((id: string) => {
    setFormData((prev) => {
      const has = prev.featureIds.includes(id);
      return {
        ...prev,
        featureIds: has
          ? prev.featureIds.filter((x) => x !== id)
          : [...prev.featureIds, id],
      };
    });
    setDirty(true);
  }, []);

  if (!isOpen || !part) return null;

  const lengths = (formData.edgeBanding.top ? 1 : 0) + (formData.edgeBanding.bottom ? 1 : 0);
  const widths = (formData.edgeBanding.left ? 1 : 0) + (formData.edgeBanding.right ? 1 : 0);
  const allEdges = formData.edgeBanding.top && formData.edgeBanding.bottom && formData.edgeBanding.left && formData.edgeBanding.right;
  const noEdges = !formData.edgeBanding.top && !formData.edgeBanding.bottom && !formData.edgeBanding.left && !formData.edgeBanding.right;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-out translate-x-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">{part.partNumber || 'Part Detail'}</h3>
            <p className="text-sm text-gray-500 truncate">{formData.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {dirty && (
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                Unsaved
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <Check className="w-3 h-3" />
                Saved
              </span>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Part Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Part Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
            />
          </div>

          {/* Dimensions */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Dimensions (mm)</label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Length</label>
                <input
                  type="number"
                  value={formData.length}
                  onChange={(e) => updateField('length', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Width</label>
                <input
                  type="number"
                  value={formData.width}
                  onChange={(e) => updateField('width', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Thickness</label>
                <input
                  type="number"
                  value={formData.thickness}
                  onChange={(e) => updateField('thickness', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
                  min="1"
                />
              </div>
            </div>
          </div>

          {/* Quantity & Material */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Quantity</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => updateField('quantity', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
                min="1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Priority</label>
              <select
                value={formData.manufacturingPriority}
                onChange={(e) => updateField('manufacturingPriority', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
              >
                <option value="">Default</option>
                <option value="1">1 - First</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5 - Last</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Material</label>
            <input
              type="text"
              value={formData.materialName}
              onChange={(e) => updateField('materialName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E]"
            />
          </div>

          {/* Grain Direction */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Grain Direction</label>
            <div className="flex gap-2">
              {(['none', 'length', 'width'] as const).map((dir) => (
                <button
                  key={dir}
                  onClick={() => updateField('grainDirection', dir)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    formData.grainDirection === dir
                      ? dir === 'length' ? 'bg-blue-100 border-blue-300 text-blue-700'
                        : dir === 'width' ? 'bg-amber-100 border-amber-300 text-amber-700'
                        : 'bg-gray-100 border-gray-300 text-gray-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {dir === 'none' ? 'None' : dir === 'length' ? 'Length' : 'Width'}
                </button>
              ))}
            </div>
          </div>

          {/* Edge Banding - Visual */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-500 uppercase">Edge Banding</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setAllEdges(true)}
                  className={`text-xs px-2 py-0.5 rounded ${allEdges ? 'bg-[#0A7C8E] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  All Round
                </button>
                <button
                  onClick={() => setAllEdges(false)}
                  className={`text-xs px-2 py-0.5 rounded ${noEdges ? 'bg-gray-300 text-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Visual part representation */}
            <div className="relative bg-gray-50 rounded-lg p-6">
              <div className="relative mx-auto" style={{ width: '200px', height: '140px' }}>
                {/* Top edge */}
                <button
                  onClick={() => toggleEdge('top')}
                  className={`absolute -top-3 left-4 right-4 h-6 rounded-t-md flex items-center justify-center text-xs font-medium transition-colors ${
                    formData.edgeBanding.top
                      ? 'bg-[#0A7C8E] text-white'
                      : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  }`}
                >
                  Top (L)
                </button>
                {/* Bottom edge */}
                <button
                  onClick={() => toggleEdge('bottom')}
                  className={`absolute -bottom-3 left-4 right-4 h-6 rounded-b-md flex items-center justify-center text-xs font-medium transition-colors ${
                    formData.edgeBanding.bottom
                      ? 'bg-[#0A7C8E] text-white'
                      : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  }`}
                >
                  Bottom (L)
                </button>
                {/* Left edge */}
                <button
                  onClick={() => toggleEdge('left')}
                  className={`absolute top-4 -left-3 bottom-4 w-6 rounded-l-md flex items-center justify-center text-xs font-medium transition-colors ${
                    formData.edgeBanding.left
                      ? 'bg-[#0A7C8E] text-white'
                      : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  }`}
                  style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                >
                  L (W)
                </button>
                {/* Right edge */}
                <button
                  onClick={() => toggleEdge('right')}
                  className={`absolute top-4 -right-3 bottom-4 w-6 rounded-r-md flex items-center justify-center text-xs font-medium transition-colors ${
                    formData.edgeBanding.right
                      ? 'bg-[#0A7C8E] text-white'
                      : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  }`}
                  style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                >
                  R (W)
                </button>
                {/* Center - the panel */}
                <div className="absolute inset-3 bg-white border-2 border-gray-300 rounded flex flex-col items-center justify-center text-xs text-gray-500">
                  <span className="font-mono font-medium text-gray-700">{formData.length} × {formData.width}</span>
                  <span className="text-gray-400 mt-0.5">mm</span>
                </div>
              </div>
            </div>

            {/* Edging summary */}
            <div className="mt-3 flex items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded ${lengths > 0 ? 'bg-[#0A7C8E]' : 'bg-gray-200'}`} />
                <span className={lengths > 0 ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                  {lengths}L
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded ${widths > 0 ? 'bg-[#0A7C8E]' : 'bg-gray-200'}`} />
                <span className={widths > 0 ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                  {widths}W
                </span>
              </div>
              {(lengths > 0 || widths > 0) && (
                <span className="text-gray-400 text-xs">
                  = {[lengths > 0 && `${lengths}×${formData.length}`, widths > 0 && `${widths}×${formData.width}`].filter(Boolean).join(' + ')} mm
                </span>
              )}
            </div>
          </div>

          {/* Features — P17 slice 3. Reusable manufacturing operations
              (joinery, finishing, hardware prep, ...) linked to this part.
              Each adds labor hours to the estimate via the Feature
              Library's time × intensity × skill formula. */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-500 uppercase">Features</label>
              {featureCostPreview && featureCostPreview.totalHours > 0 && (
                <span className="text-xs text-gray-500">
                  <span className="font-mono text-gray-700">
                    {featureCostPreview.totalHours.toFixed(2)}h
                  </span>
                  <span className="mx-1">·</span>
                  <span className="font-mono text-gray-700">
                    {Math.round(featureCostPreview.totalLaborCost).toLocaleString()}
                  </span>
                  <span className="ml-1 text-gray-400">UGX</span>
                  <span className="ml-2 text-gray-400">(preview × qty {qty})</span>
                </span>
              )}
            </div>

            {/* Selected features as removable chips */}
            {linkedFeatures.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {linkedFeatures.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => toggleFeature(f.id)}
                    className="group inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#0A7C8E]/10 text-[#0A7C8E] text-xs font-medium hover:bg-red-50 hover:text-red-600"
                    title={`${f.code} — click to remove`}
                  >
                    <span className="font-mono">{f.code}</span>
                    <span className="truncate max-w-[160px]">{f.name}</span>
                    <X className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            )}

            {/* Stale feature ids — the feature was deleted from the
                library but the link remains on the part. Surface these
                so the user can clean them up; estimateService also
                reports them via unresolvedFeatureIds. */}
            {unresolvedFeatureIds.length > 0 && !featuresLoading && (
              <div className="mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                {unresolvedFeatureIds.length} linked feature
                {unresolvedFeatureIds.length === 1 ? '' : 's'} no longer exist in
                the library. Remove:
                {unresolvedFeatureIds.map((id) => (
                  <button
                    key={id}
                    onClick={() => toggleFeature(id)}
                    className="ml-1 underline hover:text-amber-900"
                  >
                    {id.slice(0, 8)}
                  </button>
                ))}
              </div>
            )}

            {/* Picker */}
            {!featurePickerOpen ? (
              <button
                onClick={() => setFeaturePickerOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:text-[#0A7C8E] hover:border-[#0A7C8E]"
              >
                <Plus className="w-4 h-4" />
                Add feature
              </button>
            ) : (
              <div className="border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-100">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    autoFocus
                    type="text"
                    value={featureSearch}
                    onChange={(e) => setFeatureSearch(e.target.value)}
                    placeholder="Search by name, code, or category..."
                    className="flex-1 text-sm outline-none"
                  />
                  <button
                    onClick={() => {
                      setFeaturePickerOpen(false);
                      setFeatureSearch('');
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {featuresLoading ? (
                    <div className="px-3 py-4 text-xs text-gray-500 text-center">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    </div>
                  ) : featureSearchResults.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-gray-500 text-center">
                      {featureSearch
                        ? 'No matching features'
                        : formData.featureIds.length === features.length
                        ? 'All library features already linked'
                        : 'No features in the library yet'}
                    </div>
                  ) : (
                    featureSearchResults.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          toggleFeature(f.id);
                          setFeatureSearch('');
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-b-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm text-gray-900 truncate">
                              <span className="font-mono text-xs text-gray-500 mr-1.5">
                                {f.code}
                              </span>
                              {f.name}
                            </div>
                            <div className="text-xs text-gray-400 truncate">
                              {f.category} · {f.estimatedTime.typical}h typical ·{' '}
                              {f.costFactors.skillLevel}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A7C8E]/20 focus:border-[#0A7C8E] resize-none"
              placeholder="Manufacturing notes, special instructions..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || saving || saveStatus === 'saving'}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
              saveStatus === 'saved'
                ? 'bg-green-600 text-white'
                : 'bg-[#0A7C8E] text-white hover:bg-[#0A7C8E]/90'
            }`}
          >
            {saveStatus === 'saving' || saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            ) : saveStatus === 'saved' ? (
              <><Check className="w-4 h-4" /> Saved</>
            ) : (
              <><Save className="w-4 h-4" /> Save Changes</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PartDetailDrawer;
